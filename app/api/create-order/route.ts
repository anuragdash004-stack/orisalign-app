import { NextResponse } from "next/server"
import Razorpay from "razorpay"
import { createClient } from "@supabase/supabase-js"
import { getAmountToCollect, PaymentType } from "@/lib/paymentHelper"

/**
 * POST /api/create-order
 *
 * Body: { appointmentId: string }
 *
 * Creates a Razorpay order using the pending_amount stored on the
 * appointment (never trusts a client-passed amount) — mirrors
 * /api/cashfree/order so both gateways always charge exactly what the
 * patient was shown.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { appointmentId } = await req.json()

    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 })
    }

    const { data: appt, error } = await supabase
      .from("appointments_booking")
      .select("id, payment_data, payment_type_to_collect")
      .eq("id", appointmentId)
      .single()

    if (error || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const pd = (appt.payment_data as Record<string, unknown>) || {}
    const paymentType = (appt.payment_type_to_collect || "down_payment") as PaymentType
    const amountInPaise = getAmountToCollect(pd, paymentType)

    if (amountInPaise < 100) {
      return NextResponse.json(
        { error: `No ${paymentType.replace("_", " ")} available on this appointment` },
        { status: 400 }
      )
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      console.error("Missing Razorpay credentials")
      return NextResponse.json(
        { error: "Payment service not configured" },
        { status: 500 }
      )
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    })

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: String(appointmentId),
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (error) {
    console.error("Error creating order:", error)
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    )
  }
}
