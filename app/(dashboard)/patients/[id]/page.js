"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import { logAudit } from "@/lib/logAudit";
import { PROVISIONAL_PLAN_FEE, estimateRangeForPlan, formatMonthsDays, applyCouponDiscount, monthSlotLabels, totalCost, recomputeCumulative, buildMonthlyPlan, PLAN_CONFIGS } from "@/lib/monthlyPlan";
import { INVESTIGATION_TYPES, isInvestigationDone } from "@/lib/investigations";

const supabase = getSupabaseClient();

const TABS = ["Payment", "Manufacturing", "Journey", "LMC", "Message", "Patient Page", "Report"];

const LMC_TREATMENT_TYPES = ["Aligners", "RCT", "Implant", "Extraction", "Restoration", "Scaling", "Polishing", "Checkup"];

// Legacy (lump-sum OrisPro/OrisPro Plus) list — unchanged, for any
// appointment still in progress without a monthly_plan.
const LEGACY_ALL_STEPS = [
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

// New per-arch, month-by-month model — the old "Plan and Payment"/"Full
// Plan"/"Final Plan Review" steps merge into one "Full Plan" step (pay ₹999,
// then review the aligner plan in the same step). Manufacturing/Dispatched/
// Received collapse into one manually-toggleable "Aligner Sets" step
// (per-month detail is managed in the Manufacturing tab's batches, same as
// before).
const NEW_ALL_STEPS = [
  { key: "booked",                  label: "Appointment Booked" },
  { key: "confirmed",               label: "Appointment Confirmed" },
  { key: "scanning_done",           label: "Scanning" },
  { key: "provisional_planning",    label: "Provisional Planning" },
  { key: "payment_done",            label: "Full Plan" },
  { key: "investigation_required",  label: "Investigation Required" },
  { key: "plan_approved",           label: "Plan Approved" },
  { key: "aligner_sets",            label: "Aligner Sets" },
  { key: "followup_appointment",    label: "Appointment Book" },
  { key: "aligners_delivered",      label: "Aligners Delivered" },
  { key: "smile_correction",        label: "Smile Correction Started" },
  { key: "treatment_completed",     label: "Treatment Completed" },
  { key: "feedback_submitted",      label: "Feedback Submitted" },
];
const DELIVERY_PARTNERS = ["BlueDart", "Delhivery", "Other"];
// Plan determines the per-set price and the default down payment — total
// amount is just sets × price, no separate treatment-model selector anymore.
const PLAN_OPTIONS = [
  { value: "ORISPRO", label: "OrisPro", pricePerSet: 3499, downPayment: 12499 },
  { value: "ORISPLUS", label: "OrisPro Plus", pricePerSet: 4499, downPayment: 15499 },
];
const PENDING_SPLIT_OPTIONS = ["Lump Sum", "Installments"];

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

  // Card 1 — Plan & Amount
  const [plan, setPlan] = useState(initialData?.plan ?? "");
  const [totalSets, setTotalSets] = useState("");
  const [discount, setDiscount] = useState(initialData?.discount ?? "");
  const [savingPlan, setSavingPlan] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const initializedSets = useRef(false);

  // Card 2 — To Pay: Full Amount vs Down Payment, and marking things paid.
  const [payChoice, setPayChoice] = useState(initialData?.pay_choice ?? "");
  const [downPayment, setDownPayment] = useState(initialData?.down_payment ? String(initialData.down_payment) : "");
  // Tracks whether the admin has typed a custom down payment — once they
  // have, switching plans shouldn't silently overwrite it.
  const downPaymentManuallySet = useRef(!!initialData?.down_payment);
  const [savingDownPayment, setSavingDownPayment] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(null); // "full" | "down" | "pending"

  // Pending balance — Lump Sum (one Paid button) or Installments (EMI schedule).
  const pendingPlanInit = initialData?.pending_plan || {};
  const [pendingSplit, setPendingSplit] = useState(pendingPlanInit.mode ?? "");
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

  // Number of sets lives on the row itself (aligner_total_sets) — shared
  // with the Journey tab's Aligner Plan, so whichever side sets it first
  // shows up here without clobbering anything already typed. Before either
  // of those has been set, fall back to whatever the orthodontist already
  // entered in Provisional Planning (provisional_sets_orispro), so the
  // total amount here calculates automatically without re-typing the count.
  useEffect(() => {
    if (appt && !initializedSets.current) {
      const sets = appt.aligner_total_sets || appt.provisional_sets_orispro;
      setTotalSets(sets ? String(sets) : "");
      initializedSets.current = true;
    }
  }, [appt]);

  const planInfo = PLAN_OPTIONS.find((p) => p.value === plan);
  const pricePerSet = planInfo?.pricePerSet || 0;
  const sets = parseInt(totalSets, 10) || 0;
  const grossAmt = pricePerSet * sets;
  const discountAmt = parseFloat(discount) || 0;
  // Coupons the patient applied themselves (on their own Plan and Payment
  // page) live in payment_data.applied_coupons — fold that total in here too,
  // so the admin's Final Amount always matches what the patient actually
  // sees and owes, not just the admin's own manually-entered Discount.
  const appliedCouponsTotal = (appt?.payment_data?.applied_coupons || [])
    .reduce((sum, c) => sum + (parseFloat(c.discount) || 0), 0);
  const finalAmt = Math.max(0, grossAmt - discountAmt - appliedCouponsTotal);
  const downAmt = parseFloat(downPayment) || 0;
  // amount_paid lives outside payment_data, on the row itself, and is the
  // one trusted running total — kept in sync by recordPaymentReceived
  // regardless of whether a payment came from the gateway or a manual
  // "Mark as Paid" click here.
  const paidAmt = Number(appt?.amount_paid) || 0;
  const remainingAmt = Math.max(0, finalAmt - paidAmt);
  const fullyPaid = finalAmt > 0 && paidAmt >= finalAmt;
  const downPaymentPaid = downAmt > 0 && paidAmt >= downAmt;

  // Down payment defaults to the selected plan's figure (OrisPro ₹12,499,
  // OrisPro Plus ₹15,499) and updates automatically when the plan changes —
  // unless the admin already typed a custom amount, or it's already paid.
  useEffect(() => {
    if (planInfo && !downPaymentManuallySet.current && !downPaymentPaid) {
      setDownPayment(String(planInfo.downPayment));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const savePlan = async () => {
    if (!plan) { alert("Select a plan."); return; }
    if (sets <= 0) { alert("Enter the number of sets."); return; }
    setSavingPlan(true);
    try {
      const newPaymentData = {
        ...(appt?.payment_data || {}),
        plan,
        price_per_set: pricePerSet,
        full_amount: grossAmt,
        discount: discountAmt,
        final_amount: finalAmt,
        // Mirrors what the gateway itself reads when the patient self-serve
        // pays the "pending" amount (see /api/cashfree/order) — keep it in
        // step with the final amount whenever the plan changes.
        pending_amount: Math.max(0, finalAmt - paidAmt),
      };
      const newJourneySteps = { ...(appt?.journey_steps || {}), payment_done: true };
      const { error } = await supabase
        .from("appointments_booking")
        .update({ payment_data: newPaymentData, aligner_total_sets: sets, journey_steps: newJourneySteps })
        .eq("id", appointmentId);
      if (error) { alert("Error saving: " + error.message); return; }

      logAudit({ appointmentId, actor, action: "Plan & Amount Saved", entity: "payment_data", newData: newPaymentData });

      if (!appt?.journey_steps?.payment_done) {
        fetch("/api/notify-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId, stepKey: "payment_done", email: patientEmail || null }),
        }).catch(() => {});
      }

      setAppt((prev) => prev && { ...prev, payment_data: newPaymentData, aligner_total_sets: sets, journey_steps: newJourneySteps });
      setPlanSaved(true);
      setTimeout(() => setPlanSaved(false), 3000);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSavingPlan(false);
    }
  };

  const savePayChoice = async (choice) => {
    setPayChoice(choice);
    const newPaymentData = {
      ...(appt?.payment_data || {}),
      pay_choice: choice,
      // Persist the down payment amount right away too — otherwise the
      // pre-filled ₹12,500 default only ever reaches the patient page if
      // the admin separately remembers to click Save next to the field,
      // and shows as ₹0 until then.
      ...(choice === "down_payment" ? { down_payment: downAmt } : {}),
    };
    const { error } = await supabase.from("appointments_booking").update({ payment_data: newPaymentData }).eq("id", appointmentId);
    if (!error) setAppt((prev) => prev && { ...prev, payment_data: newPaymentData });
  };

  const saveDownPayment = async () => {
    setSavingDownPayment(true);
    try {
      const newPaymentData = { ...(appt?.payment_data || {}), down_payment: downAmt };
      const { error } = await supabase.from("appointments_booking").update({ payment_data: newPaymentData }).eq("id", appointmentId);
      if (error) { alert("Error saving: " + error.message); return; }
      logAudit({ appointmentId, actor, action: "Down Payment Amount Updated", entity: "payment_data", newData: { down_payment: downAmt } });
      setAppt((prev) => prev && { ...prev, payment_data: newPaymentData });
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSavingDownPayment(false);
    }
  };

  // Records a manual payment (Full / Down Payment / Pending) through the
  // same trusted, additive endpoint the payment gateways use, so the
  // figures here, on the patient page, and on any future gateway payment
  // all agree regardless of where a payment actually came from.
  const recordManualPayment = async (amount, label, markKey) => {
    if (amount <= 0) return;
    setMarkingPaid(markKey);
    try {
      const res = await fetch("/api/update-payment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          amountPaid: amount,
          paymentMethod: "Manual",
          notes: label,
          actorEmail: actor?.email,
          actorRole: actor?.role,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert("Failed to record payment: " + (json.error || "Unknown error"));
        return;
      }

      // Keep payment_data.pending_amount in sync with the running total —
      // the gateway reads it directly for the patient's own "pay pending"
      // self-serve flow, so it must reflect whatever recordPaymentReceived
      // just computed, not just gateway-originated payments.
      const newPaymentData = { ...(appt?.payment_data || {}), pending_amount: Math.max(0, finalAmt - json.totalPaid) };
      await supabase.from("appointments_booking").update({ payment_data: newPaymentData }).eq("id", appointmentId);

      logAudit({ appointmentId, actor, action: `${label} Marked Paid`, entity: "payment_status", newData: { amount, totalPaid: json.totalPaid } });

      setAppt((prev) => prev && {
        ...prev, payment_data: newPaymentData, amount_paid: json.totalPaid, amount_to_pay: json.stillToPay, payment_status: json.paymentStatus,
      });
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setMarkingPaid(null);
    }
  };

  const isRecurringSplit = pendingSplit === "Installments";

  // Choosing "Lump Sum" saves and locks immediately — there's nothing else
  // to configure. "Installments" just reveals the tenure/amount/date form;
  // it locks in once "Generate Schedule" is clicked.
  const choosePendingSplit = async (opt) => {
    setPendingSplit(opt);
    if (opt === "Lump Sum") {
      const pendingPlan = { mode: "Lump Sum", amount: "", tenure: "", recurring_date: "", installments: [] };
      const newPaymentData = { ...(appt?.payment_data || {}), pending_plan: pendingPlan };
      const { error } = await supabase.from("appointments_booking").update({ payment_data: newPaymentData }).eq("id", appointmentId);
      if (!error) {
        setAppt((prev) => prev && { ...prev, payment_data: newPaymentData });
        setIsPendingLocked(true);
      }
    }
  };

  const savePendingSetup = async () => {
    if (!(parseFloat(pendingPlanAmount) > 0 && parseInt(pendingTenure) > 0 && pendingRecurringDate)) {
      alert("Enter the EMI amount, tenure, and first installment date.");
      return;
    }
    setGeneratingPending(true);
    try {
      const installments = buildRecurringInstallments(pendingPlanAmount, pendingTenure, pendingRecurringDate, pendingInstallments);
      const pendingPlan = {
        mode: "Installments",
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
  // additive endpoint the gateways use, so the patient's Paid/Pending
  // figures stay consistent regardless of where a payment came from.
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
          paymentMethod: "Manual",
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
      const updatedPendingPlan = { mode: "Installments", amount: pendingPlanAmount, tenure: pendingTenure, recurring_date: pendingRecurringDate, installments: updatedInstallments };
      const newPaymentData = {
        ...(appt?.payment_data || {}),
        pending_plan: updatedPendingPlan,
        pending_amount: Math.max(0, finalAmt - json.totalPaid),
      };

      const { error } = await supabase
        .from("appointments_booking")
        .update({ payment_data: newPaymentData })
        .eq("id", appointmentId);
      if (error) { alert("Error saving: " + error.message); return; }

      logAudit({ appointmentId, actor, action: `Installment ${num} Marked Paid`, entity: "payment_data", newData: { installment: num, amount: inst.amount, totalPaid: json.totalPaid } });

      setPendingInstallments(updatedInstallments);
      setAppt((prev) => prev && {
        ...prev, payment_data: newPaymentData, amount_paid: json.totalPaid, amount_to_pay: json.stillToPay, payment_status: json.paymentStatus,
      });
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setMarkingInstallmentPaid(null);
    }
  };

  const choiceBtnStyle = (active) => ({
    flex: 1, padding: "12px", borderRadius: "10px",
    border: active ? "2px solid #111827" : "1px solid #d1d5db",
    background: active ? "#f0f0f0" : "white",
    color: "#111827", fontWeight: active ? "700" : "600", fontSize: "14px", cursor: "pointer",
  });
  const okBanner = { marginTop: "12px", padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#16a34a", fontWeight: "700", fontSize: "13px" };
  const changeLinkStyle = { marginTop: "10px", padding: "8px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "600", fontSize: "12px", cursor: "pointer" };

  if (appt?.monthly_plan || appt?.provisional_min_months != null || appt?.provisional_max_months != null) {
    return <MonthlyBillingCards appointmentId={appointmentId} appt={appt} setAppt={setAppt} actor={actor} />;
  }

  return (
    <div>
      {/* Card 1 — Plan & Amount */}
      <div style={card}>
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#111827" }}>Plan & Amount</h3>
        <div style={row}>
          <div>
            <span style={label}>PLAN</span>
            <select style={select} value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="">— Select —</option>
              {PLAN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label} (₹{p.pricePerSet.toLocaleString("en-IN")}/set)</option>)}
            </select>
          </div>
          <div>
            <span style={label}>NUMBER OF SETS</span>
            <input style={input} type="number" min="1" placeholder="e.g. 10" value={totalSets}
              onChange={(e) => setTotalSets(e.target.value)} />
          </div>
        </div>
        <div style={row}>
          <div>
            <span style={label}>TOTAL AMOUNT (₹) — auto-calculated</span>
            <input style={readonlyInput} type="text" readOnly value={`₹ ${grossAmt.toLocaleString("en-IN")}`} />
          </div>
          <div>
            <span style={label}>DISCOUNT (₹)</span>
            <input style={input} type="number" placeholder="0" value={discount}
              onChange={(e) => setDiscount(e.target.value)} />
          </div>
        </div>
        {appliedCouponsTotal > 0 && (
          <div style={{ marginBottom: "16px", padding: "10px 12px", background: "#fef3c7", borderRadius: "8px" }}>
            <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", color: "#92400e", textTransform: "uppercase" }}>Coupon(s) applied by patient</p>
            {(appt?.payment_data?.applied_coupons || []).map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#111827" }}>
                <span style={{ fontWeight: "700" }}>{c.code}</span>
                <span>− {inr(c.discount)}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginBottom: "20px" }}>
          <span style={label}>FINAL AMOUNT (₹) — auto-calculated, after discount{appliedCouponsTotal > 0 ? " & coupon(s)" : ""}</span>
          <input style={readonlyInput} type="text" readOnly value={`₹ ${finalAmt.toLocaleString("en-IN")}`} />
        </div>
        <button style={savingPlan ? { ...btnGold, opacity: 0.6 } : btnGold} onClick={savePlan} disabled={savingPlan}>
          {savingPlan ? "Saving..." : "Save"}
        </button>
        {planSaved && <span style={{ marginLeft: "10px", fontSize: "13px", fontWeight: "700", color: "#16a34a" }}>✓ Saved</span>}
      </div>

      {/* Card 2 — To Pay */}
      {finalAmt > 0 && (
        <div style={card}>
          <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#111827" }}>To Pay</h3>

          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <button onClick={() => savePayChoice("full")} style={choiceBtnStyle(payChoice === "full")}>Full Amount</button>
            <button onClick={() => savePayChoice("down_payment")} style={choiceBtnStyle(payChoice === "down_payment")}>Down Payment</button>
          </div>

          {payChoice === "full" && (
            <div style={{ padding: "16px", background: "#f8f7f5", borderRadius: "10px" }}>
              <PaymentSummaryRow label="Final Amount" value={inr(finalAmt)} />
              {fullyPaid ? (
                <div style={okBanner}>✅ Paid in full — Remaining ₹0</div>
              ) : (
                <button
                  style={{ marginTop: "12px", ...btnGold, opacity: markingPaid === "full" ? 0.6 : 1 }}
                  onClick={() => recordManualPayment(remainingAmt, "Full Payment", "full")}
                  disabled={markingPaid === "full"}
                >
                  {markingPaid === "full" ? "Saving..." : "Mark as Paid"}
                </button>
              )}
            </div>
          )}

          {payChoice === "down_payment" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ padding: "16px", background: "#f8f7f5", borderRadius: "10px" }}>
                <span style={label}>DOWN PAYMENT (₹)</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input style={{ ...input, flex: 1 }} type="number" value={downPayment} disabled={downPaymentPaid}
                    onChange={(e) => { downPaymentManuallySet.current = true; setDownPayment(e.target.value); }} />
                  {!downPaymentPaid && (
                    <button style={{ ...btnPrimary, opacity: savingDownPayment ? 0.6 : 1 }} onClick={saveDownPayment} disabled={savingDownPayment}>
                      {savingDownPayment ? "Saving..." : "Save"}
                    </button>
                  )}
                </div>
                {downPaymentPaid ? (
                  <div style={okBanner}>✅ Down payment paid</div>
                ) : (
                  <button
                    style={{ marginTop: "12px", ...btnGold, opacity: markingPaid === "down" ? 0.6 : 1 }}
                    onClick={() => recordManualPayment(downAmt, "Down Payment", "down")}
                    disabled={markingPaid === "down" || downAmt <= 0}
                  >
                    {markingPaid === "down" ? "Saving..." : "Mark Down Payment Paid"}
                  </button>
                )}
              </div>

              {downPaymentPaid && (
                <div style={{ padding: "16px", background: "#f8f7f5", borderRadius: "10px" }}>
                  <PaymentSummaryRow label="Pending Amount" value={inr(remainingAmt)} />
                  {remainingAmt === 0 ? (
                    <div style={okBanner}>✅ All paid — Remaining ₹0</div>
                  ) : !isPendingLocked ? (
                    <div style={{ marginTop: "12px" }}>
                      <span style={label}>HOW WILL THE PENDING AMOUNT BE PAID?</span>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                        {PENDING_SPLIT_OPTIONS.map((opt) => (
                          <button key={opt} onClick={() => choosePendingSplit(opt)} style={choiceBtnStyle(pendingSplit === opt)}>{opt}</button>
                        ))}
                      </div>

                      {isRecurringSplit && (
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
                          <div style={{ marginBottom: "16px" }}>
                            <span style={label}>FIRST INSTALLMENT DATE</span>
                            <input style={input} type="date" value={pendingRecurringDate}
                              onChange={(e) => setPendingRecurringDate(e.target.value)} />
                          </div>
                          {parseFloat(pendingPlanAmount) > 0 && parseInt(pendingTenure) > 0 && pendingRecurringDate && (
                            <div style={{ padding: "10px 12px", marginBottom: "16px", background: "white", borderRadius: "8px", fontSize: "12px", color: "#6b7280" }}>
                              This will create {parseInt(pendingTenure)} installments of {inr(pendingPlanAmount)}, starting {formatDate(pendingRecurringDate)} and recurring monthly.
                            </div>
                          )}
                          <button
                            style={{ ...btnGold, opacity: generatingPending ? 0.6 : 1 }}
                            onClick={savePendingSetup}
                            disabled={generatingPending}
                          >
                            {generatingPending ? "Saving..." : "Generate Schedule"}
                          </button>
                        </>
                      )}
                    </div>
                  ) : pendingSplit === "Lump Sum" ? (
                    <div style={{ marginTop: "12px" }}>
                      <button
                        style={{ ...btnGold, opacity: markingPaid === "pending" ? 0.6 : 1 }}
                        onClick={() => recordManualPayment(remainingAmt, "Pending Amount", "pending")}
                        disabled={markingPaid === "pending"}
                      >
                        {markingPaid === "pending" ? "Saving..." : "Mark as Paid"}
                      </button>
                      <div>
                        <button onClick={() => setIsPendingLocked(false)} style={changeLinkStyle}>Change</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: "12px" }}>
                      {pendingInstallments.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                          {pendingInstallments.map((inst) => (
                            <div key={inst.num} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: inst.paid ? "#f0fdf4" : "white", borderRadius: "8px", border: inst.paid ? "1px solid #bbf7d0" : "1px solid #e5e7eb" }}>
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
                      <button onClick={() => setIsPendingLocked(false)} style={changeLinkStyle}>Change</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New per-arch, month-by-month billing (Payment tab) ───────────────────────
function MonthlyBillingCards({ appointmentId, appt, setAppt, actor }) {
  const [markingPaid, setMarkingPaid] = useState(null); // "final_fee" | month num

  const couponsTotal = (appt.payment_data?.applied_coupons || [])
    .reduce((sum, c) => sum + (parseFloat(c.discount) || 0), 0);
  const discounted = appt.monthly_plan ? applyCouponDiscount(appt.monthly_plan, couponsTotal) : null;
  const amountPaid = Number(appt.amount_paid) || 0;
  const planCfg = PLAN_CONFIGS[appt.payment_data?.plan] || PLAN_CONFIGS.ORISPRO;
  const provisionalChoice = appt.payment_data?.provisional_payment_choice;
  const provisionalThreshold = provisionalChoice === "first_month" ? planCfg.monthRate : provisionalChoice === "full_plan" ? PROVISIONAL_PLAN_FEE : null;
  const provisionalPaid = provisionalThreshold !== null && amountPaid >= provisionalThreshold;

  // Same trusted, additive endpoint the gateways and legacy manual payments
  // use — recordPaymentReceived (via /api/update-payment-status) — so the
  // figures here, the patient page, and any gateway payment always agree.
  const markPaid = async (amount, label, markKey) => {
    if (amount <= 0) return;
    setMarkingPaid(markKey);
    try {
      const res = await fetch("/api/update-payment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          amountPaid: amount,
          paymentMethod: "Manual",
          notes: label,
          actorEmail: actor?.email,
          actorRole: actor?.role,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert("Failed to record payment: " + (json.error || "Unknown error"));
        return;
      }
      logAudit({ appointmentId, actor, action: `${label} Marked Paid`, entity: "payment_status", newData: { amount, totalPaid: json.totalPaid } });
      setAppt((prev) => prev && { ...prev, amount_paid: json.totalPaid, amount_to_pay: json.stillToPay, payment_status: json.paymentStatus });
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setMarkingPaid(null);
    }
  };

  const nextMonth = discounted ? discounted.months.find((m) => amountPaid < m.discountedCumulative) : null;

  return (
    <div>
      <div style={card}>
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#111827" }}>Provisional Estimate</h3>
        {appt.provisional_min_months && appt.provisional_max_months ? (() => {
          const estPlan = appt.journey_steps?.provisional_estimate_plan || "ORISPRO";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {Object.values(PLAN_CONFIGS).map((cfg) => {
                const r = estimateRangeForPlan(appt.provisional_min_months, appt.provisional_max_months, estPlan, cfg.key);
                return (
                  <p key={cfg.key} style={{ margin: 0, fontSize: "14px", color: "#374151" }}>
                    {cfg.label}: {r.min === r.max ? formatMonthsDays(r.min) : `${formatMonthsDays(r.min)} – ${formatMonthsDays(r.max)}`}
                  </p>
                );
              })}
            </div>
          );
        })() : (
          <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Not entered yet.</p>
        )}
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#111827" }}>Provisional Planning Payment</h3>
        {!appt.payment_data?.plan ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Patient hasn&apos;t picked a plan yet.</p>
        ) : !provisionalChoice ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Plan picked ({planCfg.label}), payment choice not made yet.</p>
        ) : provisionalPaid ? (
          <p style={okBannerText}>✅ Paid — {provisionalChoice === "first_month" ? `First Month (${inr(planCfg.monthRate)})` : `Full Plan Fee (${inr(PROVISIONAL_PLAN_FEE)})`}</p>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <span style={{ fontSize: "14px", color: "#374151" }}>{provisionalChoice === "first_month" ? `First Month · ${inr(planCfg.monthRate)}` : `Full Plan Fee · ${inr(PROVISIONAL_PLAN_FEE)}`} pending</span>
            <button
              onClick={() => markPaid(Math.max(0, provisionalThreshold - amountPaid), provisionalChoice === "first_month" ? "Provisional Planning — First Month" : "Provisional Planning — Full Plan Fee", "final_fee")}
              disabled={markingPaid === "final_fee"}
              style={btnPrimary}
            >
              {markingPaid === "final_fee" ? "Saving..." : "Mark as Paid"}
            </button>
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#111827" }}>
          Final Plan {appt.final_upper_sets ? `— Upper ${appt.final_upper_sets} · Lower ${appt.final_lower_sets} · ${appt.monthly_plan?.totalMonths} months` : ""}
        </h3>
        {!discounted ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>
            Not yet available — the orthodontist hasn&apos;t completed Final Plan Review for this patient.
          </p>
        ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {discounted.months.map((m) => {
            const isPaid = amountPaid >= m.discountedCumulative;
            const isNext = nextMonth && nextMonth.num === m.num;
            return (
              <div key={m.num} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: isPaid ? "#f0fdf4" : "#fafafa", borderRadius: "8px", border: isPaid ? "1px solid #bbf7d0" : "1px solid #e5e7eb" }}>
                <div>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>
                    Package {m.num} — {monthSlotLabels(m.upper, m.lower).join(", ")}
                  </span>
                  <span style={{ marginLeft: "8px", fontSize: "13px", color: "#6b7280" }}>{inr(m.payableAmount)}</span>
                </div>
                {isPaid ? (
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>✓ Paid</span>
                ) : isNext ? (
                  <button
                    onClick={() => markPaid(m.payableAmount, `Month ${m.num} Aligner Sets`, m.num)}
                    disabled={markingPaid === m.num}
                    style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: "#111827", color: "white", fontWeight: "700", fontSize: "12px", cursor: markingPaid === m.num ? "not-allowed" : "pointer", flexShrink: 0 }}
                  >
                    {markingPaid === m.num ? "Saving..." : "Mark as Paid"}
                  </button>
                ) : (
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>Locked</span>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
const okBannerText = { margin: 0, fontSize: "14px", fontWeight: "800", color: "#16a34a" };

// ─── Manufacturing & Logistics Tab (merged) ───────────────────────────────────
function ManufacturingTab({ appointmentId, initialData, logisticsData, actor }) {
  const [batches, setBatches] = useState(() => {
    const mfg = initialData?.batches || [];
    const log = logisticsData?.batches || [];
    return mfg.map((b) => {
      const l = log.find((x) => x.num === b.num) || {};
      return {
        num: b.num, start: b.start ?? "", end: b.end ?? "",
        // Set instead of start/end for batches auto-created by a paid month
        // under the new per-arch, month-by-month model — see
        // lib/paymentHelper.ts.
        upper_aligners: b.upper_aligners || "", lower_aligners: b.lower_aligners || "",
        slot_label: b.slot_label || "",
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
      batches: updatedBatches.map(({ num, start, end, upper_aligners, lower_aligners, slot_label, mfg_started, mfg_done, shipment_link }) => ({ num, start, end, upper_aligners, lower_aligners, slot_label, mfg_started, mfg_done, shipment_link })),
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
      // First moment any batch actually got a tracking link saved — the
      // Report tab shows this as the dispatch timestamp.
      aligners_dispatched_at: dispatched ? (js.aligners_dispatched_at || new Date().toISOString()) : null,
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
    const hasArchLabels = batch.slot_label || batch.upper_aligners || batch.lower_aligners;
    if (!hasArchLabels && (batch.start === "" || batch.end === "")) { alert("Enter the aligner set range for this batch first."); return; }
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
            {batch.slot_label
              ? `PACKAGE ${batch.num} — ${batch.slot_label.toUpperCase()}`
              : batch.upper_aligners || batch.lower_aligners
              ? `PACKAGE ${batch.num} — UPPER ${batch.upper_aligners || "—"}, LOWER ${batch.lower_aligners || "—"}`
              : `BATCH ${batch.num}`}
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
  const hasMonthlyPlan = !!appt.monthly_plan;
  // New-model as soon as Provisional Planning is done under it, not only
  // once Final Plan Review generates monthly_plan — see the patient page's
  // deriveSteps for the same reasoning.
  const isNewModel = hasMonthlyPlan || appt.provisional_min_months != null || appt.provisional_max_months != null;
  const amountPaid = Number(appt.amount_paid) || 0;

  const base = {
    booked:                  true,
    confirmed:               appt.status === "confirmed" || appt.status === "completed",
    scanning_done:           js.scanning_done        !== undefined ? !!js.scanning_done        : !!appt.stl_submitted,
    provisional_planning:    isNewModel
      ? (() => {
          const planCfg = PLAN_CONFIGS[appt.payment_data?.plan] || PLAN_CONFIGS.ORISPRO;
          const choice = appt.payment_data?.provisional_payment_choice;
          const threshold = choice === "first_month" ? planCfg.monthRate : choice === "full_plan" ? PROVISIONAL_PLAN_FEE : null;
          return !!appt.payment_data?.plan && threshold !== null && amountPaid >= threshold;
        })()
      : !!appt.payment_data?.plan,
    payment_done:            isNewModel
      ? !!(appt.final_upper_sets && appt.final_lower_sets)
      : (js.payment_done !== undefined ? !!js.payment_done : !!(appt.payment_data?.final_amount)),
    planning_done:           js.planning_done        !== undefined ? !!js.planning_done        : !!appt.provisional_plan_submitted,
    final_plan_review:       !!(appt.final_upper_sets && appt.final_lower_sets),
    investigation_required:  isInvestigationDone(js),
    // See the patient page's deriveSteps: the final_plan-text fallback is
    // legacy-only — new-model patients always track approval explicitly via
    // journey_steps.plan_approved, and their final_plan text is filled in at
    // the Full Plan step, long before actual approval.
    plan_approved:           isNewModel ? !!js.plan_approved : (js.plan_approved !== undefined ? !!js.plan_approved : !!(appt.final_plan && appt.final_plan.trim())),
    followup_appointment:    js.followup_appointment !== undefined ? !!js.followup_appointment : false,
    aligners_delivered:      js.aligners_delivered   !== undefined ? !!js.aligners_delivered   : false,
    smile_correction:        js.smile_correction     !== undefined ? !!js.smile_correction     : false,
    treatment_completed:     js.treatment_completed  !== undefined ? !!js.treatment_completed  : appt.status === "completed",
    feedback_submitted:      js.feedback_submitted   !== undefined ? !!js.feedback_submitted   : false,
  };

  if (hasMonthlyPlan) {
    const couponsTotal = (appt.payment_data?.applied_coupons || [])
      .reduce((sum, c) => sum + (parseFloat(c.discount) || 0), 0);
    base.aligner_sets = amountPaid >= totalCost(applyCouponDiscount(appt.monthly_plan, couponsTotal));
  } else {
    base.manufacturing_started =   js.manufacturing_started   !== undefined ? !!js.manufacturing_started   : false;
    base.manufacturing_completed = js.manufacturing_completed !== undefined ? !!js.manufacturing_completed : false;
    base.aligners_dispatched =     js.aligners_dispatched     !== undefined ? !!js.aligners_dispatched     : false;
    base.aligners_received =       js.aligners_received       !== undefined ? !!js.aligners_received       : false;
  }

  return base;
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
  provisional_planning:    { subject: "Your Plan is Ready to Choose — OrisAlign", body: "You can now choose between OrisPro and OrisPro Plus for your treatment. Visit your journey page to compare pricing and pace, and select the plan that works best for you." },
  payment_done:            { subject: "Payment Confirmed — OrisAlign", body: "Your payment details have been finalised. Thank you for your trust in OrisAlign. Our team will now proceed with your treatment planning and keep you updated at every step." },
  investigation_required:  { subject: "Investigation Required — OrisAlign", body: "Before your plan can be approved, our orthodontist has requested a quick investigation (like an IOPA, OPG, Lateral Ceph, or blood test). Please visit your journey page to see what's needed and upload the relevant image or report." },
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
  const [followupDate, setFollowupDate] = useState(appt.journey_steps?.followup_appointment_at || "");
  const [stepMessages, setStepMessages] = useState(() => JSON.parse(JSON.stringify(DEFAULT_STEP_MESSAGES)));
  const [openEmail, setOpenEmail] = useState({}); // which steps have their email editor expanded
  // Whether to actually send the email/WhatsApp notification when a step is
  // updated — checked (send) by default; missing entries count as checked.
  const [sendNotifyOnUpdate, setSendNotifyOnUpdate] = useState({});

  // Direct link to the patient's own journey-tracking page — for sharing
  // (WhatsApp, SMS, email) so the patient can open it straight in their browser.
  const [linkCopied, setLinkCopied] = useState(false);
  const patientJourneyLink = typeof window !== "undefined" ? `${window.location.origin}/patient/${appointmentId}` : `https://app.orisalign.com/patient/${appointmentId}`;
  const copyPatientJourneyLink = async () => {
    try {
      await navigator.clipboard.writeText(patientJourneyLink);
    } catch {
      window.prompt("Copy this link:", patientJourneyLink);
      return;
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

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

  // Provisional Planning (new per-arch model) — plan choice, editable here too.
  const [savingPlanChoice, setSavingPlanChoice] = useState(false);
  const selectProvisionalPlanAdmin = async (planKey) => {
    setSavingPlanChoice(true);
    const newPaymentData = { ...(appt.payment_data || {}), plan: planKey };
    const { error } = await supabase.from("appointments_booking").update({ payment_data: newPaymentData }).eq("id", appointmentId);
    setSavingPlanChoice(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: "Provisional Plan Choice Set", entity: "payment_data", newData: { plan: planKey } });
    appt.payment_data = newPaymentData;
    setPlanChoiceTick((t) => t + 1);
  };
  const [, setPlanChoiceTick] = useState(0); // forces a re-render after mutating appt.payment_data in place

  // Scanning — provisional plan text + estimated month range (same fields
  // the Ortho portal's Provisional Planning section edits).
  const [scanProvisionalPlan, setScanProvisionalPlan] = useState(appt.provisional_plan || "");
  const [scanMinMonths, setScanMinMonths] = useState(appt.provisional_min_months ? String(appt.provisional_min_months) : "");
  const [scanMaxMonths, setScanMaxMonths] = useState(appt.provisional_max_months ? String(appt.provisional_max_months) : "");
  const [estimatePlan, setEstimatePlan] = useState(appt.journey_steps?.provisional_estimate_plan || "ORISPRO");
  const [savingScanPlan, setSavingScanPlan] = useState(false);
  const [scanPlanSaved, setScanPlanSaved] = useState(false);
  const saveScanProvisionalPlan = async () => {
    setSavingScanPlan(true);
    const min = parseInt(scanMinMonths, 10) || null;
    const max = parseInt(scanMaxMonths, 10) || null;
    // The new per-arch model's panel doesn't show/edit the provisional_plan
    // text field at all (Scanning is scan-only there) — never touch it from
    // that panel so nothing gets silently overwritten with an empty value.
    const updatePayload = isNewModelAppt
      ? { provisional_min_months: min, provisional_max_months: max, journey_steps: { ...(appt.journey_steps || {}), provisional_estimate_plan: estimatePlan, provisional_estimate_at: new Date().toISOString() } }
      : { provisional_plan: scanProvisionalPlan, provisional_min_months: min, provisional_max_months: max };
    const { error } = await supabase
      .from("appointments_booking")
      .update(updatePayload)
      .eq("id", appointmentId);
    setSavingScanPlan(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: "Provisional Plan Text/Estimate Updated", entity: "provisional_plan", newData: updatePayload });
    Object.assign(appt, updatePayload);
    setScanPlanSaved(true);
    setTimeout(() => setScanPlanSaved(false), 3000);
    // New per-arch model only — every time the estimate is saved, the
    // patient should hear their plan is ready, not just once. Respects the
    // same send email/WhatsApp checkbox as every other step.
    if (isNewModelAppt && stepMessages.provisional_planning && sendNotifyOnUpdate.provisional_planning !== false) {
      fetch("/api/notify-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          stepKey: "provisional_planning",
          email: appt.email || null,
          customSubject: stepMessages.provisional_planning.subject,
          customBody: stepMessages.provisional_planning.body,
        }),
      }).catch(() => {});
    }
  };

  // Full Plan (new per-arch model) — final plan text + upper/lower sets.
  const [finalPlanText, setFinalPlanText] = useState(appt.final_plan || "");
  const [savingFinalPlanText, setSavingFinalPlanText] = useState(false);
  const [finalPlanTextSaved, setFinalPlanTextSaved] = useState(false);
  const saveFinalPlanText = async () => {
    setSavingFinalPlanText(true);
    const { error } = await supabase.from("appointments_booking").update({ final_plan: finalPlanText }).eq("id", appointmentId);
    setSavingFinalPlanText(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: "Final Plan Text Updated", entity: "final_plan", newData: { final_plan: finalPlanText } });
    appt.final_plan = finalPlanText;
    setFinalPlanTextSaved(true);
    setTimeout(() => setFinalPlanTextSaved(false), 3000);
  };

  const [finalUpperSets, setFinalUpperSets] = useState(appt.final_upper_sets ? String(appt.final_upper_sets) : "");
  const [finalLowerSets, setFinalLowerSets] = useState(appt.final_lower_sets ? String(appt.final_lower_sets) : "");
  const [savingFinalReview, setSavingFinalReview] = useState(false);
  const generateFinalSchedule = async () => {
    const upper = parseInt(finalUpperSets, 10) || 0;
    const lower = parseInt(finalLowerSets, 10) || 0;
    if (upper <= 0 || lower <= 0) { alert("Enter both upper and lower arch set counts."); return; }
    if (appt.monthly_plan && !window.confirm("A schedule already exists. Regenerating will recompute package numbers and pricing from scratch. Continue?")) return;
    const planKey = appt.payment_data?.plan === "ORISPLUS" ? "ORISPLUS" : "ORISPRO";
    const choice = appt.payment_data?.provisional_payment_choice === "first_month" ? "first_month" : "full_plan";
    const plan = buildMonthlyPlan(upper, lower, planKey, choice);
    const finalPlanReviewAt = new Date().toISOString();
    setSavingFinalReview(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({
        final_upper_sets: upper,
        final_lower_sets: lower,
        monthly_plan: plan,
        journey_steps: { ...(appt.journey_steps || {}), final_plan_review: true, final_plan_review_at: finalPlanReviewAt },
      })
      .eq("id", appointmentId);
    setSavingFinalReview(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: "Final Plan Review Submitted (from Journey tab)", entity: "monthly_plan", newData: { final_upper_sets: upper, final_lower_sets: lower, monthly_plan: plan } });
    appt.final_upper_sets = upper;
    appt.final_lower_sets = lower;
    appt.monthly_plan = plan;
    appt.journey_steps = { ...(appt.journey_steps || {}), final_plan_review: true, final_plan_review_at: finalPlanReviewAt };
    setMonthlyPlanState(plan);
    setPlanChoiceTick((t) => t + 1);
    // Patient may have already pre-paid "first month" before this schedule
    // existed — check now and auto-create Month 1's batch immediately if so.
    fetch("/api/sync-paid-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId }),
    }).catch(() => {});
  };

  // Investigation Required — admin picks which investigation(s) are needed
  // (or "None Required"); the patient then uploads a file per required type.
  const [investigationTypesSelection, setInvestigationTypesSelection] = useState(appt.journey_steps?.investigation_types || []);
  const [savingInvestigationTypes, setSavingInvestigationTypes] = useState(false);
  const [investigationTypesSaved, setInvestigationTypesSaved] = useState(false);
  const toggleInvestigationType = (key) => {
    setInvestigationTypesSelection((prev) => {
      if (key === "NONE") return prev.includes("NONE") ? [] : ["NONE"];
      const withoutNone = prev.filter((t) => t !== "NONE");
      return withoutNone.includes(key) ? withoutNone.filter((t) => t !== key) : [...withoutNone, key];
    });
  };
  const saveInvestigationTypes = async () => {
    setSavingInvestigationTypes(true);
    const newJourneySteps = { ...(appt.journey_steps || {}), investigation_types: investigationTypesSelection, investigation_types_at: new Date().toISOString() };
    const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJourneySteps }).eq("id", appointmentId);
    setSavingInvestigationTypes(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: "Investigation Types Updated", entity: "journey_steps", newData: { investigation_types: investigationTypesSelection } });
    appt.journey_steps = newJourneySteps;
    setInvestigationTypesSaved(true);
    setTimeout(() => setInvestigationTypesSaved(false), 3000);
    setPlanChoiceTick((t) => t + 1);

    // Only notify when the orthodontist actually requested something —
    // saving "None" isn't an investigation being added.
    const hasRealInvestigation = investigationTypesSelection.length > 0 && !investigationTypesSelection.includes("NONE");
    if (hasRealInvestigation && stepMessages.investigation_required && sendNotifyOnUpdate.investigation_required !== false) {
      fetch("/api/notify-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          stepKey: "investigation_required",
          email: appt.email || null,
          customSubject: stepMessages.investigation_required.subject,
          customBody: stepMessages.investigation_required.body,
        }),
      }).catch(() => {});
    }
  };
  const viewInvestigationFileAdmin = async (path) => {
    const { data, error } = await supabase.storage.from("case-files").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { alert("Couldn't open the file."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  // Review note — the orthodontist's written finding after reviewing the
  // uploaded investigation file(s); shown to the patient once submitted.
  const [investigationReviewNote, setInvestigationReviewNote] = useState(appt.journey_steps?.investigation_review_note || "");
  const [savingInvestigationReviewNote, setSavingInvestigationReviewNote] = useState(false);
  const [investigationReviewNoteSaved, setInvestigationReviewNoteSaved] = useState(false);
  const saveInvestigationReviewNote = async () => {
    setSavingInvestigationReviewNote(true);
    const newJourneySteps = { ...(appt.journey_steps || {}), investigation_review_note: investigationReviewNote };
    const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJourneySteps }).eq("id", appointmentId);
    setSavingInvestigationReviewNote(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: "Investigation Review Note Submitted", entity: "journey_steps", newData: { investigation_review_note: investigationReviewNote } });
    appt.journey_steps = newJourneySteps;
    setInvestigationReviewNoteSaved(true);
    setTimeout(() => setInvestigationReviewNoteSaved(false), 3000);
    setPlanChoiceTick((t) => t + 1);
  };

  // Inline previews for uploaded investigation files — fetched once so the
  // photo/report shows directly in the Journey tab, not just behind a link.
  const [investigationSignedUrls, setInvestigationSignedUrls] = useState({}); // type -> signed url
  useEffect(() => {
    const files = appt.journey_steps?.investigation_files || {};
    const paths = Object.entries(files).filter(([, f]) => f?.path);
    if (paths.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        paths.map(async ([type, f]) => {
          const { data } = await supabase.storage.from("case-files").createSignedUrl(f.path, 3600);
          return [type, data?.signedUrl || null];
        })
      );
      setInvestigationSignedUrls(Object.fromEntries(entries));
    })();
  }, [appt.journey_steps?.investigation_files]);
  const isImageFile = (name) => /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(name || "");

  // Plan Approval is never automatic for the new per-arch model — the
  // patient's Approve Plan button stays locked until an admin explicitly
  // switches it on here, regardless of how "ready" the plan otherwise is.
  const [savingApprovalUnlock, setSavingApprovalUnlock] = useState(false);
  const toggleApprovalUnlocked = async () => {
    const newVal = !appt.journey_steps?.plan_approval_unlocked;
    setSavingApprovalUnlock(true);
    const newJourneySteps = { ...(appt.journey_steps || {}), plan_approval_unlocked: newVal };
    const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJourneySteps }).eq("id", appointmentId);
    setSavingApprovalUnlock(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: newVal ? "Plan Approval Switched On" : "Plan Approval Switched Off", entity: "journey_steps", newData: { plan_approval_unlocked: newVal } });
    appt.journey_steps = newJourneySteps;
    setPlanChoiceTick((t) => t + 1);
  };

  const [markingProvisionalPayment, setMarkingProvisionalPayment] = useState(false);
  // `threshold` is the full target amount (e.g. ₹4,999) — recordPaymentReceived
  // is additive, so if some amount is already sitting on the row (a partial
  // payment, or a reclassified choice like Somyashree's), only the shortfall
  // must be sent, not the full nominal figure again on top of it.
  const markProvisionalPaymentPaid = async (choice, threshold) => {
    const amount = Math.max(0, threshold - (Number(appt.amount_paid) || 0));
    if (amount <= 0) { setPlanChoiceTick((t) => t + 1); return; }
    setMarkingProvisionalPayment(true);
    try {
      const newPaymentData = { ...(appt.payment_data || {}), provisional_payment_choice: choice };
      await supabase.from("appointments_booking").update({ payment_data: newPaymentData }).eq("id", appointmentId);
      const res = await fetch("/api/update-payment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, amountPaid: amount, paymentMethod: "Manual", notes: choice === "first_month" ? "Provisional Planning — First Month" : "Provisional Planning — Full Plan Fee", actorEmail: actor?.email, actorRole: actor?.role }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { alert("Failed to record payment: " + (json.error || "Unknown error")); return; }
      logAudit({ appointmentId, actor, action: "Provisional Planning Payment Marked Paid", entity: "payment_status", newData: { choice, amount, totalPaid: json.totalPaid } });
      appt.payment_data = newPaymentData;
      appt.amount_paid = json.totalPaid;
      setPlanChoiceTick((t) => t + 1);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setMarkingProvisionalPayment(false);
    }
  };

  // Prealigner Treatment — mark dentist-flagged procedures done on the patient's behalf.
  const [markingPrealignerProc, setMarkingPrealignerProc] = useState(null);
  const toggleAdminPrealignerDone = async (procName) => {
    const doneMap = appt.journey_steps?.prealigner_done || {};
    const isDone = !!doneMap[procName];
    setMarkingPrealignerProc(procName);
    const newDone = { ...doneMap };
    if (isDone) delete newDone[procName]; else newDone[procName] = new Date().toISOString();
    const newJourneySteps = { ...(appt.journey_steps || {}), prealigner_done: newDone };
    const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJourneySteps }).eq("id", appointmentId);
    setMarkingPrealignerProc(null);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: isDone ? `Prealigner Procedure Marked Undone: ${procName}` : `Prealigner Procedure Marked Done: ${procName}`, entity: "prealigner_done", newData: newDone });
    appt.journey_steps = newJourneySteps;
    setPlanChoiceTick((t) => t + 1);
  };

  // Aligner Sets (new per-arch model) — package pricing overrides + production/dispatch,
  // folded in here instead of the Manufacturing tab (hidden for these patients).
  const [monthlyPlanState, setMonthlyPlanState] = useState(appt.monthly_plan || null);
  const [batchesState, setBatchesState] = useState(appt.manufacturing_data?.batches || []);
  const [priceEdits, setPriceEdits] = useState({});
  const [savingPrice, setSavingPrice] = useState(null);
  const [trackingInputs, setTrackingInputs] = useState({});
  const [savingBatch, setSavingBatch] = useState(null);

  const savePackagePrice = async (num) => {
    const newAmount = parseFloat(priceEdits[num]);
    if (!newAmount || newAmount <= 0) { alert("Enter a valid amount."); return; }
    setSavingPrice(num);
    const months = monthlyPlanState.months.map((m) => (m.num === num ? { ...m, amount: newAmount } : m));
    const newPlan = { ...monthlyPlanState, months: recomputeCumulative(months) };
    const { error } = await supabase.from("appointments_booking").update({ monthly_plan: newPlan }).eq("id", appointmentId);
    setSavingPrice(null);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: `Package ${num} Price Overridden`, entity: "monthly_plan", newData: { num, amount: newAmount } });
    appt.monthly_plan = newPlan;
    setMonthlyPlanState(newPlan);
    setPriceEdits((prev) => { const next = { ...prev }; delete next[num]; return next; });
  };

  const markProductionCompleted = async (num) => {
    setSavingBatch(`${num}-prod`);
    const today = new Date().toISOString().slice(0, 10);
    const updatedBatches = batchesState.map((b) => (b.num === num ? { ...b, mfg_done: b.mfg_done || today } : b));
    const newMfg = { ...(appt.manufacturing_data || {}), batches: updatedBatches };
    const { error } = await supabase.from("appointments_booking").update({ manufacturing_data: newMfg }).eq("id", appointmentId);
    setSavingBatch(null);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: `Package ${num} Production Completed`, entity: "manufacturing_data", newData: { num, mfg_done: today } });
    appt.manufacturing_data = newMfg;
    setBatchesState(updatedBatches);
  };

  const saveDispatch = async (num) => {
    const draft = trackingInputs[num] || {};
    setSavingBatch(`${num}-dispatch`);
    const today = new Date().toISOString().slice(0, 10);
    const updatedBatches = batchesState.map((b) => {
      if (b.num !== num) return b;
      const shipment_link = draft.shipment_link !== undefined ? draft.shipment_link : (b.shipment_link || "");
      return {
        ...b,
        shipment_id: draft.shipment_id !== undefined ? draft.shipment_id : (b.shipment_id || ""),
        shipment_link,
        mfg_done: b.mfg_done || (shipment_link ? today : b.mfg_done),
      };
    });
    const newMfg = { ...(appt.manufacturing_data || {}), batches: updatedBatches };
    const { error } = await supabase.from("appointments_booking").update({ manufacturing_data: newMfg }).eq("id", appointmentId);
    setSavingBatch(null);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId, actor, action: `Package ${num} Dispatched`, entity: "manufacturing_data", newData: updatedBatches.find((b) => b.num === num) });
    appt.manufacturing_data = newMfg;
    setBatchesState(updatedBatches);
  };

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
    // Record exactly when this step was actually marked done — previously
    // nothing captured this at all (the Report tab's timestamp lookup
    // searched for an audit action that was never logged), so every
    // manually-toggled milestone always showed "exact timestamp not
    // recorded" even though the real moment existed.
    const newJs = { ...js, [key]: newVal, [`${key}_at`]: newVal ? new Date().toISOString() : null };
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
    appt.journey_steps = newJs;
    if (key === "feedback_submitted") {
      logAudit({ appointmentId, actor, action: newVal ? "Feedback Submitted" : "Feedback Marked Undone", entity: "feedback_submitted", newData: { [key]: newVal } });
    }
    if (newVal && stepMessages[key] && sendNotifyOnUpdate[key] !== false) {
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

  // "Appointment Book" (the follow-up visit booked after the patient
  // receives their aligners) needs a date entered before it can be marked
  // done — unlike the other automatic/derived steps, this one is explicit.
  const markFollowupAppointment = async () => {
    const currentVal = !!steps.followup_appointment;
    const newVal = !currentVal;
    if (newVal && !followupDate) { alert("Enter the appointment date first."); return; }
    setSteps((prev) => ({ ...prev, followup_appointment: newVal }));
    setSaving("followup_appointment");
    const js = appt.journey_steps || {};
    const newJs = { ...js, followup_appointment: newVal, followup_appointment_at: newVal ? followupDate : null };
    const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJs }).eq("id", appointmentId);
    setSaving(null);
    if (error) {
      alert("Save failed: " + error.message);
      setSteps((prev) => ({ ...prev, followup_appointment: currentVal }));
      return;
    }
    logAudit({ appointmentId, actor, action: newVal ? "Follow-Up Appointment Date Confirmed" : "Follow-Up Appointment Marked Undone", entity: "followup_appointment", newData: { followup_appointment: newVal, followup_appointment_at: newJs.followup_appointment_at } });
    if (newVal && stepMessages.followup_appointment && sendNotifyOnUpdate.followup_appointment !== false) {
      fetch("/api/notify-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          stepKey: "followup_appointment",
          email: appt.email || null,
          customSubject: stepMessages.followup_appointment.subject,
          customBody: stepMessages.followup_appointment.body,
        }),
      }).catch(() => {});
    }
  };

  const isNewModelAppt = !!(appt?.monthly_plan || appt?.provisional_min_months != null || appt?.provisional_max_months != null);
  const allSteps = isNewModelAppt ? NEW_ALL_STEPS : LEGACY_ALL_STEPS;
  const doneCount = allSteps.filter((s) => !!steps[s.key]).length;

  return (
    <div>
      <div style={{ ...card, marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
          <button
            onClick={copyPatientJourneyLink}
            style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "none",
              background: linkCopied ? "#dcfce7" : "#111827", color: linkCopied ? "#16a34a" : "white",
              fontWeight: "700", fontSize: "13px", cursor: "pointer",
            }}
          >
            {linkCopied ? "✓ Link Copied" : "🔗 Generate Patient Journey Link"}
          </button>
          <a
            href={patientJourneyLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "12px", color: "#b8905a", textDecoration: "underline", wordBreak: "break-all" }}
          >
            {patientJourneyLink}
          </a>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", color: "#111827" }}>Treatment Roadmap</h3>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>{doneCount} / {allSteps.length} steps done</span>
            <div style={{ height: "8px", width: "120px", borderRadius: "99px", background: "#e5e7eb", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: "99px", width: `${Math.round((doneCount / allSteps.length) * 100)}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)", transition: "width 0.4s ease" }} />
            </div>
          </div>
        </div>
        {!isAdmin && <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#9ca3af" }}>Only admins can approve steps.</p>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {allSteps.map((step, i) => {
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
                {isAdmin && step.key !== "plan_approved" && step.key !== "booked" && step.key !== "confirmed" && step.key !== "payment_done" && step.key !== "followup_appointment" && step.key !== "final_plan_review" && step.key !== "aligner_sets" && step.key !== "provisional_planning" && step.key !== "investigation_required" && (
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
                    {isSaving ? "..." : done ? "Undo" : "Update"}
                  </button>
                )}
                {isAdmin && step.key === "plan_approved" && isNewModelAppt && (
                  <button
                    onClick={toggleApprovalUnlocked}
                    disabled={savingApprovalUnlock}
                    style={{
                      padding: "6px 14px", borderRadius: "8px", border: "none", cursor: savingApprovalUnlock ? "not-allowed" : "pointer",
                      background: appt.journey_steps?.plan_approval_unlocked ? "#fee2e2" : "#111827",
                      color: appt.journey_steps?.plan_approval_unlocked ? "#dc2626" : "white",
                      fontWeight: "700", fontSize: "12px", flexShrink: 0,
                      opacity: savingApprovalUnlock ? 0.6 : 1,
                    }}
                  >
                    {savingApprovalUnlock ? "..." : appt.journey_steps?.plan_approval_unlocked ? "Switch Off" : "Switch On for Patient"}
                  </button>
                )}
                {!isAdmin && step.key === "followup_appointment" && (
                  <span style={{
                    padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", flexShrink: 0,
                    background: done ? "#dcfce7" : "#f3f4f6",
                    color: done ? "#16a34a" : "#9ca3af",
                    letterSpacing: "0.5px",
                  }}>
                    {done ? "✓ CONFIRMED" : "PENDING"}
                  </span>
                )}
                {isAdmin && step.key === "followup_appointment" && (
                  <>
                    <input
                      type="date"
                      value={followupDate}
                      onChange={(e) => setFollowupDate(e.target.value)}
                      style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px", flexShrink: 0 }}
                    />
                    <button
                      onClick={markFollowupAppointment}
                      disabled={saving === "followup_appointment"}
                      style={{
                        padding: "6px 14px", borderRadius: "8px", border: "none", cursor: saving === "followup_appointment" ? "not-allowed" : "pointer",
                        background: done ? "#fee2e2" : "#111827",
                        color: done ? "#dc2626" : "white",
                        fontWeight: "700", fontSize: "12px", flexShrink: 0,
                        opacity: saving === "followup_appointment" ? 0.6 : 1,
                      }}
                    >
                      {saving === "followup_appointment" ? "..." : done ? "Undo" : "Update"}
                    </button>
                  </>
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

              {/* Part A3 — Scanning: provisional plan text + estimated month range.
                  Legacy model only — for the new model this lives in Provisional
                  Planning instead, since Scanning is scan-only there. */}
              {isAdmin && step.key === "scanning_done" && !isNewModelAppt && (
                <div style={subBox}>
                  <span style={label}>PROVISIONAL PLAN</span>
                  <textarea
                    style={{ ...input, minHeight: "90px", fontFamily: "inherit", resize: "vertical" }}
                    placeholder="Write the provisional treatment plan..."
                    value={scanProvisionalPlan}
                    onChange={(e) => setScanProvisionalPlan(e.target.value)}
                  />
                  <span style={label}>ESTIMATED DURATION (MONTHS)</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input style={{ ...input, flex: 1 }} type="number" min="1" placeholder="Min" value={scanMinMonths} onChange={(e) => setScanMinMonths(e.target.value)} />
                    <input style={{ ...input, flex: 1 }} type="number" min="1" placeholder="Max" value={scanMaxMonths} onChange={(e) => setScanMaxMonths(e.target.value)} />
                  </div>
                  <button
                    style={savingScanPlan ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                    onClick={saveScanProvisionalPlan}
                    disabled={savingScanPlan}
                  >
                    {savingScanPlan ? "Saving..." : scanPlanSaved ? "Saved ✓" : "Save Provisional Plan"}
                  </button>
                  <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>
                    Same fields the Ortho portal's Provisional Planning section edits — visible to the patient here too.
                  </p>
                </div>
              )}

              {/* Provisional Planning — estimated duration (new per-arch model) */}
              {isAdmin && step.key === "provisional_planning" && isNewModelAppt && (
                <div style={subBox}>
                  <span style={label}>ESTIMATE BASED ON PLAN</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {Object.values(PLAN_CONFIGS).map((cfg) => (
                      <button
                        key={cfg.key}
                        onClick={() => setEstimatePlan(cfg.key)}
                        style={{
                          flex: 1, padding: "10px", borderRadius: "8px",
                          border: estimatePlan === cfg.key ? "2px solid #b8905a" : "1px solid #e5e7eb",
                          background: estimatePlan === cfg.key ? "#fffbeb" : "white",
                          color: "#111827", fontWeight: "700", fontSize: "13px", cursor: "pointer",
                        }}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                  <span style={label}>ESTIMATED DURATION (MONTHS) — FOR {PLAN_CONFIGS[estimatePlan]?.label.toUpperCase()}</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input style={{ ...input, flex: 1 }} type="number" min="1" placeholder="Min" value={scanMinMonths} onChange={(e) => setScanMinMonths(e.target.value)} />
                    <input style={{ ...input, flex: 1 }} type="number" min="1" placeholder="Max" value={scanMaxMonths} onChange={(e) => setScanMaxMonths(e.target.value)} />
                  </div>
                  <button
                    style={savingScanPlan ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                    onClick={saveScanProvisionalPlan}
                    disabled={savingScanPlan}
                  >
                    {savingScanPlan ? "Saving..." : scanPlanSaved ? "Saved ✓" : "Save Estimate"}
                  </button>
                  {scanMinMonths && scanMaxMonths && (() => {
                    const otherKey = estimatePlan === "ORISPRO" ? "ORISPLUS" : "ORISPRO";
                    const other = estimateRangeForPlan(parseInt(scanMinMonths, 10) || 0, parseInt(scanMaxMonths, 10) || 0, estimatePlan, otherKey);
                    return (
                      <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
                        Auto-calculated for {PLAN_CONFIGS[otherKey].label}: <strong style={{ color: "#111827" }}>{other.min === other.max ? formatMonthsDays(other.min) : `${formatMonthsDays(other.min)} – ${formatMonthsDays(other.max)}`}</strong>
                      </p>
                    );
                  })()}
                </div>
              )}

              {/* Provisional Planning — plan choice (new per-arch model) */}
              {isAdmin && step.key === "provisional_planning" && (
                <div style={subBox}>
                  <span style={label}>PATIENT&apos;S PLAN CHOICE</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {Object.values(PLAN_CONFIGS).map((cfg) => {
                      const isSelected = appt.payment_data?.plan === cfg.key;
                      return (
                        <button
                          key={cfg.key}
                          onClick={() => selectProvisionalPlanAdmin(cfg.key)}
                          disabled={savingPlanChoice}
                          style={{
                            textAlign: "left", padding: "14px", borderRadius: "10px",
                            border: isSelected ? "2px solid #b8905a" : "1px solid #e5e7eb",
                            background: isSelected ? "#fffbeb" : "white",
                            cursor: savingPlanChoice ? "not-allowed" : "pointer",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "800", color: "#111827" }}>{cfg.label}</span>
                            {isSelected && <span style={{ fontSize: "11px", fontWeight: "700", color: "#b8905a" }}>✓ SELECTED</span>}
                          </div>
                          <span style={{ fontSize: "13px", color: "#374151", display: "block" }}>{inr(cfg.monthRate)}/month · {cfg.daysPerSet} days/set · {cfg.setsPerMonth} sets/month</span>
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#9ca3af" }}>
                    Overrides the patient&apos;s own choice. Locked automatically once a schedule has been generated in Final Plan Review.
                  </p>

                  {appt.payment_data?.plan && (() => {
                    const cfg = PLAN_CONFIGS[appt.payment_data.plan] || PLAN_CONFIGS.ORISPRO;
                    const choice = appt.payment_data?.provisional_payment_choice;
                    const amountPaidNow = Number(appt.amount_paid) || 0;
                    const threshold = choice === "first_month" ? cfg.monthRate : choice === "full_plan" ? PROVISIONAL_PLAN_FEE : null;
                    const isPaid = threshold !== null && amountPaidNow >= threshold;
                    return (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e5e7eb" }}>
                        <span style={label}>PAYMENT</span>
                        {isPaid ? (
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#16a34a" }}>
                            ✅ Paid — {choice === "first_month" ? `First Month (${inr(cfg.monthRate)})` : `Full Plan Fee (${inr(PROVISIONAL_PLAN_FEE)})`}
                          </p>
                        ) : (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              style={markingProvisionalPayment ? { ...btnPrimary, opacity: 0.6, flex: 1 } : { ...btnPrimary, flex: 1 }}
                              onClick={() => markProvisionalPaymentPaid("first_month", cfg.monthRate)}
                              disabled={markingProvisionalPayment}
                            >
                              Mark First Month Paid ({inr(Math.max(0, cfg.monthRate - amountPaidNow))} more)
                            </button>
                            <button
                              style={markingProvisionalPayment ? { ...btnPrimary, opacity: 0.6, flex: 1 } : { ...btnPrimary, flex: 1 }}
                              onClick={() => markProvisionalPaymentPaid("full_plan", PROVISIONAL_PLAN_FEE)}
                              disabled={markingProvisionalPayment}
                            >
                              Mark Full Plan Fee Paid ({inr(Math.max(0, PROVISIONAL_PLAN_FEE - amountPaidNow))} more)
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Full Plan (new per-arch model) — final plan text, review link, upper/lower sets. No payment here anymore — that's in Provisional Planning. */}
              {isAdmin && step.key === "payment_done" && isNewModelAppt && (
                <div style={subBox}>
                  <span style={label}>WHAT IS THE FULL PLAN</span>
                  <textarea
                    style={{ ...input, minHeight: "90px", fontFamily: "inherit", resize: "vertical" }}
                    placeholder="Describe the final treatment plan..."
                    value={finalPlanText}
                    onChange={(e) => setFinalPlanText(e.target.value)}
                  />
                  <button
                    style={savingFinalPlanText ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                    onClick={saveFinalPlanText}
                    disabled={savingFinalPlanText}
                  >
                    {savingFinalPlanText ? "Saving..." : finalPlanTextSaved ? "Saved ✓" : "Save Plan Description"}
                  </button>

                  <span style={label}>UPPER / LOWER ARCH SETS</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input style={{ ...input, flex: 1 }} type="number" min="1" placeholder="Upper" value={finalUpperSets} onChange={(e) => setFinalUpperSets(e.target.value)} />
                    <input style={{ ...input, flex: 1 }} type="number" min="1" placeholder="Lower" value={finalLowerSets} onChange={(e) => setFinalLowerSets(e.target.value)} />
                  </div>
                  <button
                    style={savingFinalReview ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                    onClick={generateFinalSchedule}
                    disabled={savingFinalReview}
                  >
                    {savingFinalReview ? "Generating..." : appt.monthly_plan ? "Regenerate Schedule" : "Generate Schedule"}
                  </button>
                  {appt.monthly_plan && (
                    <p style={{ margin: 0, fontSize: "12px", color: "#16a34a", fontWeight: "700" }}>
                      Current: {appt.monthly_plan.totalMonths} months, {appt.monthly_plan.months?.length || 0} packages generated.
                    </p>
                  )}
                </div>
              )}
              {isAdmin && step.key === "payment_done" && isNewModelAppt && (
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
                    Appears to the patient as a &quot;Review Treatment Plan&quot; button.
                  </p>
                </div>
              )}

              {/* Investigation Required — admin picks type(s) or None; patient uploads; admin reviews */}
              {isAdmin && step.key === "investigation_required" && (
                <div style={subBox}>
                  <span style={label}>INVESTIGATION TYPE REQUIRED</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {INVESTIGATION_TYPES.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => toggleInvestigationType(t.key)}
                        style={{
                          padding: "8px 14px", borderRadius: "8px",
                          border: investigationTypesSelection.includes(t.key) ? "2px solid #b8905a" : "1px solid #e5e7eb",
                          background: investigationTypesSelection.includes(t.key) ? "#fff7ed" : "white",
                          color: investigationTypesSelection.includes(t.key) ? "#b8905a" : "#374151",
                          fontWeight: "700", fontSize: "13px", cursor: "pointer",
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                    <button
                      onClick={() => toggleInvestigationType("NONE")}
                      style={{
                        padding: "8px 14px", borderRadius: "8px",
                        border: investigationTypesSelection.includes("NONE") ? "2px solid #16a34a" : "1px solid #e5e7eb",
                        background: investigationTypesSelection.includes("NONE") ? "#f0fdf4" : "white",
                        color: investigationTypesSelection.includes("NONE") ? "#16a34a" : "#374151",
                        fontWeight: "700", fontSize: "13px", cursor: "pointer",
                      }}
                    >
                      None Required
                    </button>
                  </div>
                  <button
                    style={savingInvestigationTypes ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                    onClick={saveInvestigationTypes}
                    disabled={savingInvestigationTypes}
                  >
                    {savingInvestigationTypes ? "Saving..." : investigationTypesSaved ? "Saved ✓" : "Save"}
                  </button>

                  {(appt.journey_steps?.investigation_types || []).length > 0 && !(appt.journey_steps?.investigation_types || []).includes("NONE") && (
                    <>
                      <span style={label}>UPLOADED FILES</span>
                      {(appt.journey_steps.investigation_types || []).map((t) => {
                        const typeInfo = INVESTIGATION_TYPES.find((it) => it.key === t);
                        const file = appt.journey_steps?.investigation_files?.[t];
                        const signedUrl = investigationSignedUrls[t];
                        return (
                          <div key={t} style={{ padding: "10px 12px", background: file?.path ? "#f0fdf4" : "white", borderRadius: "8px", border: file?.path ? "1px solid #bbf7d0" : "1px solid #e5e7eb" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                              <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{typeInfo?.label || t}</span>
                              {file?.path ? (
                                <button
                                  onClick={() => viewInvestigationFileAdmin(file.path)}
                                  style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
                                >
                                  Open Full Size
                                </button>
                              ) : (
                                <span style={{ fontSize: "12px", color: "#9ca3af", fontStyle: "italic" }}>Awaiting upload</span>
                              )}
                            </div>
                            {file?.path && (
                              signedUrl ? (
                                isImageFile(file.name) ? (
                                  <img
                                    src={signedUrl}
                                    alt={typeInfo?.label || t}
                                    onClick={() => viewInvestigationFileAdmin(file.path)}
                                    style={{ marginTop: "10px", width: "100%", maxHeight: "320px", objectFit: "contain", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#111827", cursor: "pointer" }}
                                  />
                                ) : (
                                  <a
                                    href={signedUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ marginTop: "10px", display: "block", padding: "10px", borderRadius: "8px", background: "#f3f4f6", color: "#374151", fontWeight: "700", fontSize: "12px", textAlign: "center", textDecoration: "none" }}
                                  >
                                    📄 {file.name} — View PDF
                                  </a>
                                )
                              ) : (
                                <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#9ca3af" }}>Loading preview...</p>
                              )
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  <span style={label}>REVIEW NOTE FOR PATIENT</span>
                  <textarea
                    style={{ ...input, minHeight: "80px", fontFamily: "inherit", resize: "vertical" }}
                    placeholder="Write your findings after reviewing the uploaded investigation(s)..."
                    value={investigationReviewNote}
                    onChange={(e) => setInvestigationReviewNote(e.target.value)}
                  />
                  <button
                    style={savingInvestigationReviewNote ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                    onClick={saveInvestigationReviewNote}
                    disabled={savingInvestigationReviewNote}
                  >
                    {savingInvestigationReviewNote ? "Saving..." : investigationReviewNoteSaved ? "Submitted ✓" : "Submit Review Note"}
                  </button>
                  {appt.journey_steps?.investigation_review_note && (
                    <p style={{ margin: 0, fontSize: "11px", color: "#16a34a" }}>Visible to the patient on their journey page.</p>
                  )}
                </div>
              )}

              {/* Prealigner Treatment — mark dentist-flagged procedures on the patient's behalf */}
              {isAdmin && step.key === "prealigner_treatment" && (() => {
                const pfd = appt.patient_form_data || {};
                const procs = [...(pfd.pre_orthodontic_procedures || [])].map((p) => (p === "Others" && pfd.pre_orthodontic_others ? `Others: ${pfd.pre_orthodontic_others}` : p));
                const doneMap = appt.journey_steps?.prealigner_done || {};
                if (procs.length === 0) {
                  return (
                    <div style={subBox}>
                      <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>No prealigner procedures were flagged by the dentist for this patient.</p>
                    </div>
                  );
                }
                return (
                  <div style={subBox}>
                    <span style={label}>PREALIGNER PROCEDURES</span>
                    {procs.map((proc) => {
                      const doneAt = doneMap[proc];
                      return (
                        <div key={proc} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: doneAt ? "#f0fdf4" : "white", borderRadius: "8px", border: doneAt ? "1px solid #bbf7d0" : "1px solid #e5e7eb" }}>
                          <div>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{proc}</span>
                            {doneAt && <span style={{ display: "block", fontSize: "11px", color: "#16a34a" }}>Done on {new Date(doneAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                          </div>
                          <button
                            onClick={() => toggleAdminPrealignerDone(proc)}
                            disabled={markingPrealignerProc === proc}
                            style={{ padding: "6px 14px", borderRadius: "8px", border: "none", cursor: markingPrealignerProc === proc ? "not-allowed" : "pointer", background: doneAt ? "#fee2e2" : "#111827", color: doneAt ? "#dc2626" : "white", fontWeight: "700", fontSize: "12px", flexShrink: 0 }}
                          >
                            {markingPrealignerProc === proc ? "..." : doneAt ? "Undo" : "Mark Done"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

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

              {/* Aligner Sets (new per-arch model) — package pricing + production/dispatch,
                  folded in here instead of a separate Manufacturing tab. */}
              {isAdmin && step.key === "aligner_sets" && monthlyPlanState && (() => {
                const couponsTotal = (appt.payment_data?.applied_coupons || [])
                  .reduce((sum, c) => sum + (parseFloat(c.discount) || 0), 0);
                const discounted = applyCouponDiscount(monthlyPlanState, couponsTotal);
                const amountPaidNow = Number(appt.amount_paid) || 0;
                return (
                  <div style={subBox}>
                    <span style={label}>ALIGNER SETS — PACKAGE BY PACKAGE</span>
                    {discounted.months.map((m) => {
                      const isPaid = amountPaidNow >= m.discountedCumulative;
                      const batch = batchesState.find((b) => Number(b.num) === m.num);
                      const editingPrice = priceEdits[m.num] !== undefined;
                      const draft = trackingInputs[m.num] || {};
                      return (
                        <div key={m.num} style={{ padding: "12px", borderRadius: "10px", border: `1px solid ${isPaid ? "#bbf7d0" : "#e5e7eb"}`, background: isPaid ? "#f0fdf4" : "#fafafa", display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>
                              Package {m.num} — {monthSlotLabels(m.upper, m.lower).join(", ")}
                            </span>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: isPaid ? "#16a34a" : "#9ca3af" }}>{isPaid ? "PAID" : "NOT YET ORDERED"}</span>
                          </div>

                          {isPaid ? (
                            <>
                              <span style={{ fontSize: "13px", color: "#374151" }}>{inr(m.payableAmount)}</span>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "white", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#111827" }}>
                                  {batch?.mfg_done ? `Production Completed — ${batch.mfg_done}` : "Push to Production"}
                                </span>
                                {!batch?.mfg_done && (
                                  <button
                                    onClick={() => markProductionCompleted(m.num)}
                                    disabled={savingBatch === `${m.num}-prod`}
                                    style={{ padding: "6px 12px", borderRadius: "8px", border: "none", background: "#111827", color: "white", fontWeight: "700", fontSize: "12px", cursor: savingBatch === `${m.num}-prod` ? "not-allowed" : "pointer" }}
                                  >
                                    {savingBatch === `${m.num}-prod` ? "..." : "Mark Production Completed"}
                                  </button>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "white", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#111827" }}>
                                  {batch?.shipment_link ? "Dispatched" : "Not yet dispatched"}
                                </span>
                                <span style={{ fontSize: "11px", fontWeight: "700", color: batch?.shipment_link ? "#16a34a" : "#9ca3af" }}>{batch?.shipment_link ? "✓ Done" : "Pending"}</span>
                              </div>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <input
                                  style={{ ...input, flex: 1 }}
                                  type="text"
                                  placeholder="Tracking ID"
                                  value={draft.shipment_id !== undefined ? draft.shipment_id : (batch?.shipment_id || "")}
                                  onChange={(e) => setTrackingInputs((prev) => ({ ...prev, [m.num]: { ...prev[m.num], shipment_id: e.target.value } }))}
                                />
                                <input
                                  style={{ ...input, flex: 2 }}
                                  type="url"
                                  placeholder="Tracking link https://..."
                                  value={draft.shipment_link !== undefined ? draft.shipment_link : (batch?.shipment_link || "")}
                                  onChange={(e) => setTrackingInputs((prev) => ({ ...prev, [m.num]: { ...prev[m.num], shipment_link: e.target.value } }))}
                                />
                              </div>
                              <button
                                style={savingBatch === `${m.num}-dispatch` ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}
                                onClick={() => saveDispatch(m.num)}
                                disabled={savingBatch === `${m.num}-dispatch`}
                              >
                                {savingBatch === `${m.num}-dispatch` ? "Saving..." : "Save & Dispatch"}
                              </button>
                            </>
                          ) : (
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <input
                                style={{ ...input, flex: 1 }}
                                type="number"
                                min="0"
                                step="0.01"
                                value={editingPrice ? priceEdits[m.num] : m.amount}
                                onChange={(e) => setPriceEdits((prev) => ({ ...prev, [m.num]: e.target.value }))}
                              />
                              <button
                                onClick={() => savePackagePrice(m.num)}
                                disabled={savingPrice === m.num || !editingPrice}
                                style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: editingPrice ? "#111827" : "#e5e7eb", color: editingPrice ? "white" : "#9ca3af", fontWeight: "700", fontSize: "13px", cursor: (savingPrice === m.num || !editingPrice) ? "not-allowed" : "pointer", flexShrink: 0 }}
                              >
                                {savingPrice === m.num ? "Saving..." : "Save Price"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Email/WhatsApp message — collapsed behind a button; expands to edit.
                  The checkbox controls whether it actually sends on Update —
                  checked by default, so unchecking it is an explicit opt-out. */}
              {isAdmin && !done && stepMessages[step.key] && step.key !== "plan_approved" && (
                <div style={{ marginTop: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => setOpenEmail((prev) => ({ ...prev, [step.key]: !prev[step.key] }))}
                      style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #dbeafe", background: "#f0f7ff", color: "#1e40af", fontWeight: "700", fontSize: "12px", cursor: "pointer", letterSpacing: "0.3px" }}
                    >
                      ✉ Email/WhatsApp to patient (sent on Update) <span style={{ marginLeft: "auto" }}>{openEmail[step.key] ? "▲" : "▼"}</span>
                    </button>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#374151", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={sendNotifyOnUpdate[step.key] !== false}
                        onChange={(e) => setSendNotifyOnUpdate((prev) => ({ ...prev, [step.key]: e.target.checked }))}
                        style={{ width: "15px", height: "15px", accentColor: "#b8905a", cursor: "pointer" }}
                      />
                      Send email/WhatsApp
                    </label>
                  </div>
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
  // The new per-arch model has an entirely different set of milestones
  // (Provisional Planning + payment choice, Full Plan content, Investigation
  // Required, per-month Aligner Sets) in place of the legacy Plan & Payment /
  // Planning Done / Manufacturing Started-Completed / Dispatched-Received
  // sequence — both are built below, gated on this flag.
  const isNewModel = !!appt.monthly_plan || appt.provisional_min_months != null || appt.provisional_max_months != null;
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
  // Some _at fields are full ISO timestamps, others (from ManufacturingTab's
  // batch dates) are bare "YYYY-MM-DD" — normalize either into something
  // `fmt`/`new Date()` can parse correctly.
  const asDateTime = (v) => (!v ? null : v.includes("T") ? v : `${v}T00:00:00`);
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

  // 3. Confirmation — logged by app/(dashboard)/appointment/page.js as a plain
  // "Appointment Confirmed" action, not the generic "Step Marked Done: ..."
  // pattern findDoneLog looks for (this step is auto-derived from
  // appt.status, never toggled through the Journey tab), so it needs its own
  // exact-match lookup or its timestamp is silently never found.
  const confirmLog = logs.find((l) => l.action === "Appointment Confirmed") || findDoneLog("Appointment Confirmed");
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
    at: appt.appointment_started_at || js.scanning_done_at || scanLog?.created_at || null,
    detail: [
      appt.appointment_started_at ? `Scanning session started at the clinic on ${fmt(appt.appointment_started_at)}.` : null,
      appt.scanning_video_url ? `Provisional planning video recorded and uploaded.` : null,
      appt.scanning_review_link ? `Pre-treatment scanning review link shared with patient.` : null,
    ].filter(Boolean),
  });

  if (!isNewModel) {
    // 5. Payment — also an automatic/derived step (never goes through the
    // generic "Step Marked Done" toggle — legacy logs it as "Plan & Amount
    // Saved"), so first_payment_date (set precisely by recordPaymentReceived
    // on the first payment) is the reliable timestamp source here, not the
    // log search.
    const payLog = logs.find((l) => l.action === "Plan & Amount Saved") || findDoneLog("Plan and Payment");
    events.push({
      done: !!steps.payment_done,
      title: "Plan and Payment",
      by: payLog?.actor_email ? `counsellor / admin (${payLog.actor_email})` : "OrisAlign team",
      at: appt.first_payment_date || payLog?.created_at || null,
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
    const planLog = findDoneLog("Full Plan");
    events.push({
      done: !!steps.planning_done,
      title: "Treatment Planning Done",
      by: planLog?.actor_email ? `admin / orthodontist (${planLog.actor_email})` : "OrisAlign team",
      at: js.planning_done_at || planLog?.created_at || null,
      detail: [
        appt.aligner_total_sets ? `Treatment plan consists of ${appt.aligner_total_sets} aligner set${appt.aligner_total_sets !== 1 ? "s" : ""}${appt.aligner_days_per_set ? `, worn ${appt.aligner_days_per_set} days per set` : ""}.` : null,
        appt.aligner_total_sets && appt.aligner_days_per_set
          ? `Total estimated treatment duration: ${appt.aligner_total_sets * appt.aligner_days_per_set} days (approximately ${Math.round((appt.aligner_total_sets * appt.aligner_days_per_set) / 30)} months).`
          : null,
        appt.review_link ? `3D treatment plan review link shared with patient.` : null,
      ].filter(Boolean),
    });
  } else {
    // New per-arch model — Provisional Planning (plan choice + payment),
    // Full Plan (final plan content + schedule generation), and
    // Investigation Required replace the legacy Payment/Planning-Done pair.

    // 5. Provisional Planning — plan chosen, estimate given, payment made.
    // first_payment_date is this patient's very first payment under the new
    // model (the provisional fee or first month), so it's the reliable
    // completion timestamp; provisional_estimate_at (stamped by the admin's
    // "Save Estimate" button) is the fallback for a not-yet-paid patient.
    const planCfgLabel = PLAN_CONFIGS[pd.plan]?.label || pd.plan || null;
    const choiceLabel = pd.provisional_payment_choice === "first_month" ? "Pay First Month" : pd.provisional_payment_choice === "full_plan" ? "Pay for Full Plan" : null;
    events.push({
      done: !!steps.provisional_planning,
      title: "Provisional Planning",
      by: "OrisAlign admin + patient",
      at: appt.first_payment_date || js.provisional_estimate_at || null,
      detail: [
        (appt.provisional_min_months && appt.provisional_max_months) ? `Estimated duration given: ${appt.provisional_min_months}–${appt.provisional_max_months} months.` : null,
        planCfgLabel ? `Patient selected plan: ${planCfgLabel}.` : null,
        choiceLabel ? `Payment option chosen: ${choiceLabel}.` : null,
        appt.amount_paid > 0 ? `Amount paid: ${inr(appt.amount_paid)}.` : null,
      ].filter(Boolean),
    });

    // 6. Full Plan — final plan text + upper/lower sets + schedule generated.
    events.push({
      done: !!steps.payment_done,
      title: "Full Plan",
      by: "admin / orthodontist",
      at: js.final_plan_review_at || null,
      detail: [
        appt.final_upper_sets ? `Upper arch sets: ${appt.final_upper_sets}.` : null,
        appt.final_lower_sets ? `Lower arch sets: ${appt.final_lower_sets}.` : null,
        appt.monthly_plan?.totalMonths ? `Total treatment duration: ${appt.monthly_plan.totalMonths} month${appt.monthly_plan.totalMonths !== 1 ? "s" : ""}.` : null,
        appt.review_link ? `3D treatment plan review link shared with patient.` : null,
      ].filter(Boolean),
    });

    // 6b. Investigation Required — admin's chosen type(s) (or None), and
    // whichever files the patient has uploaded so far.
    const investigationTypes = js.investigation_types || [];
    const investigationFiles = js.investigation_files || {};
    const uploadTimestamps = Object.values(investigationFiles).map((f) => f?.uploadedAt).filter(Boolean);
    const investigationAt = investigationTypes.includes("NONE")
      ? js.investigation_types_at || null
      : (uploadTimestamps.length > 0 ? uploadTimestamps.slice().sort().slice(-1)[0] : null);
    events.push({
      done: !!steps.investigation_required,
      title: "Investigation Required",
      by: "admin / patient",
      at: investigationAt,
      detail: investigationTypes.includes("NONE")
        ? ["No investigation required — marked by admin."]
        : investigationTypes.map((t) => {
            const label = INVESTIGATION_TYPES.find((it) => it.key === t)?.label || t;
            const file = investigationFiles[t];
            return file?.path ? `${label}: uploaded "${file.name}"${file.uploadedAt ? ` on ${fmt(file.uploadedAt)}` : ""}.` : `${label}: awaiting patient upload.`;
          }),
    });
  }

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

  if (!isNewModel) {
    // 8. Manufacturing started
    const mfgStartLog = findDoneLog("Manufacturing Started");
    events.push({
      done: !!steps.manufacturing_started,
      title: "Manufacturing Started",
      by: mfgStartLog?.actor_email ? `admin (${mfgStartLog.actor_email})` : "OrisAlign team",
      at: asDateTime(js.manufacturing_started_at) || mfgStartLog?.created_at || null,
      detail: manufacturingBatches.length > 0
        ? manufacturingBatches.map((b) =>
            `Package ${b.num} (${b.slot_label || (b.upper_aligners || b.lower_aligners ? `Upper ${b.upper_aligners || "—"}, Lower ${b.lower_aligners || "—"}` : `Aligners ${b.start}–${b.end}`)}): started ${b.mfg_started || "date not recorded"}${b.mfg_done ? `, completed ${b.mfg_done}` : ""}.`
          )
        : [],
    });

    // 9. Manufacturing completed
    const mfgDoneLog = findDoneLog("Manufacturing Completed");
    events.push({
      done: !!steps.manufacturing_completed,
      title: "Manufacturing Completed",
      by: mfgDoneLog?.actor_email ? `admin (${mfgDoneLog.actor_email})` : "OrisAlign team",
      at: asDateTime(js.manufacturing_completed_at) || mfgDoneLog?.created_at || null,
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
      at: js.aligners_dispatched_at || dispatchLog?.created_at || null,
      detail: logisticsBatches.length > 0
        ? logisticsBatches.map((b) => {
            const partner = b.delivery_partner === "Other" ? (b.delivery_partner_other || "courier") : b.delivery_partner;
            return `Batch ${b.num} dispatched via ${partner || "courier"}${b.shipment_id ? ` (Shipment ID: ${b.shipment_id})` : ""}${b.aligner_received ? `; received by patient on ${b.aligner_received}` : ""}.`;
          })
        : [],
    });

    // 11. Aligners received (by delivery partner)
    const rcvLog = findDoneLog("Aligners Received");
    events.push({
      done: !!steps.aligners_received,
      title: "Aligners Received by Local Delivery Partner",
      by: rcvLog?.actor_email ? `admin (${rcvLog.actor_email})` : "OrisAlign team",
      at: js.aligners_received_at || rcvLog?.created_at || null,
      detail: ["Aligners passed to the local delivery partner for last-mile delivery to the patient."],
    });
  } else {
    // 8-11 (new model). Manufacturing/Dispatch/Received collapse into one
    // per-month "Aligner Sets" step — each package's own mfg_started/mfg_done
    // dates are stamped by autoCreatePaidBatches the moment its payment
    // threshold is crossed (see lib/paymentHelper.ts).
    events.push({
      done: !!steps.aligner_sets,
      title: "Aligner Sets",
      by: "OrisAlign team",
      at: asDateTime(manufacturingBatches[0]?.mfg_started) || null,
      detail: manufacturingBatches.length > 0
        ? manufacturingBatches.map((b) =>
            `Package ${b.num} (${b.slot_label || `Upper ${b.upper_aligners || "—"}, Lower ${b.lower_aligners || "—"}`}): production started ${b.mfg_started || "date not recorded"}${b.mfg_done ? `, completed ${b.mfg_done}` : ""}${b.shipment_link ? `, tracking shared with patient` : ""}.`
          )
        : [],
    });
  }

  // 12. Follow-up appointment
  const followLog = findDoneLog("Appointment Book");
  events.push({
    done: !!steps.followup_appointment,
    title: "Follow-Up Appointment Booked",
    by: followLog?.actor_email ? `admin (${followLog.actor_email})` : "OrisAlign team",
    at: asDateTime(js.followup_appointment_at) || followLog?.created_at || null,
    detail: ["A follow-up clinic appointment was scheduled for progress review and any required adjustments."],
  });

  // 13. Aligners delivered
  const delivLog = findDoneLog("Aligners Delivered");
  events.push({
    done: !!steps.aligners_delivered,
    title: "Aligners Delivered to Patient",
    by: delivLog?.actor_email ? `admin (${delivLog.actor_email})` : "OrisAlign team",
    at: js.aligners_delivered_at || delivLog?.created_at || null,
    detail: [`The aligner package was successfully delivered to ${appt.name || "the patient"} at their address.`],
  });

  // 14. Smile correction
  const smileLog = findDoneLog("Smile Correction Started");
  events.push({
    done: !!steps.smile_correction,
    title: "Smile Correction Phase Started",
    by: smileLog?.actor_email ? `admin (${smileLog.actor_email})` : "OrisAlign team",
    at: js.smile_correction_at || smileLog?.created_at || null,
    detail: [`${appt.name || "The patient"} began wearing their aligners. Active treatment is now in progress.`],
  });

  // 15. Treatment completed
  const completeLog = findDoneLog("Treatment Completed");
  events.push({
    done: !!steps.treatment_completed,
    title: "Treatment Completed",
    by: completeLog?.actor_email ? `admin (${completeLog.actor_email})` : "OrisAlign team",
    at: js.treatment_completed_at || completeLog?.created_at || null,
    detail: [`The OrisAlign aligner treatment for ${appt.name || "the patient"} has been successfully completed.`],
  });

  // 16. Feedback — actually logged as a plain "Feedback Submitted" action
  // (see toggle()), not the generic "Step Marked Done: ..." pattern.
  const feedbackLog = logs.find((l) => l.action === "Feedback Submitted") || findDoneLog("Feedback Submitted");
  events.push({
    done: !!steps.feedback_submitted,
    title: "Feedback Submitted",
    by: feedbackLog?.actor_email ? `admin (${feedbackLog.actor_email})` : "patient",
    at: js.feedback_submitted_at || feedbackLog?.created_at || null,
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

// ─── Lifetime Membership Card Tab ──────────────────────────────────────────────
function emptyLmcPerson() {
  return { name: "", dob: "", address: "" };
}

function LMCTab({ appointmentId, initialData, actor }) {
  const data = initialData || {};
  const [active, setActive] = useState(!!data.active);
  const [cardholder, setCardholder] = useState(data.cardholder || emptyLmcPerson());
  const [plusOne, setPlusOne] = useState(data.plus_one || emptyLmcPerson());
  const [images, setImages] = useState(data.images || []);
  const [treatments, setTreatments] = useState(data.treatments || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [saved, setSaved] = useState(false);

  const persist = async (patch, { silent } = {}) => {
    const payload = {
      active,
      cardholder,
      plus_one: plusOne,
      images,
      treatments,
      ...patch,
    };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ lmc_active: payload.active, lmc_data: payload })
      .eq("id", appointmentId);
    if (error) { alert("Failed to save: " + error.message); return false; }
    if (!silent) logAudit({ appointmentId, actor, action: "Lifetime Membership Card Updated", entity: "lmc_data", newData: payload });
    return true;
  };

  const activate = async () => {
    if (!window.confirm("Activate the Lifetime Membership Card for this patient?")) return;
    setActivating(true);
    const ok = await persist({ active: true });
    setActivating(false);
    if (ok) {
      setActive(true);
      logAudit({ appointmentId, actor, action: "Lifetime Membership Card Activated", entity: "lmc_active", newData: { active: true } });
    }
  };

  const deactivate = async () => {
    if (!window.confirm("Deactivate this patient's Lifetime Membership Card? Their saved details will be kept.")) return;
    setActivating(true);
    const ok = await persist({ active: false });
    setActivating(false);
    if (ok) {
      setActive(false);
      logAudit({ appointmentId, actor, action: "Lifetime Membership Card Deactivated", entity: "lmc_active", newData: { active: false } });
    }
  };

  const saveDetails = async () => {
    setSaving(true);
    const ok = await persist({});
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `lmc/${appointmentId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from("patient-docs").upload(path, file, { upsert: true });
    if (uploadError) { setUploading(false); alert("Failed to upload image: " + uploadError.message); return; }
    const { data: { publicUrl } } = supabase.storage.from("patient-docs").getPublicUrl(path);
    const newImages = [...images, publicUrl];
    setImages(newImages);
    await persist({ images: newImages }, { silent: true });
    setUploading(false);
  };

  const removeImage = async (url) => {
    const newImages = images.filter((i) => i !== url);
    setImages(newImages);
    await persist({ images: newImages }, { silent: true });
  };

  const addTreatment = () => {
    setTreatments((prev) => [...prev, { type: LMC_TREATMENT_TYPES[0], start: "", end: "", amount: "" }]);
  };

  const updateTreatment = (idx, field, value) => {
    setTreatments((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const removeTreatment = (idx) => {
    setTreatments((prev) => prev.filter((_, i) => i !== idx));
  };

  const personFields = (person, setPerson) => (
    <div style={row}>
      <div>
        <span style={label}>NAME</span>
        <input style={input} value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} />
      </div>
      <div>
        <span style={label}>DATE OF BIRTH</span>
        <input style={input} type="date" value={person.dob} onChange={(e) => setPerson({ ...person, dob: e.target.value })} />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <span style={label}>ADDRESS</span>
        <textarea style={{ ...input, minHeight: "56px", resize: "vertical" }} value={person.address} onChange={(e) => setPerson({ ...person, address: e.target.value })} />
      </div>
    </div>
  );

  if (!active) {
    return (
      <div style={card}>
        <h3 style={{ margin: "0 0 8px", fontSize: "16px", color: "#111827" }}>Lifetime Membership Card</h3>
        <p style={{ margin: "0 0 18px", fontSize: "13px", color: "#9ca3af" }}>
          This patient does not currently have a Lifetime Membership Card. Turn it on once the card has actually been
          issued to them.
        </p>
        <button style={btnGold} onClick={activate} disabled={activating}>
          {activating ? "Activating..." : "Turn ON — Lifetime Membership Card Issued"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "16px", color: "#111827" }}>Lifetime Membership Card</h3>
            <span style={{ fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "99px", background: "#dcfce7", color: "#16a34a", letterSpacing: "0.5px" }}>ACTIVE ✓</span>
          </div>
          <button
            onClick={deactivate}
            disabled={activating}
            style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
          >
            Turn Off
          </button>
        </div>
      </div>

      <div style={card}>
        <h4 style={{ margin: "0 0 14px", fontSize: "14px", color: "#111827" }}>Cardholder Details</h4>
        {personFields(cardholder, setCardholder)}

        <h4 style={{ margin: "20px 0 14px", fontSize: "14px", color: "#111827" }}>Plus One Details</h4>
        {personFields(plusOne, setPlusOne)}
      </div>

      <div style={card}>
        <h4 style={{ margin: "0 0 14px", fontSize: "14px", color: "#111827" }}>Card Images</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
          {images.map((url) => (
            <div key={url} style={{ position: "relative", width: "120px", height: "80px", borderRadius: "10px", overflow: "hidden", border: "1px solid #e5e7eb" }}>
              <img src={url} alt="LMC" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button
                onClick={() => removeImage(url)}
                style={{ position: "absolute", top: "4px", right: "4px", width: "22px", height: "22px", borderRadius: "50%", border: "none", background: "rgba(220,38,38,0.9)", color: "white", fontWeight: "800", fontSize: "12px", cursor: "pointer", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <label style={{ display: "inline-block", padding: "10px 18px", borderRadius: "10px", border: "1px dashed #b8905a", color: "#b8905a", fontWeight: "700", fontSize: "13px", cursor: uploading ? "not-allowed" : "pointer" }}>
          {uploading ? "Uploading..." : "+ Upload Image"}
          <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading} onChange={(e) => uploadImage(e.target.files?.[0])} />
        </label>
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h4 style={{ margin: 0, fontSize: "14px", color: "#111827" }}>Treatments Undergone</h4>
          <button onClick={addTreatment} style={{ padding: "8px 16px", borderRadius: "10px", border: "none", background: "#111827", color: "white", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>
            + Add Treatment
          </button>
        </div>

        {treatments.length === 0 ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>No treatments recorded yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {treatments.map((t, idx) => (
              <div key={idx} style={{ padding: "14px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <select style={{ ...select, width: "auto" }} value={t.type} onChange={(e) => updateTreatment(idx, "type", e.target.value)}>
                    {LMC_TREATMENT_TYPES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <button onClick={() => removeTreatment(idx)} style={{ background: "none", border: "none", color: "#dc2626", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>
                    Remove
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div>
                    <span style={label}>START DATE</span>
                    <input style={input} type="date" value={t.start} onChange={(e) => updateTreatment(idx, "start", e.target.value)} />
                  </div>
                  <div>
                    <span style={label}>END DATE</span>
                    <input style={input} type="date" value={t.end} onChange={(e) => updateTreatment(idx, "end", e.target.value)} />
                  </div>
                  <div>
                    <span style={label}>AMOUNT PAID (₹)</span>
                    <input style={input} type="number" placeholder="0" value={t.amount} onChange={(e) => updateTreatment(idx, "amount", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button style={saved ? { ...btnPrimary, background: "#16a34a" } : btnGold} onClick={saveDetails} disabled={saving}>
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save LMC Details"}
      </button>
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

      {/* Tab Pills — Manufacturing/Logistics only apply once the appointment is confirmed,
          and only for legacy (lump-sum) patients — new-model patients manage
          production/dispatch per package directly in the Journey tab instead. */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {TABS.filter((tab) => tab !== "Manufacturing" || (!appt.monthly_plan && appt.provisional_min_months == null && appt.provisional_max_months == null && (appt.status === "confirmed" || appt.status === "completed"))).map((tab) => (
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
      <div style={{ display: activeTab === "LMC" ? "block" : "none" }}>
        <LMCTab appointmentId={id} initialData={appt.lmc_data || null} actor={actor} />
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
