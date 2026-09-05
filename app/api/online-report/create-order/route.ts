import { NextResponse } from "next/server"
import Razorpay from "razorpay"
import { createClient } from "@supabase/supabase-js"
import { validateAndApplyCoupon, BASE_PRICES_RUPEES, type AmountType } from "@/lib/onlineReportPricing"

// NOTE: this currently uses the LIVE Razorpay key already configured in this
// project (NEXT_PUBLIC_RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) per explicit
// instruction — real charges occur. Swap to a rzp_test_ key pair if you want
// to test without real money.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Which status the online_reports row must already be in before this
// payment type is allowed — stops a patient from paying for a later step
// out of order via a direct API call.
const REQUIRED_STATUS: Partial<Record<AmountType, string[]>> = {
  impression: ["report_ready", "impression_interested", "ready_to_pay_impression"],
  plan_only: ["impression_taken"],
  plan_treatment: ["impression_taken"],
}

export async function POST(req: Request) {
  try {
    const { amountType, reportId, couponCode } = await req.json()

    if (!amountType || !(amountType in BASE_PRICES_RUPEES)) {
      return NextResponse.json({ error: "Invalid amountType" }, { status: 400 })
    }

    if (amountType !== "report") {
      if (!reportId) {
        return NextResponse.json({ error: "reportId required" }, { status: 400 })
      }
      const { data: report, error: reportError } = await supabase
        .from("online_reports")
        .select("id, status")
        .eq("id", reportId)
        .single()

      if (reportError || !report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 })
      }
      const allowed = REQUIRED_STATUS[amountType as AmountType]
      if (allowed && !allowed.includes(report.status)) {
        return NextResponse.json({ error: `This payment isn't available yet (status: ${report.status})` }, { status: 400 })
      }
    }

    let amountRupees = BASE_PRICES_RUPEES[amountType as AmountType]
    let couponId: string | null = null

    if (couponCode) {
      const result = await validateAndApplyCoupon(supabase, couponCode, amountType as AmountType)
      if (!result.valid) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      amountRupees = result.discountedAmountRupees
      couponId = result.coupon.id
    }

    if (amountRupees <= 0) {
      // 100%-off coupon — caller should use /free-submit instead for step 1,
      // or the equivalent free-confirm path for later steps.
      return NextResponse.json({ free: true, couponId })
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) {
      console.error("Missing Razorpay credentials")
      return NextResponse.json({ error: "Payment service not configured" }, { status: 500 })
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
    const order = await razorpay.orders.create({
      amount: Math.round(amountRupees * 100),
      currency: "INR",
      receipt: `osr_${amountType}_${reportId || "new"}_${Date.now()}`,
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      couponId,
    })
  } catch (error) {
    console.error("Error creating online-report order:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
