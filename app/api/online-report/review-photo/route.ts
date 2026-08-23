import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/online-report/review-photo
 * Body: { reportId, slotKey, status: 'approved' | 'rejected', reason? }
 *
 * Admin-only — called from the reviewer's Uploaded Photos panel. Read-modify-
 * write onto photo_review, same pattern as save-photo/route.ts's photo_urls
 * merge.
 */
export async function POST(req: Request) {
  try {
    const { reportId, slotKey, status, reason } = await req.json()
    if (!reportId || !slotKey || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "reportId, slotKey and a valid status are required" }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from("online_reports")
      .select("photo_review")
      .eq("id", reportId)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const current = (existing.photo_review as Record<string, unknown>) || {}
    const updated = {
      ...current,
      [slotKey]: { status, reason: status === "rejected" ? (reason || "") : undefined, reviewedAt: new Date().toISOString() },
    }

    const { error: updateError } = await supabase
      .from("online_reports")
      .update({ photo_review: updated, updated_at: new Date().toISOString() })
      .eq("id", reportId)

    if (updateError) {
      return NextResponse.json({ error: "Failed to save review" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error reviewing photo:", error)
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 })
  }
}
