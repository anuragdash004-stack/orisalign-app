import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

    // Generate the recovery link server-side using the admin API.
    // This bypasses Supabase's own email service and lets us send via Resend.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: "https://app.orisalign.com/auth/callback" },
    })

    if (error || !data?.properties?.action_link) {
      console.error("[send-password-reset] generateLink error:", error)
      return NextResponse.json({ error: error?.message || "Failed to generate reset link" }, { status: 500 })
    }

    const resetLink = data.properties.action_link

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "OrisAlign <no-reply@orisalign.com>",
        to: [email],
        subject: "Reset Your OrisAlign Password",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#faf7f2;padding:20px;border-radius:12px;">
            <div style="background:linear-gradient(135deg,#1B2A4A,#0f2027);padding:28px 24px;border-radius:8px;text-align:center;margin-bottom:20px;border-bottom:3px solid #C9A84C;">
              <img src="https://orisalign.com/logo.png" alt="OrisAlign" style="height:40px;margin:0 auto 14px;display:block;" />
              <h1 style="color:#C9A84C;margin:0;font-size:20px;font-weight:900;">Reset Your Password</h1>
            </div>
            <p style="color:#374151;font-size:15px;margin:0 0 16px;">Hi there,</p>
            <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 24px;">
              We received a request to reset your OrisAlign account password. Click the button below to set a new password. This link expires in 1 hour.
            </p>
            <div style="text-align:center;margin-bottom:24px;">
              <a href="${resetLink}" style="display:inline-block;background:#C9A84C;color:#1B2A4A;font-weight:bold;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;">
                Reset Password →
              </a>
            </div>
            <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const err = await emailRes.text()
      console.error("[send-password-reset] Resend error:", err)
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    console.error("[send-password-reset]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
