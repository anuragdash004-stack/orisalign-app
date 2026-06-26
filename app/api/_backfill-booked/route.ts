import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// One-time migration: existing appointments never had journey_steps.booked
// explicitly set (it was hardcoded true in the UI). Backfill it explicitly
// so the new "enter a date, then Mark Done" flow for booked doesn't regress
// already-active patients. Delete this route after running it once.
export async function POST() {
  const { data: rows, error } = await supabase
    .from("appointments_booking")
    .select("id, created_at, journey_steps")
    .is("journey_steps->booked", null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let updated = 0
  for (const row of rows || []) {
    const bookedAt = (row.created_at || new Date().toISOString()).slice(0, 10)
    const newJs = { ...(row.journey_steps || {}), booked: true, booked_at: bookedAt }
    const { error: updErr } = await supabase
      .from("appointments_booking")
      .update({ journey_steps: newJs })
      .eq("id", row.id)
    if (!updErr) updated++
  }

  return NextResponse.json({ found: rows?.length || 0, updated })
}
