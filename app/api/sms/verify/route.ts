import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json({ success: false });
    }

    // ✅ Query Firestore (ADMIN WAY)
    const snapshot = await db
      .collection("otps")
      .where("phone", "==", phone)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ success: false, message: "No OTP found" });
    }

    let isValid = false;

    snapshot.forEach((doc) => {
      const data = doc.data();

      if (data.otp === otp && Date.now() - data.createdAt < 5 * 60 * 1000) {
        isValid = true;
        doc.ref.delete(); // ✅ delete after use
      }
    });

    return NextResponse.json({ success: isValid });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}