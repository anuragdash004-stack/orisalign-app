import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCouponDiscount } from "./monthlyPlan";
import type { MonthlyPlan } from "./monthlyPlan";

/** Both sides of a referral get this much off. */
export const REFERRAL_REWARD = 500;

/** How many referrals one patient can be rewarded for. */
export const REFERRAL_REWARD_CAP = 5;

// No I/O/0/1 — these codes get read off a screen and typed by someone else.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `ORIS${out}`;
}

/**
 * The patient's own code, minted on first use. The unique index on
 * referral_code is the real guard against collisions — a couple of retries
 * cover the vanishingly rare clash.
 */
export async function getOrCreateReferralCode(
  supabase: SupabaseClient,
  appointmentId: string
): Promise<{ code: string } | { error: string }> {
  const { data: appt, error } = await supabase
    .from("appointments_booking")
    .select("id, referral_code")
    .eq("id", appointmentId)
    .single();

  if (error || !appt) return { error: "Appointment not found" };
  if (appt.referral_code) return { code: appt.referral_code as string };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error: upErr } = await supabase
      .from("appointments_booking")
      .update({ referral_code: code })
      .eq("id", appointmentId)
      .is("referral_code", null);

    if (!upErr) {
      // Re-read: another request may have won the race and set a different code.
      const { data: fresh } = await supabase
        .from("appointments_booking")
        .select("referral_code")
        .eq("id", appointmentId)
        .single();
      if (fresh?.referral_code) return { code: fresh.referral_code as string };
    }
  }
  return { error: "Could not generate a referral code" };
}

/** Adds a discount entry to a patient's applied_coupons, skipping duplicates. */
async function creditCoupon(
  supabase: SupabaseClient,
  appointmentId: string,
  code: string,
  amount: number
): Promise<boolean> {
  const { data: appt } = await supabase
    .from("appointments_booking")
    .select("payment_data")
    .eq("id", appointmentId)
    .single();

  const pd = (appt?.payment_data as Record<string, unknown>) || {};
  const coupons = Array.isArray(pd.applied_coupons) ? (pd.applied_coupons as { code?: string }[]) : [];
  if (coupons.some((c) => c.code === code)) return true;

  const { error } = await supabase
    .from("appointments_booking")
    .update({ payment_data: { ...pd, applied_coupons: [...coupons, { code, discount: amount }] } })
    .eq("id", appointmentId);

  return !error;
}

export type RedeemResult =
  | { success: true; discount: number }
  | { success: false; error: string };

/**
 * A new patient redeems someone else's code. Their ₹500 lands immediately as
 * a coupon; the referrer's is held back until this patient actually pays for
 * an aligner package (see qualifyReferralOnPayment).
 */
export async function redeemReferralCode(
  supabase: SupabaseClient,
  refereeId: string,
  rawCode: string
): Promise<RedeemResult> {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { success: false, error: "Enter a referral code." };

  const { data: referee } = await supabase
    .from("appointments_booking")
    .select("id, amount_paid, referral_code")
    .eq("id", refereeId)
    .single();

  if (!referee) return { success: false, error: "Appointment not found" };

  if (referee.referral_code === code) {
    return { success: false, error: "That's your own referral code." };
  }
  // The referee's reward is for their first order, so it has to be applied
  // before they've paid anything.
  if ((Number(referee.amount_paid) || 0) > 0) {
    return { success: false, error: "A referral code can only be used before your first payment." };
  }

  const { data: existing } = await supabase
    .from("referrals")
    .select("id")
    .eq("referee_id", refereeId)
    .maybeSingle();
  if (existing) return { success: false, error: "You've already used a referral code." };

  const { data: referrer } = await supabase
    .from("appointments_booking")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();
  if (!referrer) return { success: false, error: "No referral code matches that." };

  const credited = await creditCoupon(supabase, refereeId, code, REFERRAL_REWARD);
  if (!credited) return { success: false, error: "Couldn't apply that code. Please try again." };

  const { error: insErr } = await supabase.from("referrals").insert({
    code,
    referrer_id: referrer.id,
    referee_id: refereeId,
    reward_amount: REFERRAL_REWARD,
  });
  if (insErr) return { success: false, error: "Couldn't record that referral. Please try again." };

  return { success: true, discount: REFERRAL_REWARD };
}

/**
 * Called after a payment lands. The referrer only earns once the person they
 * referred has paid for an actual aligner package — the provisional fee alone
 * doesn't unlock it — and only up to REFERRAL_REWARD_CAP times.
 *
 * Never throws: a referral bookkeeping failure must not fail the payment that
 * triggered it.
 */
export async function qualifyReferralOnPayment(
  supabase: SupabaseClient,
  refereeId: string,
  amountPaid: number
): Promise<void> {
  try {
    const { data: referral } = await supabase
      .from("referrals")
      .select("id, referrer_id, reward_amount, qualified_at")
      .eq("referee_id", refereeId)
      .is("qualified_at", null)
      .maybeSingle();
    if (!referral) return;

    const { data: referee } = await supabase
      .from("appointments_booking")
      .select("monthly_plan, payment_data")
      .eq("id", refereeId)
      .single();

    const plan = referee?.monthly_plan as MonthlyPlan | null | undefined;
    if (!plan) return; // no schedule yet, so no package has been bought

    const pd = (referee?.payment_data as Record<string, unknown>) || {};
    const couponsTotal = (Array.isArray(pd.applied_coupons) ? (pd.applied_coupons as { discount?: number }[]) : [])
      .reduce((sum, c) => sum + (Number(c.discount) || 0), 0);
    const firstPackage = applyCouponDiscount(plan, couponsTotal).months[0];
    if (!firstPackage) return;

    // Qualifies only once at least the first aligner package is covered.
    if (amountPaid < firstPackage.discountedCumulative) return;

    const { count } = await supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", referral.referrer_id)
      .not("reward_credited_at", "is", null);

    await supabase.from("referrals").update({ qualified_at: new Date().toISOString() }).eq("id", referral.id);

    if ((count || 0) >= REFERRAL_REWARD_CAP) return; // earned, but past the cap

    const amount = Number(referral.reward_amount) || REFERRAL_REWARD;
    const ok = await creditCoupon(
      supabase,
      referral.referrer_id,
      `REFERRAL-${String(referral.id).slice(0, 8).toUpperCase()}`,
      amount
    );
    if (ok) {
      await supabase
        .from("referrals")
        .update({ reward_credited_at: new Date().toISOString() })
        .eq("id", referral.id);
    }
  } catch {
    // bookkeeping only — never let this fail the payment
  }
}

/** Summary for the patient's own Refer screen. */
export async function getReferralSummary(supabase: SupabaseClient, appointmentId: string) {
  const { data: rows } = await supabase
    .from("referrals")
    .select("id, qualified_at, reward_credited_at, reward_amount")
    .eq("referrer_id", appointmentId);

  const list = rows || [];
  return {
    shared: list.length,
    qualified: list.filter((r) => r.qualified_at).length,
    earned: list
      .filter((r) => r.reward_credited_at)
      .reduce((sum, r) => sum + (Number(r.reward_amount) || 0), 0),
    cap: REFERRAL_REWARD_CAP,
    reward: REFERRAL_REWARD,
  };
}
