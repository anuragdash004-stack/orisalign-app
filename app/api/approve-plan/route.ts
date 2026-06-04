import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null

    const { data: existing, error: fetchError } = await supabase
      .from("appointments_booking")
      .select("journey_steps")
      .eq("id", patientId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const updatedJourneySteps = {
      ...(existing.journey_steps || {}),
      plan_approved: true,
    }

    const { error } = await supabase
      .from("appointments_booking")
      .update({
        plan_approved: true,
        plan_approved_at: new Date().toISOString(),
        plan_approval_ip: ip,
        journey_steps: updatedJourneySteps,
      })
      .eq("id", patientId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log — patient self-approved, actor is the patient (no role)
    await supabase.from("audit_log").insert({
      appointment_id: patientId,
      actor_email: "patient",
      actor_role: "patient",
      action: "Plan Approved by Patient",
      entity: "plan_approved",
      new_data: { plan_approved: true, plan_approved_at: new Date().toISOString(), plan_approval_ip: ip },
      old_data: null,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
