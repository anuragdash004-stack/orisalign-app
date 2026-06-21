import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Runs once a day (see vercel.json). Sends a one-time "please fill your
 * details" reminder to patients who confirmed their scan (verified lead) but
 * — 24+ hours later — still have NOT had their details filled, by themselves
 * or a counselor. Once sent, details_reminder_sent is flipped so we never
 * remind the same lead twice.
 */
export async function GET(req: Request) {
  // If a CRON_SECRET is configured, require it (Vercel sends it as a Bearer token).
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: leads, error } = await supabase
      .from("appointments_booking")
      .select("id, name, email")
      .eq("status", "lead")
      .eq("lead_verified", true)
      .eq("booking_confirmed", false)
      .eq("details_reminder_sent", false)
      .is("age", null) // details not filled (by patient or counselor)
      .lt("lead_verified_at", cutoff)
      .not("email", "is", null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let sent = 0
    for (const lead of leads || []) {
      const journeyUrl = `https://orisalign.com/patient/${lead.id}`
      const ok = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "OrisAlign <no-reply@orisalign.com>",
          to: [lead.email],
          subject: "Just one more step — complete your OrisAlign booking",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#faf7f2;padding:20px;border-radius:12px;">
              <div style="background:linear-gradient(135deg,#1B2A4A,#0f2027);padding:24px;border-radius:8px;text-align:center;margin-bottom:20px;border-bottom:3px solid #C9A84C;">
                <img src="https://orisalign.com/logo.png" alt="OrisAlign" style="height:38px;margin:0 auto 10px;display:block;" />
                <h1 style="color:#C9A84C;margin:0;font-size:20px;font-weight:900;">One Step Left</h1>
              </div>
              <p style="color:#374151;font-size:15px;">Dear ${lead.name || "there"},</p>
              <p style="color:#374151;font-size:14px;line-height:1.7;">
                Your scan is confirmed! To complete your booking and receive your Patient ID, please head to your
                journey page and fill in your details (age, address and preferred appointment).
              </p>
              <div style="text-align:center;margin:22px 0;">
                <a href="${journeyUrl}" style="display:inline-block;background:#1B2A4A;color:#C9A84C;font-weight:700;font-size:14px;padding:13px 30px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
                  Fill My Details →
                </a>
              </div>
              <p style="color:#6b7280;font-size:13px;line-height:1.7;">It only takes a minute. For any help, reach us at
                <a href="mailto:hello@orisalign.com" style="color:#C9A84C;">hello@orisalign.com</a>.</p>
              <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">OrisAlign · Bhubaneswar – 751016, Odisha</p>
            </div>
          `,
        }),
      })
        .then((r) => r.ok)
        .catch(() => false)

      if (ok) {
        await supabase
          .from("appointments_booking")
          .update({ details_reminder_sent: true })
          .eq("id", lead.id)
        sent++
      }
    }

    return NextResponse.json({ success: true, eligible: leads?.length || 0, sent })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    console.error("lead-reminders cron error:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
