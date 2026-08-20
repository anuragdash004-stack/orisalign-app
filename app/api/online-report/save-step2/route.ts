import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/online-report/save-step2
 * Body: { reportId, chiefComplaint, conditions, knownCavities, foodLodgement, toothMobility, pain, otherConcerns }
 *
 * Persists Step 2's answers onto the draft row the moment the patient
 * clicks Continue into Step 3 — not deferred to Step 4. Without this,
 * conditions/dental-assessment data lived only in local component state
 * until final payment, so resuming a draft before then had nothing in the
 * database to restore (unlike Step 1's lead save and Step 3's per-photo
 * save, which already persist immediately).
 */
export async function POST(req: Request) {
  try {
    const { reportId, chiefComplaint, conditions, knownCavities, foodLodgement, toothMobility, pain, otherConcerns } = await req.json()

    if (!reportId) {
      return NextResponse.json({ error: "reportId required" }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from("online_reports")
      .select("id")
      .eq("id", reportId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: "Failed to save" }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: "No draft found for this report — please complete Step 1 first" }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from("online_reports")
      .update({
        chief_complaint: chiefComplaint ?? null,
        conditions: conditions || {},
        known_cavities: knownCavities ?? null,
        food_lodgement: foodLodgement ?? null,
        tooth_mobility: toothMobility ?? null,
        pain: pain ?? null,
        other_concerns: otherConcerns ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId)

    if (updateError) {
      return NextResponse.json({ error: "Failed to save" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
