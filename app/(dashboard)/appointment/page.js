"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

export default function AppointmentPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("created_at", { ascending: false });

      if (!active) {
        return;
      }

      if (error) {
        console.error("Failed to load appointments:", error);
        setAppointments([]);
      } else {
        setAppointments(data || []);
      }

      setLoading(false);
    }

    loadAppointments();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: "20px" }}>Appointments</h1>

      {loading ? (
        <p>Loading appointments...</p>
      ) : appointments.length === 0 ? (
        <p>No appointments found.</p>
      ) : (
        <div style={{ display: "grid", gap: "14px" }}>
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "12px",
                padding: "16px",
                color: "white",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <strong>{appointment.name || "Unnamed patient"}</strong>
                <span>{appointment.status || "pending"}</span>
              </div>

              <p style={{ marginTop: "10px" }}>
                Phone: {appointment.phone || "N/A"}
              </p>
              <p>Email: {appointment.email || "N/A"}</p>
              <p>Doctor: {appointment.doctor || "N/A"}</p>
              <p>
                Time: {[appointment.date, appointment.time]
                  .filter(Boolean)
                  .join(" ") || "N/A"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
