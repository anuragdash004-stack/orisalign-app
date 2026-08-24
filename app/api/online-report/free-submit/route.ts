import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAndApplyCoupon, incrementCouponUsage } from "@/lib/onlineReportPricing"
import { sendEmail } from "@/lib/notifications/resend"
import { markAppointmentLeadPaid } from "@/lib/onlineReportLeadSync"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ONLINE_REPORT_ADMIN_EMAIL

/**
 * POST /api/online-report/free-submit
 *
 * Step 1 only, 100%-off coupon path — skips Razorpay entirely. Re-validates
 * server-side that the coupon really brings the ₹399 price to ₹0; a coupon
 * that only partially discounts must go through create-order/verify-payment
 * instead.
 */
export async function POST(req: Request) {
  try {
    const { reportId, couponCode, formData } = await req.json()

    if (!reportId || !couponCode || !formData) {
      return NextResponse.json({ error: "reportId, couponCode and formData required" }, { status: 400 })
    }

    const result = await validateAndApplyCoupon(supabase, couponCode, "report")
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    if (result.discountedAmountRupees !== 0) {
      return NextResponse.json({ error: "This coupon doesn't fully cover the price — use the payment flow instead" }, { status: 400 })
    }

    // Upsert, not insert — Step 1 (see app/api/online-report/lead) already
    // created this row as a lead, so this fills in the rest of that row.
    const { error: upsertError } = await supabase.from("online_reports").upsert([{
      id: reportId,
      full_name: formData.fullName,
      age: formData.age ?? null,
      sex: formData.sex ?? null,
      patient_phone: formData.patientPhone ?? null,
      patient_email: formData.patientEmail ?? null,
      chief_complaint: formData.chiefComplaint ?? null,
      conditions: formData.conditions || {},
      known_cavities: formData.knownCavities ?? null,
      food_lodgement: formData.foodLodgement ?? null,
      tooth_mobility: formData.toothMobility ?? null,
      pain: formData.pain ?? null,
      other_concerns: formData.otherConcerns ?? null,
      photo_urls: formData.photoUrls || {},
      coupon_code: couponCode.trim().toUpperCase(),
      payment_amount: 0,
      payment_status: "free_coupon",
      status: "new_submission",
    }], { onConflict: "id" })

    if (upsertError) {
      console.error("[online-report free-submit] upsert failed", upsertError)
      return NextResponse.json({ error: "Failed to save submission" }, { status: 500 })
    }

    await incrementCouponUsage(supabase, result.coupon.id).catch(() => {})
    // Awaited (not fire-and-forget): on Vercel an unawaited promise can be
    // killed the instant the response is sent, before it ever runs.
    await markAppointmentLeadPaid(supabase, reportId).catch((err) => console.error("[online-report free-submit] tracker sync failed", err))

    if (ADMIN_EMAIL) {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `New Online Report submission from ${formData.fullName} (free — coupon ${couponCode})`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
            <h2 style="color:#1B2A4A;">New Online Smile Report Submission</h2>
            <p><strong>Patient:</strong> ${formData.fullName}</p>
            <p><strong>Phone:</strong> ${formData.patientPhone || "—"}</p>
            <p><strong>Amount Paid:</strong> ₹0 (coupon ${couponCode})</p>
            <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/online-reports/${reportId}">View in Admin Panel</a></p>
          </div>
        `,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, reportId })
  } catch (error) {
    console.error("Error in online-report free-submit:", error)
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500 })
  }
}
