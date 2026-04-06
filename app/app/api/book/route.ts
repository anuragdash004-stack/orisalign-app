import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  const { phone, date, time } = body;

  // 🔥 WHATSAPP MESSAGE (Twilio example)
  await fetch("https://api.twilio.com/2010-04-01/Accounts/YOUR_SID/Messages.json", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from("YOUR_SID:YOUR_AUTH_TOKEN").toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: "whatsapp:+14155238886",
      To: "whatsapp:" + phone,
      Body: `✅ Appointment Confirmed\nDate: ${date}\nTime: ${time}\n\n- OrisAlign`,
    }),
  });

  return NextResponse.json({ success: true });
}