"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import { logAudit } from "@/lib/logAudit";

const supabase = getSupabaseClient();

const TABS = ["Payment", "Manufacturing", "Logistics", "Journey", "Patient Page", "Messages", "Report"];

const ALL_STEPS = [
  { key: "booked",                  label: "Appointment Booked" },
  { key: "confirmed",               label: "Appointment Confirmed" },
  { key: "scanning_done",           label: "Scanning and Provisional Planning" },
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
const PENDING_MODE_OPTIONS = [...MODE_OPTIONS, "Installment"];
const FINANCE_OPTIONS = ["Bajaj Finance", "HBD Finance", "Poonawalla Finance"];
const DELIVERY_PARTNERS = ["BlueDart", "Delhivery", "Other"];

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

const subBox = {
  marginTop: "8px",
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
  background: "#fafafa",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
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
  installment_count: "",
  installment_emi: "",
  installment_plan: null,
};

const inr = (n) => `₹ ${(Number(n) || 0).toLocaleString("en-IN")}`;

// Splits pendingAmt into `count` installments of `emi` each, with the
// remainder absorbed by the final installment. Preserves paid status
// for installment numbers that already existed in `existing`.
function buildInstallments(pendingAmt, count, emi, existing = []) {
  const n = parseInt(count) || 0;
  const e = parseFloat(emi) || 0;
  if (n <= 0 || e <= 0) return [];
  const result = [];
  for (let i = 1; i <= n; i++) {
    const amount = i < n ? e : Math.max(0, Math.round((pendingAmt - e * (n - 1)) * 100) / 100);
    const prev = (existing || []).find((x) => x.num === i);
    result.push({ num: i, amount, paid: prev?.paid || false, paid_date: prev?.paid_date || null });
  }
  return result;
}

function PaymentSummaryRow({ label: lbl, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "10px 0", borderBottom: "1px dashed #e5e7eb" }}>
      <span style={{ fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>{lbl}</span>
      <span style={{ fontSize: "14px", fontWeight: "700", color: "#111827", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function PaymentTab({ appointmentId, initialData, actor, patientEmail }) {
  const hasSaved = !!(initialData && (initialData.full_amount || initialData.down_payment || initialData.final_amount));

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(!hasSaved);
  const [data, setData] = useState({ ...EMPTY_PAYMENT, ...initialData });
  const [markingPaid, setMarkingPaid] = useState(null);
  const lastSaved = useRef({ ...EMPTY_PAYMENT, ...initialData });

  const set = (key, val) => setData((prev) => ({ ...prev, [key]: val }));

  const fullAmt = parseFloat(data.full_amount) || 0;
  const disc = parseFloat(data.discount) || 0;
  const couponDisc = parseFloat(data.coupon_discount) || 0;
  const finalAmt = Math.max(0, fullAmt - disc - couponDisc);
  const downPmt = parseFloat(data.down_payment) || 0;
  const pendingAmt = Math.max(0, finalAmt - downPmt);

  const installments = data.installment_plan?.installments || [];
  const remainingBalance = installments.length > 0
    ? installments.filter((inst) => !inst.paid).reduce((sum, inst) => sum + inst.amount, 0)
    : pendingAmt;

  const handleSave = async () => {
    setSaving(true);
    let installmentPlan = data.installment_plan;
    if (data.pending_mode === "Installment") {
      installmentPlan = {
        count: data.installment_count,
        emi: data.installment_emi,
        installments: buildInstallments(pendingAmt, data.installment_count, data.installment_emi, installments),
      };
    }
    const payload = { ...data, final_amount: finalAmt, pending_amount: pendingAmt, installment_plan: installmentPlan };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ payment_data: payload })
      .eq("id", appointmentId);
    setSaving(false);
    if (!error) {
      logAudit({ appointmentId, actor, action: "Payment Details Saved", entity: "payment_data", newData: payload, oldData: lastSaved.current });
      lastSaved.current = payload;
      setData(payload);
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

  const markInstallmentPaid = async (num) => {
    const updatedInstallments = installments.map((inst) =>
      inst.num === num ? { ...inst, paid: true, paid_date: new Date().toISOString().slice(0, 10) } : inst
    );
    const remaining = updatedInstallments.filter((inst) => !inst.paid).reduce((sum, inst) => sum + inst.amount, 0);
    const updatedPlan = { ...data.installment_plan, installments: updatedInstallments };
    const payload = { ...data, installment_plan: updatedPlan };

    setMarkingPaid(num);
    const { error } = await supabase
      .from("appointments_booking")
      .update({ payment_data: payload })
      .eq("id", appointmentId);
    setMarkingPaid(null);
    if (error) { alert("Error saving: " + error.message); return; }

    setData(payload);
    lastSaved.current = payload;
    const paidInst = updatedInstallments.find((inst) => inst.num === num);
    logAudit({ appointmentId, actor, action: `Installment ${num} Marked Paid`, entity: "payment_data", newData: { installment: num, amount: paidInst.amount, remaining } });

    if (patientEmail) {
      fetch("/api/message-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          recipientEmail: patientEmail,
          subject: `Installment ${num} Payment Received — OrisAlign`,
          body: `Thank you for paying your installment number ${num} of ${inr(paidInst.amount)}. Your pending amount is ${inr(remaining)}.`,
          messageType: "email",
          stepKey: "payment_done",
          actorEmail: actor?.email,
          actorRole: actor?.role,
        }),
      }).catch(() => {});
    }
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
            {data.pending_mode === "Installment" && installments.length > 0 && (
              <PaymentSummaryRow label="Remaining Balance" value={inr(remainingBalance)} />
            )}
          </div>

          {data.pending_mode === "Installment" && installments.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Installment Plan</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {installments.map((inst) => (
                  <div key={inst.num} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: inst.paid ? "#f0fdf4" : "#f8f7f5", borderRadius: "8px", border: inst.paid ? "1px solid #bbf7d0" : "1px solid transparent" }}>
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>Installment {inst.num}</span>
                      <span style={{ marginLeft: "8px", fontSize: "13px", color: "#6b7280" }}>{inr(inst.amount)}</span>
                    </div>
                    {inst.paid ? (
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>Paid ✓{inst.paid_date ? ` on ${inst.paid_date}` : ""}</span>
                    ) : (
                      <button
                        onClick={() => markInstallmentPaid(inst.num)}
                        disabled={markingPaid === inst.num}
                        style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: markingPaid === inst.num ? "#d4a574" : "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: markingPaid === inst.num ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                      >
                        {markingPaid === inst.num ? "Saving..." : "Mark Paid"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
            {PENDING_MODE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
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
        {data.pending_mode === "Installment" && (
          <div style={{ marginBottom: "24px" }}>
            <div style={row}>
              <div>
                <span style={label}>NUMBER OF INSTALLMENTS</span>
                <input style={input} type="number" min="1" placeholder="e.g. 5" value={data.installment_count}
                  onChange={(e) => set("installment_count", e.target.value)} />
              </div>
              <div>
                <span style={label}>EMI PER INSTALLMENT (₹)</span>
                <input style={input} type="number" min="0" placeholder="e.g. 6000" value={data.installment_emi}
                  onChange={(e) => set("installment_emi", e.target.value)} />
              </div>
            </div>
            {parseInt(data.installment_count) > 0 && parseFloat(data.installment_emi) > 0 && (
              <div style={{ padding: "10px 12px", background: "#f8f7f5", borderRadius: "8px", fontSize: "12px", color: "#6b7280" }}>
                This will split {inr(pendingAmt)} into {parseInt(data.installment_count)} installments of {inr(data.installment_emi)}
                {(() => {
                  const n = parseInt(data.installment_count);
                  const e = parseFloat(data.installment_emi);
                  const last = Math.max(0, Math.round((pendingAmt - e * (n - 1)) * 100) / 100);
                  return last !== e ? `, with the final installment of ${inr(last)}.` : ".";
                })()}
              </div>
            )}
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
function ManufacturingTab({ appointmentId, initialData, actor }) {
  const [batches, setBatches] = useState(initialData?.batches || []);
  const [alignerDelivered, setAlignerDelivered] = useState(initialData?.aligner_delivered || "");
  const [saving, setSaving] = useState(null);
  const [savedBatch, setSavedBatch] = useState(null);

  const addBatch = () => {
    const nextNum = batches.length > 0 ? Math.max(...batches.map((b) => b.num)) + 1 : 1;
    setBatches((prev) => [...prev, { num: nextNum, start: "", end: "", mfg_started: "", mfg_done: "" }]);
  };

  const updateBatch = (num, key, val) => {
    setBatches((prev) => prev.map((b) => b.num === num ? { ...b, [key]: val } : b));
  };

  const saveBatch = async (num) => {
    const batch = batches.find((b) => b.num === num);
    if (batch.start === "" || batch.end === "") { alert("Enter the aligner set range for this batch."); return; }
    setSaving(num);
    const payload = { batches, aligner_delivered: alignerDelivered };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ manufacturing_data: payload })
      .eq("id", appointmentId);
    setSaving(null);
    if (!error) {
      logAudit({ appointmentId, actor, action: `Manufacturing Batch ${num} Saved`, entity: "manufacturing_data", newData: payload });
      setSavedBatch(num);
      setTimeout(() => setSavedBatch(null), 3000);
    } else {
      alert("Error saving: " + error.message);
    }
  };

  const saveAlignerDelivered = async () => {
    setSaving("delivered");
    const payload = { batches, aligner_delivered: alignerDelivered };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ manufacturing_data: payload })
      .eq("id", appointmentId);
    setSaving(null);
    if (!error) {
      logAudit({ appointmentId, actor, action: "Aligner Delivery Date Saved", entity: "manufacturing_data", newData: { aligner_delivered: alignerDelivered } });
      setSavedBatch("delivered");
      setTimeout(() => setSavedBatch(null), 3000);
    } else {
      alert("Error saving: " + error.message);
    }
  };

  return (
    <div>
      {batches.map((batch) => (
        <div key={batch.num} style={card}>
          <h4 style={{ margin: "0 0 16px", fontSize: "14px", color: "#b8905a", fontWeight: "800", letterSpacing: "0.5px" }}>
            BATCH {batch.num}
          </h4>
          <div style={row}>
            <div>
              <span style={label}>ALIGNERS FROM</span>
              <input style={input} type="number" min="0" placeholder="e.g. 0" value={batch.start}
                onChange={(e) => updateBatch(batch.num, "start", e.target.value)} />
            </div>
            <div>
              <span style={label}>ALIGNERS TO</span>
              <input style={input} type="number" min="0" placeholder="e.g. 1" value={batch.end}
                onChange={(e) => updateBatch(batch.num, "end", e.target.value)} />
            </div>
          </div>
          <div style={row}>
            <div>
              <span style={label}>MANUFACTURING START DATE</span>
              <input style={input} type="date" value={batch.mfg_started}
                onChange={(e) => updateBatch(batch.num, "mfg_started", e.target.value)} />
            </div>
            <div>
              <span style={label}>MANUFACTURING END DATE</span>
              <input style={input} type="date" value={batch.mfg_done}
                onChange={(e) => updateBatch(batch.num, "mfg_done", e.target.value)} />
            </div>
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

      <div style={card}>
        <button style={btnGold} onClick={addBatch}>+ Add Batch</button>
      </div>

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
                setBatches([]); setAlignerDelivered("");
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
function LogisticsTab({ appointmentId, manufacturingData, initialData, actor }) {
  const mfgBatches = manufacturingData?.batches || [];
  const [batches, setBatches] = useState(() => {
    return mfgBatches.map((mb) => {
      const existing = (initialData?.batches || []).find((b) => b.num === mb.num);
      return {
        num: mb.num, start: mb.start, end: mb.end,
        mfg_started: mb.mfg_started || "", mfg_done: mb.mfg_done || "",
        aligner_received: existing?.aligner_received || "",
        delivery_partner: existing?.delivery_partner || "",
        delivery_partner_other: existing?.delivery_partner_other || "",
        shipment_id: existing?.shipment_id || "",
        shipment_link: existing?.shipment_link || "",
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
      batches: batches.map(({ num: n, aligner_received, delivery_partner, delivery_partner_other, shipment_id, shipment_link }) => ({
        num: n, aligner_received, delivery_partner, delivery_partner_other, shipment_id, shipment_link,
      })),
    };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ logistics_data: payload })
      .eq("id", appointmentId);
    setSaving(null);
    if (!error) {
      logAudit({ appointmentId, actor, action: `Logistics Batch ${num} Saved`, entity: "logistics_data", newData: payload.batches.find((b) => b.num === num) });
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
            BATCH {batch.num} — Aligners {batch.start} to {batch.end}
          </h4>
          <div style={{ marginBottom: "14px" }}>
            {batch.mfg_started && <span style={infoPill}>Started: {batch.mfg_started}</span>}
            {batch.mfg_done && <span style={infoPill}>Done: {batch.mfg_done}</span>}
            {!batch.mfg_started && !batch.mfg_done && (
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
              <select style={select} value={batch.delivery_partner}
                onChange={(e) => updateBatch(batch.num, "delivery_partner", e.target.value)}>
                <option value="">Select...</option>
                {DELIVERY_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          {batch.delivery_partner === "Other" && (
            <div style={{ marginBottom: "16px" }}>
              <span style={label}>DELIVERY PARTNER NAME</span>
              <input style={input} type="text" placeholder="Enter delivery partner name" value={batch.delivery_partner_other}
                onChange={(e) => updateBatch(batch.num, "delivery_partner_other", e.target.value)} />
            </div>
          )}
          <div style={{ marginBottom: "16px" }}>
            <span style={label}>SHIPMENT ID</span>
            <input style={input} type="text" placeholder="Tracking number" value={batch.shipment_id}
              onChange={(e) => updateBatch(batch.num, "shipment_id", e.target.value)} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <span style={label}>SHIPMENT TRACKING LINK</span>
            <input style={input} type="url" placeholder="https://..." value={batch.shipment_link}
              onChange={(e) => updateBatch(batch.num, "shipment_link", e.target.value)} />
            <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#9ca3af" }}>
              Patient sees a &quot;Track Shipment&quot; button that opens this link, plus a copyable shipment ID.
            </p>
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
              onClick={() => setBatches((prev) => prev.map((b) => b.num === batch.num ? { ...b, aligner_received: "", delivery_partner: "", delivery_partner_other: "", shipment_id: "", shipment_link: "" } : b))}
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
              setBatches((prev) => prev.map((b) => ({ ...b, aligner_received: "", delivery_partner: "", delivery_partner_other: "", shipment_id: "", shipment_link: "" })));
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
const PAYMENT_PUSH_OPTIONS = [
  { value: "down_payment", label: "Down Payment" },
  { value: "full", label: "Full Payment" },
  { value: "pending", label: "Pending Amount" },
  { value: "others", label: "Others" },
];

function JourneyTab({ appointmentId, appt, isAdmin, actor }) {
  const [steps, setSteps] = useState(() => deriveSteps(appt));
  const [saving, setSaving] = useState(null);

  // Part A — Scanning & Provisional Planning video
  const [scanningVideoUrl, setScanningVideoUrl] = useState(appt.scanning_video_url || "");
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Part A2 — Scanning & Provisional Planning: pre-treatment scanning review link
  const [scanningReviewLink, setScanningReviewLink] = useState(appt.scanning_review_link || "");
  const [savingScanningLink, setSavingScanningLink] = useState(false);
  const [scanningLinkSaved, setScanningLinkSaved] = useState(false);

  // Part B — Price & Payment: payment type to push
  const [paymentType, setPaymentType] = useState(appt.payment_type_to_collect || "down_payment");
  const [customAmount, setCustomAmount] = useState(appt.payment_custom_amount ? String(appt.payment_custom_amount) : "");
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(false);

  // Part C — Planning Done: review link
  const [reviewLink, setReviewLink] = useState(appt.review_link || "");
  const [savingLink, setSavingLink] = useState(false);
  const [linkSaved, setLinkSaved] = useState(false);

  // Part C0 — Planning Done: aligner set plan
  const [alignerTotalSets, setAlignerTotalSets] = useState(appt.aligner_total_sets ? String(appt.aligner_total_sets) : "");
  const [alignerDaysPerSet, setAlignerDaysPerSet] = useState(appt.aligner_days_per_set || null);
  const [savingAligner, setSavingAligner] = useState(false);
  const [alignerSaved, setAlignerSaved] = useState(false);

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;
    setUploadingVideo(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `appointments/${appointmentId}/scanning/video_${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from("patient-docs").upload(path, file, { upsert: true });
    if (uploadError) {
      setUploadingVideo(false);
      alert("Failed to upload video: " + uploadError.message);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("patient-docs").getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("appointments_booking")
      .update({ scanning_video_url: publicUrl })
      .eq("id", appointmentId);
    setUploadingVideo(false);
    if (updateError) {
      alert("Failed to save video: " + updateError.message);
      return;
    }
    setScanningVideoUrl(publicUrl);
    logAudit({ appointmentId, actor, action: "Scanning & Planning Video Uploaded", entity: "scanning_video_url", newData: { scanning_video_url: publicUrl, file_name: file.name } });
  };

  const removeVideo = async () => {
    if (!window.confirm("Remove this video?")) return;
    const { error } = await supabase.from("appointments_booking").update({ scanning_video_url: null }).eq("id", appointmentId);
    if (error) { alert("Failed to remove video: " + error.message); return; }
    setScanningVideoUrl("");
    logAudit({ appointmentId, actor, action: "Scanning & Planning Video Removed", entity: "scanning_video_url", newData: { scanning_video_url: null } });
  };

  const pushPaymentType = async () => {
    if (paymentType === "others" && !(parseFloat(customAmount) > 0)) {
      alert("Enter a valid custom amount.");
      return;
    }
    setPushing(true);
    try {
      const res = await fetch("/api/set-payment-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          paymentType,
          customAmount: paymentType === "others" ? parseFloat(customAmount) : undefined,
          actorEmail: actor?.email,
          actorRole: actor?.role,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert("Failed: " + (json.error || "Unknown error"));
        return;
      }
      setPushed(true);
      setTimeout(() => setPushed(false), 3000);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setPushing(false);
    }
  };

  const saveAlignerPlan = async () => {
    const sets = parseInt(alignerTotalSets, 10);
    if (!sets || sets <= 0) { alert("Enter a valid total number of sets."); return; }
    if (alignerDaysPerSet !== 10 && alignerDaysPerSet !== 15) { alert("Select wear duration per set (10 or 15 days)."); return; }
    setSavingAligner(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({ aligner_total_sets: sets, aligner_days_per_set: alignerDaysPerSet })
      .eq("id", appointmentId);
    setSavingAligner(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: "Aligner Plan Saved", entity: "aligner_plan", newData: { aligner_total_sets: sets, aligner_days_per_set: alignerDaysPerSet } });
    setAlignerSaved(true);
    setTimeout(() => setAlignerSaved(false), 3000);
  };

  const saveReviewLink = async () => {
    setSavingLink(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({ review_link: reviewLink.trim() || null })
      .eq("id", appointmentId);
    setSavingLink(false);
    if (error) { alert("Failed to save link: " + error.message); return; }
    logAudit({ appointmentId, actor, action: "Planning Review Link Saved", entity: "review_link", newData: { review_link: reviewLink.trim() || null } });
    setLinkSaved(true);
    setTimeout(() => setLinkSaved(false), 3000);
  };

  const saveScanningReviewLink = async () => {
    setSavingScanningLink(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({ scanning_review_link: scanningReviewLink.trim() || null })
      .eq("id", appointmentId);
    setSavingScanningLink(false);
    if (error) { alert("Failed to save link: " + error.message); return; }
    logAudit({ appointmentId, actor, action: "Scanning Review Link Saved", entity: "scanning_review_link", newData: { scanning_review_link: scanningReviewLink.trim() || null } });
    setScanningLinkSaved(true);
    setTimeout(() => setScanningLinkSaved(false), 3000);
  };

  const toggle = async (key) => {
    if (!isAdmin) return;
    const currentVal = !!steps[key];
    const newVal = !currentVal;
    const updated = { ...steps, [key]: newVal };
    setSteps(updated);
    setSaving(key);
    const js = appt.journey_steps || {};
    const newJs = { ...js, [key]: newVal };
    const updatePayload = { journey_steps: newJs };
    if (key === "plan_approved" && !newVal) {
      updatePayload.plan_approved = false;
      updatePayload.plan_approved_at = null;
      updatePayload.plan_approval_ip = null;
      delete newJs.plan_approved_at;
    }
    const { error } = await supabase
      .from("appointments_booking")
      .update(updatePayload)
      .eq("id", appointmentId);
    setSaving(null);
    if (error) {
      alert("Save failed: " + error.message);
      setSteps((prev) => ({ ...prev, [key]: currentVal }));
      return;
    }
    if (key === "feedback_submitted") {
      logAudit({ appointmentId, actor, action: newVal ? "Feedback Submitted" : "Feedback Marked Undone", entity: "feedback_submitted", newData: { [key]: newVal } });
    }
    if (newVal) {
      fetch("/api/notify-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, stepKey: key, email: appt.email || null }),
      })
        .then((r) => r.json())
        .then((j) => { if (j.skipped) console.warn("notify-step skipped:", j.reason); })
        .catch(() => {});
    }
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
            <div key={step.key}>
              <div style={{
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

              {/* Part A — Scanning & Provisional Planning video upload */}
              {isAdmin && step.key === "scanning_done" && (
                <div style={subBox}>
                  <span style={label}>PROVISIONAL PLANNING VIDEO (any format)</span>
                  {scanningVideoUrl ? (
                    <>
                      <video controls src={scanningVideoUrl} style={{ width: "100%", maxHeight: "260px", borderRadius: "8px", background: "#000" }} />
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <label style={{ ...btnPrimary, background: "#6b7280", cursor: uploadingVideo ? "not-allowed" : "pointer", opacity: uploadingVideo ? 0.6 : 1 }}>
                          {uploadingVideo ? "Uploading..." : "Replace Video"}
                          <input type="file" onChange={handleVideoUpload} disabled={uploadingVideo} style={{ display: "none" }} />
                        </label>
                        <button onClick={removeVideo} disabled={uploadingVideo} style={{ padding: "10px 22px", borderRadius: "10px", border: "1px solid #fecaca", background: "#fff", color: "#dc2626", fontWeight: "700", fontSize: "13px", cursor: uploadingVideo ? "not-allowed" : "pointer" }}>
                          Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <label style={{ ...btnGold, display: "inline-block", textAlign: "center", cursor: uploadingVideo ? "not-allowed" : "pointer", opacity: uploadingVideo ? 0.6 : 1 }}>
                      {uploadingVideo ? "Uploading..." : "Upload Video"}
                      <input type="file" onChange={handleVideoUpload} disabled={uploadingVideo} style={{ display: "none" }} />
                    </label>
                  )}
                  <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>
                    Visible to the patient on their journey page — they can view and download it.
                  </p>
                </div>
              )}

              {/* Part A2 — Scanning & Provisional Planning: pre-treatment scanning review link */}
              {isAdmin && step.key === "scanning_done" && (
                <div style={subBox}>
                  <span style={label}>PRE-TREATMENT SCANNING REVIEW LINK</span>
                  <input
                    style={input}
                    type="url"
                    placeholder="https://..."
                    value={scanningReviewLink}
                    onChange={(e) => setScanningReviewLink(e.target.value)}
                  />
                  <button
                    style={savingScanningLink ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                    onClick={saveScanningReviewLink}
                    disabled={savingScanningLink}
                  >
                    {savingScanningLink ? "Saving..." : scanningLinkSaved ? "Saved ✓" : "Save Link"}
                  </button>
                  <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>
                    Appears to the patient as a &quot;Review&quot; button to review their pre-treatment scanning.
                  </p>
                </div>
              )}

              {/* Part B — Price & Payment: select which payment to push */}
              {isAdmin && step.key === "payment_done" && (
                <div style={subBox}>
                  <span style={label}>PAYMENT TO PUSH TO PATIENT</span>
                  <select style={select} value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                    {PAYMENT_PUSH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {paymentType === "others" && (
                    <input
                      style={input}
                      type="number"
                      placeholder="Enter amount (₹)"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                    />
                  )}
                  <button
                    style={pushing ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                    onClick={pushPaymentType}
                    disabled={pushing}
                  >
                    {pushing ? "Pushing..." : pushed ? "Pushed ✓" : "Push to Patient"}
                  </button>
                </div>
              )}

              {/* Part C0 — Planning Done: aligner set plan */}
              {isAdmin && step.key === "planning_done" && (
                <div style={subBox}>
                  <span style={label}>TOTAL NUMBER OF ALIGNER SETS</span>
                  <input
                    style={input}
                    type="number"
                    min="1"
                    placeholder="e.g. 12"
                    value={alignerTotalSets}
                    onChange={(e) => setAlignerTotalSets(e.target.value.replace(/\D/g, ""))}
                  />
                  <span style={label}>WEAR DURATION PER SET</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[10, 15].map((d) => (
                      <button
                        key={d}
                        onClick={() => setAlignerDaysPerSet(d)}
                        style={{
                          flex: 1, padding: "10px", borderRadius: "8px",
                          border: alignerDaysPerSet === d ? "2px solid #b8905a" : "1px solid #e5e7eb",
                          background: alignerDaysPerSet === d ? "#fff7ed" : "white",
                          color: alignerDaysPerSet === d ? "#b8905a" : "#374151",
                          fontWeight: "700", fontSize: "13px", cursor: "pointer",
                        }}
                      >
                        {d} Days
                      </button>
                    ))}
                  </div>
                  {parseInt(alignerTotalSets, 10) > 0 && alignerDaysPerSet && (
                    <p style={{ margin: 0, fontSize: "13px", color: "#16a34a", fontWeight: "700" }}>
                      Total Duration: {parseInt(alignerTotalSets, 10) * alignerDaysPerSet} days (~{Math.round((parseInt(alignerTotalSets, 10) * alignerDaysPerSet) / 30)} months)
                    </p>
                  )}
                  <button
                    style={savingAligner ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                    onClick={saveAlignerPlan}
                    disabled={savingAligner}
                  >
                    {savingAligner ? "Saving..." : alignerSaved ? "Saved ✓" : "Save Aligner Plan"}
                  </button>
                  <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>
                    Shown to the patient once this step is marked done.
                  </p>
                </div>
              )}

              {/* Part C — Planning Done: review link */}
              {isAdmin && step.key === "planning_done" && (
                <div style={subBox}>
                  <span style={label}>TREATMENT PLAN REVIEW LINK</span>
                  <input
                    style={input}
                    type="url"
                    placeholder="https://..."
                    value={reviewLink}
                    onChange={(e) => setReviewLink(e.target.value)}
                  />
                  <button
                    style={savingLink ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                    onClick={saveReviewLink}
                    disabled={savingLink}
                  >
                    {savingLink ? "Saving..." : linkSaved ? "Saved ✓" : "Save Link"}
                  </button>
                  <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>
                    Appears to the patient as a &quot;Review&quot; button that opens this link in a new tab.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────
const MESSAGE_SUBSECTIONS = ["Templates", "History"];

function pillStyle(bg, color) {
  return {
    display: "inline-block", padding: "3px 10px", borderRadius: "99px",
    background: bg, color, fontSize: "11px", fontWeight: "700",
    letterSpacing: "0.5px", whiteSpace: "nowrap",
  };
}

function deliveryBadge(status) {
  if (status === "sent") return pillStyle("#dcfce7", "#16a34a");
  if (status === "failed") return pillStyle("#fee2e2", "#dc2626");
  return pillStyle("#f3f4f6", "#6b7280");
}

function MessageTemplatesPanel({ actor }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStep, setEditingStep] = useState(null);
  const [formData, setFormData] = useState({ subject: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    fetch("/api/message-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = (template) => {
    setEditingStep(template.step_key);
    setFormData({ subject: template.subject_line || "", body: template.email_body || "" });
    setSaved(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepKey: editingStep,
          subjectLine: formData.subject,
          emailBody: formData.body,
          actorEmail: actor?.email,
          actorRole: actor?.role,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTemplates((prev) => prev.map((t) => t.step_key === editingStep
          ? { ...t, subject_line: formData.subject, email_body: formData.body, updated_at: new Date().toISOString(), updated_by: actor?.email || t.updated_by }
          : t));
        setSaved(editingStep);
        setEditingStep(null);
        setTimeout(() => setSaved(null), 3000);
      } else {
        alert("Error saving template: " + (json.error || "Unknown error"));
      }
    } catch {
      alert("Network error saving template.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: "#6b7280", fontSize: "14px" }}>Loading templates...</p>;

  return (
    <div>
      {templates.map((t) => {
        const isEditing = editingStep === t.step_key;
        return (
          <div key={t.step_key} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: "14px", color: "#111827" }}>{t.step_label || t.step_key}</h4>
                <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>
                  {t.updated_at ? `Updated ${new Date(t.updated_at).toLocaleDateString()}${t.updated_by ? ` by ${t.updated_by}` : ""}` : "Default template"}
                </p>
              </div>
              {saved === t.step_key && <span style={pillStyle("#dcfce7", "#16a34a")}>SAVED ✓</span>}
            </div>

            {isEditing ? (
              <div>
                <div style={{ marginBottom: "12px" }}>
                  <span style={label}>SUBJECT LINE</span>
                  <input style={input} type="text" value={formData.subject}
                    onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))} />
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <span style={label}>EMAIL BODY</span>
                  <textarea style={{ ...input, minHeight: "140px", fontFamily: "inherit", resize: "vertical" }} rows={8}
                    value={formData.body}
                    onChange={(e) => setFormData((p) => ({ ...p, body: e.target.value }))} />
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button style={saving ? { ...btnPrimary, opacity: 0.6 } : btnPrimary} onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button onClick={() => setEditingStep(null)}
                    style={{ padding: "10px 22px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#374151" }}>
                  <strong>Subject:</strong> {t.subject_line}
                </p>
                <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#9ca3af", lineHeight: "1.6", whiteSpace: "pre-wrap", maxHeight: "80px", overflow: "hidden" }}>
                  {t.email_body}
                </p>
                <button style={btnGold} onClick={() => handleEdit(t)}>Edit</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MessageHistoryPanel({ appointmentId, recipientEmail, actor }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const loadMessages = async () => {
    const res = await fetch(`/api/message-history?appointmentId=${appointmentId}`);
    const json = await res.json();
    setMessages(json.messages || []);
    setLoading(false);
  };

  useEffect(() => { loadMessages(); }, [appointmentId]);

  const handleSend = async () => {
    if (!recipientEmail) { alert("This patient has no email on file."); return; }
    setSending(true);
    try {
      const res = await fetch("/api/message-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          recipientEmail,
          subject: draft.subject,
          body: draft.body,
          messageType: "email",
          actorEmail: actor?.email,
          actorRole: actor?.role,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDraft({ subject: "", body: "" });
        setSent(true);
        setTimeout(() => setSent(false), 3000);
        loadMessages();
      } else {
        alert("Error sending message: " + (json.error || "Unknown error"));
      }
    } catch {
      alert("Network error sending message.");
    } finally {
      setSending(false);
    }
  };

  const canSend = !!draft.subject && !!draft.body && !sending && !!recipientEmail;

  return (
    <div>
      <div style={card}>
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#111827" }}>📝 Send New Message</h3>
        <div style={{ marginBottom: "12px" }}>
          <span style={label}>SUBJECT</span>
          <input style={input} type="text" placeholder="Email subject" value={draft.subject}
            onChange={(e) => setDraft((p) => ({ ...p, subject: e.target.value }))} />
        </div>
        <div style={{ marginBottom: "16px" }}>
          <span style={label}>MESSAGE BODY</span>
          <textarea style={{ ...input, minHeight: "120px", fontFamily: "inherit", resize: "vertical" }} rows={6}
            placeholder="Message body... (HTML supported)" value={draft.body}
            onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))} />
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button style={canSend ? btnPrimary : { ...btnPrimary, opacity: 0.6, cursor: "not-allowed" }} onClick={handleSend} disabled={!canSend}>
            {sending ? "Sending..." : sent ? "Sent ✓" : `Send to ${recipientEmail || "patient"}`}
          </button>
          <button onClick={() => setDraft({ subject: "", body: "" })}
            style={{ padding: "10px 22px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#6b7280", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>
            Clear
          </button>
        </div>
        {!recipientEmail && (
          <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#dc2626" }}>This patient has no email on file — sending is disabled.</p>
        )}
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#111827" }}>Sent Messages</h3>
        {loading ? (
          <p style={{ color: "#6b7280", fontSize: "13px" }}>Loading...</p>
        ) : messages.length === 0 ? (
          <p style={{ color: "#9ca3af", fontStyle: "italic", fontSize: "13px" }}>No messages sent yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "14px", color: "#111827" }}>{msg.subject}</strong>
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <span style={pillStyle(msg.is_template ? "#dbeafe" : "#fef3c7", msg.is_template ? "#1e40af" : "#92400e")}>
                      {msg.is_template ? "Template" : "Custom"}
                    </span>
                    <span style={deliveryBadge(msg.delivery_status)}>{msg.delivery_status}</span>
                  </div>
                </div>
                <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#9ca3af" }}>
                  {new Date(msg.sent_at).toLocaleString()} · To: {msg.recipient_email} · By: {msg.sent_by}
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#6b7280", lineHeight: "1.6" }}>
                  {(msg.body || "").replace(/<[^>]*>/g, "").substring(0, 200)}{(msg.body || "").length > 200 ? "..." : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessagesTab({ appointmentId, recipientEmail, actor }) {
  const [sub, setSub] = useState("Templates");
  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {MESSAGE_SUBSECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            style={{
              padding: "8px 18px", borderRadius: "8px", border: "1px solid #e5e7eb",
              background: sub === s ? "#b8905a" : "white",
              color: sub === s ? "white" : "#374151",
              fontWeight: "700", fontSize: "12px", cursor: "pointer", letterSpacing: "0.5px",
            }}
          >
            {s === "Templates" ? "Message Templates" : "Message History"}
          </button>
        ))}
      </div>
      {sub === "Templates" ? (
        <MessageTemplatesPanel actor={actor} />
      ) : (
        <MessageHistoryPanel appointmentId={appointmentId} recipientEmail={recipientEmail} actor={actor} />
      )}
    </div>
  );
}

// ─── Report Tab ───────────────────────────────────────────────────────────────
function ReportTab({ appointmentId, appt }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch(`/api/audit-log?appointmentId=${appointmentId}`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .catch(() => {});
  }, [appointmentId]);

  const steps = deriveSteps(appt);
  const js = appt.journey_steps || {};
  const pd = { ...EMPTY_PAYMENT, ...(appt.payment_data || {}) };
  const fullAmt = parseFloat(pd.full_amount) || 0;
  const disc = parseFloat(pd.discount) || 0;
  const couponDisc = parseFloat(pd.coupon_discount) || 0;
  const finalAmt = pd.final_amount !== undefined && pd.final_amount !== "" && pd.final_amount !== null
    ? Number(pd.final_amount)
    : Math.max(0, fullAmt - disc - couponDisc);
  const downPmt = parseFloat(pd.down_payment) || 0;
  const pendingAmt = pd.pending_amount !== undefined && pd.pending_amount !== "" && pd.pending_amount !== null
    ? Number(pd.pending_amount)
    : Math.max(0, finalAmt - downPmt);
  const hasPaymentData = !!(pd.full_amount || pd.down_payment || appt.payment_data?.final_amount);
  const manufacturingData = appt.manufacturing_data || {};
  const manufacturingBatches = manufacturingData.batches || [];
  const logisticsBatches = appt.logistics_data?.batches || [];

  const fmt = (iso) => {
    if (!iso) return null;
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  };

  // audit-log entries are returned newest-first, so the first match is the latest one
  const findDoneLog = (label) => logs.find((l) => l.action === `Step Marked Done: ${label}`);

  const stepInfo = ALL_STEPS.map((step) => {
    const done = !!steps[step.key];
    let timestamp = null;
    let actorEmail = null;
    let note = null;

    if (step.key === "booked") {
      timestamp = appt.created_at;
    } else if (step.key === "scanning_done" && appt.appointment_started_at) {
      timestamp = appt.appointment_started_at;
      note = "Verified via patient OTP";
    } else if (step.key === "plan_approved" && (js.plan_approved_at || appt.plan_approved_at)) {
      timestamp = js.plan_approved_at || appt.plan_approved_at;
      note = `Verified via patient OTP${appt.plan_approval_ip ? ` · IP ${appt.plan_approval_ip}` : ""}`;
    } else {
      const log = findDoneLog(step.label);
      if (log) {
        timestamp = log.created_at;
        actorEmail = log.actor_email;
      }
    }

    return { ...step, done, timestamp, actorEmail, note };
  });

  const doneCount = stepInfo.filter((s) => s.done).length;

  return (
    <div>
      <div style={{ ...card, marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", color: "#111827" }}>Patient Journey Report</h3>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>{doneCount} / {stepInfo.length} steps completed</span>
            <div style={{ height: "8px", width: "120px", borderRadius: "99px", background: "#e5e7eb", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: "99px", width: `${Math.round((doneCount / stepInfo.length) * 100)}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)", transition: "width 0.4s ease" }} />
            </div>
          </div>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#9ca3af" }}>
          A complete stepwise record of this patient&apos;s treatment journey — dates, times, and details for every milestone.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {stepInfo.map((step, i) => (
          <div
            key={step.key}
            style={{
              ...card,
              marginBottom: 0,
              border: `1px solid ${step.done ? "#bbf7d0" : "#e5e7eb"}`,
              background: step.done ? "linear-gradient(135deg, #f9fefb, #ffffff)" : "white",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
                background: step.done ? "linear-gradient(135deg, #22c55e, #16a34a)" : "#f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: step.done ? "white" : "#9ca3af", fontWeight: "700", fontSize: "13px",
              }}>
                {step.done ? "✓" : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", color: step.done ? "#15803d" : "#374151" }}>{step.label}</h4>
                  <span style={pillStyle(step.done ? "#dcfce7" : "#f3f4f6", step.done ? "#16a34a" : "#9ca3af")}>
                    {step.done ? "COMPLETED" : "PENDING"}
                  </span>
                </div>

                {step.done && step.timestamp && (
                  <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#6b7280" }}>
                    {fmt(step.timestamp)}
                    {step.actorEmail ? ` · by ${step.actorEmail}` : ""}
                    {step.note ? ` · ${step.note}` : ""}
                  </p>
                )}
                {step.done && !step.timestamp && (
                  <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#9ca3af" }}>Completed (timestamp not recorded)</p>
                )}

                {/* Payment breakdown */}
                {step.key === "payment_done" && hasPaymentData && (
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed #e5e7eb" }}>
                    <PaymentSummaryRow label="Full Amount" value={inr(pd.full_amount)} />
                    {parseFloat(pd.discount) > 0 && (
                      <PaymentSummaryRow label="Discount" value={`− ${inr(pd.discount)}`} />
                    )}
                    {(pd.coupon_code || parseFloat(pd.coupon_discount) > 0) && (
                      <PaymentSummaryRow
                        label={pd.coupon_code ? `Coupon (${pd.coupon_code})` : "Coupon"}
                        value={`− ${inr(pd.coupon_discount)}`}
                      />
                    )}
                    <PaymentSummaryRow label="Final Amount (after discount)" value={inr(finalAmt)} />
                    <PaymentSummaryRow
                      label="Down Payment Given"
                      value={`${inr(pd.down_payment)} · ${pd.down_payment_mode}${pd.down_payment_mode === "Finance" ? ` (${pd.finance_provider})` : ""}`}
                    />
                    <PaymentSummaryRow
                      label="Pending Amount"
                      value={`${inr(pendingAmt)} · to be paid via ${pd.pending_mode}${pd.pending_mode === "Finance" ? ` (${pd.finance_provider})` : ""}`}
                    />
                    {pd.pending_mode === "Installment" && pd.installment_plan?.installments?.length > 0 && (
                      <div style={{ marginTop: "8px" }}>
                        <p style={{ margin: "2px 0 8px", fontSize: "11px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Installment Plan</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {pd.installment_plan.installments.map((inst) => (
                            <div key={inst.num} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: inst.paid ? "#f0fdf4" : "#f8f7f5", borderRadius: "8px", border: inst.paid ? "1px solid #bbf7d0" : "none" }}>
                              <span style={{ fontSize: "13px", color: "#111827", fontWeight: "600" }}>Installment {inst.num} · {inr(inst.amount)}</span>
                              <span style={{ fontSize: "12px", fontWeight: "700", color: inst.paid ? "#16a34a" : "#9ca3af" }}>
                                {inst.paid ? `Paid ✓${inst.paid_date ? ` on ${inst.paid_date}` : ""}` : "Pending"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Scanning & Provisional Planning extras */}
                {step.key === "scanning_done" && (appt.scanning_video_url || appt.scanning_review_link) && (
                  <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {appt.scanning_video_url && (
                      <a href={appt.scanning_video_url} target="_blank" rel="noopener noreferrer" style={{ ...infoPill, textDecoration: "none" }}>
                        📹 Provisional Planning Video
                      </a>
                    )}
                    {appt.scanning_review_link && (
                      <a href={appt.scanning_review_link} target="_blank" rel="noopener noreferrer" style={{ ...infoPill, textDecoration: "none" }}>
                        🔗 Pre-Treatment Scanning Review
                      </a>
                    )}
                  </div>
                )}

                {/* Planning Done extras */}
                {step.key === "planning_done" && (appt.aligner_total_sets || appt.review_link) && (
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed #e5e7eb" }}>
                    {appt.aligner_total_sets && appt.aligner_days_per_set && (
                      <div style={{ marginBottom: "10px" }}>
                        <PaymentSummaryRow label="Total Number of Sets" value={appt.aligner_total_sets} />
                        <PaymentSummaryRow label="Wear Duration per Set" value={`${appt.aligner_days_per_set} days`} />
                        <PaymentSummaryRow
                          label="Total Treatment Duration"
                          value={`${appt.aligner_total_sets * appt.aligner_days_per_set} days (~${Math.round((appt.aligner_total_sets * appt.aligner_days_per_set) / 30)} months)`}
                        />
                      </div>
                    )}
                    {appt.review_link && (
                      <a href={appt.review_link} target="_blank" rel="noopener noreferrer" style={{ ...infoPill, textDecoration: "none" }}>
                        🔗 Treatment Plan Review
                      </a>
                    )}
                  </div>
                )}

                {/* Manufacturing Completed extras */}
                {step.key === "manufacturing_completed" && (manufacturingBatches.length > 0 || manufacturingData.aligner_delivered) && (
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed #e5e7eb" }}>
                    <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Manufacturing Batches</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {manufacturingBatches.map((b) => (
                        <div key={b.num} style={{ padding: "8px 12px", background: "#f8f7f5", borderRadius: "8px" }}>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827" }}>Batch {b.num} · Aligners {b.start}–{b.end}</p>
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6b7280" }}>
                            {b.mfg_started ? `Started: ${b.mfg_started}` : "Not started"}{b.mfg_done ? ` · Done: ${b.mfg_done}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                    {manufacturingData.aligner_delivered && (
                      <p style={{ margin: "10px 0 0", fontSize: "13px", color: "#374151" }}>
                        <strong>Aligners Delivered to Clinic:</strong> {manufacturingData.aligner_delivered}
                      </p>
                    )}
                  </div>
                )}

                {/* Aligners Dispatched extras */}
                {step.key === "aligners_dispatched" && logisticsBatches.length > 0 && (
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed #e5e7eb" }}>
                    <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Shipment Details</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {logisticsBatches.map((b) => {
                        const partnerName = b.delivery_partner === "Other" ? (b.delivery_partner_other || "Other") : b.delivery_partner;
                        return (
                          <div key={b.num} style={{ padding: "8px 12px", background: "#f8f7f5", borderRadius: "8px" }}>
                            <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827" }}>
                              Batch {b.num}{partnerName ? ` · ${partnerName}` : ""}
                            </p>
                            {b.shipment_id && (
                              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6b7280" }}>Shipment ID: {b.shipment_id}</p>
                            )}
                            {b.aligner_received && (
                              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6b7280" }}>Received by patient: {b.aligner_received}</p>
                            )}
                            {b.shipment_link && (
                              <a href={b.shipment_link} target="_blank" rel="noopener noreferrer" style={{ ...infoPill, textDecoration: "none", marginTop: "6px", display: "inline-block" }}>
                                🔗 Track Shipment
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
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
  const [actor, setActor] = useState(null);

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
        const role = roleData?.role || "";
        setUserRole(role);
        setActor({ email: authData.user.email || null, role });
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
        <JourneyTab appointmentId={id} appt={appt} isAdmin={userRole === "admin"} actor={actor} />
      </div>
      <div style={{ display: activeTab === "Payment" ? "block" : "none" }}>
        <PaymentTab appointmentId={id} initialData={appt.payment_data || {}} actor={actor} patientEmail={appt.email} />
      </div>
      <div style={{ display: activeTab === "Manufacturing" ? "block" : "none" }}>
        <ManufacturingTab appointmentId={id} initialData={appt.manufacturing_data || null} actor={actor} />
      </div>
      <div style={{ display: activeTab === "Logistics" ? "block" : "none" }}>
        <LogisticsTab appointmentId={id} manufacturingData={appt.manufacturing_data || null} initialData={appt.logistics_data || null} actor={actor} />
      </div>
      <div style={{ display: activeTab === "Patient Page" ? "block" : "none" }}>
        <PatientPageTab appointmentId={id} />
      </div>
      <div style={{ display: activeTab === "Messages" ? "block" : "none" }}>
        <MessagesTab appointmentId={id} recipientEmail={appt.email} actor={actor} />
      </div>
      <div style={{ display: activeTab === "Report" ? "block" : "none" }}>
        <ReportTab appointmentId={id} appt={appt} />
      </div>
    </div>
  );
}
