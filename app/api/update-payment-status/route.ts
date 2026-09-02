import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientInfo } from "@/lib/auditLog";
import { recordPaymentReceived } from "@/lib/paymentHelper";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UpdatePaymentStatusRequest {
  appointmentId: string;
  amountPaid: number;
  transactionId?: string;
  paymentMethod?: string;
  notes?: string;
  actorEmail?: string;
  actorRole?: string;
}

/**
 * POST /api/update-payment-status
 *
 * Update how much patient has paid and remaining balance.
 * Called after successful payment to update cumulative totals.
 *
 * Body: {
 *   appointmentId: string,
 *   amountPaid: number,  // Amount just paid (will be added to total)
 *   transactionId?: string,
 *   paymentMethod?: string,
 *   notes?: string,
 *   actorEmail?: string,
 *   actorRole?: string
 * }
 */
export async function POST(req: Request) {
  try {
    const {
      appointmentId,
      amountPaid,
      transactionId,
      paymentMethod,
      notes,
      actorEmail,
      actorRole,
    } = (await req.json()) as UpdatePaymentStatusRequest;

    const { ip, userAgent } = getClientInfo(req);

    const result = await recordPaymentReceived({
      supabase,
      appointmentId,
      amountPaid,
      transactionId,
      paymentMethod,
      notes,
      actorEmail,
      actorRole,
      ipAddress: ip,
      userAgent,
    });

    if (!result.success) {
      const status = result.error === "Appointment not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      appointmentId,
      previouslyPaid: result.previouslyPaid,
      newPayment: result.newPayment,
      totalPaid: result.totalPaid,
      stillToPay: result.stillToPay,
      paymentStatus: result.paymentStatus,
      message:
        result.paymentStatus === "paid"
          ? "✓ Payment Complete! Full amount received."
          : `💳 Payment recorded. ₹${result.stillToPay} still pending.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[update-payment-status]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/update-payment-status?appointmentId=...
 *
 * Get payment status and amounts
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const appointmentId = searchParams.get("appointmentId");

    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId required" },
        { status: 400 }
      );
    }

    const { data: appt, error } = await supabase
      .from("appointments_booking")
      .select(
        "amount_paid, amount_to_pay, payment_status, first_payment_date, last_payment_date, payment_data"
      )
      .eq("id", appointmentId)
      .single();

    if (error || !appt) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const pd = (appt.payment_data as Record<string, unknown>) || {};
    const fullAmount = Number(pd.final_amount ?? pd.full_amount) || 0;

    return NextResponse.json({
      appointmentId,
      amountPaid: appt.amount_paid || 0,
      amountToPay: appt.amount_to_pay || 0,
      fullAmount,
      paymentStatus: appt.payment_status || "pending",
      firstPaymentDate: appt.first_payment_date,
      lastPaymentDate: appt.last_payment_date,
      progressPercentage: fullAmount > 0 ? ((appt.amount_paid || 0) / fullAmount) * 100 : 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[update-payment-status GET]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
