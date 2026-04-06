import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { phone, date, time } = await req.json();

  await fetch("https://api.twilio.com/2010-04-01/Accounts/YOUR_SID/Messages.json", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from("YOUR_SID:YOUR_AUTH_TOKEN").toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: "+1234567890",
      To: phone,
      Body: `OrisAlign Appointment Confirmed\nDate: ${date}\nTime: ${time}\n\nPay ₹99 at clinic (Scan QR)`,
    }),
  });

  return NextResponse.json({ success: true });
}