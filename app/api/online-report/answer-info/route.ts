import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/notifications/resend"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ONLINE_REPORT_ADMIN_EMAIL

/**
 * POST /api/online-report/answer-info
 * Body: { reportId, answer }
 *
 * Patient-facing — only allowed while there's an open, unanswered question.
 */
export async function POST(req: Request) {
  try {
    const { reportId, answer } = await req.json()
    if (!reportId || !answer || !String(answer).trim()) {
      return NextResponse.json({ error: "reportId and answer are required" }, { status: 400 })
    }

    const { data: report, error: fetchError } = await supabase
      .from("online_reports")
      .select("full_name, reviewer_question, patient_answer")
      .eq("id", reportId)
      .maybeSingle()

    if (fetchError || !report) return NextResponse.json({ error: "Report not found" }, { status: 404 })
    if (!report.reviewer_question || report.patient_answer) {
      return NextResponse.json({ error: "No open question to answer" }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from("online_reports")
      .update({ patient_answer: answer, patient_answer_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", reportId)

    if (updateError) return NextResponse.json({ error: "Failed to save answer" }, { status: 500 })

    if (ADMIN_EMAIL) {
      sendEmail({
        to: ADMIN_EMAIL,
        subject: `Patient answered — ${report.full_name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
            <h2 style="color:#1B2A4A;">Patient Response</h2>
            <p><strong>Patient:</strong> ${report.full_name}</p>
            <p><strong>Question:</strong> ${report.reviewer_question}</p>
            <p><strong>Answer:</strong> ${answer}</p>
            <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/online-reports/${reportId}">View in Admin Panel</a></p>
          </div>
        `,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving answer:", error)
    return NextResponse.json({ error: "Failed to save answer" }, { status: 500 })
  }
}
