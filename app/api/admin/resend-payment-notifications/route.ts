import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendWhatsApp } from "@/lib/notifications/aisensy"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/admin/resend-payment-notifications
 *
 * One-off admin utility: manually (re)send the "payment received" and/or
 * "sent to manufacturing" WhatsApp templates for a legacy (lump-sum/
 * installment) appointment — for cases like a payment that was confirmed
 * late (Cashfree webhook/redirect missed) after the automatic send may have
 * already silently failed or never fired, or a batch that was created
 * outside the normal admin-UI flow.
 *
 * Body: { appointmentId: string, amountPaid?: number, batchNum?: number }
 * Same no-separate-auth trust model as /api/update-payment-status and the
 * other internal admin routes in this app — not exposed in any UI.
 */
export async function POST(req: Request) {
  try {
    const { appointmentId, amountPaid, batchNum } = await req.json()
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 })
    }
    if (amountPaid == null && batchNum == null) {
      return NextResponse.json({ error: "at least one of amountPaid or batchNum required" }, { status: 400 })
    }

    const { data: appt, error } = await supabase
      .from("appointments_booking")
      .select("id, name, phone")
      .eq("id", appointmentId)
      .single()

    if (error || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }
    if (!appt.phone) {
      return NextResponse.json({ error: "No phone on record" }, { status: 400 })
    }

    const results: Record<string, unknown> = {}

    if (amountPaid != null) {
      const r = await sendWhatsApp({
        campaignName: "orisalign_payment_received",
        destination: appt.phone,
        userName: appt.name || "Patient",
        templateParams: [`₹${amountPaid}`],
      })
      results.payment_received = r
      await supabase.from("message_history").insert({
        appointment_id: appointmentId,
        step_key: "aligner_sets",
        message_type: "whatsapp",
        recipient_phone: appt.phone,
        subject: "Payment Received",
        body: `Manual resend: payment of ₹${amountPaid} received.`,
        is_template: true,
        delivery_status: r.success ? "sent" : "failed",
        delivery_provider: "aisensy",
        provider_response: r.success ? {} : { error: r.error },
        sent_by: "admin",
        sent_by_role: "admin",
      }).then(() => {}, () => {})
    }

    if (batchNum != null) {
      const r = await sendWhatsApp({
        campaignName: "orisalign_production",
        destination: appt.phone,
        userName: appt.name || "Patient",
        templateParams: [String(batchNum)],
      })
      results.production = r
      await supabase.from("message_history").insert({
        appointment_id: appointmentId,
        step_key: "aligner_sets",
        message_type: "whatsapp",
        recipient_phone: appt.phone,
        subject: "Sent to Manufacturing",
        body: `Manual resend: package/batch ${batchNum} sent to manufacturing.`,
        is_template: true,
        delivery_status: r.success ? "sent" : "failed",
        delivery_provider: "aisensy",
        provider_response: r.success ? {} : { error: r.error },
        sent_by: "admin",
        sent_by_role: "admin",
      }).then(() => {}, () => {})
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    console.error("[resend-payment-notifications]", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
