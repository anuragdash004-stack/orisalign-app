/**
 * Unified notification dispatcher — email (Resend) and WhatsApp (AiSensy),
 * fired independently and in parallel.
 *
 * Channel selection is per-patient, not all-or-nothing: if a patient has an
 * email, they get an email; if they have a WhatsApp number, they get a
 * WhatsApp message. Either, both, or neither can fire depending on what data
 * exists on the patient record. Neither channel's failure affects the other
 * — see lib/notifications/aisensy.ts and resend.ts, both of which return a
 * result object instead of throwing.
 */
import { sendWhatsApp, type AiSensyMedia, type AiSensyResult } from "./aisensy";
import { sendEmail, type ResendResult } from "./resend";

export type Patient = {
  name: string;
  email?: string | null;
  whatsapp?: string | null;
};

export type NotifyResult = {
  email: ResendResult | { success: false; error: "skipped: no email on record" };
  whatsapp: AiSensyResult | { success: false; error: "skipped: no whatsapp number on record" };
};

/**
 * AiSensy campaign names. Edit these to match whatever you actually name the
 * templates when you create them in the AiSensy dashboard — the string here
 * must match the campaign name there exactly, or sends will fail.
 */
export const AISENSY_CAMPAIGNS = {
  /** Authentication template. */
  otp: "orisalign_otp",
  /** Utility template. */
  bookingConfirmation: "orisalign_booking_confirmation",
  /** Marketing template. */
  offerBroadcast: "oris_offer",
} as const;

async function dispatch(
  patient: Patient,
  email: { subject: string; html: string } | null,
  whatsapp: { campaignName: string; templateParams: string[]; media?: AiSensyMedia } | null,
): Promise<NotifyResult> {
  const [emailResult, whatsappResult] = await Promise.all([
    patient.email && email
      ? sendEmail({ to: patient.email, subject: email.subject, html: email.html })
      : Promise.resolve({ success: false, error: "skipped: no email on record" } as const),
    patient.whatsapp && whatsapp
      ? sendWhatsApp({
          campaignName: whatsapp.campaignName,
          destination: patient.whatsapp,
          userName: patient.name,
          templateParams: whatsapp.templateParams,
          media: whatsapp.media,
        })
      : Promise.resolve({ success: false, error: "skipped: no whatsapp number on record" } as const),
  ]);

  return { email: emailResult, whatsapp: whatsappResult };
}

function wrapEmail(title: string, bodyHtml: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#faf7f2;padding:20px;border-radius:12px;">
      <div style="background:#1B2A4A;padding:20px;border-radius:8px;text-align:center;margin-bottom:16px;">
        <h1 style="color:#C9A84C;margin:0;font-size:20px;">${title}</h1>
      </div>
      ${bodyHtml}
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">OrisAlign · Bhubaneswar, Odisha</p>
    </div>
  `;
}

// ── Authentication ───────────────────────────────────────────────────────

export async function notifyOtp(patient: Patient, otpCode: string): Promise<NotifyResult> {
  const email = {
    subject: "Your OrisAlign OTP",
    html: wrapEmail(
      "Verify Your Request",
      `
        <p style="color:#374151;font-size:15px;">Dear ${patient.name},</p>
        <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111827;">${otpCode}</span>
        </div>
        <p style="color:#6b7280;font-size:13px;">This OTP expires in 10 minutes. Do not share it with anyone.</p>
      `,
    ),
  };

  // Single variable: the OTP code. Matches a typical WhatsApp authentication
  // template body of the shape "Your OTP is {{1}}."
  const whatsapp = {
    campaignName: AISENSY_CAMPAIGNS.otp,
    templateParams: [otpCode],
  };

  return dispatch(patient, email, whatsapp);
}

// ── Utility ───────────────────────────────────────────────────────────────

export async function notifyBookingConfirmation(
  patient: Patient,
  bookingDate: string,
  bookingTime: string,
  location: string,
): Promise<NotifyResult> {
  const email = {
    subject: `Booking Confirmed — OrisAlign | ${bookingDate}`,
    html: wrapEmail(
      "Booking Confirmed!",
      `
        <p style="color:#374151;font-size:15px;">Dear ${patient.name},</p>
        <p style="color:#374151;font-size:14px;line-height:1.7;">
          Your appointment with OrisAlign has been confirmed.
        </p>
        <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;">
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#6b7280;width:100px;">Date</td><td style="padding:6px 0;font-weight:bold;color:#111;">${bookingDate}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;font-weight:bold;color:#111;">${bookingTime}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Location</td><td style="padding:6px 0;font-weight:bold;color:#111;">${location}</td></tr>
          </table>
          <p style="color:#6b7280;font-size:12px;margin:12px 0 0;">For privacy, the exact clinic address will be shared 24 hours before your appointment.</p>
        </div>
      `,
    ),
  };

  // Four variables in order: patient name, date, time, clinic — matches the
  // approved template body:
  // "Hi {{1}}, your appointment with OrisAlign is confirmed for {{2}} at
  // {{3}} in our {{4}} clinic. For privacy concern, clinic location will be
  // shared 24 hours prior to the appointment. We look forward to seeing you!"
  const whatsapp = {
    campaignName: AISENSY_CAMPAIGNS.bookingConfirmation,
    templateParams: [patient.name, bookingDate, bookingTime, location],
  };

  return dispatch(patient, email, whatsapp);
}

// ── Marketing ─────────────────────────────────────────────────────────────

export async function notifyOffer(
  patient: Patient,
  /**
   * Public https:// URL of the promo creative. The deal is written into the
   * image itself — this is the whole message on WhatsApp, no caption text.
   */
  offerImageUrl: string,
  /**
   * Optional — used only in the email version, as a line of text under the
   * image (some inboxes preview/strip images, so it's a text fallback there).
   * Never sent to WhatsApp: that template's body has zero variables, since
   * there's nothing left to fill in once the offer lives entirely in the
   * artwork.
   */
  offerText?: string,
): Promise<NotifyResult> {
  const email = {
    subject: "A Special Offer from OrisAlign",
    html: wrapEmail(
      "Just For You",
      `
        <p style="color:#374151;font-size:15px;">Dear ${patient.name},</p>
        <img src="${offerImageUrl}" alt="Offer" style="width:100%;border-radius:8px;margin:12px 0;" />
        ${offerText ? `<p style="color:#374151;font-size:14px;line-height:1.7;">${offerText}</p>` : ""}
      `,
    ),
  };

  // Zero body variables — the approved template's body is static text with
  // no {{n}} placeholders (everything is in the image). templateParams must
  // still be an array matching the template's variable count exactly, so
  // that's an empty array here, not omitted.
  //
  // The image itself doesn't take a numbered slot either way — it goes
  // through `media`, separate from templateParams.
  //
  // Marketing templates require the recipient to have opted in — see the
  // offer broadcast note in the route handler.
  const whatsapp = {
    campaignName: AISENSY_CAMPAIGNS.offerBroadcast,
    templateParams: [],
    media: { url: offerImageUrl, filename: "offer.jpg" },
  };

  return dispatch(patient, email, whatsapp);
}
