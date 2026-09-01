import { NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"
import { sendWhatsApp } from "@/lib/notifications/aisensy"

/**
 * POST /api/patient-login/request-otp
 *
 * Body: { identifier: string }  — a phone number, email, or the 8-character
 * Patient ID shown throughout the app (e.g. "6D82AF1E").
 *
 * Looks up the matching appointment, sends a WhatsApp OTP to the phone on
 * file (never to a phone the caller supplied — always the one on record),
 * and returns a stateless HMAC token the client must echo back to
 * /api/patient-login/verify-otp. Same signing pattern as
 * app/api/send-booking-otp — no OTP is ever stored server-side.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function hmac(data: string) {
  return crypto.createHmac("sha256", process.env.RESEND_API_KEY!).update(data).digest("hex")
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : "••••"
}

export async function POST(req: Request) {
  try {
    const { identifier } = (await req.json()) as { identifier?: string }
    const raw = (identifier || "").trim()
    if (!raw) {
      return NextResponse.json({ error: "Enter your phone number, email, or Patient ID." }, { status: 400 })
    }

    let row: { id: string; name: string | null; phone: string | null; journey_steps: Record<string, unknown> | null } | null = null

    if (raw.includes("@")) {
      // Email lookup.
      const { data } = await supabase
        .from("appointments_booking")
        .select("id, name, phone, journey_steps")
        .ilike("email", raw)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      row = data
    } else if (/^[0-9a-fA-F]{8}$/.test(raw)) {
      // Patient ID — the first 8 hex characters of the appointment's UUID,
      // shown everywhere in the app as "Patient ID: 6D82AF1E". A uuid's text
      // form starts with those same 8 hex characters, and Postgres compares
      // uuid values byte-for-byte in the same order as their hex text, so
      // bounding by the next hex value correctly captures every uuid that
      // starts with this prefix without needing a text cast.
      const lower = raw.toLowerCase()
      const nextHex = (parseInt(lower, 16) + 1).toString(16).padStart(8, "0")
      const { data } = await supabase
        .from("appointments_booking")
        .select("id, name, phone, journey_steps")
        .gte("id", `${lower}-0000-0000-0000-000000000000`)
        .lt("id", `${nextHex}-0000-0000-0000-000000000000`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      row = data
    } else {
      // Phone — match on the last 10 digits so formatting differences
      // ("+91 91780 72800" vs "9178072800") don't matter.
      const digits = raw.replace(/\D/g, "")
      const last10 = digits.slice(-10)
      if (last10.length < 10) {
        return NextResponse.json({ error: "Enter a valid phone number, email, or Patient ID." }, { status: 400 })
      }
      const { data } = await supabase
        .from("appointments_booking")
        .select("id, name, phone, journey_steps")
        .ilike("phone", `%${last10}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      row = data
    }

    if (!row || !row.phone) {
      return NextResponse.json(
        { error: "We couldn't find an account with those details. Please check and try again, or contact us." },
        { status: 404 }
      )
    }

    // The demo case (journey_steps.demo_account) is handed to people outside
    // the clinic to explore — its phone number isn't real, so there's no
    // WhatsApp to deliver a code to. Rather than a global OTP bypass (which
    // would weaken every real patient's login), only THIS flagged account
    // accepts a fixed code instead of a delivered one.
    const isDemo = !!row.journey_steps?.demo_account
    const otp = isDemo ? "123456" : Math.floor(100000 + Math.random() * 900000).toString()
    const token = hmac(`patient-login:${row.id}:${otp}`)

    if (!isDemo) {
      const waResult = await sendWhatsApp({
        campaignName: "orisalign_otp",
        destination: row.phone,
        userName: row.name || "Patient",
        templateParams: [otp],
      })

      if (!waResult.success) {
        console.error("[patient-login/request-otp] WhatsApp send failed", waResult.error)
        return NextResponse.json({ error: "Couldn't send the OTP right now. Please try again in a moment." }, { status: 502 })
      }
    }

    return NextResponse.json({
      token,
      appointmentId: row.id,
      phoneHint: isDemo ? "demo" : maskPhone(row.phone),
      demo: isDemo,
    })
  } catch (err) {
    console.error("[patient-login/request-otp]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
