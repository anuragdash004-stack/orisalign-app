import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

const CF_ENV = (process.env.CASHFREE_ENV || "sandbox").toLowerCase();
const CF_BASE =
  CF_ENV === "production"
    ? "https://api.cashfree.com/pg/orders"
    : "https://sandbox.cashfree.com/pg/orders";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface OrderRequest {
  appointmentId?: string;
}

export async function POST(req: Request) {
  try {
    if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
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
      .select("id, name, phone, payment_data")
      .eq("id", appointmentId)
      .single();

    if (error || !appt) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
    }

    const pd = (appt.payment_data as Record<string, unknown>) || {};
    const amount = Math.round(Number(pd.pending_amount) || 0);
    if (amount <= 0) {
      return NextResponse.json(
        { error: "No pending amount on this appointment" },
        { status: 400 },
      );
    }

    const orderId = `OA-${String(appt.id).substring(0, 8)}-${Date.now()}`;

    // Derive the return URL from the inbound request so it works in dev
    // (localhost), preview deploys, and production without extra config.
    const origin =
      req.headers.get("origin") ||
      `https://${req.headers.get("host") || "orisalign.com"}`;
    const returnUrl = `${origin}/payment/success?order_id={order_id}`;

    // Phone must be a 10-digit Indian mobile for Cashfree; strip non-digits.
    const phone =
      (appt.phone || "").toString().replace(/\D/g, "").slice(-10) || "9999999999";

    const cfRes = await fetch(CF_BASE, {
      method: "POST",
      headers: {
        "x-client-id": process.env.CASHFREE_APP_ID!,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY!,
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
        order_note: "OrisAlign aligner payment",
      }),
    });

    const cfData = await cfRes.json();
    if (!cfRes.ok || !cfData.payment_session_id) {
      console.error("Cashfree order failed", cfData);
      return NextResponse.json(
        { error: cfData.message || "Failed to create payment order" },
        { status: 502 },
      );
    }

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
