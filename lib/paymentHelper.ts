/**
 * Payment Helper Functions
 * Handles payment type selection and amount calculations
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEntry } from "./auditLog";

export type PaymentType = "down_payment" | "pending" | "full" | "others";

export interface PaymentData {
  full_amount?: number;
  discount_amount?: number;
  down_payment?: number;
  pending_amount?: number;
  payment_type_to_collect?: PaymentType;
  payment_custom_amount?: number;
  [key: string]: any;
}

/**
 * Get the amount to collect based on payment type
 * @param paymentData The payment data from appointment
 * @param paymentType The type of payment to collect
 * @returns The amount to collect in paise (for Cashfree)
 */
export function getAmountToCollect(
  paymentData: PaymentData,
  paymentType: PaymentType = "down_payment"
): number {
  // Prefer final_amount (post-discount) — full_amount alone is the
  // pre-discount gross figure, which would charge a discounted patient
  // the wrong (higher) amount for "Full Payment".
  const full = Number(paymentData.final_amount ?? paymentData.full_amount) || 0;
  const down = Number(paymentData.down_payment) || 0;
  const pending = Number(paymentData.pending_amount) || 0;
  const custom = Number(paymentData.payment_custom_amount) || 0;

  switch (paymentType) {
    case "down_payment":
      return Math.round(down * 100); // Convert to paise
    case "pending":
      return Math.round(pending * 100); // Convert to paise
    case "full":
      return Math.round(full * 100); // Convert to paise
    case "others":
      return Math.round(custom * 100); // Convert to paise
    default:
      return Math.round(down * 100); // Default to down payment
  }
}

/**
 * Get payment type description for display
 */
export function getPaymentTypeLabel(paymentType: PaymentType): string {
  switch (paymentType) {
    case "down_payment":
      return "Down Payment";
    case "pending":
      return "Pending Amount";
    case "full":
      return "Full Payment";
    case "others":
      return "Custom Amount";
    default:
      return "Payment";
  }
}

/**
 * Get payment summary for display
 */
export function getPaymentSummary(paymentData: PaymentData): {
  fullAmount: number;
  discountAmount: number;
  downPayment: number;
  pendingAmount: number;
  amountPaid: number;
  amountToPay: number;
  paymentType: PaymentType;
  amountNow: number;
  label: string;
  paymentStatus: "pending" | "partial" | "paid";
} {
  const paymentType: PaymentType = (paymentData.payment_type_to_collect || "down_payment") as PaymentType;
  // Prefer final_amount (post-discount, what's actually owed) when present —
  // full_amount alone is the pre-discount gross figure, which would never
  // let a discounted patient's balance reach zero.
  const fullAmount = Number(paymentData.final_amount ?? paymentData.full_amount) || 0;
  const discountAmount = Number(paymentData.discount_amount) || 0;
  const downPayment = Number(paymentData.down_payment) || 0;
  const pendingAmount = Number(paymentData.pending_amount) || 0;

  // Track how much has been paid and how much is left to pay
  const amountPaid = Number(paymentData.amount_paid) || 0;
  const amountToPay = fullAmount - amountPaid;

  // Amount to pay now (what admin selected)
  const amountNow = getAmountToCollect(paymentData, paymentType) / 100;

  // Determine payment status
  let paymentStatus: "pending" | "partial" | "paid" = "pending";
  if (amountPaid >= fullAmount) {
    paymentStatus = "paid";
  } else if (amountPaid > 0) {
    paymentStatus = "partial";
  }

  return {
    fullAmount,
    discountAmount,
    downPayment,
    pendingAmount,
    amountPaid,
    amountToPay,
    paymentType,
    amountNow,
    label: getPaymentTypeLabel(paymentType),
    paymentStatus,
  };
}

/**
 * Format payment display string
 */
export function formatPaymentDisplay(paymentData: PaymentData): {
  paid: string;
  toPay: string;
  status: string;
} {
  const summary = getPaymentSummary(paymentData);

  return {
    paid: `₹${summary.amountPaid.toLocaleString('en-IN')}`,
    toPay: `₹${summary.amountToPay.toLocaleString('en-IN')}`,
    status: summary.paymentStatus === "paid"
      ? "✅ Fully Paid"
      : summary.paymentStatus === "partial"
      ? `⏳ Partial (${summary.amountPaid > 0 ? 'Paid' : 'Pending'})`
      : "⏳ Pending",
  };
}

export interface RecordPaymentParams {
  supabase: SupabaseClient;
  appointmentId: string;
  amountPaid: number;
  transactionId?: string | number;
  paymentMethod?: string;
  notes?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export type RecordPaymentResult =
  | { success: true; previouslyPaid: number; newPayment: number; totalPaid: number; stillToPay: number; paymentStatus: "pending" | "partial" | "paid" }
  | { success: false; error: string };

/**
 * Records a payment directly against the database (amount_paid, amount_to_pay,
 * payment_status) and writes an audit entry.
 *
 * This is called directly — never via a self-fetch back into this app's own
 * API routes — because server-to-server calls to a deployment's own URL can
 * be blocked by Vercel's deployment protection, which silently swallowed
 * payment recording for some patients in the past (the gateway's webhook
 * still updated payment_data, but amount_paid/payment_status never moved).
 */
export async function recordPaymentReceived(params: RecordPaymentParams): Promise<RecordPaymentResult> {
  const { supabase, appointmentId, amountPaid, transactionId, paymentMethod, notes, actorEmail, actorRole, ipAddress, userAgent } = params;

  if (!appointmentId || !amountPaid || amountPaid <= 0) {
    return { success: false, error: "appointmentId and amountPaid (> 0) required" };
  }

  const { data: appt, error: fetchError } = await supabase
    .from("appointments_booking")
    .select("id, name, payment_data, amount_paid, amount_to_pay, payment_status, first_payment_date")
    .eq("id", appointmentId)
    .single();

  if (fetchError || !appt) {
    return { success: false, error: "Appointment not found" };
  }

  const pd = (appt.payment_data as Record<string, unknown>) || {};
  // Prefer final_amount (post-discount) over full_amount (pre-discount
  // gross) as the cap — otherwise a discounted patient's balance can never
  // reach "paid" and payments up to the discount gap wouldn't be rejected.
  const fullAmount = Number(pd.final_amount ?? pd.full_amount) || 0;
  const previouslyPaid = Number(appt.amount_paid) || 0;
  const newTotalPaid = previouslyPaid + amountPaid;

  if (fullAmount > 0 && newTotalPaid > fullAmount) {
    return {
      success: false,
      error: `Payment would exceed total (₹${fullAmount}). Already paid: ₹${previouslyPaid}, trying to add: ₹${amountPaid}`,
    };
  }

  const newAmountToPay = Math.max(0, fullAmount - newTotalPaid);
  const now = new Date().toISOString();

  let paymentStatus: "pending" | "partial" | "paid" = "pending";
  if (fullAmount > 0 && newTotalPaid >= fullAmount) paymentStatus = "paid";
  else if (newTotalPaid > 0) paymentStatus = "partial";

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
    return { success: false, error: "Failed to update payment status" };
  }

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
      last_payment: { amount: amountPaid, method: paymentMethod, transaction_id: transactionId, notes, timestamp: now },
    },
    oldData: {
      amount_paid: previouslyPaid,
      amount_to_pay: appt.amount_to_pay,
      payment_status: appt.payment_status,
    },
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    previouslyPaid,
    newPayment: amountPaid,
    totalPaid: newTotalPaid,
    stillToPay: newAmountToPay,
    paymentStatus,
  };
}
