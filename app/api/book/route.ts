import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type BookingPayload = {
  name?: string;
  phone?: string;
  email?: string;
  doctor?: string;
  date?: string;
  time?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BookingPayload;

    const { name, phone, email, doctor, date, time } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase API environment variables are missing");
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
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
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: "Server crashed" },
      { status: 500 }
    );
  }
}
