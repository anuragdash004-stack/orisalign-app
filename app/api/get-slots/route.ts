import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.json()

  const { name, phone, age, sex, address, date, time } = body

  // 🔴 CHECK IF SLOT ALREADY BOOKED
  const { data: existing } = await supabase
    .from("appointments")
    .select("*")
    .eq("date", date)
    .eq("time", time)

  if (existing && existing.length > 0) {
    return NextResponse.json({
      success: false,
      message: "Slot already booked",
    })
  }

  // ✅ INSERT NEW BOOKING
  const { error } = await supabase.from("appointments").insert([
    {
      name,
      phone,
      age,
      sex,
      address,
      date,
      time,
      status: "pending",
    },
  ])

  if (error) {
    return NextResponse.json({ success: false })
  }

  return NextResponse.json({ success: true })
}