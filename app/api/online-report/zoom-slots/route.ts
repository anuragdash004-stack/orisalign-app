import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** GET /api/online-report/zoom-slots?date=YYYY-MM-DD — returns already-booked times for that date. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 })

  const { data, error } = await supabase
    .from("zoom_call_bookings")
    .select("time")
    .eq("date", date)
    .eq("status", "booked")

  if (error) return NextResponse.json({ error: "Failed to load slots" }, { status: 500 })

  return NextResponse.json({ bookedTimes: (data || []).map((d) => d.time) })
}
