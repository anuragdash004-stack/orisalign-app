"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

// ✅ FIX 5 — moved outside component so it's not recreated on every render
const card = (color) => ({
  flex: "1",
  minWidth: "180px",
  background: "#0f172a",
  padding: "20px",
  borderRadius: "14px",
  border: `1px solid ${color}`,
  boxShadow: "0 0 20px rgba(0,0,0,0.3)",
  transition: "0.3s",
});

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);
  // ✅ FIX 3 — loading state so we don't flash 0s while fetching
  const [loading, setLoading] = useState(true);
  // ✅ FIX 4 — error state
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      const { data, error } = await supabase
        .from("appointments_booking")
        .select("*");

      if (!active) return;

      // ✅ FIX 4 — handle fetch errors
      if (error) {
        console.error("Dashboard fetch error:", error);
        setError("Failed to load appointments.");
        setLoading(false);
        return;
      }

      setAppointments(data || []);
      setLoading(false);
    }

    loadAppointments();

    return () => {
      active = false;
    };
  }, []);

  const stats = {
    total: appointments.length,
    // ✅ FIX 1 — was "new", your app uses "pending"
    pending: appointments.filter((a) => a.status === "pending").length,
    assigned: appointments.filter((a) => a.status === "assigned").length,
    // ✅ FIX 2 — was "completed", your app uses "confirmed"
    confirmed: appointments.filter((a) => a.status === "confirmed").length,
    cancelled: appointments.filter((a) => a.status === "cancelled").length,
  };

  if (loading) return <p>Loading dashboard...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  const StatCard = ({ color, label, value }) => (
    <div style={card(color)}>
      <h4 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "600", color: "#94a3b8", letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</h4>
      <h2 style={{ margin: 0, fontSize: "36px", fontWeight: "800", color }}>{value}</h2>
    </div>
  );

  return (
    <div>
      <h1 style={{ marginBottom: "20px", color: "#111827" }}>Dashboard</h1>

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        <StatCard color="#38bdf8" label="Total" value={stats.total} />
        <StatCard color="#facc15" label="Pending" value={stats.pending} />
        <StatCard color="#60a5fa" label="Assigned" value={stats.assigned} />
        <StatCard color="#22c55e" label="Confirmed" value={stats.confirmed} />
        <StatCard color="#ef4444" label="Cancelled" value={stats.cancelled} />
      </div>
    </div>
  );
}
