import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logAuditEntry, getClientInfo } from "@/lib/auditLog"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { patientId } = await req.json()
    if (!patientId) {
      return NextResponse.json({ error: "Missing patientId" }, { status: 400 })
    }

    const { ip, userAgent } = getClientInfo(req)
    const approvalTimestamp = new Date().toISOString()

    const { data: existing, error: fetchError } = await supabase
      .from("appointments_booking")
      .select("journey_steps, plan_approved, name, email")
      .eq("id", patientId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const updatedJourneySteps = {
      ...(existing.journey_steps || {}),
      plan_approved: true,
      plan_approved_at: approvalTimestamp,
    }

    const { error } = await supabase
      .from("appointments_booking")
      .update({
        plan_approved: true,
        plan_approved_at: approvalTimestamp,
        plan_approval_ip: ip,
        journey_steps: updatedJourneySteps,
      })
      .eq("id", patientId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notify clinic
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "OrisAlign <no-reply@orisalign.com>",
        to: "anurag@orisalign.com",
        subject: `Plan Approved — ${existing.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
            <h2 style="color:#1B2A4A;">Treatment Plan Approved</h2>
            <p><strong>${existing.name}</strong> has approved their treatment plan.</p>
            <table style="border-collapse:collapse;width:100%;font-size:14px;">
              <tr><td style="padding:6px 0;color:#6b7280;">Patient</td><td><strong>${existing.name}</strong></td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td>${existing.email || "—"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Approved at</td><td>${new Date(approvalTimestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Patient ID</td><td style="font-size:12px;color:#9ca3af;">${patientId}</td></tr>
            </table>
          </div>
        `,
      }),
    }).catch(() => {})

    // 📋 LOG TO AUDIT TRAIL
    await logAuditEntry({
      appointmentId: patientId,
      actorEmail: existing.email || existing.name || "patient",
      actorRole: "patient",
      action: "Plan Approved by Patient",
      entity: "plan_approved",
      newData: {
        plan_approved: true,
        plan_approved_at: approvalTimestamp,
        plan_approval_ip: ip,
        journey_steps: updatedJourneySteps,
      },
      oldData: {
        plan_approved: existing.plan_approved || false,
        journey_steps: existing.journey_steps,
      },
      ipAddress: ip,
      userAgent,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
