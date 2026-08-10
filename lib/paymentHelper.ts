/**
 * Payment Helper Functions
 * Handles payment type selection and amount calculations
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEntry } from "./auditLog";
import { applyCouponDiscount, alignerRangeLabel, FINAL_PLAN_FEE, type MonthlyPlan } from "./monthlyPlan";

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
    .select("id, name, email, payment_data, amount_paid, amount_to_pay, payment_status, first_payment_date, monthly_plan, manufacturing_data, provisional_min_months, provisional_max_months")
    .eq("id", appointmentId)
    .single();

  if (fetchError || !appt) {
    return { success: false, error: "Appointment not found" };
  }

  const pd = (appt.payment_data as Record<string, unknown>) || {};
  // New per-arch, month-by-month model: the cap is derived fresh from
  // monthly_plan (+ any coupon discount) every time, rather than relying on
  // a separately-maintained payment_data.final_amount — that field is easy
  // to leave stale (as it repeatedly has been for the old lump-sum model;
  // see the comment below) since it would otherwise need updating in three
  // separate places (provisional submit, final review submit, coupon apply).
  const monthlyPlan = appt.monthly_plan as MonthlyPlan | null | undefined;
  const isNewModel = !!monthlyPlan || appt.provisional_min_months != null || appt.provisional_max_months != null;
  let fullAmount: number;
  if (monthlyPlan) {
    const couponsTotal = ((pd.applied_coupons as { discount?: number }[]) || [])
      .reduce((sum, c) => sum + (Number(c.discount) || 0), 0);
    fullAmount = applyCouponDiscount(monthlyPlan, couponsTotal).months.slice(-1)[0]?.discountedCumulative || FINAL_PLAN_FEE;
  } else if (isNewModel) {
    // Provisional Planning submitted but Final Plan Review hasn't happened
    // yet — the only chargeable amount at this point is the ₹999 fee.
    fullAmount = FINAL_PLAN_FEE;
  } else {
    // Prefer final_amount (post-discount) over full_amount (pre-discount
    // gross) as the cap — otherwise a discounted patient's balance can never
    // reach "paid" and payments up to the discount gap wouldn't be rejected.
    fullAmount = Number(pd.final_amount ?? pd.full_amount) || 0;
  }
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

  // New per-arch, month-by-month billing model: a paid month should
  // immediately show up as a batch for the admin to manufacture, regardless
  // of which payment path fired (gateway webhook, redirect verify, manual
  // admin mark-as-paid, or the reconcile cron). Centralized here — the one
  // funnel every payment path already goes through — instead of duplicated
  // in each of those four call sites. Appointments without a monthly_plan
  // (the old lump-sum model) are completely untouched.
  if (monthlyPlan) {
    try {
      const couponsTotal = ((pd.applied_coupons as { discount?: number }[]) || [])
        .reduce((sum, c) => sum + (Number(c.discount) || 0), 0);
      const discounted = applyCouponDiscount(monthlyPlan, couponsTotal);
      const newlyPaidMonths = discounted.months.filter(
        (m) => previouslyPaid < m.discountedCumulative && newTotalPaid >= m.discountedCumulative
      );
      if (newlyPaidMonths.length > 0) {
        const mfg = (appt.manufacturing_data as { batches?: Record<string, unknown>[] } | null) || {};
        const existingBatches = mfg.batches || [];
        const newBatches = newlyPaidMonths
          .filter((m) => !existingBatches.some((b) => Number(b.num) === m.num))
          .map((m) => ({
            num: m.num,
            start: "",
            end: "",
            mfg_started: "",
            mfg_done: "",
            shipment_link: "",
            upper_aligners: alignerRangeLabel(m.upper),
            lower_aligners: alignerRangeLabel(m.lower),
          }));
        if (newBatches.length > 0) {
          await supabase
            .from("appointments_booking")
            .update({ manufacturing_data: { ...mfg, batches: [...existingBatches, ...newBatches] } })
            .eq("id", appointmentId);
        }
      }
    } catch {
      // Never let batch auto-creation block the payment itself — amount_paid
      // has already been committed above; admin can add a batch manually.
    }
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

  // Fire-and-forget — a flaky email send should never fail the payment
  // itself, since amount_paid has already been committed above.
  sendPaymentReceivedEmail({
    name: (appt as { name?: string }).name || "Patient",
    appointmentId,
    amountPaid,
    paymentMethod,
    newTotalPaid,
    newAmountToPay,
    paymentStatus,
  }).catch(() => {});

  return {
    success: true,
    previouslyPaid,
    newPayment: amountPaid,
    totalPaid: newTotalPaid,
    stillToPay: newAmountToPay,
    paymentStatus,
  };
}

/**
 * Notifies the clinic every time a payment is recorded, regardless of which
 * path recorded it (gateway webhook, redirect verify, admin's manual "Mark
 * as Paid", or a future reconciliation job) — this is the single place
 * recordPaymentReceived funnels through, so every payment triggers exactly
 * one email without each caller needing its own notification logic.
 */
async function sendPaymentReceivedEmail(params: {
  name: string;
  appointmentId: string;
  amountPaid: number;
  paymentMethod?: string;
  newTotalPaid: number;
  newAmountToPay: number;
  paymentStatus: "pending" | "partial" | "paid";
}) {
  const { name, appointmentId, amountPaid, paymentMethod, newTotalPaid, newAmountToPay, paymentStatus } = params;
  const shortId = appointmentId.substring(0, 8).toUpperCase();
  const statusLabel = paymentStatus === "paid" ? "✅ Fully Paid" : paymentStatus === "partial" ? "⏳ Partial" : "⏳ Pending";
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "OrisAlign Payments <noreply@orisalign.com>",
      to: "leads@orisalign.com",
      subject: `💳 Payment Received: ${name} — ${inr(amountPaid)}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
          <h2 style="color:#16a34a;margin:0 0 8px;">💳 Payment Received</h2>
          <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:8px;">
            <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Patient</td><td style="color:#111827;font-weight:700;">${name}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Patient ID</td><td style="color:#111827;font-family:monospace;">${shortId}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Amount Paid Now</td><td style="color:#16a34a;font-weight:800;">${inr(amountPaid)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Method</td><td style="color:#111827;">${paymentMethod || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Total Paid</td><td style="color:#111827;">${inr(newTotalPaid)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Still Pending</td><td style="color:#111827;">${inr(newAmountToPay)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Status</td><td style="color:#111827;font-weight:700;">${statusLabel}</td></tr>
          </table>
        </div>
      `,
    }),
  });
}
