import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    // ✅ Parse request body
    const body = await req.json();

    const { name, phone, email, doctor, date, time } = body;

    // ✅ Basic validation
    if (!name || !phone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Debug: Check ENV variables
    console.log("ENV CHECK:", {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY ? "present" : "missing",
    });

    // ❌ Stop execution if ENV missing
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ Supabase ENV missing");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // ✅ Create Supabase client (SERVER ONLY)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ✅ Insert into database
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
      .select(); // optional: returns inserted row

    // ❌ Handle Supabase error
    if (error) {
      console.error("❌ Supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ✅ Success
    return NextResponse.json({
      success: true,
      data,
    });

  } catch (err: any) {
    console.error("❌ API crash:", err);

    return NextResponse.json(
      { error: "Server crashed" },
      { status: 500 }
    );
  }
}