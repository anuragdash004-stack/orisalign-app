import { NextResponse } from "next/server"
import crypto from "crypto"

function hmac(data: string) {
  return crypto.createHmac("sha256", process.env.RESEND_API_KEY!).update(data).digest("hex")
}

/**
 * POST /api/patient-login/verify-otp
 * Body: { appointmentId, otp, token }
 *
 * Stateless verification (no OTP stored server-side) — same pattern as
 * app/api/verify-booking-otp. Success just proves the caller owns the phone
 * on file at this moment; the client is responsible for remembering the
 * appointmentId afterward (see app/login/page.js) — there's nothing more
 * privileged to hand back, since /patient/[id] itself has never required
 * anything beyond knowing the id.
 */
export async function POST(req: Request) {
  try {
    const { appointmentId, otp, token } = (await req.json()) as { appointmentId?: string; otp?: string; token?: string }
    if (!appointmentId || !otp || !token) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    if (process.env.DEV_OTP_BYPASS === "1" && otp === "000000") {
      return NextResponse.json({ success: true })
    }

    const expected = hmac(`patient-login:${appointmentId}:${otp}`)
    if (expected !== token) {
      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[patient-login/verify-otp]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
