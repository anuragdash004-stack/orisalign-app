import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { promises as dns } from "dns"
import { logAuditEntry, getClientInfo } from "@/lib/auditLog"
import { validateName, validatePhone, validateEmail } from "@/lib/validateContact"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function emailDomainIsReal(email: string): Promise<boolean> {
  const domain = email.split("@")[1]
  if (!domain) return false
  const notFound = (e: any) => e?.code === "ENOTFOUND" || e?.code === "ENODATA" || e?.code === "ESERVFAIL"
  try {
    const mx = await dns.resolveMx(domain)
    if (mx && mx.length > 0) return true
  } catch (e) {
    if (!notFound(e)) return true
  }
  try {
    const a = await dns.resolve(domain)
    return Array.isArray(a) && a.length > 0
  } catch (e) {
    if (notFound(e)) return false
    return true
  }
}

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

    // ✅ Reject fake names / phone numbers / emails
    const contactError = validateName(name) || validatePhone(phone) || (email ? validateEmail(email) : null)
    if (contactError) {
      return NextResponse.json({ success: false, message: contactError })
    }
    if (email && !(await emailDomainIsReal(email))) {
      return NextResponse.json({
        success: false,
        message: "Please enter a real email address — we couldn't verify this email provider.",
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
          status: "pending",
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
          status: "pending",
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