import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const { name, age, date, time, phone } = await req.json();

    if (!name || !age || !date || !time || !phone) {
      return NextResponse.json({ success: false, message: "Missing fields" });
    }

    await addDoc(collection(db, "appointments"), {
      name,
      age,
      date,
      time,
      phone,
      createdAt: Date.now(),
      status: "booked",
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}