"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // ✅ FIX 3 — loading state so button disables during login
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Login failed: " + error.message);
      setLoading(false);
      return;
    }

    // ✅ GET USER
    const user = data.user;

    // ✅ GET ROLE FROM DB
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
    console.log("LOGIN ROLE:", role);

    // ✅ Fixed — each role goes to their own page
if (role === "admin") {
  window.location.href = "/admin";
} else if (role === "counsellor") {
  window.location.href = "/appointment";  // counsellor edits/assigns
} else if (role === "dentist") {
  window.location.href = "/dentist";      // dentist sees their cases
} else if (role === "orthodontist") {
  window.location.href = "/ortho";        // ortho sees their cases
} else {
      alert("Unknown role: " + role);
      setLoading(false);
    }
  };

  // ✅ FIX 4 — allow login on Enter key press
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8fafc",
        backgroundImage: "url('/pattern-icon.png')",
        backgroundRepeat: "repeat",
        backgroundSize: "80px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "white",
          borderRadius: "20px",
          padding: "30px 30px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        {/* LOGO */}
        <img
          src="/logo.png"
          alt="OrisAlign"
          style={{
            height: "200px",
            marginBottom: "18px",
            display: "block",
            marginLeft: "auto",
            marginRight: "auto",
            objectFit: "contain",
          }}
        />

        {/* INPUTS */}
        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ ...inputStyle, marginTop: "12px" }}
        />

        {/* BUTTON */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            ...buttonStyle,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
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
};
