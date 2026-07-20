"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

// Which path prefixes each role may visit
const ROLE_ALLOWED = {
  admin:        ["/admin", "/appointment", "/dentist", "/ortho", "/patients", "/leads", "/templates", "/calculator", "/coupons", "/campaigns", "/audit", "/lmc"],
  counselor:    ["/admin", "/appointment", "/campaigns", "/leads"],
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

  // Patient journey pages and checkout are public — no auth required
  const isPublicPage =
    path === "/patient" || path?.startsWith("/patient/") || path?.startsWith("/checkout");

  // Patient journey pages are public — no sidebar
  const isPublicPatientPage = path === "/patient" || path?.startsWith("/patient/");

  // Role-based route guard (skipped entirely for public pages)
  //
  // Uses getSession() rather than getUser(): getSession() reads the session
  // straight out of the configured storage (localStorage when "Keep me
  // logged in" was checked) and only hits the network if the access token
  // has actually expired. getUser() unconditionally makes a live request to
  // re-verify the user — on a cold full browser restart that request can
  // race the client's own session-restore-from-storage step, or simply blip
  // on a not-yet-warm network connection, and either way looked identical to
  // "not logged in" and bounced straight back to /login even though a
  // perfectly valid remembered session was sitting in localStorage.
  useEffect(() => {
    if (isPublicPage) return;
    const check = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { router.replace("/login"); return; }
      const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
      const role = data?.role || "";
      const allowed = ROLE_ALLOWED[role] || [];
      const permitted = allowed.some((prefix) => path.startsWith(prefix));
      if (!permitted) {
        router.replace(ROLE_HOME[role] || "/login");
      }
    };
    check();
  }, [path, isPublicPage]);

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
