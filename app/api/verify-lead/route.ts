import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function hmac(data: string) {
  return crypto.createHmac("sha256", process.env.RESEND_API_KEY!).update(data).digest("hex")
}

export async function POST(req: Request) {
  try {
    const { leadId, email, name, otp, token } = await req.json()

    if (!leadId || !email || !otp || !token) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    // Verify the OTP the same way verify-booking-otp does (stateless HMAC)
    const bypass = process.env.DEV_OTP_BYPASS === "1" && otp === "000000"
    if (!bypass && hmac(`${email}:${otp}`) !== token) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 401 })
    }

    // Flip the lead to verified. It stays status "lead" so it remains on the
    // Leads page for the record, but a verified lead also surfaces in the
    // Appointments list (unverified leads do not).
    const { error } = await supabase
      .from("appointments_booking")
      .update({ lead_verified: true })
      .eq("id", leadId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const baseUrl = `https://${req.headers.get("host") || "orisalign.com"}`

    // Welcome email to the patient (now that the email is confirmed)
    fetch(`${baseUrl}/api/send-welcome-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || "Patient", patientId: leadId }),
    }).catch(() => {})

    // Tell the clinic this lead is now verified
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "OrisAlign Leads <noreply@orisalign.com>",
        to: "leads@orisalign.com",
        subject: `✅ Verified Lead: ${name || email}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
            <h2 style="color:#16a34a;margin:0 0 8px;">Lead Verified ✅</h2>
            <p style="color:#374151;font-size:14px;">This lead confirmed their email via OTP and was sent to their journey page.</p>
            <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:8px;">
              <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Name</td><td style="color:#111827;font-weight:700;">${name || "—"}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="color:#111827;">${email}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Patient ID</td><td style="color:#111827;font-family:monospace;">${String(leadId).substring(0, 8).toUpperCase()}</td></tr>
            </table>
          </div>
        `,
      }),
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    console.error("verify-lead error:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
