/**
 * Payment Helper Functions
 * Handles payment type selection and amount calculations
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEntry } from "./auditLog";
import { sendWhatsApp } from "./notifications/aisensy";
import { sendStepNotification } from "./notifyStep";
import { applyCouponDiscount, alignerRangeLabel, monthSlotLabels, FINAL_PLAN_FEE, PROVISIONAL_PLAN_FEE, provisionalPaymentBaseline, PLAN_CONFIGS, type MonthlyPlan, type PlanKey, type ProvisionalPaymentChoice } from "./monthlyPlan";

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

export interface AutoCreatePaidBatchesParams {
  supabase: SupabaseClient;
  appointmentId: string;
  monthlyPlan: MonthlyPlan;
  couponsTotal: number;
  previouslyPaid: number;
  newTotalPaid: number;
  manufacturingData: { batches?: Record<string, unknown>[] } | null;
}

/**
 * Creates a manufacturing batch for any package whose cumulative threshold
 * amount_paid just crossed (or already covers) — the single place this
 * happens, called from two situations:
 *   1. recordPaymentReceived, right after a payment updates amount_paid
 *      (previouslyPaid = the old total, newTotalPaid = the new one).
 *   2. Final Plan Review being submitted/regenerated, when the patient
 *      already pre-paid "first month" before a schedule even existed to
 *      compare against — call with previouslyPaid = 0 and newTotalPaid =
 *      the current amount_paid, which correctly treats every package
 *      already covered by that pre-payment as newly due for manufacturing.
 * Manufacturing starts (mfg_started stamped) the moment a package's batch
 * is created this way — no separate admin click needed.
 */
export async function autoCreatePaidBatches(params: AutoCreatePaidBatchesParams): Promise<void> {
  const { supabase, appointmentId, monthlyPlan, couponsTotal, previouslyPaid, newTotalPaid, manufacturingData } = params;
  const discounted = applyCouponDiscount(monthlyPlan, couponsTotal);
  const newlyPaidMonths = discounted.months.filter(
    (m) => previouslyPaid < m.discountedCumulative && newTotalPaid >= m.discountedCumulative
  );
  if (newlyPaidMonths.length === 0) return;

  const mfg = manufacturingData || {};
  const existingBatches = mfg.batches || [];
  const startedToday = new Date().toISOString().slice(0, 10);
  const newBatches = newlyPaidMonths
    .filter((m) => !existingBatches.some((b) => Number(b.num) === m.num))
    .map((m) => ({
      num: m.num,
      start: "",
      end: "",
      mfg_started: startedToday,
      mfg_done: "",
      shipment_link: "",
      upper_aligners: alignerRangeLabel(m.upper),
      lower_aligners: alignerRangeLabel(m.lower),
      slot_label: monthSlotLabels(m.upper, m.lower).join(", "),
    }));
  if (newBatches.length > 0) {
    await supabase
      .from("appointments_booking")
      .update({ manufacturing_data: { ...mfg, batches: [...existingBatches, ...newBatches] } })
      .eq("id", appointmentId);
  }
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
    .select("id, name, email, phone, payment_data, amount_paid, amount_to_pay, payment_status, first_payment_date, monthly_plan, manufacturing_data, provisional_min_months, provisional_max_months")
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
    // yet — the only chargeable amount right now is whichever the patient
    // chose: the plan's full monthly rate ("first_month", pre-pays Month 1)
    // or the flat provisional-planning fee ("full_plan").
    const choice = pd.provisional_payment_choice as ProvisionalPaymentChoice | undefined;
    const planKey = (pd.plan as PlanKey) || "ORISPRO";
    fullAmount = choice === "first_month" ? (PLAN_CONFIGS[planKey] || PLAN_CONFIGS.ORISPRO).monthRate : PROVISIONAL_PLAN_FEE;
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
  // of which payment path fired. See autoCreatePaidBatches below.
  if (monthlyPlan) {
    try {
      await autoCreatePaidBatches({
        supabase,
        appointmentId,
        monthlyPlan,
        couponsTotal: ((pd.applied_coupons as { discount?: number }[]) || []).reduce((sum, c) => sum + (Number(c.discount) || 0), 0),
        previouslyPaid,
        newTotalPaid,
        manufacturingData: appt.manufacturing_data as { batches?: Record<string, unknown>[] } | null,
      });
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

  // Awaited deliberately, not fire-and-forget: on Vercel an un-awaited
  // promise can get killed the instant the response is sent, since the
  // serverless execution context isn't guaranteed to survive past that
  // point. Wrapped in try/catch (on top of sendEmail/sendWhatsApp's own
  // never-throws contracts) so a flaky send still never fails the payment
  // itself — amount_paid has already been committed above.
  try {
    await sendPaymentReceivedEmail({
      name: (appt as { name?: string }).name || "Patient",
      appointmentId,
      amountPaid,
      paymentMethod,
      newTotalPaid,
      newAmountToPay,
      paymentStatus,
    });
  } catch {
    // best-effort only
  }

  // Generic "payment received" receipt — fires for every payment on this
  // funnel regardless of what it was for, alongside whichever more specific
  // template fires below. {{1}} = the amount just paid, with ₹ symbol
  // (e.g. "₹2499"), never the running total.
  const patientPhone = (appt as { phone?: string }).phone;
  if (patientPhone) {
    try {
      await sendWhatsApp({
        campaignName: "orisalign_payment_received",
        destination: patientPhone,
        userName: (appt as { name?: string }).name || "Patient",
        templateParams: [`₹${amountPaid}`],
      });
    } catch {
      // best-effort only
    }
  }

  // WhatsApp receipt to the patient — staff already gets the email above;
  // this is the patient-facing confirmation, which previously didn't exist
  // on this path at all.
  //
  // Two templates, depending on what was actually paid for:
  //   - orisalign_full_plan_payment_done: the ₹2,499 provisional-planning fee
  //     (pd.provisional_payment_choice === "full_plan") — pays for the 3D
  //     plan only, no aligners yet. Static text, no variables.
  //   - orisalign_payment_done ("Hi your month {{1}} Payment has been
  //     received. Welcome to OrisAlign"): fires for the ₹4,999 "first_month"
  //     provisional choice (which bundles the plan + Month 1's aligners, so
  //     {{1}} = "1"), and for every later monthly_plan installment once a
  //     schedule exists — {{1}} = the highest month number this payment
  //     newly crossed the cumulative threshold for.
  // Legacy (pre-monthly-plan) appointments have no matching template and are
  // skipped — email above is their only patient-facing receipt.
  try {
    if (monthlyPlan && patientPhone) {
      const couponsTotal = ((pd.applied_coupons as { discount?: number }[]) || [])
        .reduce((sum, c) => sum + (Number(c.discount) || 0), 0);
      const crossedMonths = applyCouponDiscount(monthlyPlan, couponsTotal).months.filter(
        (m) => previouslyPaid < m.discountedCumulative && newTotalPaid >= m.discountedCumulative,
      );
      const monthNum = crossedMonths.slice(-1)[0]?.num;
      if (monthNum) {
        await sendWhatsApp({
          campaignName: "orisalign_payment_done",
          destination: patientPhone,
          userName: (appt as { name?: string }).name || "Patient",
          templateParams: [String(monthNum)],
        });
        // Fires the moment a month's batch is auto-created (see
        // autoCreatePaidBatches above, called just before this block) —
        // manufacturing starts immediately on payment, so this notification
        // and the "push to production" state change happen together.
        await sendWhatsApp({
          campaignName: "orisalign_production",
          destination: patientPhone,
          userName: (appt as { name?: string }).name || "Patient",
          templateParams: [String(monthNum)],
        });
      }
    } else if (!monthlyPlan && isNewModel) {
      // Two distinct patient-facing notifications (email + WhatsApp
      // together, via sendStepNotification) depending on what was actually
      // paid for — never the same generic message regardless of choice.
      // Not gated on patientPhone (unlike the branch above): the email
      // should still go out even if the patient never gave a phone number.
      // See lib/notifyStep.ts's getStepContent for the copy.
      const choice = pd.provisional_payment_choice as ProvisionalPaymentChoice | undefined;
      await sendStepNotification({
        appointmentId,
        stepKey: choice === "first_month" ? "provisional_first_month_payment" : "provisional_full_plan_payment",
      });
    }
  } catch {
    // best-effort only
  }

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
