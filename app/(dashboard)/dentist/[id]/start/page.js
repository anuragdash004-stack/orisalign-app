"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";

const supabase = getSupabaseClient();

export default function StartAppointment() {
  const { id } = useParams();
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  // If appointment already started, skip OTP and go straight in
  useEffect(() => {
    const checkStarted = async () => {
      const { data } = await supabase
        .from("appointments_booking")
        .select("appointment_started")
        .eq("id", id)
        .single();
      if (data?.appointment_started) {
        router.replace(`/dentist/${id}/appointment`);
      }
    };
    checkStarted();
  }, [id]);

  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setVerifying(true);
    setError("");

    // Fetch the appointment's stored OTP
    const { data, error: fetchError } = await supabase
      .from("appointments_booking")
      .select("otp, otp_expires_at")
      .eq("id", id)
      .single();

    if (fetchError || !data) {
      setError("Could not find appointment.");
      setVerifying(false);
      return;
    }

    // Check expiry (10 minutes)
    const now = new Date();
    const expires = new Date(data.otp_expires_at);
    if (now > expires) {
      setError("OTP has expired. Go back and click Start Appointment again.");
      setVerifying(false);
      return;
    }

    // Check OTP match
    if (data.otp !== otp.trim()) {
      setError("Incorrect OTP. Please try again.");
      setVerifying(false);
      return;
    }

    // Clear OTP and mark appointment as started
    await supabase
      .from("appointments_booking")
      .update({ otp: null, otp_expires_at: null, appointment_started: true })
      .eq("id", id);

    // Go to appointment workflow
    router.push(`/dentist/${id}/appointment`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") verifyOtp();
  };

  return (
    <div style={{
      minHeight: "60vh", display: "flex", alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        background: "white", border: "1px solid #e5e7eb",
        borderRadius: "20px", padding: "36px", maxWidth: "400px",
        width: "100%", textAlign: "center",
        boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
        <h2 style={{ marginBottom: "8px", color: "#111827" }}>Enter Patient OTP</h2>
        <p style={{ color: "gray", fontSize: "14px", marginBottom: "24px" }}>
          A 6-digit OTP has been sent to the patient's email.
          Ask the patient for the code to proceed.
        </p>

        <input
          type="text"
          maxLength={6}
          placeholder="Enter 6-digit OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%", padding: "14px", textAlign: "center",
            fontSize: "24px", letterSpacing: "8px", borderRadius: "10px",
            border: "1px solid #e5e7eb", outline: "none",
            marginBottom: "12px", boxSizing: "border-box",
          }}
        />

        {error && (
          <p style={{ color: "#ef4444", fontSize: "13px", marginBottom: "12px" }}>
            {error}
          </p>
        )}

        <button
          onClick={verifyOtp}
          disabled={verifying}
          style={{
            width: "100%", padding: "14px", borderRadius: "10px",
            border: "none", background: "#22c55e", color: "white",
            fontWeight: "600", fontSize: "15px", cursor: "pointer",
            opacity: verifying ? 0.7 : 1,
          }}
        >
          {verifying ? "Verifying..." : "Verify & Start"}
        </button>

        <button
          onClick={() => router.push("/dentist")}
          style={{
            marginTop: "12px", background: "none", border: "none",
            color: "gray", fontSize: "13px", cursor: "pointer",
          }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
