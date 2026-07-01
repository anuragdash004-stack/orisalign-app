"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const supabase = getSupabaseClient();

export default function Callback() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  const handleUpdate = async () => {
    if (!password) { alert("Please enter a new password."); return; }
    if (password !== confirm) { alert("Passwords do not match."); return; }
    if (password.length < 6) { alert("Password must be at least 6 characters."); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Password updated! Please log in.");
      router.push("/login");
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
        padding: "30px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
        textAlign: "center",
      }}>
        <img
          src="/logo.png"
          alt="OrisAlign"
          style={{ height: "140px", marginBottom: "18px", display: "block", marginLeft: "auto", marginRight: "auto", objectFit: "contain" }}
        />
        <h2 style={{ color: "#111827", fontSize: "20px", fontWeight: "700", margin: "0 0 8px" }}>Set New Password</h2>
        <p style={{ color: "#6b7280", fontSize: "14px", margin: "0 0 20px" }}>Choose a strong password for your account.</p>

        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, paddingRight: "44px" }}
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtn} aria-label={showPassword ? "Hide" : "Show"}>
            {showPassword ? "🙈" : "👁"}
          </button>
        </div>
        <div style={{ position: "relative", marginTop: "12px" }}>
          <input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
            style={{ ...inputStyle, paddingRight: "44px" }}
          />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={eyeBtn} aria-label={showConfirm ? "Hide" : "Show"}>
            {showConfirm ? "🙈" : "👁"}
          </button>
        </div>

        <button
          onClick={handleUpdate}
          disabled={loading}
          style={{
            width: "100%", marginTop: "18px", padding: "14px",
            borderRadius: "10px", border: "none",
            background: "#22c55e", color: "white",
            fontWeight: "600", fontSize: "14px",
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}

const eyeBtn = {
  position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", cursor: "pointer", color: "#9ca3af",
  fontSize: "16px", padding: 0, lineHeight: 1,
};

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
