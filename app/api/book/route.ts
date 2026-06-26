import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logAuditEntry, getClientInfo } from "@/lib/auditLog"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, phone, email, age, sex, address, date, time } = body
    const { ip, userAgent } = getClientInfo(req)
    const bookingTimestamp = new Date().toISOString()

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

    // ✅ INSERT NEW BOOKING with timestamp
    // Every booking — website, manual, or cold — enters as a lead first, so
    // it's visible and actionable in the Lead Tracker. It only reaches the
    // Appointment page once a counsellor confirms it ("Confirm Lead →
    // Booked"), and only reaches Dentist/Orthodontist/Patients once an admin
    // confirms the appointment itself.
    const { data: insertedData, error: insertError } = await supabase
      .from("appointments_booking")
      .insert([
        {
          name,
          phone,
          email: email || null,
          age,
          sex,
          address,
          date,
          time,
          status: "lead",
          lead_stage: "fresh",
          lead_source: "website",
          created_at: bookingTimestamp,
        },
      ])
      .select("id")

    if (insertError) {
      console.error(insertError)
      return NextResponse.json({
        success: false,
        message: "Failed to save booking",
      })
    }

    const appointmentId = insertedData?.[0]?.id

    // 📋 LOG TO AUDIT TRAIL
    if (appointmentId) {
      await logAuditEntry({
        appointmentId,
        actorEmail: email || "customer",
        actorRole: "customer",
        action: "Booking Created",
        entity: "appointment",
        newData: {
          name,
          phone,
          email,
          age,
          sex,
          address,
          date,
          time,
          status: "lead",
          lead_stage: "fresh",
          lead_source: "website",
          booking_timestamp: bookingTimestamp,
        },
        ipAddress: ip,
        userAgent,
      })
    }

    return NextResponse.json({ success: true, appointmentId })
  } catch (err) {
    console.error(err)
    return NextResponse.json({
      success: false,
      message: "Server error",
    })
  }
}