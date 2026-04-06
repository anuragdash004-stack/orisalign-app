"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);

  const sendOTP = async () => {
    if (!phone) {
      alert("Enter phone number");
      return;
    }

    setSent(true);

    const res = await fetch("/api/sms/send", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });

    const data = await res.json();

    if (!data.success) {
      alert("Error sending OTP");
      setSent(false);
    }
  };

  const verifyOTP = async () => {
    const res = await fetch("/api/sms/verify", {
      method: "POST",
      body: JSON.stringify({ phone, otp }),
    });

    const data = await res.json();

    if (data.success) {
      alert("Login successful ✅");
      router.push("/appointment");
    } else {
      alert("Invalid OTP ❌");
    }
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#faf7f2",
      }}
    >
      {/* 🔥 ICON GRID BACKGROUND */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/pattern-icon.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "70px", // 👈 controls spacing
          opacity: 0.16, // 👈 luxury subtle feel
        }}
      />

      {/* 🔥 CARD */}
      <div
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.95)",
          padding: "35px 30px",
          borderRadius: "20px",
          width: "360px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        {/* 🔥 LOGO */}
        <img
          src="/logo.png"
          alt="OrisAlign"
          style={{
            width: "140px",
            display: "block",
            margin: "0 auto 10px auto",
          }}
        />

        <h3 style={{ marginBottom: "20px", color: "#333" }}>
          Book Consultation
        </h3>

        <input
          placeholder="Enter phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
        />

        {!sent && (
          <button onClick={sendOTP} style={buttonStyle}>
            Send OTP
          </button>
        )}

        {sent && (
          <>
            <input
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={inputStyle}
            />

            <button onClick={verifyOTP} style={buttonStyle}>
              Verify OTP
            </button>
          </>
        )}

        <p style={{ marginTop: "10px", fontSize: "12px", color: "#777" }}>
          Trusted by 1000+ patients
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
};

const buttonStyle = {
  width: "100%",
  padding: "14px",
  background: "#b9925b",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "600",
};