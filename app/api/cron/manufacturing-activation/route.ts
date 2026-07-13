import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendStepNotification } from "@/lib/notifyStep"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Runs every 15 minutes (see vercel.json). Patients approve their treatment
 * plan themselves from the journey page (POST /api/approve-plan), which sets
 * plan_approved/plan_approved_at but deliberately does NOT flip
 * manufacturing_started — that step is meant to activate automatically
 * exactly 12 hours after approval, with its own "Manufacturing Started"
 * notification going out at that moment, not immediately alongside the
 * approval email.
 *
 * This job finds everyone who crossed that 12-hour mark since it last ran,
 * flips journey_steps.manufacturing_started, and sends the notification
 * (respecting any admin-edited Message Templates override, same as every
 * other step notification).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

    const { data: candidates, error } = await supabase
      .from("appointments_booking")
      .select("id, name, email, journey_steps")
      .eq("plan_approved", true)
      .lte("plan_approved_at", cutoff)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let activated = 0
    for (const appt of candidates || []) {
      const js = (appt.journey_steps as Record<string, any>) || {}
      if (js.manufacturing_started) continue // already activated (e.g. manually by admin)

      const activatedAt = new Date().toISOString()
      const updatedJourneySteps = { ...js, manufacturing_started: true, manufacturing_started_at: activatedAt }

      const { error: updateError } = await supabase
        .from("appointments_booking")
        .update({ journey_steps: updatedJourneySteps })
        .eq("id", appt.id)

      if (updateError) continue

      await sendStepNotification({
        appointmentId: appt.id,
        stepKey: "manufacturing_started",
        emailOverride: appt.email || null,
      }).catch(() => {})

      activated++
    }

    return NextResponse.json({ success: true, checked: candidates?.length || 0, activated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    console.error("manufacturing-activation cron error:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
