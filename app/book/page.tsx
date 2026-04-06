"use client";

import { useState, useEffect } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { auth } from "@/app/lib/firebase";

export default function BookPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ INIT RECAPTCHA (FIXED)
  useEffect(() => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",
        }
      );
    }
  }, []);

  // ✅ SEND OTP
  const sendOTP = async () => {
    if (!phone || phone.length < 10) {
      alert("Enter valid phone number");
      return;
    }

    setLoading(true);

    try {
      const appVerifier = (window as any).recaptchaVerifier;

      const confirmation = await signInWithPhoneNumber(
        auth,
        "+91" + phone.trim(),
        appVerifier
      );

      (window as any).confirmationResult = confirmation;

      setOtpSent(true);
      alert("OTP sent successfully");
    } catch (err) {
      console.error(err);
      alert("Error sending OTP");
    }

    setLoading(false);
  };

  // ✅ VERIFY OTP
  const verifyOTP = async () => {
    if (!otp) {
      alert("Enter OTP");
      return;
    }

    setLoading(true);

    try {
      await (window as any).confirmationResult.confirm(otp);
      alert("Login successful 🎉");
    } catch (err) {
      alert("Invalid OTP");
    }

    setLoading(false);
  };

  // 🎨 STYLES
  const inputStyle = {
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #e5e5e5",
    fontSize: "14px",
    outline: "none",
    background: "#ffffff",
    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
  };

  const buttonStyle = {
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #c9a86a, #b8904f)",
    color: "white",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(201,168,106,0.4)",
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",

        // 🟡 YOUR PATTERN BACKGROUND
        backgroundImage: "url('/pattern.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* 💎 CARD */}
      <div
        style={{
          width: "360px",
          padding: "35px",
          borderRadius: "24px",

          background: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(200,200,200,0.3)",

          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          textAlign: "center",

          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* 🦷 LOGO */}
        <img
          src="/logo.png"
          alt="OrisAlign"
          style={{
            width: "140px",
            margin: "0 auto 10px",
          }}
        />

        <h2 style={{ marginBottom: "10px" }}>Book Consultation</h2>

        {/* PHONE INPUT */}
        <input
          style={inputStyle}
          placeholder="Enter phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <button style={buttonStyle} onClick={sendOTP}>
          {loading ? "Sending..." : "Send OTP"}
        </button>

        {/* OTP FIELD */}
        {otpSent && (
          <>
            <input
              style={inputStyle}
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />

            <button style={buttonStyle} onClick={verifyOTP}>
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </>
        )}

        <p style={{ fontSize: "12px", color: "#666" }}>
          Trusted by 1000+ patients
        </p>
      </div>

      {/* 🔴 REQUIRED FOR FIREBASE */}
      <div
        id="recaptcha-container"
        style={{ position: "fixed", bottom: "0px" }}
      ></div>
    </div>
  );
}