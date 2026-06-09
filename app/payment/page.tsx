"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Script from "next/script";

/**
 * /payment — Patient payment landing page.
 *
 * Query params:
 *   ?id=<appointment_id>     The booking row this payment is for.
 *   ?amount=<rupees>          The amount due (pending_amount from payment_data).
 *
 * "cashfree" is the live gateway — it covers UPI / cards / net-banking / wallets
 * / EMI under one checkout. Other options are placeholders until wired up.
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

// Cashfree drop-in JS — exposed on window after the next/script tag loads.
declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => {
      checkout: (opts: {
        paymentSessionId: string;
        redirectTarget?: "_self" | "_blank" | "_modal";
      }) => Promise<unknown> | void;
    };
  }
}

const OPTIONS: PaymentOption[] = [
  {
    key: "cashfree",
    name: "UPI / Cards / Net Banking",
    blurb: "Powered by Cashfree — GPay, PhonePe, Paytm, all cards, EMI",
    emoji: "💳",
    bg: "#0a84ff",
    comingSoon: false,
  },
  {
    key: "razorpay",
    name: "Razorpay Checkout",
    blurb: "Cards, UPI, Wallets, Bank Transfer & more",
    emoji: "💰",
    bg: "#2563eb",
    comingSoon: false,
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
  const [busy, setBusy] = useState(false);

  const startCashfree = async () => {
    if (!id) {
      setNotice("Missing appointment context. Please open this page from your patient dashboard.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/cashfree/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id }),
      });
      const data = await res.json();
      if (!res.ok || !data.paymentSessionId) {
        setNotice(data.error || "Couldn't start the payment. Please try again or WhatsApp us.");
        return;
      }
      if (typeof window === "undefined" || !window.Cashfree) {
        setNotice("Payment SDK is still loading — please try again in a moment.");
        return;
      }
      const mode = (data.mode === "production" ? "production" : "sandbox") as "production" | "sandbox";
      const cashfree = window.Cashfree({ mode });
      cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      });
    } catch {
      setNotice("Couldn't reach the payment service. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const startRazorpay = async () => {
    if (!id) {
      setNotice("Missing appointment context. Please open this page from your patient dashboard.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      // Create order
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount * 100, // Convert to paise
          receipt: id,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.order_id) {
        setNotice(orderData.error || "Couldn't create payment order. Please try again.");
        return;
      }

      // Load Razorpay script if not already loaded
      if (!(window as any).Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => openRazorpayModal(orderData.order_id);
        script.onerror = () => {
          setNotice("Failed to load payment gateway. Please try again.");
          setBusy(false);
        };
        document.body.appendChild(script);
      } else {
        openRazorpayModal(orderData.order_id);
      }
    } catch (error) {
      setNotice("Couldn't reach the payment service. Please check your connection and try again.");
      setBusy(false);
    }
  };

  const openRazorpayModal = (orderId: string) => {
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      order_id: orderId,
      name: "OrisAlign",
      description: "Payment for Aligner Treatment",
      image: "/logo.png",
      handler: async (response: any) => {
        try {
          // Verify payment
          const verifyRes = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyRes.json();

          if (!verifyRes.ok || !verifyData.success) {
            setNotice("Payment verification failed. Please contact support.");
            return;
          }

          // Payment successful
          window.location.href = `/payment/success?id=${id}&payment_id=${response.razorpay_payment_id}`;
        } catch (error) {
          setNotice("Payment verification error. Please contact support.");
        } finally {
          setBusy(false);
        }
      },
      prefill: {
        name: "Patient",
        email: "patient@example.com",
        contact: "",
      },
      theme: {
        color: GOLD,
      },
      modal: {
        ondismiss: () => {
          setNotice("Payment cancelled. Please try again when ready.");
          setBusy(false);
        },
      },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  const handleSelect = (opt: PaymentOption) => {
    setSelected(opt.key);
    if (opt.key === "cashfree") {
      void startCashfree();
      return;
    }
    if (opt.key === "razorpay") {
      void startRazorpay();
      return;
    }
    if (opt.comingSoon) {
      setNotice(
        `${opt.name} integration is coming soon. For now, please reach out on WhatsApp at +91 8069645412 and we'll guide you through.`
      );
      return;
    }
    setNotice(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif" }}>
      {/* Cashfree drop-in JS SDK */}
      <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" />

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
            const isBusyOption = busy && (opt.key === "cashfree" || opt.key === "razorpay");
            return (
              <button
                key={opt.key}
                onClick={() => handleSelect(opt)}
                disabled={isBusyOption}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "white",
                  border: isSelected ? `2px solid ${GOLD}` : "1px solid #e5e7eb",
                  cursor: isBusyOption ? "wait" : "pointer",
                  boxShadow: isSelected ? "0 6px 16px rgba(201, 168, 76, 0.15)" : "0 2px 6px rgba(0,0,0,0.04)",
                  width: "100%",
                  fontFamily: "inherit",
                  opacity: isBusyOption ? 0.7 : 1,
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
                <span style={{ fontSize: "20px", color: "#cbd5e1" }}>
                  {isBusyOption ? "…" : "›"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: "28px", padding: "16px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#6b7280", lineHeight: "1.7" }}>
            🔒 All payments are secured. Need help? WhatsApp{" "}
            <a href="https://wa.me/918069645412" target="_blank" rel="noreferrer" style={{ color: GOLD, fontWeight: "700", textDecoration: "none" }}>
              +91 8069645412
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
