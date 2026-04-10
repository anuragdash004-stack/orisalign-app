"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Callback() {
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleUpdate = async () => {
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Password updated!");

      // ✅ REDIRECT AFTER SUCCESS
      router.push("/login");
    }
  };

  return (
    <div style={{ padding: "50px", color: "white" }}>
      <h2>Set New Password</h2>

      <input
        type="password"
        placeholder="Enter new password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          padding: "10px",
          marginTop: "10px",
          display: "block",
        }}
      />

      <button
        onClick={handleUpdate}
        style={{
          marginTop: "10px",
          padding: "10px 20px",
          background: "#2563eb",
          color: "white",
        }}
      >
        Update Password
      </button>
    </div>
  );
}