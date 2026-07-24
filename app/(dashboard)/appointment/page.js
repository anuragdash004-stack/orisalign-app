"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { logAudit } from "@/lib/logAudit";

const supabase = getSupabaseClient();

export default function AppointmentPage() {
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [formData, setFormData] = useState({});
  const [showAssign, setShowAssign] = useState(null);
  const [dentists, setDentists] = useState([]);
  const [orthodontists, setOrthodontists] = useState([]);
  const [selectedDentist, setSelectedDentist] = useState("");
  const [selectedOrtho, setSelectedOrtho] = useState("");
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState("");

  const dentistMap = Object.fromEntries(dentists.map((d) => [d.id, d.email]));
  const orthoMap = Object.fromEntries(orthodontists.map((o) => [o.id, o.email]));

  const fetchAppointments = useCallback(async () => {
    if (!user || !userRole) return;

    let query = supabase
      .from("appointments_booking")
      .select("*")
      // Only booked appointments — every booking (website or manual) now
      // enters as a lead first, so booking_confirmed=true (set by "Confirm
      // Lead → Booked" in the Lead Tracker) is the sole gate here. Leads
      // still in the pipeline (fresh / follow-up / call-back / denied) stay
      // in the Lead Tracker until they are confirmed.
      .eq("booking_confirmed", true)
      // Sort by when the lead was actually confirmed into a booking, not
      // when it first entered the pipeline as a lead — otherwise a lead
      // sitting around for weeks jumps in based on its old creation date
      // instead of showing up newest-first for whoever just booked it.
      .order("booking_confirmed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    // 👑 ADMIN → see everything
    // 🧾 COUNSELLOR → see everything (they manage appointments)
    if (userRole === "admin" || userRole === "counsellor") {
      // no filter
    } else if (userRole === "dentist") {
      query = query.eq("assigned_dentist", user.id);
    } else if (userRole === "orthodontist") {
      query = query.eq("assigned_ortho", user.id);
    }

    if (filter === "pending") query = query.eq("status", "pending");
    if (filter === "assigned") query = query.eq("status", "assigned");
    if (filter === "confirmed") query = query.eq("status", "confirmed");

    const { data, error } = await query;
    if (error) { console.error("Error loading appointments:", error); setAppointments([]); }
    else setAppointments(data || []);
    setLoading(false);
  }, [user, userRole, filter]);

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) { console.error("User fetch error:", error); return; }
      setUser(data.user);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchRole = async () => {
      const { data, error } = await supabase
        .from("users").select("role").eq("id", user.id).single();
      if (error) { console.error("Role fetch error:", error); return; }
      setUserRole(data?.role || "");
    };
    fetchRole();
  }, [user]);

  useEffect(() => {
    const loadUsers = async () => {
      const { data, error } = await supabase.from("users").select("*");
      if (error) { console.error("Users fetch error:", error); return; }
      setDentists(data?.filter((u) => u.role === "dentist") || []);
      setOrthodontists(data?.filter((u) => u.role === "orthodontist") || []);
    };
    loadUsers();
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const handleEdit = (appt) => { setEditingId(appt.id); setFormData(appt); };

  const handleSave = async () => {
    const { name, phone, email, age, sex, address, problem, date, time } = formData;
    const { error } = await supabase
      .from("appointments_booking")
      .update({ name, phone, email, age, sex, address, problem, date, time })
      .eq("id", editingId);
    if (error) { alert("Update failed"); return; }
    logAudit({ appointmentId: editingId, actor: { email: user?.email, role: userRole }, action: "Patient Details Updated", entity: "patient_details", newData: { name, phone, email, age, sex, address, problem, date, time } });
    setEditingId(null);
    fetchAppointments();
  };

  const handleConfirm = async (id) => {
    const target = appointments.find((a) => a.id === id);
    const newJourneySteps = { ...(target?.journey_steps || {}), confirmed: true };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ status: "confirmed", journey_steps: newJourneySteps })
      .eq("id", id);
    if (error) { alert("Confirm failed"); return; }
    logAudit({ appointmentId: id, actor: { email: user?.email, role: userRole }, action: "Appointment Confirmed", entity: "status", newData: { status: "confirmed" } });
    fetch("/api/notify-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: id, stepKey: "confirmed", email: target?.email || null }),
    }).catch(() => {});
    alert("Appointment confirmed!");
    fetchAppointments();
  };

  const handlePostpone = async (id) => {
    const newDate = prompt("Enter new date (YYYY-MM-DD)");
    if (!newDate) return;
    const { error } = await supabase
      .from("appointments_booking").update({ date: newDate, status: "pending" }).eq("id", id);
    if (error) { alert("Postpone failed"); return; }
    logAudit({ appointmentId: id, actor: { email: user?.email, role: userRole }, action: "Appointment Postponed", entity: "appointment_date", newData: { date: newDate, status: "pending" } });
    fetchAppointments();
  };

  const handleAssignConfirm = async (id) => {
    if (!selectedDentist || !selectedOrtho) { alert("Select both dentist and orthodontist"); return; }
    const { error } = await supabase
      .from("appointments_booking")
      .update({
        assigned_dentist: String(selectedDentist),
        assigned_ortho: String(selectedOrtho),
        assigned_at: new Date().toISOString(),
        status: "assigned",
      })
      .eq("id", id).select();
    if (error) { alert("Assignment failed"); return; }
    logAudit({ appointmentId: id, actor: { email: user?.email, role: userRole }, action: "Assigned to Dentist and Orthodontist", entity: "assignment", newData: { assigned_dentist: dentistMap[selectedDentist], assigned_ortho: orthoMap[selectedOrtho], status: "assigned" } });
    setShowAssign(null);
    setSelectedDentist("");
    setSelectedOrtho("");
    fetchAppointments();
  };

  // ✅ CANCEL — admin only
  const handleCancel = async (id) => {
    const confirmed = window.confirm("Cancel this appointment? This cannot be undone.");
    if (!confirmed) return;
    const { error } = await supabase
      .from("appointments_booking").update({ status: "cancelled" }).eq("id", id);
    if (error) { alert("Cancel failed"); return; }
    logAudit({ appointmentId: id, actor: { email: user?.email, role: userRole }, action: "Appointment Cancelled", entity: "status", newData: { status: "cancelled" } });
    fetchAppointments();
  };

  // 🗑️ DELETE — admin only
  const handleDelete = async (id) => {
    const confirmed = window.confirm("Permanently DELETE this appointment? This cannot be undone.");
    if (!confirmed) return;
    const { error } = await supabase
      .from("appointments_booking").delete().eq("id", id);
    if (error) { alert("Delete failed: " + error.message); return; }
    fetchAppointments();
  };

  const canEdit = userRole === "admin" || userRole === "counsellor";

  return (
    <div>
      <h1 style={{ color: "#111827" }}>Appointments</h1>

      {/* FILTER TABS */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {["all", "pending", "assigned", "confirmed"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: "99px", border: "1px solid #e5e7eb",
            background: filter === f ? "#111827" : "white",
            color: filter === f ? "white" : "#374151",
            cursor: "pointer", fontSize: "13px", fontWeight: "500",
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <p>Loading appointments...</p> : appointments.length === 0 ? <p>No appointments found.</p> : (
        <div style={{ display: "grid", gap: "14px" }}>
          {appointments.map((appointment) => {
            const isOpen = expandedId === appointment.id || editingId === appointment.id;
            return (
            <div key={appointment.id} style={{
              background: appointment.status === "cancelled" ? "#fef2f2" : "white",
              border: `1px solid ${appointment.status === "cancelled" ? "#fecaca" : "#e5e7eb"}`,
              borderRadius: "16px", padding: "16px 20px", color: "#111827",
              boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
            }}>
              {/* Collapsible header — name + appointment date/time only */}
              <div
                onClick={() => setExpandedId(isOpen ? null : appointment.id)}
                style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: "17px", color: "#111827" }}>{appointment.name || "Unnamed patient"}</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
                    📅 {[appointment.date, appointment.time].filter(Boolean).join(" at ") || "No date/time set"}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                  <span style={{
                    fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px",
                    background: appointment.status === "confirmed" ? "#dcfce7" : appointment.status === "cancelled" ? "#fee2e2" : "#fef9c3",
                    color: appointment.status === "confirmed" ? "#16a34a" : appointment.status === "cancelled" ? "#dc2626" : "#854d0e",
                  }}>
                    {(appointment.status || "pending").toUpperCase()}
                  </span>
                  <span style={{ color: "#9ca3af", fontSize: "13px" }}>{isOpen ? "▲" : "▼"}</span>
                </div>
              </div>

              {!isOpen ? null : (
              <div style={{ marginTop: "16px", borderTop: "1px solid #f3f4f6", paddingTop: "16px" }}>
              {editingId === appointment.id ? (
                <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
                  {[
                    ["Name", "name", "text"], ["Phone", "phone", "tel"], ["Email", "email", "email"],
                    ["Age", "age", "number"], ["Gender", "sex", "text"], ["Date", "date", "date"], ["Time", "time", "text"],
                  ].map(([label, key, type]) => (
                    <div key={key} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase" }}>{label}</label>
                      <input type={type} value={formData[key] || ""} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", color: "#111", background: "white", width: "100%", boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase" }}>Chief Complaint / Problem</label>
                    <textarea value={formData.problem || ""} onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", color: "#111", background: "white", width: "100%", boxSizing: "border-box", minHeight: "70px", resize: "vertical" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase" }}>Address / Location</label>
                    <textarea value={formData.address || ""} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", color: "#111", background: "white", width: "100%", boxSizing: "border-box", minHeight: "60px", resize: "vertical" }} />
                  </div>
                  <button onClick={handleSave} style={{ padding: "10px", borderRadius: "8px", background: "#16a34a", color: "white", fontWeight: "700", border: "none", cursor: "pointer", fontSize: "14px" }}>
                    Save Changes
                  </button>
                  <button onClick={() => setEditingId(null)} style={{ padding: "8px", borderRadius: "8px", background: "#f3f4f6", color: "#374151", fontWeight: "600", border: "none", cursor: "pointer", fontSize: "13px" }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {userRole !== "orthodontist" && (
                      <>
                        <div style={{ background: "#f8f7f5", borderRadius: "8px", padding: "8px 12px" }}>
                          <p style={{ margin: 0, fontSize: "10px", color: "#9ca3af", fontWeight: "700", textTransform: "uppercase" }}>Phone</p>
                          <a href={`tel:${appointment.phone}`} style={{ fontSize: "14px", fontWeight: "600", color: "#1B2A4A", textDecoration: "none" }}>{appointment.phone || "N/A"}</a>
                        </div>
                        <div style={{ background: "#f8f7f5", borderRadius: "8px", padding: "8px 12px" }}>
                          <p style={{ margin: 0, fontSize: "10px", color: "#9ca3af", fontWeight: "700", textTransform: "uppercase" }}>Email</p>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#1B2A4A", wordBreak: "break-all" }}>{appointment.email || "N/A"}</p>
                        </div>
                      </>
                    )}
                    <div style={{ background: "#f8f7f5", borderRadius: "8px", padding: "8px 12px" }}>
                      <p style={{ margin: 0, fontSize: "10px", color: "#9ca3af", fontWeight: "700", textTransform: "uppercase" }}>Age / Gender</p>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#111" }}>{appointment.age || "N/A"} / {appointment.sex || "N/A"}</p>
                    </div>
                    <div style={{ background: "#f8f7f5", borderRadius: "8px", padding: "8px 12px" }}>
                      <p style={{ margin: 0, fontSize: "10px", color: "#9ca3af", fontWeight: "700", textTransform: "uppercase" }}>Date & Time</p>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#111" }}>{[appointment.date, appointment.time].filter(Boolean).join(" at ") || "N/A"}</p>
                    </div>
                  </div>
                  {appointment.problem && (
                    <div style={{ marginTop: "8px", background: "#fffbeb", borderRadius: "8px", padding: "10px 12px", border: "1px solid #fde68a" }}>
                      <p style={{ margin: 0, fontSize: "10px", color: "#92400e", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Chief Complaint</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>{appointment.problem}</p>
                    </div>
                  )}
                  {appointment.address && (
                    <div style={{ marginTop: "8px", background: "#f8f7f5", borderRadius: "8px", padding: "10px 12px" }}>
                      <p style={{ margin: 0, fontSize: "10px", color: "#9ca3af", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Address / Location</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>
                        {appointment.address.split(" | ").map((part, i) => {
                          if (part.startsWith("Maps: http")) {
                            const url = part.replace("Maps: ", "");
                            return <span key={i}><a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#1B2A4A", fontWeight: "700", textDecoration: "underline" }}>📍 View on Google Maps</a></span>;
                          }
                          return <span key={i}>{i > 0 ? " · " : ""}{part}</span>;
                        })}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Assignment info */}
              <div style={{ marginTop: "10px", background: "#f8f7f5", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#6b7280" }}>
                <div>Assigned at: {appointment.assigned_at ? new Date(appointment.assigned_at).toLocaleString() : "N/A"}</div>
                <div>Dentist: {dentistMap[appointment.assigned_dentist] || "N/A"}</div>
                <div>Ortho: {orthoMap[appointment.assigned_ortho] || "N/A"}</div>
              </div>

              {/* ACTION BUTTONS */}
              {!canEdit ? (
                <p style={{ marginTop: "10px", color: "gray" }}>Assigned Case (View Only)</p>
              ) : appointment.status === "cancelled" ? (
                <>
                  <p style={{ marginTop: "10px", color: "#dc2626", fontSize: "13px" }}>This appointment has been cancelled.</p>
                  {userRole === "admin" && (
                    <button
                      onClick={() => handleDelete(appointment.id)}
                      style={{
                        marginTop: "8px", padding: "6px 14px", borderRadius: "8px",
                        border: "1px solid #fca5a5", background: "#fee2e2",
                        color: "#b91c1c", cursor: "pointer", fontSize: "13px", fontWeight: "700",
                      }}
                    >
                      Delete Permanently
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap", alignItems: "center" }}>
                    <button onClick={() => handleEdit(appointment)}>Edit</button>
                    <button onClick={() => handlePostpone(appointment.id)}>Postpone</button>
                    <button onClick={() => setShowAssign(appointment.id)}>Assign</button>
                    <button onClick={() => handleConfirm(appointment.id)}>Confirm</button>

                    {userRole === "admin" && (
                      <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                        <button
                          onClick={() => handleCancel(appointment.id)}
                          style={{
                            padding: "6px 14px", borderRadius: "8px",
                            border: "1px solid #fecaca", background: "#fef2f2",
                            color: "#dc2626", cursor: "pointer", fontSize: "13px", fontWeight: "600",
                          }}
                        >
                          Cancel Appointment
                        </button>
                        <button
                          onClick={() => handleDelete(appointment.id)}
                          style={{
                            padding: "6px 14px", borderRadius: "8px",
                            border: "1px solid #fca5a5", background: "#fee2e2",
                            color: "#b91c1c", cursor: "pointer", fontSize: "13px", fontWeight: "700",
                          }}
                        >
                          Delete Permanently
                        </button>
                      </div>
                    )}
                  </div>

                  {showAssign === appointment.id && (
                    <div style={{ marginTop: "12px" }}>
                      <select value={selectedDentist} onChange={(e) => setSelectedDentist(e.target.value)}>
                        <option value="">Select Dentist</option>
                        {dentists.map((d) => <option key={d.id} value={d.id}>{d.email}</option>)}
                      </select>
                      {selectedDentist && (
                        <button onClick={() => setSelectedDentist("")} title="Clear" style={{ marginLeft: "6px", padding: "4px 10px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>✕</button>
                      )}
                      <select value={selectedOrtho} onChange={(e) => setSelectedOrtho(e.target.value)} style={{ marginLeft: "8px" }}>
                        <option value="">Select Orthodontist</option>
                        {orthodontists.map((o) => <option key={o.id} value={o.id}>{o.email}</option>)}
                      </select>
                      {selectedOrtho && (
                        <button onClick={() => setSelectedOrtho("")} title="Clear" style={{ marginLeft: "6px", padding: "4px 10px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>✕</button>
                      )}
                      <button onClick={() => handleAssignConfirm(appointment.id)} style={{ marginLeft: "8px" }}>Confirm Assignment</button>
                    </div>
                  )}
                </>
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
