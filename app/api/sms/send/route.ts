import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

// generate 6 digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ success: false, message: "Phone required" });
    }

    const otp = generateOTP();

    // 🔥 Save OTP to Firestore
    await addDoc(collection(db, "otps"), {
      phone,
      otp,
      createdAt: Date.now(), // important for expiry
    });

    console.log("OTP:", otp); // for testing (remove later)

    return NextResponse.json({
      success: true,
      message: "OTP sent",
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}