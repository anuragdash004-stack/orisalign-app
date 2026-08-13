/**
 * Thin client for AiSensy's WhatsApp campaign API.
 *
 * Never throws — every failure mode (missing env var, bad phone number,
 * network error, non-2xx response) resolves to { success: false, error }
 * so callers (see notify.ts) can still try the other channel.
 */

const AISENSY_API_URL = "https://backend.aisensy.com/campaign/t1/api/v2";

export type AiSensyResult =
  | { success: true }
  | { success: false; error: string };

export type AiSensyMedia = {
  /** Must be publicly accessible — AiSensy rejects the request otherwise. */
  url: string;
  filename?: string;
};

export type AiSensyParams = {
  campaignName: string;
  /** Raw phone number as stored in the DB — this function normalizes it. */
  destination: string;
  userName: string;
  /**
   * Ordered values that fill the template's body {{1}}, {{2}}, … placeholders.
   * An image/video/document header does NOT consume a slot in this array —
   * it's supplied separately via `media`. Length must match exactly what the
   * approved template expects, or AiSensy rejects the send.
   */
  templateParams: string[];
  /** Only for templates whose header is an image, video, or document. */
  media?: AiSensyMedia;
  /** Defaults to "orisalign-app" if omitted. */
  source?: string;
};

/**
 * Normalizes an Indian phone number to AiSensy's expected "destination"
 * format: country code + number, digits only, no "+".
 *
 * Real data in appointments_booking.phone is inconsistent — some rows are a
 * bare 10-digit number ("8260155860"), others are "+91 91780 72800" with
 * spaces. This strips everything down to digits and adds the 91 prefix only
 * when it isn't already there, so both shapes land on the same result:
 * "918260155860".
 */
export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;

  // Unrecognized shape (landline, other country, garbage input) — refuse
  // rather than guess, so a malformed number fails loudly instead of
  // silently texting the wrong person.
  return null;
}

export async function sendWhatsApp(params: AiSensyParams): Promise<AiSensyResult> {
  const apiKey = process.env.AISENSY_API_KEY;
  if (!apiKey) {
    return { success: false, error: "AISENSY_API_KEY is not set" };
  }

  const destination = normalizeIndianPhone(params.destination);
  if (!destination) {
    return { success: false, error: `Could not normalize phone number: "${params.destination}"` };
  }

  if (params.media && !/^https:\/\//.test(params.media.url)) {
    return { success: false, error: `media.url must be a public https:// URL, got: "${params.media.url}"` };
  }

  try {
    const res = await fetch(AISENSY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        campaignName: params.campaignName,
        destination,
        userName: params.userName,
        source: params.source ?? "orisalign-app",
        templateParams: params.templateParams,
        ...(params.media ? { media: params.media } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `AiSensy ${res.status}: ${text || res.statusText}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown AiSensy error" };
  }
}
