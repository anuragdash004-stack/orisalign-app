"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase.from("appointments").select("*");
    setAppointments(data || []);
  };

  const stats = {
    total: appointments.length,
    pending: appointments.filter(a => a.status === "new").length,
    assigned: appointments.filter(a => a.status === "assigned").length,
    completed: appointments.filter(a => a.status === "completed").length,
    cancelled: appointments.filter(a => a.status === "cancelled").length,
  };

  const card = (title, value, color) => ({
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

        <div style={card("Total", stats.total, "#38bdf8")}>
          <h4>Total</h4>
          <h2>{stats.total}</h2>
        </div>

        <div style={card("Pending", stats.pending, "#facc15")}>
          <h4>Pending</h4>
          <h2>{stats.pending}</h2>
        </div>

        <div style={card("Assigned", stats.assigned, "#60a5fa")}>
          <h4>Assigned</h4>
          <h2>{stats.assigned}</h2>
        </div>

        <div style={card("Completed", stats.completed, "#22c55e")}>
          <h4>Completed</h4>
          <h2>{stats.completed}</h2>
        </div>

        <div style={card("Cancelled", stats.cancelled, "#ef4444")}>
          <h4>Cancelled</h4>
          <h2>{stats.cancelled}</h2>
        </div>

      </div>
    </div>
  );
}