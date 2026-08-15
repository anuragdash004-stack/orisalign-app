/**
 * Per-arch, month-by-month planning & billing model.
 *
 * Two plans, chosen by the patient during Provisional Planning, each with
 * its own pace and price:
 *   - OrisPro:      15 days/set · 2 sets/month · ₹4,999/month
 *   - OrisPro Plus: 10 days/set · 3 sets/month · ₹6,999/month
 * A month is priced strictly per aligner actually due that month, not per
 * arch-presence — e.g. under OrisPro a month with only 3 (of 4 possible)
 * aligners due (an arch running out mid-month) costs 3 × ₹1,249.75 =
 * ₹3,749.25, not the full ₹4,999.
 */

export const FINAL_PLAN_FEE = 999;
export const MONTH_RATE = 4999; // OrisPro — kept for the rough pre-Final-Plan-Review estimate
export const HALF_MONTH_RATE = 2499.5;
export const ALIGNER_RATE = MONTH_RATE / 4; // 1249.75

export type PlanKey = "ORISPRO" | "ORISPLUS";

export interface PlanConfig {
  key: PlanKey;
  label: string;
  daysPerSet: number;
  setsPerMonth: number;
  monthRate: number;
}

export const PLAN_CONFIGS: Record<PlanKey, PlanConfig> = {
  ORISPRO: { key: "ORISPRO", label: "OrisPro", daysPerSet: 15, setsPerMonth: 2, monthRate: 4999 },
  ORISPLUS: { key: "ORISPLUS", label: "OrisPro Plus", daysPerSet: 10, setsPerMonth: 3, monthRate: 6999 },
};

export interface MonthEntry {
  num: number;
  upper: number[];
  lower: number[];
  amount: number;
  cumulative: number;
}

export interface MonthlyPlan {
  plan: PlanKey;
  upperSets: number;
  lowerSets: number;
  totalMonths: number;
  months: MonthEntry[];
  generatedAt: string;
}

export interface DiscountedMonthEntry extends MonthEntry {
  payableAmount: number;
  discountedCumulative: number;
}

export interface DiscountedMonthlyPlan extends Omit<MonthlyPlan, "months"> {
  months: DiscountedMonthEntry[];
  totalDiscount: number;
}

/** Simple ₹/month estimate range shown during Provisional Planning. */
export function estimateRange(minMonths: number, maxMonths: number) {
  const min = Math.min(minMonths, maxMonths) || 0;
  const max = Math.max(minMonths, maxMonths) || 0;
  return { min: min * MONTH_RATE, max: max * MONTH_RATE };
}

/**
 * Builds the immutable base schedule once the orthodontist enters the final
 * upper/lower set counts, priced according to the patient's chosen plan.
 * `setsPerMonth` aligner "slots" per month per arch — a slot is filled while
 * that arch still has sets remaining, left empty once it runs out (the
 * uneven-arch trailing months). Each month's amount is the count of
 * aligners actually due that month × the plan's per-aligner rate
 * (monthRate / (setsPerMonth × 2 arches)) — e.g. OrisPro: 4999/4 = 1249.75.
 */
export function buildMonthlyPlan(upperSets: number, lowerSets: number, plan: PlanKey = "ORISPRO"): MonthlyPlan {
  const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS.ORISPRO;
  const alignerRate = config.monthRate / (config.setsPerMonth * 2);
  const totalMonths = Math.ceil(Math.max(upperSets, lowerSets, 0) / config.setsPerMonth);
  const months: MonthEntry[] = [];
  let upperCursor = 0;
  let lowerCursor = 0;
  let cumulative = FINAL_PLAN_FEE;

  for (let m = 1; m <= totalMonths; m++) {
    const upper: number[] = [];
    const lower: number[] = [];
    for (let i = 0; i < config.setsPerMonth; i++) {
      if (upperCursor < upperSets) {
        upperCursor++;
        upper.push(upperCursor);
      }
      if (lowerCursor < lowerSets) {
        lowerCursor++;
        lower.push(lowerCursor);
      }
    }
    const amount = Math.round((upper.length + lower.length) * alignerRate * 100) / 100;
    cumulative += amount;
    months.push({ num: m, upper, lower, amount, cumulative });
  }

  return { plan: config.key, upperSets, lowerSets, totalMonths, months, generatedAt: new Date().toISOString() };
}

/**
 * Applies a coupon discount from the LAST month backward — since payment is
 * always sequential, unpaid months are always the trailing ones, so
 * "discount the last month first, roll backward if it isn't enough" and
 * "discount whatever's still unpaid, cheapest first" are the same
 * operation. Already-paid months are untouched (they're never the tail).
 * Recomputed on every read, not persisted.
 */
export function applyCouponDiscount(plan: MonthlyPlan, couponsTotal: number): DiscountedMonthlyPlan {
  let remaining = Math.max(0, couponsTotal) || 0;
  const reversed = [...plan.months].reverse().map((month) => {
    const reduceBy = Math.min(month.amount, remaining);
    remaining -= reduceBy;
    return { ...month, payableAmount: Math.round((month.amount - reduceBy) * 100) / 100 };
  });
  const months = reversed.reverse();

  let discountedCumulative = FINAL_PLAN_FEE;
  for (const month of months) {
    discountedCumulative += month.payableAmount;
    (month as DiscountedMonthEntry).discountedCumulative = discountedCumulative;
  }

  return {
    plan: plan.plan,
    upperSets: plan.upperSets,
    lowerSets: plan.lowerSets,
    totalMonths: plan.totalMonths,
    generatedAt: plan.generatedAt,
    months: months as DiscountedMonthEntry[],
    totalDiscount: Math.max(0, couponsTotal) || 0,
  };
}

/** First month not yet covered by amountPaid (against the discounted schedule). */
export function nextPayableMonth(discountedPlan: DiscountedMonthlyPlan, amountPaid: number): DiscountedMonthEntry | null {
  return discountedPlan.months.find((m) => amountPaid < m.discountedCumulative) || null;
}

/**
 * Recomputes `cumulative` for every month after an admin edits one month's
 * `amount` (a price override) — every downstream calculation (next-payable
 * detection, coupon discount, paid-status checks) reads `cumulative` fresh,
 * so this is the only step needed for an override to propagate correctly.
 */
export function recomputeCumulative(months: MonthEntry[]): MonthEntry[] {
  let running = FINAL_PLAN_FEE;
  return months.map((m) => {
    running += m.amount;
    return { ...m, cumulative: running };
  });
}

/** Total treatment cost (₹999 fee + all months), after any coupon discount. */
export function totalCost(discountedPlan: DiscountedMonthlyPlan): number {
  const last = discountedPlan.months[discountedPlan.months.length - 1];
  return last ? last.discountedCumulative : FINAL_PLAN_FEE;
}

/** "1–2" / "17–18" / "3" / "—" label for a month's aligner numbers for one arch. */
export function alignerRangeLabel(nums: number[]): string {
  if (!nums.length) return "—";
  if (nums.length === 1) return String(nums[0]);
  return `${nums[0]}–${nums[nums.length - 1]}`;
}

/**
 * Per-slot labels for a package (month): while both arches still have an
 * aligner in a given slot they're worn together, so it's labelled as one
 * "Set N" (upper and lower share the same number at that point, since both
 * cursors advance in lockstep until one arch runs out) — only once an arch
 * is exhausted do the remaining slots show as "Upper N" / "Lower N" solo.
 * e.g. upper 12 / lower 9 → Set 1..Set 9, then Upper 10, Upper 11, Upper 12.
 */
export function monthSlotLabels(upper: number[], lower: number[]): string[] {
  const maxLen = Math.max(upper.length, lower.length);
  const labels: string[] = [];
  for (let i = 0; i < maxLen; i++) {
    const u = upper[i];
    const l = lower[i];
    if (u !== undefined && l !== undefined) labels.push(`Set ${u}`);
    else if (u !== undefined) labels.push(`Upper ${u}`);
    else if (l !== undefined) labels.push(`Lower ${l}`);
  }
  return labels;
}
