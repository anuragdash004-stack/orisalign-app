import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/online-report/save-photo
 * Body: { reportId, slotKey, url }
 *
 * Records one photo's public URL onto the online_reports row's photo_urls
 * (a jsonb object keyed by slot) the moment its Storage upload finishes —
 * not deferred to Step 4. Without this, a patient who dropped off after
 * Step 3 had their photo *files* sitting in Storage but nothing in the
 * database pointing at them, so resuming their draft couldn't show what
 * they'd already uploaded.
 *
 * Read-modify-write, not a single atomic jsonb merge — acceptable here
 * since a human uploads one photo at a time through the UI.
 */
export async function POST(req: Request) {
  try {
    const { reportId, slotKey, url } = await req.json()
    if (!reportId || !slotKey || !url) {
      return NextResponse.json({ error: "reportId, slotKey and url are required" }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from("online_reports")
      .select("photo_urls")
      .eq("id", reportId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: "Failed to save photo" }, { status: 500 })
    }
    if (!existing) {
      // Step 1's lead save should always have created the row first, but
      // fail loudly rather than silently dropping the photo if it hasn't.
      return NextResponse.json({ error: "No draft found for this report — please complete Step 1 first" }, { status: 404 })
    }

    const current = (existing.photo_urls as Record<string, string>) || {}
    const updated = { ...current, [slotKey]: url }

    const { error: updateError } = await supabase
      .from("online_reports")
      .update({ photo_urls: updated, updated_at: new Date().toISOString() })
      .eq("id", reportId)

    if (updateError) {
      return NextResponse.json({ error: "Failed to save photo" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to save photo" }, { status: 500 })
  }
}
