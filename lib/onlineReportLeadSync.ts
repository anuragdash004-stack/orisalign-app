import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Mirrors each Online Smile Report submission into a linked
 * appointments_booking row (via online_report_id), so it shows up in the
 * Lead Tracker's new "Online Smile Report Leads" section — driven by the
 * same stage_log/bucket mechanism as every other lead there (see
 * app/(dashboard)/leads/page.js).
 *
 * Buckets used, on top of the tracker's existing fresh/callback/booked/
 * denied: "osr_unpaid" (Step 1 completed, not yet paid) and "osr_paid"
 * (payment received). A "booked" entry (dated today — a placeholder, since
 * an OSR payer hasn't booked any real appointment date/time) is also
 * logged on payment, so they additionally appear in the existing Booked
 * section per explicit product decision.
 */

// Date-only key in IST — matches dateKeyIST() in app/api/save-booking-lead and dateKey() in the Lead Tracker.
function dateKeyIST(d: Date | string = new Date()) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

type StageLogEntry = {
  bucket: string
  stage: string
  date: string
  time: string | null
  confirmed: boolean
  loggedAt: string
}

/**
 * Called from /api/online-report/lead every time Step 1's Continue is
 * clicked. Creates the linked appointments_booking row on first call, or
 * updates name/phone/sex/age on later calls (e.g. a resumed draft with
 * edited info) — matching how Step 1 itself always saves the freshly typed
 * values. Only appends a fresh "osr_unpaid" stage_log entry if this lead
 * hasn't already been marked paid, so re-visiting Step 1 after paying
 * doesn't regress its Booked/Paid standing.
 */
export async function syncUnpaidAppointmentLead(
  supabase: SupabaseClient,
  params: { reportId: string; fullName: string; phone: string; sex?: string | null; age?: number | null },
): Promise<void> {
  const { reportId, fullName, phone, sex, age } = params

  const { data: existing } = await supabase
    .from("appointments_booking")
    .select("id, stage_log")
    .eq("online_report_id", reportId)
    .maybeSingle()

  const nowIso = new Date().toISOString()
  const todayKey = dateKeyIST(nowIso)

  if (!existing) {
    const stageLog: StageLogEntry[] = [
      { bucket: "osr_unpaid", stage: "osr_unpaid", date: todayKey, time: null, confirmed: false, loggedAt: nowIso },
    ]
    await supabase.from("appointments_booking").insert([{
      name: fullName,
      phone,
      sex: sex || null,
      age: age ?? null,
      status: "lead",
      lead_source: "online_report",
      lead_verified: true,
      online_report_id: reportId,
      stage_log: stageLog,
    }])
    // No "thanks for your interest" WhatsApp fired from here — the caller
    // (app/api/online-report/lead/route.ts) already sends its own dedicated
    // orisalign_osr_new welcome message for this exact event. Firing the
    // generic orisalign_new_lead_thankyou here too would double-message
    // every Online Smile Report lead.
    return
  }

  const log: StageLogEntry[] = existing.stage_log || []
  const alreadyPaid = log.some((e) => e.bucket === "osr_paid")

  const updates: Record<string, unknown> = { name: fullName, phone, sex: sex || null, age: age ?? null }
  if (!alreadyPaid) {
    updates.stage_log = [...log, { bucket: "osr_unpaid", stage: "osr_unpaid", date: todayKey, time: null, confirmed: false, loggedAt: nowIso }]
  }
  await supabase.from("appointments_booking").update(updates).eq("id", existing.id)
}

/**
 * Called once an Online Smile Report payment (or 100%-off coupon) succeeds.
 * Logs "osr_paid" (marking every prior "osr_unpaid" entry as historical —
 * the Lead Tracker's own coloring logic freezes past entries automatically)
 * and a placeholder "booked" entry dated today, per the decision that
 * paying alone — without booking any real appointment — still surfaces the
 * lead in the existing Booked section immediately.
 */
export async function markAppointmentLeadPaid(supabase: SupabaseClient, reportId: string): Promise<void> {
  const { data: existing } = await supabase
    .from("appointments_booking")
    .select("id, stage_log")
    .eq("online_report_id", reportId)
    .maybeSingle()

  if (!existing) return // Shouldn't happen — Step 1 always creates this row first — but never block a payment on it.

  const nowIso = new Date().toISOString()
  const todayKey = dateKeyIST(nowIso)
  const log: StageLogEntry[] = existing.stage_log || []

  const newLog = [
    ...log,
    { bucket: "osr_paid", stage: "osr_paid", date: todayKey, time: null, confirmed: true, loggedAt: nowIso },
    { bucket: "booked", stage: "booked", date: todayKey, time: null, confirmed: true, loggedAt: nowIso },
  ]

  await supabase.from("appointments_booking").update({ stage_log: newLog }).eq("id", existing.id)
}
