import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { logAuditEntry } from "@/lib/auditLog"
import { recordPaymentReceived } from "@/lib/paymentHelper"

/**
 * POST /api/razorpay/webhook
 *
 * Server-to-server callback from Razorpay — the missing counterpart to
 * /api/cashfree/webhook. Until this existed, a Razorpay payment was only
 * ever recorded if the patient's own browser came back and ran the
 * `handler` callback in app/checkout/page.tsx's Razorpay Checkout widget
 * (which calls /api/verify-payment). On mobile, paying via a UPI app
 * switch (exactly how a phone-guided patient pays) very often never
 * returns to that callback even though the payment itself succeeded on
 * Razorpay's side — the money moves, but this app never finds out. This
 * webhook closes that gap, mirroring Cashfree's design: it fires
 * regardless of what the browser does.
 *
 * Setup (does this once, in the Razorpay dashboard):
 *   1. Settings → Webhooks → Add New Webhook:
 *        URL: https://app.orisalign.com/api/razorpay/webhook
 *        Active events: payment.captured
 *   2. Razorpay generates a webhook secret at that point — set it as the
 *      RAZORPAY_WEBHOOK_SECRET environment variable (this is NOT the same
 *      as RAZORPAY_KEY_SECRET, which is the API secret).
 *
 * Signature scheme (HMAC-SHA256):
 *   expected = hex( HMAC_SHA256(RAZORPAY_WEBHOOK_SECRET, raw_request_body) )
 *   header   = x-razorpay-signature
 *
 * Always returns 200 unless the signature itself is bad — Razorpay retries
 * on non-2xx, and a bug on our end shouldn't cause a retry storm.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RazorpayWebhookPayload {
  event?: string
  payload?: {
    payment?: {
      entity?: {
        id?: string
        order_id?: string
        amount?: number
        status?: string
        method?: string
        created_at?: number
      }
    }
  }
}

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error("[razorpay/webhook] RAZORPAY_WEBHOOK_SECRET not configured")
    return NextResponse.json({ error: "not configured" }, { status: 500 })
  }

  const signature = req.headers.get("x-razorpay-signature")
  const rawBody = await req.text()

  if (!signature) {
    console.warn("[razorpay/webhook] missing signature header")
    return NextResponse.json({ error: "missing signature" }, { status: 401 })
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)

  if (!valid) {
    console.warn("[razorpay/webhook] signature mismatch")
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  let payload: RazorpayWebhookPayload
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload
  } catch (e) {
    console.error("[razorpay/webhook] could not parse body", e)
    return NextResponse.json({ ok: true }) // 200 so Razorpay doesn't retry malformed
  }

  try {
    await handleEvent(payload)
  } catch (e) {
    console.error("[razorpay/webhook] handler error", e)
    // Still return 200 — a bug in our code shouldn't cause a retry storm.
  }

  return NextResponse.json({ ok: true })
}

async function handleEvent(payload: RazorpayWebhookPayload) {
  if (payload.event !== "payment.captured") {
    console.info("[razorpay/webhook] ignoring non-capture event", payload.event)
    return
  }

  const payment = payload.payload?.payment?.entity
  const orderId = payment?.order_id
  const paymentId = payment?.id
  // /api/create-order stamps receipt: String(appointmentId) when the order
  // is created — Razorpay echoes it back on the order, but the payment
  // webhook only carries order_id, so fetch the order itself to read it.
  if (!orderId) {
    console.warn("[razorpay/webhook] missing order_id in payload")
    return
  }

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    console.error("[razorpay/webhook] Razorpay API credentials not configured")
    return
  }

  const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: { Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64") },
  })
  if (!orderRes.ok) {
    console.error("[razorpay/webhook] failed to fetch order", orderId, await orderRes.text())
    return
  }
  const order = await orderRes.json()
  const appointmentId = order.receipt as string | undefined
  if (!appointmentId) {
    console.warn("[razorpay/webhook] order has no receipt/appointmentId", orderId)
    return
  }

  const { data: appt, error } = await supabase
    .from("appointments_booking")
    .select("payment_data")
    .eq("id", appointmentId)
    .single()

  if (error || !appt) {
    console.error("[razorpay/webhook] appointment not found", appointmentId)
    return
  }

  const pd = (appt.payment_data as Record<string, unknown>) || {}

  // Idempotency: if we already recorded this exact Razorpay payment, skip —
  // this webhook and the browser-side /api/verify-payment can both fire for
  // the same payment, one server-to-server and one via the customer's own
  // browser, and must not double-record the same money.
  if (pd.razorpay_payment_id === paymentId) {
    return
  }

  const amountPaidRupees = Number(payment?.amount || order.amount) / 100

  const newPaymentData: Record<string, unknown> = {
    ...pd,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_paid_amount: amountPaidRupees,
    razorpay_paid_at: payment?.created_at ? new Date(payment.created_at * 1000).toISOString() : new Date().toISOString(),
    razorpay_source: "webhook",
  }

  const { error: updateError } = await supabase
    .from("appointments_booking")
    .update({ payment_data: newPaymentData })
    .eq("id", appointmentId)

  if (updateError) {
    console.error("[razorpay/webhook] supabase update failed", updateError, appointmentId)
    return
  }

  await logAuditEntry({
    appointmentId,
    actorEmail: "razorpay",
    actorRole: "payment_gateway",
    action: "Payment Received",
    entity: "payment_data",
    newData: newPaymentData,
    oldData: pd,
  })

  try {
    const result = await recordPaymentReceived({
      supabase,
      appointmentId,
      amountPaid: amountPaidRupees,
      transactionId: paymentId,
      paymentMethod: "Razorpay",
      notes: `Payment via ${payment?.method || "online"} (webhook)`,
      actorEmail: "razorpay_webhook",
      actorRole: "payment_gateway",
    })
    if (!result.success) {
      console.warn("[razorpay/webhook] failed to update payment status", result.error)
    }
  } catch (e) {
    console.error("[razorpay/webhook] payment status update error", e)
  }
}
