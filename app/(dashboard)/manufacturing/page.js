"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { logAudit } from "@/lib/logAudit";
import { isNewModelAppointment } from "@/lib/appointmentModel";

const supabase = getSupabaseClient();

const DELIVERY_PARTNERS = ["BlueDart", "Delhivery", "Other"];

const card = { background: "white", borderRadius: "14px", border: "1px solid #e5e7eb", padding: "18px 20px", marginBottom: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };
const label = { display: "block", fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" };
const input = { width: "100%", padding: "9px 11px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", outline: "none", boxSizing: "border-box" };
const btnPrimary = { padding: "9px 18px", borderRadius: "8px", border: "none", background: "#111827", color: "white", fontWeight: "700", fontSize: "12px", cursor: "pointer" };
const btnGold = { padding: "9px 18px", borderRadius: "8px", border: "none", background: "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: "pointer" };
const pill = (bg, color) => ({ display: "inline-block", padding: "4px 10px", borderRadius: "99px", background: bg, color, fontSize: "11px", fontWeight: "700" });

/**
 * A single package/batch row for one patient — same fields ManufacturingTab
 * (formerly a per-patient tab, now retired) used to manage: aligner range or
 * per-arch slot label, start/end manufacturing dates, and dispatch logistics.
 */
function BatchRow({ appointmentId, batch, onSaved, actor }) {
  const [local, setLocal] = useState(batch);
  const [saving, setSaving] = useState(null);

  const update = (key, val) => setLocal((prev) => ({ ...prev, [key]: val }));

  const persist = async (patch, auditAction) => {
    const merged = { ...local, ...patch };
    setLocal(merged);
    const ok = await onSaved(merged, auditAction);
    return ok;
  };

  const markStarted = async () => {
    const hasArchLabels = local.slot_label || local.upper_aligners || local.lower_aligners;
    if (!hasArchLabels && (local.start === "" || local.end === "")) { alert("Enter the aligner set range for this batch first."); return; }
    setSaving("started");
    await persist({ mfg_started: new Date().toISOString().slice(0, 10) }, `Manufacturing Started — Batch ${batch.num}`);
    setSaving(null);
  };

  const markEnded = async () => {
    setSaving("ended");
    await persist({ mfg_done: new Date().toISOString().slice(0, 10) }, `Manufacturing Ended — Batch ${batch.num}`);
    setSaving(null);
  };

  const saveLogistics = async () => {
    setSaving("logistics");
    const today = new Date().toISOString().slice(0, 10);
    await persist({ mfg_done: local.shipment_link ? (local.mfg_done || today) : local.mfg_done }, `Tracking Link & Logistics Saved — Batch ${batch.num}`);
    setSaving(null);
  };

  return (
    <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "#fafafa", marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
        <h4 style={{ margin: 0, fontSize: "13px", color: "#b8905a", fontWeight: "800", letterSpacing: "0.4px" }}>
          {local.slot_label
            ? `PACKAGE ${local.num} — ${local.slot_label.toUpperCase()}`
            : local.upper_aligners || local.lower_aligners
            ? `PACKAGE ${local.num} — UPPER ${local.upper_aligners || "—"}, LOWER ${local.lower_aligners || "—"}`
            : `BATCH ${local.num}`}
        </h4>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {local.mfg_started ? <span style={pill("#f0fdf4", "#16a34a")}>✓ Started {local.mfg_started}</span> : <span style={pill("#fef3c7", "#92400e")}>Not started</span>}
          {local.mfg_done && <span style={pill("#f0fdf4", "#16a34a")}>✓ Done {local.mfg_done}</span>}
          {local.shipment_link && <span style={pill("#dbeafe", "#1e40af")}>Dispatched</span>}
        </div>
      </div>

      {!local.slot_label && !local.upper_aligners && !local.lower_aligners && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          <input style={{ ...input, flex: 1 }} type="number" min="0" placeholder="Aligners from" value={local.start} onChange={(e) => update("start", e.target.value)} />
          <input style={{ ...input, flex: 1 }} type="number" min="0" placeholder="Aligners to" value={local.end} onChange={(e) => update("end", e.target.value)} />
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
        <div>
          <span style={label}>Delivery Partner</span>
          <select style={input} value={local.delivery_partner} onChange={(e) => update("delivery_partner", e.target.value)}>
            <option value="">Select...</option>
            {DELIVERY_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>Shipment ID</span>
          <input style={input} type="text" placeholder="Tracking number" value={local.shipment_id} onChange={(e) => update("shipment_id", e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: "10px" }}>
        <span style={label}>Shipment Tracking Link</span>
        <input style={input} type="url" placeholder="https://..." value={local.shipment_link} onChange={(e) => update("shipment_link", e.target.value)} />
      </div>
      <button style={saving === "logistics" ? { ...btnPrimary, opacity: 0.6 } : btnPrimary} onClick={saveLogistics} disabled={saving === "logistics"}>
        {saving === "logistics" ? "Saving..." : "Save Logistics"}
      </button>
    </div>
  );
}

/** One patient's manufacturing card — their existing batches, plus (for a
 * legacy patient whose plan is approved but nothing's been sent to
 * manufacturing yet) a quick "start the first batch" prompt. */
function PatientCard({ appt, actor, onRefresh }) {
  const router = useRouter();
  const isNewModel = isNewModelAppointment(appt);
  const batches = appt.manufacturing_data?.batches || [];
  const needsFirstBatch = !isNewModel && appt.plan_approved && batches.length === 0;

  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [startingFirst, setStartingFirst] = useState(false);

  const persistBatch = async (updatedBatch, auditAction) => {
    const updatedBatches = batches.map((b) => (b.num === updatedBatch.num ? updatedBatch : b));
    const mfgPayload = {
      ...appt.manufacturing_data,
      batches: updatedBatches.map(({ num, start, end, upper_aligners, lower_aligners, slot_label, mfg_started, mfg_done, shipment_link }) => ({ num, start, end, upper_aligners, lower_aligners, slot_label, mfg_started, mfg_done, shipment_link })),
    };
    const logPayload = {
      batches: updatedBatches.map(({ num, aligner_received, delivery_partner, delivery_partner_other, shipment_id, shipment_link }) => ({ num, aligner_received, delivery_partner, delivery_partner_other, shipment_id, shipment_link })),
    };
    const started = updatedBatches.some((b) => b.mfg_started);
    const completed = updatedBatches.length > 0 && updatedBatches.every((b) => b.mfg_done);
    const dispatched = updatedBatches.some((b) => b.shipment_link);
    const startDates = updatedBatches.map((b) => b.mfg_started).filter(Boolean).sort();
    const doneDates = updatedBatches.map((b) => b.mfg_done).filter(Boolean).sort();
    const js = appt.journey_steps || {};
    const newJs = {
      ...js,
      manufacturing_started: started,
      manufacturing_completed: completed,
      aligners_dispatched: dispatched,
      manufacturing_started_at: startDates[0] || null,
      manufacturing_completed_at: doneDates[doneDates.length - 1] || null,
      aligners_dispatched_at: dispatched ? (js.aligners_dispatched_at || new Date().toISOString()) : null,
    };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ manufacturing_data: mfgPayload, logistics_data: logPayload, journey_steps: newJs })
      .eq("id", appt.id);
    if (error) { alert("Error saving: " + error.message); return false; }
    logAudit({ appointmentId: appt.id, actor, action: auditAction, entity: "manufacturing_data", newData: mfgPayload });
    onRefresh();
    return true;
  };

  const startFirstBatch = async () => {
    if (!newFrom || !newTo) { alert("Enter the aligner set range first."); return; }
    setStartingFirst(true);
    const newBatch = { num: 1, start: newFrom, end: newTo, mfg_started: new Date().toISOString().slice(0, 10), mfg_done: "", shipment_link: "" };
    const mfgPayload = { ...appt.manufacturing_data, batches: [newBatch] };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ manufacturing_data: mfgPayload, journey_steps: { ...(appt.journey_steps || {}), manufacturing_started: true, manufacturing_started_at: newBatch.mfg_started } })
      .eq("id", appt.id);
    setStartingFirst(false);
    if (error) { alert("Error saving: " + error.message); return; }
    logAudit({ appointmentId: appt.id, actor, action: "Manufacturing Started — Batch 1 (sent on plan approval)", entity: "manufacturing_data", newData: mfgPayload });
    onRefresh();
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
        <div>
          <button
            onClick={() => router.push(`/patients/${appt.id}`)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "15px", fontWeight: "800", color: "#111827", textAlign: "left" }}
          >
            {appt.name || "Unnamed Patient"}
          </button>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>
            {appt.phone || "No phone"} · {isNewModel ? "New model" : "Legacy"} · {appt.id?.substring(0, 8).toUpperCase()}
          </p>
        </div>
        {needsFirstBatch && <span style={pill("#fee2e2", "#dc2626")}>Needs Manufacturing</span>}
      </div>

      {needsFirstBatch && (
        <div style={{ padding: "14px", borderRadius: "10px", border: "1px dashed #b8905a", background: "#fffbeb", marginBottom: "12px" }}>
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

      {batches.map((b) => (
        <BatchRow key={b.num} appointmentId={appt.id} batch={{ ...b, delivery_partner: appt.logistics_data?.batches?.find((x) => x.num === b.num)?.delivery_partner || "", delivery_partner_other: appt.logistics_data?.batches?.find((x) => x.num === b.num)?.delivery_partner_other || "", shipment_id: appt.logistics_data?.batches?.find((x) => x.num === b.num)?.shipment_id || "", aligner_received: appt.logistics_data?.batches?.find((x) => x.num === b.num)?.aligner_received || "" }} onSaved={persistBatch} actor={actor} />
      ))}
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
        .select("id, name, phone, status, plan_approved, monthly_plan, amount_paid, manufacturing_data, logistics_data, journey_steps, provisional_min_months, provisional_max_months, final_upper_sets, final_lower_sets, aligner_total_sets, created_at")
        .in("status", ["confirmed", "completed"])
        .order("created_at", { ascending: false });
      if (error) console.error(error);
      setAppointments(data || []);
      setLoading(false);
    };
    load();
  }, [refreshTick]);

  const onRefresh = () => setRefreshTick((t) => t + 1);

  // Every patient with either something already in manufacturing, or a
  // legacy plan approved with nothing sent yet ("needs manufacturing").
  const relevant = appointments.filter((a) => {
    const batches = a.manufacturing_data?.batches || [];
    const isNewModel = isNewModelAppointment(a);
    const needsFirstBatch = !isNewModel && a.plan_approved && batches.length === 0;
    return batches.length > 0 || needsFirstBatch;
  });

  const q = search.toLowerCase();
  const filtered = relevant.filter((a) => !q || (a.name || "").toLowerCase().includes(q) || (a.phone || "").includes(q));

  // Needs-action patients first (nothing started, or a batch mid-production),
  // fully-done patients last.
  const statusRank = (a) => {
    const batches = a.manufacturing_data?.batches || [];
    const isNewModel = isNewModelAppointment(a);
    if (!isNewModel && a.plan_approved && batches.length === 0) return 0;
    if (batches.some((b) => !b.mfg_started)) return 0;
    if (batches.some((b) => b.mfg_started && !b.mfg_done)) return 1;
    return 2;
  };
  const sorted = [...filtered].sort((x, y) => statusRank(x) - statusRank(y));

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Loading manufacturing queue...</div>;
  }

  return (
    <div style={{ maxWidth: "820px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#111827", margin: "0 0 6px" }}>Manufacturing</h1>
        <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
          Every patient's aligner packages — what's been manufactured, what's still due, and dispatch tracking. A package appears here the moment a patient pays for it (new-model) or their plan is approved (legacy).
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
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>No patients currently need manufacturing attention.</p>
      ) : (
        sorted.map((appt) => <PatientCard key={appt.id} appt={appt} actor={actor} onRefresh={onRefresh} />)
      )}
    </div>
  );
}
