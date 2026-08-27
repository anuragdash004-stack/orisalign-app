import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import type { AmountType } from "@/lib/onlineReportPricing"
import { recordReportPayment } from "@/lib/onlineReportPaymentRecording"

/**
 * POST /api/online-report/cashfree/webhook
 *
 * Server-to-server confirmation for Online Smile Report payments — the
 * reliability net the browser-only Razorpay flow never had, which is the
 * whole reason this flow moved to Cashfree by default.
 *
 * Only handles impression / plan_only / plan_treatment. The initial "report"
 * (Step 1) submission needs the patient's full intake form — name, medical
 * history, dental self-assessment, five uploaded photos — none of which a
 * gateway webhook payload can carry, and none of which exists in the
 * database yet at that point (only a partial lead row, from
 * app/api/online-report/lead). So Step 1 stays browser-driven, confirmed via
 * app/api/online-report/cashfree/verify, same reliability class as before —
 * fixing that fully would mean saving the whole form before payment starts,
 * a bigger change than swapping gateways.
 *
 * Setup (do this once, in the Cashfree dashboard):
 *   Developers → Webhooks → add https://orisalign.com/api/online-report/cashfree/webhook
 *   Subscribe to PAYMENT_SUCCESS_WEBHOOK. Same secret as CASHFREE_SECRET_KEY.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CashfreeWebhookPayload {
  type?: string
  data?: {
    order?: {
      order_id?: string
      order_amount?: number
      order_tags?: Record<string, string> | null
    }
    payment?: {
      payment_status?: string
      payment_amount?: number
    }
    customer_details?: {
      customer_id?: string
    }
  }
}

export async function POST(req: Request) {
  const secret = process.env.CASHFREE_SECRET_KEY
  if (!secret) {
    console.error("[online-report/cashfree/webhook] CASHFREE_SECRET_KEY not configured")
    return NextResponse.json({ error: "not configured" }, { status: 500 })
  }

  const timestamp = req.headers.get("x-webhook-timestamp")
  const signature = req.headers.get("x-webhook-signature")
  const rawBody = await req.text()

  if (!timestamp || !signature) {
    console.warn("[online-report/cashfree/webhook] missing signature headers")
    return NextResponse.json({ error: "missing signature" }, { status: 401 })
  }

  const expected = crypto.createHmac("sha256", secret).update(timestamp + rawBody).digest("base64")
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)

  if (!valid) {
    console.warn("[online-report/cashfree/webhook] signature mismatch")
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  let payload: CashfreeWebhookPayload
  try {
    payload = JSON.parse(rawBody) as CashfreeWebhookPayload
  } catch (e) {
    console.error("[online-report/cashfree/webhook] could not parse body", e)
    return NextResponse.json({ ok: true })
  }

  try {
    await handleEvent(payload)
  } catch (e) {
    console.error("[online-report/cashfree/webhook] handler error", e)
  }

  return NextResponse.json({ ok: true })
}

async function handleEvent(payload: CashfreeWebhookPayload) {
  const eventType = payload.type
  const orderId = payload.data?.order?.order_id
  const reportId = payload.data?.customer_details?.customer_id
  const paymentStatus = payload.data?.payment?.payment_status
  const amountType = payload.data?.order?.order_tags?.amount_type as AmountType | undefined
  const couponIdTag = payload.data?.order?.order_tags?.coupon_id || null

  if (!orderId || !reportId || !amountType) {
    console.warn("[online-report/cashfree/webhook] missing orderId/reportId/amountType", { eventType, orderId, reportId, amountType })
    return
  }

  if (amountType === "report") {
    console.info("[online-report/cashfree/webhook] skipping 'report' — needs formData, browser-verify handles it", orderId)
    return
  }

  if (eventType !== "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus !== "SUCCESS") {
    console.info("[online-report/cashfree/webhook] non-success event", { eventType, paymentStatus, orderId })
    return
  }

  const amountPaidRupees = Math.round(Number(payload.data?.payment?.payment_amount) || 0)

  const result = await recordReportPayment({
    supabase,
    amountType,
    reportId,
    amountPaidRupees,
    gatewayPaymentId: orderId,
    gatewayOrderId: orderId,
    couponId: couponIdTag,
  })

  if (!result.success) {
    console.warn("[online-report/cashfree/webhook] failed to record payment", result.error, orderId)
  }
}
