import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AuditLogEntry {
  appointmentId?: string
  actorEmail?: string
  actorRole?: string
  action: string
  entity?: string
  newData?: Record<string, any>
  oldData?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Log an action to the audit trail
 * @param entry The audit log entry details
 * @returns Success status
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<boolean> {
  try {
    const { error } = await supabase.from("audit_log").insert({
      appointment_id: entry.appointmentId || null,
      actor_email: entry.actorEmail || "system",
      actor_role: entry.actorRole || "system",
      action: entry.action,
      entity: entry.entity || null,
      new_data: entry.newData || null,
      old_data: entry.oldData || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
    })

    if (error) {
      console.error("[Audit Log Error]", error)
      return false
    }
    return true
  } catch (err) {
    console.error("[Audit Log Exception]", err)
    return false
  }
}

/**
 * Extract IP and user agent from request headers
 */
export function getClientInfo(req: Request): { ip: string | null; userAgent: string | null } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null

  const userAgent = req.headers.get("user-agent") || null

  return { ip, userAgent }
}
