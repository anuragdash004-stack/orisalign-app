"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const supabase = getSupabaseClient();

export default function PatientLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = enter phone/email, 2 = enter OTP
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [foundEmail, setFoundEmail] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLookup = async () => {
    if (!identifier.trim()) {
      setError("Please enter your phone number or email.");
      return;
    }
    setLoading(true);
    setError("");

    // Online Smile Report patients aren't in appointments_booking the same
    // way (no email, no OTP) — check that flow first by phone number, and
    // if it's a paid report, skip straight there instead of falling through
    // to the appointments_booking + email OTP flow below, which doesn't
    // apply to them.
    if (!identifier.includes("@")) {
      try {
        const res = await fetch(`/api/online-report/check-member?phone=${encodeURIComponent(identifier.trim())}`);
        const data = await res.json();
        if (data.isMember && data.reportId) {
          router.push(`/report/${data.reportId}`);
          return;
        }
      } catch {
        // Fall through to the regular appointments_booking lookup below.
      }
    }

    const query = identifier.includes("@")
      ? supabase.from("appointments_booking").select("id, name, email, phone").eq("email", identifier.trim()).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1)
      : supabase.from("appointments_booking").select("id, name, email, phone").eq("phone", identifier.trim()).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1);

    const { data, error: dbErr } = await query;
    setLoading(false);

    if (dbErr || !data || data.length === 0) {
      setError("No appointment found. Please check your phone number or email.");
      return;
    }

    const appt = data[0];
    if (!appt.email || appt.email === "N/A") {
      setError("No email registered for this appointment. Please contact the clinic.");
      return;
    }

    setFoundEmail(appt.email);
    setAppointmentId(appt.id);

    // Send OTP
    setLoading(true);
    const res = await fetch("/api/send-booking-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: appt.email, name: appt.name, phone: appt.phone }),
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

    router.push(`/patient/${appointmentId}`);
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
              Track Your Smile Journey
            </h2>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: "13px", marginBottom: "28px" }}>
              Enter your registered phone number or email
            </p>

            <input
              type="text"
              placeholder="Phone number or Email"
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
              {loading ? "Verifying..." : "VIEW MY JOURNEY"}
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
