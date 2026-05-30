"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

/**
 * /payment — Patient payment landing page.
 *
 * Query params:
 *   ?id=<appointment_id>     The booking row this payment is for.
 *   ?amount=<rupees>          The amount due (pending_amount from payment_data).
 *
 * Currently every gateway is a placeholder ("Coming soon"). As each gateway is
 * integrated, replace the option's onSelect handler with the SDK call (e.g.
 * razorpay.open(), stripe.redirectToCheckout()) and remove its `comingSoon` flag.
 */

const NAVY = "#1B2A4A";
const GOLD = "#C9A84C";

interface PaymentOption {
  key: string;
  name: string;
  blurb: string;
  emoji: string;
  bg: string;
  comingSoon: boolean;
}

const OPTIONS: PaymentOption[] = [
  {
    key: "razorpay",
    name: "UPI / Cards / Net Banking",
    blurb: "Powered by Razorpay — GPay, PhonePe, Paytm, all cards",
    emoji: "💳",
    bg: "#0a84ff",
    comingSoon: true,
  },
  {
    key: "upi-direct",
    name: "UPI ID (Direct)",
    blurb: "Pay to our UPI handle — share the screenshot on WhatsApp",
    emoji: "📱",
    bg: "#5b21b6",
    comingSoon: true,
  },
  {
    key: "stripe",
    name: "International Cards",
    blurb: "Visa / Mastercard / Amex via Stripe (USD)",
    emoji: "🌍",
    bg: "#635bff",
    comingSoon: true,
  },
  {
    key: "finance",
    name: "EMI / Finance",
    blurb: "Bajaj, HBD or Poonawalla — 6/9/12 month plans",
    emoji: "🏦",
    bg: "#16a34a",
    comingSoon: true,
  },
  {
    key: "bank-transfer",
    name: "Bank Transfer (NEFT/IMPS)",
    blurb: "Get our account details and pay manually",
    emoji: "🏛️",
    bg: "#374151",
    comingSoon: true,
  },
  {
    key: "cash",
    name: "Cash at Clinic",
    blurb: "Visit our Bhubaneswar clinic and pay in person",
    emoji: "🏥",
    bg: "#b8905a",
    comingSoon: true,
  },
];

function PaymentInner() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const amountRaw = params.get("amount") ?? "";
  const amount = Number(amountRaw) || 0;

  const shortId = id ? id.substring(0, 8).toUpperCase() : "—";
  const formatted = amount > 0 ? `₹ ${amount.toLocaleString("en-IN")}` : "—";

  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSelect = (opt: PaymentOption) => {
    setSelected(opt.key);
    if (opt.comingSoon) {
      setNotice(
        `${opt.name} integration is coming soon. For now, please reach out on WhatsApp at +91 95838 25755 and we'll guide you through.`
      );
      return;
    }
    // TODO: trigger the gateway SDK here as each one is integrated.
    setNotice(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 20px 80px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <a href="/" style={{ display: "inline-block", fontSize: "20px", fontWeight: "900", color: NAVY, textDecoration: "none", letterSpacing: "1px" }}>
            ORIS<span style={{ color: GOLD }}>ALIGN</span>
          </a>
          <h1 style={{ margin: "16px 0 6px", fontSize: "26px", fontWeight: "900", color: NAVY }}>Complete Your Payment</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Choose how you'd like to pay below.</p>
        </div>

        {/* Order Summary */}
        <div style={{ background: `linear-gradient(135deg, ${NAVY}, #0F1E33)`, color: "white", borderRadius: "16px", padding: "20px 22px", marginBottom: "20px", boxShadow: "0 8px 24px rgba(27, 42, 74, 0.18)" }}>
          <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#E8D9A0", textTransform: "uppercase" }}>Amount due</p>
          <p style={{ margin: 0, fontSize: "36px", fontWeight: "900", color: GOLD, letterSpacing: "-0.5px" }}>{formatted}</p>
          <div style={{ marginTop: "10px", fontSize: "12px", color: "#cbd5e1" }}>
            Patient ID: <strong style={{ color: "white" }}>{shortId}</strong>
          </div>
        </div>

        {!id && (
          <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", color: "#92400e", padding: "12px 14px", borderRadius: "10px", fontSize: "13px", marginBottom: "16px" }}>
            ⚠️ No appointment context. Please open this page from your patient dashboard.
          </div>
        )}

        {/* Notice banner */}
        {notice && (
          <div style={{ background: "#fff", border: `1px solid ${GOLD}`, padding: "14px 16px", borderRadius: "12px", fontSize: "13px", color: "#374151", lineHeight: "1.6", marginBottom: "16px", boxShadow: "0 4px 10px rgba(201, 168, 76, 0.10)" }}>
            {notice}
          </div>
        )}

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => handleSelect(opt)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "white",
                  border: isSelected ? `2px solid ${GOLD}` : "1px solid #e5e7eb",
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 6px 16px rgba(201, 168, 76, 0.15)" : "0 2px 6px rgba(0,0,0,0.04)",
                  width: "100%",
                  fontFamily: "inherit",
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: opt.bg,
                    color: "white",
                    fontSize: "22px",
                    flexShrink: 0,
                  }}
                >
                  {opt.emoji}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: NAVY }}>{opt.name}</span>
                    {opt.comingSoon && (
                      <span style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.5px", padding: "2px 8px", borderRadius: "99px", background: "#fef3c7", color: "#92400e", textTransform: "uppercase" }}>
                        Coming soon
                      </span>
                    )}
                  </span>
                  <span style={{ display: "block", fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{opt.blurb}</span>
                </span>
                <span style={{ fontSize: "20px", color: "#cbd5e1" }}>›</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: "28px", padding: "16px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#6b7280", lineHeight: "1.7" }}>
            🔒 All payments are secured. Need help? WhatsApp{" "}
            <a href="https://wa.me/919583825755" target="_blank" rel="noreferrer" style={{ color: GOLD, fontWeight: "700", textDecoration: "none" }}>
              +91 95838 25755
            </a>{" "}
            or email{" "}
            <a href="mailto:hello@orisalign.com" style={{ color: GOLD, fontWeight: "700", textDecoration: "none" }}>
              hello@orisalign.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#faf7f2" }} />}>
      <PaymentInner />
    </Suspense>
  );
}
