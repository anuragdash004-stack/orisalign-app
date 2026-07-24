"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

// Real lead stages — drives the per-row "Stage" dropdown options. Follow-ups
// is not a lead stage — that section is patient-only (see patientFollowups).
const STAGES = [
  { key: "fresh",     label: "Fresh Leads" },
  { key: "callback",  label: "Call Back" },
  { key: "booked",    label: "Booked" },
  { key: "denied",    label: "Denied" },
];

// Sections rendered on the page. "Old Leads" isn't a real stage — it's the
// bucket that a Callback/Booked/Denied entry lands in when its date isn't
// today (see entriesForBucket). "Follow-ups" isn't lead-based at all — it
// only ever shows patients due for an aligner set-change call.
const SECTIONS = [
  { key: "fresh",     label: "Fresh Leads" },
  { key: "old",       label: "Old Leads" },
  { key: "followups", label: "Follow-ups" },
  { key: "callback",  label: "Call Back" },
  { key: "booked",    label: "Booked" },
  { key: "denied",    label: "Denied" },
];
// "fresh" is tracked too so a lead's original Fresh Leads row is logged and
// stays visible (frozen green) once the lead moves on — see quickStage and
// LeadForm.buildPayload, and the "old" bucket only applies to non-today dates.
const TRACKED_STAGES = ["fresh", "callback", "booked", "denied"];
const TYPE_PILL_COLORS = {
  callback: ["#fff7ed", "#b45309"],
  booked: ["#dcfce7", "#16a34a"],
  denied: ["#fef2f2", "#dc2626"],
};

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
  { value: "received",         label: "Received" },
  { value: "asked_callback",   label: "Asked to Call Back" },
  { value: "did_not_receive",  label: "Did Not Receive" },
  { value: "cut_the_call",     label: "Cut the Call" },
  { value: "denied",           label: "Denied" },
];
// keep legacy lookup for old free-text/stored values from before this was a dropdown
const LEGACY_RESPONSES = { responded: "Responded", no_response: "No Response", callback: "Call Back" };
const responseDisplay = (v) => RESPONSE_OPTIONS.find((r) => r.value === v)?.label || LEGACY_RESPONSES[v] || v || "—";

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
  clinic_location: "", date: "", time: "", callback_date: "", callback_time: "",
  lead_stage: "fresh", add_date: "",
};

const input = {
  width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e5e7eb",
  fontSize: "14px", outline: "none", background: "white", color: "#111827", boxSizing: "border-box",
};
const label = { display: "block", fontSize: "11px", fontWeight: "700", color: "#6b7280", marginBottom: "5px", letterSpacing: "0.4px", textTransform: "uppercase" };

export default function LeadTrackerPage() {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(""); // global search — name or phone, across leads + patients
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date())); // defaults to today; "all" or YYYY-MM-DD
  const [editing, setEditing] = useState(null); // null or { mode: "normal"|"cold", lead: leadObj|null }
  const [view, setView] = useState("tracker"); // "tracker" | "cold"
  const [actor, setActor] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [catered, setCatered] = useState([]); // appointments the dentist has OTP-started
  const [dentists, setDentists] = useState([]);
  const [patients, setPatients] = useState([]); // confirmed/completed patients, for the Follow-ups section
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

  // Patients in active treatment — used to work out whose next aligner set
  // change falls on the selected date, for the Patients follow-up view.
  const fetchPatients = async () => {
    const { data, error } = await supabase
      .from("appointments_booking")
      .select("id, name, phone, email, journey_steps, aligner_days_per_set, status, set_followups")
      .in("status", ["confirmed", "completed"]);
    if (error) console.error("Error fetching patients:", error);
    setPatients(data || []);
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
      await fetchPatients();
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

  // Change a lead's stage from a row's Stage dropdown. `entryLoggedAt`
  // identifies which stage_log entry that row was showing (undefined for the
  // Cold table, which doesn't use the log) — picking a value freezes that
  // entry green in place. `entryBucket` is that same row's bucket (e.g.
  // "callback", "old") — a brand-new unconfirmed entry is filed for
  // wherever it was just pointed UNLESS the target is the same bucket the
  // row is already sitting in today, in which case re-appending would file
  // a second, still-unconfirmed entry in that same bucket+date that
  // immediately outranks (as "latest") the one we just turned green,
  // making the row look like it silently reverted to black. Quick actions
  // like this have no date picker, so they always target today — that's
  // what keeps them in the live section instead of Old Leads. Scheduling a
  // different day only happens through the full Edit form (see
  // LeadForm.buildPayload), which is what actually files something into
  // Old Leads.
  const quickStage = async (lead, newStage, entryLoggedAt, entryBucket) => {
    const nowIso = new Date().toISOString();
    const todayKeyStr = dateKey(new Date());
    const stampBooking = newStage === "booked" && !lead.booking_confirmed_at;
    const isNoOpReselect = entryBucket === newStage;

    let stageLog = lead.stage_log || [];
    if (entryLoggedAt) {
      stageLog = stageLog.map((e) => (e.loggedAt === entryLoggedAt ? { ...e, confirmed: true } : e));
    }
    if (TRACKED_STAGES.includes(newStage) && !isNoOpReselect) {
      stageLog = [...stageLog, {
        bucket: newStage, stage: newStage, date: todayKeyStr, time: null, confirmed: false, loggedAt: nowIso,
      }];
    }

    const extra = {
      ...(stampBooking ? { booking_confirmed_at: nowIso } : {}),
      ...(newStage === "callback" ? { callback_date: todayKeyStr } : {}),
      stage_log: stageLog,
    };
    const prevLeads = leads;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, lead_stage: newStage, ...extra } : l)));
    const { error } = await supabase
      .from("appointments_booking")
      .update({ lead_stage: newStage, ...extra })
      .eq("id", lead.id);
    if (error) {
      setLeads(prevLeads); // roll back the optimistic update — the write didn't actually persist
      alert("Failed to update stage: " + error.message);
    }
  };

  // Cold lead → promote into the live tracker as a Fresh lead. Stamp
  // promoted_at so it shows in Fresh Leads on the day it was actually
  // promoted, not the day it was originally added as a cold lead.
  const promoteToLead = async (lead) => {
    const nowIso = new Date().toISOString();
    const stageLog = [...(lead.stage_log || []), {
      bucket: "fresh", stage: "fresh", date: dateKey(new Date()), time: null, confirmed: false, loggedAt: nowIso,
    }];
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, lead_stage: "fresh", promoted_at: nowIso, stage_log: stageLog } : l)));
    await supabase.from("appointments_booking").update({ lead_stage: "fresh", promoted_at: nowIso, stage_log: stageLog }).eq("id", lead.id);
  };

  // Save a patient's set-change follow-up (note + call status) for the set
  // currently due. When marked "not_received", also fires an automated
  // nudge email (and hands back a pre-filled WhatsApp link) to the patient.
  const saveSetFollowup = async (patient, setNum, { note, callStatus }) => {
    const existing = patient.set_followups || {};
    const entry = { ...(existing[setNum] || {}), note, call_status: callStatus, updated_at: new Date().toISOString() };
    const updated = { ...existing, [setNum]: entry };

    setPatients((prev) => prev.map((p) => (p.id === patient.id ? { ...p, set_followups: updated } : p)));
    await supabase.from("appointments_booking").update({ set_followups: updated }).eq("id", patient.id);

    if (callStatus === "not_received") {
      try {
        const res = await fetch("/api/notify-set-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: patient.id,
            previousSetNum: patient.previousSetNum,
            dueSetNum: setNum,
            totalSets: patient.totalSets,
          }),
        });
        const json = await res.json();
        return json; // { emailSent, waLink, message }
      } catch {
        return null;
      }
    }
    return null;
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

  // Global search — matches name or phone across everything: pure leads,
  // cold leads, and converted patients (leads + patients combined & deduped).
  const searchResults = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set();
    const combined = [];
    for (const r of [...leads, ...patients]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      combined.push(r);
    }
    return combined
      .filter((r) => (r.name || "").toLowerCase().includes(q) || (r.phone || "").includes(q))
      .slice(0, 20);
  })();
  const isConverted = (r) => !!r.booking_confirmed || r.status === "confirmed" || r.status === "completed";
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

  const bucketRows = (bucket) => {
    let rows = entriesForBucket(pipelineLeads, bucket, selectedDate);
    if (bucket === "callback") {
      rows = [...rows].sort((a, b) => `${a.entry.date || ""} ${a.entry.time || ""}`.localeCompare(`${b.entry.date || ""} ${b.entry.time || ""}`));
    }
    if (bucket === "old") {
      rows = [...rows].sort((a, b) => `${a.entry.date || ""} ${a.entry.stage || ""}`.localeCompare(`${b.entry.date || ""} ${b.entry.stage || ""}`));
    }
    return rows;
  };
  // Fresh Leads is log-based like every other section now — a lead's
  // original Fresh occurrence stays visible here (frozen green once it's
  // moved on) instead of disappearing when its stage changes.
  const freshRows = bucketRows("fresh");
  const callbackRows = bucketRows("callback");
  const bookedRows = bucketRows("booked");
  const deniedRows = bucketRows("denied");
  const oldRows = bucketRows("old");
  const totalVisible = freshRows.length + callbackRows.length + bookedRows.length + deniedRows.length + oldRows.length;

  const patientFollowups = getPatientFollowups(patients, selectedDate);

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
          <LeadForm lead={editing.lead} entry={editing.entry} mode={editing.mode} actor={actor} campaigns={campaigns} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchLeads(); }} onDuplicateFound={(existing) => setEditing({ mode: "normal", lead: existing })} />
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

      {/* Global search — name or phone, across leads and converted patients */}
      <div style={{ position: "relative", marginBottom: "18px" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search any patient or lead by name or phone number..."
          style={{ width: "100%", padding: "13px 16px", borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "14px", outline: "none", background: "white", color: "#111827", boxSizing: "border-box", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        />
        {searchQuery.trim() && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 40, background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.12)", maxHeight: "420px", overflowY: "auto" }}>
            {searchResults.length === 0 ? (
              <div style={{ padding: "18px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>No matches found.</div>
            ) : (
              searchResults.map((r) => {
                const converted = isConverted(r);
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSearchQuery("");
                      if (converted) router.push(`/patients/${r.id}`);
                      else setEditing({ mode: "normal", lead: r });
                    }}
                    style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", textAlign: "left", padding: "12px 16px", border: "none", borderBottom: "1px solid #f3f4f6", background: "white", cursor: "pointer" }}
                  >
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: converted ? "linear-gradient(135deg, #16a34a, #22c55e)" : "linear-gradient(135deg, #b8905a, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px", flexShrink: 0 }}>
                      {(r.name || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{r.name || "Unnamed"}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>
                        {r.phone || "—"}{r.email ? ` · ${r.email}` : ""}
                      </p>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "99px", background: converted ? "#dcfce7" : "#fef3c7", color: converted ? "#16a34a" : "#92400e", flexShrink: 0 }}>
                      {converted ? "Patient →" : `${stageOf(r).charAt(0).toUpperCase()}${stageOf(r).slice(1)} Lead →`}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
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
        {"  ·  "}{totalVisible} {totalVisible === 1 ? "lead" : "leads"}
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

      {/* All sections, stacked one after another */}
      <div style={{ display: "grid", gap: "22px" }}>
        {SECTIONS.map((s) => {
          if (s.key === "fresh") {
            return (
              <div key={s.key} style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#111827" }}>{s.label}</h2>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#6b7280", background: "#f3f4f6", borderRadius: "99px", padding: "2px 10px" }}>{freshRows.length}</span>
                  <div style={{ flex: 1, height: "1px", background: "#eee" }} />
                </div>
                {freshRows.length === 0 ? (
                  <div style={{ padding: "14px", background: "white", border: "1px dashed #e5e7eb", borderRadius: "12px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>No leads</div>
                ) : (
                  <LeadTable rows={freshRows} sectionKey={s.key} campaigns={campaigns} isAdmin={isAdmin} onStage={quickStage} onEdit={(lead, entry) => setEditing({ mode: "normal", lead, entry })} onDelete={deleteLead} />
                )}
              </div>
            );
          }

          // Follow-ups is patient-only: everyone due for an aligner set-change
          // call on the selected date, so staff can confirm they've switched.
          // No lead data lives here — that's what Fresh/Old/Call Back/Booked/
          // Denied are for.
          if (s.key === "followups") {
            return (
              <div key={s.key} style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#111827" }}>{s.label}</h2>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#6b7280", background: "#f3f4f6", borderRadius: "99px", padding: "2px 10px" }}>{patientFollowups.length}</span>
                  <div style={{ flex: 1, height: "1px", background: "#eee" }} />
                </div>
                {patientFollowups.length === 0 ? (
                  <div style={{ padding: "14px", background: "white", border: "1px dashed #e5e7eb", borderRadius: "12px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
                    No patients due for a set change {selectedDate === "all" ? "today" : "on this date"}.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    {patientFollowups.map((p) => (
                      <PatientFollowupCard key={p.id} patient={p} onSave={saveSetFollowup} />
                    ))}
                  </div>
                )}
              </div>
            );
          }

          const rows = s.key === "callback" ? callbackRows
            : s.key === "booked" ? bookedRows
            : s.key === "denied" ? deniedRows
            : oldRows; // "old"

          return (
            <div key={s.key} style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#111827" }}>{s.label}</h2>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#6b7280", background: "#f3f4f6", borderRadius: "99px", padding: "2px 10px" }}>{rows.length}</span>
                <div style={{ flex: 1, height: "1px", background: "#eee" }} />
              </div>
              {s.key === "old" && (
                <p style={{ fontSize: "12px", color: "#9ca3af", margin: "-4px 0 10px" }}>
                  Carried over from another day — pick a stage on each row to confirm it's been worked.
                </p>
              )}
              {rows.length === 0 ? (
                <div style={{ padding: "14px", background: "white", border: "1px dashed #e5e7eb", borderRadius: "12px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>No leads</div>
              ) : (
                <LeadTable rows={rows} sectionKey={s.key} campaigns={campaigns} isAdmin={isAdmin} onStage={quickStage} onEdit={(lead, entry) => setEditing({ mode: "normal", lead, entry })} onDelete={deleteLead} />
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <LeadForm
          lead={editing.lead}
          entry={editing.entry}
          mode={editing.mode}
          actor={actor}
          campaigns={campaigns}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchLeads(); }}
          onDuplicateFound={(existing) => setEditing({ mode: "normal", lead: existing })}
        />
      )}
    </div>
  );
}

function dateKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Flattens every lead's stage_log into { lead, entry } rows for one bucket
// (a section key like "callback", or "old" for carried-over entries) on one
// date. A lead can have several log entries in the same bucket+date if it
// was processed more than once that day — only the latest is shown so it
// doesn't duplicate into two rows; every other past entry (different
// date/bucket) is untouched and still shows up wherever it was filed.
function entriesForBucket(leads, bucket, dateKeyStr) {
  const out = [];
  for (const lead of leads) {
    const log = lead.stage_log || [];
    const matches = log.filter((e) => e.bucket === bucket && (dateKeyStr === "all" || e.date === dateKeyStr));
    if (matches.length === 0) continue;
    if (dateKeyStr === "all") {
      matches.forEach((e) => out.push({ lead, entry: e }));
    } else {
      const latest = matches.reduce((a, b) => (a.loggedAt > b.loggedAt ? a : b));
      out.push({ lead, entry: latest });
    }
  }
  return out;
}

// Patients due to switch aligner sets on a given date — mirrors the exact
// set-date math used by /api/cron/set-change-reminders and the patient's own
// smile-correction page (smile_start_date + (setNum-1) * daysPerSet). Set 1
// starts on day zero, so the first "change" is into Set 2.
function getPatientFollowups(patients, dateKeyStr) {
  const targetKey = dateKeyStr === "all" ? dateKey(new Date()) : dateKeyStr;
  const results = [];
  for (const p of patients) {
    const js = p.journey_steps || {};
    const setsCount = Number(js.smile_sets_count) || 0;
    const startDate = js.smile_start_date;
    if (!setsCount || !startDate || js.journey_ended) continue;
    const daysPerSet = Number(js.smile_days_per_set) || Number(p.aligner_days_per_set) || 15;
    for (let setNum = 2; setNum <= setsCount; setNum++) {
      const d = new Date(startDate + "T00:00:00");
      d.setDate(d.getDate() + (setNum - 1) * daysPerSet);
      if (dateKey(d) === targetKey) {
        results.push({ ...p, dueSetNum: setNum, previousSetNum: setNum - 1, totalSets: setsCount });
        break; // only one set can possibly be due per patient per day
      }
    }
  }
  return results;
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

// One patient's row in the Patients follow-up view — lets staff log whether
// the "please change your set" call was received, jot a note of what the
// patient said, and (when the call wasn't received) auto-send a nudge.
function PatientFollowupCard({ patient, onSave }) {
  const existing = patient.set_followups?.[patient.dueSetNum] || {};
  const [note, setNote] = useState(existing.note || "");
  const [callStatus, setCallStatus] = useState(existing.call_status || "");
  const [saving, setSaving] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const save = async (status) => {
    setCallStatus(status);
    setSaving(true);
    setSendResult(null);
    const result = await onSave(patient, patient.dueSetNum, { note, callStatus: status });
    if (status === "not_received") setSendResult(result);
    setSaving(false);
  };

  return (
    <div style={{ background: "white", border: "1px solid #fde68a", borderRadius: "10px", padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
        <span style={{ fontSize: "14px", fontWeight: "700", color: "#111827" }}>{patient.name || "Unnamed"}</span>
        <span style={{ fontSize: "13px", color: "#6b7280" }}>{patient.phone || "—"}</span>
        <span style={pill("#fef3c7", "#92400e")}>Set {patient.previousSetNum} → Set {patient.dueSetNum} of {patient.totalSets}</span>
        <a href={`/patients/${patient.id}`} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: "8px", border: "none", background: "#111827", color: "white", fontWeight: "700", fontSize: "12px", textDecoration: "none" }}>
          Open Patient
        </a>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <button
          onClick={() => save("received")}
          disabled={saving}
          style={{
            flex: 1, padding: "7px 10px", borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: saving ? "not-allowed" : "pointer",
            border: callStatus === "received" ? "none" : "1px solid #e5e7eb",
            background: callStatus === "received" ? "#16a34a" : "white",
            color: callStatus === "received" ? "white" : "#374151",
          }}
        >
          ✓ Call Received
        </button>
        <button
          onClick={() => save("not_received")}
          disabled={saving}
          style={{
            flex: 1, padding: "7px 10px", borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: saving ? "not-allowed" : "pointer",
            border: callStatus === "not_received" ? "none" : "1px solid #e5e7eb",
            background: callStatus === "not_received" ? "#dc2626" : "white",
            color: callStatus === "not_received" ? "white" : "#374151",
          }}
        >
          ✕ Did Not Receive
        </button>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => onSave(patient, patient.dueSetNum, { note, callStatus })}
        placeholder="Note — what the patient said, e.g. already changed set / needs a reminder call tomorrow..."
        style={{ width: "100%", minHeight: "44px", padding: "8px 10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px", outline: "none", resize: "vertical", boxSizing: "border-box", color: "#111827" }}
      />

      {sendResult && (
        <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: sendResult.emailSent ? "#16a34a" : "#9ca3af" }}>
            {sendResult.emailSent ? "✓ Nudge email sent" : "No email on file — email not sent"}
          </span>
          {sendResult.waLink && (
            <a href={sendResult.waLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a", textDecoration: "underline" }}>
              Send via WhatsApp too →
            </a>
          )}
        </div>
      )}
    </div>
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
            <span style={{ fontSize: "15px", fontWeight: "700", color: stage !== "fresh" ? "#16a34a" : "#111827" }}>{lead.name || "Unnamed"}</span>
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
// `leads` (plain array) is used only for the Cold table — no stage_log
// entries, no confirm mechanic, dropdown always fully selectable.
// `rows` (array of { lead, entry }) is used for every log-based section
// (Fresh Leads, Old Leads, Follow-ups, Call Back, Booked, Denied): color and the
// blank/select-stage dropdown are driven by that specific entry's
// `confirmed` flag, not by the lead's live current stage.
function LeadTable({ leads, rows: externalRows, onStage, onEdit, onDelete, cold, onPromote, campaigns = [], isAdmin = true, sectionKey }) {
  const rows = externalRows || (leads || []).map((lead) => ({ lead, entry: null }));
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
  const showType = sectionKey === "old";

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
              {showType && <th style={thBase}>Type</th>}
              {["Phone", "Alt #", "Email", "Age", "Sex", "Source", "Response", "Last Called", "Lead Status", "Campaign", "Complaint", "Consultation", "Clinic", "Consult Date", "Slot", "Callback", "Address", "Notes", "Verification", cold ? "Action" : "Stage", ""].map((h, i) => (
                <th key={i} style={thBase}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ lead, entry }) => {
              const { consultationType, complaint } = parseProblem(lead.problem);
              const consultLabel = CONSULT_OPTIONS.find((c) => c.value === consultationType)?.label || "—";
              // Prefer the entry's own recorded date/time so a historical row
              // (e.g. in Old Leads) shows what was true when it was filed,
              // not whatever the lead's live fields have since moved on to.
              const callbackDate = entry?.stage === "callback" ? entry.date : lead.callback_date;
              const callbackTime = entry?.stage === "callback" ? entry.time : lead.callback_time;
              const callback = (callbackDate || callbackTime) ? `${formatTime(callbackTime)}${callbackDate ? " · " + formatDate(callbackDate) : ""}`.trim() : "—";
              const status = lead.booking_confirmed
                ? "✓ Confirmed"
                : lead.lead_source === "website"
                  ? (lead.lead_verified ? "Verified" : "Unverified")
                  : "—";
              // Color/dropdown are driven by this specific log entry, not the
              // lead's live stage — that's what lets the same lead show green
              // (worked) in one date's row and black (not yet) in another's.
              const isGreen = !!entry?.confirmed;
              const isUnconfirmed = !!entry && !entry.confirmed;
              const dropdownValue = isUnconfirmed ? "" : (entry ? entry.stage : (lead.lead_stage || "fresh"));
              return (
                <tr key={`${lead.id}-${entry?.loggedAt || "live"}`}>
                  <td style={numTd}>#{lead.lead_number || "—"}</td>
                  <td style={{ ...nameTd, color: isGreen ? "#16a34a" : nameTd.color }}>{lead.name || "—"}</td>
                  {showType && (
                    <td style={td}>
                      <span style={pill(...(TYPE_PILL_COLORS[entry?.stage] || ["#f3f4f6", "#6b7280"]))}>
                        {STAGES.find((s) => s.key === entry?.stage)?.label || "—"}
                      </span>
                    </td>
                  )}
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
                        value={dropdownValue}
                        onChange={(e) => onStage(lead, e.target.value, entry?.loggedAt, entry?.bucket)}
                        style={{
                          padding: "5px 8px", borderRadius: "7px", fontSize: "11px", cursor: "pointer", color: "#111827",
                          border: isUnconfirmed ? "1px solid #f59e0b" : "1px solid #e5e7eb",
                          background: isUnconfirmed ? "#fffbeb" : "white",
                        }}
                      >
                        {isUnconfirmed && <option value="" disabled hidden>Select stage…</option>}
                        {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => onEdit(lead, entry)} style={miniBtn("white", "#111827", "1px solid #e5e7eb")}>Edit</button>
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

function LeadForm({ lead, entry, actor, onClose, onSaved, onDuplicateFound, mode = "normal", campaigns = [] }) {
  const isCold = mode === "cold";
  const [form, setForm] = useState(() => {
    if (!lead) return { ...EMPTY_FORM, lead_stage: isCold ? "cold" : "fresh", add_date: dateKey(new Date()) };
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
  const isBooked = form.lead_stage === "booked";

  const buildPayload = (stageOverride, confirm) => {
    const problem = form.consultationType
      ? `[${form.consultationType.toUpperCase()}] ${form.complaint}`
      : form.complaint;
    const nextStage = stageOverride || form.lead_stage;
    const todayKeyStr = dateKey(new Date());
    // The form is the only place a date can be set to something other than
    // today — that's what actually files an entry into Old Leads instead of
    // the live section (see quickStage for the no-date-picker quick path).
    const targetDate = nextStage === "callback" ? (form.callback_date || todayKeyStr)
      : nextStage === "fresh" && !lead ? (form.add_date || todayKeyStr) // new lead can be backdated via "Date Added"
      : todayKeyStr; // booked/denied have no date picker — always today
    const targetTime = nextStage === "callback" ? (form.callback_time || null) : null;
    const dateChanged = nextStage === "callback"
      ? form.callback_date !== (lead?.callback_date || "")
      : false;
    const stageChangedFromBefore = nextStage !== (lead?.lead_stage || "fresh");
    // Log a new occurrence whenever this save is a real stage/date change (or
    // a brand-new lead) — editing other fields on an unchanged stage doesn't
    // spawn a duplicate entry.
    let stageLog = lead?.stage_log || [];
    // `entry` is the specific stage_log row the Edit button was clicked from
    // (e.g. an Old Leads occurrence) — saving this form is what "deals with"
    // it, so freeze it green here too, same as the quick dropdown does.
    // Without this it stayed black forever once scheduled via the date
    // picker, since only the quick dropdown (quickStage) used to confirm it.
    if (entry?.loggedAt) {
      stageLog = stageLog.map((e) => (e.loggedAt === entry.loggedAt ? { ...e, confirmed: true } : e));
    }
    if (TRACKED_STAGES.includes(nextStage) && (stageChangedFromBefore || dateChanged || !lead)) {
      const bucket = targetDate === todayKeyStr ? nextStage : "old";
      // "Confirm Lead → Booked" is itself the confirming action — no extra
      // re-pick-the-stage step needed on top of it.
      stageLog = [...stageLog, { bucket, stage: nextStage, date: targetDate, time: targetTime, confirmed: !!confirm, loggedAt: new Date().toISOString() }];
    }
    return {
      name: form.name || null, age: form.age || null, sex: form.sex || null,
      phone: form.phone || null, alt_phone: form.alt_phone || null, email: form.email || null,
      address: form.address || null, problem: problem || null, lead_notes: form.lead_notes || null,
      lead_source: form.lead_source, lead_response: form.lead_response || null,
      lead_priority: form.lead_priority || null, campaign_id: form.campaign_id || null,
      lead_stage: stageOverride || form.lead_stage,
      // Consultation fields are only shown in the UI while Stage = Booked, but
      // hiding them must not destroy data already saved — always persist
      // whatever's currently in the form instead of nulling by stage.
      clinic_location: form.consultationType === "clinic" ? (form.clinic_location || null) : null,
      date: form.date || null,
      time: form.time || null,
      callback_date: form.lead_stage === "callback" ? (form.callback_date || null) : null,
      callback_time: form.lead_stage === "callback" ? (form.callback_time || null) : null,
      stage_log: stageLog,
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
      // Block duplicate phone numbers when creating a brand-new lead — surface
      // the existing record instead of silently creating a second one.
      if (!lead && form.phone && form.phone.trim()) {
        const { data: dup } = await supabase
          .from("appointments_booking")
          .select("*")
          .eq("phone", form.phone.trim())
          .limit(1)
          .maybeSingle();
        if (dup) {
          alert(`This phone number is already registered — for ${dup.name || "an existing lead"}. Opening their existing record instead.`);
          setSaving(false);
          onDuplicateFound?.(dup);
          return;
        }
      }

      // Build call history — append a new entry whenever stage is callback
      // and the response or next date has changed (avoid duplicate entries).
      const existingHistory = lead?.call_history || [];
      const isInteractionStage = form.lead_stage === "callback";
      let newHistory = existingHistory;
      if (isInteractionStage && form.lead_response) {
        const responseChanged = form.lead_response !== (lead?.lead_response || "");
        const nextDateChanged = form.callback_date !== (lead?.callback_date || "");
        const notesChanged = form.lead_notes !== (lead?.lead_notes || "");
        if (responseChanged || nextDateChanged || notesChanged || existingHistory.length === 0) {
          newHistory = [...existingHistory, {
            date: new Date().toISOString().slice(0, 10),
            response: form.lead_response,
            notes: form.lead_notes || null,
            stage: form.lead_stage,
            next_date: form.callback_date || null, next_time: form.callback_time || null,
          }];
        }
      }

      const payload = { ...buildPayload(confirm ? "booked" : null, confirm), call_history: newHistory };
      let leadId = lead?.id;
      if (lead) {
        const { error } = await supabase.from("appointments_booking").update(payload).eq("id", lead.id);
        if (error) throw error;
      } else {
        // Lead is filed under whatever date was picked (defaults to today) —
        // keep the current time-of-day so same-day ordering still makes sense.
        let createdAt;
        if (form.add_date) {
          const now = new Date();
          const [y, m, d] = form.add_date.split("-").map(Number);
          createdAt = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
        }
        const { data, error } = await supabase
          .from("appointments_booking")
          .insert([{ ...payload, status: "lead", lead_verified: false, ...(createdAt ? { created_at: createdAt } : {}) }])
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
          {!lead && (
            <div>
              <span style={label}>Date Added</span>
              <input style={input} type="date" value={form.add_date} onChange={(e) => set("add_date", e.target.value)} />
            </div>
          )}
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
            <span style={label}>Status</span>
            <Clearable show={!!form.lead_priority} onClear={() => set("lead_priority", "")}>
              <select style={input} value={form.lead_priority} onChange={(e) => set("lead_priority", e.target.value)}>
                <option value="">— Select —</option>
                {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Clearable>
          </div>
          <div>
            <span style={label}>Response</span>
            <Clearable show={!!form.lead_response} onClear={() => set("lead_response", "")}>
              <select style={input} value={form.lead_response} onChange={(e) => set("lead_response", e.target.value)}>
                <option value="">— Select —</option>
                {RESPONSE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Clearable>
          </div>

          {/* Consultation details — only relevant once the lead is Booked */}
          {isBooked && (
            <>
              <div>
                <span style={{ ...label, color: "#16a34a" }}>Consultation Type</span>
                <Clearable show={!!form.consultationType} onClear={() => set("consultationType", "")}>
                  <select style={input} value={form.consultationType} onChange={(e) => set("consultationType", e.target.value)}>
                    <option value="">— Select —</option>
                    {CONSULT_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Clearable>
              </div>
              {form.consultationType === "clinic" && (
                <div>
                  <span style={{ ...label, color: "#16a34a" }}>Clinic</span>
                  <Clearable show={!!form.clinic_location} onClear={() => set("clinic_location", "")}>
                    <select style={input} value={form.clinic_location} onChange={(e) => set("clinic_location", e.target.value)}>
                      <option value="">— Select —</option>
                      {CLINIC_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Clearable>
                </div>
              )}
              <div>
                <span style={{ ...label, color: "#16a34a" }}>Consultation Date</span>
                <input style={input} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </div>
              <div>
                <span style={{ ...label, color: "#16a34a" }}>Consultation Slot</span>
                <Clearable show={!!form.time} onClear={() => set("time", "")}>
                  <select style={input} value={form.time} onChange={(e) => set("time", e.target.value)}>
                    <option value="">— Select —</option>
                    {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Clearable>
              </div>
            </>
          )}

          {/* Callback date/time — only relevant when stage is Call Back */}
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
                    <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: 1.5 }}>{responseDisplay(entry.response)}</p>
                  )}
                  {entry.notes && (
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6b7280", lineHeight: 1.5, fontStyle: "italic" }}>📝 {entry.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage — placed just above the action buttons */}
        {!isCold && (
          <div style={{ marginTop: "12px" }}>
            <span style={label}>Stage</span>
            <select style={{ ...input, fontWeight: "700", background: "#f8f6f2" }} value={form.lead_stage} onChange={(e) => set("lead_stage", e.target.value)}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        )}

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
