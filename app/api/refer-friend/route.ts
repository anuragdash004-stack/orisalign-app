import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEAM = "leads@orisalign.com"

/**
 * POST /api/refer-friend
 *
 * A patient passes on someone who might want a consultation. This only tells
 * the team — it deliberately does not message the referred person, since they
 * haven't agreed to hear from us. The team reaches out.
 *
 * Body: { appointmentId: string, friendName: string, friendPhone: string }
 */
export async function POST(req: Request) {
  try {
    const { appointmentId, friendName, friendPhone } = await req.json()
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 })
    }

    const name = (friendName || "").trim()
    const phone = (friendPhone || "").trim()
    if (!name || !phone) {
      return NextResponse.json({ error: "Their name and phone number are both needed" }, { status: 400 })
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

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "OrisAlign <no-reply@orisalign.com>",
        to: [TEAM],
        replyTo: appt.email || undefined,
        subject: `Referral from ${appt.name || "a patient"} — ${name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
            <h2 style="color:#1B2A4A;margin:0 0 6px;">🤝 New Referral</h2>
            <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">Please reach out to them — they have not been contacted yet.</p>
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#6b7280;width:150px;">Referred person</td><td style="padding:6px 0;font-weight:bold;">${name}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Their phone</td><td style="padding:6px 0;font-weight:bold;">${phone}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Referred by</td><td style="padding:6px 0;">${appt.name || "N/A"} (${appt.phone || "no phone"})</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Referrer ID</td><td style="padding:6px 0;font-family:monospace;">${shortId}</td></tr>
            </table>
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
