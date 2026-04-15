import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { name, phone, email, doctor, date, time } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
    console.error("API error:", err);
    return NextResponse.json(
      { error: "Server crashed" },
      { status: 500 }
    );
  }
}