"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { isNewModelAppointment } from "@/lib/appointmentModel";
import { computeNextBatchDue } from "@/lib/manufacturingTriggers";

const supabase = getSupabaseClient();

const NAVY = "#1B2A4A";
const GOLD = "var(--admin-gold, #b8905a)";

// Date-only key in IST, regardless of the viewer's own timezone — matches
// the same convention used by the Lead Tracker and the set-change cron.
function dateKeyIST(d) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
function addDays(dateKey, n) {
  const d = new Date(dateKey + "T12:00:00+05:30");
  d.setDate(d.getDate() + n);
  return dateKeyIST(d);
}
function formatDateLabel(dateKey, todayKey) {
  if (dateKey === todayKey) return "Today";
  if (dateKey === addDays(todayKey, -1)) return "Yesterday";
  if (dateKey === addDays(todayKey, 1)) return "Tomorrow";
  return new Date(dateKey + "T12:00:00+05:30").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

const CATEGORY_META = {
  lead_attend:  { label: "Leads to Attend",       color: "#7c3aed", bg: "#f5f3ff", icon: "👤" },
  callback:     { label: "Callbacks Due",         color: "#0891b2", bg: "#ecfeff", icon: "📞" },
  appointment:  { label: "Appointments Today",    color: "var(--admin-gold, #b8905a)", bg: "#EAF7F5", icon: "📅" },
  manufacturing:{ label: "Manufacturing",         color: "#dc2626", bg: "#fef2f2", icon: "🏭" },
  followup:     { label: "Follow-Up Visits",      color: "#168F83", bg: "#EAF7F5", icon: "🔁" },
  custom:       { label: "Other Tasks",           color: "var(--admin-ink, #1b2a4a)", bg: "var(--admin-gold-wash, #f3f0e6)", icon: "📝" },
};
const CATEGORY_ORDER = ["lead_attend", "callback", "appointment", "manufacturing", "followup", "custom"];

export default function DTDReportPage() {
  const router = useRouter();
  const todayKey = dateKeyIST(new Date());
  const [viewDate, setViewDate] = useState(todayKey);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actorEmail, setActorEmail] = useState(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setActorEmail(data?.user?.email || null));
  }, []);

  // Auto-generates today's due tasks from live data — leads needing
  // attention, callbacks due (today or overdue), today's appointments,
  // manufacturing not yet sent, and today's follow-up visits. Safe to call
  // repeatedly: it only creates a new row when no still-open task already
  // exists for that exact source_key, so re-running never duplicates.
  const syncTodayTasks = useCallback(async () => {
    setSyncing(true);
    try {
      const { data: existingOpen } = await supabase
        .from("daily_tasks")
        .select("source_key")
        .eq("done", false)
        .not("source_key", "is", null);
      const openKeys = new Set((existingOpen || []).map((r) => r.source_key));

      const { data: appts } = await supabase
        .from("appointments_booking")
        .select("id, name, phone, status, lead_stage, callback_date, date, time, plan_approved, monthly_plan, manufacturing_data, journey_steps, provisional_min_months, provisional_max_months, payment_data, aligner_total_sets, aligner_days_per_set")
        .order("created_at", { ascending: false });

      const candidates = [];
      for (const a of appts || []) {
        // Leads to attend — fresh, not yet converted into a booking.
        if (a.status === "lead" && a.lead_stage === "fresh") {
          candidates.push({
            source_key: `lead_attend:${a.id}`,
            category: "lead_attend",
            title: a.name || "Unnamed lead",
            detail: a.phone || "",
            link_url: "/leads",
          });
        }
        // Callbacks due today or earlier (overdue callbacks keep showing —
        // that IS the carry-forward, driven by the real callback_date).
        if (a.status === "lead" && a.callback_date && a.callback_date <= todayKey) {
          candidates.push({
            source_key: `callback:${a.id}:${a.callback_date}`,
            category: "callback",
            title: a.name || "Unnamed lead",
            detail: `Callback due ${a.callback_date}${a.phone ? ` · ${a.phone}` : ""}`,
            link_url: "/leads",
          });
        }
        // Appointments/consultations scheduled for today.
        if ((a.status === "confirmed" || a.status === "completed") && a.date === todayKey) {
          candidates.push({
            source_key: `appointment:${a.id}:${a.date}`,
            category: "appointment",
            title: a.name || "Unnamed patient",
            detail: `${a.time || "Time TBD"}${a.phone ? ` · ${a.phone}` : ""}`,
            link_url: `/patients/${a.id}`,
          });
        }
        // Manufacturing — legacy patients whose plan is approved but
        // nothing's been sent to production yet, or (for a patient with
        // "Auto-Trigger" configured on the Manufacturing page) whose next
        // set(s) are now due, per computeNextBatchDue.
        const isNewModel = isNewModelAppointment(a);
        const batches = a.manufacturing_data?.batches || [];
        const needsFirstBatch = !isNewModel && a.plan_approved && batches.length === 0;
        if (needsFirstBatch) {
          candidates.push({
            source_key: `manufacturing:${a.id}`,
            category: "manufacturing",
            title: a.name || "Unnamed patient",
            detail: "Plan approved — send Set 1 to manufacturing",
            link_url: "/manufacturing",
          });
        } else if (!isNewModel) {
          const nextDue = computeNextBatchDue(a);
          if (nextDue) {
            candidates.push({
              source_key: `manufacturing_next:${a.id}:${nextDue.from}-${nextDue.to}`,
              category: "manufacturing",
              title: a.name || "Unnamed patient",
              detail: `${nextDue.reason} — Set${nextDue.to > nextDue.from ? `s ${nextDue.from}–${nextDue.to}` : ` ${nextDue.from}`}`,
              link_url: "/manufacturing",
            });
          }
        } else {
          // New (monthly_plan) model — a package's batch is auto-created and
          // pushed to production the instant its payment threshold is
          // crossed, with no admin click involved. Surface each one still
          // awaiting physical manufacture (mfg_started but not mfg_done) as
          // its own task so it doesn't just silently sit there.
          for (const b of batches) {
            if (b.mfg_started && !b.mfg_done) {
              candidates.push({
                source_key: `manufacturing_pkg:${a.id}:${b.num}`,
                category: "manufacturing",
                title: a.name || "Unnamed patient",
                detail: `Package ${b.num} paid & pushed to production — needs manufacturing`,
                link_url: "/manufacturing",
              });
            }
          }
        }
        // Follow-up visits booked for today.
        const followupAt = a.journey_steps?.followup_appointment_at;
        if (followupAt === todayKey) {
          candidates.push({
            source_key: `followup:${a.id}:${followupAt}`,
            category: "followup",
            title: a.name || "Unnamed patient",
            detail: `Follow-up visit today${a.phone ? ` · ${a.phone}` : ""}`,
            link_url: `/patients/${a.id}`,
          });
        }
      }

      const toInsert = candidates.filter((c) => !openKeys.has(c.source_key));
      if (toInsert.length > 0) {
        await supabase.from("daily_tasks").insert(
          toInsert.map((c) => ({ ...c, task_date: todayKey, done: false }))
        );
      }
    } catch (err) {
      console.error("DTD sync failed", err);
    } finally {
      setSyncing(false);
    }
  }, [todayKey]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_tasks")
      .select("*")
      .lte("task_date", viewDate)
      .or(`done.eq.false,task_date.eq.${viewDate}`)
      .order("task_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) console.error(error);
    setTasks(data || []);
    setLoading(false);
  }, [viewDate]);

  useEffect(() => {
    const run = async () => {
      if (viewDate === todayKey) await syncTodayTasks();
      await loadTasks();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate]);

  const toggleDone = async (task) => {
    setBusyId(task.id);
    const newVal = !task.done;
    const { error } = await supabase
      .from("daily_tasks")
      .update({ done: newVal, done_at: newVal ? new Date().toISOString() : null })
      .eq("id", task.id);
    setBusyId(null);
    if (error) { alert("Failed to update: " + error.message); return; }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: newVal, done_at: newVal ? new Date().toISOString() : null } : t)));
  };

  const addCustomTask = async () => {
    const title = newTaskText.trim();
    if (!title) return;
    setAddingTask(true);
    const { data, error } = await supabase
      .from("daily_tasks")
      .insert({ task_date: viewDate, category: "custom", title, done: false, created_by: actorEmail })
      .select()
      .single();
    setAddingTask(false);
    if (error) { alert("Failed to add: " + error.message); return; }
    setNewTaskText("");
    setTasks((prev) => [...prev, data]);
  };

  const deleteTask = async (task) => {
    if (task.category !== "custom") return;
    if (!window.confirm("Remove this task?")) return;
    setBusyId(task.id);
    const { error } = await supabase.from("daily_tasks").delete().eq("id", task.id);
    setBusyId(null);
    if (error) { alert("Failed to delete: " + error.message); return; }
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
  };

  const carriedForward = tasks.filter((t) => t.task_date < viewDate && !t.done);
  const todaysTasks = tasks.filter((t) => t.task_date === viewDate);
  const doneCount = todaysTasks.filter((t) => t.done).length + 0;
  const totalCount = todaysTasks.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const grouped = (list) => {
    const byCat = {};
    for (const t of list) {
      if (!byCat[t.category]) byCat[t.category] = [];
      byCat[t.category].push(t);
    }
    return CATEGORY_ORDER.filter((c) => byCat[c]?.length).map((c) => [c, byCat[c]]);
  };

  const TaskRow = ({ task, carried }) => {
    const meta = CATEGORY_META[task.category] || CATEGORY_META.custom;
    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px",
          borderRadius: "10px", border: `1px solid ${task.done ? "#9FD8D1" : "var(--admin-line, #e9e1d0)"}`,
          background: task.done ? "#EAF7F5" : "white", marginBottom: "8px",
        }}
      >
        <button
          onClick={() => toggleDone(task)}
          disabled={busyId === task.id}
          style={{
            width: "26px", height: "26px", borderRadius: "50%", flexShrink: 0, cursor: busyId === task.id ? "not-allowed" : "pointer",
            border: task.done ? "none" : "2px solid #d1d5db",
            background: task.done ? "linear-gradient(135deg, #3FB3A4, #168F83)" : "white",
            color: "white", fontSize: "13px", fontWeight: "700",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {task.done ? "✓" : ""}
        </button>
        <span style={{ width: "30px", height: "30px", borderRadius: "8px", background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>
          {meta.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "13px", fontWeight: "700", color: task.done ? "#12706A" : "var(--admin-ink, #1b2a4a)", textDecoration: task.done ? "line-through" : "none" }}>
              {task.title}
            </span>
            {carried && <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "99px", background: "#fee2e2", color: "#dc2626", letterSpacing: "0.3px" }}>CARRIED FROM {task.task_date}</span>}
          </div>
          {task.detail && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--admin-ink2, #837a66)" }}>{task.detail}</p>}
        </div>
        {task.link_url && (
          <button
            onClick={() => router.push(task.link_url)}
            style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--admin-line, #e9e1d0)", background: "white", color: "var(--admin-ink, #1b2a4a)", fontWeight: "700", fontSize: "11px", cursor: "pointer", flexShrink: 0 }}
          >
            Open →
          </button>
        )}
        {task.category === "custom" && (
          <button
            onClick={() => deleteTask(task)}
            disabled={busyId === task.id}
            style={{ background: "none", border: "none", color: "var(--admin-ink2, #837a66)", fontSize: "16px", cursor: "pointer", flexShrink: 0, padding: "0 4px" }}
            title="Remove"
          >
            ✕
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: "780px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: "800", color: NAVY, margin: "0 0 6px" }}>Day-to-Day Report</h1>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--admin-ink2, #837a66)" }}>
          Everything due today — leads, callbacks, appointments, manufacturing, follow-ups — in one checklist. Anything left undone carries forward automatically.
        </p>
      </div>

      {/* Date navigator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: `linear-gradient(135deg, ${NAVY}, #0F1E33)`, borderRadius: "16px", padding: "18px 20px", marginBottom: "18px", boxShadow: "0 8px 24px rgba(27,42,74,0.18)" }}>
        <button
          onClick={() => setViewDate((d) => addDays(d, -1))}
          style={{ width: "38px", height: "38px", borderRadius: "10px", border: "none", background: "rgba(255,255,255,0.12)", color: "white", fontSize: "18px", cursor: "pointer" }}
        >
          ‹
        </button>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 2px", fontSize: "18px", fontWeight: "800", color: "white" }}>{formatDateLabel(viewDate, todayKey)}</p>
          <p style={{ margin: 0, fontSize: "11px", color: "#cbd5e1" }}>{new Date(viewDate + "T12:00:00+05:30").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          {viewDate !== todayKey && (
            <button onClick={() => setViewDate(todayKey)} style={{ marginTop: "6px", background: "none", border: "none", color: GOLD, fontSize: "11px", fontWeight: "700", cursor: "pointer", textDecoration: "underline" }}>
              Jump to Today
            </button>
          )}
        </div>
        <button
          onClick={() => setViewDate((d) => addDays(d, 1))}
          style={{ width: "38px", height: "38px", borderRadius: "10px", border: "none", background: "rgba(255,255,255,0.12)", color: "white", fontSize: "18px", cursor: "pointer" }}
        >
          ›
        </button>
      </div>

      {/* Progress */}
      {totalCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
          <div style={{ flex: 1, height: "8px", borderRadius: "99px", background: "var(--admin-line, #e9e1d0)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #3FB3A4, #168F83)", transition: "width 0.4s ease" }} />
          </div>
          <span style={{ fontSize: "12px", color: "var(--admin-ink2, #837a66)", fontWeight: "700", flexShrink: 0 }}>{doneCount}/{totalCount} done</span>
        </div>
      )}

      {/* Add a custom task */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "22px" }}>
        <input
          type="text"
          placeholder="Add a task..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTask(); } }}
          style={{ flex: 1, padding: "11px 14px", borderRadius: "10px", border: "1px solid var(--admin-line, #e9e1d0)", fontSize: "13px", outline: "none" }}
        />
        <button
          onClick={addCustomTask}
          disabled={addingTask || !newTaskText.trim()}
          style={{ padding: "11px 20px", borderRadius: "10px", border: "none", background: GOLD, color: "white", fontWeight: "700", fontSize: "13px", cursor: addingTask || !newTaskText.trim() ? "not-allowed" : "pointer", opacity: addingTask || !newTaskText.trim() ? 0.6 : 1 }}
        >
          {addingTask ? "Adding..." : "+ Add Task"}
        </button>
      </div>

      {loading || syncing ? (
        <p style={{ fontSize: "14px", color: "var(--admin-ink2, #837a66)" }}>{syncing ? "Checking for anything new due today..." : "Loading..."}</p>
      ) : (
        <>
          {carriedForward.length > 0 && (
            <div style={{ marginBottom: "22px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: "800", color: "#dc2626", letterSpacing: "0.5px", textTransform: "uppercase", margin: "0 0 10px" }}>
                ⏳ Carried Forward ({carriedForward.length})
              </h3>
              {grouped(carriedForward).map(([cat, list]) => (
                <div key={cat}>
                  {list.map((t) => <TaskRow key={t.id} task={t} carried />)}
                </div>
              ))}
            </div>
          )}

          {todaysTasks.length === 0 && carriedForward.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--admin-ink2, #837a66)" }}>
              <p style={{ fontSize: "40px", margin: "0 0 10px" }}>🎉</p>
              <p style={{ fontSize: "14px", margin: 0 }}>Nothing due — all clear for this day.</p>
            </div>
          ) : (
            grouped(todaysTasks).map(([cat, list]) => {
              const meta = CATEGORY_META[cat];
              return (
                <div key={cat} style={{ marginBottom: "20px" }}>
                  <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "800", color: meta.color, letterSpacing: "0.5px", textTransform: "uppercase", margin: "0 0 10px" }}>
                    <span>{meta.icon}</span> {meta.label} ({list.length})
                  </h3>
                  {list.map((t) => <TaskRow key={t.id} task={t} carried={false} />)}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
