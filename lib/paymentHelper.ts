/**
 * Payment Helper Functions
 * Handles payment type selection and amount calculations
 */

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
  const full = Number(paymentData.full_amount) || 0;
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
  const fullAmount = Number(paymentData.full_amount) || 0;
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
