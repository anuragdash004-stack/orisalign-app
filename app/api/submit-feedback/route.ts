import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEAM = "leads@orisalign.com"

/**
 * POST /api/submit-feedback
 *
 * Free-form feedback from the app menu — a 1-5 rating and an optional note.
 * Stored on the appointment (journey_steps.app_feedback, appended so earlier
 * feedback is never overwritten) and emailed to the care team.
 *
 * Body: { appointmentId: string, rating?: number, comment?: string }
 */
export async function POST(req: Request) {
  try {
    const { appointmentId, rating, comment } = await req.json()
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 })
    }

    // Only clamp a rating that was actually given — clamping an absent one
    // would floor it to 1 and record an empty submission as one star.
    const raw = Number(rating)
    const stars = Number.isFinite(raw) && raw >= 1 ? Math.max(1, Math.min(5, Math.round(raw))) : null
    const note = (comment || "").trim()
    if (!stars && !note) {
      return NextResponse.json({ error: "Give a rating or a comment" }, { status: 400 })
    }

    const { data: appt, error } = await supabase
      .from("appointments_booking")
      .select("id, name, phone, email, journey_steps")
      .eq("id", appointmentId)
      .single()

    if (error || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const js = (appt.journey_steps as Record<string, any>) || {}
    const entries = Array.isArray(js.app_feedback) ? js.app_feedback : []
    const newJourneySteps = {
      ...js,
      app_feedback: [...entries, { rating: stars, comment: note, at: new Date().toISOString() }],
    }

    const { error: upErr } = await supabase
      .from("appointments_booking")
      .update({ journey_steps: newJourneySteps })
      .eq("id", appointmentId)

    if (upErr) {
      return NextResponse.json({ error: "Failed to save: " + upErr.message }, { status: 500 })
    }

    const shortId = appt.id.substring(0, 8).toUpperCase()
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "OrisAlign <no-reply@orisalign.com>",
        to: [TEAM],
        replyTo: appt.email || undefined,
        subject: `App feedback${stars ? ` — ${stars}/5` : ""} — ${appt.name || "Patient"} (${shortId})`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
            <h2 style="color:#1B2A4A;margin:0 0 16px;">💬 Patient Feedback${stars ? ` — ${"★".repeat(stars)}${"☆".repeat(5 - stars)}` : ""}</h2>
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#6b7280;width:130px;">Patient</td><td style="padding:6px 0;font-weight:bold;">${appt.name || "N/A"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;">${appt.phone || "N/A"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Patient ID</td><td style="padding:6px 0;font-family:monospace;">${shortId}</td></tr>
            </table>
            ${note ? `
              <div style="margin-top:16px;padding:14px 16px;background:#f8f6f2;border-radius:10px;border:1px solid #e5e7eb;">
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;">${note}</p>
              </div>` : ""}
          </div>
        `,
      }),
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
