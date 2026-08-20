"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

const input = {
  width: "100%", padding: "11px 12px", borderRadius: "10px", border: "1px solid #e5e7eb",
  fontSize: "14px", outline: "none", background: "white", color: "#111827", boxSizing: "border-box",
};
const label = { display: "block", fontSize: "11px", fontWeight: "700", color: "#6b7280", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" };

const EMPTY_FORM = { name: "", designation: "", registration_number: "", location: "", role_type: "dentist" };

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  const fetchDoctors = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("doctors").select("*").order("created_at", { ascending: false });
    if (error) console.error("Error loading doctors:", error);
    setDoctors(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchDoctors(); }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const addDoctor = async () => {
    if (!form.name.trim()) { alert("Enter the doctor's name."); return; }
    if (!form.designation.trim()) { alert("Enter a designation (e.g. BDS, MDS Orthodontics)."); return; }
    setAdding(true);
    const { error } = await supabase.from("doctors").insert([{
      name: form.name.trim(),
      designation: form.designation.trim(),
      registration_number: form.registration_number.trim() || null,
      location: form.location.trim() || null,
      role_type: form.role_type,
    }]);
    setAdding(false);
    if (error) { alert("Failed to add doctor: " + error.message); return; }
    setForm(EMPTY_FORM);
    fetchDoctors();
  };

  const toggleActive = async (doctor) => {
    setDoctors((prev) => prev.map((d) => (d.id === doctor.id ? { ...d, active: !d.active } : d)));
    const { error } = await supabase.from("doctors").update({ active: !doctor.active }).eq("id", doctor.id);
    if (error) { alert("Failed to update: " + error.message); fetchDoctors(); }
  };

  const deleteDoctor = async (doctor) => {
    if (!window.confirm(`Permanently delete ${doctor.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("doctors").delete().eq("id", doctor.id);
    if (error) { alert("Failed to delete: " + error.message); return; }
    setDoctors((prev) => prev.filter((d) => d.id !== doctor.id));
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Loading doctors...</div>;

  return (
    <div style={{ padding: "24px", maxWidth: "820px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>Doctors</h1>
        <p style={{ fontSize: "14px", color: "#6b7280", margin: "4px 0 0" }}>
          {doctors.length} {doctors.length === 1 ? "doctor" : "doctors"} · used to assign a reviewer to an Online Smile Report, and (once wired up) as dentist/orthodontist assignment options elsewhere.
        </p>
      </div>

      {/* Add doctor */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#111827" }}>Add a Doctor</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <div>
            <span style={label}>Name</span>
            <input style={input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Dr. Jane Doe" />
          </div>
          <div>
            <span style={label}>Designation</span>
            <input style={input} value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. BDS, MDS (Orthodontics)" />
          </div>
          <div>
            <span style={label}>Registration Number</span>
            <input style={input} value={form.registration_number} onChange={(e) => set("registration_number", e.target.value)} placeholder="e.g. OSDC-12345" />
          </div>
          <div>
            <span style={label}>Location</span>
            <input style={input} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Bhubaneswar" />
          </div>
          <div>
            <span style={label}>Role</span>
            <select style={input} value={form.role_type} onChange={(e) => set("role_type", e.target.value)}>
              <option value="dentist">Dentist</option>
              <option value="orthodontist">Orthodontist</option>
            </select>
          </div>
        </div>
        <button
          onClick={addDoctor}
          disabled={adding}
          style={{ padding: "12px 22px", borderRadius: "10px", border: "none", background: "#b8905a", color: "white", fontWeight: "700", fontSize: "14px", cursor: adding ? "not-allowed" : "pointer", opacity: adding ? 0.6 : 1 }}
        >
          {adding ? "Adding..." : "Add Doctor"}
        </button>
      </div>

      {/* Doctor list */}
      {doctors.length === 0 ? (
        <div style={{ padding: "40px 24px", background: "white", borderRadius: "12px", border: "1px solid #e5e7eb", textAlign: "center", color: "#9ca3af" }}>
          No doctors yet. Add one above.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {doctors.map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "15px", fontWeight: "800", color: "#111827" }}>{d.name}</span>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "99px", background: d.role_type === "dentist" ? "#dbeafe" : "#ede9fe", color: d.role_type === "dentist" ? "#1d4ed8" : "#6d28d9", fontSize: "11px", fontWeight: "700", textTransform: "capitalize" }}>
                    {d.role_type}
                  </span>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "99px", background: d.active ? "#dcfce7" : "#f3f4f6", color: d.active ? "#16a34a" : "#9ca3af", fontSize: "11px", fontWeight: "700" }}>
                    {d.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
                  {d.designation}{d.location ? ` · ${d.location}` : ""}{d.registration_number ? ` · Reg. No: ${d.registration_number}` : ""}
                </p>
              </div>
              <button
                onClick={() => toggleActive(d)}
                style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {d.active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => deleteDoctor(d)}
                style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
