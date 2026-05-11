import crypto from "crypto"

function hmac(data: string) {
  return crypto
    .createHmac("sha256", process.env.RESEND_API_KEY!)
    .update(data)
    .digest("hex")
}

export async function POST(req: Request) {
  try {
    const { email, name } = await req.json()

    if (!email || !name) {
      return Response.json({ error: "Missing fields" }, { status: 400 })
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const token = hmac(`${email}:${otp}`)

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "OrisAlign <no-reply@orisalign.com>",
        to: email,
        subject: "Your OrisAlign Booking OTP",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #111827;">Verify Your Booking</h2>
            <p>Dear ${name},</p>
            <p>Use the OTP below to complete your appointment booking at OrisAlign:</p>
            <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
              <span style="font-size:40px;font-weight:700;letter-spacing:10px;color:#111827;">${otp}</span>
            </div>
            <p style="color:#6b7280;font-size:13px;">This OTP expires in 10 minutes. Do not share it with anyone.</p>
            <p>— OrisAlign Team</p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const err = await emailRes.json()
      console.error("Resend error:", err)
      return Response.json({ error: "Failed to send email" }, { status: 500 })
    }

    return Response.json({ token })
  } catch (err) {
    console.error("send-booking-otp error:", err)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}
