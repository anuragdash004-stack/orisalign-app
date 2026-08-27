import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { AmountType } from "@/lib/onlineReportPricing"
import { recordReportPayment, type ReportFormData } from "@/lib/onlineReportPaymentRecording"

/**
 * POST /api/online-report/cashfree/verify
 *
 * Browser-driven confirmation, called right after the Cashfree checkout
 * modal closes successfully. Never trusts the modal's own "it worked" signal
 * — re-fetches the order from Cashfree's own API to get the authoritative
 * status and amount before applying anything.
 *
 * This is the only path that can record a "report" (Step 1) payment, since
 * that's the one case that needs formData the server never otherwise has —
 * see the webhook's comment for why. Impression/plan payments recorded here
 * are idempotent against the webhook (recordReportPayment checks first).
 */

export const runtime = "nodejs"

const CF_ENV = (process.env.CASHFREE_ENV || "sandbox").trim().toLowerCase()
const CF_BASE =
  CF_ENV === "production"
    ? "https://api.cashfree.com/pg/orders"
    : "https://sandbox.cashfree.com/pg/orders"
const CF_APP_ID = (process.env.CASHFREE_APP_ID || "").trim()
const CF_SECRET = (process.env.CASHFREE_SECRET_KEY || "").trim()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    if (!CF_APP_ID || !CF_SECRET) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 })
    }

    const { orderId, amountType, reportId, couponId, formData } = await req.json()
    if (!orderId || !amountType || !reportId) {
      return NextResponse.json({ error: "orderId, amountType and reportId required" }, { status: 400 })
    }
    if (amountType === "report" && !formData) {
      return NextResponse.json({ error: "formData required" }, { status: 400 })
    }

    const cfRes = await fetch(`${CF_BASE}/${encodeURIComponent(orderId)}`, {
      headers: {
        "x-client-id": CF_APP_ID,
        "x-client-secret": CF_SECRET,
        "x-api-version": "2023-08-01",
      },
      cache: "no-store",
    })
    const cfData = await cfRes.json()
    if (!cfRes.ok) {
      return NextResponse.json({ error: cfData.message || "Verify failed" }, { status: 502 })
    }

    if (cfData.order_status !== "PAID") {
      return NextResponse.json({ error: `Payment not completed (status: ${cfData.order_status})` }, { status: 400 })
    }

    const amountPaidRupees = Math.round(Number(cfData.order_amount) || 0)

    const result = await recordReportPayment({
      supabase,
      amountType: amountType as AmountType,
      reportId,
      amountPaidRupees,
      // The order-status endpoint doesn't return a payment id directly (that
      // needs a separate /orders/{id}/payments call) — orderId is already
      // unique per checkout attempt, so it works equally well as the
      // idempotency key here, same as app/api/cashfree/verify does.
      gatewayPaymentId: orderId,
      gatewayOrderId: orderId,
      couponId,
      formData: formData as ReportFormData | undefined,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 })
    }

    return NextResponse.json({ success: true, reportId })
  } catch (error) {
    console.error("Error verifying online-report Cashfree payment:", error)
    return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 })
  }
}
