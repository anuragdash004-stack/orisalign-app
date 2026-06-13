import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEntry, getClientInfo } from "@/lib/auditLog";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UpdateTemplateRequest {
  stepKey: string;
  subjectLine: string;
  emailBody: string;
  smsBody?: string;
  actorEmail?: string;
  actorRole?: string;
}

/**
 * GET /api/message-templates
 * Get all message templates for all journey steps
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const stepKey = searchParams.get("stepKey");

    let query = supabase
      .from("message_templates")
      .select("*")
      .eq("is_active", true);

    if (stepKey) {
      query = query.eq("step_key", stepKey);
    }

    query = query.order("step_key", { ascending: true });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      templates: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[message-templates GET]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/message-templates
 * Update a message template
 */
export async function POST(req: Request) {
  try {
    const {
      stepKey,
      subjectLine,
      emailBody,
      smsBody,
      actorEmail,
      actorRole,
    } = (await req.json()) as UpdateTemplateRequest;

    const { ip, userAgent } = getClientInfo(req);

    if (!stepKey || !subjectLine || !emailBody) {
      return NextResponse.json(
        { error: "stepKey, subjectLine, and emailBody required" },
        { status: 400 }
      );
    }

    // Get old template for audit
    const { data: oldTemplate } = await supabase
      .from("message_templates")
      .select("*")
      .eq("step_key", stepKey)
      .single();

    // Update template
    const { data: updatedTemplate, error } = await supabase
      .from("message_templates")
      .update({
        subject_line: subjectLine,
        email_body: emailBody,
        sms_body: smsBody || null,
        updated_at: new Date().toISOString(),
        updated_by: actorEmail || "admin",
      })
      .eq("step_key", stepKey)
      .select();

    if (error) {
      console.error("[message-templates POST] update failed", error);
      return NextResponse.json(
        { error: "Failed to update template" },
        { status: 500 }
      );
    }

    // 📋 LOG TO AUDIT TRAIL
    await logAuditEntry({
      actorEmail: actorEmail || "admin",
      actorRole: actorRole || "admin",
      action: "Message Template Updated",
      entity: "message_template",
      newData: {
        step_key: stepKey,
        subject_line: subjectLine,
        email_body_preview: emailBody.substring(0, 100) + "...",
      },
      oldData: oldTemplate ? {
        subject_line: oldTemplate.subject_line,
        email_body_preview: oldTemplate.email_body.substring(0, 100) + "...",
      } : undefined,
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `Template for "${stepKey}" updated successfully`,
      template: updatedTemplate?.[0],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[message-templates POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
