"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

export default function LoginPage() {
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://app.orisalign.com/auth/callback",
    });
    setLoading(false);
    if (error) {
      alert("Error: " + error.message);
    } else {
      setResetSent(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (mode === "login") handleLogin();
      else handleForgotPassword();
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f8fafc",
      backgroundImage: "url('/pattern-icon.png')",
      backgroundRepeat: "repeat",
      backgroundSize: "80px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        background: "white",
        borderRadius: "20px",
        padding: "30px 30px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
        textAlign: "center",
      }}>
        <img
          src="/logo.png"
          alt="OrisAlign"
          style={{ height: "200px", marginBottom: "18px", display: "block", marginLeft: "auto", marginRight: "auto", objectFit: "contain" }}
        />

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
      </div>
    </div>
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
