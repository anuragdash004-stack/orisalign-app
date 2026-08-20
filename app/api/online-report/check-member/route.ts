import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/online-report/check-member?phone=...
 *
 * Distinct from find-draft (which only looks at unpaid drafts). This finds
 * a phone number's most recent COMPLETED (paid) submission — if one
 * exists, Step 1 should block re-submission and point them to their
 * existing report instead of starting a new one.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get("phone")?.trim()

  if (!phone) {
    return NextResponse.json({ error: "phone required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("online_reports")
    .select("id")
    .eq("patient_phone", phone)
    .in("payment_status", ["paid", "free_coupon"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ isMember: false })
  }

  return NextResponse.json({ isMember: true, reportId: data.id })
}
