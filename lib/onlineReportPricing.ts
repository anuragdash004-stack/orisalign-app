/**
 * Pricing + coupon logic for the Online Smile Report flow.
 *
 * NOTE: payment routes that use this currently run against the LIVE Razorpay
 * key already configured in this project (NEXT_PUBLIC_RAZORPAY_KEY_ID /
 * RAZORPAY_KEY_SECRET) — per explicit instruction, real charges occur. Swap
 * to a rzp_test_ key pair (and separate env vars) if you want to test
 * without real money.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type AmountType = "report" | "impression" | "plan_only" | "plan_treatment";

/** Base prices in rupees — never trust a client-supplied amount instead of these. */
export const BASE_PRICES_RUPEES: Record<AmountType, number> = {
  report: 399,
  impression: 999,
  plan_only: 2499,
  plan_treatment: 4999,
};

/** Struck-through "was" price shown next to the discounted price in the UI. */
export const STRUCK_PRICES_RUPEES: Record<AmountType, number> = {
  report: 999,
  impression: 1999,
  plan_only: 3499,
  plan_treatment: 4999, // no strikethrough shown for this option
};

export type CouponRow = {
  id: string;
  code: string;
  discount_type: "fixed" | "percentage";
  discount_amount: number;
  is_active: boolean;
  max_uses: number | null;
  times_used: number;
  expires_at: string | null;
};

export type CouponValidationResult =
  | { valid: true; coupon: CouponRow; discountedAmountRupees: number }
  | { valid: false; error: string };

/**
 * Looks up a coupon and applies it to a base amount, server-side. Re-checked
 * again at order-creation and verify-payment time — never trust a
 * client-reported discounted amount.
 */
export async function validateAndApplyCoupon(
  supabase: SupabaseClient,
  code: string,
  amountType: AmountType,
): Promise<CouponValidationResult> {
  const base = BASE_PRICES_RUPEES[amountType];
  const normalized = code.trim().toUpperCase();

  const { data: coupon, error } = await supabase
    .from("coupons")
    .select("id, code, discount_type, discount_amount, is_active, max_uses, times_used, expires_at")
    .ilike("code", normalized)
    .maybeSingle();

  if (error || !coupon) {
    return { valid: false, error: "Coupon not found" };
  }
  if (!coupon.is_active) {
    return { valid: false, error: "Coupon is no longer active" };
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { valid: false, error: "Coupon has expired" };
  }
  if (coupon.max_uses != null && coupon.times_used >= coupon.max_uses) {
    return { valid: false, error: "Coupon has reached its usage limit" };
  }

  const discountType = (coupon.discount_type || "fixed") as "fixed" | "percentage";
  const discountAmount = Number(coupon.discount_amount) || 0;
  const discount =
    discountType === "percentage" ? Math.round((base * discountAmount) / 100) : Math.round(discountAmount);

  const discountedAmountRupees = Math.max(0, base - discount);

  return { valid: true, coupon: coupon as CouponRow, discountedAmountRupees };
}

/**
 * Increments times_used — call once, only after the associated payment/
 * free-submit actually completes. Plain read-then-write; has a race window
 * under concurrent redemptions of the same coupon, acceptable at this flow's
 * volume.
 */
export async function incrementCouponUsage(supabase: SupabaseClient, couponId: string): Promise<void> {
  const { data } = await supabase.from("coupons").select("times_used").eq("id", couponId).single();
  const current = Number(data?.times_used) || 0;
  await supabase.from("coupons").update({ times_used: current + 1 }).eq("id", couponId);
}
