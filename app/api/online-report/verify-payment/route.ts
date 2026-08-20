import { NextResponse } from "next/server"
import crypto from "crypto"
import Razorpay from "razorpay"
import { createClient } from "@supabase/supabase-js"
import { incrementCouponUsage, type AmountType } from "@/lib/onlineReportPricing"
import { sendEmail } from "@/lib/notifications/resend"
import { notifyImpressionPaid, notifyPlanPaid } from "@/lib/notifications/notify"

// NOTE: this currently uses the LIVE Razorpay key already configured in this
// project — see app/api/online-report/create-order/route.ts for details.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ONLINE_REPORT_ADMIN_EMAIL

type ReportFormData = {
  fullName: string
  age?: number | null
  sex?: string | null
  patientPhone?: string | null
  patientEmail?: string | null
  conditions: Record<string, unknown>
  chiefComplaint?: string | null
  knownCavities?: string | null
  foodLodgement?: string | null
  toothMobility?: string | null
  pain?: string | null
  otherConcerns?: string | null
  photoUrls: string[]
}

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

    if (amountType === ("report" as AmountType)) {
      if (!reportId || !formData) {
        return NextResponse.json({ error: "reportId and formData required" }, { status: 400 })
      }
      const fd = formData as ReportFormData

      // Upsert, not insert — Step 1 (see app/api/online-report/lead) already
      // created this row as a lead the moment the patient filled in their
      // name/phone/gender/age, so this fills in the rest of that same row.
      const { error: upsertError } = await supabase.from("online_reports").upsert([{
        id: reportId,
        full_name: fd.fullName,
        age: fd.age ?? null,
        sex: fd.sex ?? null,
        patient_phone: fd.patientPhone ?? null,
        patient_email: fd.patientEmail ?? null,
        chief_complaint: fd.chiefComplaint ?? null,
        conditions: fd.conditions || {},
        known_cavities: fd.knownCavities ?? null,
        food_lodgement: fd.foodLodgement ?? null,
        tooth_mobility: fd.toothMobility ?? null,
        pain: fd.pain ?? null,
        other_concerns: fd.otherConcerns ?? null,
        photo_urls: fd.photoUrls || [],
        payment_amount: amountPaidRupees,
        payment_status: "paid",
        razorpay_order_id,
        razorpay_payment_id,
        status: "new_submission",
      }], { onConflict: "id" })

      if (upsertError) {
        console.error("[online-report verify-payment] upsert failed", upsertError)
        return NextResponse.json({ error: "Payment verified but failed to save submission" }, { status: 500 })
      }

      if (couponId) await incrementCouponUsage(supabase, couponId).catch(() => {})

      if (ADMIN_EMAIL) {
        await sendEmail({
          to: ADMIN_EMAIL,
          subject: `New Online Report submission from ${fd.fullName}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
              <h2 style="color:#1B2A4A;">New Online Smile Report Submission</h2>
              <p><strong>Patient:</strong> ${fd.fullName}</p>
              <p><strong>Phone:</strong> ${fd.patientPhone || "—"}</p>
              <p><strong>Amount Paid:</strong> ₹${amountPaidRupees}</p>
              <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/online-reports/${reportId}">View in Admin Panel</a></p>
            </div>
          `,
        }).catch(() => {})
      }

      return NextResponse.json({ success: true, reportId })
    }

    // ── Step 2 / Step 3 payments — reportId must already exist ──
    if (!reportId) {
      return NextResponse.json({ error: "reportId required" }, { status: 400 })
    }

    const { data: report, error: fetchError } = await supabase
      .from("online_reports")
      .select("id, full_name, patient_email, patient_phone")
      .eq("id", reportId)
      .single()

    if (fetchError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const patient = { name: report.full_name, email: report.patient_email, whatsapp: report.patient_phone }

    if (amountType === "impression") {
      const { error: updateError } = await supabase
        .from("online_reports")
        .update({
          status: "impression_paid",
          impression_amount_paid: amountPaidRupees,
          impression_razorpay_payment_id: razorpay_payment_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId)
      if (updateError) return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })

      if (couponId) await incrementCouponUsage(supabase, couponId).catch(() => {})
      notifyImpressionPaid(patient).catch(() => {})
      if (ADMIN_EMAIL) {
        sendEmail({ to: ADMIN_EMAIL, subject: `Impression payment received — ${report.full_name}`, html: `<p>${report.full_name} paid ₹${amountPaidRupees} for their impression visit.</p>` }).catch(() => {})
      }
    } else if (amountType === "plan_only" || amountType === "plan_treatment") {
      const newStatus = amountType === "plan_treatment" ? "treatment_started" : "plan_paid"
      const { error: updateError } = await supabase
        .from("online_reports")
        .update({
          status: newStatus,
          plan_choice: amountType,
          plan_amount_paid: amountPaidRupees,
          plan_razorpay_payment_id: razorpay_payment_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId)
      if (updateError) return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })

      if (couponId) await incrementCouponUsage(supabase, couponId).catch(() => {})
      notifyPlanPaid(patient, amountType).catch(() => {})
      if (ADMIN_EMAIL) {
        sendEmail({ to: ADMIN_EMAIL, subject: `Plan payment received — ${report.full_name}`, html: `<p>${report.full_name} paid ₹${amountPaidRupees} for "${amountType}".</p>` }).catch(() => {})
      }
    } else {
      return NextResponse.json({ error: "Unknown amountType" }, { status: 400 })
    }

    return NextResponse.json({ success: true, reportId })
  } catch (error) {
    console.error("Error verifying online-report payment:", error)
    return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 })
  }
}
