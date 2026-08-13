import { NextResponse } from "next/server";
import {
  notifyBookingConfirmation,
  notifyOffer,
  notifyOtp,
  type Patient,
} from "@/lib/notifications/notify";

/**
 * Unified notification endpoint — POST { type, patient, data }.
 *
 * This is separate from the existing app/api/notify-booking,
 * app/api/notify-step and app/api/notify-set-followup routes, which stay as
 * they are. Nothing currently calls this route yet; see the booking-save
 * insertion point noted separately for where to wire in
 * type: "booking_confirmation" once you've confirmed it.
 */

type NotifyType = "otp" | "booking_confirmation" | "offer";

type RequestBody = {
  type?: NotifyType;
  patient?: Partial<Patient>;
  data?: Record<string, unknown>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, patient, data } = body;

  if (!type || !["otp", "booking_confirmation", "offer"].includes(type)) {
    return NextResponse.json(
      { success: false, error: 'type must be one of "otp", "booking_confirmation", "offer"' },
      { status: 400 },
    );
  }

  if (!patient || !isNonEmptyString(patient.name)) {
    return NextResponse.json(
      { success: false, error: "patient.name is required" },
      { status: 400 },
    );
  }

  const hasEmail = isNonEmptyString(patient.email);
  const hasWhatsapp = isNonEmptyString(patient.whatsapp);
  if (!hasEmail && !hasWhatsapp) {
    return NextResponse.json(
      { success: false, error: "patient must have at least an email or a whatsapp number" },
      { status: 400 },
    );
  }

  const normalizedPatient: Patient = {
    name: patient.name,
    email: hasEmail ? patient.email : null,
    whatsapp: hasWhatsapp ? patient.whatsapp : null,
  };

  try {
    switch (type) {
      case "otp": {
        const otpCode = data?.otpCode;
        if (!isNonEmptyString(otpCode)) {
          return NextResponse.json(
            { success: false, error: "data.otpCode is required for type=otp" },
            { status: 400 },
          );
        }
        const result = await notifyOtp(normalizedPatient, otpCode);
        return NextResponse.json({ success: true, result });
      }

      case "booking_confirmation": {
        const bookingDate = data?.bookingDate;
        const bookingTime = data?.bookingTime;
        const location = data?.location;
        if (
          !isNonEmptyString(bookingDate) ||
          !isNonEmptyString(bookingTime) ||
          !isNonEmptyString(location)
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "data.bookingDate, data.bookingTime and data.location are required for type=booking_confirmation",
            },
            { status: 400 },
          );
        }
        const result = await notifyBookingConfirmation(
          normalizedPatient,
          bookingDate,
          bookingTime,
          location,
        );
        return NextResponse.json({ success: true, result });
      }

      case "offer": {
        const offerImageUrl = data?.offerImageUrl;
        if (!isNonEmptyString(offerImageUrl) || !/^https:\/\//.test(offerImageUrl)) {
          return NextResponse.json(
            { success: false, error: "data.offerImageUrl is required and must be a public https:// URL" },
            { status: 400 },
          );
        }

        // Optional — see the comment on notifyOffer's offerText param.
        const offerText = data?.offerText;
        if (offerText !== undefined && !isNonEmptyString(offerText)) {
          return NextResponse.json(
            { success: false, error: "data.offerText, if given, must be a non-empty string" },
            { status: 400 },
          );
        }

        const result = await notifyOffer(
          normalizedPatient,
          offerImageUrl,
          offerText as string | undefined,
        );
        return NextResponse.json({ success: true, result });
      }
    }
  } catch (err) {
    console.error("[api/notify] unexpected error", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
