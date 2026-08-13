/**
 * Thin client for Resend's email API.
 *
 * Same contract as lib/notifications/aisensy.ts: never throws, always
 * resolves to a success/failure object so the WhatsApp channel isn't blocked
 * by an email failure (or vice versa) — see notify.ts.
 *
 * The rest of this codebase (lib/notifyStep.ts, app/api/notify-booking,
 * app/api/save-booking-lead) calls Resend directly with a hardcoded `from`
 * address per call site. This client is only used by the new unified
 * notify.ts dispatcher — it doesn't replace those existing call sites.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export type ResendResult =
  | { success: true }
  | { success: false; error: string };

export type ResendParams = {
  to: string;
  subject: string;
  html: string;
  /** Overrides RESEND_FROM_EMAIL for this one send, if given. */
  from?: string;
};

export async function sendEmail(params: ResendParams): Promise<ResendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY is not set" };
  }

  const from = params.from ?? process.env.RESEND_FROM_EMAIL;
  if (!from) {
    return { success: false, error: "RESEND_FROM_EMAIL is not set" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `Resend ${res.status}: ${text || res.statusText}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown Resend error" };
  }
}
