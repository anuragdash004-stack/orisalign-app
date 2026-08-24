import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendWhatsApp } from "@/lib/notifications/aisensy"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Approved AiSensy campaign — single variable, {{1}} = the set number the
// patient should start wearing today.
const WHATSAPP_SET_CHANGE_CAMPAIGN = "orisalign_set_change"

// Date-only key in IST, regardless of the server's own timezone.
function dateKeyIST(d: Date | string) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

/**
 * Runs once a day at 8 AM IST (see vercel.json). For every patient in active
 * smile correction (aligners_delivered → journey not yet ended), checks
 * whether *today* is the day they're due to move to their next aligner set —
 * computed the same way app/(dashboard)/patient/[id]/smile/page.js derives
 * each set's start date (smile_start_date + (setNum-1) * daysPerSet).
 *
 * If so, emails the patient telling them which set they've been wearing and
 * which set to switch to today, and logs it to message_history. Each set
 * change only ever fires once — tracked in journey_steps.smile_reminders_sent.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const { data: appts, error } = await supabase
      .from("appointments_booking")
      .select("id, name, email, phone, journey_steps, aligner_days_per_set, status")
      .in("status", ["confirmed", "completed"])
      .not("journey_steps", "is", null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const todayKey = dateKeyIST(new Date())
    let checked = 0
    let sent = 0

    for (const appt of appts || []) {
      const js = (appt.journey_steps as Record<string, any>) || {}
      const setsCount = Number(js.smile_sets_count) || 0
      const startDate = js.smile_start_date as string | undefined
      if (!setsCount || !startDate || js.journey_ended || (!appt.email && !appt.phone)) continue

      const daysPerSet = Number(js.smile_days_per_set) || Number(appt.aligner_days_per_set) || 15
      const remindersSent = js.smile_reminders_sent || {}
      checked++

      // Set 1 starts on smile_start_date itself — nothing to "change" into yet.
      // Sets 2..N are the actual switch-over days.
      for (let setNum = 2; setNum <= setsCount; setNum++) {
        if (remindersSent[setNum]) continue

        const setDate = new Date(startDate + "T00:00:00+05:30")
        setDate.setDate(setDate.getDate() + (setNum - 1) * daysPerSet)
        if (dateKeyIST(setDate) !== todayKey) continue

        const previousSet = setNum - 1
        const subject = `Time to change to Set ${setNum} today — OrisAlign`
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#faf7f2;padding:20px;border-radius:12px;">
            <div style="background:linear-gradient(135deg,#1B2A4A,#0f2027);padding:24px;border-radius:8px;text-align:center;margin-bottom:20px;border-bottom:3px solid #C9A84C;">
              <img src="https://orisalign.com/logo.png" alt="OrisAlign" style="height:38px;margin:0 auto 10px;display:block;" />
              <h1 style="color:#C9A84C;margin:0;font-size:20px;font-weight:900;">Time for Your Next Set!</h1>
            </div>
            <p style="color:#374151;font-size:15px;">Dear ${appt.name || "there"},</p>
            <p style="color:#374151;font-size:14px;line-height:1.7;">
              You've been wearing <strong>Set ${previousSet}</strong>. Today is the day to switch to
              <strong>Set ${setNum} of ${setsCount}</strong>.
            </p>
            <div style="background:white;border-radius:12px;padding:18px;margin:20px 0;text-align:center;border:2px solid #C9A84C;">
              <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Switch To</p>
              <p style="margin:0;font-size:30px;font-weight:900;color:#1B2A4A;">Set ${setNum}</p>
            </div>
            <p style="color:#6b7280;font-size:13px;line-height:1.7;">
              Remember to wear each set 20–22 hours a day for the best results. If you haven't received
              this set yet, please reach out to us right away.
            </p>
            <div style="text-align:center;margin:22px 0;">
              <a href="https://orisalign.com/patient/${appt.id}/smile" style="display:inline-block;background:#1B2A4A;color:#C9A84C;font-weight:700;font-size:14px;padding:13px 30px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
                View My Smile Journey →
              </a>
            </div>
            <p style="color:#6b7280;font-size:13px;line-height:1.7;">For any help, reach us at
              <a href="mailto:hello@orisalign.com" style="color:#C9A84C;">hello@orisalign.com</a>.</p>
            <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">OrisAlign · Bhubaneswar – 751016, Odisha</p>
          </div>
        `

        const emailOk = appt.email
          ? await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
              body: JSON.stringify({ from: "OrisAlign <no-reply@orisalign.com>", to: [appt.email], subject, html }),
            })
              .then((r) => r.ok)
              .catch(() => false)
          : false

        const waResult = appt.phone
          ? await sendWhatsApp({
              campaignName: WHATSAPP_SET_CHANGE_CAMPAIGN,
              destination: appt.phone,
              userName: appt.name || "Patient",
              templateParams: [String(setNum)],
            })
          : { success: false as const, error: "no phone on record" }

        if (emailOk || waResult.success) {
          const updatedJourneySteps = {
            ...js,
            smile_reminders_sent: { ...remindersSent, [setNum]: new Date().toISOString() },
          }
          await supabase
            .from("appointments_booking")
            .update({ journey_steps: updatedJourneySteps })
            .eq("id", appt.id)

          const reminderBody = `Automated reminder: switch from Set ${previousSet} to Set ${setNum} of ${setsCount}.`

          try {
            if (emailOk) {
              await supabase.from("message_history").insert({
                appointment_id: appt.id,
                step_key: "smile_correction",
                message_type: "email",
                recipient_email: appt.email,
                subject,
                body: reminderBody,
                is_template: true,
                delivery_status: "sent",
                delivery_provider: "resend",
                sent_by: "system",
                sent_by_role: "system",
              })
            }
            if (appt.phone) {
              await supabase.from("message_history").insert({
                appointment_id: appt.id,
                step_key: "smile_correction",
                message_type: "whatsapp",
                recipient_phone: appt.phone,
                subject,
                body: reminderBody,
                is_template: true,
                delivery_status: waResult.success ? "sent" : "failed",
                delivery_provider: "aisensy",
                provider_response: waResult.success ? {} : { error: waResult.error },
                sent_by: "system",
                sent_by_role: "system",
              })
            }
          } catch {
            // best-effort logging only — the messages themselves already sent
          }

          sent++
        }

        // Only one set can possibly be due per patient per day.
        break
      }
    }

    return NextResponse.json({ success: true, checked, sent })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    console.error("set-change-reminders cron error:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
