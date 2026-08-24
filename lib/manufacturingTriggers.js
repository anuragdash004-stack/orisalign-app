const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.ceil((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));

/**
 * Legacy patients on an installment plan (or a fixed wear schedule once
 * fully paid) don't get their next set auto-created the way new-model
 * monthly payments do — this works out whether one is due, per the admin's
 * own per-patient "sets per installment" setting (journey_steps.
 * manufacturing_sets_per_installment):
 *   - Still has unpaid installments → a new batch is due each time an
 *     installment is actually paid (N sets per payment).
 *   - Fully paid (no installments left, or none were ever set up) → no more
 *     payment events will ever fire, so instead this warns 10 days before
 *     the most recently sent set is due to run out, based on wear days.
 * Returns null if nothing's due, or { from, to, reason } describing what
 * should be sent next.
 */
export function computeNextBatchDue(appt) {
  const setsPerInstallment = Number(appt.journey_steps?.manufacturing_sets_per_installment) || 0;
  if (!setsPerInstallment) return null;

  const batches = appt.manufacturing_data?.batches || [];
  const lastSetSent = batches.reduce((max, b) => Math.max(max, Number(b.end) || Number(b.start) || 0), 0);
  const totalSets = Number(appt.aligner_total_sets) || Infinity;
  if (lastSetSent >= totalSets) return null;

  const installments = appt.payment_data?.pending_plan?.installments || [];
  const stillPaying = installments.length > 0 && installments.some((i) => !i.paid);

  if (stillPaying) {
    const installmentsPaid = installments.filter((i) => i.paid).length;
    const expectedLastSet = Math.min(totalSets, 1 + installmentsPaid * setsPerInstallment);
    if (expectedLastSet > lastSetSent) {
      return { from: lastSetSent + 1, to: expectedLastSet, reason: `Installment ${installmentsPaid} paid — next set(s) due` };
    }
    return null;
  }

  // Fully paid (or no installment plan at all) — calendar-based reminder.
  const lastBatch = batches[batches.length - 1];
  if (!lastBatch?.mfg_started) return null;
  const setsInLastBatch = (Number(lastBatch.end) || Number(lastBatch.start) || 1) - (Number(lastBatch.start) || 1) + 1;
  const daysPerSet = Number(appt.aligner_days_per_set) || 15;
  const finishDate = new Date(lastBatch.mfg_started);
  finishDate.setDate(finishDate.getDate() + setsInLastBatch * daysPerSet);
  const daysUntilFinish = daysBetween(todayISO(), finishDate.toISOString().slice(0, 10));
  if (daysUntilFinish <= 10) {
    const nextTo = Math.min(totalSets, lastSetSent + setsPerInstallment);
    return { from: lastSetSent + 1, to: nextTo, reason: daysUntilFinish <= 0 ? "Current set has run out — send the next one now" : `Current set finishes in ${daysUntilFinish} day${daysUntilFinish !== 1 ? "s" : ""} (${finishDate.toISOString().slice(0, 10)})` };
  }
  return null;
}
