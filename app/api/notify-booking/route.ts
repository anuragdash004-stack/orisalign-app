import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendWhatsApp } from "@/lib/notifications/aisensy"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Body: "Hi {{1}}, your OrisAlign appointment is booked for {{2}} at {{3}}.
// Your Patient ID is {{4}} — save it to track your treatment journey."
const WHATSAPP_BOOKING_CAMPAIGN = "orisalign_booking_confirmation"

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

            <div style="background:#fffbeb;border-radius:8px;padding:20px;margin-bottom:20px;border:1px solid #fde68a;">
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

    // Confirmation email to patient
    if (email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "OrisAlign <no-reply@orisalign.com>",
          to: [email],
          subject: `✅ Booking Confirmed — OrisAlign | ${date} at ${time}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#faf7f2;padding:20px;border-radius:12px;">
              <div style="background:linear-gradient(135deg,#1B2A4A,#0f2027);padding:28px 24px;border-radius:8px;text-align:center;margin-bottom:20px;border-bottom:3px solid #C9A84C;">
                <img src="https://orisalign.com/logo.png" alt="OrisAlign" style="height:40px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;" />
                <h1 style="color:#C9A84C;margin:0 0 6px;font-size:22px;font-weight:900;">Booking Confirmed!</h1>
                <p style="color:#94a3b8;margin:0;font-size:14px;">Your Smile Journey Begins with OrisAlign</p>
              </div>
              <p style="color:#374151;font-size:15px;">Dear <strong>${name}</strong>,</p>
              <p style="color:#374151;font-size:14px;line-height:1.7;">Thank you for booking with OrisAlign. Your appointment has been confirmed. Please save your Patient ID below — you will need it to track your treatment journey.</p>
              <p style="color:#374151;font-size:14px;line-height:1.7;">Please visit your journey page to fill in your other details before your appointment.</p>
              <div style="background:white;border-radius:12px;padding:20px;margin:20px 0;text-align:center;border:2px solid #C9A84C;">
                <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;font-weight:700;letter-spacing:1px;text-transform:uppercase;">YOUR PATIENT ID</p>
                <p style="margin:0;font-size:28px;font-weight:900;color:#1B2A4A;letter-spacing:4px;">${shortId}</p>
              </div>
              <div style="text-align:center;margin:0 0 16px;">
                <a href="${patientUrl}" style="display:inline-block;background:#1B2A4A;color:#C9A84C;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
                  Track Your Progress →
                </a>
              </div>
              <div style="background:white;border-radius:8px;padding:16px;margin-bottom:16px;">
                <table style="width:100%;font-size:14px;border-collapse:collapse;">
                  <tr><td style="padding:6px 0;color:#6b7280;width:130px;">Date</td><td style="padding:6px 0;font-weight:bold;color:#111;">${date}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;font-weight:bold;color:#111;">${time}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Booked on</td><td style="padding:6px 0;color:#111;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>
                </table>
              </div>
              ${clinicInfo ? `
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:16px;">
                <p style="margin:0 0 4px;font-size:11px;color:#92400e;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Your Appointment Is At</p>
                <p style="margin:0 0 6px;font-size:16px;font-weight:900;color:#1B2A4A;">${clinicInfo.name}</p>
                <p style="margin:0 0 12px;font-size:13px;color:#374151;line-height:1.6;">${clinicInfo.address}</p>
                <a href="${clinicInfo.mapsLink}" style="display:inline-block;background:#1B2A4A;color:#C9A84C;font-weight:700;font-size:13px;padding:9px 18px;border-radius:6px;text-decoration:none;">
                  📍 Get Directions →
                </a>
              </div>
              ` : ""}
              <p style="color:#6b7280;font-size:13px;line-height:1.7;">Our team will contact you shortly to confirm. For queries, reach us at <a href="mailto:hello@orisalign.com" style="color:#C9A84C;">hello@orisalign.com</a>.</p>
              <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">OrisAlign · Bhubaneswar – 751016, Odisha</p>
            </div>
          `,
        }),
      })
    }

    // WhatsApp confirmation to patient — best-effort, never blocks the response.
    if (phone) {
      sendWhatsApp({
        campaignName: WHATSAPP_BOOKING_CAMPAIGN,
        destination: phone,
        userName: name,
        templateParams: [name, date, time, shortId],
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Notification error:", err)
    return NextResponse.json({ success: false })
  }
}
