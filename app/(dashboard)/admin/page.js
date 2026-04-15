"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      const { data } = await supabase.from("appointments").select("*");
      if (active) {
        setAppointments(data || []);
      }
    }

    loadAppointments();

    return () => {
      active = false;
    };
  }, []);

  const stats = {
    total: appointments.length,
    pending: appointments.filter(a => a.status === "new").length,
    assigned: appointments.filter(a => a.status === "assigned").length,
    completed: appointments.filter(a => a.status === "completed").length,
    cancelled: appointments.filter(a => a.status === "cancelled").length,
  };

  const card = (color) => ({
    flex: "1",
    minWidth: "180px",
    background: "#0f172a",
    padding: "20px",
    borderRadius: "14px",
    border: `1px solid ${color}`,
    boxShadow: "0 0 20px rgba(0,0,0,0.3)",
    transition: "0.3s"
  });

  return (
    <div>
      <h1 style={{ marginBottom: "20px" }}>Dashboard </h1>

      <div style={{
        display: "flex",
        gap: "20px",
        flexWrap: "wrap"
      }}>

        <div style={card("#38bdf8")}>
          <h4>Total</h4>
          <h2>{stats.total}</h2>
        </div>

        <div style={card("#facc15")}>
          <h4>Pending</h4>
          <h2>{stats.pending}</h2>
        </div>

        <div style={card("#60a5fa")}>
          <h4>Assigned</h4>
          <h2>{stats.assigned}</h2>
        </div>

        <div style={card("#22c55e")}>
          <h4>Completed</h4>
          <h2>{stats.completed}</h2>
        </div>

        <div style={card("#ef4444")}>
          <h4>Cancelled</h4>
          <h2>{stats.cancelled}</h2>
        </div>

      </div>
    </div>
  );
}
