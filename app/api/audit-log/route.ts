import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { appointmentId, actorEmail, actorRole, action, entity, newData, oldData } = await req.json()
    if (!action) return NextResponse.json({ error: "action required" }, { status: 400 })

    const { error } = await supabase.from("audit_log").insert({
      appointment_id: appointmentId || null,
      actor_email: actorEmail || null,
      actor_role: actorRole || null,
      action,
      entity: entity || null,
      new_data: newData || null,
      old_data: oldData || null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const appointmentId = searchParams.get("appointmentId")
  if (!appointmentId) return NextResponse.json({ error: "appointmentId required" }, { status: 400 })

  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data || [] })
}
