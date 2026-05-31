import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * POST /api/cashfree/webhook
 *
 * Server-to-server callback from Cashfree. Fires on every payment lifecycle
 * event (success, failed, user dropped, refund issued, etc.) regardless of
 * whether the user's browser ever lands on /payment/success.
 *
 * Setup:
 *   1. In Cashfree dashboard → Developers → Webhooks, add:
 *      https://orisalign.com/api/cashfree/webhook
 *   2. Subscribe to at least: PAYMENT_SUCCESS_WEBHOOK, PAYMENT_FAILED_WEBHOOK,
 *      PAYMENT_USER_DROPPED_WEBHOOK.
 *   3. Use the SAME secret as CASHFREE_SECRET_KEY (default behaviour).
 *
 * Signature scheme (HMAC-SHA256):
 *   signed_payload = x-webhook-timestamp + raw_request_body
 *   expected = base64( HMAC_SHA256(CASHFREE_SECRET_KEY, signed_payload) )
 *   header   = x-webhook-signature
 *
 * Always returns 200 unless the signature itself is bad — Cashfree retries on
 * non-2xx, and we don't want retry storms for our own bugs. We log everything.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface CashfreeWebhookPayload {
  type?: string;
  data?: {
    order?: {
      order_id?: string;
      order_amount?: number;
      order_currency?: string;
      order_tags?: Record<string, string> | null;
    };
    payment?: {
      cf_payment_id?: number | string;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
      payment_message?: string;
      payment_time?: string;
      payment_method?: unknown;
    };
    customer_details?: {
      customer_id?: string;
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
    };
  };
}

export async function POST(req: Request) {
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!secret) {
    console.error("[cashfree/webhook] CASHFREE_SECRET_KEY not configured");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const timestamp = req.headers.get("x-webhook-timestamp");
  const signature = req.headers.get("x-webhook-signature");
  const rawBody = await req.text();

  if (!timestamp || !signature) {
    console.warn("[cashfree/webhook] missing signature headers");
    return NextResponse.json({ error: "missing signature" }, { status: 401 });
  }

  // Verify signature
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest("base64");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  const valid =
    sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

  if (!valid) {
    console.warn("[cashfree/webhook] signature mismatch");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Parse + handle
  let payload: CashfreeWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as CashfreeWebhookPayload;
  } catch (e) {
    console.error("[cashfree/webhook] could not parse body", e);
    return NextResponse.json({ ok: true }); // 200 so Cashfree doesn't retry malformed
  }

  try {
    await handleEvent(payload);
  } catch (e) {
    console.error("[cashfree/webhook] handler error", e);
    // Still return 200 — bug in our code shouldn't cause a retry storm.
  }

  return NextResponse.json({ ok: true });
}

async function handleEvent(payload: CashfreeWebhookPayload) {
  const eventType = payload.type;
  const orderId = payload.data?.order?.order_id;
  const appointmentId = payload.data?.customer_details?.customer_id;
  const paymentStatus = payload.data?.payment?.payment_status;
  const paymentAmount = Math.round(
    Number(payload.data?.payment?.payment_amount) || 0,
  );
  const paymentTime = payload.data?.payment?.payment_time;

  if (!orderId || !appointmentId) {
    console.warn(
      "[cashfree/webhook] missing orderId or appointmentId in payload",
      { eventType, orderId, appointmentId },
    );
    return;
  }

  // Only mutate on definitive success. Failed/dropped events we just log;
  // the verify route surfaces those to the user via the return URL.
  if (eventType !== "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus !== "SUCCESS") {
    console.info("[cashfree/webhook] non-success event", {
      eventType,
      paymentStatus,
      orderId,
    });
    return;
  }

  const { data: appt, error } = await supabase
    .from("appointments_booking")
    .select("payment_data")
    .eq("id", appointmentId)
    .single();

  if (error || !appt) {
    console.error("[cashfree/webhook] appointment not found", appointmentId);
    return;
  }

  const pd = (appt.payment_data as Record<string, unknown>) || {};

  // Idempotency: if we already recorded this exact Cashfree order, skip.
  if (pd.cashfree_order_id === orderId && pd.cashfree_status === "PAID") {
    return;
  }

  const currentPending = Number(pd.pending_amount) || 0;
  const newPaymentData = {
    ...pd,
    cashfree_order_id: orderId,
    cashfree_status: "PAID",
    cashfree_paid_amount: paymentAmount,
    cashfree_paid_at: paymentTime || new Date().toISOString(),
    cashfree_source: "webhook",
    pending_amount: Math.max(0, currentPending - paymentAmount),
  };

  const { error: updateError } = await supabase
    .from("appointments_booking")
    .update({ payment_data: newPaymentData })
    .eq("id", appointmentId);

  if (updateError) {
    console.error(
      "[cashfree/webhook] supabase update failed",
      updateError,
      appointmentId,
    );
  }
}
