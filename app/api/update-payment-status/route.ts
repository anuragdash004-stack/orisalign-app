import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEntry, getClientInfo } from "@/lib/auditLog";

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

    // Validate inputs
    if (!appointmentId || !amountPaid || amountPaid <= 0) {
      return NextResponse.json(
        { error: "appointmentId and amountPaid (> 0) required" },
        { status: 400 }
      );
    }

    // Fetch appointment with payment data
    const { data: appt, error: fetchError } = await supabase
      .from("appointments_booking")
      .select(
        "id, name, payment_data, amount_paid, amount_to_pay, payment_status, last_payment_date"
      )
      .eq("id", appointmentId)
      .single();

    if (fetchError || !appt) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const pd = (appt.payment_data as Record<string, unknown>) || {};
    const fullAmount = Number(pd.full_amount) || 0;
    const previouslyPaid = Number(appt.amount_paid) || 0;
    const newTotalPaid = previouslyPaid + amountPaid;

    // Validate amount doesn't exceed full amount
    if (newTotalPaid > fullAmount) {
      return NextResponse.json(
        {
          error: `Payment would exceed total (₹${fullAmount}). Already paid: ₹${previouslyPaid}, trying to add: ₹${amountPaid}`,
        },
        { status: 400 }
      );
    }

    const newAmountToPay = fullAmount - newTotalPaid;
    const now = new Date().toISOString();

    // Determine payment status
    let paymentStatus = "pending";
    if (newTotalPaid >= fullAmount) {
      paymentStatus = "paid";
    } else if (newTotalPaid > 0) {
      paymentStatus = "partial";
    }

    // Update appointment
    const { error: updateError } = await supabase
      .from("appointments_booking")
      .update({
        amount_paid: newTotalPaid,
        amount_to_pay: newAmountToPay,
        payment_status: paymentStatus,
        last_payment_date: now,
        first_payment_date: previouslyPaid === 0 ? now : appt.first_payment_date,
      })
      .eq("id", appointmentId);

    if (updateError) {
      console.error("[update-payment-status] update failed", updateError);
      return NextResponse.json(
        { error: "Failed to update payment status" },
        { status: 500 }
      );
    }

    // 📋 LOG TO AUDIT TRAIL
    await logAuditEntry({
      appointmentId,
      actorEmail: actorEmail || paymentMethod || "payment_gateway",
      actorRole: actorRole || "system",
      action: "Payment Recorded",
      entity: "payment_status",
      newData: {
        amount_paid: newTotalPaid,
        amount_to_pay: newAmountToPay,
        payment_status: paymentStatus,
        last_payment: {
          amount: amountPaid,
          method: paymentMethod,
          transaction_id: transactionId,
          notes,
          timestamp: now,
        },
      },
      oldData: {
        amount_paid: previouslyPaid,
        amount_to_pay: appt.amount_to_pay,
        payment_status: appt.payment_status,
      },
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      appointmentId,
      previouslyPaid,
      newPayment: amountPaid,
      totalPaid: newTotalPaid,
      stillToPay: newAmountToPay,
      paymentStatus,
      message:
        paymentStatus === "paid"
          ? "✅ Payment Complete! Full amount received."
          : `💳 Payment recorded. ₹${newAmountToPay} still pending.`,
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
    const fullAmount = Number(pd.full_amount) || 0;

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
