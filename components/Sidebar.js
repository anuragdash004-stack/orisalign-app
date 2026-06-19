"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

export default function Sidebar({ collapsed, setCollapsed }) {
  const path = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [path, isMobile]);

  // Fetch user info
  useEffect(() => {
    const fetchUser = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      setUserEmail(authData.user.email);
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", authData.user.id)
        .single();
      setUserRole(data?.role || "");
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  const show = {
    dashboard:    userRole === "admin",
    appointments: userRole === "admin" || userRole === "counselor",
    dentist:      userRole === "admin" || userRole === "dentist",
    ortho:        userRole === "admin" || userRole === "orthodontist",
    patients:     userRole === "admin" || userRole === "counselor",
    leads:        userRole === "admin",
    templates:    userRole === "admin",
    calculator:   userRole === "admin",
    audit:        userRole === "admin",
  };

  const expanded = !collapsed || isMobile && !collapsed;
  const showContent = !collapsed;

  const linkStyle = (route) => ({
    display: "block",
    padding: "11px 14px",
    borderRadius: "10px",
    marginBottom: "4px",
    background: path === route ? "#ffffff90" : "transparent",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: "700",
    letterSpacing: "0.5px",
    fontSize: "13px",
  });

  const HamburgerIcon = () => (
    <div style={{
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center", gap: "4px",
    }}>
      <span style={{ width: "14px", height: "2px", background: "#374151", borderRadius: "1px", display: "block" }} />
      <span style={{ width: "14px", height: "2px", background: "#374151", borderRadius: "1px", display: "block" }} />
      <span style={{ width: "14px", height: "2px", background: "#374151", borderRadius: "1px", display: "block" }} />
    </div>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 98,
          }}
        />
      )}

      {/* Floating hamburger on mobile when sidebar is closed */}
      {isMobile && collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Open menu"
          style={{
            position: "fixed", top: "14px", left: "14px",
            zIndex: 101, width: "40px", height: "40px",
            background: "white", border: "1px solid #e5e7eb",
            borderRadius: "8px", cursor: "pointer",
            display: "flex", flexDirection: "column",
            justifyContent: "center", alignItems: "center", gap: "4px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          }}
        >
          <HamburgerIcon />
        </button>
      )}

      {/* Sidebar panel */}
      <div style={{
        width: isMobile ? "260px" : (collapsed ? "66px" : "240px"),
        height: "100vh",
        padding: "16px 12px",
        transition: "width 0.25s ease, transform 0.25s ease",
        borderRight: "1px solid #e5e7eb",
        backgroundColor: "#f8f6f2",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        flexShrink: 0,
        overflowX: "hidden",
        // Mobile: slide in/out as fixed overlay
        ...(isMobile ? {
          position: "fixed",
          top: 0, left: 0,
          zIndex: 99,
          transform: collapsed ? "translateX(-100%)" : "translateX(0)",
          boxShadow: collapsed ? "none" : "4px 0 24px rgba(0,0,0,0.15)",
        } : {}),
      }}>

        {/* ── TOP ── */}
        <div>
          {/* Header: logo + toggle button */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed && !isMobile ? "center" : "space-between",
            marginBottom: "14px",
          }}>
            {showContent && (
              <Image src="/logo.png" alt="OrisAlign" width={100} height={34} style={{ flexShrink: 0 }} />
            )}

            {/* Toggle button (square with 3 lines) */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Toggle sidebar"
              style={{
                width: "34px", height: "34px",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                background: "white",
                cursor: "pointer",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <HamburgerIcon />
            </button>
          </div>

          {/* User info pill */}
          {showContent && userEmail && (
            <div style={{
              padding: "8px 10px",
              background: "rgba(255,255,255,0.7)",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "11px",
              color: "#6b7280",
              wordBreak: "break-all",
              lineHeight: "1.4",
            }}>
              <span style={{
                display: "block", fontSize: "10px", fontWeight: "800",
                color: "#374151", marginBottom: "2px", letterSpacing: "0.6px",
              }}>
                {userRole?.toUpperCase() || "USER"}
              </span>
              {userEmail}
            </div>
          )}

          {/* Nav links */}
          {show.dashboard && (
            <Link href="/admin" style={linkStyle("/admin")}>
              {showContent ? "DASHBOARD" : ""}
            </Link>
          )}
          {show.leads && (
            <Link href="/leads" style={linkStyle("/leads")}>
              {showContent ? "LEADS" : ""}
            </Link>
          )}
          {show.appointments && (
            <Link href="/appointment" style={linkStyle("/appointment")}>
              {showContent ? "APPOINTMENTS" : ""}
            </Link>
          )}
          {show.dentist && (
            <Link href="/dentist" style={linkStyle("/dentist")}>
              {showContent ? "DENTISTS" : ""}
            </Link>
          )}
          {show.ortho && (
            <Link href="/ortho" style={linkStyle("/ortho")}>
              {showContent ? "ORTHODONTISTS" : ""}
            </Link>
          )}
          {show.patients && (
            <Link href="/patients" style={linkStyle("/patients")}>
              {showContent ? "PATIENTS" : ""}
            </Link>
          )}
          {show.templates && (
            <Link href="/templates" style={{
              ...linkStyle("/templates"),
              ...(path.startsWith("/templates") ? { background: "#ffffff90" } : {}),
            }}>
              {showContent ? "MESSAGE TEMPLATES" : ""}
            </Link>
          )}
          {show.calculator && (
            <Link href="/calculator" style={{
              ...linkStyle("/calculator"),
              ...(path.startsWith("/calculator") ? { background: "#ffffff90" } : {}),
            }}>
              {showContent ? "EMI CALCULATOR" : ""}
            </Link>
          )}
          {show.audit && (
            <Link href="/audit" style={{
              ...linkStyle("/audit"),
              ...(path.startsWith("/audit") ? { background: "#ffffff90" } : {}),
            }}>
              {showContent ? "AUDIT LOG" : ""}
            </Link>
          )}
        </div>

        {/* ── BOTTOM: logout ── */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            width: "100%", padding: "11px 14px",
            borderRadius: "10px",
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#dc2626",
            fontWeight: "700", fontSize: "13px",
            letterSpacing: "0.5px",
            cursor: loggingOut ? "not-allowed" : "pointer",
            opacity: loggingOut ? 0.6 : 1,
            textAlign: "center",
          }}
        >
          {!showContent && !isMobile ? "↩" : loggingOut ? "Logging out..." : "LOGOUT"}
        </button>
      </div>
    </>
  );
}
