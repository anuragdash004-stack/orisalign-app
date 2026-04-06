import { NextResponse } from "next/server";
import { saveOTP } from "@/lib/otpstore";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ success: false });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP
    saveOTP(phone, otp);

    // Send SMS via Fast2SMS
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: process.env.FAST2SMS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "q",
        message: `Your OrisAlign OTP is ${otp}`,
        language: "english",
        flash: 0,
        numbers: phone,
      }),
    });

    const data = await response.json();

    console.log("SMS Response:", data);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}