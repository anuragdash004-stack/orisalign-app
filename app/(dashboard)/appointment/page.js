"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AppointmentPage() {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    const { data } = await supabase.from("appointments").select("*").order("created_at", { ascending: false });
    setAppointments(data || []);
  };

  const updateStatus = async (id, status) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    fetchAppointments();
  };

  const cardStyle = {
    background: "rgba(15, 23, 42, 0.9)",
    padding: "20px",
    borderRadius: "14px",
    marginBottom: "15px",
    border: "1px solid #1e293b",
    backdropFilter: "blur(10px)"
  };

  const statusColor = (status) => {
    if (status === "new") return "#facc15";
    if (status === "assigned") return "#60a5fa";
    if (status === "completed") return "#22c55e";
    if (status === "cancelled") return "#ef4444";
    return "#94a3b8";
  };

  return (
    <div>
      <h1 style={{ marginBottom: "20px" }}>Appointments 📅</h1>

      {appointments.map((a) => (
        <div key={a.id} style={cardStyle}>

          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3>{a.name} ({a.age})</h3>
            <span style={{
              padding: "4px 10px",
              borderRadius: "8px",
              background: statusColor(a.status),
              color: "#000",
              fontWeight: "600"
            }}>
              {a.status || "new"}
            </span>
          </div>

          <p>📞 {a.phone}</p>
          <p>📝 {a.complaint}</p>

          {/* ACTIONS */}
          <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
            <button onClick={() => updateStatus(a.id, "assigned")}>
              Assign
            </button>

            <button onClick={() => updateStatus(a.id, "completed")} style={{ background: "#22c55e" }}>
              Complete
            </button>

            <button onClick={() => updateStatus(a.id, "cancelled")} style={{ background: "#ef4444" }}>
              Cancel
            </button>
          </div>

        </div>
      ))}
    </div>
  );
}