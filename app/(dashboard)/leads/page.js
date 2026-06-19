"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupedLeads, setGroupedLeads] = useState({});

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments_booking")
        .select("id, name, phone, email, created_at, status, lead_verified")
        .eq("status", "lead")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setLeads(data || []);
      groupLeadsByDate(data || []);
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  };

  const groupLeadsByDate = (leadsData) => {
    const grouped = {};

    leadsData.forEach((lead) => {
      const date = new Date(lead.created_at);
      const monthYear = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      const dayDate = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      if (!grouped[monthYear]) {
        grouped[monthYear] = {};
      }
      if (!grouped[monthYear][dayDate]) {
        grouped[monthYear][dayDate] = [];
      }

      grouped[monthYear][dayDate].push(lead);
    });

    setGroupedLeads(grouped);
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return "N/A";
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  };

  if (loading) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <p style={{ fontSize: "16px", color: "#6b7280" }}>Loading leads...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>
          Booking Leads
        </h1>
        <p style={{ fontSize: "14px", color: "#6b7280", margin: "4px 0 0" }}>
          Total: {leads.length} leads
          {"  ·  "}
          <span style={{ color: "#16a34a", fontWeight: "700" }}>{leads.filter((l) => l.lead_verified).length} verified</span>
          {"  ·  "}
          <span style={{ color: "#b45309", fontWeight: "700" }}>{leads.filter((l) => !l.lead_verified).length} unverified</span>
        </p>
      </div>

      {leads.length === 0 ? (
        <div
          style={{
            padding: "40px 24px",
            background: "white",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "16px", color: "#9ca3af", margin: 0 }}>
            No leads yet
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "24px" }}>
          {Object.entries(groupedLeads).map(([monthYear, dayGroups]) => (
            <div
              key={monthYear}
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              {/* Month Header */}
              <div
                style={{
                  padding: "16px 20px",
                  background: "#f8f7f5",
                  borderBottom: "1px solid #e5e7eb",
                  fontWeight: "700",
                  fontSize: "14px",
                  color: "#111827",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                📅 {monthYear}
              </div>

              <div style={{ padding: "0" }}>
                {Object.entries(dayGroups).map(([dayDate, dayLeads], dayIndex) => (
                  <div key={dayDate} style={{ borderBottom: dayIndex < Object.keys(dayGroups).length - 1 ? "1px solid #e5e7eb" : "none" }}>
                    {/* Day Header */}
                    <div
                      style={{
                        padding: "12px 20px",
                        background: "#fafafa",
                        borderBottom: "1px solid #e5e7eb",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      📆 {dayDate}
                    </div>

                    {/* Leads for this day */}
                    <div style={{ padding: "0" }}>
                      {dayLeads.map((lead, index) => (
                        <div
                          key={lead.id}
                          style={{
                            padding: "14px 20px",
                            borderBottom:
                              index < dayLeads.length - 1
                                ? "1px solid #f3f4f6"
                                : "none",
                            background: index % 2 === 0 ? "white" : "#fafafa",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "auto 1fr",
                              gap: "16px",
                              alignItems: "start",
                            }}
                          >
                            {/* Lead ID */}
                            <div
                              style={{
                                padding: "6px 10px",
                                background: "#b8905a",
                                color: "white",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "700",
                                whiteSpace: "nowrap",
                              }}
                            >
                              #{lead.id.substring(0, 8).toUpperCase()}
                            </div>

                            {/* Lead Info */}
                            <div style={{ display: "grid", gap: "6px" }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "14px",
                                  fontWeight: "700",
                                  color: "#111827",
                                }}
                              >
                                {lead.name}
                              </p>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "auto auto",
                                  gap: "16px",
                                  fontSize: "12px",
                                  color: "#6b7280",
                                }}
                              >
                                <div>
                                  <span style={{ fontWeight: "600" }}>📱</span>{" "}
                                  {lead.phone}
                                </div>
                                <div>
                                  <span style={{ fontWeight: "600" }}>✉️</span>{" "}
                                  {lead.email}
                                </div>
                              </div>
                              <div style={{ marginTop: "6px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "4px 10px",
                                    background: lead.lead_verified ? "#d1fae5" : "#fef3c7",
                                    color: lead.lead_verified ? "#065f46" : "#92400e",
                                    border: `1px solid ${lead.lead_verified ? "#6ee7b7" : "#fcd34d"}`,
                                    borderRadius: "99px",
                                    fontSize: "10px",
                                    fontWeight: "700",
                                    letterSpacing: "0.3px",
                                  }}
                                >
                                  {lead.lead_verified ? "✓ Verified" : "🕗 Unverified"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          div {
            font-size: calc(100% - 2px);
          }
        }
      `}</style>
    </div>
  );
}
