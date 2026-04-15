// FORCE Node runtime (important for env variables)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    // 1️⃣ Parse request body
    const body = await req.json();

    const { name, phone, email, doctor, date, time } = body;

    // 2️⃣ Basic validation
    if (!name || !phone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 3️⃣ Get ENV variables (CORRECT WAY)
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 4️⃣ DEBUG (this will appear in Vercel logs)
    console.log("ENV CHECK:", {
      urlExists: !!supabaseUrl,
      keyExists: !!supabaseKey,
    });

    // 5️⃣ Stop if ENV missing
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 6️⃣ Create Supabase client (SERVER SIDE ONLY)
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 7️⃣ Insert into DB
    const { data, error } = await supabase
      .from("appointments_booking")
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
      .select();

    // 8️⃣ Handle DB error
    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // 9️⃣ Success response
    return NextResponse.json({
      success: true,
      data,
    });

  } catch (err: any) {
    console.error("API crash:", err);

    return NextResponse.json(
      { error: "Server crashed" },
      { status: 500 }
    );
  }
}