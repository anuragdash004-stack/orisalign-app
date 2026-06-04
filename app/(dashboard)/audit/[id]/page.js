"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";

const supabase = getSupabaseClient();

export default function PatientAuditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [{ data: appt }, { data: logData }] = await Promise.all([
        supabase.from("appointments_booking").select("id, name, phone, email, status").eq("id", id).single(),
        fetch(`/api/audit-log?appointmentId=${id}`).then((r) => r.json()),
      ]);
      setPatient(appt || null);
      setLogs(logData?.logs || []);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <p style={{ padding: "20px", color: "#6b7280" }}>Loading audit log...</p>;
  if (!patient) return <p style={{ padding: "20px", color: "#dc2626" }}>Patient not found.</p>;

  const shortId = id.substring(0, 8).toUpperCase();

  const filtered = logs.filter((log) => {
    const q = search.toLowerCase();
    return (
      (log.action || "").toLowerCase().includes(q) ||
      (log.actor_email || "").toLowerCase().includes(q) ||
      (log.actor_role || "").toLowerCase().includes(q) ||
      (log.entity || "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: "800px" }}>

      {/* Back */}
      <button
        onClick={() => router.push("/audit")}
        style={{ background: "none", border: "none", color: "#b8905a", fontSize: "13px", fontWeight: "700", cursor: "pointer", padding: 0, marginBottom: "14px", letterSpacing: "0.5px" }}
      >
        ← Back to Audit Log
      </button>

      {/* Patient header */}
      <div style={{
        background: "white", borderRadius: "14px", border: "1px solid #e5e7eb",
        padding: "18px 22px", marginBottom: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap",
      }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          background: "linear-gradient(135deg, #b8905a, #f59e0b)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: "800", fontSize: "20px", flexShrink: 0,
        }}>
          {(patient.name || "P")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: "0 0 2px", fontSize: "18px", color: "#111827" }}>{patient.name || "Unnamed Patient"}</h1>
          <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
            ID: <strong style={{ color: "#374151", fontFamily: "monospace", letterSpacing: "1px" }}>{shortId}</strong>
            {patient.phone ? ` · ${patient.phone}` : ""}
            {patient.email ? ` · ${patient.email}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            padding: "4px 12px", borderRadius: "99px",
            background: "#fef3c7", color: "#92400e",
            fontSize: "12px", fontWeight: "700",
          }}>
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </span>
          <button
            onClick={() => router.push(`/patients/${id}`)}
            style={{
              padding: "7px 14px", borderRadius: "8px", border: "1px solid #e5e7eb",
              background: "white", color: "#374151", fontWeight: "700",
              fontSize: "12px", cursor: "pointer", letterSpacing: "0.3px",
            }}
          >
            View Patient →
          </button>
        </div>
      </div>

      {/* Search */}
      {logs.length > 0 && (
        <input
          type="text"
          placeholder="Filter by action, actor, field..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: "10px",
            border: "1px solid #e5e7eb", fontSize: "14px",
            outline: "none", marginBottom: "16px",
            boxSizing: "border-box", background: "white", color: "#111827",
          }}
        />
      )}

      {/* Log entries */}
      {filtered.length === 0 ? (
        <div style={{
          background: "white", borderRadius: "14px", border: "1px solid #e5e7eb",
          padding: "40px 24px", textAlign: "center",
        }}>
          <p style={{ margin: 0, color: "#9ca3af", fontStyle: "italic" }}>
            {logs.length === 0 ? "No audit entries yet for this patient." : "No entries match your search."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map((log, i) => {
            const isOpen = expanded === log.id;
            const ts = new Date(log.created_at);
            const tsStr = ts.toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "2-digit", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit", second: "2-digit",
            });

            return (
              <div key={log.id} style={{
                background: "white", borderRadius: "12px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden",
              }}>
                {/* Row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                  style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer" }}
                >
                  {/* Index */}
                  <div style={{
                    width: "34px", height: "34px", borderRadius: "8px",
                    background: "#f3f4f6", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: "800", color: "#6b7280",
                  }}>
                    {logs.length - logs.indexOf(log)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>
                      {log.action}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#6b7280", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontWeight: "600", color: "#374151" }}>{log.actor_email || "Unknown"}</span>
                      <span style={{
                        background: "#f3f4f6", padding: "1px 7px", borderRadius: "4px",
                        fontWeight: "700", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.5px", color: "#374151",
                      }}>
                        {log.actor_role || "—"}
                      </span>
                      <span>{tsStr}</span>
                    </p>
                  </div>

                  {/* Entity pill */}
                  {log.entity && (
                    <span style={{
                      flexShrink: 0, padding: "3px 10px", borderRadius: "6px",
                      background: "#eff6ff", color: "#1d4ed8",
                      fontSize: "11px", fontWeight: "700", letterSpacing: "0.3px",
                    }}>
                      {log.entity}
                    </span>
                  )}

                  <span style={{ fontSize: "12px", color: "#9ca3af", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid #f3f4f6", padding: "16px 18px", background: "#fafafa", display: "flex", flexDirection: "column", gap: "14px" }}>
                    {log.new_data && (
                      <div>
                        <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Saved Data
                        </p>
                        <pre style={{
                          margin: 0, background: "white", borderRadius: "8px",
                          padding: "12px", fontSize: "11px", color: "#374151",
                          border: "1px solid #e5e7eb", overflow: "auto",
                          maxHeight: "280px", fontFamily: "monospace", lineHeight: "1.7",
                        }}>
                          {JSON.stringify(log.new_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.old_data && (
                      <div>
                        <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Previous Data (before this edit)
                        </p>
                        <pre style={{
                          margin: 0, background: "white", borderRadius: "8px",
                          padding: "12px", fontSize: "11px", color: "#9ca3af",
                          border: "1px solid #e5e7eb", overflow: "auto",
                          maxHeight: "280px", fontFamily: "monospace", lineHeight: "1.7",
                        }}>
                          {JSON.stringify(log.old_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
