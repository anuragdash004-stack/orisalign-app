import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/notify-set-followup
 *
 * Called from the Lead Tracker's Patients follow-up view when staff mark a
 * patient as "Did Not Receive" the call about their aligner set change. Sends
 * a follow-up email (and returns a pre-filled WhatsApp link for the admin to
 * send with one click, since we don't have an automated WhatsApp Business
 * API integration) nudging the patient to switch sets and upload their photo
 * if they haven't already.
 *
 * Body: { appointmentId: string, previousSetNum: number, dueSetNum: number, totalSets: number }
 */
export async function POST(req: Request) {
  try {
    const { appointmentId, previousSetNum, dueSetNum, totalSets } = await req.json()
    if (!appointmentId || !dueSetNum) {
      return NextResponse.json({ error: "appointmentId and dueSetNum required" }, { status: 400 })
    }

    const { data: appt, error } = await supabase
      .from("appointments_booking")
      .select("id, name, email, phone")
      .eq("id", appointmentId)
      .single()

    if (error || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const message = `Hi ${appt.name || "there"}, greetings from OrisAlign! Hope you're doing well. Today was the day to switch from Set ${previousSetNum} to Set ${dueSetNum}${totalSets ? ` of ${totalSets}` : ""}. We tried reaching you but couldn't connect. We hope you've already changed your set and uploaded your progress photos — if not, please do so at the earliest. Feel free to call us back anytime for assistance — we're here for you 24/7.`

    let emailSent = false
    if (appt.email) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "OrisAlign <no-reply@orisalign.com>",
          to: [appt.email],
          subject: `We tried calling you, ${appt.name || "Patient"} — OrisAlign`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#faf7f2;padding:20px;border-radius:12px;">
              <div style="background:linear-gradient(135deg,#1B2A4A,#0f2027);padding:24px;border-radius:8px;text-align:center;margin-bottom:20px;border-bottom:3px solid #C9A84C;">
                <img src="https://orisalign.com/logo.png" alt="OrisAlign" style="height:38px;margin:0 auto 10px;display:block;" />
                <h1 style="color:#C9A84C;margin:0;font-size:20px;font-weight:900;">We Missed You!</h1>
              </div>
              <p style="color:#374151;font-size:14px;line-height:1.8;">${message}</p>
              <div style="text-align:center;margin:22px 0;">
                <a href="https://orisalign.com/patient/${appt.id}/smile" style="display:inline-block;background:#1B2A4A;color:#C9A84C;font-weight:700;font-size:14px;padding:13px 30px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
                  View My Smile Journey →
                </a>
              </div>
              <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">OrisAlign · Bhubaneswar – 751016, Odisha</p>
            </div>
          `,
        }),
      })
      emailSent = res.ok

      if (emailSent) {
        await supabase.from("message_history").insert({
          appointment_id: appt.id,
          step_key: "smile_correction",
          message_type: "email",
          recipient_email: appt.email,
          subject: `We tried calling you, ${appt.name || "Patient"} — OrisAlign`,
          body: message,
          is_template: false,
          delivery_status: "sent",
          delivery_provider: "resend",
          sent_by: "admin",
          sent_by_role: "admin",
        }).then(() => {}, () => {})
      }
    }

    const waLink = appt.phone
      ? `https://wa.me/91${appt.phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(message)}`
      : null

    return NextResponse.json({ success: true, emailSent, waLink, message })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
