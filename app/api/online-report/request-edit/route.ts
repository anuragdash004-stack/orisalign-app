import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/notifications/resend"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ONLINE_REPORT_ADMIN_EMAIL

/**
 * POST /api/online-report/request-edit
 * Body: { reportId }
 *
 * Patient clicked "Edit" on their submitted info — no self-service editing,
 * just flags the request and alerts the team. The patient sees an inline
 * "you'll be contacted soon" message immediately, independent of this call.
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
      .update({ edit_requested_at: new Date().toISOString() })
      .eq("id", reportId)

    if (updateError) return NextResponse.json({ error: "Failed to save request" }, { status: 500 })

    if (ADMIN_EMAIL) {
      sendEmail({
        to: ADMIN_EMAIL,
        subject: `Patient wants to edit their info — ${report.full_name}`,
        html: `<p><strong>${report.full_name}</strong> (${report.patient_phone || "—"}) wants to edit some information on their Online Smile Report. Please contact them.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/online-reports/${reportId}">View in Admin Panel</a></p>`,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error requesting edit:", error)
    return NextResponse.json({ error: "Failed to save request" }, { status: 500 })
  }
}
