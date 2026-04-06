import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json({ success: false });
    }

    // ✅ MOCK SUCCESS
    return NextResponse.json({
      success: true,
      message: "OTP verified (mock)",
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}