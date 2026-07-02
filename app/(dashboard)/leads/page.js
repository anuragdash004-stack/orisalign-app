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

// response is now free text — keep legacy lookup for old stored values
const LEGACY_RESPONSES = { responded: "Responded", no_response: "No Response", callback: "Call Back" };
const responseDisplay = (v) => LEGACY_RESPONSES[v] || v || "—";

const PRIORITY_OPTIONS = [
  { value: "hot",      label: "Hot" },
  { value: "moderate", label: "Moderate" },
  { value: "cold",     label: "Cold" },
];
const priorityLabel = (v) => PRIORITY_OPTIONS.find((p) => p.value === v)?.label || "—";
const priorityPillColor = (v) => v === "hot" ? ["#fee2e2", "#b91c1c"] : v === "moderate" ? ["#fef3c7", "#92400e"] : v === "cold" ? ["#dbeafe", "#1d4ed8"] : null;

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
  lead_source: "walk_in", lead_response: "", lead_priority: "", campaign_id: "", name: "", age: "", phone: "", alt_phone: "",
  address: "", sex: "", email: "", complaint: "", lead_notes: "", consultationType: "",
  clinic_location: "", date: "", time: "", callback_date: "", callback_time: "", lead_stage: "fresh",
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
  const [campaigns, setCampaigns] = useState([]);
  const [catered, setCatered] = useState([]); // appointments the dentist has OTP-started
  const [dentists, setDentists] = useState([]);
  const [calendarOffset, setCalendarOffset] = useState(0); // offset in days from today, snapped to multiples of 10
  const todayRef = useRef(null);

  const fetchCampaigns = async () => {
    const { data } = await supabase.from("campaigns").select("id, campaign_number").order("campaign_number", { ascending: true });
    setCampaigns(data || []);
  };

  // Catered = the dentist has verified the patient's OTP and started the
  // appointment. We pull everyone ever started and filter to "today" client
  // side (consistent with how the rest of this page treats dates).
  const fetchCatered = async () => {
    const { data, error } = await supabase
      .from("appointments_booking")
      .select("id, name, phone, assigned_dentist, appointment_started_at, status")
      .eq("appointment_started", true)
      .order("appointment_started_at", { ascending: false });
    if (error) console.error("Error fetching catered appointments:", error);
    setCatered(data || []);
  };

  const fetchDentists = async () => {
    const { data } = await supabase.from("users").select("id, email").eq("role", "dentist");
    setDentists(data || []);
  };

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: roleData } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
        setActor({ email: authData.user.email || null, role: roleData?.role || "admin" });
      }
      await fetchLeads();
      await fetchCampaigns();
      await fetchCatered();
      await fetchDentists();
    };
    init();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    // Once a lead is confirmed, it also shows up in Appointments and its
    // status there may advance past "lead" (e.g. to "confirmed"). It should
    // still show here under Booked, so match on booking_confirmed too —
    // not status alone.
    const { data, error } = await supabase
      .from("appointments_booking")
      .select("*")
      .or("status.eq.lead,booking_confirmed.eq.true")
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
  const isAdmin = actor?.role === "admin"; // Cold Leads are admin-only
  const dentistMap = Object.fromEntries(dentists.map((d) => [d.id, d.email]));
  // Follows the same date filter as the rest of the page — "all" shows
  // every catered appointment ever, otherwise just the selected day's.
  const cateredVisible = selectedDate === "all"
    ? catered
    : catered.filter((a) => dateKey(a.appointment_started_at) === selectedDate);

  // Calendar strip: 11 dates centred on today ± calendarOffset.
  // Left/right arrows shift by 10 days at a time.
  const today = new Date();
  const tKey = dateKey(today);
  const stripDates = [];
  for (let i = calendarOffset - 5; i <= calendarOffset + 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    stripDates.push(d);
  }

  const visibleLeads = selectedDate === "all"
    ? pipelineLeads
    : pipelineLeads.filter((l) => leadCalendarKey(l) === selectedDate);

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Loading lead tracker...</div>;

  // ── Cold leads view (admin only) ──
  if (view === "cold" && isAdmin) {
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
          <LeadTable leads={coldLeads} cold campaigns={campaigns} onPromote={promoteToLead} onEdit={(lead) => setEditing({ mode: "cold", lead })} onDelete={deleteLead} />
        )}
        {editing && (
          <LeadForm lead={editing.lead} mode={editing.mode} actor={actor} campaigns={campaigns} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchLeads(); }} />
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
          {isAdmin && (
            <button
              onClick={() => setView("cold")}
              style={{ padding: "11px 18px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "white", color: "#475569", fontWeight: "700", fontSize: "13px", cursor: "pointer", letterSpacing: "0.5px" }}
            >
              Cold Leads ({coldLeads.length})
            </button>
          )}
          <button
            onClick={() => setEditing({ mode: "normal", lead: null })}
            style={{ padding: "11px 20px", borderRadius: "10px", border: "none", background: "#b8905a", color: "white", fontWeight: "700", fontSize: "13px", cursor: "pointer", letterSpacing: "0.5px" }}
          >
            + Add Lead
          </button>
        </div>
      </div>

      {/* Calendar row — paginated, 11 dates at a time */}
      <style>{`
        .cal-scroll { overflow-x: auto; }
        .cal-scroll::-webkit-scrollbar { height: 6px; }
        .cal-scroll::-webkit-scrollbar-track { background: #f1ece3; border-radius: 4px; }
        .cal-scroll::-webkit-scrollbar-thumb { background: #b8905a; border-radius: 4px; }
        .cal-scroll::-webkit-scrollbar-thumb:hover { background: #a0754d; }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 2px 0" }}>
        {/* All-dates chip */}
        <DateChip active={selectedDate === "all"} onClick={() => setSelectedDate("all")} top="" mid="All" bot="dates" />

        {/* Left arrow */}
        <button
          onClick={() => setCalendarOffset((o) => o - 10)}
          style={{ flexShrink: 0, width: "32px", height: "52px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: "16px", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}
          aria-label="Previous dates"
        >‹</button>

        {/* 11 date chips — scrollable */}
        <div className="cal-scroll" style={{ display: "flex", gap: "6px", paddingBottom: "10px" }}>
          {stripDates.map((d) => {
            const k = dateKey(d);
            const isToday = k === tKey;
            return (
              <DateChip
                key={k}
                active={selectedDate === k}
                today={isToday}
                onClick={() => setSelectedDate(k)}
                top={d.toLocaleDateString("en-US", { weekday: "short" })}
                mid={d.getDate()}
                bot={d.toLocaleDateString("en-US", { month: "short" })}
              />
            );
          })}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => setCalendarOffset((o) => o + 10)}
          style={{ flexShrink: 0, width: "32px", height: "52px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: "16px", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}
          aria-label="Next dates"
        >›</button>
      </div>
      <p style={{ fontSize: "12px", color: "#9ca3af", margin: "2px 0 20px" }}>
        {selectedDate === "all"
          ? "Showing all leads"
          : `Showing leads from ${new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
        {"  ·  "}{visibleLeads.length} {visibleLeads.length === 1 ? "lead" : "leads"}
      </p>

      {/* Catered — the dentist has verified the patient's OTP and started the appointment, on the selected date */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#111827" }}>
            {selectedDate === "all" ? "Catered" : selectedDate === dateKey(new Date()) ? "Catered Today" : "Catered"}
          </h2>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a", background: "#dcfce7", borderRadius: "99px", padding: "2px 10px" }}>{cateredVisible.length}</span>
          <div style={{ flex: 1, height: "1px", background: "#eee" }} />
        </div>
        {cateredVisible.length === 0 ? (
          <div style={{ padding: "14px", background: "white", border: "1px dashed #e5e7eb", borderRadius: "12px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
            {selectedDate === "all" ? "No appointments started yet." : "No appointments started on this date."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {cateredVisible.map((a) => (
              <a
                key={a.id}
                href={`/patients/${a.id}`}
                style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", background: "white", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "10px 14px", textDecoration: "none" }}
              >
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#111827" }}>{a.name || "Unnamed"}</span>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>{a.phone || "—"}</span>
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>Dentist: {dentistMap[a.assigned_dentist] || "—"}</span>
                <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>
                  Started {a.appointment_started_at ? new Date(a.appointment_started_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : ""}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* All stages, stacked one after another */}
      <div style={{ display: "grid", gap: "22px" }}>
        {STAGES.map((s) => {
          let list;
          if (s.key === "fresh") {
            // Fresh Leads = every lead created on the selected date, regardless
            // of current stage. This lets you see all new entries for a day
            // while the lead's actual stage is also reflected below.
            list = selectedDate === "all"
              ? pipelineLeads
              : pipelineLeads.filter((l) => dateKey(l.created_at) === selectedDate);
          } else {
            list = visibleLeads.filter((l) => stageOf(l) === s.key);
          }
          if (s.key === "callback") {
            list = [...list].sort((a, b) => `${a.callback_date || ""} ${a.callback_time || ""}`.localeCompare(`${b.callback_date || ""} ${b.callback_time || ""}`));
          }
          return (
            <div key={s.key} style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#111827" }}>{s.label}</h2>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#6b7280", background: "#f3f4f6", borderRadius: "99px", padding: "2px 10px" }}>{list.length}</span>
                <div style={{ flex: 1, height: "1px", background: "#eee" }} />
              </div>
              {list.length === 0 ? (
                <div style={{ padding: "14px", background: "white", border: "1px dashed #e5e7eb", borderRadius: "12px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>No leads</div>
              ) : (
                <LeadTable leads={list} campaigns={campaigns} isAdmin={isAdmin} onStage={quickStage} onEdit={(lead) => setEditing({ mode: "normal", lead })} onDelete={deleteLead} />
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
          campaigns={campaigns}
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

// The date a lead belongs to in the calendar:
// - callbacks → their scheduled callback_date
// - booked → the date they were confirmed (booking_confirmed_at)
// - everyone else → the date they came in (created_at)
function leadCalendarKey(lead) {
  const stage = lead.lead_stage || "fresh";
  if (stage === "callback" && lead.callback_date) return dateKey(lead.callback_date);
  if (stage === "booked" && lead.booking_confirmed_at) return dateKey(lead.booking_confirmed_at);
  return dateKey(lead.created_at);
}

function formatTime(t) {
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (m) {
    let h = +m[1];
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m[2]} ${ap}`;
  }
  return t; // already like "9 AM"
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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
  const isCallback = stage === "callback";
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      {isCallback && (lead.callback_time || lead.callback_date) && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "8px 12px", marginBottom: "10px" }}>
          <span style={{ fontSize: "16px" }}>📞</span>
          <span style={{ fontSize: "15px", fontWeight: "800", color: "#b45309" }}>
            {formatTime(lead.callback_time) || "Time not set"}
          </span>
          {lead.callback_date && <span style={{ fontSize: "13px", fontWeight: "600", color: "#92400e" }}>· {formatDate(lead.callback_date)}</span>}
          <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: "700", color: "#9a6a2f", textTransform: "uppercase", letterSpacing: "0.4px" }}>Call Back</span>
        </div>
      )}
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
            {lead.call_history?.length > 0 && (
              <span style={pill("#f0fdf4", "#15803d")}>
                Last called: {formatDate(lead.call_history[lead.call_history.length - 1].date)}
              </span>
            )}
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

// Full tabular view of leads — every field in rows & columns, with the
// # and Name columns frozen on the left and a prominent horizontal scrollbar.
function LeadTable({ leads, onStage, onEdit, onDelete, cold, onPromote, campaigns = [], isAdmin = true }) {
  const campaignLabel = (id) => {
    const c = campaigns.find((x) => x.id === id);
    return c ? `Campaign ${c.campaign_number}` : "—";
  };
  const thBase = { padding: "9px 10px", textAlign: "left", fontSize: "10px", fontWeight: "800", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.4px", whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb", background: "#f1ece3" };
  const td = { padding: "9px 10px", fontSize: "12px", color: "#111827", whiteSpace: "nowrap", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" };
  const wrapTd = { ...td, whiteSpace: "normal", minWidth: "150px", maxWidth: "220px" };
  // Frozen left columns
  const numTh = { ...thBase, position: "sticky", left: 0, zIndex: 3, width: "52px", minWidth: "52px", boxShadow: "1px 0 0 #e5e7eb" };
  const nameTh = { ...thBase, position: "sticky", left: "52px", zIndex: 3, width: "150px", minWidth: "150px", boxShadow: "1px 0 0 #e5e7eb" };
  const numTd = { ...td, position: "sticky", left: 0, zIndex: 1, background: "white", width: "52px", minWidth: "52px", fontFamily: "monospace", fontWeight: 800, color: "#b8905a", boxShadow: "1px 0 0 #e5e7eb" };
  const nameTd = { ...td, position: "sticky", left: "52px", zIndex: 1, background: "white", width: "150px", minWidth: "150px", fontWeight: 700, boxShadow: "1px 0 0 #e5e7eb" };
  const miniBtn = (bg, color, border) => ({ padding: "5px 10px", borderRadius: "7px", border: border || "none", background: bg, color, fontWeight: "700", fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap" });

  return (
    <>
      <style>{`
        .lead-scroll { overflow-x: auto; overflow-y: hidden; }
        .lead-scroll::-webkit-scrollbar { height: 14px; }
        .lead-scroll::-webkit-scrollbar-track { background: #f1ece3; border-radius: 8px; }
        .lead-scroll::-webkit-scrollbar-thumb { background: #b8905a; border-radius: 8px; border: 3px solid #f1ece3; }
        .lead-scroll::-webkit-scrollbar-thumb:hover { background: #a0754d; }
      `}</style>
      <div className="lead-scroll" style={{ border: "1px solid #e5e7eb", borderRadius: "12px", background: "white" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "1500px" }}>
          <thead>
            <tr>
              <th style={numTh}>#</th>
              <th style={nameTh}>Name</th>
              {["Phone", "Alt #", "Email", "Age", "Sex", "Source", "Response", "Last Called", "Lead Status", "Campaign", "Complaint", "Consultation", "Clinic", "Consult Date", "Slot", "Callback", "Address", "Notes", "Verification", cold ? "Action" : "Stage", ""].map((h, i) => (
                <th key={i} style={thBase}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const { consultationType, complaint } = parseProblem(lead.problem);
              const consultLabel = CONSULT_OPTIONS.find((c) => c.value === consultationType)?.label || "—";
              const callback = (lead.callback_date || lead.callback_time) ? `${formatTime(lead.callback_time)}${lead.callback_date ? " · " + formatDate(lead.callback_date) : ""}`.trim() : "—";
              const status = lead.booking_confirmed
                ? "✓ Confirmed"
                : lead.lead_source === "website"
                  ? (lead.lead_verified ? "Verified" : "Unverified")
                  : "—";
              return (
                <tr key={lead.id}>
                  <td style={numTd}>#{lead.lead_number || "—"}</td>
                  <td style={nameTd}>{lead.name || "—"}</td>
                  <td style={td}>{lead.phone || "—"}</td>
                  <td style={td}>{lead.alt_phone || "—"}</td>
                  <td style={td}>{lead.email || "—"}</td>
                  <td style={td}>{lead.age || "—"}</td>
                  <td style={td}>{lead.sex || "—"}</td>
                  <td style={td}>{sourceLabel(lead.lead_source)}</td>
                  <td style={wrapTd}>{lead.lead_response ? responseDisplay(lead.lead_response) : "—"}</td>
                  <td style={td}>
                    {lead.call_history?.length > 0
                      ? formatDate(lead.call_history[lead.call_history.length - 1].date)
                      : "—"}
                  </td>
                  <td style={td}>
                    {lead.lead_priority ? (
                      <span style={pill(...priorityPillColor(lead.lead_priority))}>{priorityLabel(lead.lead_priority)}</span>
                    ) : "—"}
                  </td>
                  <td style={td}>{campaignLabel(lead.campaign_id)}</td>
                  <td style={wrapTd}>{complaint || "—"}</td>
                  <td style={td}>{consultLabel}</td>
                  <td style={td}>{lead.clinic_location || "—"}</td>
                  <td style={td}>{lead.date ? formatDate(lead.date) : "—"}</td>
                  <td style={td}>{lead.time || "—"}</td>
                  <td style={td}>{callback}</td>
                  <td style={wrapTd}>{lead.address || "—"}</td>
                  <td style={wrapTd}>{lead.lead_notes || "—"}</td>
                  <td style={td}>{status}</td>
                  <td style={td}>
                    {cold ? (
                      <button onClick={() => onPromote(lead)} style={miniBtn("#16a34a", "white")}>+ Add to Lead</button>
                    ) : (
                      <select
                        value={lead.lead_stage || "fresh"}
                        onChange={(e) => onStage(lead, e.target.value)}
                        style={{ padding: "5px 8px", borderRadius: "7px", border: "1px solid #e5e7eb", fontSize: "11px", cursor: "pointer", background: "white", color: "#111827" }}
                      >
                        {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => onEdit(lead)} style={miniBtn("white", "#111827", "1px solid #e5e7eb")}>Edit</button>
                      {isAdmin && <button onClick={() => onDelete(lead)} style={miniBtn("#fef2f2", "#dc2626", "1px solid #fecaca")}>Delete</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Wraps a single-choice control with a Cancel (✕) button when it has a value.
function Clearable({ show, onClear, children }) {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "stretch" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {show && (
        <button
          type="button"
          onClick={onClear}
          title="Clear selection"
          style={{ flexShrink: 0, padding: "0 12px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function LeadForm({ lead, actor, onClose, onSaved, mode = "normal", campaigns = [] }) {
  const isCold = mode === "cold";
  const [form, setForm] = useState(() => {
    if (!lead) return { ...EMPTY_FORM, lead_stage: isCold ? "cold" : "fresh" };
    const { consultationType, complaint } = parseProblem(lead.problem);
    return {
      lead_source: lead.lead_source || "website",
      lead_response: lead.lead_response || "",
      lead_priority: lead.lead_priority || "",
      campaign_id: lead.campaign_id || "",
      name: lead.name || "", age: lead.age || "", phone: lead.phone || "",
      alt_phone: lead.alt_phone || "", address: lead.address || "", sex: lead.sex || "",
      email: lead.email || "", complaint, lead_notes: lead.lead_notes || "",
      consultationType, clinic_location: lead.clinic_location || "",
      date: lead.date || "", time: lead.time || "",
      callback_date: lead.callback_date || "", callback_time: lead.callback_time || "",
      lead_stage: lead.lead_stage || "fresh",
    };
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isCallback = form.lead_stage === "callback";

  const buildPayload = (stageOverride, confirm) => {
    const problem = form.consultationType
      ? `[${form.consultationType.toUpperCase()}] ${form.complaint}`
      : form.complaint;
    return {
      name: form.name || null, age: form.age || null, sex: form.sex || null,
      phone: form.phone || null, alt_phone: form.alt_phone || null, email: form.email || null,
      address: form.address || null, problem: problem || null, lead_notes: form.lead_notes || null,
      lead_source: form.lead_source, lead_response: form.lead_response || null,
      lead_priority: form.lead_priority || null, campaign_id: form.campaign_id || null,
      lead_stage: stageOverride || form.lead_stage,
      clinic_location: form.consultationType === "clinic" ? (form.clinic_location || null) : null,
      date: form.date || null, time: form.time || null,
      callback_date: form.lead_stage === "callback" ? (form.callback_date || null) : null,
      callback_time: form.lead_stage === "callback" ? (form.callback_time || null) : null,
      ...(confirm ? { booking_confirmed: true, booking_confirmed_at: new Date().toISOString() } : {}),
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
      // Build call history — append a new entry whenever stage is callback/followups
      // and the response or next date has changed (avoid duplicate entries).
      const existingHistory = lead?.call_history || [];
      const isInteractionStage = form.lead_stage === "callback" || form.lead_stage === "followups";
      let newHistory = existingHistory;
      if (isInteractionStage && form.lead_response) {
        const responseChanged = form.lead_response !== (lead?.lead_response || "");
        const nextDateChanged = form.callback_date !== (lead?.callback_date || "");
        if (responseChanged || nextDateChanged || existingHistory.length === 0) {
          newHistory = [...existingHistory, {
            date: new Date().toISOString().slice(0, 10),
            response: form.lead_response,
            stage: form.lead_stage,
            ...(form.lead_stage === "callback"
              ? { next_date: form.callback_date || null, next_time: form.callback_time || null }
              : {}),
          }];
        }
      }

      const payload = { ...buildPayload(confirm ? "booked" : null, confirm), call_history: newHistory };
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
            <span style={label}>Status</span>
            <Clearable show={!!form.lead_priority} onClear={() => set("lead_priority", "")}>
              <select style={input} value={form.lead_priority} onChange={(e) => set("lead_priority", e.target.value)}>
                <option value="">— Select —</option>
                {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Clearable>
          </div>
          <div>
            <span style={label}>Campaign</span>
            <Clearable show={!!form.campaign_id} onClear={() => set("campaign_id", "")}>
              <select style={input} value={form.campaign_id} onChange={(e) => set("campaign_id", e.target.value)}>
                <option value="">— Select —</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>Campaign {c.campaign_number}</option>)}
              </select>
            </Clearable>
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
            <Clearable show={!!form.sex} onClear={() => set("sex", "")}>
              <select style={input} value={form.sex} onChange={(e) => set("sex", e.target.value)}>
                <option value="">— Select —</option>
                {SEX_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Clearable>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>Address</span>
            <textarea style={{ ...input, minHeight: "56px", resize: "vertical" }} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>Complaint / Problem</span>
            <Clearable show={!!form.complaint} onClear={() => set("complaint", "")}>
              <select style={input} value={form.complaint} onChange={(e) => set("complaint", e.target.value)}>
                <option value="">— Select —</option>
                {CHIEF_COMPLAINTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Clearable>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>Notes</span>
            <textarea style={{ ...input, minHeight: "56px", resize: "vertical" }} value={form.lead_notes} onChange={(e) => set("lead_notes", e.target.value)} placeholder="Anything extra to remember about this lead..." />
          </div>
          <div>
            <span style={label}>Consultation Type</span>
            <Clearable show={!!form.consultationType} onClear={() => set("consultationType", "")}>
              <select style={input} value={form.consultationType} onChange={(e) => set("consultationType", e.target.value)}>
                <option value="">— Select —</option>
                {CONSULT_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Clearable>
          </div>
          {form.consultationType === "clinic" && (
            <div>
              <span style={label}>Clinic</span>
              <Clearable show={!!form.clinic_location} onClear={() => set("clinic_location", "")}>
                <select style={input} value={form.clinic_location} onChange={(e) => set("clinic_location", e.target.value)}>
                  <option value="">— Select —</option>
                  {CLINIC_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Clearable>
            </div>
          )}
          <div>
            <span style={label}>Consultation Date</span>
            <input style={input} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <span style={label}>Consultation Slot</span>
            <Clearable show={!!form.time} onClear={() => set("time", "")}>
              <select style={input} value={form.time} onChange={(e) => set("time", e.target.value)}>
                <option value="">— Select —</option>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Clearable>
          </div>
        </div>

        {/* Call / Follow-up History */}
        {(lead?.call_history?.length > 0) && (
          <div style={{ marginTop: "16px", borderRadius: "10px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ background: "#f8f6f2", padding: "8px 14px", borderBottom: "1px solid #e5e7eb" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#6b7280", letterSpacing: "0.4px", textTransform: "uppercase" }}>
                Interaction History ({lead.call_history.length})
              </span>
            </div>
            <div style={{ maxHeight: "220px", overflowY: "auto" }}>
              {[...lead.call_history].reverse().map((entry, i) => (
                <div key={i} style={{ padding: "10px 14px", borderBottom: i < lead.call_history.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#111827" }}>📞 {formatDate(entry.date)}</span>
                    <span style={pill(entry.stage === "callback" ? "#fff7ed" : "#eef2ff", entry.stage === "callback" ? "#b45309" : "#4338ca")}>
                      {entry.stage === "callback" ? "Callback" : "Follow-up"}
                    </span>
                    {entry.next_date && (
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        → Next: <strong>{formatDate(entry.next_date)}</strong>{entry.next_time ? ` at ${formatTime(entry.next_time)}` : ""}
                      </span>
                    )}
                  </div>
                  {entry.response && (
                    <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: 1.5 }}>{entry.response}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Response + Stage — placed just above the action buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>Response</span>
            <textarea style={{ ...input, minHeight: "64px", resize: "vertical" }} value={form.lead_response} onChange={(e) => set("lead_response", e.target.value)} placeholder="Write what the lead said or how they responded..." />
          </div>
          {!isCold && (
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={label}>Stage</span>
              <select style={{ ...input, fontWeight: "700", background: "#f8f6f2" }} value={form.lead_stage} onChange={(e) => set("lead_stage", e.target.value)}>
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          )}
          {isCallback && (
            <>
              <div>
                <span style={{ ...label, color: "#b45309" }}>Callback Date</span>
                <input style={input} type="date" value={form.callback_date} onChange={(e) => set("callback_date", e.target.value)} />
              </div>
              <div>
                <span style={{ ...label, color: "#b45309" }}>Callback Time</span>
                <input style={input} type="time" value={form.callback_time} onChange={(e) => set("callback_time", e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
          <button
            onClick={() => save()}
            disabled={saving}
            style={{ flex: 1, minWidth: "120px", padding: "12px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: "700", fontSize: "14px", cursor: saving ? "not-allowed" : "pointer" }}
          >
            {saving ? "Saving..." : lead ? "Save Changes" : isCold ? "Add Cold Lead" : "Add Lead"}
          </button>
          {!isCold && (form.lead_stage === "booked" || lead?.booking_confirmed) && (
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
