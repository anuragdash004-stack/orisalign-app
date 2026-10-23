import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/apply-plan-coupon
 *
 * Applies a coupon to a patient's aligner-treatment payment (monthly plan
 * or legacy lump-sum alike — both read payment_data.applied_coupons).
 *
 * Previously this was done entirely client-side: the patient page queried
 * the coupons table directly with the anon key and wrote the discount
 * straight onto payment_data, trusting whatever it got back. That path
 * never checked expires_at or usage_limit at all (only is_active), and had
 * no way to enforce "one coupon attempt per patient, ever" against a race
 * from two rapid clicks. This route is the server-side replacement.
 *
 * Body: { appointmentId: string, code: string }
 */
export async function POST(req: Request) {
  try {
    const { appointmentId, code } = (await req.json()) as { appointmentId?: string; code?: string };
    if (!appointmentId || !code) {
      return NextResponse.json({ error: "appointmentId and code required" }, { status: 400 });
    }
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      return NextResponse.json({ error: "Enter a coupon code." }, { status: 400 });
    }

    const { data: coupon, error: couponError } = await supabase
      .from("coupons")
      .select("id, code, discount_type, discount_amount, is_active, usage_limit, used_count, expires_at")
      .ilike("code", normalized)
      .maybeSingle();

    if (couponError || !coupon) {
      return NextResponse.json({ error: "No valid coupon found with this code." }, { status: 404 });
    }
    if (!coupon.is_active) {
      return NextResponse.json({ error: "This coupon is no longer active." }, { status: 400 });
    }
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "This coupon has expired." }, { status: 400 });
    }
    if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
      return NextResponse.json({ error: "This coupon has reached its usage limit." }, { status: 400 });
    }

    // discount_amount is treated as a flat rupee amount regardless of
    // discount_type (matches the behaviour this route replaces) — there's
    // no fixed "base price" to percentage a treatment plan against, since
    // the monthly plan total varies per patient.
    const discountAmount = Number(coupon.discount_amount) || 0;
    if (discountAmount <= 0) {
      return NextResponse.json({ error: "This coupon has no discount available." }, { status: 400 });
    }

    const { data: appt, error: apptError } = await supabase
      .from("appointments_booking")
      .select("id, payment_data")
      .eq("id", appointmentId)
      .single();
    if (apptError || !appt) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const existingCoupons = (appt.payment_data as Record<string, unknown>)?.applied_coupons as unknown[] | undefined;
    if (Array.isArray(existingCoupons) && existingCoupons.length > 0) {
      return NextResponse.json({ error: "A coupon has already been used on this patient." }, { status: 400 });
    }

    // Atomic check-and-reserve — closes the race a plain re-check here would
    // leave open between two near-simultaneous apply attempts.
    const { data: claimed, error: claimError } = await supabase.rpc("claim_plan_coupon_slot", {
      p_appointment_id: appointmentId,
      p_code: coupon.code,
      p_discount: discountAmount,
    });
    if (claimError) {
      console.error("[apply-plan-coupon] claim failed", claimError);
      return NextResponse.json({ error: "Couldn't apply the coupon. Please try again." }, { status: 500 });
    }
    if (!claimed) {
      return NextResponse.json({ error: "A coupon has already been used on this patient." }, { status: 400 });
    }

    try {
      await supabase
        .from("coupons")
        .update({ used_count: (Number(coupon.used_count) || 0) + 1 })
        .eq("id", coupon.id);
    } catch {
      // best-effort usage counter — never let this fail the coupon the
      // patient already successfully claimed
    }

    return NextResponse.json({ success: true, code: coupon.code, discount: discountAmount });
  } catch (err) {
    console.error("[apply-plan-coupon]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
