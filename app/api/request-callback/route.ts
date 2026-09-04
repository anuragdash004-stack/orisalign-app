import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEAM = "leads@orisalign.com"

/**
 * POST /api/request-callback
 *
 * The patient asks to be rung back from the app menu, optionally saying why.
 * Emails the care team with their number and the reason. Trusts appointmentId
 * directly, same as every other patient-facing endpoint here.
 *
 * Body: { appointmentId: string, reason?: string }
 */
export async function POST(req: Request) {
  try {
    const { appointmentId, reason } = await req.json()
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 })
    }

    const { data: appt, error } = await supabase
      .from("appointments_booking")
      .select("id, name, phone, email")
      .eq("id", appointmentId)
      .single()

    if (error || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const shortId = appt.id.substring(0, 8).toUpperCase()
    const why = (reason || "").trim()

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "OrisAlign <no-reply@orisalign.com>",
        to: [TEAM],
        replyTo: appt.email || undefined,
        subject: `Callback requested — ${appt.name || "Patient"} (${shortId})`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
            <h2 style="color:#1B2A4A;margin:0 0 16px;">📞 Callback Requested</h2>
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#6b7280;width:130px;">Patient</td><td style="padding:6px 0;font-weight:bold;">${appt.name || "N/A"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;font-weight:bold;">${appt.phone || "N/A"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;">${appt.email || "N/A"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Patient ID</td><td style="padding:6px 0;font-family:monospace;">${shortId}</td></tr>
            </table>
            <div style="margin-top:16px;padding:14px 16px;background:#f8f6f2;border-radius:10px;border:1px solid #e5e7eb;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Reason given</p>
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;">${why || "— not specified —"}</p>
            </div>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: "Resend error: " + errText }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
