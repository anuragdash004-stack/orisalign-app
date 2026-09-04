import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A patient may have the app on more than one device (or reinstall and get a
// new token) — capped so a frequently-reinstalled device doesn't grow this
// list forever. Most-recently-used token stays first.
const MAX_TOKENS_PER_PATIENT = 5;

/**
 * POST /api/push/register-token
 *
 * Saves this device's FCM token against the patient's appointment record, so
 * lib/pushSend.ts has somewhere to deliver a journey-step notification.
 * Trusts appointmentId directly, same as every other patient-facing endpoint
 * in this app (see app/api/notify-batch-received for the same pattern).
 *
 * Body: { appointmentId: string, token: string }
 */
export async function POST(req: Request) {
  try {
    const { appointmentId, token, action } = await req.json();
    if (!appointmentId || !token) {
      return NextResponse.json({ error: "appointmentId and token required" }, { status: 400 });
    }

    const { data: appt, error: fetchErr } = await supabase
      .from("appointments_booking")
      .select("push_tokens")
      .eq("id", appointmentId)
      .single();

    if (fetchErr || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const existing: string[] = Array.isArray(appt.push_tokens) ? appt.push_tokens : [];
    // "remove" is how a patient turns notifications off for this device: the
    // OS grant stays, but nothing is sent here any more.
    const updated =
      action === "remove"
        ? existing.filter((t) => t !== token)
        : [token, ...existing.filter((t) => t !== token)].slice(0, MAX_TOKENS_PER_PATIENT);

    const { error: updateErr } = await supabase
      .from("appointments_booking")
      .update({ push_tokens: updated })
      .eq("id", appointmentId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
