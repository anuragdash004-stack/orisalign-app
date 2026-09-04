import { createClient } from "@supabase/supabase-js";
import { sendPushToToken } from "./firebaseAdmin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sends a push notification to every device this patient has registered
// (see app/api/push/register-token). Best-effort by design — a missing
// Firebase env var, a patient who's never enabled notifications, or a send
// failure should never block the email/WhatsApp channels this rides
// alongside; see the try/catch around this call in lib/notifyStep.ts.
//
// Tokens Firebase reports as no-longer-registered (app uninstalled, device
// reset) are dropped from the patient's record so future sends don't keep
// retrying them.
export async function sendPushForStep(
  appointmentId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  const { data: appt } = await supabase
    .from("appointments_booking")
    .select("push_tokens")
    .eq("id", appointmentId)
    .single();

  const tokens: string[] = Array.isArray(appt?.push_tokens) ? appt.push_tokens : [];
  if (tokens.length === 0) return;

  const deadTokens: string[] = [];
  await Promise.all(
    tokens.map(async (token) => {
      try {
        await sendPushToToken(token, title, body, data);
      } catch (e: any) {
        if (e?.errorInfo?.code === "messaging/registration-token-not-registered") {
          deadTokens.push(token);
        }
      }
    })
  );

  if (deadTokens.length > 0) {
    const remaining = tokens.filter((t) => !deadTokens.includes(t));
    await supabase.from("appointments_booking").update({ push_tokens: remaining }).eq("id", appointmentId);
  }
}
