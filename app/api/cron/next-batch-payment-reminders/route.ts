import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendWhatsApp } from "@/lib/notifications/aisensy"
import { applyCouponDiscount, nextPayableMonth, PLAN_CONFIGS, type MonthlyPlan, type PlanKey } from "@/lib/monthlyPlan"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Single variable: how many days remain until the next batch is due to
// start (negative once overdue, e.g. "-2" = 2 days overdue).
const WHATSAPP_NEXT_BATCH_CAMPAIGN = "orisalign_next_batch"

function dateKeyIST(d: Date | string) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}
function daysBetween(fromKey: string, toKey: string) {
  return Math.round((new Date(toKey + "T00:00:00+05:30").getTime() - new Date(fromKey + "T00:00:00+05:30").getTime()) / 86400000)
}

/**
 * Runs once a day (see vercel.json). For every new-model patient actively in
 * Smile Correction with an unpaid upcoming monthly package, works out how
 * many days remain until that package's first set is due to start —
 * smile_start_date + (monthNum - 1) * setsPerMonth * daysPerSet, mirroring
 * how app/api/cron/set-change-reminders computes each individual set's date.
 *
 * Fires "orisalign_next_batch" starting 10 days out, then every *other* day
 * (10, 8, 6, 4, 2, 0, -2, -4, …) for as long as that same month stays
 * unpaid — dedup'd per calendar day via
 * journey_steps.next_batch_reminder.last_sent so a cron retry never
 * double-sends. Stops the moment the month is paid (nextPayableMonth simply
 * stops returning it) or a later month becomes the one that's next due,
 * which resets the cycle.
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
    const { data: appts, error } = await supabase
      .from("appointments_booking")
      .select("id, name, phone, journey_steps, monthly_plan, amount_paid, payment_data, status")
      .in("status", ["confirmed", "completed"])
      .not("monthly_plan", "is", null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const todayKey = dateKeyIST(new Date())
    let checked = 0
    let sent = 0

    for (const appt of appts || []) {
      const js = (appt.journey_steps as Record<string, any>) || {}
      const monthlyPlan = appt.monthly_plan as MonthlyPlan | null
      const startDate = js.smile_start_date as string | undefined
      if (!monthlyPlan || !startDate || js.journey_ended || !appt.phone) continue

      checked++

      const pd = (appt.payment_data as Record<string, any>) || {}
      const couponsTotal = ((pd.applied_coupons as { discount?: number }[]) || [])
        .reduce((sum, c) => sum + (Number(c.discount) || 0), 0)
      const discounted = applyCouponDiscount(monthlyPlan, couponsTotal)
      const amountPaid = Number(appt.amount_paid) || 0
      const nextMonth = nextPayableMonth(discounted, amountPaid)
      if (!nextMonth) continue // fully paid — nothing upcoming to remind about

      const planCfg = PLAN_CONFIGS[monthlyPlan.plan as PlanKey] || PLAN_CONFIGS.ORISPRO
      const daysPerSet = Number(js.smile_days_per_set) || planCfg.daysPerSet
      const setsPerMonth = planCfg.setsPerMonth

      const batchStart = new Date(startDate + "T00:00:00+05:30")
      batchStart.setDate(batchStart.getDate() + (nextMonth.num - 1) * setsPerMonth * daysPerSet)
      const batchStartKey = dateKeyIST(batchStart)
      const daysLeft = daysBetween(todayKey, batchStartKey)

      // Outside the reminder window (more than 10 days out) — nothing to do.
      if (daysLeft > 10) continue
      // Off-cadence day (only every other day within the window fires).
      if (Math.abs(daysLeft % 2) !== 0) continue

      const reminderState = js.next_batch_reminder || {}
      const isSameCycle = reminderState.month === nextMonth.num
      if (isSameCycle && reminderState.last_sent === todayKey) continue // already sent today

      const waResult = await sendWhatsApp({
        campaignName: WHATSAPP_NEXT_BATCH_CAMPAIGN,
        destination: appt.phone,
        userName: appt.name || "Patient",
        templateParams: [String(daysLeft)],
      })

      const newJourneySteps = {
        ...js,
        next_batch_reminder: { month: nextMonth.num, last_sent: todayKey },
      }
      await supabase.from("appointments_booking").update({ journey_steps: newJourneySteps }).eq("id", appt.id)

      try {
        await supabase.from("message_history").insert({
          appointment_id: appt.id,
          step_key: "aligner_sets",
          message_type: "whatsapp",
          recipient_phone: appt.phone,
          subject: `Next batch reminder — ${daysLeft} day(s)`,
          body: `Automated reminder: package ${nextMonth.num} due to start ${batchStartKey} (${daysLeft} day(s) from today).`,
          is_template: true,
          delivery_status: waResult.success ? "sent" : "failed",
          delivery_provider: "aisensy",
          provider_response: waResult.success ? {} : { error: waResult.error },
          sent_by: "system",
          sent_by_role: "system",
        })
      } catch {
        // best-effort logging only
      }

      if (waResult.success) sent++
    }

    return NextResponse.json({ success: true, checked, sent })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    console.error("next-batch-payment-reminders cron error:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
