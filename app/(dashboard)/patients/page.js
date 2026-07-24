"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const supabase = getSupabaseClient();

const STATUS_STYLE = {
  pending:   { bg: "#fef9c3", color: "#854d0e" },
  assigned:  { bg: "#dbeafe", color: "#1e40af" },
  confirmed: { bg: "#dcfce7", color: "#16a34a" },
  completed: { bg: "#f3f4f6", color: "#6b7280" },
  cancelled: { bg: "#fee2e2", color: "#dc2626" },
};

export default function PatientsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const router = useRouter();
  // All roles (admin, counsellor, dentist, orthodontist) can access this page

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("appointments_booking")
        .select("*")
        // Confirmed and completed appointments — booked-but-unconfirmed ones
        // stay on the Appointment page until the admin confirms them, but
        // once confirmed a case stays visible here through completion.
        .in("status", ["confirmed", "completed"])
        // Sort by when the lead was actually confirmed into a booking, not
        // when it first entered the pipeline as a lead.
        .order("booking_confirmed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) console.error(error);
      setAppointments(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = appointments.filter((a) => {
    const q = search.toLowerCase();
    return (
      (a.name || "").toLowerCase().includes(q) ||
      (a.phone || "").includes(q) ||
      (a.email || "").toLowerCase().includes(q)
    );
  });

  if (loading) return <p>Loading patients...</p>;

  return (
    <div>
      <h1 style={{ marginBottom: "6px" }}>Patients</h1>
      <p style={{ color: "gray", fontSize: "13px", marginBottom: "20px" }}>
        {appointments.length} total appointments
      </p>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name, phone or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%", maxWidth: "400px",
          padding: "10px 14px", borderRadius: "10px",
          border: "1px solid #e5e7eb", fontSize: "14px",
          outline: "none", marginBottom: "20px",
          boxSizing: "border-box", background: "white",
          color: "#111827",
        }}
      />

      {filtered.length === 0 ? (
        <p style={{ color: "gray" }}>No patients found.</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {filtered.map((appt) => {
            const shortId = appt.id.substring(0, 8).toUpperCase();
            const statusStyle = STATUS_STYLE[appt.status] || STATUS_STYLE.pending;

            return (
              <div
                key={appt.id}
                onClick={() => router.push(`/patients/${appt.id}`)}
                style={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "16px",
                  padding: "18px 20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                  cursor: "pointer",
                  transition: "box-shadow 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; e.currentTarget.style.borderColor = "#b8905a"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
              >
                {/* Avatar */}
                <div style={{
                  width: "44px", height: "44px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #b8905a, #f59e0b)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontWeight: "800", fontSize: "18px", flexShrink: 0,
                }}>
                  {(appt.name || "P")[0].toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: "160px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "15px", color: "#111827" }}>
                      {appt.name || "Unnamed"}
                    </strong>
                    <span style={{
                      fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                      borderRadius: "99px", background: statusStyle.bg, color: statusStyle.color,
                    }}>
                      {appt.status?.toUpperCase() || "PENDING"}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                    {appt.phone || "No phone"} {appt.email ? `• ${appt.email}` : ""}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9ca3af" }}>
                    ID: {shortId} &nbsp;•&nbsp; {[appt.date, appt.time].filter(Boolean).join(" ") || "No date"}
                  </p>
                </div>

                <div style={{ color: "#b8905a", fontSize: "18px", flexShrink: 0 }}>›</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
