import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    // appointments_booking.online_report_id references this row — once a
    // lead books a real appointment it stays linked for traceability, but
    // that FK blocks deleting the report outright. Unlink rather than
    // cascade-delete: the appointment (and any payment/journey data on it)
    // is real patient data and must survive the report being removed.
    const { error: unlinkError } = await supabase
      .from("appointments_booking")
      .update({ online_report_id: null })
      .eq("online_report_id", id)

    if (unlinkError) {
      return NextResponse.json({ error: unlinkError.message }, { status: 500 })
    }

    const { error: deleteError } = await supabase
      .from("online_reports")
      .delete()
      .eq("id", id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
