"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const path = usePathname();

  // Patient journey pages are public — no sidebar
  const isPublicPatientPage = path === "/patient" || path?.startsWith("/patient/");

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isPublicPatientPage) {
    return (
      <div className="pattern-bg" style={{ minHeight: "100vh", backgroundColor: "#faf7f2" }}>
        {children}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100vw", minHeight: "100vh" }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="pattern-bg" style={{
        flex: 1,
        minHeight: "100vh",
        width: 0,
        backgroundColor: "#f8f6f2",
        padding: isMobile ? "60px 14px 24px" : "24px",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}>
        {children}
      </div>
    </div>
  );
}
