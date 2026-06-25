import { NextResponse } from "next/server"
import crypto from "crypto"
import Razorpay from "razorpay"

/**
 * POST /api/verify-payment
 *
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, appointmentId }
 *
 * Verifies the Razorpay signature, then fetches the order back from Razorpay
 * (never trusts a client-passed amount) and records it via
 * /api/update-payment-status — mirroring what the Cashfree webhook does, so
 * Razorpay payments are tracked the same way.
 */
export async function POST(req: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, appointmentId } =
      await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required payment fields" },
        { status: 400 }
      )
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keySecret) {
      console.error("RAZORPAY_KEY_SECRET not configured")
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 500 }
      )
    }

    const hmac = crypto.createHmac("sha256", keySecret)
    const body = `${razorpay_order_id}|${razorpay_payment_id}`
    hmac.update(body)
    const generated_signature = hmac.digest("hex")

    if (generated_signature !== razorpay_signature) {
      return NextResponse.json(
        { error: "Payment signature verification failed" },
        { status: 400 }
      )
    }

    // Record the payment, using the amount Razorpay has on file for this
    // order (never the client's amount) so tracking matches what was
    // actually charged.
    if (appointmentId) {
      try {
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
        if (keyId) {
          const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
          const order = await razorpay.orders.fetch(razorpay_order_id)
          const amountPaidRupees = Number(order.amount) / 100

          const origin = req.headers.get("origin") || `https://${req.headers.get("host") || "orisalign.com"}`
          await fetch(`${origin}/api/update-payment-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appointmentId,
              amountPaid: amountPaidRupees,
              transactionId: razorpay_payment_id,
              paymentMethod: "Razorpay",
              actorEmail: "razorpay_verify",
              actorRole: "payment_gateway",
            }),
          })
        }
      } catch (e) {
        console.error("[verify-payment] failed to record payment status", e)
        // Don't fail the verification response if status recording fails —
        // the signature is valid and the patient did pay.
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      razorpay_payment_id,
      razorpay_order_id,
    })
  } catch (error) {
    console.error("Error verifying payment:", error)
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    )
  }
}
