import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendWhatsApp } from "@/lib/notifications/aisensy"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Date-only key in IST, regardless of the server's own timezone — matches
// dateKey() in the Lead Tracker (app/(dashboard)/leads/page.js), which is
// always evaluated from the staff browser's local (IST) clock.
function dateKeyIST(d: Date | string) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

const CLINIC_INFO: Record<string, { name: string; address: string; mapsLink: string }> = {
  Nayapalli: {
    name: "Nayapalli Clinic",
    address: "April Dental, 242, Indradhanu Market Rd, N4, Block N4, IRC Village, Nayapalli, Bhubaneswar, Odisha 751015",
    mapsLink: "https://maps.app.goo.gl/gtLWbuPZ7BLUMmReA",
  },
  Patia: {
    name: "Patia Clinic",
    address: "Kalp Dental Clinic, Kiss Road, Chandaka Industrial Estate, Patia, Bhubaneswar, Odisha",
    mapsLink: "https://share.google/DPy1ODGR0lb1UZFAT",
  },
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { type, name, phone, email, age, sex, address, problem, date, time, consultationType, clinicLocation, patientId } = body
    const clinicInfo = consultationType === "clinic" ? CLINIC_INFO[clinicLocation] : null

    // The homepage "Request a Callback" widget only sends name+phone — it
    // never creates a database row, which is why those leads never showed
    // up in the Lead Tracker. Create it here, then send a short
    // notification — never the full booking template below.
    if (type === "callback") {
      const nowIso = new Date().toISOString()
      const { error: insertError } = await supabase
        .from("appointments_booking")
        .insert([{
          name, phone, status: "lead", lead_stage: "fresh", lead_source: "website",
          problem: "Requested a callback from the homepage",
          // Without this the Lead Tracker's Fresh Leads section (driven
          // entirely by stage_log, not lead_stage) never shows this lead.
          stage_log: [{ bucket: "fresh", stage: "fresh", date: dateKeyIST(nowIso), time: null, confirmed: false, loggedAt: nowIso }],
        }])

      if (insertError) {
        console.error("[notify-booking] callback insert failed", insertError)
      }

      // WhatsApp "thanks for your interest" — awaited (not fire-and-forget):
      // on Vercel an unawaited promise can be killed the instant the
      // response is sent. Best-effort — never blocks the callback request.
      if (phone) {
        try {
          await sendWhatsApp({
            campaignName: "orisalign_new_lead_thankyou",
            destination: phone,
            userName: name,
            templateParams: [],
          })
        } catch {
          // best-effort only
        }
      }

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "OrisAlign Bookings <no-reply@orisalign.com>",
          to: ["leads@orisalign.com"],
          subject: `📞 New Callback Request: ${name}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#faf7f2;padding:20px;border-radius:12px;">
              <div style="background:#1B2A4A;padding:20px;border-radius:8px;text-align:center;margin-bottom:16px;">
                <h1 style="color:#C9A84C;margin:0;font-size:20px;">📞 New Callback Request</h1>
              </div>
              <table style="width:100%;font-size:14px;border-collapse:collapse;background:white;border-radius:8px;padding:16px;">
                <tr><td style="padding:6px 0;color:#6b7280;width:80px;">Name</td><td style="padding:6px 0;font-weight:bold;">${name}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;"><a href="tel:${phone}" style="color:#1B2A4A;font-weight:bold;text-decoration:none;">${phone}</a></td></tr>
              </table>
              <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">Added to the Lead Tracker as a Fresh lead.</p>
            </div>
          `,
        }),
      }).catch(() => {})

      return NextResponse.json({ success: true })
    }

    const shortId = patientId ? patientId.substring(0, 8).toUpperCase() : "N/A"
    // Use dynamic host to support both local and production domains
    const baseUrl = `https://${req.headers.get("host") || "orisalign.com"}`
    const patientUrl = `${baseUrl}/patient/${patientId}`

    const typeLabel: Record<string, string> = {
      home: "🏠 Home Consultation",
      clinic: "🏥 Clinic Consultation",
      online: "💻 Online Consultation",
    }

    // Notify clinic
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "OrisAlign Bookings <no-reply@orisalign.com>",
        to: ["leads@orisalign.com"],
        subject: `🦷 New Booking: ${name} — ${date} at ${time}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#faf7f2;padding:20px;border-radius:12px;">
            <div style="background:#1B2A4A;padding:24px;border-radius:8px;text-align:center;margin-bottom:20px;">
              <h1 style="color:#C9A84C;margin:0;font-size:22px;">🦷 New Appointment Booked</h1>
              <p style="color:#94a3b8;margin:6px 0 0;font-size:14px;">OrisAlign — Instant Booking Alert</p>
            </div>

            <div style="background:white;border-radius:8px;padding:20px;margin-bottom:16px;border-left:4px solid #C9A84C;">
              <h2 style="color:#1B2A4A;margin:0 0 12px;font-size:16px;">📅 Appointment Details</h2>
              <table style="width:100%;font-size:14px;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Date</td><td style="padding:6px 0;font-weight:bold;color:#111;">${date}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;font-weight:bold;color:#111;">${time}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Type</td><td style="padding:6px 0;font-weight:bold;color:#C9A84C;">${typeLabel[consultationType] || consultationType || "Not specified"}</td></tr>
                ${clinicInfo ? `<tr><td style="padding:6px 0;color:#6b7280;">Clinic</td><td style="padding:6px 0;font-weight:bold;color:#111;">${clinicInfo.name}</td></tr>` : ""}
              </table>
            </div>

            <div style="background:white;border-radius:8px;padding:20px;margin-bottom:16px;">
              <h2 style="color:#1B2A4A;margin:0 0 12px;font-size:16px;">👤 Patient Details</h2>
              <table style="width:100%;font-size:14px;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Patient ID</td><td style="padding:6px 0;font-weight:bold;color:#111;font-family:monospace;letter-spacing:2px;">${shortId}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Name</td><td style="padding:6px 0;font-weight:bold;color:#111;">${name}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;"><a href="tel:${phone}" style="color:#1B2A4A;font-weight:bold;text-decoration:none;">${phone}</a></td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;color:#111;">${email || "N/A"}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Age / Gender</td><td style="padding:6px 0;color:#111;">${age || "N/A"} / ${sex || "N/A"}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Address</td><td style="padding:6px 0;color:#111;">${address || "N/A"}</td></tr>
              </table>
            </div>

            <div style="background:#EAF7F5;border-radius:8px;padding:20px;margin-bottom:20px;border:1px solid #A9DCD5;">
              <h2 style="color:#1B2A4A;margin:0 0 8px;font-size:16px;">🦷 Chief Complaint</h2>
              <p style="margin:0;color:#111;font-size:14px;">${problem || "Not specified"}</p>
            </div>

            <div style="text-align:center;">
              <a href="${patientUrl}" style="display:inline-block;background:#C9A84C;color:#1B2A4A;font-weight:bold;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;">
                Open Patient Dashboard →
              </a>
            </div>

            <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">
              OrisAlign · Bhubaneswar – 751016, Odisha
            </p>
          </div>
        `,
      }),
    })

    // No patient-facing email/WhatsApp here — booking is a lead action, not
    // a confirmed appointment yet. The patient only hears from us once staff
    // actually confirms the appointment (app/(dashboard)/appointment/page.js,
    // stepKey "confirmed"), which sends its own email + WhatsApp
    // (orisalign_appointment_confirmed). This route stays for the internal
    // staff alert above only.

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Notification error:", err)
    return NextResponse.json({ success: false })
  }
}
