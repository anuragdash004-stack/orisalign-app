import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { name, phone, age, sex, address, date, time } = body

    // ✅ BASIC VALIDATION
    if (!name || !phone || !date || !time) {
      return NextResponse.json({
        success: false,
        message: "Missing required fields",
      })
    }

    // 🔴 CHECK IF SLOT ALREADY BOOKED
    const { data: existing, error: checkError } = await supabase
      .from("appointments_booking")
      .select("id")
      .eq("date", date)
      .eq("time", time)

    if (checkError) {
      console.error(checkError)
      return NextResponse.json({
        success: false,
        message: "Error checking slot",
      })
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: false,
        message: "Slot already booked",
      })
    }

    // ✅ INSERT NEW BOOKING
    const { error: insertError } = await supabase
      .from("appointments_booking")
      .insert([
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

    if (insertError) {
      console.error(insertError)
      return NextResponse.json({
        success: false,
        message: "Failed to save booking",
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({
      success: false,
      message: "Server error",
    })
  }
}