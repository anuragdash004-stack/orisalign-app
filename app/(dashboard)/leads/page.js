"use client";

import { useState, useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

const STAGES = [
  { key: "fresh",     label: "Fresh Leads" },
  { key: "followups", label: "Follow-ups" },
  { key: "callback",  label: "Call Back" },
  { key: "booked",    label: "Booked" },
  { key: "denied",    label: "Denied" },
];

const SOURCE_OPTIONS = [
  { value: "website",    label: "Website" },
  { value: "meta_ads",   label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "walk_in",    label: "Walk-in" },
  { value: "referral",   label: "Referral" },
  { value: "others",     label: "Others" },
];
const sourceLabel = (v) => SOURCE_OPTIONS.find((s) => s.value === v)?.label || "Website";

const RESPONSE_OPTIONS = [
  { value: "responded",   label: "Responded" },
  { value: "no_response", label: "No Response" },
  { value: "callback",    label: "Call Back" },
];
const responseLabel = (v) => RESPONSE_OPTIONS.find((r) => r.value === v)?.label || "—";

const CONSULT_OPTIONS = [
  { value: "home",   label: "🏠 Home Consultation" },
  { value: "clinic", label: "🏥 Clinic Consultation" },
  { value: "online", label: "💻 Video Consultation" },
];
const CLINIC_OPTIONS = ["Nayapalli", "Patia"];
const SEX_OPTIONS = ["MALE", "FEMALE", "OTHERS"];
const TIME_SLOTS = ["9 AM", "11 AM", "3:30 PM", "5:30 PM"];
const CHIEF_COMPLAINTS = [
  "Crowding — misalignment of teeth",
  "Spacing — gaps in between teeth",
  "Deep bite — upper teeth overlap lower teeth",
  "Underbite — upper teeth close inside lower teeth",
  "Open bite — gap between upper and lower teeth on biting",
  "General smile improvement",
  "Others",
];

function parseProblem(problem) {
  const m = (problem || "").match(/^\[(\w+)\]\s*(.*)$/);
  if (m) return { consultationType: m[1].toLowerCase(), complaint: m[2] };
  return { consultationType: "", complaint: problem || "" };
}

const EMPTY_FORM = {
  lead_source: "walk_in", lead_response: "", name: "", age: "", phone: "", alt_phone: "",
  address: "", sex: "", email: "", complaint: "", lead_notes: "", consultationType: "",
  clinic_location: "", date: "", time: "", lead_stage: "fresh",
};

const input = {
  width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e5e7eb",
  fontSize: "14px", outline: "none", background: "white", color: "#111827", boxSizing: "border-box",
};
const label = { display: "block", fontSize: "11px", fontWeight: "700", color: "#6b7280", marginBottom: "5px", letterSpacing: "0.4px", textTransform: "uppercase" };

export default function LeadTrackerPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date())); // defaults to today; "all" or YYYY-MM-DD
  const [editing, setEditing] = useState(null); // null or { mode: "normal"|"cold", lead: leadObj|null }
  const [view, setView] = useState("tracker"); // "tracker" | "cold"
  const [actor, setActor] = useState(null);
  const todayRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: roleData } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
        setActor({ email: authData.user.email || null, role: roleData?.role || "admin" });
      }
      await fetchLeads();
    };
    init();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments_booking")
      .select("*")
      .eq("status", "lead")
      .order("created_at", { ascending: false });
    if (error) console.error("Error fetching leads:", error);
    setLeads(data || []);
    setLoading(false);
  };

  const stageOf = (lead) => lead.lead_stage || "fresh";

  const quickStage = async (lead, newStage) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, lead_stage: newStage } : l)));
    await supabase.from("appointments_booking").update({ lead_stage: newStage }).eq("id", lead.id);
  };

  // Cold lead → promote into the live tracker as a Fresh lead.
  const promoteToLead = async (lead) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, lead_stage: "fresh" } : l)));
    await supabase.from("appointments_booking").update({ lead_stage: "fresh" }).eq("id", lead.id);
  };

  // Permanently remove a lead from the system.
  const deleteLead = async (lead) => {
    const who = lead.name || lead.phone || lead.email || `#${lead.lead_number || ""}`;
    if (!window.confirm(`Permanently delete this lead (${who})? This cannot be undone.`)) return;
    const { error } = await supabase.from("appointments_booking").delete().eq("id", lead.id);
    if (error) { alert("Failed to delete: " + error.message); return; }
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
  };

  const coldLeads = leads.filter((l) => stageOf(l) === "cold");
  const pipelineLeads = leads.filter((l) => stageOf(l) !== "cold");

  // Calendar strip: 14 days back → 7 days forward, today centered/highlighted.
  const today = new Date();
  const tKey = dateKey(today);
  const stripDates = [];
  for (let i = -14; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    stripDates.push(d);
  }

  // Bring "today" into view in the horizontal strip once loaded.
  useEffect(() => {
    if (!loading) todayRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [loading]);

  const visibleLeads = selectedDate === "all"
    ? pipelineLeads
    : pipelineLeads.filter((l) => dateKey(l.created_at) === selectedDate);

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Loading lead tracker...</div>;

  // ── Cold leads view ──
  if (view === "cold") {
    return (
      <div style={{ padding: "24px", maxWidth: "1100px" }}>
        <button onClick={() => setView("tracker")} style={{ background: "none", border: "none", color: "#b8905a", fontSize: "13px", fontWeight: "700", cursor: "pointer", padding: 0, marginBottom: "12px", letterSpacing: "0.5px" }}>
          ← Back to Tracker
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>Cold Leads</h1>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: "4px 0 0" }}>{coldLeads.length} cold {coldLeads.length === 1 ? "lead" : "leads"} · add a cold lead to the live tracker when you reconnect</p>
          </div>
          <button
            onClick={() => setEditing({ mode: "cold", lead: null })}
            style={{ padding: "11px 20px", borderRadius: "10px", border: "none", background: "#64748b", color: "white", fontWeight: "700", fontSize: "13px", cursor: "pointer", letterSpacing: "0.5px" }}
          >
            + Add Cold Lead
          </button>
        </div>
        {coldLeads.length === 0 ? (
          <div style={{ padding: "40px 24px", background: "white", borderRadius: "12px", border: "1px solid #e5e7eb", textAlign: "center", color: "#9ca3af" }}>
            No cold leads yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {coldLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} cold onPromote={() => promoteToLead(lead)} onEdit={() => setEditing({ mode: "cold", lead })} onDelete={() => deleteLead(lead)} />
            ))}
          </div>
        )}
        {editing && (
          <LeadForm lead={editing.lead} mode={editing.mode} actor={actor} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchLeads(); }} />
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>Lead Tracker</h1>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: "4px 0 0" }}>{pipelineLeads.length} total leads in the pipeline</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => setView("cold")}
            style={{ padding: "11px 18px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "white", color: "#475569", fontWeight: "700", fontSize: "13px", cursor: "pointer", letterSpacing: "0.5px" }}
          >
            Cold Leads ({coldLeads.length})
          </button>
          <button
            onClick={() => setEditing({ mode: "normal", lead: null })}
            style={{ padding: "11px 20px", borderRadius: "10px", border: "none", background: "#b8905a", color: "white", fontWeight: "700", fontSize: "13px", cursor: "pointer", letterSpacing: "0.5px" }}
          >
            + Add Lead
          </button>
        </div>
      </div>

      {/* Calendar row */}
      <div style={{ display: "flex", gap: "6px", overflowX: "auto", padding: "4px 2px 12px" }}>
        <DateChip active={selectedDate === "all"} onClick={() => setSelectedDate("all")} top="" mid="All" bot="dates" />
        {stripDates.map((d) => {
          const k = dateKey(d);
          const isToday = k === tKey;
          return (
            <span key={k} ref={isToday ? todayRef : null}>
              <DateChip
                active={selectedDate === k}
                today={isToday}
                onClick={() => setSelectedDate(k)}
                top={d.toLocaleDateString("en-US", { weekday: "short" })}
                mid={d.getDate()}
                bot={d.toLocaleDateString("en-US", { month: "short" })}
              />
            </span>
          );
        })}
      </div>
      <p style={{ fontSize: "12px", color: "#9ca3af", margin: "2px 0 20px" }}>
        {selectedDate === "all"
          ? "Showing all leads"
          : `Showing leads from ${new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
        {"  ·  "}{visibleLeads.length} {visibleLeads.length === 1 ? "lead" : "leads"}
      </p>

      {/* All stages, stacked one after another */}
      <div style={{ display: "grid", gap: "22px" }}>
        {STAGES.map((s) => {
          const list = visibleLeads.filter((l) => stageOf(l) === s.key);
          return (
            <div key={s.key}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#111827" }}>{s.label}</h2>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#6b7280", background: "#f3f4f6", borderRadius: "99px", padding: "2px 10px" }}>{list.length}</span>
                <div style={{ flex: 1, height: "1px", background: "#eee" }} />
              </div>
              {list.length === 0 ? (
                <div style={{ padding: "14px", background: "white", border: "1px dashed #e5e7eb", borderRadius: "12px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>No leads</div>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {list.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onStage={quickStage} onEdit={() => setEditing({ mode: "normal", lead })} onDelete={() => deleteLead(lead)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <LeadForm
          lead={editing.lead}
          mode={editing.mode}
          actor={actor}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchLeads(); }}
        />
      )}
    </div>
  );
}

function dateKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function DateChip({ active, today, onClick, top, mid, bot }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, minWidth: "52px", padding: "8px 6px", borderRadius: "12px", cursor: "pointer",
        border: active ? "none" : today ? "1px solid #b8905a" : "1px solid #e5e7eb",
        background: active ? "#111827" : today ? "#fff7ed" : "white",
        color: active ? "white" : today ? "#b8905a" : "#374151",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "1px", lineHeight: 1.2,
      }}
    >
      <span style={{ fontSize: "10px", fontWeight: 600, opacity: 0.8 }}>{top}</span>
      <span style={{ fontSize: "16px", fontWeight: 800 }}>{mid}</span>
      <span style={{ fontSize: "10px", fontWeight: 600, opacity: 0.8 }}>{bot}</span>
    </button>
  );
}

function LeadCard({ lead, onStage, onEdit, cold, onPromote, onDelete }) {
  const stage = lead.lead_stage || "fresh";
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
            <span style={{ fontFamily: "monospace", fontWeight: "800", color: "#b8905a", fontSize: "13px" }}>#{lead.lead_number || "—"}</span>
            <span style={{ fontSize: "15px", fontWeight: "700", color: "#111827" }}>{lead.name || "Unnamed"}</span>
            {lead.booking_confirmed && <span style={pill("#dcfce7", "#16a34a")}>✓ Patient ID issued</span>}
          </div>
          <div style={{ fontSize: "13px", color: "#6b7280", display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <span>📱 {lead.phone || "N/A"}</span>
            {lead.email && <span>✉️ {lead.email}</span>}
          </div>
          <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span style={pill("#eef2ff", "#4338ca")}>{sourceLabel(lead.lead_source)}</span>
            {lead.lead_response && <span style={pill("#fef3c7", "#92400e")}>{responseLabel(lead.lead_response)}</span>}
            {lead.lead_source === "website" && (
              <span style={pill(lead.lead_verified ? "#dcfce7" : "#fef3c7", lead.lead_verified ? "#065f46" : "#92400e")}>
                {lead.lead_verified ? "✓ Verified" : "🕗 Unverified"}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
          {cold ? (
            <button
              onClick={onPromote}
              style={{ padding: "7px 14px", borderRadius: "8px", border: "none", background: "#16a34a", color: "white", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              + Add to Lead
            </button>
          ) : (
            <select
              value={stage}
              onChange={(e) => onStage(lead, e.target.value)}
              style={{ ...input, width: "auto", padding: "6px 10px", fontSize: "12px", cursor: "pointer" }}
            >
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          )}
          <button
            onClick={onEdit}
            style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
          >
            View / Edit
          </button>
          <button
            onClick={onDelete}
            style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function pill(bg, color) {
  return { display: "inline-block", padding: "3px 9px", borderRadius: "99px", background: bg, color, fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" };
}

function LeadForm({ lead, actor, onClose, onSaved, mode = "normal" }) {
  const isCold = mode === "cold";
  const [form, setForm] = useState(() => {
    if (!lead) return { ...EMPTY_FORM, lead_stage: isCold ? "cold" : "fresh" };
    const { consultationType, complaint } = parseProblem(lead.problem);
    return {
      lead_source: lead.lead_source || "website",
      lead_response: lead.lead_response || "",
      name: lead.name || "", age: lead.age || "", phone: lead.phone || "",
      alt_phone: lead.alt_phone || "", address: lead.address || "", sex: lead.sex || "",
      email: lead.email || "", complaint, lead_notes: lead.lead_notes || "",
      consultationType, clinic_location: lead.clinic_location || "",
      date: lead.date || "", time: lead.time || "", lead_stage: lead.lead_stage || "fresh",
    };
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const buildPayload = (stageOverride, confirm) => {
    const problem = form.consultationType
      ? `[${form.consultationType.toUpperCase()}] ${form.complaint}`
      : form.complaint;
    return {
      name: form.name || null, age: form.age || null, sex: form.sex || null,
      phone: form.phone || null, alt_phone: form.alt_phone || null, email: form.email || null,
      address: form.address || null, problem: problem || null, lead_notes: form.lead_notes || null,
      lead_source: form.lead_source, lead_response: form.lead_response || null,
      lead_stage: stageOverride || form.lead_stage,
      clinic_location: form.consultationType === "clinic" ? (form.clinic_location || null) : null,
      date: form.date || null, time: form.time || null,
      ...(confirm ? { booking_confirmed: true } : {}),
    };
  };

  const save = async (opts = {}) => {
    if (!form.name && !form.phone && !form.email) {
      alert("Add at least one detail — a name, phone number, or email — to save the lead.");
      return;
    }
    const confirm = !!opts.confirm;
    setSaving(true);
    try {
      const payload = buildPayload(confirm ? "booked" : null, confirm);
      let leadId = lead?.id;
      if (lead) {
        const { error } = await supabase.from("appointments_booking").update(payload).eq("id", lead.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("appointments_booking")
          .insert([{ ...payload, status: "lead", lead_verified: false }])
          .select("id")
          .single();
        if (error) throw error;
        leadId = data?.id;
      }
      // On first confirmation, issue the Patient ID via the welcome email.
      if (confirm && !lead?.booking_confirmed && form.email && leadId) {
        fetch("/api/send-welcome-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, name: form.name || "Patient", patientId: leadId }),
        }).catch(() => {});
      }
      onSaved();
    } catch (err) {
      alert("Failed to save: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: "24px", overflowY: "auto" }}>
      <div style={{ background: "white", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "560px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
            {lead ? `${isCold ? "Cold Lead" : "Lead"} #${lead.lead_number || ""}` : isCold ? "Add Cold Lead" : "Add New Lead"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "22px", color: "#9ca3af", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <span style={label}>Lead Source</span>
            <select style={input} value={form.lead_source} onChange={(e) => set("lead_source", e.target.value)}>
              {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <span style={label}>Response</span>
            <select style={input} value={form.lead_response} onChange={(e) => set("lead_response", e.target.value)}>
              <option value="">— Select —</option>
              {RESPONSE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <span style={label}>Name</span>
            <input style={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <span style={label}>Age</span>
            <input style={input} type="number" value={form.age} onChange={(e) => set("age", e.target.value)} />
          </div>
          <div>
            <span style={label}>Phone</span>
            <input style={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <span style={label}>Alternative Number</span>
            <input style={input} value={form.alt_phone} onChange={(e) => set("alt_phone", e.target.value)} />
          </div>
          <div>
            <span style={label}>Email</span>
            <input style={input} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <span style={label}>Sex</span>
            <select style={input} value={form.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="">— Select —</option>
              {SEX_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>Address</span>
            <textarea style={{ ...input, minHeight: "56px", resize: "vertical" }} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>Complaint / Problem</span>
            <select style={input} value={form.complaint} onChange={(e) => set("complaint", e.target.value)}>
              <option value="">— Select —</option>
              {CHIEF_COMPLAINTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>Notes</span>
            <textarea style={{ ...input, minHeight: "56px", resize: "vertical" }} value={form.lead_notes} onChange={(e) => set("lead_notes", e.target.value)} placeholder="Anything extra to remember about this lead..." />
          </div>
          <div>
            <span style={label}>Consultation Type</span>
            <select style={input} value={form.consultationType} onChange={(e) => set("consultationType", e.target.value)}>
              <option value="">— Select —</option>
              {CONSULT_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {form.consultationType === "clinic" && (
            <div>
              <span style={label}>Clinic</span>
              <select style={input} value={form.clinic_location} onChange={(e) => set("clinic_location", e.target.value)}>
                <option value="">— Select —</option>
                {CLINIC_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div>
            <span style={label}>Preferred Date</span>
            <input style={input} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <span style={label}>Preferred Timing</span>
            <select style={input} value={form.time} onChange={(e) => set("time", e.target.value)}>
              <option value="">— Select —</option>
              {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {!isCold && (
            <div>
              <span style={label}>Stage</span>
              <select style={input} value={form.lead_stage} onChange={(e) => set("lead_stage", e.target.value)}>
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "22px", flexWrap: "wrap" }}>
          <button
            onClick={() => save()}
            disabled={saving}
            style={{ flex: 1, minWidth: "120px", padding: "12px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: "700", fontSize: "14px", cursor: saving ? "not-allowed" : "pointer" }}
          >
            {saving ? "Saving..." : lead ? "Save Changes" : isCold ? "Add Cold Lead" : "Add Lead"}
          </button>
          {!isCold && (
            <button
              onClick={() => save({ confirm: true })}
              disabled={saving}
              style={{ flex: 1, minWidth: "120px", padding: "12px", borderRadius: "10px", border: "none", background: "#16a34a", color: "white", fontWeight: "700", fontSize: "14px", cursor: saving ? "not-allowed" : "pointer" }}
            >
              {lead?.booking_confirmed ? "Update (Booked)" : "Confirm Lead → Booked"}
            </button>
          )}
        </div>
        {!isCold && !lead?.booking_confirmed && (
          <p style={{ margin: "10px 0 0", fontSize: "11px", color: "#9ca3af", textAlign: "center" }}>
            Confirming moves the lead to <strong>Booked</strong>, adds it to Appointments, and issues a Patient ID (emailed if an address is on file).
          </p>
        )}
        {isCold && (
          <p style={{ margin: "10px 0 0", fontSize: "11px", color: "#9ca3af", textAlign: "center" }}>
            Cold leads stay separate. Use <strong>+ Add to Lead</strong> on a cold lead to move it into the live tracker as a Fresh lead.
          </p>
        )}
      </div>
    </div>
  );
}
