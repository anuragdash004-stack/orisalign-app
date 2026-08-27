import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAndApplyCoupon, BASE_PRICES_RUPEES, type AmountType } from "@/lib/onlineReportPricing"

/**
 * POST /api/online-report/cashfree/order
 *
 * Cashfree order-creation for the Online Smile Report flow — the default
 * gateway for this flow now, mirroring app/api/cashfree/order for the main
 * clinic checkout. Body: { amountType, reportId, couponCode? }.
 *
 * amount_type and coupon_id ride along as Cashfree order_tags so the
 * server-to-server webhook (app/api/online-report/cashfree/webhook) can
 * apply the right business logic without needing anything from the
 * patient's browser — see that route's comment for why this only works for
 * impression/plan payments, not the initial "report" submission.
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

const REQUIRED_STATUS: Partial<Record<AmountType, string[]>> = {
  impression: ["report_ready", "impression_interested", "ready_to_pay_impression"],
  plan_only: ["impression_taken"],
  plan_treatment: ["impression_taken"],
}

export async function POST(req: Request) {
  try {
    if (!CF_APP_ID || !CF_SECRET) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 })
    }

    const { amountType, reportId, couponCode, patientName, patientPhone } = await req.json()

    if (!amountType || !(amountType in BASE_PRICES_RUPEES)) {
      return NextResponse.json({ error: "Invalid amountType" }, { status: 400 })
    }
    if (!reportId) {
      return NextResponse.json({ error: "reportId required" }, { status: 400 })
    }

    if (amountType !== "report") {
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
      return NextResponse.json({ free: true, couponId })
    }

    const orderId = `OR-${String(reportId).substring(0, 8)}-${Date.now()}`
    const origin = req.headers.get("origin") || `https://${req.headers.get("host") || "orisalign.com"}`
    const returnUrl = `${origin}/report/${reportId}?cf_returned=1&order_id={order_id}`
    const phone = (patientPhone || "").toString().replace(/\D/g, "").slice(-10) || "9999999999"

    const cfRes = await fetch(CF_BASE, {
      method: "POST",
      headers: {
        "x-client-id": CF_APP_ID,
        "x-client-secret": CF_SECRET,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amountRupees,
        order_currency: "INR",
        customer_details: {
          customer_id: String(reportId),
          customer_name: patientName || "OrisAlign Patient",
          customer_email: `patient+${String(reportId).substring(0, 8)}@orisalign.com`,
          customer_phone: phone,
        },
        order_meta: { return_url: returnUrl },
        order_note: `OrisAlign Online Smile Report ${amountType} payment`,
        order_tags: { amount_type: amountType, coupon_id: couponId || "" },
      }),
    })

    const cfData = await cfRes.json()
    if (!cfRes.ok || !cfData.payment_session_id) {
      console.error("[online-report/cashfree/order] Cashfree error", cfData)
      return NextResponse.json({ error: cfData.message || "Couldn't start payment" }, { status: 502 })
    }

    return NextResponse.json({
      paymentSessionId: cfData.payment_session_id,
      orderId,
      mode: CF_ENV === "production" ? "production" : "sandbox",
      couponId,
    })
  } catch (error) {
    console.error("Error creating online-report Cashfree order:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
