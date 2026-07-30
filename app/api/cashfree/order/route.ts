import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAmountToCollect, PaymentType } from "@/lib/paymentHelper";

/**
 * POST /api/cashfree/order
 *
 * Body: { appointmentId: string }
 *
 * Creates a Cashfree Payment Gateway order using the pending_amount stored on
 * the appointment (never trusts the client-passed amount). Returns the
 * payment_session_id that the front-end SDK needs to open the checkout.
 *
 * Env vars required:
 *   - CASHFREE_APP_ID
 *   - CASHFREE_SECRET_KEY
 *   - CASHFREE_ENV          ("sandbox" or "production", default "sandbox")
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

export const runtime = "nodejs";

const CF_ENV = (process.env.CASHFREE_ENV || "sandbox").trim().toLowerCase();
const CF_BASE =
  CF_ENV === "production"
    ? "https://api.cashfree.com/pg/orders"
    : "https://sandbox.cashfree.com/pg/orders";

// Trim env vars defensively — copy-paste from dashboards often leaves
// trailing whitespace that quietly breaks HMAC / header auth.
const CF_APP_ID = (process.env.CASHFREE_APP_ID || "").trim();
const CF_SECRET = (process.env.CASHFREE_SECRET_KEY || "").trim();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface OrderRequest {
  appointmentId?: string;
}

export async function POST(req: Request) {
  try {
    if (!CF_APP_ID || !CF_SECRET) {
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as OrderRequest;
    const appointmentId = body.appointmentId?.trim();
    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId required" },
        { status: 400 },
      );
    }

    // Pull the appointment to derive the trusted amount + customer details.
    const { data: appt, error } = await supabase
      .from("appointments_booking")
      .select("id, name, phone, payment_data, payment_type_to_collect, payment_custom_amount")
      .eq("id", appointmentId)
      .single();

    if (error || !appt) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
    }

    // payment_custom_amount lives as its own column on the row (set by
    // /api/set-payment-type), not inside payment_data — merge it in so
    // getAmountToCollect can see it for the "others" payment type.
    const pd = {
      ...((appt.payment_data as Record<string, unknown>) || {}),
      payment_custom_amount: appt.payment_custom_amount,
    };
    const paymentType = (appt.payment_type_to_collect || "down_payment") as PaymentType;

    // Use the paymentHelper to get the correct amount based on payment type
    const amountInPaise = getAmountToCollect(pd, paymentType);
    const amount = Math.round(amountInPaise / 100); // Convert back to rupees for validation

    if (amount <= 0) {
      return NextResponse.json(
        { error: `No ${paymentType.replace("_", " ")} available on this appointment` },
        { status: 400 },
      );
    }

    const orderId = `OA-${String(appt.id).substring(0, 8)}-${Date.now()}`;

    // Derive the return URL from the inbound request so it works in dev
    // (localhost), preview deploys, and production without extra config.
    const origin =
      req.headers.get("origin") ||
      `https://${req.headers.get("host") || "orisalign.com"}`;
    const returnUrl = `${origin}/checkout/success?order_id={order_id}`;

    // Phone must be a 10-digit Indian mobile for Cashfree; strip non-digits.
    const phone =
      (appt.phone || "").toString().replace(/\D/g, "").slice(-10) || "9999999999";

    const cfRes = await fetch(CF_BASE, {
      method: "POST",
      headers: {
        "x-client-id": CF_APP_ID,
        "x-client-secret": CF_SECRET,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: String(appt.id),
          customer_name: appt.name || "OrisAlign Patient",
          customer_email: `patient+${String(appt.id).substring(0, 8)}@orisalign.com`,
          customer_phone: phone,
        },
        order_meta: { return_url: returnUrl },
        order_note: `OrisAlign aligner ${paymentType.replace("_", " ")} payment`,
      }),
    });

    const cfData = await cfRes.json();
    if (!cfRes.ok || !cfData.payment_session_id) {
      // Log enough to debug without leaking secrets.
      console.error("[cashfree/order] create failed", {
        env: CF_ENV,
        base: CF_BASE,
        status: cfRes.status,
        cfCode: cfData.code,
        cfType: cfData.type,
        cfMessage: cfData.message,
      });
      const isAuth =
        cfData.code === "authentication_error" ||
        cfData.type === "authentication_error" ||
        /auth/i.test(cfData.message || "");
      const hint = isAuth
        ? ` (env=${CF_ENV}; verify CASHFREE_ENV matches the key type and that App ID/Secret aren't swapped)`
        : "";
      return NextResponse.json(
        {
          error: (cfData.message || "Failed to create payment order") + hint,
          cashfree: {
            code: cfData.code,
            type: cfData.type,
            status: cfRes.status,
          },
          env: CF_ENV,
        },
        { status: 502 },
      );
    }

    // Record the attempt immediately — before the customer ever reaches
    // Cashfree's checkout, not just after. Previously nothing was written
    // until the webhook/redirect fired, so a payment that succeeded but
    // whose confirmation never reached us (dropped redirect, webhook not
    // configured, app closed mid-UPI-app-switch) left zero trace to
    // reconcile from — exactly what happened for at least one patient.
    // /api/cron/reconcile-payments polls Cashfree for any order still
    // "pending" here so a missed webhook/redirect doesn't require a manual
    // fix.
    const pdWithPending = {
      ...((appt.payment_data as Record<string, unknown>) || {}),
      pending_cashfree_order_id: orderId,
      pending_cashfree_order_created_at: new Date().toISOString(),
    };
    await supabase
      .from("appointments_booking")
      .update({ payment_data: pdWithPending })
      .eq("id", appointmentId)
      .then(({ error: pendingErr }) => {
        if (pendingErr) console.error("[cashfree/order] failed to record pending order", pendingErr);
      });

    return NextResponse.json({
      paymentSessionId: cfData.payment_session_id,
      orderId,
      mode: CF_ENV === "production" ? "production" : "sandbox",
    });
  } catch (e) {
    console.error("/api/cashfree/order error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
