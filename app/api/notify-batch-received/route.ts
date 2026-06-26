import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logAuditEntry, getClientInfo } from "@/lib/auditLog"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/notify-batch-received
 *
 * The patient clicks "I've Received This Batch" on their journey page for a
 * specific aligner batch. This records the receipt on that batch (never
 * trusts any amount/date from the client beyond which batch number), emails
 * the patient a thank-you, and notifies leads@orisalign.com with the
 * collection details.
 *
 * Body: { appointmentId: string, batchNum: number }
 */
export async function POST(req: Request) {
  try {
    const { appointmentId, batchNum } = await req.json()
    if (!appointmentId || !batchNum) {
      return NextResponse.json({ error: "appointmentId and batchNum required" }, { status: 400 })
    }

    const { data: appt, error: fetchErr } = await supabase
      .from("appointments_booking")
      .select("id, name, email, phone, manufacturing_data")
      .eq("id", appointmentId)
      .single()

    if (fetchErr || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const manufacturingData = (appt.manufacturing_data as Record<string, any>) || {}
    const batches: any[] = manufacturingData.batches || []
    const batch = batches.find((b) => b.num === batchNum)
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }
    if (batch.aligner_received) {
      return NextResponse.json({ success: true, alreadyReceived: true, aligner_received: batch.aligner_received })
    }

    const today = new Date().toISOString().slice(0, 10)
    const updatedBatches = batches.map((b) => b.num === batchNum ? { ...b, aligner_received: today } : b)
    const newManufacturingData = { ...manufacturingData, batches: updatedBatches }

    const { error: updateErr } = await supabase
      .from("appointments_booking")
      .update({ manufacturing_data: newManufacturingData })
      .eq("id", appointmentId)

    if (updateErr) {
      return NextResponse.json({ error: "Failed to record receipt: " + updateErr.message }, { status: 500 })
    }

    const { ip, userAgent } = getClientInfo(req)
    const batchLabel = `Batch ${batchNum}${batch.start !== undefined && batch.start !== "" ? ` (Aligners ${batch.start}–${batch.end})` : ""}`

    await logAuditEntry({
      appointmentId,
      actorEmail: appt.email || "patient",
      actorRole: "patient",
      action: `Batch ${batchNum} Marked Received by Patient`,
      entity: "manufacturing_data",
      newData: { batch: batchNum, aligner_received: today },
      ipAddress: ip,
      userAgent,
    })

    // Email the patient — thank-you confirmation.
    if (appt.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "OrisAlign <no-reply@orisalign.com>",
          to: [appt.email],
          subject: `Thank You for Collecting ${batchLabel} — OrisAlign`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#faf7f2;padding:20px;border-radius:12px;">
              <div style="background:linear-gradient(135deg,#1B2A4A,#0f2027);padding:28px 24px;border-radius:8px;text-align:center;margin-bottom:20px;border-bottom:3px solid #C9A84C;">
                <img src="https://orisalign.com/logo.png" alt="OrisAlign" style="height:40px;margin:0 auto 14px;display:block;" />
                <p style="color:#C9A84C;margin:0;font-size:20px;font-weight:900;">🎉 Thank You for Collecting ${batchLabel}</p>
              </div>
              <p style="color:#374151;font-size:15px;margin:0 0 16px;">Dear <strong>${appt.name || "Patient"}</strong>,</p>
              <p style="color:#374151;font-size:14px;line-height:1.8;margin:0 0 16px;">
                Thank you for collecting ${batchLabel}. Please begin wearing your new set as instructed by your
                orthodontist — consistent wear (20–22 hours per day) is the key to staying on track with your
                treatment plan.
              </p>
              <p style="color:#6b7280;font-size:13px;line-height:1.7;text-align:center;">
                For any queries, reach us at <a href="mailto:hello@orisalign.com" style="color:#C9A84C;font-weight:600;">hello@orisalign.com</a>.
              </p>
            </div>
          `,
        }),
      }).catch(() => {})
    }

    // Notify the team of the collection.
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "OrisAlign <no-reply@orisalign.com>",
        to: ["leads@orisalign.com"],
        subject: `${batchLabel} Collected — ${appt.name || "Patient"}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
            <h2 style="color:#1B2A4A;">${batchLabel} Collected</h2>
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Patient</td><td style="padding:6px 0;font-weight:bold;">${appt.name || "N/A"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;font-weight:bold;">${appt.phone || "N/A"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;font-weight:bold;">${appt.email || "N/A"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Batch</td><td style="padding:6px 0;font-weight:bold;">${batchLabel}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Collected On</td><td style="padding:6px 0;font-weight:bold;">${today}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Appointment ID</td><td style="padding:6px 0;font-family:monospace;">${appointmentId}</td></tr>
            </table>
          </div>
        `,
      }),
    }).catch(() => {})

    return NextResponse.json({ success: true, aligner_received: today })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
