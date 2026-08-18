import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ZOOM_TIME_SLOTS } from "@/lib/zoomSlots"
import { sendEmail } from "@/lib/notifications/resend"
import { notifyZoomCallConfirmed } from "@/lib/notifications/notify"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ONLINE_REPORT_ADMIN_EMAIL

/**
 * POST /api/online-report/zoom-book
 * Body: { reportId, date, time }
 *
 * Optional step — does not gate Step 2 of the main flow either way.
 */
export async function POST(req: Request) {
  try {
    const { reportId, date, time } = await req.json()

    if (!reportId || !date || !time || !ZOOM_TIME_SLOTS.includes(time)) {
      return NextResponse.json({ error: "reportId, date and a valid time are required" }, { status: 400 })
    }

    const { data: report, error: reportError } = await supabase
      .from("online_reports")
      .select("id, full_name, patient_phone, patient_email")
      .eq("id", reportId)
      .single()

    if (reportError || !report) return NextResponse.json({ error: "Report not found" }, { status: 404 })

    const { error: insertError } = await supabase
      .from("zoom_call_bookings")
      .insert([{ online_report_id: reportId, date, time, status: "booked" }])

    if (insertError) {
      // unique(date, time) violation → slot was taken between page load and click
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "That slot was just booked by someone else — please pick another." }, { status: 409 })
      }
      return NextResponse.json({ error: "Failed to book slot" }, { status: 500 })
    }

    const patient = { name: report.full_name, email: report.patient_email, whatsapp: report.patient_phone }
    notifyZoomCallConfirmed(patient, date, time).catch(() => {})

    if (ADMIN_EMAIL) {
      sendEmail({
        to: ADMIN_EMAIL,
        subject: `Video call booked — ${report.full_name}`,
        html: `<p>${report.full_name} booked a Smile Expert video call for ${date} at ${time}.</p>`,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error booking zoom call:", error)
    return NextResponse.json({ error: "Failed to book slot" }, { status: 500 })
  }
}
