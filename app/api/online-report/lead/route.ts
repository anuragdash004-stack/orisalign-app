import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/notifications/resend"
import { syncUnpaidAppointmentLead } from "@/lib/onlineReportLeadSync"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ONLINE_REPORT_ADMIN_EMAIL

/**
 * POST /api/online-report/lead
 * Body: { reportId, fullName, phone, sex, age }
 *
 * Fired when the patient finishes Step 1 (name/phone/gender/age) and clicks
 * Continue — captures them as a lead before they've uploaded photos or paid.
 * Upserted (not a plain insert) because the patient can navigate back to
 * Step 1 and click Continue again with the same reportId. Step 4
 * (free-submit / verify-payment) later upserts the same row with the rest
 * of the submission, so this row is reused rather than duplicated.
 */
export async function POST(req: Request) {
  try {
    const { reportId, fullName, phone, sex, age } = await req.json()

    if (!reportId || !fullName || !phone) {
      return NextResponse.json({ error: "reportId, fullName and phone are required" }, { status: 400 })
    }

    const { error: upsertError } = await supabase.from("online_reports").upsert(
      [{
        id: reportId,
        full_name: fullName,
        patient_phone: phone,
        sex: sex ?? null,
        age: age ?? null,
      }],
      { onConflict: "id", ignoreDuplicates: false },
    )

    if (upsertError) {
      console.error("[online-report lead] upsert failed", upsertError)
      return NextResponse.json({ error: "Failed to save your details" }, { status: 500 })
    }

    // Mirrors this lead into the Lead Tracker (Online Smile Report Leads
    // section) — never blocks the patient-facing save if it fails.
    syncUnpaidAppointmentLead(supabase, { reportId, fullName, phone, sex, age }).catch((err) => {
      console.error("[online-report lead] tracker sync failed", err)
    })

    if (ADMIN_EMAIL) {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `New Smile Report Lead: ${fullName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
            <h2 style="color:#1B2A4A;">New Online Smile Report Lead</h2>
            <p>A patient started the Online Smile Report flow but hasn't paid yet.</p>
            <p><strong>Name:</strong> ${fullName}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Gender:</strong> ${sex || "—"}</p>
            <p><strong>Age:</strong> ${age || "—"}</p>
          </div>
        `,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving online-report lead:", error)
    return NextResponse.json({ error: "Failed to save your details" }, { status: 500 })
  }
}
