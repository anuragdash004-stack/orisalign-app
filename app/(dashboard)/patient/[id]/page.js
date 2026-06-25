"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

const supabase = getSupabaseClient();

const PROVISIONAL_PLAN_NOTE = "Your tooth will be rotated to required degree. Alignment will be corrected. Spaces will be gained. Your plan might involve IPR and buttons.";

const ORISPRO_MODELS = {
  "6-8": {
    one: { duration: "6-8 months", fullAmount: 65000, downPayment: 12500 },
    two: { duration: "4-6 months", fullAmount: 72000, downPayment: 15500 },
  },
  "8-10": {
    one: { duration: "8-10 months", fullAmount: 70000, downPayment: 12500 },
    two: { duration: "6-7 months", fullAmount: 78000, downPayment: 15500 },
  },
  "10-12": {
    one: { duration: "10-12 months", fullAmount: 80000, downPayment: 12500 },
    two: { duration: "6-8 months", fullAmount: 102000, downPayment: 15500 },
  },
  "12-14": {
    one: { duration: "12-14 months", fullAmount: 89000, downPayment: 12500 },
    two: { duration: "8-9 months", fullAmount: 115000, downPayment: 15500 },
  },
  "14-16": {
    one: { duration: "14-16 months", fullAmount: 99000, downPayment: 12500 },
    two: { duration: "9-11 months", fullAmount: 128000, downPayment: 15500 },
  },
  "16-18": {
    one: { duration: "16-18 months", fullAmount: 108000, downPayment: 12500 },
    two: { duration: "10-12 months", fullAmount: 141000, downPayment: 15500 },
  },
};

const JOURNEY_STEPS = [
  { key: "booked",                  label: "Appointment Booked" },
  { key: "confirmed",               label: "Appointment Confirmed" },
  { key: "scanning_done",           label: "Scanning and Provisional Planning", expandable: true },
  { key: "payment_done",            label: "Plan and Payment",            expandable: true },
  { key: "planning_done",           label: "Full Plan", expandable: true },
  { key: "plan_approved",           label: "Plan Approval", approveAction: true },
  { key: "manufacturing_started",   label: "Manufacturing Started" },
  { key: "manufacturing_completed", label: "Manufacturing Completed" },
  { key: "aligners_dispatched",     label: "Aligners Dispatched", expandable: true },
  { key: "aligners_received",       label: "Aligners Received" },
  { key: "followup_appointment",    label: "Appointment Book" },
  { key: "aligners_delivered",      label: "Aligners Delivered" },
  { key: "smile_correction",        label: "Smile Correction Started",   smileLink: true },
  { key: "treatment_completed",     label: "Treatment Completed" },
  { key: "feedback_submitted",      label: "Feedback Form Submitted",    expandable: true },
];

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
    manufacturing_started:   !!js.manufacturing_started,
    manufacturing_completed: !!js.manufacturing_completed,
    aligners_dispatched:     !!js.aligners_dispatched,
    aligners_received:       !!js.aligners_received,
    followup_appointment:    !!js.followup_appointment,
    aligners_delivered:      !!js.aligners_delivered,
    smile_correction:        !!js.smile_correction,
    treatment_completed:     js.treatment_completed  !== undefined ? !!js.treatment_completed  : appt.status === "completed",
    feedback_submitted:      !!js.feedback_submitted,
  };
}

function fmt(n) {
  if (!n && n !== 0) return "N/A";
  return `₹ ${parseFloat(n).toLocaleString("en-IN")}`;
}

function calculateFinalAmount(pd, appliedCoupons) {
  let fullAmt = parseFloat(pd.full_amount) || 0;
  fullAmt = fullAmt - (parseFloat(pd.discount) || 0);

  // Apply all applied coupons
  appliedCoupons.forEach((coupon) => {
    fullAmt = Math.max(0, fullAmt - parseFloat(coupon.discount));
  });

  return Math.round(fullAmt * 100) / 100;
}

export default function PatientJourney() {
  const { id } = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState(null);
  const [approving, setApproving] = useState(false);
  const [copiedNum, setCopiedNum] = useState(null);
  const [paymentMode, setPaymentMode] = useState("down"); // "down" or "full"
  const [appliedCoupons, setAppliedCoupons] = useState([]); // Array of {code, discount}
  const [couponInput, setCouponInput] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [orisproVariant, setOrisproVariant] = useState("one"); // "one" or "two" for payment
  const [scanningVariant, setScanningVariant] = useState("one"); // "one" or "two" for scanning view
  const [payNowLoading, setPayNowLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("appointments_booking")
        .select("*")
        .eq("id", id)
        .single();
      setPatient(data || null);
      setLoading(false);
    };
    load();
  }, [id]);

  const getVariantPricing = () => {
    if (!patient || !patient.treatment_model) return { fullAmount: 0, downPayment: 0, duration: "" };
    const modelData = ORISPRO_MODELS[patient.treatment_model];
    if (!modelData) return { fullAmount: 0, downPayment: 0, duration: "" };
    const variantData = modelData[orisproVariant];
    return {
      fullAmount: variantData.fullAmount,
      downPayment: variantData.downPayment,
      duration: variantData.duration,
    };
  };

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

      // Check if coupon already applied
      if (appliedCoupons.find((c) => c.code === data.code)) {
        setCouponMessage("This coupon is already applied.");
        setApplyingCoupon(false);
        return;
      }

      // Add coupon to applied list
      setAppliedCoupons([...appliedCoupons, { code: data.code, discount: discountAmount }]);
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
  const shortId = id.substring(0, 8).toUpperCase();
  const patientIdLabel = patient.booking_confirmed ? shortId : "Pending";
  const completedCount = Object.values(steps).filter(Boolean).length;
  const progressPct = Math.round((completedCount / JOURNEY_STEPS.length) * 100);
  const pd = patient.payment_data || {};

  const isPlanApprovalReady =
    steps.booked && steps.confirmed && steps.scanning_done &&
    steps.payment_done && steps.planning_done;

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
            <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#9ca3af" }}>{completedCount} of {JOURNEY_STEPS.length} steps completed</p>
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
            {JOURNEY_STEPS.map((step, index) => {
              const done = steps[step.key];
              const isNext = !done && index > 0 && steps[JOURNEY_STEPS[index - 1]?.key];
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
                          {step.key === "manufacturing_started" && done && patient.journey_steps?.manufacturing_started_at && (
                            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#16a34a", lineHeight: "1.4" }}>
                              Started on {new Date(patient.journey_steps.manufacturing_started_at + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          )}
                          {step.key === "manufacturing_completed" && done && patient.journey_steps?.manufacturing_completed_at && (
                            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#16a34a", lineHeight: "1.4" }}>
                              Completed on {new Date(patient.journey_steps.manufacturing_completed_at + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          )}
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
                      {/* Orispro Variant Selector */}
                      {patient?.treatment_model && (
                        <>
                          <div style={{ padding: "10px 12px", background: "#f3f4f6", borderRadius: "8px", marginBottom: "12px" }}>
                            <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase" }}>Treatment Plan</p>
                            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                              <button
                                onClick={() => setScanningVariant("one")}
                                style={{
                                  flex: 1,
                                  padding: "10px",
                                  borderRadius: "8px",
                                  border: scanningVariant === "one" ? "2px solid #111827" : "1px solid #d1d5db",
                                  background: scanningVariant === "one" ? "#ffffff" : "#f9fafb",
                                  color: "#111827",
                                  fontWeight: scanningVariant === "one" ? "700" : "600",
                                  fontSize: "13px",
                                  cursor: "pointer",
                                }}
                              >
                                Orispro
                              </button>
                              <button
                                onClick={() => setScanningVariant("two")}
                                style={{
                                  flex: 1,
                                  padding: "10px",
                                  borderRadius: "8px",
                                  border: scanningVariant === "two" ? "2px solid #111827" : "1px solid #d1d5db",
                                  background: scanningVariant === "two" ? "#ffffff" : "#f9fafb",
                                  color: "#111827",
                                  fontWeight: scanningVariant === "two" ? "700" : "600",
                                  fontSize: "13px",
                                  cursor: "pointer",
                                }}
                              >
                                Orispro Plus
                              </button>
                            </div>
                            {(() => {
                              const modelData = ORISPRO_MODELS[patient.treatment_model];
                              const variantData = modelData?.[scanningVariant];
                              return variantData ? (
                                <div style={{ padding: "8px 10px", background: "#ede9fe", borderRadius: "6px" }}>
                                  <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "700", color: "#6d28d9", textTransform: "uppercase" }}>Duration</p>
                                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#4c1d95" }}>{variantData.duration}</p>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </>
                      )}

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

                  {/* Expanded Panel — Aligners Dispatched */}
                  {step.key === "aligners_dispatched" && isExpanded && (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Shipment Details</p>
                      {(() => {
                        // Tracking links now live on the manufacturing batches; merge in any
                        // legacy logistics shipment IDs by batch number.
                        const byNum = {};
                        (patient.manufacturing_data?.batches || []).forEach((b) => {
                          if (b.shipment_link) byNum[b.num] = { num: b.num, start: b.start, end: b.end, shipment_link: b.shipment_link };
                        });
                        (patient.logistics_data?.batches || []).forEach((l) => {
                          if (l.shipment_id || l.shipment_link) {
                            byNum[l.num] = { ...(byNum[l.num] || { num: l.num }), shipment_id: l.shipment_id, shipment_link: byNum[l.num]?.shipment_link || l.shipment_link, delivery_partner: l.delivery_partner, delivery_partner_other: l.delivery_partner_other };
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
                  {step.key === "payment_done" && isExpanded && (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Plan and Payment</p>
                      {!pd.full_amount ? (
                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Payment details will appear here once confirmed.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {/* Orispro Variant Selection */}
                          {patient?.treatment_model && (
                            <>
                              <div style={{ padding: "10px 12px", background: "#f3f4f6", borderRadius: "8px", marginBottom: "4px" }}>
                                <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase" }}>Treatment Plan</p>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button
                                    onClick={() => setOrisproVariant("one")}
                                    style={{
                                      flex: 1,
                                      padding: "10px",
                                      borderRadius: "8px",
                                      border: orisproVariant === "one" ? "2px solid #111827" : "1px solid #d1d5db",
                                      background: orisproVariant === "one" ? "#ffffff" : "#f9fafb",
                                      color: "#111827",
                                      fontWeight: orisproVariant === "one" ? "700" : "600",
                                      fontSize: "13px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Orispro
                                  </button>
                                  <button
                                    onClick={() => setOrisproVariant("two")}
                                    style={{
                                      flex: 1,
                                      padding: "10px",
                                      borderRadius: "8px",
                                      border: orisproVariant === "two" ? "2px solid #111827" : "1px solid #d1d5db",
                                      background: orisproVariant === "two" ? "#ffffff" : "#f9fafb",
                                      color: "#111827",
                                      fontWeight: orisproVariant === "two" ? "700" : "600",
                                      fontSize: "13px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Orispro Plus
                                  </button>
                                </div>
                              </div>
                              {getVariantPricing().duration && (
                                <div style={{ padding: "10px 12px", background: "#ede9fe", borderRadius: "8px", marginBottom: "4px" }}>
                                  <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#6d28d9", textTransform: "uppercase" }}>Treatment Duration</p>
                                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#4c1d95" }}>{getVariantPricing().duration}</p>
                                </div>
                              )}
                            </>
                          )}

                          {/* Payment Mode Selection */}
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

                          {/* Amount Display */}
                          <div style={{ padding: "12px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>Amount to Pay</p>
                            <p style={{ margin: 0, fontSize: "24px", fontWeight: "900", color: "#15803d" }}>
                              {paymentMode === "down"
                                ? fmt(getVariantPricing().downPayment || pd.down_payment)
                                : fmt(calculateFinalAmount({ full_amount: getVariantPricing().fullAmount || pd.full_amount, discount: pd.discount }, appliedCoupons))}
                            </p>
                          </div>

                          {/* Coupon Input Section */}
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

                          {/* Coupon Message */}
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

                          {/* Applied Coupons Summary */}
                          {appliedCoupons.length > 0 && (
                            <div style={{ padding: "10px 12px", background: "#fef3c7", borderRadius: "8px" }}>
                              <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: "#92400e", textTransform: "uppercase" }}>Coupons Applied</p>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {appliedCoupons.map((coupon, idx) => (
                                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: "white", borderRadius: "4px" }}>
                                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{coupon.code}</span>
                                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                      <span style={{ fontSize: "12px", color: "#6b7280" }}>- {fmt(coupon.discount)}</span>
                                      <button
                                        onClick={() => setAppliedCoupons(appliedCoupons.filter((_, i) => i !== idx))}
                                        style={{ background: "none", border: "none", color: "#dc2626", fontWeight: "700", cursor: "pointer", fontSize: "12px" }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Pay Now Button */}
                          <button
                            onClick={() => {
                              const amount = paymentMode === "down"
                                ? (getVariantPricing().downPayment || pd.down_payment)
                                : calculateFinalAmount({ full_amount: getVariantPricing().fullAmount || pd.full_amount, discount: pd.discount }, appliedCoupons);
                              handlePayNow(amount);
                            }}
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
                            {payNowLoading ? "Starting payment..." : `Pay Now · ${paymentMode === "down" ? fmt(getVariantPricing().downPayment || pd.down_payment) : fmt(calculateFinalAmount({ full_amount: getVariantPricing().fullAmount || pd.full_amount, discount: pd.discount }, appliedCoupons))}`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
