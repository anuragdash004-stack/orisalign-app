"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";

const supabase = getSupabaseClient();

const TABS = ["Payment", "Manufacturing", "Logistics", "Journey", "Patient Page"];

const ALL_STEPS = [
  { key: "booked",                  label: "Appointment Booked" },
  { key: "confirmed",               label: "Appointment Confirmed" },
  { key: "scanning_done",           label: "Scanning & Planning" },
  { key: "payment_done",            label: "Price & Payment" },
  { key: "planning_done",           label: "Planning Done" },
  { key: "plan_approved",           label: "Plan Approved" },
  { key: "manufacturing_started",   label: "Manufacturing Started" },
  { key: "manufacturing_completed", label: "Manufacturing Completed" },
  { key: "aligners_dispatched",     label: "Aligners Dispatched" },
  { key: "aligners_received",       label: "Aligners Received" },
  { key: "followup_appointment",    label: "Appointment Book" },
  { key: "aligners_delivered",      label: "Aligners Delivered" },
  { key: "smile_correction",        label: "Smile Correction Started" },
  { key: "treatment_completed",     label: "Treatment Completed" },
  { key: "feedback_submitted",      label: "Feedback Submitted" },
];
const MODE_OPTIONS = ["Cash", "Card", "UPI", "Bank Transfer", "Finance"];
const FINANCE_OPTIONS = ["Bajaj Finance", "HBD Finance", "Poonawalla Finance"];

function calculateBatches(totalSets) {
  const batches = [];
  let start = 0;
  while (start <= totalSets) {
    const batchSize = start === 0 ? 7 : 6;
    const end = Math.min(start + batchSize - 1, totalSets);
    batches.push({ num: batches.length + 1, start, end });
    if (end >= totalSets) break;
    start = end + 1;
  }
  return batches;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const card = {
  background: "white",
  borderRadius: "16px",
  border: "1px solid #e5e7eb",
  padding: "24px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  marginBottom: "16px",
};

const label = {
  display: "block",
  fontSize: "12px",
  fontWeight: "700",
  color: "#6b7280",
  marginBottom: "6px",
  letterSpacing: "0.5px",
};

const input = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #e5e7eb",
  fontSize: "14px",
  outline: "none",
  background: "white",
  color: "#111827",
  boxSizing: "border-box",
};

const readonlyInput = {
  ...input,
  background: "#f8f7f5",
  color: "#374151",
  fontWeight: "700",
};

const select = {
  ...input,
  cursor: "pointer",
};

const btnPrimary = {
  padding: "10px 22px",
  borderRadius: "10px",
  border: "none",
  background: "#111827",
  color: "white",
  fontWeight: "700",
  fontSize: "13px",
  cursor: "pointer",
  letterSpacing: "0.5px",
};

const btnGold = {
  ...btnPrimary,
  background: "linear-gradient(135deg, #b8905a, #f59e0b)",
};

const infoPill = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "99px",
  background: "#f3f4f6",
  color: "#374151",
  fontSize: "12px",
  fontWeight: "600",
  marginRight: "8px",
  marginBottom: "6px",
};

const row = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "16px",
  marginBottom: "16px",
};

// ─── Payment Tab ─────────────────────────────────────────────────────────────
const EMPTY_PAYMENT = {
  full_amount: "",
  discount: "",
  coupon_code: "",
  coupon_discount: "",
  down_payment: "",
  down_payment_mode: "Cash",
  pending_mode: "Cash",
  finance_provider: "Bajaj Finance",
};

const inr = (n) => `₹ ${(Number(n) || 0).toLocaleString("en-IN")}`;

function PaymentSummaryRow({ label: lbl, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "10px 0", borderBottom: "1px dashed #e5e7eb" }}>
      <span style={{ fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>{lbl}</span>
      <span style={{ fontSize: "14px", fontWeight: "700", color: "#111827", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function PaymentTab({ appointmentId, initialData }) {
  const hasSaved = !!(initialData && (initialData.full_amount || initialData.down_payment || initialData.final_amount));

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(!hasSaved);
  const [data, setData] = useState({ ...EMPTY_PAYMENT, ...initialData });

  const set = (key, val) => setData((prev) => ({ ...prev, [key]: val }));

  const fullAmt = parseFloat(data.full_amount) || 0;
  const disc = parseFloat(data.discount) || 0;
  const couponDisc = parseFloat(data.coupon_discount) || 0;
  const finalAmt = Math.max(0, fullAmt - disc - couponDisc);
  const downPmt = parseFloat(data.down_payment) || 0;
  const pendingAmt = Math.max(0, finalAmt - downPmt);

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...data, final_amount: finalAmt, pending_amount: pendingAmt };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ payment_data: payload })
      .eq("id", appointmentId);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } else {
      alert("Error saving payment: " + error.message);
    }
  };

  const handleCancel = () => {
    setData({ ...EMPTY_PAYMENT, ...initialData });
    setEditing(false);
  };

  if (!editing && hasSaved) {
    return (
      <div>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#111827" }}>Payment Details</h3>
            <span style={{ fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "99px", background: "#dcfce7", color: "#16a34a", letterSpacing: "0.5px" }}>SAVED ✓</span>
          </div>
          <div style={{ marginBottom: "20px" }}>
            <PaymentSummaryRow label="Full Amount" value={inr(data.full_amount)} />
            {parseFloat(data.discount) > 0 && (
              <PaymentSummaryRow label="Discount" value={`− ${inr(data.discount)}`} />
            )}
            {(data.coupon_code || parseFloat(data.coupon_discount) > 0) && (
              <PaymentSummaryRow
                label={data.coupon_code ? `Coupon (${data.coupon_code})` : "Coupon"}
                value={`− ${inr(data.coupon_discount)}`}
              />
            )}
            <PaymentSummaryRow label="Final Amount" value={inr(finalAmt)} />
            <PaymentSummaryRow
              label="Down Payment"
              value={`${inr(data.down_payment)} · ${data.down_payment_mode}${data.down_payment_mode === "Finance" ? ` (${data.finance_provider})` : ""}`}
            />
            <PaymentSummaryRow
              label="Pending Amount"
              value={`${inr(pendingAmt)} · ${data.pending_mode}${data.pending_mode === "Finance" ? ` (${data.finance_provider})` : ""}`}
            />
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button style={btnGold} onClick={() => setEditing(true)}>Edit Payment</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={card}>
        <h3 style={{ margin: "0 0 20px", fontSize: "16px", color: "#111827" }}>
          {hasSaved ? "Edit Payment Details" : "Payment Details"}
        </h3>
        <div style={row}>
          <div>
            <span style={label}>FULL AMOUNT (₹)</span>
            <input style={input} type="number" placeholder="0" value={data.full_amount}
              onChange={(e) => set("full_amount", e.target.value)} />
          </div>
          <div>
            <span style={label}>DISCOUNT (₹)</span>
            <input style={input} type="number" placeholder="0" value={data.discount}
              onChange={(e) => set("discount", e.target.value)} />
          </div>
        </div>
        <div style={row}>
          <div>
            <span style={label}>COUPON CODE</span>
            <input style={input} type="text" placeholder="e.g. SAVE200" value={data.coupon_code}
              onChange={(e) => set("coupon_code", e.target.value)} />
          </div>
          <div>
            <span style={label}>COUPON DISCOUNT (₹)</span>
            <input style={input} type="number" placeholder="0" value={data.coupon_discount}
              onChange={(e) => set("coupon_discount", e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <span style={label}>FINAL AMOUNT (₹) — auto-calculated</span>
          <input style={readonlyInput} type="text" readOnly value={`₹ ${finalAmt.toLocaleString("en-IN")}`} />
        </div>
        <div style={{ ...row, marginBottom: "8px" }}>
          <div>
            <span style={label}>DOWN PAYMENT (₹)</span>
            <input style={input} type="number" placeholder="0" value={data.down_payment}
              onChange={(e) => set("down_payment", e.target.value)} />
          </div>
          <div>
            <span style={label}>MODE OF PAYMENT</span>
            <select style={select} value={data.down_payment_mode}
              onChange={(e) => set("down_payment_mode", e.target.value)}>
              {MODE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {data.down_payment_mode === "Finance" && (
          <div style={{ marginBottom: "16px" }}>
            <span style={label}>FINANCE PROVIDER</span>
            <select style={select} value={data.finance_provider}
              onChange={(e) => set("finance_provider", e.target.value)}>
              {FINANCE_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        )}
        <div style={{ marginBottom: "20px" }}>
          <span style={label}>PENDING AMOUNT (₹) — auto-calculated</span>
          <input style={readonlyInput} type="text" readOnly value={`₹ ${pendingAmt.toLocaleString("en-IN")}`} />
        </div>
        <div style={{ marginBottom: "24px" }}>
          <span style={label}>PENDING AMOUNT MODE OF PAYMENT</span>
          <select style={select} value={data.pending_mode}
            onChange={(e) => set("pending_mode", e.target.value)}>
            {MODE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {data.pending_mode === "Finance" && (
          <div style={{ marginBottom: "24px" }}>
            <span style={label}>PENDING FINANCE PROVIDER</span>
            <select style={select} value={data.finance_provider}
              onChange={(e) => set("finance_provider", e.target.value)}>
              {FINANCE_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button style={saving ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
            onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save Payment"}
          </button>
          {hasSaved && (
            <button onClick={handleCancel}
              style={{ padding: "10px 22px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>
              Cancel
            </button>
          )}
          <button
            onClick={async () => {
              if (!window.confirm("Clear all payment data?")) return;
              setData({ ...EMPTY_PAYMENT });
              await supabase.from("appointments_booking").update({ payment_data: {} }).eq("id", appointmentId);
              setEditing(true);
            }}
            style={{ padding: "10px 22px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#6b7280", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Manufacturing Tab ────────────────────────────────────────────────────────
function ManufacturingTab({ appointmentId, initialData }) {
  const [totalSets, setTotalSets] = useState(initialData?.total_sets ?? "");
  const [batches, setBatches] = useState(initialData?.batches || []);
  const [alignerDelivered, setAlignerDelivered] = useState(initialData?.aligner_delivered || "");
  const [saving, setSaving] = useState(null);
  const [savedBatch, setSavedBatch] = useState(null);

  const handleSetupBatches = async () => {
    const n = parseInt(totalSets);
    if (isNaN(n) || n < 0) { alert("Enter a valid number of total sets."); return; }
    const computed = calculateBatches(n);
    const merged = computed.map((b) => {
      const existing = batches.find((x) => x.num === b.num);
      return { ...b, mfg_started: existing?.mfg_started || "", mfg_done: existing?.mfg_done || "", dispatched: existing?.dispatched || "" };
    });
    setBatches(merged);
    await supabase.from("appointments_booking")
      .update({ manufacturing_data: { total_sets: n, batches: merged, aligner_delivered: alignerDelivered } })
      .eq("id", appointmentId);
  };

  const updateBatch = (num, key, val) => {
    setBatches((prev) => prev.map((b) => b.num === num ? { ...b, [key]: val } : b));
  };

  const saveBatch = async (num) => {
    setSaving(num);
    const payload = { total_sets: parseInt(totalSets), batches, aligner_delivered: alignerDelivered };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ manufacturing_data: payload })
      .eq("id", appointmentId);
    setSaving(null);
    if (!error) {
      setSavedBatch(num);
      setTimeout(() => setSavedBatch(null), 3000);
    } else {
      alert("Error saving: " + error.message);
    }
  };

  const saveAlignerDelivered = async () => {
    setSaving("delivered");
    const payload = { total_sets: parseInt(totalSets), batches, aligner_delivered: alignerDelivered };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ manufacturing_data: payload })
      .eq("id", appointmentId);
    setSaving(null);
    if (!error) {
      setSavedBatch("delivered");
      setTimeout(() => setSavedBatch(null), 3000);
    } else {
      alert("Error saving: " + error.message);
    }
  };

  return (
    <div>
      <div style={card}>
        <h3 style={{ margin: "0 0 20px", fontSize: "16px", color: "#111827" }}>Manufacturing Setup</h3>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <span style={label}>TOTAL SETS</span>
            <input style={input} type="number" placeholder="e.g. 24" value={totalSets}
              onChange={(e) => setTotalSets(e.target.value)} />
          </div>
          <button style={btnGold} onClick={handleSetupBatches}>Setup Batches</button>
        </div>
      </div>
      {batches.map((batch) => (
        <div key={batch.num} style={card}>
          <h4 style={{ margin: "0 0 16px", fontSize: "14px", color: "#b8905a", fontWeight: "800", letterSpacing: "0.5px" }}>
            BATCH {batch.num} — Sets {batch.start} to {batch.end}
          </h4>
          <div style={row}>
            <div>
              <span style={label}>MANUFACTURING STARTED</span>
              <input style={input} type="date" value={batch.mfg_started}
                onChange={(e) => updateBatch(batch.num, "mfg_started", e.target.value)} />
            </div>
            <div>
              <span style={label}>MANUFACTURING DONE</span>
              <input style={input} type="date" value={batch.mfg_done}
                onChange={(e) => updateBatch(batch.num, "mfg_done", e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <span style={label}>DISPATCHED</span>
            <input style={input} type="date" value={batch.dispatched}
              onChange={(e) => updateBatch(batch.num, "dispatched", e.target.value)} />
          </div>
          <button
            style={saving === batch.num ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
            onClick={() => saveBatch(batch.num)}
            disabled={saving === batch.num}
          >
            {saving === batch.num ? "Saving..." : savedBatch === batch.num ? "Saved ✓" : "Save Batch"}
          </button>
        </div>
      ))}
      {batches.length > 0 && (
        <div style={card}>
          <h4 style={{ margin: "0 0 16px", fontSize: "14px", color: "#111827", fontWeight: "800", letterSpacing: "0.5px" }}>
            ALIGNER DELIVERED
          </h4>
          <div style={{ marginBottom: "16px" }}>
            <span style={label}>DELIVERY DATE</span>
            <input style={input} type="date" value={alignerDelivered}
              onChange={(e) => setAlignerDelivered(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              style={saving === "delivered" ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
              onClick={saveAlignerDelivered}
              disabled={saving === "delivered"}
            >
              {saving === "delivered" ? "Saving..." : savedBatch === "delivered" ? "Saved ✓" : "Save"}
            </button>
            <button
              onClick={async () => {
                if (!window.confirm("Clear ALL manufacturing data including all batches?")) return;
                setTotalSets(""); setBatches([]); setAlignerDelivered("");
                await supabase.from("appointments_booking").update({ manufacturing_data: {} }).eq("id", appointmentId);
              }}
              style={{ padding: "10px 22px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#6b7280", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Logistics Tab ────────────────────────────────────────────────────────────
function LogisticsTab({ appointmentId, manufacturingData, initialData }) {
  const mfgBatches = manufacturingData?.batches || [];
  const [batches, setBatches] = useState(() => {
    return mfgBatches.map((mb) => {
      const existing = (initialData?.batches || []).find((b) => b.num === mb.num);
      return {
        num: mb.num, start: mb.start, end: mb.end,
        mfg_started: mb.mfg_started || "", mfg_done: mb.mfg_done || "", dispatched: mb.dispatched || "",
        aligner_received: existing?.aligner_received || "",
        delivery_partner: existing?.delivery_partner || "",
        shipment_id: existing?.shipment_id || "",
      };
    });
  });
  const [saving, setSaving] = useState(null);
  const [savedBatch, setSavedBatch] = useState(null);

  if (!manufacturingData || mfgBatches.length === 0) {
    return (
      <div style={card}>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>
          Set up Manufacturing first to configure logistics.
        </p>
      </div>
    );
  }

  const updateBatch = (num, key, val) => {
    setBatches((prev) => prev.map((b) => b.num === num ? { ...b, [key]: val } : b));
  };

  const saveBatch = async (num) => {
    setSaving(num);
    const payload = {
      batches: batches.map(({ num: n, aligner_received, delivery_partner, shipment_id }) => ({
        num: n, aligner_received, delivery_partner, shipment_id,
      })),
    };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ logistics_data: payload })
      .eq("id", appointmentId);
    setSaving(null);
    if (!error) {
      setSavedBatch(num);
      setTimeout(() => setSavedBatch(null), 3000);
    } else {
      alert("Error saving: " + error.message);
    }
  };

  return (
    <div>
      {batches.map((batch) => (
        <div key={batch.num} style={card}>
          <h4 style={{ margin: "0 0 14px", fontSize: "14px", color: "#b8905a", fontWeight: "800", letterSpacing: "0.5px" }}>
            BATCH {batch.num} — Sets {batch.start} to {batch.end}
          </h4>
          <div style={{ marginBottom: "14px" }}>
            {batch.mfg_started && <span style={infoPill}>Started: {batch.mfg_started}</span>}
            {batch.mfg_done && <span style={infoPill}>Done: {batch.mfg_done}</span>}
            {batch.dispatched && <span style={infoPill}>Dispatched: {batch.dispatched}</span>}
            {!batch.mfg_started && !batch.mfg_done && !batch.dispatched && (
              <span style={{ ...infoPill, color: "#9ca3af" }}>No manufacturing dates yet</span>
            )}
          </div>
          <div style={row}>
            <div>
              <span style={label}>ALIGNER RECEIVED BY PATIENT</span>
              <input style={input} type="date" value={batch.aligner_received}
                onChange={(e) => updateBatch(batch.num, "aligner_received", e.target.value)} />
            </div>
            <div>
              <span style={label}>DELIVERY PARTNER</span>
              <input style={input} type="text" placeholder="e.g. BlueDart, Delhivery" value={batch.delivery_partner}
                onChange={(e) => updateBatch(batch.num, "delivery_partner", e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <span style={label}>SHIPMENT ID</span>
            <input style={input} type="text" placeholder="Tracking number" value={batch.shipment_id}
              onChange={(e) => updateBatch(batch.num, "shipment_id", e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              style={saving === batch.num ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
              onClick={() => saveBatch(batch.num)}
              disabled={saving === batch.num}
            >
              {saving === batch.num ? "Saving..." : savedBatch === batch.num ? "Saved ✓" : "Save Batch"}
            </button>
            <button
              onClick={() => setBatches((prev) => prev.map((b) => b.num === batch.num ? { ...b, aligner_received: "", delivery_partner: "", shipment_id: "" } : b))}
              style={{ padding: "10px 22px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#6b7280", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
            >
              Clear
            </button>
          </div>
        </div>
      ))}
      {batches.length > 0 && (
        <div style={{ textAlign: "right", marginTop: "4px" }}>
          <button
            onClick={async () => {
              if (!window.confirm("Clear ALL logistics data?")) return;
              setBatches((prev) => prev.map((b) => ({ ...b, aligner_received: "", delivery_partner: "", shipment_id: "" })));
              await supabase.from("appointments_booking").update({ logistics_data: {} }).eq("id", appointmentId);
            }}
            style={{ padding: "8px 18px", borderRadius: "10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
          >
            Clear All Logistics
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Derive steps ─────────────────────────────────────────────────────────────
function deriveSteps(appt) {
  if (!appt) return {};
  const js = appt.journey_steps || {};
  return {
    booked:                  js.booked               !== undefined ? !!js.booked               : true,
    confirmed:               js.confirmed            !== undefined ? !!js.confirmed            : appt.status !== "pending",
    scanning_done:           js.scanning_done        !== undefined ? !!js.scanning_done        : !!appt.stl_submitted,
    payment_done:            js.payment_done         !== undefined ? !!js.payment_done         : !!(appt.payment_data?.final_amount),
    planning_done:           js.planning_done        !== undefined ? !!js.planning_done        : !!appt.provisional_plan_submitted,
    plan_approved:           js.plan_approved        !== undefined ? !!js.plan_approved        : !!(appt.final_plan && appt.final_plan.trim()),
    manufacturing_started:   js.manufacturing_started  !== undefined ? !!js.manufacturing_started  : false,
    manufacturing_completed: js.manufacturing_completed !== undefined ? !!js.manufacturing_completed : false,
    aligners_dispatched:     js.aligners_dispatched  !== undefined ? !!js.aligners_dispatched  : false,
    aligners_received:       js.aligners_received    !== undefined ? !!js.aligners_received    : false,
    followup_appointment:    js.followup_appointment !== undefined ? !!js.followup_appointment : false,
    aligners_delivered:      js.aligners_delivered   !== undefined ? !!js.aligners_delivered   : false,
    smile_correction:        js.smile_correction     !== undefined ? !!js.smile_correction     : false,
    treatment_completed:     js.treatment_completed  !== undefined ? !!js.treatment_completed  : appt.status === "completed",
    feedback_submitted:      js.feedback_submitted   !== undefined ? !!js.feedback_submitted   : false,
  };
}

// ─── Patient Page Tab ─────────────────────────────────────────────────────────
function PatientPageTab({ appointmentId }) {
  return (
    <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", overflow: "hidden", height: "80vh", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <iframe
        src={`/patient/${appointmentId}`}
        style={{ width: "100%", height: "100%", border: "none" }}
        title="Patient Journey Preview"
      />
    </div>
  );
}

// ─── Journey Tab (admin only) ─────────────────────────────────────────────────
function JourneyTab({ appointmentId, appt, isAdmin }) {
  const [steps, setSteps] = useState(() => deriveSteps(appt));
  const [saving, setSaving] = useState(null);

  const toggle = async (key) => {
    if (!isAdmin) return;
    const currentVal = !!steps[key];
    const newVal = !currentVal;
    const updated = { ...steps, [key]: newVal };
    setSteps(updated);
    setSaving(key);
    const js = appt.journey_steps || {};
    const newJs = { ...js, [key]: newVal };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ journey_steps: newJs })
      .eq("id", appointmentId);
    setSaving(null);
    if (error) { alert("Save failed: " + error.message); setSteps((prev) => ({ ...prev, [key]: currentVal })); }
  };

  const doneCount = ALL_STEPS.filter((s) => !!steps[s.key]).length;

  return (
    <div>
      <div style={{ ...card, marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", color: "#111827" }}>Treatment Roadmap</h3>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>{doneCount} / {ALL_STEPS.length} steps done</span>
            <div style={{ height: "8px", width: "120px", borderRadius: "99px", background: "#e5e7eb", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: "99px", width: `${Math.round((doneCount / ALL_STEPS.length) * 100)}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)", transition: "width 0.4s ease" }} />
            </div>
          </div>
        </div>
        {!isAdmin && <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#9ca3af" }}>Only admins can approve steps.</p>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {ALL_STEPS.map((step, i) => {
          const done = !!steps[step.key];
          const isSaving = saving === step.key;
          return (
            <div key={step.key} style={{
              display: "flex", alignItems: "center", gap: "12px",
              borderRadius: "12px", padding: "14px 16px",
              border: `1px solid ${done ? "#bbf7d0" : "#e5e7eb"}`,
              background: done ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "white",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
                background: done ? "linear-gradient(135deg, #22c55e, #16a34a)" : "#f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done ? "white" : "#9ca3af", fontWeight: "700", fontSize: "13px",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <p style={{ margin: 0, flex: 1, fontSize: "14px", fontWeight: done ? "700" : "500", color: done ? "#15803d" : "#374151" }}>
                {step.label}
              </p>
              {isAdmin && (
                <button
                  onClick={() => toggle(step.key)}
                  disabled={isSaving}
                  style={{
                    padding: "6px 14px", borderRadius: "8px", border: "none", cursor: isSaving ? "not-allowed" : "pointer",
                    background: done ? "#fee2e2" : "#111827",
                    color: done ? "#dc2626" : "white",
                    fontWeight: "700", fontSize: "12px", flexShrink: 0,
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {isSaving ? "..." : done ? "Undo" : "Mark Done"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PatientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Payment");
  const [loading, setLoading] = useState(true);
  const [appt, setAppt] = useState(null);
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [{ data }, { data: authData }] = await Promise.all([
        supabase.from("appointments_booking").select("*").eq("id", id).single(),
        supabase.auth.getUser(),
      ]);
      setAppt(data || null);
      if (authData?.user) {
        const { data: roleData } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
        setUserRole(roleData?.role || "");
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Loading patient data...</div>;
  }

  if (!appt) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#dc2626" }}>
        Patient not found.{" "}
        <button style={{ ...btnPrimary, marginLeft: "12px" }} onClick={() => router.push("/patients")}>
          Back to Patients
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "#f8f7f5", minHeight: "100vh", padding: "24px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <button
          onClick={() => router.push("/patients")}
          style={{ background: "none", border: "none", color: "#b8905a", fontSize: "13px", fontWeight: "700", cursor: "pointer", padding: 0, marginBottom: "10px", letterSpacing: "0.5px" }}
        >
          ← Back to Patients
        </button>
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "linear-gradient(135deg, #b8905a, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "22px", flexShrink: 0 }}>
            {(appt.name || "P")[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: "0 0 4px", fontSize: "20px", color: "#111827" }}>{appt.name || "Unnamed Patient"}</h1>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
              {appt.phone || "No phone"}
              {appt.email ? ` • ${appt.email}` : ""}
              {" • "}
              <span style={{ fontFamily: "monospace", fontSize: "12px" }}>{appt.id?.substring(0, 8).toUpperCase()}</span>
            </p>
          </div>
          <div style={{ padding: "6px 14px", borderRadius: "99px", background: "#f3f4f6", fontSize: "12px", fontWeight: "700", color: "#374151", letterSpacing: "0.5px" }}>
            {appt.status?.toUpperCase() || "PENDING"}
          </div>
        </div>
      </div>

      {/* Tab Pills */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "9px 20px", borderRadius: "99px", border: "none",
              background: activeTab === tab ? "#111827" : "white",
              color: activeTab === tab ? "white" : "#374151",
              fontWeight: "700", fontSize: "13px", cursor: "pointer", letterSpacing: "0.5px",
              boxShadow: activeTab === tab ? "0 2px 8px rgba(17,24,39,0.18)" : "0 1px 4px rgba(0,0,0,0.06)",
              border: activeTab === tab ? "none" : "1px solid #e5e7eb",
              transition: "all 0.15s ease",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ display: activeTab === "Journey" ? "block" : "none" }}>
        <JourneyTab appointmentId={id} appt={appt} isAdmin={userRole === "admin"} />
      </div>
      <div style={{ display: activeTab === "Payment" ? "block" : "none" }}>
        <PaymentTab appointmentId={id} initialData={appt.payment_data || {}} />
      </div>
      <div style={{ display: activeTab === "Manufacturing" ? "block" : "none" }}>
        <ManufacturingTab appointmentId={id} initialData={appt.manufacturing_data || null} />
      </div>
      <div style={{ display: activeTab === "Logistics" ? "block" : "none" }}>
        <LogisticsTab appointmentId={id} manufacturingData={appt.manufacturing_data || null} initialData={appt.logistics_data || null} />
      </div>
      <div style={{ display: activeTab === "Patient Page" ? "block" : "none" }}>
        <PatientPageTab appointmentId={id} />
      </div>
    </div>
  );
}
