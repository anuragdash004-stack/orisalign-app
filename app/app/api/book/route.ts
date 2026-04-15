import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, email, doctor, date, time } = body;

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("appointments")
      .insert([
        {
          name,
          phone,
          email,
          doctor,
          date,
          time,
          status: "pending",
        },
      ]);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}