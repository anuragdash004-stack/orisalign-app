"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import { logAudit } from "@/lib/logAudit";

const supabase = getSupabaseClient();

const TABS = ["Payment", "Manufacturing", "Journey", "Message", "Patient Page", "Report"];

const ALL_STEPS = [
  { key: "booked",                  label: "Appointment Booked" },
  { key: "confirmed",               label: "Appointment Confirmed" },
  { key: "scanning_done",           label: "Scanning and Provisional Planning" },
  { key: "payment_done",            label: "Plan and Payment" },
  { key: "planning_done",           label: "Full Plan" },
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
const DELIVERY_PARTNERS = ["BlueDart", "Delhivery", "Other"];
const MODEL_OPTIONS = [
  { label: "6-8", value: "6-8", fullAmount: 65000 },
  { label: "8-10", value: "8-10", fullAmount: 70000 },
  { label: "10-12", value: "10-12", fullAmount: 80000 },
  { label: "12-14", value: "12-14", fullAmount: 89000 },
  { label: "14-16", value: "14-16", fullAmount: 99000 },
  { label: "16-18", value: "16-18", fullAmount: 108000 },
];
const DOWN_PAYMENT_FIXED = 12500;
const PLAN_OPTIONS = ["ORISPRO", "ORISPLUS"];
const PAYMENT_METHOD_OPTIONS = ["UPI", "Credit Card", "Debit Card", "NACH", "Installments", "E-Mandate"];
const RECURRING_MODES = ["NACH", "E-Mandate"];

// Adds `months` calendar months to a "YYYY-MM-DD" date string.
function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Builds `tenure` recurring installments of `amount` each, starting on
// `recurringDate` and repeating monthly. Preserves paid status for
// installment numbers that already existed in `existing`.
function buildRecurringInstallments(amount, tenure, recurringDate, existing = []) {
  const n = parseInt(tenure) || 0;
  const amt = parseFloat(amount) || 0;
  if (n <= 0 || amt <= 0 || !recurringDate) return [];
  const result = [];
  for (let i = 1; i <= n; i++) {
    const date = addMonths(recurringDate, i - 1);
    const prev = (existing || []).find((x) => x.num === i);
    result.push({ num: i, amount: amt, date, paid: prev?.paid || false, paid_date: prev?.paid_date || null });
  }
  return result;
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

function PaymentSummaryRow({ label: lbl, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "10px 0", borderBottom: "1px dashed #e5e7eb" }}>
      <span style={{ fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>{lbl}</span>
      <span style={{ fontSize: "14px", fontWeight: "700", color: "#111827", textAlign: "right" }}>{value}</span>
    </div>
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

function PaymentTab({ appointmentId, initialData, actor, patientEmail }) {
  const [appt, setAppt] = useState(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedModelForApply, setSelectedModelForApply] = useState(null);
  const [applyingModel, setApplyingModel] = useState(false);

  // Card 2 fields — kept flat and minimal, per the simplified report below.
  const [plan, setPlan] = useState(initialData?.plan ?? "");
  const [fullAmount, setFullAmount] = useState(initialData?.full_amount ?? "");
  const [coupon, setCoupon] = useState(initialData?.discount ?? "");
  const [downPayment, setDownPayment] = useState(initialData?.down_payment ?? "");
  const [paidAmount, setPaidAmount] = useState("");
  const [mode, setMode] = useState(initialData?.payment_mode ?? "");
  const [pushing, setPushing] = useState(false);
  const [isLocked, setIsLocked] = useState(!!(initialData && initialData.full_amount));
  const initializedFromAppt = useRef(false);

  // Card 3 — Pending collection schedule (only shown while pendingAmt > 0).
  const pendingPlanInit = initialData?.pending_plan || {};
  const [pendingMode, setPendingMode] = useState(pendingPlanInit.mode ?? "");
  const [pendingPlanAmount, setPendingPlanAmount] = useState(pendingPlanInit.amount ?? "");
  const [pendingTenure, setPendingTenure] = useState(pendingPlanInit.tenure ?? "");
  const [pendingRecurringDate, setPendingRecurringDate] = useState(pendingPlanInit.recurring_date ?? "");
  const [pendingInstallments, setPendingInstallments] = useState(pendingPlanInit.installments || []);
  const [isPendingLocked, setIsPendingLocked] = useState(!!pendingPlanInit.mode);
  const [generatingPending, setGeneratingPending] = useState(false);
  const [markingInstallmentPaid, setMarkingInstallmentPaid] = useState(null);

  useEffect(() => {
    supabase.from("appointments_booking").select("*").eq("id", appointmentId).single()
      .then(({ data }) => setAppt(data || null));
  }, [appointmentId]);

  // amount_paid lives outside payment_data, on the row itself — prime it
  // once the row loads, without clobbering anything the admin has already
  // started typing.
  useEffect(() => {
    if (appt && !initializedFromAppt.current) {
      setPaidAmount(appt.amount_paid ? String(appt.amount_paid) : "");
      initializedFromAppt.current = true;
    }
  }, [appt]);

  const applyModel = async () => {
    if (!selectedModelForApply) return;
    setApplyingModel(true);
    setFullAmount(String(selectedModelForApply.fullAmount));
    setDownPayment(String(DOWN_PAYMENT_FIXED));

    const newJourneySteps = { ...(appt?.journey_steps || {}), payment_done: true };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ treatment_model: selectedModelForApply.value, journey_steps: newJourneySteps })
      .eq("id", appointmentId);

    if (!error) {
      setAppt((prev) => prev && { ...prev, treatment_model: selectedModelForApply.value, journey_steps: newJourneySteps });
      logAudit({ appointmentId, actor, action: "Treatment Model Selected", entity: "treatment_model", newData: { treatment_model: selectedModelForApply.value } });
      if (!appt?.journey_steps?.payment_done) {
        fetch("/api/notify-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId, stepKey: "payment_done", email: patientEmail || null }),
        }).catch(() => {});
      }
    }

    setShowModelSelector(false);
    setSelectedModelForApply(null);
    setApplyingModel(false);
  };

  const clearModel = async () => {
    setFullAmount("");
    setDownPayment("");
    await supabase.from("appointments_booking").update({ treatment_model: null }).eq("id", appointmentId).catch(() => {});
    setAppt((prev) => prev && { ...prev, treatment_model: null });
    logAudit({ appointmentId, actor, action: "Treatment Model Cleared", entity: "treatment_model", newData: { treatment_model: null } });
  };

  const fullAmt = parseFloat(fullAmount) || 0;
  const couponAmt = parseFloat(coupon) || 0;
  const finalAmt = Math.max(0, fullAmt - couponAmt);
  const paidAmt = parseFloat(paidAmount) || 0;
  const pendingAmt = Math.max(0, finalAmt - paidAmt);

  // The same numbers shown here are exactly what the patient's journey page
  // reads (full_amount/down_payment/plan/payment_mode from payment_data,
  // amount_paid/payment_status from the row) — so pushing this report is the
  // manual fallback for when the patient's own self-serve payment never
  // reflected automatically. The gateway itself always recomputes its own
  // trusted amount fresh when the patient clicks Pay Now, so this push
  // doesn't need to touch payment_type_to_collect.
  const pushReport = async () => {
    if (fullAmt <= 0) { alert("Enter a full payment amount first."); return; }
    setPushing(true);
    try {
      const paymentStatus = finalAmt > 0 && paidAmt >= finalAmt ? "paid" : paidAmt > 0 ? "partial" : "pending";
      const paymentData = {
        ...(appt?.payment_data || {}),
        plan: plan || "",
        full_amount: fullAmt,
        discount: couponAmt || "",
        final_amount: finalAmt,
        down_payment: parseFloat(downPayment) || "",
        payment_mode: mode || "",
      };
      const newJourneySteps = { ...(appt?.journey_steps || {}), payment_done: true };

      const { error } = await supabase
        .from("appointments_booking")
        .update({
          payment_data: paymentData,
          amount_paid: paidAmt,
          amount_to_pay: pendingAmt,
          payment_status: paymentStatus,
          journey_steps: newJourneySteps,
        })
        .eq("id", appointmentId);

      if (error) { alert("Error saving: " + error.message); return; }

      logAudit({
        appointmentId, actor, action: "Payment Report Pushed to Patient", entity: "payment_data",
        newData: { ...paymentData, amount_paid: paidAmt, amount_to_pay: pendingAmt, payment_status: paymentStatus },
      });

      setAppt((prev) => prev && {
        ...prev, payment_data: paymentData, amount_paid: paidAmt, amount_to_pay: pendingAmt,
        payment_status: paymentStatus, journey_steps: newJourneySteps,
      });
      setIsLocked(true);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setPushing(false);
    }
  };

  const isRecurringMode = RECURRING_MODES.includes(pendingMode);

  const savePendingSetup = async () => {
    if (!pendingMode) { alert("Select how the pending amount will be collected."); return; }
    if (isRecurringMode && !(parseFloat(pendingPlanAmount) > 0 && parseInt(pendingTenure) > 0 && pendingRecurringDate)) {
      alert("Enter the amount, tenure, and recurring date.");
      return;
    }
    setGeneratingPending(true);
    try {
      const installments = isRecurringMode
        ? buildRecurringInstallments(pendingPlanAmount, pendingTenure, pendingRecurringDate, pendingInstallments)
        : [];
      const pendingPlan = {
        mode: pendingMode,
        amount: pendingPlanAmount || "",
        tenure: pendingTenure || "",
        recurring_date: pendingRecurringDate || "",
        installments,
      };
      const newPaymentData = { ...(appt?.payment_data || {}), pending_plan: pendingPlan };

      const { error } = await supabase
        .from("appointments_booking")
        .update({ payment_data: newPaymentData })
        .eq("id", appointmentId);
      if (error) { alert("Error saving: " + error.message); return; }

      logAudit({ appointmentId, actor, action: "Pending Payment Schedule Saved", entity: "payment_data", newData: pendingPlan });

      setAppt((prev) => prev && { ...prev, payment_data: newPaymentData });
      setPendingInstallments(installments);
      setIsPendingLocked(true);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setGeneratingPending(false);
    }
  };

  // Marking an installment paid records it through the same trusted,
  // additive endpoint the gateways use (it validates against
  // payment_data.full_amount), so the patient's Paid/Pending figures stay
  // consistent regardless of where a payment came from.
  const markInstallmentPaid = async (num) => {
    const inst = pendingInstallments.find((x) => x.num === num);
    if (!inst || inst.paid) return;
    setMarkingInstallmentPaid(num);
    try {
      const res = await fetch("/api/update-payment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          amountPaid: inst.amount,
          paymentMethod: pendingMode,
          notes: `Installment ${num} of ${pendingInstallments.length}`,
          actorEmail: actor?.email,
          actorRole: actor?.role,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert("Failed to record payment: " + (json.error || "Unknown error"));
        return;
      }

      const updatedInstallments = pendingInstallments.map((x) =>
        x.num === num ? { ...x, paid: true, paid_date: new Date().toISOString().slice(0, 10) } : x
      );
      const updatedPendingPlan = { mode: pendingMode, amount: pendingPlanAmount, tenure: pendingTenure, recurring_date: pendingRecurringDate, installments: updatedInstallments };
      const newPaymentData = { ...(appt?.payment_data || {}), pending_plan: updatedPendingPlan };

      const { error } = await supabase
        .from("appointments_booking")
        .update({ payment_data: newPaymentData })
        .eq("id", appointmentId);
      if (error) { alert("Error saving: " + error.message); return; }

      logAudit({ appointmentId, actor, action: `Installment ${num} Marked Paid`, entity: "payment_data", newData: { installment: num, amount: inst.amount, totalPaid: json.totalPaid } });

      setPendingInstallments(updatedInstallments);
      setPaidAmount(String(json.totalPaid));
      setAppt((prev) => prev && {
        ...prev, payment_data: newPaymentData, amount_paid: json.totalPaid, amount_to_pay: json.stillToPay, payment_status: json.paymentStatus,
      });
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setMarkingInstallmentPaid(null);
    }
  };

  return (
    <div>
      {/* Card 1 — Select Treatment Model */}
      <div style={card}>
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#111827" }}>Select Treatment Model</h3>
        <button
          onClick={() => setShowModelSelector(true)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "2px solid #b8905a",
            background: "white",
            color: "#111827",
            fontWeight: "700",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Select Model
        </button>
        {appt?.treatment_model && (
          <div style={{ marginTop: "12px", padding: "12px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>Selected Model</p>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>
                {MODEL_OPTIONS.find(m => m.value === appt.treatment_model)?.label}
              </p>
            </div>
            <button
              onClick={clearModel}
              style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "12px", cursor: "pointer", flexShrink: 0 }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Model Selection Modal */}
      {showModelSelector && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "white",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "500px",
            width: "90%",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
          }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: "700", color: "#111827" }}>Select Treatment Model</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              {MODEL_OPTIONS.map((model) => (
                <button
                  key={model.value}
                  onClick={() => setSelectedModelForApply(model)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: selectedModelForApply?.value === model.value ? "2px solid #111827" : "1px solid #d1d5db",
                    background: selectedModelForApply?.value === model.value ? "#f0f0f0" : "white",
                    color: "#111827",
                    fontWeight: selectedModelForApply?.value === model.value ? "700" : "600",
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {model.label}
                  <span style={{ display: "block", fontSize: "11px", fontWeight: "600", marginTop: "2px", color: selectedModelForApply?.value === model.value ? "#111827" : "#6b7280" }}>
                    {inr(model.fullAmount)}
                  </span>
                </button>
              ))}
            </div>

            {selectedModelForApply && (
              <div style={{ padding: "12px", background: "#ede9fe", borderRadius: "8px", marginBottom: "16px" }}>
                <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "700", color: "#6d28d9", textTransform: "uppercase" }}>Selected</p>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#4c1d95" }}>{selectedModelForApply.label}</p>
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#4c1d95" }}>
                  Full Amount: <strong>{inr(selectedModelForApply.fullAmount)}</strong> · Down Payment: <strong>{inr(DOWN_PAYMENT_FIXED)}</strong>
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setShowModelSelector(false);
                  setSelectedModelForApply(null);
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  background: "white",
                  color: "#111827",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={applyModel}
                disabled={!selectedModelForApply || applyingModel}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "none",
                  background: selectedModelForApply && !applyingModel ? "#111827" : "#d1d5db",
                  color: "white",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: selectedModelForApply && !applyingModel ? "pointer" : "not-allowed",
                  opacity: applyingModel ? 0.6 : 1,
                }}
              >
                {applyingModel ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card 2 — Payment Summary & Report */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", flexWrap: "wrap", gap: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", color: "#111827" }}>Payment Summary</h3>
          {isLocked && (
            <span style={{ fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "99px", background: "#dcfce7", color: "#16a34a", letterSpacing: "0.5px" }}>PUSHED ✓</span>
          )}
        </div>
        <p style={{ margin: "0 0 20px", fontSize: "12px", color: "#9ca3af" }}>
          Pushing this updates the patient's journey page directly — use it to make or receive a payment for the
          customer and generate the same report they see, especially if their own self-serve payment didn't reflect.
        </p>

        {isLocked ? (
          <>
            <div style={{ marginBottom: "20px" }}>
              <PaymentSummaryRow label="Plan" value={plan || "—"} />
              <PaymentSummaryRow label="Down Payment" value={inr(downPayment)} />
              <PaymentSummaryRow label="Full Payment" value={inr(fullAmount)} />
              {couponAmt > 0 && <PaymentSummaryRow label="Coupon" value={`− ${inr(coupon)}`} />}
              <PaymentSummaryRow label="Final Amount" value={inr(finalAmt)} />
              <PaymentSummaryRow label="Paid" value={inr(paidAmount)} />
              <PaymentSummaryRow label="Pending" value={inr(pendingAmt)} />
              <PaymentSummaryRow label="Mode" value={mode || "—"} />
            </div>
            <button style={btnGold} onClick={() => setIsLocked(false)}>Edit</button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: "16px" }}>
              <span style={label}>PLAN</span>
              <Clearable show={!!plan} onClear={() => setPlan("")}>
                <select style={select} value={plan} onChange={(e) => setPlan(e.target.value)}>
                  <option value="">— Select —</option>
                  {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Clearable>
            </div>

            <div style={row}>
              <div>
                <span style={label}>DOWN PAYMENT (₹)</span>
                <input style={input} type="number" placeholder="0" value={downPayment}
                  onChange={(e) => setDownPayment(e.target.value)} />
              </div>
              <div>
                <span style={label}>FULL PAYMENT (₹)</span>
                <input style={input} type="number" placeholder="0" value={fullAmount}
                  onChange={(e) => setFullAmount(e.target.value)} />
              </div>
            </div>
            <div style={row}>
              <div>
                <span style={label}>COUPON (₹)</span>
                <input style={input} type="number" placeholder="0" value={coupon}
                  onChange={(e) => setCoupon(e.target.value)} />
              </div>
              <div>
                <span style={label}>FINAL AMOUNT (₹) — auto-calculated</span>
                <input style={readonlyInput} type="text" readOnly value={`₹ ${finalAmt.toLocaleString("en-IN")}`} />
              </div>
            </div>
            <div style={row}>
              <div>
                <span style={label}>PAID (₹)</span>
                <input style={input} type="number" placeholder="0" value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)} />
              </div>
              <div>
                <span style={label}>PENDING (₹) — auto-calculated</span>
                <input style={readonlyInput} type="text" readOnly value={`₹ ${pendingAmt.toLocaleString("en-IN")}`} />
              </div>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <span style={label}>MODE</span>
              <Clearable show={!!mode} onClear={() => setMode("")}>
                <select style={select} value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="">— Select —</option>
                  {PAYMENT_METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Clearable>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                style={pushing ? { ...btnGold, opacity: 0.6 } : btnGold}
                onClick={pushReport}
                disabled={pushing}
              >
                {pushing ? "Pushing..." : "Push to Patient"}
              </button>
              {!!(appt?.payment_data?.full_amount) && (
                <button
                  onClick={() => setIsLocked(true)}
                  style={{ padding: "10px 22px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Card 3 — Pending Payment (only while a balance is left to collect) */}
      {pendingAmt > 0 && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#111827" }}>Pending Payment</h3>
            {isPendingLocked && (
              <span style={{ fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "99px", background: "#dcfce7", color: "#16a34a", letterSpacing: "0.5px" }}>SET ✓</span>
            )}
          </div>
          <p style={{ margin: "0 0 20px", fontSize: "12px", color: "#9ca3af" }}>
            {inr(pendingAmt)} is still pending. Choose how it'll be collected — pick NACH or E-Mandate to set up a
            recurring schedule with a Paid option for each installment.
          </p>

          {isPendingLocked ? (
            <>
              <div style={{ marginBottom: "16px" }}>
                <PaymentSummaryRow label="Mode" value={pendingMode} />
                {isRecurringMode && (
                  <>
                    <PaymentSummaryRow label="Amount per Installment" value={inr(pendingPlanAmount)} />
                    <PaymentSummaryRow label="Tenure" value={`${pendingTenure} installments`} />
                    <PaymentSummaryRow label="Recurring Date" value={formatDate(pendingRecurringDate)} last={!pendingInstallments.length} />
                  </>
                )}
              </div>

              {pendingInstallments.length > 0 && (
                <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {pendingInstallments.map((inst) => (
                    <div key={inst.num} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: inst.paid ? "#f0fdf4" : "#f8f7f5", borderRadius: "8px", border: inst.paid ? "1px solid #bbf7d0" : "1px solid transparent" }}>
                      <div>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>Installment {inst.num}</span>
                        <span style={{ marginLeft: "8px", fontSize: "13px", color: "#6b7280" }}>{inr(inst.amount)} · {formatDate(inst.date)}</span>
                      </div>
                      {inst.paid ? (
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>Paid ✓{inst.paid_date ? ` on ${formatDate(inst.paid_date)}` : ""}</span>
                      ) : (
                        <button
                          onClick={() => markInstallmentPaid(inst.num)}
                          disabled={markingInstallmentPaid === inst.num}
                          style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: markingInstallmentPaid === inst.num ? "#d4a574" : "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: markingInstallmentPaid === inst.num ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                        >
                          {markingInstallmentPaid === inst.num ? "Saving..." : "Mark Paid"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button style={btnGold} onClick={() => setIsPendingLocked(false)}>Edit</button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: "16px" }}>
                <span style={label}>MODE</span>
                <Clearable show={!!pendingMode} onClear={() => setPendingMode("")}>
                  <select style={select} value={pendingMode} onChange={(e) => setPendingMode(e.target.value)}>
                    <option value="">— Select —</option>
                    {PAYMENT_METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Clearable>
              </div>

              {isRecurringMode && (
                <>
                  <div style={row}>
                    <div>
                      <span style={label}>AMOUNT PER INSTALLMENT (₹)</span>
                      <input style={input} type="number" placeholder="0" value={pendingPlanAmount}
                        onChange={(e) => setPendingPlanAmount(e.target.value)} />
                    </div>
                    <div>
                      <span style={label}>TENURE (NUMBER OF INSTALLMENTS)</span>
                      <input style={input} type="number" min="1" placeholder="e.g. 5" value={pendingTenure}
                        onChange={(e) => setPendingTenure(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginBottom: "20px" }}>
                    <span style={label}>RECURRING DATE (FIRST INSTALLMENT)</span>
                    <input style={input} type="date" value={pendingRecurringDate}
                      onChange={(e) => setPendingRecurringDate(e.target.value)} />
                  </div>
                  {parseFloat(pendingPlanAmount) > 0 && parseInt(pendingTenure) > 0 && pendingRecurringDate && (
                    <div style={{ padding: "10px 12px", marginBottom: "20px", background: "#f8f7f5", borderRadius: "8px", fontSize: "12px", color: "#6b7280" }}>
                      This will create {parseInt(pendingTenure)} installments of {inr(pendingPlanAmount)}, starting {formatDate(pendingRecurringDate)} and recurring monthly.
                    </div>
                  )}
                </>
              )}

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  style={generatingPending ? { ...btnGold, opacity: 0.6 } : btnGold}
                  onClick={savePendingSetup}
                  disabled={generatingPending}
                >
                  {generatingPending ? "Saving..." : isRecurringMode ? "Generate Schedule" : "Save"}
                </button>
                {!!(appt?.payment_data?.pending_plan?.mode) && (
                  <button
                    onClick={() => setIsPendingLocked(true)}
                    style={{ padding: "10px 22px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Manufacturing & Logistics Tab (merged) ───────────────────────────────────
function ManufacturingTab({ appointmentId, initialData, logisticsData, actor }) {
  const [batches, setBatches] = useState(() => {
    const mfg = initialData?.batches || [];
    const log = logisticsData?.batches || [];
    return mfg.map((b) => {
      const l = log.find((x) => x.num === b.num) || {};
      return {
        num: b.num, start: b.start ?? "", end: b.end ?? "",
        mfg_started: b.mfg_started || "", mfg_done: b.mfg_done || "",
        shipment_link: b.shipment_link || l.shipment_link || "",
        shipment_id: l.shipment_id || "",
        delivery_partner: l.delivery_partner || "",
        delivery_partner_other: l.delivery_partner_other || "",
        aligner_received: l.aligner_received || "",
      };
    });
  });
  const [alignerDelivered, setAlignerDelivered] = useState(initialData?.aligner_delivered || "");
  const [saving, setSaving] = useState(null);
  const [savedBatch, setSavedBatch] = useState(null);

  const addBatch = () => {
    const nextNum = batches.length > 0 ? Math.max(...batches.map((b) => b.num)) + 1 : 1;
    setBatches((prev) => [...prev, {
      num: nextNum, start: "", end: "", mfg_started: "", mfg_done: "", shipment_link: "",
      shipment_id: "", delivery_partner: "", delivery_partner_other: "", aligner_received: "",
    }]);
  };

  const updateBatch = (num, key, val) => {
    setBatches((prev) => prev.map((b) => b.num === num ? { ...b, [key]: val } : b));
  };

  // Persists the given batches (manufacturing + logistics fields together),
  // re-derives journey steps from them, and notifies the patient for any
  // step that just turned on. Returns whether it succeeded.
  const persistBatches = async (updatedBatches, auditAction) => {
    const mfgPayload = {
      batches: updatedBatches.map(({ num, start, end, mfg_started, mfg_done, shipment_link }) => ({ num, start, end, mfg_started, mfg_done, shipment_link })),
      aligner_delivered: alignerDelivered,
    };
    const logPayload = {
      batches: updatedBatches.map(({ num, aligner_received, delivery_partner, delivery_partner_other, shipment_id, shipment_link }) => ({ num, aligner_received, delivery_partner, delivery_partner_other, shipment_id, shipment_link })),
    };

    const { data: cur } = await supabase.from("appointments_booking").select("journey_steps, email").eq("id", appointmentId).single();
    const js = cur?.journey_steps || {};
    const started = updatedBatches.some((b) => b.mfg_started);
    const completed = updatedBatches.length > 0 && updatedBatches.every((b) => b.mfg_done);
    const dispatched = updatedBatches.some((b) => b.shipment_link);
    const startDates = updatedBatches.map((b) => b.mfg_started).filter(Boolean).sort();
    const doneDates = updatedBatches.map((b) => b.mfg_done).filter(Boolean).sort();
    const newJs = {
      ...js,
      manufacturing_started: started,
      manufacturing_completed: completed,
      aligners_dispatched: dispatched,
      manufacturing_started_at: startDates[0] || null,
      manufacturing_completed_at: doneDates[doneDates.length - 1] || null,
    };

    const { error } = await supabase
      .from("appointments_booking")
      .update({ manufacturing_data: mfgPayload, logistics_data: logPayload, journey_steps: newJs })
      .eq("id", appointmentId);
    if (error) { alert("Error saving: " + error.message); return false; }

    logAudit({ appointmentId, actor, action: auditAction, entity: "manufacturing_data", newData: mfgPayload });
    [["manufacturing_started", started], ["manufacturing_completed", completed], ["aligners_dispatched", dispatched]].forEach(([key, val]) => {
      if (val && !js[key]) {
        fetch("/api/notify-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId, stepKey: key, email: cur?.email || null }),
        }).catch(() => {});
      }
    });
    return true;
  };

  const markStarted = async (num) => {
    const batch = batches.find((b) => b.num === num);
    if (batch.start === "" || batch.end === "") { alert("Enter the aligner set range for this batch first."); return; }
    setSaving(`${num}-started`);
    const updated = batches.map((b) => b.num === num ? { ...b, mfg_started: new Date().toISOString().slice(0, 10) } : b);
    const ok = await persistBatches(updated, `Manufacturing Started — Batch ${num}`);
    setSaving(null);
    if (ok) setBatches(updated);
  };

  const markEnded = async (num) => {
    setSaving(`${num}-ended`);
    const updated = batches.map((b) => b.num === num ? { ...b, mfg_done: new Date().toISOString().slice(0, 10) } : b);
    const ok = await persistBatches(updated, `Manufacturing Ended — Batch ${num}`);
    setSaving(null);
    if (ok) setBatches(updated);
  };

  // Saving the tracking link is what actually tells the patient their
  // aligners shipped — if manufacturing was never explicitly marked ended,
  // a saved link implies it's done too.
  const saveTrackingAndLogistics = async (num) => {
    setSaving(`${num}-tracking`);
    const today = new Date().toISOString().slice(0, 10);
    const updated = batches.map((b) => b.num === num
      ? { ...b, mfg_done: b.shipment_link ? (b.mfg_done || today) : b.mfg_done }
      : b
    );
    const ok = await persistBatches(updated, `Tracking Link & Logistics Saved — Batch ${num}`);
    setSaving(null);
    if (ok) { setBatches(updated); setSavedBatch(num); setTimeout(() => setSavedBatch(null), 3000); }
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

          <div style={{ marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {batch.mfg_started ? (
              <span style={infoPill}>✓ Manufacturing Started — {batch.mfg_started}</span>
            ) : (
              <button
                style={saving === `${batch.num}-started` ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                onClick={() => markStarted(batch.num)}
                disabled={saving === `${batch.num}-started`}
              >
                {saving === `${batch.num}-started` ? "Saving..." : "Manufacturing Started"}
              </button>
            )}
            {batch.mfg_done ? (
              <span style={infoPill}>✓ Manufacturing Ended — {batch.mfg_done}</span>
            ) : (
              <button
                style={saving === `${batch.num}-ended` ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                onClick={() => markEnded(batch.num)}
                disabled={saving === `${batch.num}-ended`}
              >
                {saving === `${batch.num}-ended` ? "Saving..." : "Manufacturing Ended"}
              </button>
            )}
          </div>

          <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Logistics</p>
          <div style={row}>
            <div>
              <span style={label}>ALIGNER RECEIVED BY PATIENT</span>
              <input style={input} type="date" value={batch.aligner_received}
                onChange={(e) => updateBatch(batch.num, "aligner_received", e.target.value)} />
            </div>
            <div>
              <span style={label}>DELIVERY PARTNER</span>
              <Clearable show={!!batch.delivery_partner} onClear={() => updateBatch(batch.num, "delivery_partner", "")}>
                <select style={select} value={batch.delivery_partner}
                  onChange={(e) => updateBatch(batch.num, "delivery_partner", e.target.value)}>
                  <option value="">Select...</option>
                  {DELIVERY_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Clearable>
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
              Saving a tracking link activates &quot;Aligners Dispatched&quot; (and &quot;Manufacturing Ended&quot;
              too, if it wasn't already) — the patient gets a Track Shipment button that opens this link directly.
            </p>
          </div>
          <button
            style={saving === `${batch.num}-tracking` ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
            onClick={() => saveTrackingAndLogistics(batch.num)}
            disabled={saving === `${batch.num}-tracking`}
          >
            {saving === `${batch.num}-tracking` ? "Saving..." : savedBatch === batch.num ? "Saved ✓" : "Save Tracking & Logistics"}
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
              onClick={async () => {
                setSaving("delivered");
                const ok = await persistBatches(batches, "Aligner Delivery Date Saved");
                setSaving(null);
                if (ok) { setSavedBatch("delivered"); setTimeout(() => setSavedBatch(null), 3000); }
              }}
              disabled={saving === "delivered"}
            >
              {saving === "delivered" ? "Saving..." : savedBatch === "delivered" ? "Saved ✓" : "Save"}
            </button>
            <button
              onClick={async () => {
                if (!window.confirm("Clear ALL manufacturing and logistics data, including all batches?")) return;
                setBatches([]); setAlignerDelivered("");
                await supabase.from("appointments_booking").update({ manufacturing_data: {}, logistics_data: {} }).eq("id", appointmentId);
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

// ─── Derive steps ─────────────────────────────────────────────────────────────
function deriveSteps(appt) {
  if (!appt) return {};
  const js = appt.journey_steps || {};
  return {
    booked:                  true,
    confirmed:               appt.status === "confirmed" || appt.status === "completed",
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

// ─── Default step messages ────────────────────────────────────────────────────
const DEFAULT_STEP_MESSAGES = {
  confirmed:               { subject: "Your Appointment is Confirmed — OrisAlign", body: "Great news! Your appointment with OrisAlign has been confirmed. Our dentist will be in touch with you very soon to guide you through what to expect. Please carry any previous dental records if you have them." },
  scanning_done:           { subject: "Scanning & Planning Complete — OrisAlign", body: "Your scanning session and initial planning have been completed successfully. Our orthodontic team is now working on your personalised treatment proposal. We’ll notify you as soon as your plan is ready." },
  payment_done:            { subject: "Payment Confirmed — OrisAlign", body: "Your payment details have been finalised. Thank you for your trust in OrisAlign. Our team will now proceed with your treatment planning and keep you updated at every step." },
  planning_done:           { subject: "Your Treatment Plan is Ready — OrisAlign", body: "Your personalised 3D treatment plan has been prepared by our orthodontic team! Please visit your journey page to review it. Once you’re satisfied, click the Approve Plan button to authorise us to begin fabricating your aligners." },
  plan_approved:           { subject: "Plan Approved — Manufacturing Begins Soon — OrisAlign", body: "Your treatment plan has been approved. Thank you for authorising OrisAlign to begin fabrication of your custom aligners. Our manufacturing team will start work on your aligners shortly. This process typically takes a few weeks — we’ll keep you posted." },
  manufacturing_started:   { subject: "Your Aligners Are Being Made — OrisAlign", body: "Exciting news — manufacturing of your custom aligners has officially begun! Each set is precisely crafted to move your teeth gently and accurately according to your treatment plan. We’ll notify you as soon as they’re ready." },
  manufacturing_completed: { subject: "Your Aligners Are Ready — OrisAlign", body: "Your custom aligners have been manufactured and quality-checked. They are now being prepared for dispatch to you. You’ll receive a tracking update very soon. Get ready to start your smile journey!" },
  aligners_dispatched:     { subject: "Your Aligners Are On Their Way — OrisAlign", body: "Your aligners are on the move! They have been handed over to our delivery partner and are heading your way. Please ensure someone is available to receive the package. You can track your shipment using the details on your journey page." },
  aligners_received:       { subject: "Aligners Received by Delivery Partner — OrisAlign", body: "Your aligners have been received by our local delivery partner and are on the final leg of their journey to you. Expect delivery very soon. Please have your ID ready if required at the time of delivery." },
  followup_appointment:    { subject: "Follow-Up Appointment Scheduled — OrisAlign", body: "Your follow-up appointment has been scheduled with OrisAlign. This visit is an important part of your treatment — our team will review your progress, make any necessary adjustments, and ensure everything is on track for your smile transformation." },
  aligners_delivered:      { subject: "Aligners Delivered — Start Your Smile Correction — OrisAlign", body: "Your aligners have arrived! Please begin wearing them as instructed by your orthodontist. Consistent wear (20–22 hours per day) is the key to the best results. If you have any questions, reach out to our team — we’re always here to help." },
  smile_correction:        { subject: "Smile Correction Phase Started — OrisAlign", body: "Your Smile Correction phase has officially started! You’re now actively on your journey to a more confident smile. Wear your aligners consistently and follow the schedule provided. We’ll be with you every step of the way." },
  treatment_completed:     { subject: "Treatment Complete — Congratulations from OrisAlign!", body: "Congratulations — your OrisAlign treatment is complete! Your smile has been transformed through precision, care, and your own commitment. We are incredibly proud to have been part of your journey. Share your smile with the world — you’ve earned it!" },
  feedback_submitted:      { subject: "Thank You for Your Feedback — OrisAlign", body: "Thank you so much for taking the time to share your experience with us. Your feedback helps us improve and inspire others. Your ₹5,000 hamper will be sent to you shortly as a token of our appreciation. Thank you for choosing OrisAlign and trusting us with your smile." },
};

// ─── Journey Tab (admin only) ─────────────────────────────────────────────────
function JourneyTab({ appointmentId, appt, isAdmin, actor }) {
  const [steps, setSteps] = useState(() => deriveSteps(appt));
  const [saving, setSaving] = useState(null);
  const [stepMessages, setStepMessages] = useState(() => JSON.parse(JSON.stringify(DEFAULT_STEP_MESSAGES)));
  const [openEmail, setOpenEmail] = useState({}); // which steps have their email editor expanded

  // Prefill each step's editable message from the saved Message Templates so
  // what gets sent here always reflects the latest admin-edited template.
  useEffect(() => {
    fetch("/api/message-templates")
      .then((r) => r.json())
      .then((j) => {
        const rows = j.templates || [];
        if (!rows.length) return;
        setStepMessages((prev) => {
          const next = { ...prev };
          rows.forEach((t) => {
            if (t.subject_line && t.email_body) {
              next[t.step_key] = { subject: t.subject_line, body: t.email_body };
            }
          });
          return next;
        });
      })
      .catch(() => {});
  }, []);

  // Part A — Scanning & Provisional Planning video
  const [scanningVideoUrl, setScanningVideoUrl] = useState(appt.scanning_video_url || "");
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Part A2 — Scanning & Provisional Planning: pre-treatment scanning review link
  const [scanningReviewLink, setScanningReviewLink] = useState(appt.scanning_review_link || "");
  const [savingScanningLink, setSavingScanningLink] = useState(false);
  const [scanningLinkSaved, setScanningLinkSaved] = useState(false);

  // Part C — Planning Done: review link
  const [reviewLink, setReviewLink] = useState(appt.review_link || "");
  const [savingLink, setSavingLink] = useState(false);
  const [linkSaved, setLinkSaved] = useState(false);

  // Part C0 — Planning Done: aligner set plan
  const [alignerTotalSets, setAlignerTotalSets] = useState(appt.aligner_total_sets ? String(appt.aligner_total_sets) : "");
  const [alignerDaysPerSet, setAlignerDaysPerSet] = useState(appt.aligner_days_per_set || null);
  const [savingAligner, setSavingAligner] = useState(false);
  const [alignerSaved, setAlignerSaved] = useState(false);

  // Smile Correction setup — number of sets, start date, days/set (admin-controlled)
  const [smileSets, setSmileSets] = useState(appt.journey_steps?.smile_sets_count ? String(appt.journey_steps.smile_sets_count) : "");
  const [smileStart, setSmileStart] = useState(appt.journey_steps?.smile_start_date || "");
  const [smileDays, setSmileDays] = useState(String(appt.journey_steps?.smile_days_per_set || appt.aligner_days_per_set || 15));
  const [savingSmile, setSavingSmile] = useState(false);
  const [smileSaved, setSmileSaved] = useState(false);

  const saveSmileSetup = async () => {
    const sets = parseInt(smileSets, 10);
    if (!sets || sets < 1) { alert("Enter the number of aligner sets."); return; }
    if (!smileStart) { alert("Enter the start date."); return; }
    setSavingSmile(true);
    const js = appt.journey_steps || {};
    const newJs = { ...js, smile_sets_count: sets, smile_start_date: smileStart, smile_days_per_set: parseInt(smileDays, 10) || 15 };
    const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJs }).eq("id", appointmentId);
    setSavingSmile(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    appt.journey_steps = newJs;
    logAudit({ appointmentId, actor, action: "Smile Correction Program Set", entity: "smile_correction", newData: { smile_sets_count: sets, smile_start_date: smileStart, smile_days_per_set: parseInt(smileDays, 10) || 15 } });
    setSmileSaved(true);
    setTimeout(() => setSmileSaved(false), 3000);
  };

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
    if (key === "plan_approved") return; // patient-only — cannot be controlled from backend
    const currentVal = !!steps[key];
    const newVal = !currentVal;
    const updated = { ...steps, [key]: newVal };
    setSteps(updated);
    setSaving(key);
    const js = appt.journey_steps || {};
    const newJs = { ...js, [key]: newVal };
    const updatePayload = { journey_steps: newJs };
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
    if (newVal && stepMessages[key]) {
      fetch("/api/notify-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          stepKey: key,
          email: appt.email || null,
          customSubject: stepMessages[key].subject,
          customBody: stepMessages[key].body,
        }),
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
                {isAdmin && step.key !== "plan_approved" && step.key !== "booked" && step.key !== "confirmed" && step.key !== "payment_done" && (
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
                {(step.key === "booked" || step.key === "confirmed" || step.key === "payment_done") && (
                  <span style={{
                    padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", flexShrink: 0,
                    background: done ? "#dcfce7" : "#f3f4f6",
                    color: done ? "#16a34a" : "#9ca3af",
                    letterSpacing: "0.5px",
                  }}>
                    {done ? "AUTOMATIC ✓" : "PENDING"}
                  </span>
                )}
                {step.key === "plan_approved" && (
                  <span style={{
                    padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", flexShrink: 0,
                    background: done ? "#dcfce7" : steps.planning_done ? "#fef3c7" : "#f3f4f6",
                    color: done ? "#16a34a" : steps.planning_done ? "#92400e" : "#9ca3af",
                    letterSpacing: "0.5px",
                  }}>
                    {done ? "APPROVED BY PATIENT" : steps.planning_done ? "AWAITING PATIENT" : "LOCKED"}
                  </span>
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
                        onClick={() => setAlignerDaysPerSet(alignerDaysPerSet === d ? null : d)}
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

              {/* Smile Correction — admin sets number of sets, start date & days/set */}
              {isAdmin && step.key === "smile_correction" && (
                <div style={subBox}>
                  <span style={label}>NUMBER OF ALIGNER SETS</span>
                  <input
                    style={input}
                    type="number"
                    min="1"
                    placeholder="e.g. 10"
                    value={smileSets}
                    onChange={(e) => setSmileSets(e.target.value.replace(/\D/g, ""))}
                  />
                  <span style={label}>START DATE</span>
                  <input
                    style={input}
                    type="date"
                    value={smileStart}
                    onChange={(e) => setSmileStart(e.target.value)}
                  />
                  <span style={label}>DAYS PER SET</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[10, 15].map((d) => (
                      <button
                        key={d}
                        onClick={() => setSmileDays(String(smileDays) === String(d) ? "" : String(d))}
                        style={{
                          flex: 1, padding: "10px", borderRadius: "8px",
                          border: String(d) === String(smileDays) ? "2px solid #b8905a" : "1px solid #e5e7eb",
                          background: String(d) === String(smileDays) ? "#fff7ed" : "white",
                          color: String(d) === String(smileDays) ? "#b8905a" : "#374151",
                          fontWeight: "700", fontSize: "13px", cursor: "pointer",
                        }}
                      >
                        {d} Days
                      </button>
                    ))}
                  </div>
                  {parseInt(smileSets, 10) > 0 && smileStart && (
                    <p style={{ margin: 0, fontSize: "13px", color: "#16a34a", fontWeight: "700" }}>
                      {parseInt(smileSets, 10)} sets · changes every {smileDays} days · ~{Math.round((parseInt(smileSets, 10) * (parseInt(smileDays, 10) || 15)) / 30)} months total
                    </p>
                  )}
                  <button
                    style={savingSmile ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                    onClick={saveSmileSetup}
                    disabled={savingSmile}
                  >
                    {savingSmile ? "Saving..." : smileSaved ? "Saved ✓" : "Save Aligner Program"}
                  </button>
                  <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>
                    Sets the patient&apos;s set-by-set schedule and changing dates. Mark this step done so the patient can open their Smile Correction page and upload photos.
                  </p>
                </div>
              )}

              {/* Email message — collapsed behind a button; expands to edit */}
              {isAdmin && !done && stepMessages[step.key] && step.key !== "plan_approved" && (
                <div style={{ marginTop: "8px" }}>
                  <button
                    onClick={() => setOpenEmail((prev) => ({ ...prev, [step.key]: !prev[step.key] }))}
                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #dbeafe", background: "#f0f7ff", color: "#1e40af", fontWeight: "700", fontSize: "12px", cursor: "pointer", letterSpacing: "0.3px" }}
                  >
                    ✉ Email to patient (sent on Mark Done) <span style={{ marginLeft: "auto" }}>{openEmail[step.key] ? "▲" : "▼"}</span>
                  </button>
                  {openEmail[step.key] && (
                    <div style={{ ...subBox, border: "1px solid #dbeafe", background: "#f0f7ff", marginTop: "6px" }}>
                      <input
                        style={input}
                        type="text"
                        placeholder="Subject"
                        value={stepMessages[step.key].subject}
                        onChange={(e) => setStepMessages((prev) => ({ ...prev, [step.key]: { ...prev[step.key], subject: e.target.value } }))}
                      />
                      <textarea
                        style={{ ...input, minHeight: "90px", fontFamily: "inherit", resize: "vertical" }}
                        value={stepMessages[step.key].body}
                        onChange={(e) => setStepMessages((prev) => ({ ...prev, [step.key]: { ...prev[step.key], body: e.target.value } }))}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pillStyle(bg, color) {
  return {
    display: "inline-block", padding: "3px 10px", borderRadius: "99px",
    background: bg, color, fontSize: "11px", fontWeight: "700",
    letterSpacing: "0.5px", whiteSpace: "nowrap",
  };
}


// ─── Report Tab ───────────────────────────────────────────────────────────────
function ReportTab({ appointmentId, appt }) {
  const [logs, setLogs] = useState([]);
  const [staffMap, setStaffMap] = useState({});

  useEffect(() => {
    fetch(`/api/audit-log?appointmentId=${appointmentId}`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .catch(() => {});

    const uuids = [appt.assigned_dentist, appt.assigned_ortho].filter(Boolean);
    if (uuids.length > 0) {
      supabase.from("users").select("id, email, full_name, role").in("id", uuids)
        .then(({ data }) => {
          if (data) {
            const m = {};
            data.forEach((u) => { m[u.id] = u; });
            setStaffMap(m);
          }
        });
    }
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
  const manufacturingData = appt.manufacturing_data || {};
  const manufacturingBatches = manufacturingData.batches || [];
  const logisticsBatches = appt.logistics_data?.batches || [];

  const fmt = (iso) => {
    if (!iso) return null;
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" });
  };
  const fmtDate = (iso) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" });
  };

  const findDoneLog = (label) => logs.find((l) => l.action === `Step Marked Done: ${label}`);
  const staffLabel = (uuid) => {
    if (!uuid) return null;
    const u = staffMap[uuid];
    if (!u) return null;
    return u.full_name ? `${u.full_name} (${u.email})` : u.email;
  };

  // Build chronological events
  const events = [];

  // 1. Booking
  events.push({
    done: true,
    title: "Appointment Booked",
    by: "patient (self-registered)",
    at: appt.created_at,
    detail: [
      appt.date && appt.time ? `Appointment requested for ${appt.date} at ${appt.time}.` : null,
      appt.doctor ? `Preferred doctor: ${appt.doctor}.` : null,
      appt.chief_complaint ? `Chief complaint: "${appt.chief_complaint}".` : null,
      appt.problem ? `Additional notes: "${appt.problem}".` : null,
    ].filter(Boolean),
  });

  // 2. Staff assignment
  const dentist = staffLabel(appt.assigned_dentist);
  const ortho = staffLabel(appt.assigned_ortho);
  if (dentist || ortho || appt.assigned_at) {
    const parts = [];
    if (dentist) parts.push(`Treating dentist assigned: ${dentist}.`);
    if (ortho) parts.push(`Supervising orthodontist assigned: ${ortho}.`);
    events.push({
      done: !!(dentist || ortho),
      title: "Staff Assignment",
      by: "OrisAlign admin",
      at: appt.assigned_at || null,
      detail: parts,
    });
  }

  // 3. Confirmation
  const confirmLog = findDoneLog("Appointment Confirmed");
  events.push({
    done: !!steps.confirmed,
    title: "Appointment Confirmed",
    by: confirmLog?.actor_email ? `counsellor / admin (${confirmLog.actor_email})` : "OrisAlign team",
    at: confirmLog?.created_at || null,
    detail: [],
  });

  // 4. Appointment started / Scanning
  const scanLog = findDoneLog("Scanning and Provisional Planning");
  events.push({
    done: !!steps.scanning_done,
    title: "Scanning & Provisional Planning",
    by: scanLog?.actor_email ? `admin (${scanLog.actor_email})` : "OrisAlign team",
    at: appt.appointment_started_at || scanLog?.created_at || null,
    detail: [
      appt.appointment_started_at ? `Scanning session started at the clinic on ${fmt(appt.appointment_started_at)}.` : null,
      appt.scanning_video_url ? `Provisional planning video recorded and uploaded.` : null,
      appt.scanning_review_link ? `Pre-treatment scanning review link shared with patient.` : null,
    ].filter(Boolean),
  });

  // 5. Payment
  const payLog = findDoneLog("Plan and Payment");
  events.push({
    done: !!steps.payment_done,
    title: "Plan and Payment",
    by: payLog?.actor_email ? `counsellor / admin (${payLog.actor_email})` : "OrisAlign team",
    at: payLog?.created_at || null,
    detail: [
      fullAmt > 0 ? `Full treatment cost quoted at ${inr(pd.full_amount)}.` : null,
      disc > 0 ? `A discount of ${inr(pd.discount)} was applied.` : null,
      (pd.coupon_code || couponDisc > 0) ? `Coupon${pd.coupon_code ? ` "${pd.coupon_code}"` : ""} applied: ${inr(pd.coupon_discount)} off.` : null,
      finalAmt > 0 ? `Final payable amount after discounts: ${inr(finalAmt)}.` : null,
      pd.down_payment > 0 ? `Down payment of ${inr(pd.down_payment)} collected via ${pd.down_payment_mode}${pd.down_payment_mode === "Finance" ? ` (${pd.finance_provider})` : ""}.` : null,
      pendingAmt > 0 ? `Pending balance of ${inr(pendingAmt)} to be paid via ${pd.pending_mode}${pd.pending_mode === "Finance" ? ` (${pd.finance_provider})` : ""}.` : null,
      ...((pd.pending_mode === "Installment" && pd.installment_plan?.installments?.length > 0)
        ? pd.installment_plan.installments.map((inst) =>
            `  • Instalment ${inst.num}: ${inr(inst.amount)} — ${inst.paid ? `paid${inst.paid_date ? ` on ${inst.paid_date}` : ""}` : "pending"}.`
          )
        : []),
    ].filter(Boolean),
  });

  // 6. Planning done
  const planLog = findDoneLog("Planning Done");
  events.push({
    done: !!steps.planning_done,
    title: "Treatment Planning Done",
    by: planLog?.actor_email ? `admin / orthodontist (${planLog.actor_email})` : "OrisAlign team",
    at: planLog?.created_at || null,
    detail: [
      appt.aligner_total_sets ? `Treatment plan consists of ${appt.aligner_total_sets} aligner set${appt.aligner_total_sets !== 1 ? "s" : ""}${appt.aligner_days_per_set ? `, worn ${appt.aligner_days_per_set} days per set` : ""}.` : null,
      appt.aligner_total_sets && appt.aligner_days_per_set
        ? `Total estimated treatment duration: ${appt.aligner_total_sets * appt.aligner_days_per_set} days (approximately ${Math.round((appt.aligner_total_sets * appt.aligner_days_per_set) / 30)} months).`
        : null,
      appt.review_link ? `3D treatment plan review link shared with patient.` : null,
    ].filter(Boolean),
  });

  // 7. Plan approved
  const planApprovedAt = js.plan_approved_at || appt.plan_approved_at;
  events.push({
    done: !!steps.plan_approved,
    title: "Treatment Plan Approved",
    by: `patient (${appt.name || "patient"})`,
    at: planApprovedAt || null,
    detail: [
      planApprovedAt ? `${appt.name || "The patient"} reviewed the 3D treatment plan and gave legal authorisation for aligner fabrication.` : null,
      appt.plan_approval_ip ? `Approval verified via patient OTP from IP address ${appt.plan_approval_ip}.` : null,
    ].filter(Boolean),
  });

  // 8. Manufacturing started
  const mfgStartLog = findDoneLog("Manufacturing Started");
  events.push({
    done: !!steps.manufacturing_started,
    title: "Manufacturing Started",
    by: mfgStartLog?.actor_email ? `admin (${mfgStartLog.actor_email})` : "OrisAlign team",
    at: mfgStartLog?.created_at || null,
    detail: manufacturingBatches.length > 0
      ? manufacturingBatches.map((b) =>
          `Batch ${b.num} (Aligners ${b.start}–${b.end}): started ${b.mfg_started || "date not recorded"}${b.mfg_done ? `, completed ${b.mfg_done}` : ""}.`
        )
      : [],
  });

  // 9. Manufacturing completed
  const mfgDoneLog = findDoneLog("Manufacturing Completed");
  events.push({
    done: !!steps.manufacturing_completed,
    title: "Manufacturing Completed",
    by: mfgDoneLog?.actor_email ? `admin (${mfgDoneLog.actor_email})` : "OrisAlign team",
    at: mfgDoneLog?.created_at || null,
    detail: [
      manufacturingData.aligner_delivered ? `All aligners delivered to the OrisAlign clinic on ${manufacturingData.aligner_delivered}.` : null,
    ].filter(Boolean),
  });

  // 10. Aligners dispatched
  const dispatchLog = findDoneLog("Aligners Dispatched");
  events.push({
    done: !!steps.aligners_dispatched,
    title: "Aligners Dispatched to Patient",
    by: dispatchLog?.actor_email ? `admin (${dispatchLog.actor_email})` : "OrisAlign team",
    at: dispatchLog?.created_at || null,
    detail: logisticsBatches.length > 0
      ? logisticsBatches.map((b) => {
          const partner = b.delivery_partner === "Other" ? (b.delivery_partner_other || "courier") : b.delivery_partner;
          return `Batch ${b.num} dispatched via ${partner || "courier"}${b.shipment_id ? ` (Shipment ID: ${b.shipment_id})` : ""}${b.aligner_received ? `; received by patient on ${b.aligner_received}` : ""}.`;
        })
      : [],
  });

  // 11. Aligners received (by delivery partner)
  const rcvLog = findDoneLog("Appointment Book");
  events.push({
    done: !!steps.aligners_received,
    title: "Aligners Received by Local Delivery Partner",
    by: rcvLog?.actor_email ? `admin (${rcvLog.actor_email})` : "OrisAlign team",
    at: rcvLog?.created_at || null,
    detail: ["Aligners passed to the local delivery partner for last-mile delivery to the patient."],
  });

  // 12. Follow-up appointment
  const followLog = findDoneLog("Appointment Book");
  events.push({
    done: !!steps.followup_appointment,
    title: "Follow-Up Appointment Booked",
    by: followLog?.actor_email ? `admin (${followLog.actor_email})` : "OrisAlign team",
    at: followLog?.created_at || null,
    detail: ["A follow-up clinic appointment was scheduled for progress review and any required adjustments."],
  });

  // 13. Aligners delivered
  const delivLog = findDoneLog("Aligners Delivered");
  events.push({
    done: !!steps.aligners_delivered,
    title: "Aligners Delivered to Patient",
    by: delivLog?.actor_email ? `admin (${delivLog.actor_email})` : "OrisAlign team",
    at: delivLog?.created_at || null,
    detail: [`The aligner package was successfully delivered to ${appt.name || "the patient"} at their address.`],
  });

  // 14. Smile correction
  const smileLog = findDoneLog("Smile Correction Started");
  events.push({
    done: !!steps.smile_correction,
    title: "Smile Correction Phase Started",
    by: smileLog?.actor_email ? `admin (${smileLog.actor_email})` : "OrisAlign team",
    at: smileLog?.created_at || null,
    detail: [`${appt.name || "The patient"} began wearing their aligners. Active treatment is now in progress.`],
  });

  // 15. Treatment completed
  const completeLog = findDoneLog("Treatment Completed");
  events.push({
    done: !!steps.treatment_completed,
    title: "Treatment Completed",
    by: completeLog?.actor_email ? `admin (${completeLog.actor_email})` : "OrisAlign team",
    at: completeLog?.created_at || null,
    detail: [`The OrisAlign aligner treatment for ${appt.name || "the patient"} has been successfully completed.`],
  });

  // 16. Feedback
  const feedbackLog = findDoneLog("Feedback Submitted");
  events.push({
    done: !!steps.feedback_submitted,
    title: "Feedback Submitted",
    by: feedbackLog?.actor_email ? `admin (${feedbackLog.actor_email})` : "patient",
    at: feedbackLog?.created_at || null,
    detail: [`${appt.name || "The patient"} submitted their post-treatment feedback.`],
  });

  const doneCount = events.filter((e) => e.done).length;
  const generatedOn = new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" });

  return (
    <div>
      {/* Report header */}
      <div style={{ ...card, marginBottom: "20px", background: "linear-gradient(135deg, #1B2A4A, #0f2027)", color: "white", border: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px", color: "#C9A84C", textTransform: "uppercase" }}>Patient Journey Report</p>
            <h2 style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: "900", color: "white" }}>{appt.name || "Unknown Patient"}</h2>
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#94a3b8" }}>
              {[appt.age ? `Age ${appt.age}` : null, appt.sex, appt.phone, appt.email].filter(Boolean).join("  ·  ")}
            </p>
            {appt.address && <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#94a3b8" }}>{appt.address}</p>}
            {appt.occupation && <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#94a3b8" }}>Occupation: {appt.occupation}</p>}
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#64748b" }}>Patient ID: {appt.id?.substring(0, 8).toUpperCase()}  ·  Generated on {generatedOn} IST</p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ margin: "0 0 4px", fontSize: "28px", fontWeight: "900", color: "#C9A84C" }}>{doneCount}/{events.length}</p>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>milestones completed</p>
            <button
              onClick={() => window.print()}
              style={{ marginTop: "12px", padding: "8px 16px", borderRadius: "8px", border: "1px solid #C9A84C", background: "transparent", color: "#C9A84C", fontWeight: "700", fontSize: "12px", cursor: "pointer", letterSpacing: "0.5px" }}
            >
              Print Report
            </button>
          </div>
        </div>
      </div>

      {/* Narrative events */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {events.map((ev, idx) => (
          <div
            key={idx}
            style={{
              ...card,
              marginBottom: 0,
              borderLeft: `4px solid ${ev.done ? "#22c55e" : "#e5e7eb"}`,
              background: ev.done ? "white" : "#fafafa",
              opacity: ev.done ? 1 : 0.65,
            }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0, marginTop: "2px",
                background: ev.done ? "linear-gradient(135deg, #22c55e, #16a34a)" : "#e5e7eb",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: ev.done ? "white" : "#9ca3af", fontWeight: "800", fontSize: "12px",
              }}>
                {ev.done ? "✓" : idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: ev.done ? "#111827" : "#9ca3af" }}>
                    {idx + 1}. {ev.title}
                  </h4>
                  <span style={pillStyle(ev.done ? "#dcfce7" : "#f3f4f6", ev.done ? "#16a34a" : "#9ca3af")}>
                    {ev.done ? "COMPLETED" : "PENDING"}
                  </span>
                </div>

                {ev.done ? (
                  <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#374151", lineHeight: "1.7" }}>
                    {ev.at
                      ? <>This milestone was completed on <strong>{fmt(ev.at)}</strong> by <strong>{ev.by}</strong>.</>
                      : <>This milestone was completed by <strong>{ev.by}</strong> (exact timestamp not recorded).</>
                    }
                  </p>
                ) : (
                  <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>
                    Not yet reached.
                  </p>
                )}

                {ev.done && ev.detail.length > 0 && (
                  <ul style={{ margin: "0", paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {ev.detail.map((line, li) => (
                      <li key={li} style={{ fontSize: "13px", color: "#6b7280", lineHeight: "1.7" }}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Message Tab — send a free-form one-off email to this patient ──────────────
function MessageTab({ appointmentId, patientEmail, patientName, actor }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    try {
      const res = await fetch(`/api/message-history?appointmentId=${appointmentId}`);
      const json = await res.json();
      setHistory(json.messages || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadHistory(); }, [appointmentId]);

  const send = async () => {
    if (!patientEmail) { alert("This patient has no email address on record."); return; }
    if (!subject.trim() || !body.trim()) { alert("Please enter a subject and a message."); return; }
    setSending(true);
    try {
      const res = await fetch("/api/message-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          recipientEmail: patientEmail,
          subject,
          body,
          messageType: "email",
          actorEmail: actor?.email,
          actorRole: actor?.role,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { alert("Failed to send: " + (json.error || "Unknown error")); return; }
      setSent(true);
      setSubject(""); setBody("");
      setTimeout(() => setSent(false), 3000);
      loadHistory();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "11px 12px", borderRadius: "8px",
    border: "1px solid #e5e7eb", fontSize: "14px", outline: "none",
    boxSizing: "border-box", background: "white", color: "#111827",
  };

  return (
    <div>
      <div style={card}>
        <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#111827" }}>Send a Message</h3>
        <p style={{ margin: "0 0 18px", fontSize: "13px", color: "#6b7280" }}>
          Write a custom message and email it to{" "}
          <strong>{patientName || "this patient"}</strong>{patientEmail ? ` (${patientEmail})` : ""}.
          A &quot;Track Your Journey&quot; button is included automatically.
        </p>

        <div style={{ marginBottom: "14px" }}>
          <span style={label}>Subject</span>
          <input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. A quick update on your treatment" />
        </div>
        <div style={{ marginBottom: "18px" }}>
          <span style={label}>Message</span>
          <textarea
            style={{ ...inputStyle, minHeight: "140px", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message to the patient here..."
          />
        </div>
        <button
          onClick={send}
          disabled={sending || !patientEmail}
          style={{
            ...btnPrimary,
            background: sent ? "#16a34a" : "#111827",
            opacity: sending || !patientEmail ? 0.6 : 1,
            cursor: sending || !patientEmail ? "not-allowed" : "pointer",
          }}
        >
          {sending ? "Sending..." : sent ? "Sent ✓" : "Send Message"}
        </button>
        {!patientEmail && (
          <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#dc2626" }}>No email on record for this patient.</p>
        )}
      </div>

      {history.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: "0 0 14px", fontSize: "15px", color: "#111827" }}>Previously Sent</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {history.map((m) => (
              <div key={m.id} style={{ padding: "12px 14px", background: "#f8f7f5", borderRadius: "10px", border: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{m.subject}</span>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    {m.sent_at ? new Date(m.sent_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}
                    {m.delivery_status ? `  ·  ${m.delivery_status}` : ""}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#6b7280", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
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

      {/* Tab Pills — Manufacturing/Logistics only apply once the appointment is confirmed */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {TABS.filter((tab) => tab !== "Manufacturing" || appt.status === "confirmed" || appt.status === "completed").map((tab) => (
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
        <ManufacturingTab appointmentId={id} initialData={appt.manufacturing_data || null} logisticsData={appt.logistics_data || null} actor={actor} />
      </div>
      <div style={{ display: activeTab === "Message" ? "block" : "none" }}>
        <MessageTab appointmentId={id} patientEmail={appt.email} patientName={appt.name} actor={actor} />
      </div>
      <div style={{ display: activeTab === "Patient Page" ? "block" : "none" }}>
        <PatientPageTab appointmentId={id} />
      </div>
      <div style={{ display: activeTab === "Report" ? "block" : "none" }}>
        <ReportTab appointmentId={id} appt={appt} />
      </div>
    </div>
  );
}
