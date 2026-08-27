import type { SupabaseClient } from "@supabase/supabase-js"
import { incrementCouponUsage, type AmountType } from "./onlineReportPricing"
import { sendEmail } from "./notifications/resend"
import { sendWhatsApp } from "./notifications/aisensy"
import { notifyImpressionPaid, notifyPlanPaid } from "./notifications/notify"
import { markAppointmentLeadPaid } from "./onlineReportLeadSync"

const ADMIN_EMAIL = process.env.ONLINE_REPORT_ADMIN_EMAIL

export type ReportFormData = {
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
  photoUrls: Record<string, string>
}

export interface RecordReportPaymentParams {
  supabase: SupabaseClient
  amountType: AmountType
  reportId: string
  amountPaidRupees: number
  /** Gateway's payment id — stored in the (gateway-agnostic despite the name) *_razorpay_payment_id columns. */
  gatewayPaymentId: string
  gatewayOrderId?: string | null
  couponId?: string | null
  /** Required when amountType === "report". */
  formData?: ReportFormData
}

export type RecordReportPaymentResult =
  | { success: true; alreadyRecorded?: boolean }
  | { success: false; error: string; status?: number }

/**
 * Single place that actually applies a confirmed Online Smile Report
 * payment — the online_reports row update/upsert, coupon usage increment,
 * lead-tracker sync, and patient/admin notifications. Shared by every path
 * that can confirm a payment (Razorpay's browser-driven verify, Cashfree's
 * browser-driven verify, and Cashfree's server-to-server webhook) so none of
 * them can double-apply the same payment or diverge in what they send.
 *
 * Idempotency is checked here (against the relevant *_payment_id column)
 * rather than in each caller, since the webhook and the browser-driven verify
 * can both fire for the exact same Cashfree payment.
 */
export async function recordReportPayment(params: RecordReportPaymentParams): Promise<RecordReportPaymentResult> {
  const { supabase, amountType, reportId, amountPaidRupees, gatewayPaymentId, gatewayOrderId, couponId, formData } = params

  if (amountType === "report") {
    if (!formData) {
      return { success: false, error: "formData required", status: 400 }
    }
    const fd = formData

    const { data: existing } = await supabase
      .from("online_reports")
      .select("razorpay_payment_id")
      .eq("id", reportId)
      .maybeSingle()
    if (existing?.razorpay_payment_id === gatewayPaymentId) {
      return { success: true, alreadyRecorded: true }
    }

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
      photo_urls: fd.photoUrls || {},
      payment_amount: amountPaidRupees,
      payment_status: "paid",
      razorpay_order_id: gatewayOrderId || null,
      razorpay_payment_id: gatewayPaymentId,
      status: "new_submission",
    }], { onConflict: "id" })

    if (upsertError) {
      console.error("[recordReportPayment] upsert failed", upsertError)
      return { success: false, error: "Payment verified but failed to save submission", status: 500 }
    }

    if (couponId) await incrementCouponUsage(supabase, couponId).catch(() => {})
    await markAppointmentLeadPaid(supabase, reportId).catch((err) => console.error("[recordReportPayment] tracker sync failed", err))

    if (fd.patientPhone) {
      await sendWhatsApp({
        campaignName: "orisalign_payment_received",
        destination: fd.patientPhone,
        userName: fd.fullName,
        templateParams: [`₹${Math.round(amountPaidRupees)}`],
      }).catch(() => {})
      await sendWhatsApp({
        campaignName: "orisalign_osr",
        destination: fd.patientPhone,
        userName: fd.fullName,
        templateParams: [],
      }).catch(() => {})
    }

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

    return { success: true }
  }

  // ── Step 2 / Step 3 payments — reportId must already exist ──
  const { data: report, error: fetchError } = await supabase
    .from("online_reports")
    .select("id, full_name, patient_email, patient_phone, impression_razorpay_payment_id, plan_razorpay_payment_id")
    .eq("id", reportId)
    .single()

  if (fetchError || !report) {
    return { success: false, error: "Report not found", status: 404 }
  }

  const patient = { name: report.full_name, email: report.patient_email, whatsapp: report.patient_phone }

  if (amountType === "impression") {
    if (report.impression_razorpay_payment_id === gatewayPaymentId) {
      return { success: true, alreadyRecorded: true }
    }
    const { error: updateError } = await supabase
      .from("online_reports")
      .update({
        status: "impression_paid",
        impression_amount_paid: amountPaidRupees,
        impression_razorpay_payment_id: gatewayPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId)
    if (updateError) return { success: false, error: "Failed to record payment", status: 500 }

    if (couponId) await incrementCouponUsage(supabase, couponId).catch(() => {})
    await notifyImpressionPaid(patient).catch(() => {})
    if (report.patient_phone) {
      await sendWhatsApp({
        campaignName: "orisalign_payment_received",
        destination: report.patient_phone,
        userName: report.full_name,
        templateParams: [`₹${Math.round(amountPaidRupees)}`],
      }).catch(() => {})
    }
    if (ADMIN_EMAIL) {
      await sendEmail({ to: ADMIN_EMAIL, subject: `Impression payment received — ${report.full_name}`, html: `<p>${report.full_name} paid ₹${amountPaidRupees} for their impression visit.</p>` }).catch(() => {})
    }
  } else if (amountType === "plan_only" || amountType === "plan_treatment") {
    if (report.plan_razorpay_payment_id === gatewayPaymentId) {
      return { success: true, alreadyRecorded: true }
    }
    const newStatus = amountType === "plan_treatment" ? "treatment_started" : "plan_paid"
    const { error: updateError } = await supabase
      .from("online_reports")
      .update({
        status: newStatus,
        plan_choice: amountType,
        plan_amount_paid: amountPaidRupees,
        plan_razorpay_payment_id: gatewayPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId)
    if (updateError) return { success: false, error: "Failed to record payment", status: 500 }

    if (couponId) await incrementCouponUsage(supabase, couponId).catch(() => {})
    await notifyPlanPaid(patient, amountType).catch(() => {})
    if (report.patient_phone) {
      await sendWhatsApp({
        campaignName: "orisalign_payment_received",
        destination: report.patient_phone,
        userName: report.full_name,
        templateParams: [`₹${Math.round(amountPaidRupees)}`],
      }).catch(() => {})
      if (amountType === "plan_only") {
        await sendWhatsApp({
          campaignName: "orisalign_full_plan_payment_done",
          destination: report.patient_phone,
          userName: report.full_name,
          templateParams: [],
        }).catch(() => {})
      }
    }
    if (ADMIN_EMAIL) {
      await sendEmail({ to: ADMIN_EMAIL, subject: `Plan payment received — ${report.full_name}`, html: `<p>${report.full_name} paid ₹${amountPaidRupees} for "${amountType}".</p>` }).catch(() => {})
    }
  } else {
    return { success: false, error: "Unknown amountType", status: 400 }
  }

  return { success: true }
}
