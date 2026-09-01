"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

// Persisted on this device once a patient verifies their OTP — checked on
// every load of this page so returning to the app (or reopening it after
// being closed) skips straight to their journey page instead of asking
// them to log in again. Cleared only by an explicit Logout (see
// app/(dashboard)/patient/[id]/page.js) or by uninstalling the app, since
// this lives in the WebView's own local storage.
const PATIENT_ID_KEY = "orisalign_patient_id";

export default function LoginPage() {
  const router = useRouter();
  // "patient" is the default entry point for the installed app — staff
  // reach their own email/password login behind the small icon below.
  const [view, setView] = useState("patient"); // "patient" | "staff"
  const [checkingSavedSession, setCheckingSavedSession] = useState(true);

  useEffect(() => {
    try {
      const savedId = window.localStorage.getItem(PATIENT_ID_KEY);
      if (savedId) {
        router.replace(`/patient/${savedId}`);
        return;
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — just show the login form.
    }
    setCheckingSavedSession(false);
  }, [router]);

  if (checkingSavedSession) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f2" }}>
        <p style={{ color: "#9ca3af", fontSize: "13px" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#faf7f2",
      backgroundImage: "url('/pattern-icon.png')",
      backgroundRepeat: "repeat",
      backgroundSize: "80px",
      padding: "20px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        background: "white",
        borderRadius: "20px",
        padding: "30px 30px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
        textAlign: "center",
        position: "relative",
      }}>
        {/* Small staff-login toggle — a private clinic tool tucked in the
            corner, never the default a patient sees first. */}
        {view === "patient" ? (
          <button
            onClick={() => setView("staff")}
            aria-label="Staff login"
            title="Staff login"
            style={{
              position: "absolute", top: "16px", right: "16px",
              width: "34px", height: "34px", borderRadius: "9px",
              border: "1px solid #e9e1d0", background: "#faf6ec",
              color: "#837a66", fontSize: "15px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            🔒
          </button>
        ) : (
          <button
            onClick={() => setView("patient")}
            style={{
              position: "absolute", top: "16px", left: "16px",
              background: "none", border: "none", color: "#a9762e",
              fontSize: "13px", fontWeight: "700", cursor: "pointer", padding: 0,
            }}
          >
            ← Patient login
          </button>
        )}

        <img
          src="/logo.png"
          alt="OrisAlign"
          style={{ height: view === "patient" ? "120px" : "160px", marginTop: view === "patient" ? "18px" : "0", marginBottom: "18px", display: "block", marginLeft: "auto", marginRight: "auto", objectFit: "contain" }}
        />

        {view === "patient" ? <PatientLogin /> : <StaffLogin />}
      </div>
    </div>
  );
}

// ─── Patient login — phone / email / Patient ID, WhatsApp OTP ─────────────────
function PatientLogin() {
  const [step, setStep] = useState("identify"); // "identify" | "otp"
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null); // { token, appointmentId, phoneHint }

  const requestOtp = async () => {
    if (!identifier.trim()) { setError("Enter your phone number, email, or Patient ID."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/patient-login/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      setSession(data);
      setStep("otp");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) { setError("Enter the code we sent you."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/patient-login/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: session.appointmentId, otp: otp.trim(), token: session.token }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Incorrect code."); return; }
      try {
        window.localStorage.setItem(PATIENT_ID_KEY, session.appointmentId);
      } catch {
        // If storage is unavailable, they'll just need to log in again next time.
      }
      window.location.href = `/patient/${session.appointmentId}`;
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (step === "identify") requestOtp();
    else verifyOtp();
  };

  if (step === "otp") {
    return (
      <>
        <p style={{ color: "#374151", fontSize: "14px", margin: "0 0 4px", fontWeight: "700" }}>Enter the code</p>
        <p style={{ color: "#6b7280", fontSize: "13px", margin: "0 0 16px" }}>
          {session?.demo
            ? <>This is a demo account — enter <strong>123456</strong> to continue.</>
            : <>We sent a WhatsApp code to the number ending in <strong>{session?.phoneHint}</strong>.</>}
        </p>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="6-digit code"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={handleKeyDown}
          style={{ ...inputStyle, textAlign: "center", fontSize: "22px", letterSpacing: "6px", fontWeight: "700" }}
          autoFocus
        />
        {error && <p style={{ color: "#dc2626", fontSize: "13px", margin: "10px 0 0" }}>{error}</p>}
        <button onClick={verifyOtp} disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Verifying..." : "Verify & Continue"}
        </button>
        <button
          onClick={() => { setStep("identify"); setOtp(""); setError(""); }}
          style={{ background: "none", border: "none", color: "#837a66", fontSize: "13px", cursor: "pointer", marginTop: "14px", textDecoration: "underline" }}
        >
          ← Use a different number
        </button>
      </>
    );
  }

  return (
    <>
      <p style={{ color: "#374151", fontSize: "14px", margin: "0 0 16px", fontWeight: "700" }}>Log in to your Smile Journey</p>
      <input
        type="text"
        placeholder="Phone, email, or Patient ID"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        onKeyDown={handleKeyDown}
        style={inputStyle}
        autoFocus
      />
      {error && <p style={{ color: "#dc2626", fontSize: "13px", margin: "10px 0 0" }}>{error}</p>}
      <button onClick={requestOtp} disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
        {loading ? "Sending..." : "Send WhatsApp Code"}
      </button>
      <p style={{ color: "#9ca3af", fontSize: "12px", margin: "16px 0 0", lineHeight: "1.6" }}>
        We'll send a one-time code to your WhatsApp to confirm it's you.
      </p>
    </>
  );
}

// ─── Staff login — unchanged email/password flow, just behind the toggle ──────
function StaffLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [mode, setMode] = useState("login"); // "login" | "forgot"
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setLoading(true);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("os_remember", rememberMe ? "1" : "0");
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert("Login failed: " + error.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (roleError) {
      alert("Role fetch failed");
      console.error(roleError);
      setLoading(false);
      return;
    }

    const role = userData?.role;

    if (role === "admin") {
      window.location.href = "/admin";
    } else if (role === "counselor") {
      window.location.href = "/appointment";
    } else if (role === "dentist") {
      window.location.href = "/dentist";
    } else if (role === "orthodontist") {
      window.location.href = "/ortho";
    } else {
      alert("Unknown role: " + role);
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { alert("Please enter your email address first."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/send-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert("Error: " + (data.error || "Failed to send reset email"));
      } else {
        setResetSent(true);
      }
    } catch {
      alert("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (mode === "login") handleLogin();
      else handleForgotPassword();
    }
  };

  return (
    <>
      {mode === "login" ? (
        <>
          <input
            type="email"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            style={inputStyle}
          />
          <div style={{ position: "relative", marginTop: "12px" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ ...inputStyle, paddingRight: "44px" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "16px", padding: 0, lineHeight: 1 }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: "16px", height: "16px", accentColor: "#22c55e", cursor: "pointer", margin: 0 }}
              />
              Keep me logged in
            </label>
            <button
              onClick={() => { setMode("forgot"); setResetSent(false); }}
              style={{ background: "none", border: "none", color: "#6b7280", fontSize: "13px", cursor: "pointer", textDecoration: "underline", padding: 0 }}
            >
              Forgot password?
            </button>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ ...buttonStyle, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </>
      ) : (
        <>
          {resetSent ? (
            <div style={{ padding: "20px 0" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📧</div>
              <p style={{ color: "#111827", fontWeight: "700", fontSize: "16px", margin: "0 0 8px" }}>Check your inbox</p>
              <p style={{ color: "#6b7280", fontSize: "14px", margin: "0 0 24px" }}>
                A password reset link has been sent to <strong>{email}</strong>. Click the link in the email to set a new password.
              </p>
              <button
                onClick={() => { setMode("login"); setResetSent(false); }}
                style={{ background: "none", border: "none", color: "#22c55e", fontSize: "14px", cursor: "pointer", fontWeight: "600" }}
              >
                ← Back to Login
              </button>
            </div>
          ) : (
            <>
              <p style={{ color: "#374151", fontSize: "14px", margin: "0 0 16px", textAlign: "left" }}>
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                style={inputStyle}
              />
              <button
                onClick={handleForgotPassword}
                disabled={loading}
                style={{ ...buttonStyle, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading ? "Sending..." : "Send Reset Email"}
              </button>
              <button
                onClick={() => setMode("login")}
                style={{ background: "none", border: "none", color: "#6b7280", fontSize: "13px", cursor: "pointer", marginTop: "12px", textDecoration: "underline" }}
              >
                ← Back to Login
              </button>
            </>
          )}
        </>
      )}
    </>
  );
}

const inputStyle = {
  width: "100%",
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #e5e7eb",
  background: "rgba(255,255,255,0.8)",
  color: "#111827",
  outline: "none",
  fontSize: "14px",
  boxSizing: "border-box",
};

const buttonStyle = {
  width: "100%",
  marginTop: "18px",
  padding: "14px",
  borderRadius: "10px",
  border: "none",
  background: "#22c55e",
  color: "white",
  fontWeight: "600",
  fontSize: "14px",
};
