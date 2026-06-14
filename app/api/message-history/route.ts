import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEntry, getClientInfo } from "@/lib/auditLog";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SendMessageRequest {
  appointmentId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  messageType?: string; // 'email', 'sms', 'both'
  stepKey?: string;
  actorEmail?: string;
  actorRole?: string;
}

/**
 * GET /api/message-history?appointmentId=...
 * Get all messages sent to a patient
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const appointmentId = searchParams.get("appointmentId");
    const messageType = searchParams.get("messageType"); // optional filter

    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("message_history")
      .select("*")
      .eq("appointment_id", appointmentId);

    if (messageType) {
      query = query.eq("message_type", messageType);
    }

    query = query.order("sent_at", { ascending: false });

    const { data: messages, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      appointmentId,
      messages: messages || [],
      count: messages?.length || 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[message-history GET]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/message-history
 * Send a custom message to a patient and log it
 */
export async function POST(req: Request) {
  try {
    const {
      appointmentId,
      recipientEmail,
      subject,
      body,
      messageType = "email",
      stepKey,
      actorEmail,
      actorRole,
    } = (await req.json()) as SendMessageRequest;

    const { ip, userAgent } = getClientInfo(req);

    if (!appointmentId || !recipientEmail || !subject || !body) {
      return NextResponse.json(
        { error: "appointmentId, recipientEmail, subject, and body required" },
        { status: 400 }
      );
    }

    // Verify appointment exists
    const { data: appt, error: apptError } = await supabase
      .from("appointments_booking")
      .select("id, name")
      .eq("id", appointmentId)
      .single();

    if (apptError || !appt) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Send email via Resend
    let deliveryStatus = "pending";
    let deliveryProvider = "resend";
    let providerResponse = {};

    if (messageType === "email" || messageType === "both") {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "OrisAlign <no-reply@orisalign.com>",
            to: [recipientEmail],
            subject,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#faf7f2;padding:20px;border-radius:12px;">
                <div style="background:linear-gradient(135deg,#1B2A4A,#0f2027);padding:20px;border-radius:8px;margin-bottom:20px;text-align:center;">
                  <h1 style="color:#C9A84C;margin:0;font-size:22px;">OrisAlign</h1>
                </div>
                <p style="color:#374151;font-size:15px;line-height:1.7;">${body}</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
                <p style="text-align:center;color:#9ca3af;font-size:12px;">
                  OrisAlign · Bhubaneswar – 751016, Odisha<br/>
                  <a href="https://orisalign.com" style="color:#9ca3af;">orisalign.com</a>
                </p>
              </div>
            `,
          }),
        });

        const emailData = await emailRes.json();
        deliveryStatus = emailRes.ok ? "sent" : "failed";
        providerResponse = emailData;
      } catch (emailErr) {
        console.error("[message-history] email send failed", emailErr);
        deliveryStatus = "failed";
      }
    }

    // Log message to history
    const { data: loggedMessage, error: logError } = await supabase
      .from("message_history")
      .insert({
        appointment_id: appointmentId,
        step_key: stepKey || null,
        message_type: messageType,
        recipient_email: recipientEmail,
        subject,
        body,
        is_template: false,
        delivery_status: deliveryStatus,
        delivery_provider: deliveryProvider,
        provider_response: providerResponse,
        sent_by: actorEmail || "admin",
        sent_by_role: actorRole || "admin",
      })
      .select();

    if (logError) {
      console.error("[message-history POST] log failed", logError);
      return NextResponse.json(
        { error: "Failed to log message" },
        { status: 500 }
      );
    }

    // 📋 LOG TO AUDIT TRAIL
    await logAuditEntry({
      appointmentId,
      actorEmail: actorEmail || "admin",
      actorRole: actorRole || "admin",
      action: "Custom Message Sent",
      entity: "message",
      newData: {
        message_type: messageType,
        recipient: recipientEmail,
        subject,
        delivery_status: deliveryStatus,
      },
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `Message sent to ${recipientEmail}`,
      deliveryStatus,
      loggedMessage: loggedMessage?.[0],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[message-history POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
