"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

// Which path prefixes each role may visit
const ROLE_ALLOWED = {
  admin:        ["/admin", "/appointment", "/dentist", "/ortho", "/patients", "/leads", "/audit"],
  counselor:    ["/appointment", "/patients"],
  dentist:      ["/dentist"],
  orthodontist: ["/ortho"],
};

// Where to land after login
const ROLE_HOME = {
  admin:        "/admin",
  counselor:    "/appointment",
  dentist:      "/dentist",
  orthodontist: "/ortho",
};

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const path = usePathname();
  const router = useRouter();

  // Role-based route guard
  useEffect(() => {
    const check = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) { router.replace("/login"); return; }
      const { data } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
      const role = data?.role || "";
      const allowed = ROLE_ALLOWED[role] || [];
      const permitted = allowed.some((prefix) => path.startsWith(prefix));
      if (!permitted && !path.startsWith("/patient") && !path.startsWith("/checkout")) {
        router.replace(ROLE_HOME[role] || "/login");
      }
    };
    check();
  }, [path]);

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
