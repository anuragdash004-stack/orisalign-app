import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json({ success: false });
    }

    // 🔍 Find OTP in Firestore
    const q = query(collection(db, "otps"), where("phone", "==", phone));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ success: false, message: "No OTP found" });
    }

    let isValid = false;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      const isSameOTP = data.otp === otp;

      // ⏳ Check expiry (5 minutes)
      const isNotExpired = Date.now() - data.createdAt < 5 * 60 * 1000;

      if (isSameOTP && isNotExpired) {
        isValid = true;

        // 🔥 delete OTP after use
        await deleteDoc(doc(db, "otps", docSnap.id));
        break;
      }
    }

    return NextResponse.json({ success: isValid });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}