import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEntry } from "@/lib/auditLog";
import { recordPaymentReceived } from "@/lib/paymentHelper";

/**
 * GET /api/cron/reconcile-payments
 *
 * Safety net for payments that never got confirmed by either the Cashfree
 * webhook (server-to-server) or the customer's browser redirect back to
 * /checkout/success (dropped connection, closed app mid-UPI-app-switch,
 * webhook not registered in the Cashfree dashboard, etc.) — the two normal
 * confirmation paths. Without this, a payment that actually succeeded on
 * Cashfree's side but whose confirmation never reached us left zero trace
 * and had to be found and recorded manually.
 *
 * /api/cashfree/order now stamps payment_data.pending_cashfree_order_id the
 * moment an order is created (before the customer ever reaches checkout) —
 * this job looks up every appointment with a pending order from the last 3
 * days, asks Cashfree directly for its current status, and applies it via
 * the same trusted recordPaymentReceived() path the webhook/verify use if
 * it turns out to be PAID.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CF_ENV = (process.env.CASHFREE_ENV || "sandbox").trim().toLowerCase();
const CF_BASE =
  CF_ENV === "production"
    ? "https://api.cashfree.com/pg/orders"
    : "https://sandbox.cashfree.com/pg/orders";
const CF_APP_ID = (process.env.CASHFREE_APP_ID || "").trim();
const CF_SECRET = (process.env.CASHFREE_SECRET_KEY || "").trim();

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function GET() {
  if (!CF_APP_ID || !CF_SECRET) {
    return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
  }

  const { data: rows, error } = await supabase
    .from("appointments_booking")
    .select("id, name, payment_data")
    .not("payment_data->>pending_cashfree_order_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  for (const row of rows || []) {
    const pd = (row.payment_data as Record<string, unknown>) || {};
    const orderId = pd.pending_cashfree_order_id as string;
    const createdAt = pd.pending_cashfree_order_created_at as string | undefined;

    // Already resolved by the webhook/verify path in the meantime — clear
    // the pending marker so this row stops being scanned every run.
    if (pd.cashfree_order_id === orderId) {
      await clearPending(row.id, pd);
      continue;
    }

    // Cashfree orders expire; don't keep polling ones too old to still be payable.
    if (createdAt && Date.now() - new Date(createdAt).getTime() > THREE_DAYS_MS) {
      await clearPending(row.id, pd);
      results.push({ appointmentId: row.id, orderId, skipped: "expired" });
      continue;
    }

    try {
      const cfRes = await fetch(`${CF_BASE}/${encodeURIComponent(orderId)}`, {
        headers: {
          "x-client-id": CF_APP_ID,
          "x-client-secret": CF_SECRET,
          "x-api-version": "2023-08-01",
        },
        cache: "no-store",
      });
      const cfData = await cfRes.json();
      if (!cfRes.ok) {
        results.push({ appointmentId: row.id, orderId, error: cfData.message || "lookup failed" });
        continue;
      }

      const status: string = cfData.order_status;
      if (status !== "PAID") {
        results.push({ appointmentId: row.id, orderId, status });
        continue; // still ACTIVE, or terminally failed/expired — leave for next run or manual review
      }

      const orderAmount = Math.round(Number(cfData.order_amount) || 0);
      const newPaymentData: Record<string, unknown> = {
        ...pd,
        cashfree_order_id: orderId,
        cashfree_status: "PAID",
        cashfree_paid_amount: orderAmount,
        cashfree_paid_at: new Date().toISOString(),
        cashfree_source: "reconcile_cron",
      };
      delete newPaymentData.pending_cashfree_order_id;
      delete newPaymentData.pending_cashfree_order_created_at;

      await supabase.from("appointments_booking").update({ payment_data: newPaymentData }).eq("id", row.id);
      await logAuditEntry({
        appointmentId: row.id,
        actorEmail: "reconcile_cron",
        actorRole: "payment_gateway",
        action: "Payment Received",
        entity: "payment_data",
        newData: newPaymentData,
        oldData: pd,
      });

      const result = await recordPaymentReceived({
        supabase,
        appointmentId: row.id,
        amountPaid: orderAmount,
        transactionId: orderId,
        paymentMethod: "Cashfree",
        notes: "Reconciled — webhook/redirect confirmation was missed",
        actorEmail: "reconcile_cron",
        actorRole: "payment_gateway",
      });

      results.push({ appointmentId: row.id, orderId, recorded: result.success, name: row.name });
    } catch (e) {
      results.push({ appointmentId: row.id, orderId, error: e instanceof Error ? e.message : "unknown error" });
    }
  }

  return NextResponse.json({ checked: (rows || []).length, results });
}

async function clearPending(appointmentId: string, pd: Record<string, unknown>) {
  const cleaned = { ...pd };
  delete cleaned.pending_cashfree_order_id;
  delete cleaned.pending_cashfree_order_created_at;
  await supabase.from("appointments_booking").update({ payment_data: cleaned }).eq("id", appointmentId);
}
