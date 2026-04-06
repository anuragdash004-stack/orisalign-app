import { NextResponse } from "next/server";
import { verifyOTP } from "@/lib/otpstore";

export async function POST(req: Request) {
  try {
    const { phone, otp } = await req.json();

    const isValid = verifyOTP(phone, otp);

    if (isValid) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}