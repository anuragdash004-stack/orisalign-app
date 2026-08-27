"use client"

/**
 * Shared client-side checkout helper for the Online Smile Report flow.
 * Cashfree is the default gateway (real server-to-server webhook for
 * impression/plan payments — see app/api/online-report/cashfree/webhook —
 * plus a modal checkout that never leaves this page). Razorpay is kept as a
 * manual fallback (pass gateway: "razorpay") for if Cashfree itself is
 * unavailable; it has no webhook, so a payment there only gets recorded if
 * this same browser session survives to call verify-payment.
 *
 * NOTE: both gateways run against LIVE keys already configured in this
 * project — real charges occur.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => {
      checkout: (opts: {
        paymentSessionId: string
        redirectTarget?: "_self" | "_blank" | "_modal"
      }) => Promise<{ error?: { message?: string }; paymentDetails?: unknown }>
    }
  }
}

export type AmountType = "report" | "impression" | "plan_only" | "plan_treatment"

export type ReportFormData = {
  fullName: string
  age?: number | null
  sex?: string | null
  patientPhone?: string | null
  patientEmail?: string | null
  conditions: Record<string, unknown>
  chiefComplaint?: string | null
  knownCavities?: string | null
  foodLodgement?: string | null
  toothMobility?: string | null
  pain?: string | null
  otherConcerns?: string | null
  /** Keyed by photo slot (e.g. "front_bite"), not a positional array — see app/api/online-report/save-photo. */
  photoUrls: Record<string, string>
}

export type CheckoutResult =
  | { success: true; reportId: string }
  | { success: false; error: string }

export interface StartCheckoutParams {
  amountType: AmountType
  reportId: string
  couponCode?: string
  patientName: string
  patientEmail?: string
  patientPhone?: string
  formData?: ReportFormData // required when amountType === "report"
  /** Manual fallback only — defaults to "cashfree". */
  gateway?: "cashfree" | "razorpay"
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load payment gateway"))
    document.body.appendChild(script)
  })
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve()
  return loadScript("https://checkout.razorpay.com/v1/checkout.js")
}

function loadCashfreeScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Cashfree) return Promise.resolve()
  return loadScript("https://sdk.cashfree.com/js/v3/cashfree.js")
}

async function startCashfreeCheckout(params: StartCheckoutParams): Promise<CheckoutResult> {
  const { amountType, reportId, couponCode, patientName, patientPhone, formData } = params

  const orderRes = await fetch("/api/online-report/cashfree/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountType, reportId, couponCode, patientName, patientPhone }),
  })
  const orderData = await orderRes.json()

  if (!orderRes.ok) {
    return { success: false, error: orderData.error || "Couldn't create payment order." }
  }
  if (orderData.free) {
    return { success: false, error: "This payment isn't ₹0 — use the coupon field on the previous step." }
  }

  try {
    await loadCashfreeScript()
  } catch {
    return { success: false, error: "Failed to load payment gateway. Please try again." }
  }
  if (typeof window === "undefined" || !window.Cashfree) {
    return { success: false, error: "Payment SDK is still loading — please try again in a moment." }
  }

  const mode = orderData.mode === "production" ? "production" : "sandbox"
  const cashfree = window.Cashfree({ mode })

  let checkoutResult
  try {
    checkoutResult = await cashfree.checkout({
      paymentSessionId: orderData.paymentSessionId,
      redirectTarget: "_modal",
    })
  } catch {
    return { success: false, error: "Payment failed or was cancelled. Please try again." }
  }
  if (checkoutResult?.error) {
    return { success: false, error: "Payment cancelled or failed. Please try again." }
  }

  // Never trust the modal's own success signal — confirm server-side against
  // Cashfree's own order status before recording anything.
  try {
    const verifyRes = await fetch("/api/online-report/cashfree/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: orderData.orderId,
        amountType,
        reportId,
        couponId: orderData.couponId,
        formData,
      }),
    })
    const verifyData = await verifyRes.json()
    if (!verifyRes.ok || !verifyData.success) {
      return { success: false, error: verifyData.error || "Payment verification failed." }
    }
    return { success: true, reportId: verifyData.reportId || reportId }
  } catch {
    return { success: false, error: "Payment verification error. Please contact support." }
  }
}

async function startRazorpayCheckout(params: StartCheckoutParams): Promise<CheckoutResult> {
  const { amountType, reportId, couponCode, patientName, patientEmail, patientPhone, formData } = params

  const orderRes = await fetch("/api/online-report/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountType, reportId: amountType === "report" ? undefined : reportId, couponCode }),
  })
  const orderData = await orderRes.json()

  if (!orderRes.ok) {
    return { success: false, error: orderData.error || "Couldn't create payment order." }
  }
  if (orderData.free) {
    return { success: false, error: "This payment isn't ₹0 — use the coupon field on the previous step." }
  }

  try {
    await loadRazorpayScript()
  } catch {
    return { success: false, error: "Failed to load payment gateway. Please try again." }
  }

  return new Promise((resolve) => {
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      order_id: orderData.order_id,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "OrisAlign",
      description: "Online Smile Report",
      image: "/logo.png",
      prefill: { name: patientName, email: patientEmail || "", contact: patientPhone || "" },
      theme: { color: "#C9A84C" },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          const verifyRes = await fetch("/api/online-report/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amountType,
              reportId,
              couponId: orderData.couponId,
              formData,
            }),
          })
          const verifyData = await verifyRes.json()
          if (!verifyRes.ok || !verifyData.success) {
            resolve({ success: false, error: verifyData.error || "Payment verification failed." })
            return
          }
          resolve({ success: true, reportId: verifyData.reportId || reportId })
        } catch {
          resolve({ success: false, error: "Payment verification error. Please contact support." })
        }
      },
      modal: {
        ondismiss: () => resolve({ success: false, error: "Payment cancelled." }),
      },
    }
    const rzp = new window.Razorpay!(options)
    rzp.open()
  })
}

export async function startOnlineReportCheckout(params: StartCheckoutParams): Promise<CheckoutResult> {
  return params.gateway === "razorpay" ? startRazorpayCheckout(params) : startCashfreeCheckout(params)
}
