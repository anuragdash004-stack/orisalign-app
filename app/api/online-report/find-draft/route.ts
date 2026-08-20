import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/online-report/find-draft?phone=...
 *
 * Looks up the most recent *incomplete* (unpaid) online_reports row for a
 * phone number, so a patient who dropped off mid-flow and comes back with
 * the same number picks up where they left off instead of starting over.
 * Deliberately scoped to payment_status='pending' && status='new_submission'
 * — a completed/paid submission should never be reopened for editing just
 * because the same phone number was entered again.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get("phone")?.trim()

  if (!phone) {
    return NextResponse.json({ error: "phone required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("online_reports")
    .select("id, full_name, sex, age, conditions, known_cavities, food_lodgement, tooth_mobility, other_concerns")
    .eq("patient_phone", phone)
    .eq("payment_status", "pending")
    .eq("status", "new_submission")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[online-report find-draft] lookup failed", error)
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ found: false })
  }

  return NextResponse.json({ found: true, draft: data })
}
