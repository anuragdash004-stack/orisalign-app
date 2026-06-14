import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PaymentType } from "@/lib/paymentHelper";
import { logAuditEntry, getClientInfo } from "@/lib/auditLog";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SetPaymentTypeRequest {
  appointmentId: string;
  paymentType: PaymentType;
  customAmount?: number;
  actorEmail?: string;
  actorRole?: string;
}

/**
 * POST /api/set-payment-type
 *
 * Admin endpoint to specify which payment type to collect for a patient.
 * Sets the payment_type_to_collect field which determines what the patient
 * will be asked to pay.
 *
 * Body: {
 *   appointmentId: string,
 *   paymentType: "down_payment" | "pending" | "full" | "others",
 *   customAmount?: number (required when paymentType is "others"),
 *   actorEmail?: string (optional, for audit logging)
 *   actorRole?: string (optional, defaults to "admin")
 * }
 */
export async function POST(req: Request) {
  try {
    const { appointmentId, paymentType, customAmount, actorEmail, actorRole } =
      (await req.json()) as SetPaymentTypeRequest;
    const { ip, userAgent } = getClientInfo(req);

    // Validate inputs
    if (!appointmentId || !paymentType) {
      return NextResponse.json(
        { error: "appointmentId and paymentType required" },
        { status: 400 }
      );
    }

    if (!["down_payment", "pending", "full", "others"].includes(paymentType)) {
      return NextResponse.json(
        { error: "Invalid paymentType. Must be: down_payment, pending, full, or others" },
        { status: 400 }
      );
    }

    if (paymentType === "others" && !(Number(customAmount) > 0)) {
      return NextResponse.json(
        { error: "customAmount is required and must be greater than 0 when paymentType is 'others'" },
        { status: 400 }
      );
    }

    // Fetch current appointment state for audit
    const { data: appt, error: fetchError } = await supabase
      .from("appointments_booking")
      .select("id, name, payment_data, payment_type_to_collect, payment_custom_amount")
      .eq("id", appointmentId)
      .single();

    if (fetchError || !appt) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const oldPaymentType = appt.payment_type_to_collect || "down_payment";
    const paymentLabels: Record<PaymentType, string> = {
      down_payment: "Down Payment",
      pending: "Pending Amount",
      full: "Full Amount",
      others: "Custom Amount",
    };

    const newCustomAmount = paymentType === "others" ? Number(customAmount) : null;

    // Update appointment with new payment type
    const { error: updateError } = await supabase
      .from("appointments_booking")
      .update({
        payment_type_to_collect: paymentType,
        payment_custom_amount: newCustomAmount,
        payment_type_description:
          paymentType === "others"
            ? `Custom Amount (₹${newCustomAmount}) set by ${actorRole || "admin"}`
            : `${paymentLabels[paymentType]} set by ${actorRole || "admin"}`,
      })
      .eq("id", appointmentId);

    if (updateError) {
      console.error("[set-payment-type] update failed", updateError);
      return NextResponse.json(
        { error: "Failed to update payment type" },
        { status: 500 }
      );
    }

    // 📋 LOG TO AUDIT TRAIL
    await logAuditEntry({
      appointmentId,
      actorEmail: actorEmail || "admin",
      actorRole: actorRole || "admin",
      action: "Payment Type Selected",
      entity: "payment_type_to_collect",
      newData: {
        payment_type_to_collect: paymentType,
        payment_type_label: paymentLabels[paymentType],
        payment_custom_amount: newCustomAmount,
        payment_data: appt.payment_data,
      },
      oldData: {
        payment_type_to_collect: oldPaymentType,
        payment_type_label: paymentLabels[oldPaymentType as PaymentType],
        payment_custom_amount: appt.payment_custom_amount ?? null,
      },
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `Payment type set to ${paymentLabels[paymentType]}`,
      appointmentId,
      paymentType,
      customAmount: newCustomAmount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[set-payment-type]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/set-payment-type?appointmentId=...
 *
 * Get current payment type for an appointment
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
      .select("payment_type_to_collect, payment_data, payment_custom_amount")
      .eq("id", appointmentId)
      .single();

    if (error || !appt) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      appointmentId,
      paymentType: appt.payment_type_to_collect || "down_payment",
      paymentData: appt.payment_data || {},
      customAmount: appt.payment_custom_amount ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[set-payment-type GET]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
