import crypto from "crypto"
import { sendWhatsApp } from "@/lib/notifications/aisensy"

function hmac(data: string) {
  return crypto
    .createHmac("sha256", process.env.RESEND_API_KEY!)
    .update(data)
    .digest("hex")
}

export async function POST(req: Request) {
  try {
    const { email, name, phone } = await req.json()

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
            <p style="color:#6b7280;font-size:12px;line-height:1.6;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
              By entering this OTP and confirming your scan, you consent to receive all forms of communication from
              OrisAlign — phone calls, SMS, WhatsApp and email — regarding the aligner treatment you have chosen.
            </p>
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

    // WhatsApp OTP — best-effort, never blocks the email flow that already succeeded.
    if (phone) {
      sendWhatsApp({
        campaignName: "orisalign_otp",
        destination: phone,
        userName: name,
        templateParams: [otp],
      }).catch(() => {})
    }

    return Response.json({ token })
  } catch (err) {
    console.error("send-booking-otp error:", err)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}
