"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // 👉 SEND OTP
  const sendOTP = async () => {
    if (!phone) {
      alert("Enter phone number");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (data.success) {
        alert("OTP sent");
        setOtpSent(true);
      } else {
        alert("Failed to send OTP");
      }
    } catch (err) {
      console.error(err);
      alert("Error sending OTP");
    }

    setLoading(false);
  };

  // 👉 VERIFY OTP + REDIRECT
  const verifyOTP = async () => {
    if (!otp) {
      alert("Enter OTP");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/sms/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, otp }),
      });

      const data = await res.json();

      if (data.success) {
        alert("Login successful");

        // 🔥 REDIRECT FIX
        router.push("/appointment");
      } else {
        alert("Invalid OTP");
      }
    } catch (err) {
      console.error(err);
      alert("Error verifying OTP");
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "30px",
          borderRadius: "16px",
          width: "320px",
          textAlign: "center",
        }}
      >
        <h2>Book Consultation</h2>

        {/* PHONE INPUT */}
        <input
          type="text"
          placeholder="Enter phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        />

        {/* SEND OTP */}
        <button
          onClick={sendOTP}
          style={{
            width: "100%",
            padding: "12px",
            background: "#b9925b",
            color: "white",
            border: "none",
            borderRadius: "8px",
            marginBottom: "10px",
            cursor: "pointer",
          }}
        >
          {loading ? "Sending..." : "Send OTP"}
        </button>

        {/* OTP FIELD */}
        {otpSent && (
          <>
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
              }}
            />

            {/* VERIFY OTP */}
            <button
              onClick={verifyOTP}
              style={{
                width: "100%",
                padding: "12px",
                background: "#b9925b",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </>
        )}

        <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
          Trusted by 1000+ patients
        </p>
      </div>

      {/* 🔴 REQUIRED FOR FIREBASE */}
      <div id="recaptcha-container"></div>
    </div>
  );
}