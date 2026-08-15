"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { FINAL_PLAN_FEE, estimateRange, applyCouponDiscount, totalCost, monthSlotLabels } from "@/lib/monthlyPlan";

const supabase = getSupabaseClient();

const PROVISIONAL_PLAN_NOTE = "Your tooth will be rotated to required degree. Alignment will be corrected. Spaces will be gained. Your plan might involve IPR and buttons.";

// Same set count applies to both plans — only wear duration differs
// (OrisPro: 15 days/set, OrisPro Plus: 10 days/set).
function provisionalDurationText(sets, daysPerSet) {
  const n = parseInt(sets, 10);
  if (!n || n <= 0) return "—";
  const days = n * daysPerSet;
  const months = Math.round((days / 30) * 10) / 10;
  return `${days} days (~${months} months)`;
}

// Kept in sync with PLAN_OPTIONS in app/(dashboard)/patients/[id]/page.js
// (the admin Payment tab) — the patient picks between these two here.
const PLAN_OPTIONS = [
  { value: "ORISPRO", label: "OrisPro", pricePerSet: 3499, downPayment: 12499 },
  { value: "ORISPLUS", label: "OrisPro Plus", pricePerSet: 4499, downPayment: 15499 },
];

// Old lump-sum model (OrisPro/OrisPro Plus, one upfront payment) — unchanged,
// still used for any patient already in progress under it.
const LEGACY_JOURNEY_STEPS = [
  { key: "booked",                  label: "Appointment Booked" },
  { key: "confirmed",               label: "Appointment Confirmed" },
  { key: "scanning_done",           label: "Scanning and Provisional Planning", expandable: true },
  { key: "payment_done",            label: "Plan and Payment",            expandable: true },
  { key: "prealigner_treatment",    label: "Prealigner Treatment",        expandable: true },
  { key: "planning_done",           label: "Full Plan", expandable: true },
  { key: "plan_approved",           label: "Plan Approval", approveAction: true },
  { key: "manufacturing",           label: "Manufacturing",               expandable: true },
  { key: "aligners_dispatched",     label: "Aligners Dispatched", expandable: true },
  { key: "aligners_received",       label: "Aligners Received", expandable: true },
  { key: "followup_appointment",    label: "Appointment Book" },
  { key: "aligners_delivered",      label: "Aligners Delivered" },
  { key: "smile_correction",        label: "Smile Correction Started",   smileLink: true },
  { key: "treatment_completed",     label: "Treatment Completed" },
  { key: "feedback_submitted",      label: "Feedback Form Submitted",    expandable: true },
];

// New per-arch, month-by-month model — used once the orthodontist has
// entered final upper/lower sets (appt.monthly_plan present). The old
// separate "Plan and Payment"/"Full Plan"/"Final Plan Review" steps merge
// into one "Full Plan" step (pay ₹999, then — in the same step, once paid —
// review the aligner plan and total treatment duration). Manufacturing /
// Aligners Dispatched / Aligners Received collapse into one "Aligner Sets"
// step, one row per month.
const NEW_JOURNEY_STEPS = [
  { key: "booked",                  label: "Appointment Booked" },
  { key: "confirmed",               label: "Appointment Confirmed" },
  { key: "scanning_done",           label: "Scanning and Provisional Planning", expandable: true },
  { key: "payment_done",            label: "Full Plan",                   expandable: true },
  { key: "plan_approved",           label: "Plan Approval", approveAction: true },
  { key: "prealigner_treatment",    label: "Prealigner Treatment",        expandable: true },
  { key: "aligner_sets",            label: "Aligner Sets",                expandable: true },
  { key: "followup_appointment",    label: "Appointment Book" },
  { key: "aligners_delivered",      label: "Aligners Delivered" },
  { key: "smile_correction",        label: "Smile Correction Started",   smileLink: true },
  { key: "treatment_completed",     label: "Treatment Completed" },
  { key: "feedback_submitted",      label: "Feedback Form Submitted",    expandable: true },
];

// All pre-aligner procedures the dentist selected on the Patient Form
// ("Restorations", "Extraction", "Scaling", etc. — see PROCEDURE_OPTIONS in
// app/(dashboard)/dentist/[id]/appointment/page.js), expanded to include a
// readable "Others: <text>" entry when "Others" was selected.
function prealignerProcedures(appt) {
  const pfd = appt?.patient_form_data || {};
  const procs = [...(pfd.pre_orthodontic_procedures || [])];
  return procs.map((p) => (p === "Others" && pfd.pre_orthodontic_others ? `Others: ${pfd.pre_orthodontic_others}` : p));
}

function deriveSteps(appt) {
  if (!appt) return {};
  const js = appt.journey_steps || {};
  const procs = prealignerProcedures(appt);
  const prealignerDone = js.prealigner_done || {};
  const hasMonthlyPlan = !!appt.monthly_plan;
  const amountPaid = Number(appt.amount_paid) || 0;

  const base = {
    booked:                  true,
    confirmed:               appt.status === "confirmed" || appt.status === "completed",
    scanning_done:           js.scanning_done        !== undefined ? !!js.scanning_done        : !!appt.stl_submitted,
    payment_done:            hasMonthlyPlan
      ? amountPaid >= FINAL_PLAN_FEE
      : (js.payment_done !== undefined ? !!js.payment_done : !!(appt.payment_data?.final_amount)),
    // No pre-aligner procedures selected → nothing to wait on, counts as done.
    prealigner_treatment:    procs.length === 0 ? true : procs.every((p) => !!prealignerDone[p]),
    planning_done:           js.planning_done        !== undefined ? !!js.planning_done        : !!appt.provisional_plan_submitted,
    final_plan_review:       !!(appt.final_upper_sets && appt.final_lower_sets),
    plan_approved:           js.plan_approved        !== undefined ? !!js.plan_approved        : !!(appt.final_plan && appt.final_plan.trim()),
    followup_appointment:    !!js.followup_appointment,
    aligners_delivered:      !!js.aligners_delivered,
    smile_correction:        !!js.smile_correction,
    treatment_completed:     js.treatment_completed  !== undefined ? !!js.treatment_completed  : appt.status === "completed",
    feedback_submitted:      !!js.feedback_submitted,
  };

  if (hasMonthlyPlan) {
    const couponsTotal = (appt.payment_data?.applied_coupons || [])
      .reduce((sum, c) => sum + (parseFloat(c.discount) || 0), 0);
    const discounted = applyCouponDiscount(appt.monthly_plan, couponsTotal);
    base.aligner_sets = amountPaid >= totalCost(discounted);
  } else {
    // Manufacturing counts as "done" (green, roadmap moves on) once fully
    // completed — Started/Ended are shown separately inside its own panel.
    base.manufacturing =       !!js.manufacturing_completed;
    base.aligners_dispatched = !!js.aligners_dispatched;
    base.aligners_received =   !!js.aligners_received;
  }

  return base;
}

function fmt(n) {
  if (!n && n !== 0) return "N/A";
  return `₹ ${parseFloat(n).toLocaleString("en-IN")}`;
}

function ReportRow({ label, value, last }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "6px 0", borderBottom: last ? "none" : "1px dashed #e5e7eb" }}>
      <span style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function PatientJourney() {
  const { id } = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [selectedPackages, setSelectedPackages] = useState([]); // unpaid package nums chosen to order together
  const [approving, setApproving] = useState(false);
  const [copiedNum, setCopiedNum] = useState(null);
  const [receivingBatch, setReceivingBatch] = useState(null);
  const [markingProcedureDone, setMarkingProcedureDone] = useState(null);
  const [paymentMode, setPaymentMode] = useState("down"); // "down" or "full"
  const [appliedCoupons, setAppliedCoupons] = useState([]); // Array of {code, discount}
  const [couponInput, setCouponInput] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [payNowLoading, setPayNowLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("ORISPRO"); // "ORISPRO" or "ORISPLUS"
  const [switchingPlan, setSwitchingPlan] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("appointments_booking")
        .select("*")
        .eq("id", id)
        .single();
      setPatient(data || null);
      // Coupons the patient already applied live on the row itself, not just
      // in memory — otherwise closing/reopening the page (or the discount
      // just not surviving a re-render) silently dropped the discount and
      // made them re-enter the same code.
      setAppliedCoupons(data?.payment_data?.applied_coupons || []);
      setSelectedPlan(data?.payment_data?.plan || "ORISPRO");
      setLoading(false);
    };
    load();
  }, [id]);

  // Once applied, a coupon is saved onto the appointment immediately —
  // permanent for this patient ID, and checked against that saved list (not
  // just what's in memory) so the same code can't be applied a second time
  // even across a reload.
  const applyCoupon = async () => {
    if (!couponInput.trim()) {
      setCouponMessage("Please enter a coupon code.");
      return;
    }

    setApplyingCoupon(true);
    setCouponMessage("");

    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponInput.trim().toUpperCase())
        .eq("is_active", true)
        .single();

      if (error || !data) {
        setCouponMessage("No valid coupon found with this code.");
        setApplyingCoupon(false);
        return;
      }

      const discountAmount = parseFloat(data.discount_amount) || 0;
      if (discountAmount <= 0) {
        setCouponMessage("This coupon has no discount available.");
        setApplyingCoupon(false);
        return;
      }

      if (appliedCoupons.find((c) => c.code === data.code)) {
        setCouponMessage("This coupon has already been used on this patient ID.");
        setApplyingCoupon(false);
        return;
      }

      const updatedCoupons = [...appliedCoupons, { code: data.code, discount: discountAmount }];
      const newPaymentData = { ...(patient?.payment_data || {}), applied_coupons: updatedCoupons };
      const { error: saveError } = await supabase
        .from("appointments_booking")
        .update({ payment_data: newPaymentData })
        .eq("id", id);
      if (saveError) {
        setCouponMessage("Couldn't save the coupon. Please try again.");
        setApplyingCoupon(false);
        return;
      }

      setAppliedCoupons(updatedCoupons);
      setPatient((prev) => prev && { ...prev, payment_data: newPaymentData });
      setCouponMessage(`✓ Coupon "${data.code}" applied! Discount: ${fmt(discountAmount)}`);
      setCouponInput("");
    } catch (err) {
      setCouponMessage("Error validating coupon. Please try again.");
    } finally {
      setApplyingCoupon(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <p style={{ color: "#6b7280" }}>Loading your journey...</p>
    </div>
  );

  if (!patient) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: "12px" }}>
      <p style={{ color: "#dc2626", fontWeight: "600" }}>Appointment not found.</p>
      <p style={{ color: "#6b7280", fontSize: "14px" }}>Please check your Patient ID.</p>
    </div>
  );

  const steps = deriveSteps(patient);
  const journeySteps = patient.monthly_plan ? NEW_JOURNEY_STEPS : LEGACY_JOURNEY_STEPS;
  const shortId = id.substring(0, 8).toUpperCase();
  const patientIdLabel = patient.booking_confirmed ? shortId : "Pending";
  // Filtered against the active roadmap's own keys — `steps` always carries
  // a couple of extra keys from the model not in use (see deriveSteps).
  const completedCount = journeySteps.filter((s) => steps[s.key]).length;
  const progressPct = Math.round((completedCount / journeySteps.length) * 100);
  const pd = patient.payment_data || {};
  const couponsTotalForMonths = appliedCoupons.reduce((sum, c) => sum + (parseFloat(c.discount) || 0), 0);
  const discountedMonthlyPlan = patient.monthly_plan ? applyCouponDiscount(patient.monthly_plan, couponsTotalForMonths) : null;

  // Number of sets is the same regardless of plan (set by the orthodontist
  // in Provisional Planning, or later confirmed in the Aligner Plan) — only
  // price-per-set and down payment differ between OrisPro and OrisPro Plus.
  const sets = patient.aligner_total_sets || patient.provisional_sets_orispro || 0;
  const activePlanInfo = PLAN_OPTIONS.find((p) => p.value === selectedPlan) || PLAN_OPTIONS[0];
  const discountAmt = parseFloat(pd.discount) || 0;
  const couponsTotal = appliedCoupons.reduce((sum, c) => sum + (parseFloat(c.discount) || 0), 0);
  const planGrossAmt = sets * activePlanInfo.pricePerSet;
  const planFinalAmt = Math.max(0, planGrossAmt - discountAmt - couponsTotal);
  const planDownAmt = activePlanInfo.downPayment;

  // Patient's own plan choice — persisted immediately so the admin's
  // Payment tab and this page always agree on which plan (and therefore
  // which amounts) are current.
  const selectPlan = async (value) => {
    if (value === selectedPlan || switchingPlan) return;
    setSwitchingPlan(true);
    const info = PLAN_OPTIONS.find((p) => p.value === value);
    const gross = sets * info.pricePerSet;
    const final = Math.max(0, gross - discountAmt - couponsTotal);
    const newPaymentData = {
      ...pd,
      plan: value,
      price_per_set: info.pricePerSet,
      full_amount: gross,
      final_amount: final,
      down_payment: info.downPayment,
    };
    const { error } = await supabase
      .from("appointments_booking")
      .update({ payment_data: newPaymentData })
      .eq("id", id);
    setSwitchingPlan(false);
    if (error) { alert("Couldn't switch plan: " + error.message); return; }
    setSelectedPlan(value);
    setPatient((prev) => prev && { ...prev, payment_data: newPaymentData });
  };

  const isPlanApprovalReady =
    steps.booked && steps.confirmed && steps.scanning_done &&
    steps.payment_done && steps.planning_done &&
    (!patient.monthly_plan || steps.final_plan_review);

  const handleApprovePlan = async () => {
    const confirmed = window.confirm(
      "By clicking OK, you confirm that you have reviewed your 3D treatment plan and legally authorise Orisalign Private Limited to commence fabrication of your aligners."
    );
    if (!confirmed) return;
    setApproving(true);
    try {
      const res = await fetch("/api/approve-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: id }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Thank you for approving your treatment planning.");
        window.location.reload();
      } else {
        alert("Failed to approve plan: " + (json.error || "Unknown error"));
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  const handleStepClick = (step) => {
    if (step.smileLink) {
      if (!steps.smile_correction) return; // only accessible when admin marks it done
      router.push(`/patient/${id}/smile`);
      return;
    }
    if (step.expandable) { setExpandedStep(expandedStep === step.key ? null : step.key); }
  };

  // Whatever amount is shown on screen (after admin discount + any coupons
  // the patient applied) must be exactly what the gateway charges. The
  // gateway only trusts payment_type_to_collect/payment_data on the server,
  // so we push the displayed amount there as a custom amount before
  // redirecting — otherwise the server falls back to the stale, undiscounted
  // down_payment/full_amount and overcharges.
  const handlePayNow = async (amount) => {
    setPayNowLoading(true);
    try {
      const res = await fetch("/api/set-payment-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, paymentType: "others", customAmount: amount }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert("Couldn't start payment: " + (j.error || "Please try again."));
        return;
      }
      router.push(`/checkout?id=${id}&amount=${amount}`);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setPayNowLoading(false);
    }
  };

  const handleCopyShipmentId = async (num, shipmentId) => {
    try {
      await navigator.clipboard.writeText(shipmentId);
      setCopiedNum(num);
      setTimeout(() => setCopiedNum(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  // Patient confirms they've collected a specific batch — records the
  // receipt and triggers both the thank-you email and the team notification
  // server-side (see /api/notify-batch-received).
  const handleMarkReceived = async (num) => {
    setReceivingBatch(num);
    try {
      const res = await fetch("/api/notify-batch-received", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, batchNum: num }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert("Couldn't record this: " + (json.error || "Please try again."));
        return;
      }
      setPatient((prev) => {
        if (!prev) return prev;
        const batches = (prev.manufacturing_data?.batches || []).map((b) =>
          b.num === num ? { ...b, aligner_received: json.aligner_received } : b
        );
        return { ...prev, manufacturing_data: { ...prev.manufacturing_data, batches } };
      });
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setReceivingBatch(null);
    }
  };

  // Patient marks one of the dentist-selected prealigner procedures as
  // done themselves — recorded with a timestamp, one entry per procedure,
  // never overwritten once set.
  const markPrealignerDone = async (procName) => {
    if (patient?.journey_steps?.prealigner_done?.[procName]) return;
    setMarkingProcedureDone(procName);
    try {
      const newDone = { ...(patient?.journey_steps?.prealigner_done || {}), [procName]: new Date().toISOString() };
      const newJourneySteps = { ...(patient?.journey_steps || {}), prealigner_done: newDone };
      const { error } = await supabase
        .from("appointments_booking")
        .update({ journey_steps: newJourneySteps })
        .eq("id", id);
      if (error) { alert("Failed to record: " + error.message); return; }
      setPatient((prev) => prev && { ...prev, journey_steps: newJourneySteps });
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setMarkingProcedureDone(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: "60px", fontFamily: "'Inter', system-ui, sans-serif", colorScheme: "light" }}>

      {/* HEADER */}
      <div style={{ background: "white", padding: "28px 20px 36px", textAlign: "center", borderBottom: "3px solid #C9A84C", boxShadow: "0 2px 16px rgba(201,168,76,0.10)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
          <Image src="/logo.png" alt="OrisAlign" width={160} height={54} />
        </div>
        <h1 style={{ fontSize: "clamp(20px, 5vw, 26px)", fontWeight: "900", margin: "0 0 6px", color: "#1B2A4A" }}>
          Your Smile Journey
        </h1>
        <p style={{ fontSize: "13px", color: "#b8905a", margin: "0 0 12px", fontWeight: "500" }}>Track every step of your treatment</p>
        <div style={{ display: "flex", justifyContent: "center", gap: "16px", fontSize: "12px", color: "#9ca3af", fontWeight: "600" }}>
          <span>🦷 Expert Care</span>
          <span>📍 Bhubaneswar</span>
          <span>🇮🇳 Made in India</span>
        </div>
      </div>

      <div style={{ maxWidth: "520px", margin: "0 auto", padding: "0 16px" }}>

        {/* PATIENT INFO CARD */}
        <div style={{ background: "white", borderRadius: "20px", padding: "24px", marginTop: "-20px", boxShadow: "0 10px 40px rgba(0,0,0,0.10)", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "linear-gradient(135deg, #b8905a, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "20px", flexShrink: 0 }}>
              {(patient.name || "P")[0].toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>{patient.name || "Patient"}</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                {patient.age ? `${patient.age} yrs` : ""}{patient.sex ? ` • ${patient.sex}` : ""}
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {[["Patient ID", patientIdLabel], ["Phone", patient.phone || "N/A"], ["Date", patient.date || "N/A"], ["Time", patient.time || "N/A"]].map(([lbl, val]) => (
              <div key={lbl} style={{ background: "#f8f7f5", borderRadius: "10px", padding: "10px 12px" }}>
                <p style={{ margin: 0, fontSize: "10px", color: "#9ca3af", fontWeight: "700", letterSpacing: "0.6px", textTransform: "uppercase" }}>{lbl}</p>
                <p style={{ margin: "2px 0 0", fontSize: "14px", fontWeight: "600", color: "#111827" }}>{val}</p>
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Overall Progress</span>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#22c55e" }}>{progressPct}%</span>
            </div>
            <div style={{ height: "8px", borderRadius: "99px", background: "#e5e7eb", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: "99px", width: `${progressPct}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)", transition: "width 1s ease" }} />
            </div>
            <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#9ca3af" }}>{completedCount} of {journeySteps.length} steps completed</p>
          </div>
        </div>

        {/* ROADMAP */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "900", color: "#1B2A4A", margin: "0 0 4px", letterSpacing: "-0.3px" }}>Treatment Roadmap</h3>
          <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>Your progress, step by step</p>
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "22px", top: "22px", bottom: "22px", width: "2px", background: "linear-gradient(180deg, #22c55e 0%, #e5e7eb 60%)", zIndex: 0 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {journeySteps.map((step, index) => {
              const done = steps[step.key];
              const isNext = !done && index > 0 && steps[journeySteps[index - 1]?.key];
              const isClickable = step.expandable || (step.smileLink && steps[step.key]);
              const isExpanded = expandedStep === step.key;

              return (
                <div key={step.key} style={{ marginBottom: "10px", position: "relative", zIndex: 1 }}>
                  <div
                    onClick={() => isClickable && handleStepClick(step)}
                    style={{ display: "flex", alignItems: "flex-start", gap: "14px", cursor: isClickable ? "pointer" : "default" }}
                  >
                    {/* Circle */}
                    <div style={{ width: "44px", height: "44px", borderRadius: "10px", flexShrink: 0, background: done ? "linear-gradient(135deg, #22c55e, #16a34a)" : isNext ? "linear-gradient(135deg, #f59e0b, #b8905a)" : "white", border: done ? "none" : isNext ? "none" : "2px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: done ? "0 4px 12px rgba(34,197,94,0.3)" : isNext ? "0 4px 12px rgba(245,158,11,0.3)" : "0 2px 6px rgba(0,0,0,0.06)" }}>
                      {done ? <span style={{ color: "white", fontSize: "18px", fontWeight: "700" }}>✓</span> : <span style={{ color: isNext ? "white" : "#d1d5db", fontSize: "13px", fontWeight: "700" }}>{index + 1}</span>}
                    </div>

                    {/* Box */}
                    <div style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", background: done ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : isNext ? "linear-gradient(135deg, #fffbeb, #fef3c7)" : "white", border: `1px solid ${done ? "#bbf7d0" : isNext ? "#fde68a" : "#e5e7eb"}`, boxShadow: done ? "0 2px 8px rgba(34,197,94,0.12)" : "0 2px 6px rgba(0,0,0,0.04)", marginTop: "2px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: "14px", fontWeight: done ? "700" : "500", color: done ? "#15803d" : isNext ? "#92400e" : "#9ca3af" }}>
                            {step.label}
                          </p>
                          {step.key === "plan_approved" && done && (
                            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#16a34a", lineHeight: "1.4" }}>
                              Thank you for approving your treatment plan.
                            </p>
                          )}
                          {step.key === "manufacturing" && !done && patient.journey_steps?.manufacturing_started && patient.journey_steps?.manufacturing_started_at && (() => {
                            const startedBatches = (patient.manufacturing_data?.batches || []).filter((b) => b.mfg_started).map((b) => b.num);
                            return (
                              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#b8905a", lineHeight: "1.4" }}>
                                {startedBatches.length > 0 ? `Batch ${startedBatches.join(", ")} — ` : ""}
                                Started on {new Date(patient.journey_steps.manufacturing_started_at + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            );
                          })()}
                          {step.key === "manufacturing" && done && patient.journey_steps?.manufacturing_completed_at && (() => {
                            const doneBatches = (patient.manufacturing_data?.batches || []).filter((b) => b.mfg_done).map((b) => b.num);
                            return (
                              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#16a34a", lineHeight: "1.4" }}>
                                {doneBatches.length > 0 ? `Batch ${doneBatches.join(", ")} — ` : ""}
                                Completed on {new Date(patient.journey_steps.manufacturing_completed_at + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            );
                          })()}
                          {step.subtext && (
                            <p style={{ margin: "2px 0 0", fontSize: "11px", color: done ? "#16a34a" : "#9ca3af", lineHeight: "1.4" }}>
                              {step.subtext}
                            </p>
                          )}
                        </div>
                        {step.approveAction && (
                          patient.plan_approved ? (
                            <span style={{ flexShrink: 0, padding: "4px 10px", borderRadius: "99px", background: "#dcfce7", color: "#16a34a", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap" }}>
                              ✓ Approved
                            </span>
                          ) : isPlanApprovalReady ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApprovePlan(); }}
                              disabled={approving}
                              style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "8px", border: "none", background: approving ? "#d4a574" : "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: approving ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                            >
                              {approving ? "Approving..." : "Approve Plan"}
                            </button>
                          ) : (
                            <button
                              disabled
                              style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "8px", border: "none", background: "#e5e7eb", color: "#9ca3af", fontWeight: "700", fontSize: "12px", cursor: "not-allowed", whiteSpace: "nowrap" }}
                            >
                              Approve Plan
                            </button>
                          )
                        )}
                        {step.key === "booked" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/patient/${id}/details`); }}
                            style={{ flexShrink: 0, padding: patient.age ? "4px 10px" : "7px 14px", borderRadius: "8px", border: "none", background: patient.age ? "#dcfce7" : "#b8905a", color: patient.age ? "#16a34a" : "white", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            {patient.age ? "✓ Details Filled" : "Fill Your Details"}
                          </button>
                        )}
                        {step.key === "scanning_done" && patient.scanning_review_link && (
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(patient.scanning_review_link, "_blank", "noopener,noreferrer"); }}
                            style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "8px", border: "none", background: "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            Review
                          </button>
                        )}
                        {isClickable && !step.approveAction && <span style={{ fontSize: "12px", color: done ? "#16a34a" : "#9ca3af", flexShrink: 0, marginLeft: "8px" }}>{isExpanded ? "▲" : "▼"}</span>}
                      </div>
                    </div>
                  </div>


                  {/* Expanded Panel — Scanning and Provisional Planning */}
                  {step.key === "scanning_done" && isExpanded && (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      {/* Same number of sets for both plans — only the wear duration differs */}
                      {patient?.provisional_sets_orispro && (
                        <div style={{ padding: "10px 12px", background: "#f3f4f6", borderRadius: "8px", marginBottom: "12px" }}>
                          <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase" }}>{patient.provisional_sets_orispro} Sets Required</p>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <div style={{ flex: 1, padding: "8px 10px", background: "#ede9fe", borderRadius: "6px" }}>
                              <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "700", color: "#6d28d9", textTransform: "uppercase" }}>OrisPro</p>
                              <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#4c1d95" }}>{provisionalDurationText(patient.provisional_sets_orispro, 15)}</p>
                            </div>
                            <div style={{ flex: 1, padding: "8px 10px", background: "#ede9fe", borderRadius: "6px" }}>
                              <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "700", color: "#6d28d9", textTransform: "uppercase" }}>OrisPro Plus</p>
                              <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#4c1d95" }}>{provisionalDurationText(patient.provisional_sets_orispro, 10)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {patient?.provisional_min_months && patient?.provisional_max_months && (() => {
                        const r = estimateRange(patient.provisional_min_months, patient.provisional_max_months);
                        return (
                          <div style={{ padding: "10px 12px", background: "#f3f4f6", borderRadius: "8px", marginBottom: "12px" }}>
                            <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase" }}>Estimated Duration</p>
                            <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>
                              {patient.provisional_min_months}–{patient.provisional_max_months} months · {fmt(r.min)} – {fmt(r.max)}
                            </p>
                          </div>
                        );
                      })()}

                      <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Your Provisional Plan</p>
                      {patient.provisional_plan ? (
                        <p style={{ margin: 0, fontSize: "14px", color: "#111827", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{patient.provisional_plan}</p>
                      ) : (
                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Your treatment plan is being prepared. Please check back soon.</p>
                      )}
                      {patient.scanning_video_url && (
                        <div style={{ marginTop: "14px" }}>
                          <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Provisional Planning Video</p>
                          <video controls src={patient.scanning_video_url} style={{ width: "100%", borderRadius: "10px", background: "#000" }} />
                          <a
                            href={`${patient.scanning_video_url}${patient.scanning_video_url.includes("?") ? "&" : "?"}download=`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ marginTop: "10px", display: "block", padding: "12px", borderRadius: "10px", background: "#f3f4f6", color: "#374151", fontWeight: "700", fontSize: "13px", textAlign: "center", textDecoration: "none" }}
                          >
                            ⬇ Download Video
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expanded Panel — Prealigner Treatment */}
                  {step.key === "prealigner_treatment" && isExpanded && (() => {
                    const procs = prealignerProcedures(patient);
                    const doneMap = patient.journey_steps?.prealigner_done || {};
                    return (
                      <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                        <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Prealigner Treatment</p>
                        {procs.length === 0 ? (
                          <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>No prealigner treatment needed — your dentist didn't flag any procedures.</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {procs.map((proc) => {
                              const doneAt = doneMap[proc];
                              return (
                                <div key={proc} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: doneAt ? "#f0fdf4" : "#f8f7f5", borderRadius: "8px", border: doneAt ? "1px solid #bbf7d0" : "1px solid transparent" }}>
                                  <div>
                                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{proc}</span>
                                    {doneAt && (
                                      <span style={{ display: "block", fontSize: "11px", color: "#16a34a", marginTop: "2px" }}>
                                        Done on {new Date(doneAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                      </span>
                                    )}
                                  </div>
                                  {doneAt ? (
                                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>✓ Done</span>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); markPrealignerDone(proc); }}
                                      disabled={markingProcedureDone === proc}
                                      style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: markingProcedureDone === proc ? "#d4a574" : "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: markingProcedureDone === proc ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                                    >
                                      {markingProcedureDone === proc ? "Saving..." : "Mark as Done"}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Expanded Panel — Planning Done */}
                  {step.key === "planning_done" && isExpanded && (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Your Aligner Plan</p>
                      {patient.aligner_total_sets && patient.aligner_days_per_set ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {[
                            ["Total Number of Sets", patient.aligner_total_sets],
                            ["Wear Duration per Set", `${patient.aligner_days_per_set} days`],
                            ["Total Treatment Duration", `${patient.aligner_total_sets * patient.aligner_days_per_set} days (~${Math.round((patient.aligner_total_sets * patient.aligner_days_per_set) / 30)} months)`],
                          ].map(([lbl, val]) => (
                            <div key={lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8f7f5", borderRadius: "8px" }}>
                              <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: "600" }}>{lbl}</span>
                              <span style={{ fontSize: "13px", color: "#111827", fontWeight: "700" }}>{val}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Your aligner plan details will appear here once set by your dentist.</p>
                      )}
                      {patient.review_link && (
                        <a
                          href={patient.review_link} target="_blank" rel="noopener noreferrer"
                          style={{ marginTop: "14px", display: "block", padding: "12px", borderRadius: "10px", background: "#b8905a", color: "white", fontWeight: "700", fontSize: "14px", textAlign: "center", textDecoration: "none" }}
                        >
                          Review Treatment Plan
                        </a>
                      )}
                    </div>
                  )}

                  {/* Expanded Panel — Manufacturing (Started / Ended) */}
                  {step.key === "manufacturing" && isExpanded && (() => {
                    const js = patient.journey_steps || {};
                    const startedBatches = (patient.manufacturing_data?.batches || []).filter((b) => b.mfg_started).map((b) => b.num);
                    const doneBatches = (patient.manufacturing_data?.batches || []).filter((b) => b.mfg_done).map((b) => b.num);
                    const rows = [
                      {
                        label: "Started",
                        done: !!js.manufacturing_started,
                        at: js.manufacturing_started_at,
                        batches: startedBatches,
                      },
                      {
                        label: "Ended",
                        done: !!js.manufacturing_completed,
                        at: js.manufacturing_completed_at,
                        batches: doneBatches,
                      },
                    ];
                    return (
                      <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                        <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Manufacturing</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {rows.map((r) => (
                            <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: r.done ? "#f0fdf4" : "#f8f7f5", borderRadius: "8px", border: r.done ? "1px solid #bbf7d0" : "1px solid transparent" }}>
                              <div>
                                <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{r.label}</span>
                                {r.done && r.at && (
                                  <span style={{ display: "block", fontSize: "11px", color: "#16a34a", marginTop: "2px" }}>
                                    {r.batches.length > 0 ? `Batch ${r.batches.join(", ")} — ` : ""}
                                    {new Date(r.at + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: "12px", fontWeight: "700", color: r.done ? "#16a34a" : "#9ca3af" }}>{r.done ? "✓ Done" : "Pending"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Expanded Panel — Aligners Dispatched */}
                  {step.key === "aligners_dispatched" && isExpanded && (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Shipment Details</p>
                      {(() => {
                        // Tracking links now live on the manufacturing batches; merge in any
                        // legacy logistics shipment IDs by batch number.
                        const byNum = {};
                        (patient.manufacturing_data?.batches || []).forEach((b) => {
                          if (b.shipment_link) byNum[b.num] = { num: b.num, start: b.start, end: b.end, shipment_link: b.shipment_link, aligner_received: b.aligner_received };
                        });
                        (patient.logistics_data?.batches || []).forEach((l) => {
                          if (l.shipment_id || l.shipment_link) {
                            byNum[l.num] = { ...(byNum[l.num] || { num: l.num }), shipment_id: l.shipment_id, shipment_link: byNum[l.num]?.shipment_link || l.shipment_link, delivery_partner: l.delivery_partner, delivery_partner_other: l.delivery_partner_other, aligner_received: byNum[l.num]?.aligner_received || l.aligner_received };
                          }
                        });
                        const shippedBatches = Object.values(byNum).sort((a, b) => a.num - b.num);
                        if (shippedBatches.length === 0) {
                          return <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Shipment details will appear here once your aligners are dispatched.</p>;
                        }
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {shippedBatches.map((batch) => {
                              const partnerName = batch.delivery_partner === "Other" ? (batch.delivery_partner_other || "Other") : batch.delivery_partner;
                              const range = (batch.start !== undefined && batch.start !== "" && batch.end !== undefined && batch.end !== "") ? ` · Aligners ${batch.start}–${batch.end}` : "";
                              return (
                                <div key={batch.num} style={{ padding: "12px", background: "#f8f7f5", borderRadius: "10px" }}>
                                  <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "700", color: "#111827" }}>
                                    Batch {batch.num}{range}{partnerName ? ` • ${partnerName}` : ""}
                                  </p>
                                  {batch.shipment_id && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <div style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", background: "white", border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {batch.shipment_id}
                                      </div>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCopyShipmentId(batch.num, batch.shipment_id); }}
                                        style={{ flexShrink: 0, padding: "8px 12px", borderRadius: "8px", border: "none", background: copiedNum === batch.num ? "#16a34a" : "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                                      >
                                        {copiedNum === batch.num ? "Copied!" : "Copy"}
                                      </button>
                                    </div>
                                  )}
                                  {batch.shipment_link && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); window.open(batch.shipment_link, "_blank", "noopener,noreferrer"); }}
                                      style={{ marginTop: batch.shipment_id ? "10px" : 0, width: "100%", padding: "10px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #b8905a, #f59e0b)", color: "white", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                                    >
                                      Track Shipment
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Expanded Panel — Aligners Received (per batch) */}
                  {step.key === "aligners_received" && isExpanded && (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Confirm Receipt — Batch by Batch</p>
                      {(() => {
                        const dispatchedBatches = (patient.manufacturing_data?.batches || [])
                          .filter((b) => b.shipment_link)
                          .sort((a, b) => a.num - b.num);
                        if (dispatchedBatches.length === 0) {
                          return <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>This will appear once a batch has been dispatched to you.</p>;
                        }
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {dispatchedBatches.map((batch) => {
                              const range = (batch.start !== undefined && batch.start !== "" && batch.end !== undefined && batch.end !== "") ? ` · Aligners ${batch.start}–${batch.end}` : "";
                              return (
                                <div key={batch.num} style={{ padding: "12px", background: "#f8f7f5", borderRadius: "10px" }}>
                                  <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "700", color: "#111827" }}>
                                    Batch {batch.num}{range}
                                  </p>
                                  {batch.aligner_received ? (
                                    <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>
                                      ✓ Received on {new Date(batch.aligner_received + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                    </p>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMarkReceived(batch.num); }}
                                      disabled={receivingBatch === batch.num}
                                      style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #16a34a", background: receivingBatch === batch.num ? "#f0fdf4" : "white", color: "#16a34a", fontWeight: "700", fontSize: "13px", cursor: receivingBatch === batch.num ? "not-allowed" : "pointer" }}
                                    >
                                      {receivingBatch === batch.num ? "Saving..." : "I've Received This Batch"}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Expanded Panel — Feedback */}
                  {step.key === "feedback_submitted" && isExpanded && (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "linear-gradient(135deg, #fffbeb, #fef9f0)", border: "1px solid #fde68a", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", opacity: done ? 1 : 0.5 }}>
                      <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "700", color: done ? "#92400e" : "#9ca3af" }}>🎁 Share Your Feedback</p>
                      <p style={{ margin: "0 0 14px", fontSize: "13px", color: done ? "#374151" : "#9ca3af", lineHeight: "1.6" }}>
                        We would love to hear from you! Kindly submit your feedback at the end of treatment to avail your <strong>hamper worth ₹5,000</strong>.
                      </p>
                      {done ? (
                        <a href="https://wa.me/918280837370?text=Hi%20OrisAlign%2C%20I%20would%20like%20to%20share%20my%20feedback%20about%20my%20treatment." target="_blank" rel="noopener noreferrer"
                          style={{ display: "block", padding: "12px", borderRadius: "10px", background: "#C9A84C", color: "#1B2A4A", fontWeight: "700", fontSize: "14px", textAlign: "center", textDecoration: "none" }}>
                          ✍️ Write My Feedback
                        </a>
                      ) : (
                        <div style={{ padding: "12px", borderRadius: "10px", background: "#e5e7eb", color: "#9ca3af", fontWeight: "700", fontSize: "14px", textAlign: "center", cursor: "not-allowed" }}>
                          ✍️ Available after treatment completion
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expanded Panel — Plan and Payment */}
                  {step.key === "payment_done" && isExpanded && (patient.monthly_plan ? (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Full Plan</p>
                      {(Number(patient.amount_paid) || 0) >= FINAL_PLAN_FEE ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ padding: "10px 12px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                            <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: "#16a34a" }}>✅ Final Planning Payment Paid — {fmt(FINAL_PLAN_FEE)}</p>
                          </div>
                          <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Your Aligner Plan</p>
                          {patient.monthly_plan.totalMonths ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {[
                                ["Upper Arch Sets", patient.final_upper_sets],
                                ["Lower Arch Sets", patient.final_lower_sets],
                                ["Wear Duration per Set", "15 days"],
                                ["Total Treatment Duration", `${patient.monthly_plan.totalMonths} month${patient.monthly_plan.totalMonths !== 1 ? "s" : ""}`],
                              ].map(([lbl, val]) => (
                                <div key={lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8f7f5", borderRadius: "8px" }}>
                                  <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: "600" }}>{lbl}</span>
                                  <span style={{ fontSize: "13px", color: "#111827", fontWeight: "700" }}>{val}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Your aligner plan details will appear here once set by your orthodontist.</p>
                          )}
                          {patient.review_link && (
                            <a
                              href={patient.review_link} target="_blank" rel="noopener noreferrer"
                              style={{ display: "block", padding: "12px", borderRadius: "10px", background: "#b8905a", color: "white", fontWeight: "700", fontSize: "14px", textAlign: "center", textDecoration: "none" }}
                            >
                              Review Treatment Plan
                            </a>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.6" }}>
                            A one-time ₹999 fee unlocks your final treatment plan — our team will prepare it as soon as this is paid.
                          </p>
                          <div style={{ padding: "12px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>Amount to Pay</p>
                            <p style={{ margin: 0, fontSize: "24px", fontWeight: "900", color: "#15803d" }}>{fmt(FINAL_PLAN_FEE)}</p>
                          </div>
                          <button
                            onClick={() => handlePayNow(FINAL_PLAN_FEE)}
                            disabled={payNowLoading}
                            style={{
                              display: "block", width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                              background: "linear-gradient(135deg, #b8905a, #f59e0b)", color: "white", fontWeight: "800",
                              fontSize: "14px", textAlign: "center", letterSpacing: "0.3px",
                              boxShadow: "0 4px 10px rgba(184, 144, 90, 0.25)",
                              cursor: payNowLoading ? "not-allowed" : "pointer", opacity: payNowLoading ? 0.7 : 1,
                            }}
                          >
                            {payNowLoading ? "Starting payment..." : `Pay Now · ${fmt(FINAL_PLAN_FEE)}`}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Plan and Payment</p>
                      {!sets ? (
                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Payment details will appear here once confirmed.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {/* Plan toggle — same set count either way, only price/down
                              payment differ. Locked once any payment has been made. */}
                          {patient.payment_status !== "paid" && !patient.amount_paid && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              {PLAN_OPTIONS.map((p) => (
                                <button
                                  key={p.value}
                                  onClick={() => selectPlan(p.value)}
                                  disabled={switchingPlan}
                                  style={{
                                    flex: 1,
                                    padding: "10px",
                                    borderRadius: "8px",
                                    border: selectedPlan === p.value ? "2px solid #b8905a" : "1px solid #e5e7eb",
                                    background: selectedPlan === p.value ? "#f8f7f5" : "white",
                                    color: "#111827",
                                    fontWeight: "700",
                                    fontSize: "13px",
                                    cursor: switchingPlan ? "not-allowed" : "pointer",
                                    opacity: switchingPlan ? 0.7 : 1,
                                  }}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Full payment report — sourced only from the clinic's saved
                              figures (pushed from the backend or recorded automatically by
                              the gateway), so it always matches what's actually charged. */}
                          {patient.payment_status === "paid" && (
                            <div style={{ padding: "10px 12px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                              <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: "#16a34a" }}>✅ Fully Paid</p>
                            </div>
                          )}
                          <div style={{ padding: "14px", background: "#f8f7f5", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
                            <ReportRow label="Plan" value={activePlanInfo.label} />
                            <ReportRow label="Down Payment" value={fmt(planDownAmt)} />
                            <ReportRow label="Full Payment" value={fmt(planGrossAmt)} />
                            {(discountAmt + couponsTotal) > 0 && <ReportRow label="Coupon" value={`− ${fmt(discountAmt + couponsTotal)}`} />}
                            <ReportRow label="Final Amount" value={fmt(planFinalAmt)} />
                            <ReportRow label="Paid" value={fmt(patient.amount_paid || 0)} />
                            <ReportRow
                              label="Pending"
                              value={fmt(Math.max(0, planFinalAmt - (parseFloat(patient.amount_paid) || 0)))}
                              last={!pd.payment_mode && !pd.pending_plan?.installments?.length}
                            />
                            {pd.payment_mode && (
                              <ReportRow label="Mode" value={pd.payment_mode} last={!pd.pending_plan?.installments?.length} />
                            )}
                            {pd.pending_plan?.installments?.length > 0 && (() => {
                              const installments = pd.pending_plan.installments;
                              const paidOnes = installments.filter((i) => i.paid).sort((a, b) => b.num - a.num);
                              const nextOne = installments.filter((i) => !i.paid).sort((a, b) => a.num - b.num)[0];
                              return (
                                <>
                                  <ReportRow label="Pending Mode" value={pd.pending_plan.mode} />
                                  <ReportRow label="Paid Installment" value={paidOnes[0] ? `#${paidOnes[0].num} of ${installments.length}` : "—"} />
                                  <ReportRow
                                    label="Next Installment"
                                    value={nextOne ? `#${nextOne.num} — ${fmt(nextOne.amount)} on ${new Date(nextOne.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "All installments paid"}
                                    last
                                  />
                                </>
                              );
                            })()}
                          </div>

                          {patient.payment_status !== "paid" && !patient.amount_paid && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => setPaymentMode("down")}
                                style={{
                                  flex: 1,
                                  padding: "10px",
                                  borderRadius: "8px",
                                  border: paymentMode === "down" ? "2px solid #b8905a" : "1px solid #e5e7eb",
                                  background: paymentMode === "down" ? "#f8f7f5" : "white",
                                  color: "#111827",
                                  fontWeight: "700",
                                  fontSize: "13px",
                                  cursor: "pointer",
                                }}
                              >
                                Down Payment
                              </button>
                              <button
                                onClick={() => setPaymentMode("full")}
                                style={{
                                  flex: 1,
                                  padding: "10px",
                                  borderRadius: "8px",
                                  border: paymentMode === "full" ? "2px solid #b8905a" : "1px solid #e5e7eb",
                                  background: paymentMode === "full" ? "#f8f7f5" : "white",
                                  color: "#111827",
                                  fontWeight: "700",
                                  fontSize: "13px",
                                  cursor: "pointer",
                                }}
                              >
                                Full Payment
                              </button>
                            </div>
                          )}

                          {patient.payment_status !== "paid" && (() => {
                            // Once any amount has been paid, the only thing left to collect
                            // is the pending balance — no down/full toggle, no re-deriving
                            // a different price.
                            const hasPartialPaid = !!patient.amount_paid;
                            const amountDue = hasPartialPaid
                              ? Math.max(0, planFinalAmt - (parseFloat(patient.amount_paid) || 0))
                              : paymentMode === "down"
                                ? planDownAmt
                                : planFinalAmt;
                            return (
                              <>
                                {/* Amount Display */}
                                <div style={{ padding: "12px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                                  <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>Amount to Pay</p>
                                  <p style={{ margin: 0, fontSize: "24px", fontWeight: "900", color: "#15803d" }}>{fmt(amountDue)}</p>
                                </div>

                                {/* Coupon Input Section — only before any payment has been made */}
                                {!hasPartialPaid && (
                                  <>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                      <input
                                        type="text"
                                        placeholder="Enter coupon code"
                                        value={couponInput}
                                        onChange={(e) => setCouponInput(e.target.value)}
                                        onKeyPress={(e) => e.key === "Enter" && applyCoupon()}
                                        style={{
                                          flex: 1,
                                          padding: "10px 12px",
                                          borderRadius: "8px",
                                          border: "1px solid #e5e7eb",
                                          fontSize: "13px",
                                          outline: "none",
                                        }}
                                      />
                                      <button
                                        onClick={applyCoupon}
                                        disabled={applyingCoupon}
                                        style={{
                                          padding: "10px 16px",
                                          borderRadius: "8px",
                                          border: "none",
                                          background: "#b8905a",
                                          color: "white",
                                          fontWeight: "700",
                                          fontSize: "13px",
                                          cursor: applyingCoupon ? "not-allowed" : "pointer",
                                          opacity: applyingCoupon ? 0.6 : 1,
                                        }}
                                      >
                                        {applyingCoupon ? "..." : "Apply"}
                                      </button>
                                    </div>

                                    {couponMessage && (
                                      <div style={{
                                        padding: "10px 12px",
                                        borderRadius: "8px",
                                        background: couponMessage.includes("✓") ? "#f0fdf4" : "#fee2e2",
                                        border: couponMessage.includes("✓") ? "1px solid #bbf7d0" : "1px solid #fecaca",
                                        color: couponMessage.includes("✓") ? "#16a34a" : "#dc2626",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                      }}>
                                        {couponMessage}
                                      </div>
                                    )}

                                    {appliedCoupons.length > 0 && (
                                      <div style={{ padding: "10px 12px", background: "#fef3c7", borderRadius: "8px" }}>
                                        <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: "#92400e", textTransform: "uppercase" }}>Coupons Applied</p>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                          {appliedCoupons.map((coupon, idx) => (
                                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: "white", borderRadius: "4px" }}>
                                              <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{coupon.code}</span>
                                              <span style={{ fontSize: "12px", color: "#6b7280" }}>- {fmt(coupon.discount)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Pay Now Button */}
                                <button
                                  onClick={() => handlePayNow(amountDue)}
                                  disabled={payNowLoading}
                                  style={{
                                    display: "block",
                                    width: "100%",
                                    padding: "12px",
                                    borderRadius: "10px",
                                    border: "none",
                                    background: "linear-gradient(135deg, #b8905a, #f59e0b)",
                                    color: "white",
                                    fontWeight: "800",
                                    fontSize: "14px",
                                    textAlign: "center",
                                    letterSpacing: "0.3px",
                                    boxShadow: "0 4px 10px rgba(184, 144, 90, 0.25)",
                                    cursor: payNowLoading ? "not-allowed" : "pointer",
                                    opacity: payNowLoading ? 0.7 : 1,
                                  }}
                                >
                                  {payNowLoading ? "Starting payment..." : `Pay Now · ${fmt(amountDue)}`}
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Expanded Panel — Aligner Sets (month by month) */}
                  {step.key === "aligner_sets" && isExpanded && discountedMonthlyPlan && (() => {
                    const amountPaidNow = Number(patient.amount_paid) || 0;
                    const unpaidNums = discountedMonthlyPlan.months
                      .filter((m) => amountPaidNow < m.discountedCumulative)
                      .map((m) => m.num);
                    // Selection must stay a contiguous run starting from the next
                    // unpaid package — otherwise the cumulative-threshold "paid"
                    // math (and the last-month-backward coupon discount) breaks.
                    const toggleSelected = (num) => {
                      const idx = unpaidNums.indexOf(num);
                      setSelectedPackages((prev) =>
                        prev.includes(num) ? unpaidNums.slice(0, idx) : unpaidNums.slice(0, idx + 1)
                      );
                    };
                    const selectedTotal = discountedMonthlyPlan.months
                      .filter((m) => selectedPackages.includes(m.num))
                      .reduce((sum, m) => sum + m.payableAmount, 0);
                    return (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Aligner Sets — Package by Package</p>

                      {unpaidNums.length > 0 && (
                        <div style={{ marginBottom: "14px", padding: "12px", background: "#f0fdf4", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
                          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#374151" }}>
                            Select one or more packages below, then place your order.
                          </p>
                          <button
                            onClick={() => handlePayNow(selectedTotal)}
                            disabled={payNowLoading || selectedPackages.length === 0}
                            style={{
                              display: "block", width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                              background: selectedPackages.length === 0 ? "#e5e7eb" : "linear-gradient(135deg, #b8905a, #f59e0b)",
                              color: selectedPackages.length === 0 ? "#9ca3af" : "white", fontWeight: "800",
                              fontSize: "14px", textAlign: "center", letterSpacing: "0.3px",
                              cursor: (payNowLoading || selectedPackages.length === 0) ? "not-allowed" : "pointer",
                              opacity: payNowLoading ? 0.7 : 1,
                            }}
                          >
                            {payNowLoading
                              ? "Starting payment..."
                              : selectedPackages.length === 0
                                ? "Select packages to order"
                                : `Order ${selectedPackages.length} Package${selectedPackages.length > 1 ? "s" : ""} · ${fmt(selectedTotal)}`}
                          </button>
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {discountedMonthlyPlan.months.map((m) => {
                          const isPaid = amountPaidNow >= m.discountedCumulative;
                          const isSelected = selectedPackages.includes(m.num);
                          const batch = (patient.manufacturing_data?.batches || []).find((b) => Number(b.num) === m.num);
                          const isExpandedMonth = expandedMonth === m.num;
                          return (
                            <div key={m.num} style={{ border: `1px solid ${isPaid ? "#bbf7d0" : isSelected ? "#f59e0b" : "#e5e7eb"}`, borderRadius: "10px", overflow: "hidden" }}>
                              <div
                                onClick={() => (isPaid ? setExpandedMonth(isExpandedMonth ? null : m.num) : toggleSelected(m.num))}
                                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: isPaid ? "#f0fdf4" : isSelected ? "#fffbeb" : "#f8f7f5", cursor: "pointer" }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  {!isPaid && (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelected(m.num)}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ width: "18px", height: "18px", accentColor: "#b8905a", cursor: "pointer", flexShrink: 0 }}
                                    />
                                  )}
                                  <div>
                                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827" }}>
                                      Package {m.num} — {monthSlotLabels(m.upper, m.lower).join(", ")}
                                    </p>
                                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: isPaid ? "#16a34a" : "#9ca3af" }}>
                                      {fmt(m.payableAmount)}{isPaid ? " · Paid" : ""}
                                    </p>
                                  </div>
                                </div>
                                {isPaid && <span style={{ fontSize: "12px", color: "#16a34a" }}>{isExpandedMonth ? "▲" : "▼"}</span>}
                              </div>
                              {isPaid && isExpandedMonth && (
                                <div style={{ padding: "12px", borderTop: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {[
                                    // "Push to Production" is the active/in-progress label right
                                    // after payment — it only flips to a done "Production Completed"
                                    // once the admin actually marks manufacturing finished, not the
                                    // moment payment succeeds (mfg_started just queues it).
                                    { label: batch?.mfg_done ? "Production Completed" : "Push to Production", done: !!batch?.mfg_done, at: batch?.mfg_done },
                                    // "Dispatched" is tied to the tracking link itself, not mfg_done —
                                    // that's the actual signal the order shipped.
                                    { label: "Dispatched", done: !!batch?.shipment_link, at: batch?.mfg_done },
                                  ].map((r) => (
                                    <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: r.done ? "#f0fdf4" : "#f8f7f5", borderRadius: "8px" }}>
                                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#111827" }}>
                                        {r.label}{r.done && r.at ? ` — ${new Date(r.at + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                                      </span>
                                      <span style={{ fontSize: "11px", fontWeight: "700", color: r.done ? "#16a34a" : "#9ca3af" }}>{r.done ? "✓ Done" : "Pending"}</span>
                                    </div>
                                  ))}
                                  {batch?.shipment_id && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <div style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", background: "white", border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {batch.shipment_id}
                                      </div>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCopyShipmentId(m.num, batch.shipment_id); }}
                                        style={{ flexShrink: 0, padding: "8px 12px", borderRadius: "8px", border: "none", background: copiedNum === m.num ? "#16a34a" : "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                                      >
                                        {copiedNum === m.num ? "Copied!" : "Copy"}
                                      </button>
                                    </div>
                                  )}
                                  {batch?.shipment_link && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); window.open(batch.shipment_link, "_blank", "noopener,noreferrer"); }}
                                      style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #b8905a, #f59e0b)", color: "white", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                                    >
                                      Track Shipment
                                    </button>
                                  )}
                                  {batch?.aligner_received && (
                                    <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>
                                      ✓ Received on {new Date(batch.aligner_received + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: "32px", textAlign: "center", padding: "20px", background: "white", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280", lineHeight: "1.6" }}>
            For any queries, contact us at{" "}
            <a href="mailto:hello@orisalign.com" style={{ color: "#b8905a", fontWeight: "600" }}>hello@orisalign.com</a>
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#9ca3af" }}>
            {patient.booking_confirmed
              ? <>Your Patient ID: <strong style={{ color: "#374151" }}>{shortId}</strong></>
              : <>Fill your details and confirm your booking to receive your Patient ID.</>}
          </p>
        </div>
      </div>
    </div>
  );
}
