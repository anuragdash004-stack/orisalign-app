import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    const otp = generateOTP();

    // 🔥 Save OTP
    await addDoc(collection(db, "otps"), {
      phone,
      otp,
      createdAt: Date.now(),
    });

    // 📲 Send SMS via Fast2SMS
    await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: process.env.FAST2SMS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "q",
        message: `Your OrisAlign OTP is ${otp}`,
        numbers: phone.replace("+91", ""),
      }),
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}