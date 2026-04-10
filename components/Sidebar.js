"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

export default function Sidebar({ collapsed }) {
  const path = usePathname();

  const linkStyle = (route) => ({
    display: "block",
    padding: "12px 16px",
    borderRadius: "10px",
    marginBottom: "10px",
    background: path === route ? "#ffffff90" : "transparent",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: "700",
    letterSpacing: "0.5px",
    fontSize: "14px"
  });

  return (
    <div style={{
      width: collapsed ? "70px" : "240px",
      height: "100vh",
      padding: "20px 12px",
      transition: "0.3s",
      borderRight: "1px solid #e5e7eb",

      /* 🔥 PATTERN BACKGROUND WHEN OPEN */
      backgroundColor: "#f8f6f2",
      backgroundImage: collapsed ? "none" : "url('/pattern-icon.png')",
      backgroundRepeat: "repeat",
      backgroundSize: "60px" // 🔥 smaller pattern
    }}>

      {/* LOGO ONLY WHEN OPEN */}
      {!collapsed && (
        <div style={{ marginBottom: "30px", textAlign: "center" }}>
          <Image
            src="/logo.png"
            alt="logo"
            width={120}
            height={40}
          />
        </div>
      )}

      {/* MENU */}
      <Link href="/admin" style={linkStyle("/admin")}>
        {!collapsed && "DASHBOARD"}
      </Link>

      <Link href="/appointment" style={linkStyle("/appointment")}>
        {!collapsed && "APPOINTMENTS"}
      </Link>

      <Link href="/dentist" style={linkStyle("/dentist")}>
        {!collapsed && "DENTISTS"}
      </Link>

      <Link href="/ortho" style={linkStyle("/ortho")}>
        {!collapsed && "ORTHODONTISTS"}
      </Link>

    </div>
  );
}