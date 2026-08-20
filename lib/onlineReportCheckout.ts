"use client"

/**
 * Shared client-side Razorpay checkout helper for the Online Smile Report
 * flow. Loads the Razorpay script on demand and drives
 * /api/online-report/create-order + /api/online-report/verify-payment.
 *
 * NOTE: uses the LIVE Razorpay key already configured in this project
 * (NEXT_PUBLIC_RAZORPAY_KEY_ID) — see app/api/online-report/create-order for
 * details.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
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
  knownCavities?: string | null
  foodLodgement?: string | null
  toothMobility?: string | null
  pain?: string | null
  otherConcerns?: string | null
  photoUrls: string[]
}

export type CheckoutResult =
  | { success: true; reportId: string }
  | { success: false; error: string }

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load payment gateway"))
    document.body.appendChild(script)
  })
}

export async function startOnlineReportCheckout(params: {
  amountType: AmountType
  reportId: string
  couponCode?: string
  patientName: string
  patientEmail?: string
  patientPhone?: string
  formData?: ReportFormData // required when amountType === "report"
}): Promise<CheckoutResult> {
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
