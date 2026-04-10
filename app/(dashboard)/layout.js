"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Image from "next/image";

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div style={{ display: "flex" }}>

      {/* SIDEBAR */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* MAIN CONTENT */}
      <div
        style={{
          flex: 1,
          minHeight: "100vh",
          backgroundColor: "#f8f6f2",

          // ✅ MAIN BACKGROUND PATTERN
          backgroundImage: "url('/pattern-icon.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "120px",

          padding: "20px",
        }}
      >
        {/* TOP BAR */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            marginBottom: "25px",
          }}
        >
          {/* ☰ HAMBURGER BUTTON */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: "22px",
              background: "#ffffff",
              color: "#000000", // ✅ BLACK (VISIBLE)
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              padding: "6px 10px",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}
          >
            ☰
          </button>

          {/* LOGO (REPLACES DASHBOARD TEXT) */}
          <Image
            src="/onlylogo.png"
            alt="OrisAlign Logo"
            width={200}
            height={60}
            priority
          />
        </div>

        {/* PAGE CONTENT */}
        {children}
      </div>
    </div>
  );
}