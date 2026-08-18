import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAndApplyCoupon, BASE_PRICES_RUPEES, type AmountType } from "@/lib/onlineReportPricing"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/online-report/validate-coupon
 * Body: { code: string, amountType: AmountType }
 *
 * Preview-only — the discounted amount is recomputed again server-side in
 * create-order/verify-payment/free-submit, never trusted from the client.
 */
export async function POST(req: Request) {
  const { code, amountType } = await req.json()

  if (!code || !amountType || !(amountType in BASE_PRICES_RUPEES)) {
    return NextResponse.json({ valid: false, error: "code and a valid amountType are required" }, { status: 400 })
  }

  const result = await validateAndApplyCoupon(supabase, code, amountType as AmountType)

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error })
  }

  return NextResponse.json({
    valid: true,
    baseAmount: BASE_PRICES_RUPEES[amountType as AmountType],
    discountedAmount: result.discountedAmountRupees,
  })
}
