import { createClient } from "@supabase/supabase-js";
import { sendWhatsApp } from "@/lib/notifications/aisensy";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // use service role key here (server only)
);

export async function POST(req) {
  try {
    const { appointmentId, patientEmail, patientName } = await req.json();

    if (!appointmentId || !patientEmail) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store OTP in Supabase
    const { data: updatedAppt, error: updateError } = await supabase
      .from("appointments_booking")
      .update({ otp, otp_expires_at: expiresAt })
      .eq("id", appointmentId)
      .select("phone")
      .single();

    if (updateError) {
      return Response.json({ error: "Failed to save OTP" }, { status: 500 });
    }

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "OrisAlign <no-reply@orisalign.com>",
        to: patientEmail,
        subject: "Your OTP for OrisAlign Appointment",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #111827;">Your Appointment OTP</h2>
            <p>Dear ${patientName || "Patient"},</p>
            <p>Your dentist is about to start your appointment. Please share the OTP below with them:</p>
            <div style="
              background: #f0fdf4; border: 2px solid #22c55e;
              border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
              <span style="font-size: 40px; font-weight: 700; letter-spacing: 10px; color: #111827;">
                ${otp}
              </span>
            </div>
            <p style="color: #6b7280; font-size: 13px;">This OTP expires in 10 minutes. Do not share it with anyone other than your dentist.</p>
            <p>— OrisAlign Team</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const emailErr = await emailRes.json();
      console.error("Resend error:", emailErr);
      return Response.json({ error: "Failed to send email" }, { status: 500 });
    }

    // WhatsApp OTP — best-effort, never blocks the email flow that already succeeded.
    if (updatedAppt?.phone) {
      sendWhatsApp({
        campaignName: "orisalign_otp",
        destination: updatedAppt.phone,
        userName: patientName || "Patient",
        templateParams: [otp],
      }).catch(() => {});
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("OTP error:", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
