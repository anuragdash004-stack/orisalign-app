"use client"

import { useState } from "react"

interface RazorpayCheckoutProps {
  amount: number
  patientEmail: string
  patientPhone: string
  patientName: string
  onSuccess: (paymentData: { razorpay_payment_id: string; razorpay_order_id: string }) => void
  onError?: (error: string) => void
}

export default function RazorpayCheckout({
  amount,
  patientEmail,
  patientPhone,
  patientName,
  onSuccess,
  onError,
}: RazorpayCheckoutProps) {
  const [loading, setLoading] = useState(false)

  const handlePayment = async () => {
    setLoading(true)

    try {
      // Step 1: Create order on backend
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          receipt: `patient_${Date.now()}`,
        }),
      })

      const orderData = await orderRes.json()

      if (!orderRes.ok || !orderData.order_id) {
        throw new Error(orderData.error || "Failed to create order")
      }

      // Step 2: Open Razorpay checkout modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: orderData.order_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "OrisAlign",
        description: "Payment for Aligner Treatment",
        image: "/logo.png",
        handler: async (response: any) => {
          try {
            // Step 3: Verify payment signature on backend
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            })

            const verifyData = await verifyRes.json()

            if (!verifyRes.ok || !verifyData.success) {
              throw new Error("Payment verification failed")
            }

            onSuccess({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
            })
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Payment verification failed"
            onError?.(errorMsg)
            alert(`Payment verification error: ${errorMsg}`)
          }
        },
        prefill: {
          name: patientName,
          email: patientEmail,
          contact: patientPhone,
        },
        theme: {
          color: "#b8905a",
        },
        modal: {
          ondismiss: () => {
            setLoading(false)
            onError?.("Payment cancelled by user")
          },
        },
      }

      // Load Razorpay script if not already loaded
      if (!(window as any).Razorpay) {
        const script = document.createElement("script")
        script.src = "https://checkout.razorpay.com/v1/checkout.js"
        script.async = true
        script.onload = () => {
          const rzp = new (window as any).Razorpay(options)
          rzp.open()
        }
        script.onerror = () => {
          setLoading(false)
          throw new Error("Failed to load Razorpay script")
        }
        document.body.appendChild(script)
      } else {
        const rzp = new (window as any).Razorpay(options)
        rzp.open()
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Payment error"
      setLoading(false)
      onError?.(errorMsg)
      alert(`Payment error: ${errorMsg}`)
    }
  }

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      style={{
        padding: "12px 28px",
        borderRadius: "10px",
        border: "none",
        background: loading ? "#d4a574" : "#b8905a",
        color: "white",
        fontWeight: "700",
        fontSize: "14px",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
        letterSpacing: "0.5px",
      }}
    >
      {loading ? "Processing..." : `Pay Now · ₹${(amount / 100).toLocaleString("en-IN")}`}
    </button>
  )
}
