import { NextResponse } from "next/server"
import crypto from "crypto"
import Razorpay from "razorpay"
import { createClient } from "@supabase/supabase-js"
import type { AmountType } from "@/lib/onlineReportPricing"
import { recordReportPayment, type ReportFormData } from "@/lib/onlineReportPaymentRecording"

// NOTE: this currently uses the LIVE Razorpay key already configured in this
// project — see app/api/online-report/create-order/route.ts for details.
// Razorpay is now the manually-revealed fallback gateway for this flow —
// Cashfree (app/api/online-report/cashfree/*) is the default. Kept working
// exactly as before for patients who fall back to it.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/online-report/verify-payment
 * Body: {
 *   razorpay_order_id, razorpay_payment_id, razorpay_signature,
 *   amountType: AmountType,
 *   couponId?: string,
 *   reportId?: string,       // required for amountType !== "report"; also the
 *                             // client-generated id to insert-as for "report"
 *   formData?: ReportFormData,  // required when amountType === "report"
 *   planChoice?: "plan_only" | "plan_treatment", // required for plan payments
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amountType, couponId, reportId, formData } = body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amountType) {
      return NextResponse.json({ error: "Missing required payment fields" }, { status: 400 })
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    if (!keySecret || !keyId) {
      console.error("RAZORPAY credentials not configured")
      return NextResponse.json({ error: "Payment verification failed" }, { status: 500 })
    }

    const hmac = crypto.createHmac("sha256", keySecret)
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`)
    const generatedSignature = hmac.digest("hex")

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ error: "Payment signature verification failed" }, { status: 400 })
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
    const order = await razorpay.orders.fetch(razorpay_order_id)
    const amountPaidRupees = Number(order.amount) / 100

    if (amountType === ("report" as AmountType) && (!reportId || !formData)) {
      return NextResponse.json({ error: "reportId and formData required" }, { status: 400 })
    }
    if (amountType !== ("report" as AmountType) && !reportId) {
      return NextResponse.json({ error: "reportId required" }, { status: 400 })
    }

    const result = await recordReportPayment({
      supabase,
      amountType: amountType as AmountType,
      reportId,
      amountPaidRupees,
      gatewayPaymentId: razorpay_payment_id,
      gatewayOrderId: razorpay_order_id,
      couponId,
      formData: formData as ReportFormData | undefined,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 })
    }

    return NextResponse.json({ success: true, reportId })
  } catch (error) {
    console.error("Error verifying online-report payment:", error)
    return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 })
  }
}
