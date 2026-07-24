import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEntry } from "@/lib/auditLog";
import { recordPaymentReceived } from "@/lib/paymentHelper";

/**
 * GET /api/cashfree/verify?order_id=<id>
 *
 * Hit by the success page after Cashfree redirects back. Calls Cashfree's
 * /orders/{order_id} endpoint to fetch the authoritative status, and (if PAID)
 * updates the appointment's payment_data with the new totals.
 *
 * Returns: { status, orderId, amount, appointmentId, alreadyApplied? }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CF_ENV = (process.env.CASHFREE_ENV || "sandbox").toLowerCase();
const CF_BASE =
  CF_ENV === "production"
    ? "https://api.cashfree.com/pg/orders"
    : "https://sandbox.cashfree.com/pg/orders";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: Request) {
  if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payment gateway not configured" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("order_id");
  if (!orderId) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }

  const cfRes = await fetch(`${CF_BASE}/${encodeURIComponent(orderId)}`, {
    headers: {
      "x-client-id": process.env.CASHFREE_APP_ID!,
      "x-client-secret": process.env.CASHFREE_SECRET_KEY!,
      "x-api-version": "2023-08-01",
    },
    cache: "no-store",
  });
  const cfData = await cfRes.json();
  if (!cfRes.ok) {
    return NextResponse.json(
      { error: cfData.message || "Verify failed" },
      { status: 502 },
    );
  }

  const status: string = cfData.order_status;
  const appointmentId: string | undefined = cfData.customer_details?.customer_id;
  const orderAmount = Math.round(Number(cfData.order_amount) || 0);
  let alreadyApplied = false;

  if (status === "PAID" && appointmentId) {
    const { data: appt } = await supabase
      .from("appointments_booking")
      .select("payment_data")
      .eq("id", appointmentId)
      .single();

    const pd =
      (appt?.payment_data as Record<string, unknown> | undefined) || {};

    // Idempotency: if we've already recorded this exact order, skip the
    // update. Checked on order id alone — this and the webhook can both
    // fire for the same order (one via the customer's browser redirect,
    // one server-to-server), and both mustn't slip past and double-record
    // the same payment against amount_paid.
    if (pd.cashfree_order_id === orderId) {
      alreadyApplied = true;
    } else {
      const currentPending = Number(pd.pending_amount) || 0;
      const newPaymentData = {
        ...pd,
        cashfree_order_id: orderId,
        cashfree_status: status,
        cashfree_paid_amount: orderAmount,
        cashfree_paid_at: new Date().toISOString(),
        cashfree_source: "verify_redirect",
        pending_amount: Math.max(0, currentPending - orderAmount),
      };
      await supabase
        .from("appointments_booking")
        .update({ payment_data: newPaymentData })
        .eq("id", appointmentId);

      await logAuditEntry({
        appointmentId,
        actorEmail: "cashfree",
        actorRole: "payment_gateway",
        action: "Payment Received",
        entity: "payment_data",
        newData: newPaymentData,
        oldData: pd,
      });

      // Same amount_paid/amount_to_pay/payment_status update the webhook
      // does — needed here too since the webhook may never reach this app
      // (not configured in the Cashfree dashboard, or blocked), leaving this
      // redirect-triggered verify as the only path that actually runs.
      try {
        const result = await recordPaymentReceived({
          supabase,
          appointmentId,
          amountPaid: orderAmount,
          transactionId: cfData.cf_order_id || orderId,
          paymentMethod: "Cashfree",
          notes: "Payment via redirect verification",
          actorEmail: "cashfree_verify",
          actorRole: "payment_gateway",
        });
        if (!result.success) {
          console.warn("[cashfree/verify] failed to update payment status", result.error);
        }
      } catch (e) {
        console.error("[cashfree/verify] payment status update error", e);
      }
    }
  }

  return NextResponse.json({
    status,
    orderId,
    amount: orderAmount,
    appointmentId,
    alreadyApplied,
  });
}
