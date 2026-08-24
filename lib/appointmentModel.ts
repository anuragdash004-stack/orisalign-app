// Every appointment created from this moment on defaults to the new model
// if nothing else says otherwise — this is when that default flipped.
// Anything older stays legacy-default, so a dormant old lead that never
// progressed far enough to set any legacy-specific field doesn't silently
// flip to the new model's UI underneath it.
const NEW_MODEL_DEFAULT_CUTOVER = "2026-08-23T00:00:00Z";

/**
 * Whether an appointment should use the new per-arch, month-by-month
 * planning & billing model, or the legacy lump-sum model.
 *
 * Three ways in, checked in order:
 *   1. Explicit new-model signal (monthly_plan generated, or a provisional
 *      estimate already given) — always wins, regardless of anything else.
 *   2. Explicit LEGACY-specific signal (something only the old flow ever
 *      sets — an EMI schedule, a legacy plan/pay choice, the old Planning
 *      Done step, etc.) — keeps patients already mid-flow under the old
 *      system on it, undisturbed.
 *   3. Neither — no progress under either model yet. Falls back to the
 *      creation-date cutover: new leads default to the new model, old
 *      untouched ones stay legacy.
 */
export function isNewModelAppointment(appt: Record<string, any> | null | undefined): boolean {
  if (!appt) return false;

  const hasNewModelSignal =
    !!appt.monthly_plan || appt.provisional_min_months != null || appt.provisional_max_months != null;
  if (hasNewModelSignal) return true;

  const js = appt.journey_steps || {};
  const hasLegacySignal = !!(
    appt.payment_data?.pay_choice ||
    appt.payment_data?.pending_plan ||
    appt.provisional_plan_submitted ||
    appt.aligner_total_sets ||
    js.payment_done === true ||
    js.planning_done === true
  );
  if (hasLegacySignal) return false;

  if (appt.created_at) return appt.created_at >= NEW_MODEL_DEFAULT_CUTOVER;
  return true;
}
