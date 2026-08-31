"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { logAudit } from "@/lib/logAudit";
import { isNewModelAppointment } from "@/lib/appointmentModel";
import { computeNextBatchDue } from "@/lib/manufacturingTriggers";

const supabase = getSupabaseClient();

const card = { background: "var(--admin-card, #fff)", borderRadius: "13px", border: "1px solid var(--admin-line, #e9e1d0)", padding: "18px 20px", marginBottom: "14px", boxShadow: "0 1px 2px rgba(27,42,74,0.04)" };
const label = { display: "block", fontSize: "10.5px", fontWeight: "700", color: "var(--admin-ink2, #837a66)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "6px" };
const input = { width: "100%", padding: "9px 11px", borderRadius: "8px", border: "1px solid var(--admin-line, #e9e1d0)", fontSize: "13px", outline: "none", boxSizing: "border-box", background: "var(--admin-card, #fff)", color: "var(--admin-ink, #1b2a4a)", fontFamily: "var(--admin-font-body)" };
const btnPrimary = { padding: "9px 18px", borderRadius: "8px", border: "none", background: "var(--admin-ink, #1b2a4a)", color: "white", fontWeight: "700", fontSize: "12px", cursor: "pointer", fontFamily: "var(--admin-font-body)" };
const btnGold = { padding: "9px 18px", borderRadius: "8px", border: "none", background: "var(--admin-gold-strong, #a9762e)", color: "white", fontWeight: "700", fontSize: "12px", cursor: "pointer", fontFamily: "var(--admin-font-body)" };
const pill = (bg, color) => ({ display: "inline-block", padding: "4px 10px", borderRadius: "99px", background: bg, color, fontSize: "11px", fontWeight: "700" });

const todayISO = () => new Date().toISOString().slice(0, 10);

/** One package/batch row — start/end range or per-arch label, manufacturing
 * started/done dates. Delivery partner, shipment ID and tracking now live
 * on the patient's own Journey tab (Aligners Dispatched step) instead —
 * this page stays focused purely on manufacturing status. */
function BatchRow({ batch, onSaved }) {
  const [local, setLocal] = useState(batch);
  const [saving, setSaving] = useState(null);

  const update = (key, val) => setLocal((prev) => ({ ...prev, [key]: val }));

  const persist = async (patch, auditAction) => {
    const merged = { ...local, ...patch };
    setLocal(merged);
    await onSaved(merged, auditAction);
  };

  const markStarted = async () => {
    const hasArchLabels = local.slot_label || local.upper_aligners || local.lower_aligners;
    if (!hasArchLabels && (local.start === "" || local.end === "")) { alert("Enter the aligner set range for this batch first."); return; }
    setSaving("started");
    await persist({ mfg_started: todayISO() }, `Manufacturing Started — Batch ${batch.num}`);
    setSaving(null);
  };

  const markEnded = async () => {
    setSaving("ended");
    await persist({ mfg_done: todayISO() }, `Manufacturing Ended — Batch ${batch.num}`);
    setSaving(null);
  };

  return (
    <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--admin-line, #e9e1d0)", background: "#fafafa", marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
        <h4 style={{ margin: 0, fontSize: "13px", color: "var(--admin-gold, #b8905a)", fontWeight: "800", letterSpacing: "0.4px" }}>
          {local.slot_label
            ? `PACKAGE ${local.num} — ${local.slot_label.toUpperCase()}`
            : local.upper_aligners || local.lower_aligners
            ? `PACKAGE ${local.num} — UPPER ${local.upper_aligners || "—"}, LOWER ${local.lower_aligners || "—"}`
            : `BATCH ${local.num}${local.start && local.end ? ` — SETS ${local.start}–${local.end}` : ""}`}
        </h4>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {local.mfg_started ? <span style={pill("#f0fdf4", "#16a34a")}>✓ Started {local.mfg_started}</span> : <span style={pill("#fef3c7", "#92400e")}>Not started</span>}
          {local.mfg_done && <span style={pill("#f0fdf4", "#16a34a")}>✓ Done {local.mfg_done}</span>}
        </div>
      </div>

      {!local.slot_label && !local.upper_aligners && !local.lower_aligners && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          <input style={{ ...input, flex: 1 }} type="number" min="0" placeholder="Aligners from" value={local.start} onChange={(e) => update("start", e.target.value)} />
          <input style={{ ...input, flex: 1 }} type="number" min="0" placeholder="Aligners to" value={local.end} onChange={(e) => update("end", e.target.value)} />
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {!local.mfg_started && (
          <button style={saving === "started" ? { ...btnPrimary, opacity: 0.6 } : btnPrimary} onClick={markStarted} disabled={saving === "started"}>
            {saving === "started" ? "Saving..." : "Mark Started"}
          </button>
        )}
        {!local.mfg_done && (
          <button style={saving === "ended" ? { ...btnPrimary, opacity: 0.6 } : btnPrimary} onClick={markEnded} disabled={saving === "ended"}>
            {saving === "ended" ? "Saving..." : "Mark Done"}
          </button>
        )}
      </div>
    </div>
  );
}

/** One patient's manufacturing card. */
function PatientCard({ appt, actor, onRefresh }) {
  const router = useRouter();
  const isNewModel = isNewModelAppointment(appt);
  const batches = appt.manufacturing_data?.batches || [];
  const needsFirstBatch = !isNewModel && appt.plan_approved && batches.length === 0;
  const nextDue = !isNewModel && !needsFirstBatch ? computeNextBatchDue(appt) : null;
  // New (monthly_plan) model — a package's batch is auto-created and pushed
  // to production the instant its payment threshold is crossed (see
  // autoCreatePaidBatches), with no manual "Send to Manufacturing" click
  // involved at all. That's invisible to the team unless it shows up
  // somewhere — this is the "still needs to actually be manufactured" flag.
  const pendingNewModelBatches = isNewModel ? batches.filter((b) => b.mfg_started && !b.mfg_done) : [];

  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [startingFirst, setStartingFirst] = useState(false);
  const [creatingNext, setCreatingNext] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState(false);
  const [setsPerInstallmentInput, setSetsPerInstallmentInput] = useState(appt.journey_steps?.manufacturing_sets_per_installment || "");
  const [savingTrigger, setSavingTrigger] = useState(false);

  // Fires the (email-only — manufacturing_started/completed have no WhatsApp
  // campaign by design) step notification exactly once, the moment a status
  // actually transitions false -> true. The manufacturing-activation cron
  // already deliberately skips its own notification once this is manually
  // true ("already activated (e.g. manually by admin)") — this is the send
  // that comment always assumed existed but never actually did.
  const notifyStepOnce = (stepKey) => {
    fetch("/api/notify-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: appt.id, stepKey, email: appt.email || null }),
    }).catch(() => {});
  };

  const persistBatch = async (updatedBatch, auditAction) => {
    const updatedBatches = batches.map((b) => (b.num === updatedBatch.num ? updatedBatch : b));
    const mfgPayload = {
      ...appt.manufacturing_data,
      batches: updatedBatches.map(({ num, start, end, upper_aligners, lower_aligners, slot_label, mfg_started, mfg_done }) => ({ num, start, end, upper_aligners, lower_aligners, slot_label, mfg_started, mfg_done })),
    };
    const started = updatedBatches.some((b) => b.mfg_started);
    const completed = updatedBatches.length > 0 && updatedBatches.every((b) => b.mfg_done);
    const startDates = updatedBatches.map((b) => b.mfg_started).filter(Boolean).sort();
    const doneDates = updatedBatches.map((b) => b.mfg_done).filter(Boolean).sort();
    const js = appt.journey_steps || {};
    const wasStarted = !!js.manufacturing_started;
    const wasCompleted = !!js.manufacturing_completed;
    const newJs = {
      ...js,
      manufacturing_started: started,
      manufacturing_completed: completed,
      manufacturing_started_at: startDates[0] || null,
      manufacturing_completed_at: doneDates[doneDates.length - 1] || null,
    };
    const { error } = await supabase.from("appointments_booking").update({ manufacturing_data: mfgPayload, journey_steps: newJs }).eq("id", appt.id);
    if (error) { alert("Error saving: " + error.message); return false; }
    logAudit({ appointmentId: appt.id, actor, action: auditAction, entity: "manufacturing_data", newData: mfgPayload });
    if (!wasStarted && started) notifyStepOnce("manufacturing_started");
    if (!wasCompleted && completed) notifyStepOnce("manufacturing_completed");
    onRefresh();
    return true;
  };

  const createBatch = async (from, to, auditAction) => {
    const wasStarted = !!appt.journey_steps?.manufacturing_started;
    const nextNum = batches.length > 0 ? Math.max(...batches.map((b) => b.num)) + 1 : 1;
    const newBatch = { num: nextNum, start: String(from), end: String(to), mfg_started: todayISO(), mfg_done: "" };
    const mfgPayload = { ...appt.manufacturing_data, batches: [...batches, newBatch] };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ manufacturing_data: mfgPayload, journey_steps: { ...(appt.journey_steps || {}), manufacturing_started: true, manufacturing_started_at: (appt.journey_steps?.manufacturing_started_at || newBatch.mfg_started) } })
      .eq("id", appt.id);
    if (error) { alert("Error saving: " + error.message); return; }
    logAudit({ appointmentId: appt.id, actor, action: auditAction, entity: "manufacturing_data", newData: mfgPayload });
    if (!wasStarted) notifyStepOnce("manufacturing_started");
    onRefresh();
  };

  const startFirstBatch = async () => {
    if (!newFrom || !newTo) { alert("Enter the aligner set range first."); return; }
    setStartingFirst(true);
    await createBatch(newFrom, newTo, "Manufacturing Started — Batch 1 (sent on plan approval)");
    setStartingFirst(false);
  };

  const sendNextDue = async () => {
    if (!nextDue) return;
    setCreatingNext(true);
    await createBatch(nextDue.from, nextDue.to, `Manufacturing Started — Sets ${nextDue.from}-${nextDue.to} (auto-flagged)`);
    setCreatingNext(false);
  };

  const saveTrigger = async () => {
    setSavingTrigger(true);
    const val = parseInt(setsPerInstallmentInput, 10) || null;
    const newJs = { ...(appt.journey_steps || {}), manufacturing_sets_per_installment: val };
    const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJs }).eq("id", appt.id);
    setSavingTrigger(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId: appt.id, actor, action: "Manufacturing Auto-Trigger Updated", entity: "journey_steps", newData: { manufacturing_sets_per_installment: val } });
    setEditingTrigger(false);
    onRefresh();
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
        <div>
          <button
            onClick={() => router.push(`/patients/${appt.id}`)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "15px", fontWeight: "800", color: "var(--admin-ink, #1b2a4a)", textAlign: "left" }}
          >
            {appt.name || "Unnamed Patient"}
          </button>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--admin-ink2, #837a66)" }}>
            {appt.phone || "No phone"} · {isNewModel ? "New model" : "Legacy"} · {appt.id?.substring(0, 8).toUpperCase()}
          </p>
        </div>
        {needsFirstBatch && <span style={pill("#fee2e2", "#dc2626")}>Needs Manufacturing</span>}
        {nextDue && <span style={pill("#fef3c7", "#92400e")}>Next Set(s) Due</span>}
        {pendingNewModelBatches.length > 0 && <span style={pill("#fee2e2", "#dc2626")}>Needs Manufacturing</span>}
      </div>

      {pendingNewModelBatches.length > 0 && (
        <div style={{ padding: "14px", borderRadius: "10px", border: "1px dashed #dc2626", background: "#fef2f2", marginBottom: "12px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#991b1b", fontWeight: "600" }}>
            Paid and pushed to production — still needs to be physically manufactured: Package{pendingNewModelBatches.length > 1 ? "s" : ""} {pendingNewModelBatches.map((b) => b.num).join(", ")}.
            Mark each one "Done" below once it's actually made.
          </p>
        </div>
      )}

      {needsFirstBatch && (
        <div style={{ padding: "14px", borderRadius: "10px", border: "1px dashed var(--admin-gold, #b8905a)", background: "#fffbeb", marginBottom: "12px" }}>
          <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#92400e", fontWeight: "600" }}>
            Plan approved — nothing sent to manufacturing yet. Enter the first set's aligner range to start it.
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input style={{ ...input, flex: 1, minWidth: "100px" }} type="number" min="0" placeholder="Aligners from" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} />
            <input style={{ ...input, flex: 1, minWidth: "100px" }} type="number" min="0" placeholder="Aligners to" value={newTo} onChange={(e) => setNewTo(e.target.value)} />
            <button style={startingFirst ? { ...btnGold, opacity: 0.6 } : btnGold} onClick={startFirstBatch} disabled={startingFirst}>
              {startingFirst ? "Starting..." : "Send to Manufacturing"}
            </button>
          </div>
        </div>
      )}

      {nextDue && (
        <div style={{ padding: "14px", borderRadius: "10px", border: "1px dashed #dc2626", background: "#fef2f2", marginBottom: "12px" }}>
          <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#991b1b", fontWeight: "600" }}>
            {nextDue.reason} — Set{nextDue.to > nextDue.from ? `s ${nextDue.from}–${nextDue.to}` : ` ${nextDue.from}`} should be sent.
          </p>
          <button style={creatingNext ? { ...btnPrimary, opacity: 0.6, background: "#dc2626" } : { ...btnPrimary, background: "#dc2626" }} onClick={sendNextDue} disabled={creatingNext}>
            {creatingNext ? "Sending..." : `Send Set${nextDue.to > nextDue.from ? "s" : ""} ${nextDue.from}${nextDue.to > nextDue.from ? `–${nextDue.to}` : ""} to Manufacturing`}
          </button>
        </div>
      )}

      {batches.map((b) => (
        <BatchRow key={b.num} batch={b} onSaved={persistBatch} />
      ))}

      {!isNewModel && (
        <div style={{ marginTop: "10px" }}>
          {!editingTrigger ? (
            <button
              onClick={() => setEditingTrigger(true)}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--admin-line, #e9e1d0)", background: "white", color: "var(--admin-ink2, #837a66)", fontWeight: "700", fontSize: "11px", cursor: "pointer" }}
            >
              ⚙ Auto-Trigger{appt.journey_steps?.manufacturing_sets_per_installment ? `: ${appt.journey_steps.manufacturing_sets_per_installment} sets/installment` : ": Off"}
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", borderRadius: "8px", background: "var(--admin-bg, #faf6ec)" }}>
              <span style={{ fontSize: "12px", color: "var(--admin-ink, #1b2a4a)", fontWeight: "600", flexShrink: 0 }}>Sets released per installment paid:</span>
              <input
                type="number" min="0" placeholder="e.g. 2"
                value={setsPerInstallmentInput}
                onChange={(e) => setSetsPerInstallmentInput(e.target.value)}
                style={{ ...input, width: "70px", flex: "none" }}
              />
              <button style={savingTrigger ? { ...btnPrimary, opacity: 0.6 } : btnPrimary} onClick={saveTrigger} disabled={savingTrigger}>
                {savingTrigger ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setEditingTrigger(false)} style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid var(--admin-line, #e9e1d0)", background: "white", color: "var(--admin-ink2, #837a66)", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ManufacturingPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actor, setActor] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: roleData } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
        setActor({ email: authData.user.email || null, role: roleData?.role || "admin" });
      }
      const { data, error } = await supabase
        .from("appointments_booking")
        .select("id, name, phone, status, plan_approved, monthly_plan, amount_paid, payment_data, manufacturing_data, journey_steps, provisional_min_months, provisional_max_months, final_upper_sets, final_lower_sets, aligner_total_sets, aligner_days_per_set, created_at")
        .in("status", ["confirmed", "completed"])
        .order("created_at", { ascending: false });
      if (error) console.error(error);
      setAppointments(data || []);
      setLoading(false);
    };
    load();
  }, [refreshTick]);

  const onRefresh = () => setRefreshTick((t) => t + 1);

  // Every patient with something already in manufacturing, a legacy plan
  // approved with nothing sent yet, or a flagged "next set(s) due".
  const relevant = appointments.filter((a) => {
    const batches = a.manufacturing_data?.batches || [];
    const isNewModel = isNewModelAppointment(a);
    const needsFirstBatch = !isNewModel && a.plan_approved && batches.length === 0;
    const nextDue = !isNewModel && !needsFirstBatch ? computeNextBatchDue(a) : null;
    return batches.length > 0 || needsFirstBatch || !!nextDue;
  });

  const q = search.toLowerCase();
  const filtered = relevant.filter((a) => !q || (a.name || "").toLowerCase().includes(q) || (a.phone || "").includes(q));

  // Needs-action patients first, fully-done patients last.
  const statusRank = (a) => {
    const batches = a.manufacturing_data?.batches || [];
    const isNewModel = isNewModelAppointment(a);
    const needsFirstBatch = !isNewModel && a.plan_approved && batches.length === 0;
    if (needsFirstBatch) return 0;
    if (!isNewModel && computeNextBatchDue(a)) return 0;
    if (batches.some((b) => !b.mfg_started)) return 0;
    if (batches.some((b) => b.mfg_started && !b.mfg_done)) return 1;
    return 2;
  };
  const sorted = [...filtered].sort((x, y) => statusRank(x) - statusRank(y));

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--admin-ink2, #837a66)" }}>Loading manufacturing queue...</div>;
  }

  return (
    <div style={{ maxWidth: "820px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "25px", fontWeight: "700", letterSpacing: "-0.01em", color: "var(--admin-ink, #1b2a4a)", margin: "0 0 6px", fontFamily: "var(--admin-font-display)" }}>Manufacturing</h1>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--admin-ink2, #837a66)" }}>
          Every patient's aligner packages — what's been manufactured and what's still due. A package appears here the moment a patient pays for it (new-model), their plan is approved (legacy), or — for a legacy patient with "Auto-Trigger" configured — the moment an installment is paid or their current set is about to run out.
        </p>
      </div>

      <input
        type="text"
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...input, marginBottom: "18px", padding: "12px 14px", fontSize: "14px" }}
      />

      {sorted.length === 0 ? (
        <p style={{ fontSize: "14px", color: "var(--admin-ink2, #837a66)" }}>No patients currently need manufacturing attention.</p>
      ) : (
        sorted.map((appt) => <PatientCard key={appt.id} appt={appt} actor={actor} onRefresh={onRefresh} />)
      )}
    </div>
  );
}
