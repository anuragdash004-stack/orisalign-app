import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getOrCreateReferralCode, getReferralSummary, redeemReferralCode } from "@/lib/referrals"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/referral
 *
 * { appointmentId, action: "code" }   → this patient's own code + tally
 * { appointmentId, action: "redeem", code } → redeem someone else's code
 *
 * Trusts appointmentId directly, like the other patient-facing endpoints.
 * Redemption is validated server-side (self-referral, already redeemed,
 * already paid) so the rules can't be sidestepped from the client.
 */
export async function POST(req: Request) {
  try {
    const { appointmentId, action, code } = await req.json()
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 })
    }

    if (action === "redeem") {
      const result = await redeemReferralCode(supabase, appointmentId, code)
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true, discount: result.discount })
    }

    const mine = await getOrCreateReferralCode(supabase, appointmentId)
    if ("error" in mine) return NextResponse.json({ error: mine.error }, { status: 500 })
    const summary = await getReferralSummary(supabase, appointmentId)
    return NextResponse.json({ success: true, code: mine.code, ...summary })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
