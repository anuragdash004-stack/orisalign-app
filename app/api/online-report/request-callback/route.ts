import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/notifications/resend"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ONLINE_REPORT_ADMIN_EMAIL

/**
 * POST /api/online-report/request-callback
 * Body: { reportId }
 *
 * One of the "next step" options once the report is ready — lead-capture
 * only, no payment, no scheduling. Patient sees an inline "we'll reach out
 * soon" message immediately, independent of this call.
 */
export async function POST(req: Request) {
  try {
    const { reportId } = await req.json()
    if (!reportId) return NextResponse.json({ error: "reportId required" }, { status: 400 })

    const { data: report, error: fetchError } = await supabase
      .from("online_reports")
      .select("full_name, patient_phone")
      .eq("id", reportId)
      .single()

    if (fetchError || !report) return NextResponse.json({ error: "Report not found" }, { status: 404 })

    const { error: updateError } = await supabase
      .from("online_reports")
      .update({ callback_requested_at: new Date().toISOString() })
      .eq("id", reportId)

    if (updateError) return NextResponse.json({ error: "Failed to save request" }, { status: 500 })

    if (ADMIN_EMAIL) {
      sendEmail({
        to: ADMIN_EMAIL,
        subject: `Callback requested — ${report.full_name}`,
        html: `<p><strong>${report.full_name}</strong> (${report.patient_phone || "—"}) requested a callback about their Online Smile Report.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/online-reports/${reportId}">View in Admin Panel</a></p>`,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error requesting callback:", error)
    return NextResponse.json({ error: "Failed to save request" }, { status: 500 })
  }
}
