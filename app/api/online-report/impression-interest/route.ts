import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/notifications/resend"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ONLINE_REPORT_ADMIN_EMAIL

/**
 * POST /api/online-report/impression-interest
 *
 * Lead-capture only — no payment. Sets status='impression_interested' and
 * alerts the team to follow up manually.
 */
export async function POST(req: Request) {
  try {
    const { reportId } = await req.json()
    if (!reportId) return NextResponse.json({ error: "reportId required" }, { status: 400 })

    const { data: report, error: fetchError } = await supabase
      .from("online_reports")
      .select("id, full_name, patient_phone, patient_email, status")
      .eq("id", reportId)
      .single()

    if (fetchError || !report) return NextResponse.json({ error: "Report not found" }, { status: 404 })

    const { error: updateError } = await supabase
      .from("online_reports")
      .update({ status: "impression_interested", updated_at: new Date().toISOString() })
      .eq("id", reportId)

    if (updateError) return NextResponse.json({ error: "Failed to update" }, { status: 500 })

    if (ADMIN_EMAIL) {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `Patient ${report.full_name} is interested in booking their impression appointment`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
            <h2 style="color:#1B2A4A;">Impression Interest</h2>
            <p><strong>Patient:</strong> ${report.full_name}</p>
            <p><strong>Phone:</strong> ${report.patient_phone || "—"}</p>
            <p><strong>Email:</strong> ${report.patient_email || "—"}</p>
            <p>Please contact them to schedule the impression visit.</p>
          </div>
        `,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in impression-interest:", error)
    return NextResponse.json({ error: "Failed to save interest" }, { status: 500 })
  }
}
