import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { notifyReportReady } from "@/lib/notifications/notify"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/online-report/notify-report-ready
 * Body: { reportId }
 *
 * Called by the admin "Submit Report" action, after the row's status has
 * already been set to 'report_ready' and reviewer fields saved.
 */
export async function POST(req: Request) {
  try {
    const { reportId } = await req.json()
    if (!reportId) return NextResponse.json({ error: "reportId required" }, { status: 400 })

    const { data: report, error } = await supabase
      .from("online_reports")
      .select("id, full_name, patient_phone, patient_email")
      .eq("id", reportId)
      .single()

    if (error || !report) return NextResponse.json({ error: "Report not found" }, { status: 404 })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""
    const reportUrl = `${siteUrl}/report/${reportId}`
    const patient = { name: report.full_name, email: report.patient_email, whatsapp: report.patient_phone }

    const result = await notifyReportReady(patient, reportUrl)

    return NextResponse.json({ success: true, notify: result })
  } catch (error) {
    console.error("Error notifying report ready:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
