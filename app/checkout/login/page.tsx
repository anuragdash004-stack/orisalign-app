"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CheckoutLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = enter identifier, 2 = enter OTP
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [foundEmail, setFoundEmail] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [pendingAmount, setPendingAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLookup = async () => {
    const value = identifier.trim();
    if (!value) {
      setError("Please enter your phone number, email, or Patient ID.");
      return;
    }
    setLoading(true);
    setError("");

    const base = supabase!
      .from("appointments_booking")
      .select("id, name, email, phone, payment_data")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1);

    const query = value.includes("@")
      ? base.eq("email", value)
      : UUID_RE.test(value)
        ? base.eq("id", value)
        : base.eq("phone", value);

    const { data, error: dbErr } = await query;
    setLoading(false);

    if (dbErr || !data || data.length === 0) {
      setError("No appointment found. Please check your details and try again.");
      return;
    }

    const appt = data[0];
    if (!appt.email || appt.email === "N/A") {
      setError("No email registered for this appointment. Please contact the clinic.");
      return;
    }

    setFoundEmail(appt.email);
    setAppointmentId(appt.id);
    setPendingAmount(Number(appt.payment_data?.pending_amount) || 0);

    // Send OTP
    setLoading(true);
    const res = await fetch("/api/send-booking-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: appt.email, name: appt.name }),
    });
    setLoading(false);

    if (!res.ok) {
      setError("Failed to send OTP. Please try again.");
      return;
    }

    const { token } = await res.json();
    setOtpToken(token);
    setStep(2);
  };

  const handleVerify = async () => {
    if (!otp.trim()) { setError("Please enter the OTP."); return; }
    setLoading(true);
    setError("");

    const res = await fetch("/api/verify-booking-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: foundEmail, otp, token: otpToken }),
    });
    setLoading(false);

    if (!res.ok) {
      setError("Invalid OTP. Please try again.");
      return;
    }

    router.push(`/checkout?id=${appointmentId}&amount=${pendingAmount}`);
  };

  return (
    <div
      className="pattern-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#faf7f2",
        padding: "20px",
        colorScheme: "light",
      }}
    >
      <div style={{
        background: "white",
        borderRadius: "24px",
        padding: "40px",
        width: "100%",
        maxWidth: "400px",
        boxShadow: "0 30px 80px rgba(180,140,80,0.15)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          <img src="/logo.png" style={{ width: "200px" }} alt="OrisAlign" />
        </div>

        {step === 1 ? (
          <>
            <h2 style={{ textAlign: "center", fontSize: "18px", fontWeight: "700", color: "#111827", marginBottom: "6px" }}>
              Continue to Checkout
            </h2>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: "13px", marginBottom: "28px" }}>
              Enter your registered phone number, email, or Patient ID
            </p>

            <input
              type="text"
              placeholder="Phone number, Email, or Patient ID"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              style={{
                width: "100%", padding: "13px 14px", borderRadius: "12px",
                border: "1px solid #e5e7eb", fontSize: "14px", outline: "none",
                color: "#111827", background: "white", boxSizing: "border-box",
                marginBottom: "12px",
              }}
            />

            {error && (
              <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleLookup}
              disabled={loading}
              style={{
                width: "100%", padding: "13px", borderRadius: "12px",
                background: "#b8905a", color: "white", fontWeight: "700",
                fontSize: "14px", border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Looking up..." : "SEND OTP"}
            </button>
          </>
        ) : (
          <>
            <h2 style={{ textAlign: "center", fontSize: "18px", fontWeight: "700", color: "#111827", marginBottom: "6px" }}>
              Verify OTP
            </h2>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: "13px", marginBottom: "28px" }}>
              OTP sent to {foundEmail}
            </p>

            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => { setOtp(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              style={{
                width: "100%", padding: "13px 14px", borderRadius: "12px",
                border: "1px solid #e5e7eb", fontSize: "14px", outline: "none",
                color: "#111827", background: "white", boxSizing: "border-box",
                marginBottom: "12px",
              }}
            />

            {error && (
              <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleVerify}
              disabled={loading}
              style={{
                width: "100%", padding: "13px", borderRadius: "12px",
                background: "#111827", color: "white", fontWeight: "700",
                fontSize: "14px", border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Verifying..." : "CONTINUE TO CHECKOUT"}
            </button>

            <button
              onClick={() => { setStep(1); setOtp(""); setError(""); }}
              style={{
                width: "100%", padding: "10px", borderRadius: "12px",
                background: "transparent", color: "#6b7280", fontWeight: "600",
                fontSize: "13px", border: "none", cursor: "pointer", marginTop: "8px",
              }}
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
