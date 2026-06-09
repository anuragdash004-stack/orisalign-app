import { NextResponse } from "next/server"
import Razorpay from "razorpay"

export async function POST(req: Request) {
  try {
    const { amount, receipt } = await req.json()

    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: "Amount must be at least 100 paise (₹1)" },
        { status: 400 }
      )
    }

    if (!receipt) {
      return NextResponse.json(
        { error: "Receipt is required" },
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
      amount,
      currency: "INR",
      receipt,
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
