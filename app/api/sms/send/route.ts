import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ success: false });
    }

    // 👉 TEMP TEST RESPONSE (to confirm API works on Vercel)
    return NextResponse.json({
      success: true,
      message: "OTP sent (mock)",
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}