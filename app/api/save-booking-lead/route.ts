import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, phone, email } = body

    if (!name || !phone || !email) {
      return NextResponse.json({
        success: false,
        message: "Missing required fields (name, phone, email)",
      }, { status: 400 })
    }

    const bookedAt = new Date().toISOString()

    // Save lead to leads table
    const { data, error } = await supabase
      .from("leads")
      .insert([
        {
          name,
          phone,
          email,
          created_at: bookedAt,
          status: "new",
        },
      ])
      .select("id")

    if (error) {
      console.error("Error saving lead:", error)
      return NextResponse.json({
        success: false,
        message: "Failed to save booking lead",
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      leadId: data?.[0]?.id,
      message: "Lead saved successfully",
    })
  } catch (err: any) {
    console.error("Server error:", err)
    return NextResponse.json({
      success: false,
      message: "Server error",
    }, { status: 500 })
  }
}
