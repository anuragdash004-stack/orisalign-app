import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json({ success: false });
    }

    // 👉 TEMP MOCK SUCCESS (for testing flow)
    return NextResponse.json({
      success: true,
      message: "OTP verified (mock)",
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}