import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/notifications/resend"
import { sendWhatsApp } from "@/lib/notifications/aisensy"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/online-report/request-info
 * Body: { reportId, question }
 *
 * Admin-only — reviewer asks the patient a free-form question before they
 * can finish the report. Overwrites any previous question/answer (a fresh
 * ask always clears the old answer).
 */
export async function POST(req: Request) {
  try {
    const { reportId, question } = await req.json()
    if (!reportId || !question || !String(question).trim()) {
      return NextResponse.json({ error: "reportId and question are required" }, { status: 400 })
    }

    const { data: report, error: fetchError } = await supabase
      .from("online_reports")
      .select("full_name, patient_phone, patient_email")
      .eq("id", reportId)
      .single()

    if (fetchError || !report) return NextResponse.json({ error: "Report not found" }, { status: 404 })

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from("online_reports")
      .update({
        reviewer_question: question,
        reviewer_question_at: now,
        patient_answer: null,
        patient_answer_at: null,
        updated_at: now,
      })
      .eq("id", reportId)

    if (updateError) return NextResponse.json({ error: "Failed to save question" }, { status: 500 })

    if (report.patient_phone) {
      // Plain-text approved template — the question itself is only in-app
      // and in the email below, not a WhatsApp variable.
      sendWhatsApp({
        campaignName: "osr_more_info",
        destination: report.patient_phone,
        userName: report.full_name,
        templateParams: [],
      }).catch(() => {})
    }

    if (report.patient_email) {
      sendEmail({
        to: report.patient_email,
        subject: "We need a bit more information — OrisAlign",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
            <h2 style="color:#1B2A4A;">A quick question from your Smile Expert</h2>
            <p>Dear ${report.full_name},</p>
            <p>Before we finish your Online Smile Report, we need a bit more information:</p>
            <div style="background:#f8f6f2;border-radius:10px;padding:16px;margin:16px 0;font-style:italic;">${question}</div>
            <p>Please visit your report page to answer.</p>
          </div>
        `,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error requesting info:", error)
    return NextResponse.json({ error: "Failed to save question" }, { status: 500 })
  }
}
