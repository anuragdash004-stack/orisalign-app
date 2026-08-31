"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const supabase = getSupabaseClient();

export default function AuditIndexPage() {
  const [appointments, setAppointments] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const { data: appts } = await supabase
        .from("appointments_booking")
        .select("id, name, phone, email, date, time, status")
        .order("created_at", { ascending: false });

      setAppointments(appts || []);

      // Fetch audit entry counts per appointment
      const { data: logCounts } = await supabase
        .from("audit_log")
        .select("appointment_id");

      if (logCounts) {
        const map = {};
        logCounts.forEach(({ appointment_id }) => {
          map[appointment_id] = (map[appointment_id] || 0) + 1;
        });
        setCounts(map);
      }

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

  if (loading) return <p style={{ padding: "20px", color: "var(--admin-ink2, #837a66)" }}>Loading...</p>;

  return (
    <div style={{ maxWidth: "720px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "22px", color: "var(--admin-ink, #1b2a4a)" }}>Audit Log</h1>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--admin-ink2, #837a66)" }}>
          Admin-only · Immutable record of every save action across all patients
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name, phone or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "10px 14px", borderRadius: "10px",
          border: "1px solid var(--admin-line, #e9e1d0)", fontSize: "14px",
          outline: "none", marginBottom: "20px",
          boxSizing: "border-box", background: "white", color: "var(--admin-ink, #1b2a4a)",
        }}
      />

      {filtered.length === 0 ? (
        <p style={{ color: "var(--admin-ink2, #837a66)", fontStyle: "italic" }}>No patients found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((appt) => {
            const shortId = appt.id.substring(0, 8).toUpperCase();
            const count = counts[appt.id] || 0;

            return (
              <div
                key={appt.id}
                onClick={() => router.push(`/audit/${appt.id}`)}
                style={{
                  background: "white", border: "1px solid var(--admin-line, #e9e1d0)",
                  borderRadius: "14px", padding: "16px 20px",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                  display: "flex", alignItems: "center", gap: "14px",
                  cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--admin-gold, #b8905a)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-line, #e9e1d0)"; e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.04)"; }}
              >
                {/* Avatar */}
                <div style={{
                  width: "42px", height: "42px", borderRadius: "50%",
                  background: "var(--admin-gold-strong, #a9762e)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontWeight: "800", fontSize: "17px", flexShrink: 0,
                }}>
                  {(appt.name || "P")[0].toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--admin-ink, #1b2a4a)" }}>
                    {appt.name || "Unnamed"}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--admin-ink2, #837a66)" }}>
                    ID: {shortId}
                    {appt.phone ? ` · ${appt.phone}` : ""}
                    {appt.email ? ` · ${appt.email}` : ""}
                  </p>
                </div>

                {/* Audit count badge */}
                <div style={{
                  flexShrink: 0, textAlign: "right",
                }}>
                  {count > 0 ? (
                    <span style={{
                      display: "inline-block", padding: "4px 12px",
                      borderRadius: "99px", background: "#fef3c7",
                      color: "#92400e", fontSize: "12px", fontWeight: "700",
                    }}>
                      {count} {count === 1 ? "entry" : "entries"}
                    </span>
                  ) : (
                    <span style={{
                      display: "inline-block", padding: "4px 12px",
                      borderRadius: "99px", background: "var(--admin-gold-wash, #f3f0e6)",
                      color: "var(--admin-ink2, #837a66)", fontSize: "12px", fontWeight: "600",
                    }}>
                      No entries
                    </span>
                  )}
                </div>

                <div style={{ color: "var(--admin-gold, #b8905a)", fontSize: "18px", flexShrink: 0 }}>›</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
