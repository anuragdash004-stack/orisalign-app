"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const NAVY = "#1B2A4A";
const GOLD = "#C9A84C";

interface VerifyResult {
  status?: string;
  orderId?: string;
  amount?: number;
  appointmentId?: string;
  alreadyApplied?: boolean;
  error?: string;
}

function SuccessInner() {
  const params = useSearchParams();
  const orderId = params.get("order_id");
  // Razorpay's redirect (see app/checkout/page.tsx openRazorpayModal) carries
  // ?id=<appointmentId>&payment_id=<razorpay_payment_id> instead of an
  // order_id — /api/verify-payment already verified + recorded that payment
  // server-side before redirecting here, so this just reads the trusted
  // amount back for display.
  const razorpayAppointmentId = params.get("id");
  const razorpayPaymentId = params.get("payment_id");

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (orderId) {
      fetch(`/api/cashfree/verify?order_id=${encodeURIComponent(orderId)}`)
        .then((r) => r.json())
        .then((data: VerifyResult) => setResult(data))
        .catch(() => setResult({ error: "Couldn't reach payment service." }))
        .finally(() => setLoading(false));
      return;
    }
    if (razorpayAppointmentId && razorpayPaymentId) {
      fetch(`/api/update-payment-status?appointmentId=${encodeURIComponent(razorpayAppointmentId)}`)
        .then((r) => r.json())
        .then((data) => {
          setResult({
            status: "PAID",
            orderId: razorpayPaymentId,
            amount: data?.amountPaid || 0,
            appointmentId: razorpayAppointmentId,
          });
        })
        .catch(() => setResult({ error: "Couldn't reach payment service." }))
        .finally(() => setLoading(false));
      return;
    }
    setLoading(false);
  }, [orderId, razorpayAppointmentId, razorpayPaymentId]);

  const hasReference = !!orderId || !!(razorpayAppointmentId && razorpayPaymentId);
  const isPaid = result?.status === "PAID";
  const dashboardHref = result?.appointmentId
    ? `/patient/${result.appointmentId}`
    : "/";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#faf7f2",
        fontFamily: "Arial, sans-serif",
        display: "grid",
        placeItems: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          width: "100%",
          background: "white",
          borderRadius: "16px",
          padding: "32px 28px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{
            display: "inline-block",
            marginBottom: "20px",
            fontSize: "16px",
            fontWeight: "900",
            color: NAVY,
            letterSpacing: "1px",
            textDecoration: "none",
          }}
        >
          ORIS<span style={{ color: GOLD }}>ALIGN</span>
        </a>

        {loading && (
          <>
            <div style={{ fontSize: "40px", marginBottom: "10px" }}>⏳</div>
            <h1 style={{ margin: "0 0 8px", fontSize: "20px", color: NAVY }}>
              Verifying payment…
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
              Please don't close this window.
            </p>
          </>
        )}

        {!loading && !hasReference && (
          <Failure
            title="Missing order"
            detail="No order reference was supplied. If money was deducted, contact us with your transaction details."
            dashboardHref={dashboardHref}
          />
        )}

        {!loading && hasReference && isPaid && (
          <>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#D7EFEB",
                color: "#168F83",
                fontSize: "36px",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 14px",
              }}
            >
              ✓
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: "22px", color: NAVY }}>
              Payment Successful
            </h1>
            <p
              style={{
                margin: "0 0 18px",
                fontSize: "13px",
                color: "#6b7280",
              }}
            >
              {result?.alreadyApplied
                ? "We already recorded this payment — you're all set."
                : "Thanks — your payment has been received."}
            </p>

            <div
              style={{
                background: "#f8f7f5",
                borderRadius: "12px",
                padding: "14px 16px",
                marginBottom: "20px",
                textAlign: "left",
              }}
            >
              <Row label="Amount" value={`₹ ${(result?.amount || 0).toLocaleString("en-IN")}`} bold />
              <Row label={orderId ? "Order ID" : "Payment ID"} value={result?.orderId || "—"} mono />
              <Row label="Status" value={result?.status || "—"} />
            </div>

            <a
              href={dashboardHref}
              style={{
                display: "block",
                padding: "12px",
                borderRadius: "10px",
                background: `linear-gradient(135deg, ${NAVY}, #0F1E33)`,
                color: "white",
                fontWeight: "800",
                fontSize: "14px",
                textDecoration: "none",
                letterSpacing: "0.3px",
              }}
            >
              Back to my journey
            </a>
          </>
        )}

        {!loading && hasReference && !isPaid && (
          <Failure
            title={
              result?.status === "ACTIVE"
                ? "Payment incomplete"
                : "Payment not successful"
            }
            detail={
              result?.status === "ACTIVE"
                ? "We couldn't confirm your payment yet. If money was deducted, it usually settles within a few minutes."
                : result?.error ||
                  `Status: ${result?.status || "UNKNOWN"}. If you were charged, reach out and we'll sort it out.`
            }
            orderId={orderId || razorpayPaymentId || undefined}
            dashboardHref={dashboardHref}
          />
        )}

        <div
          style={{
            marginTop: "22px",
            fontSize: "11px",
            color: "#9ca3af",
            lineHeight: "1.7",
          }}
        >
          Need help? Email{" "}
          <a
            href="mailto:hello@orisalign.com"
            style={{ color: GOLD, fontWeight: "700", textDecoration: "none" }}
          >
            hello@orisalign.com
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "10px",
        padding: "6px 0",
      }}
    >
      <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: bold ? "16px" : "12px",
          color: "#111827",
          fontWeight: bold ? "800" : "600",
          fontFamily: mono
            ? "ui-monospace, Menlo, Consolas, monospace"
            : "inherit",
          maxWidth: "60%",
          overflowWrap: "anywhere",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Failure({
  title,
  detail,
  orderId,
  dashboardHref,
}: {
  title: string;
  detail: string;
  orderId?: string;
  dashboardHref: string;
}) {
  return (
    <>
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          background: "#fee2e2",
          color: "#dc2626",
          fontSize: "32px",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 14px",
        }}
      >
        ✕
      </div>
      <h1 style={{ margin: "0 0 6px", fontSize: "22px", color: NAVY }}>
        {title}
      </h1>
      <p style={{ margin: "0 0 18px", fontSize: "13px", color: "#6b7280" }}>
        {detail}
      </p>
      {orderId && (
        <p
          style={{
            margin: "0 0 18px",
            fontSize: "11px",
            color: "#9ca3af",
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          }}
        >
          Order: {orderId}
        </p>
      )}
      <a
        href={dashboardHref}
        style={{
          display: "block",
          padding: "12px",
          borderRadius: "10px",
          background: "white",
          color: NAVY,
          border: `1px solid ${NAVY}`,
          fontWeight: "700",
          fontSize: "14px",
          textDecoration: "none",
        }}
      >
        Back to my journey
      </a>
    </>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#faf7f2" }} />}>
      <SuccessInner />
    </Suspense>
  );
}
