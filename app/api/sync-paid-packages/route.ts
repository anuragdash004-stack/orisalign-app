import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoCreatePaidBatches } from "@/lib/paymentHelper";
import type { MonthlyPlan } from "@/lib/monthlyPlan";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/sync-paid-packages
 *
 * Called right after Final Plan Review generates (or regenerates) a
 * monthly_plan. If the patient already pre-paid "first month" before any
 * schedule existed to compare against, no payment event fires again at this
 * moment to trigger the usual batch-auto-creation in recordPaymentReceived
 * — so this re-checks amount_paid against the freshly generated schedule
 * and creates any package batches it now covers.
 *
 * Body: { appointmentId: string }
 */
export async function POST(req: Request) {
  try {
    const { appointmentId } = (await req.json()) as { appointmentId: string };
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
    }

    const { data: appt, error } = await supabase
      .from("appointments_booking")
      .select("amount_paid, monthly_plan, manufacturing_data, payment_data")
      .eq("id", appointmentId)
      .single();

    if (error || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const monthlyPlan = appt.monthly_plan as MonthlyPlan | null;
    if (!monthlyPlan) {
      return NextResponse.json({ synced: false, reason: "No monthly_plan" });
    }

    const pd = (appt.payment_data as Record<string, unknown>) || {};
    const couponsTotal = ((pd.applied_coupons as { discount?: number }[]) || [])
      .reduce((sum, c) => sum + (Number(c.discount) || 0), 0);

    await autoCreatePaidBatches({
      supabase,
      appointmentId,
      monthlyPlan,
      couponsTotal,
      previouslyPaid: 0,
      newTotalPaid: Number(appt.amount_paid) || 0,
      manufacturingData: appt.manufacturing_data as { batches?: Record<string, unknown>[] } | null,
    });

    return NextResponse.json({ synced: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[sync-paid-packages]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
