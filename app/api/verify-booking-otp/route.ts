import crypto from "crypto"

function hmac(data: string) {
  return crypto
    .createHmac("sha256", process.env.RESEND_API_KEY!)
    .update(data)
    .digest("hex")
}

export async function POST(req: Request) {
  try {
    const { email, otp, token } = await req.json()

    if (!email || !otp || !token) {
      return Response.json({ error: "Missing fields" }, { status: 400 })
    }

    if (process.env.DEV_OTP_BYPASS === "1" && otp === "000000") {
      return Response.json({ success: true })
    }

    const expected = hmac(`${email}:${otp}`)

    if (expected !== token) {
      return Response.json({ error: "Invalid OTP" }, { status: 401 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error("verify-booking-otp error:", err)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}
