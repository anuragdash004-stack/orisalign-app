"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

const supabase = getSupabaseClient();

const JOURNEY_STEPS = [
  { key: "booked",                  label: "Appointment Booked" },
  { key: "confirmed",               label: "Appointment Confirmed" },
  { key: "scanning_done",           label: "Scanning & Planning",        expandable: true },
  { key: "payment_done",            label: "Price & Payment",            expandable: true },
  { key: "planning_done",           label: "Planning Done" },
  { key: "plan_approved",           label: "Plan Approved" },
  { key: "manufacturing_started",   label: "Manufacturing Started" },
  { key: "manufacturing_completed", label: "Manufacturing Completed" },
  { key: "aligners_dispatched",     label: "Aligners Dispatched" },
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
    booked:                  js.booked               !== undefined ? !!js.booked               : true,
    confirmed:               js.confirmed            !== undefined ? !!js.confirmed            : appt.status !== "pending",
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

export default function PatientJourney() {
  const { id } = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState(null);

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
  const completedCount = Object.values(steps).filter(Boolean).length;
  const progressPct = Math.round((completedCount / JOURNEY_STEPS.length) * 100);
  const pd = patient.payment_data || {};

  const handleStepClick = (step) => {
    if (step.smileLink) {
      if (!steps.smile_correction) return; // only accessible when admin marks it done
      router.push(`/patient/${id}/smile`);
      return;
    }
    if (step.expandable) { setExpandedStep(expandedStep === step.key ? null : step.key); }
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
            {[["Patient ID", shortId], ["Phone", patient.phone || "N/A"], ["Date", patient.date || "N/A"], ["Time", patient.time || "N/A"]].map(([lbl, val]) => (
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: done ? "700" : "500", color: done ? "#15803d" : isNext ? "#92400e" : "#9ca3af" }}>
                          {step.label}
                        </p>
                        {isClickable && <span style={{ fontSize: "12px", color: done ? "#16a34a" : "#9ca3af", flexShrink: 0, marginLeft: "8px" }}>{isExpanded ? "▲" : "▼"}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Panel — Scanning & Planning */}
                  {step.key === "scanning_done" && isExpanded && (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Your Provisional Plan</p>
                      {patient.provisional_plan ? (
                        <p style={{ margin: 0, fontSize: "14px", color: "#111827", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{patient.provisional_plan}</p>
                      ) : (
                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Your treatment plan is being prepared. Please check back soon.</p>
                      )}
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

                  {/* Expanded Panel — Price & Payment */}
                  {step.key === "payment_done" && isExpanded && (
                    <div style={{ marginLeft: "58px", marginTop: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Price & Payment Details</p>
                      {!pd.final_amount ? (
                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Payment details will appear here once confirmed.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {[
                            ["Full Amount", fmt(pd.full_amount)],
                            ["Discount", pd.discount ? `- ${fmt(pd.discount)}` : "—"],
                            pd.coupon_code ? ["Coupon (" + pd.coupon_code + ")", pd.coupon_discount ? `- ${fmt(pd.coupon_discount)}` : "—"] : null,
                            ["Final Amount", fmt(pd.final_amount)],
                            ["Down Payment", fmt(pd.down_payment) + (pd.down_payment_mode ? ` (${pd.down_payment_mode})` : "")],
                            ["Pending Amount", fmt(pd.pending_amount) + (pd.pending_mode ? ` (${pd.pending_mode})` : "")],
                            (pd.down_payment_mode === "Finance" || pd.pending_mode === "Finance") && pd.finance_provider ? ["Finance", pd.finance_provider] : null,
                          ].filter(Boolean).map(([lbl, val]) => (
                            <div key={lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: lbl === "Final Amount" ? "#f0fdf4" : "#f8f7f5", borderRadius: "8px", border: lbl === "Final Amount" ? "1px solid #bbf7d0" : "none" }}>
                              <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: "600" }}>{lbl}</span>
                              <span style={{ fontSize: "13px", color: lbl === "Final Amount" ? "#16a34a" : "#111827", fontWeight: lbl === "Final Amount" ? "800" : "600" }}>{val}</span>
                            </div>
                          ))}

                          {/* Pay Now CTA — opens /payment with appointment context */}
                          {pd.pending_amount > 0 && (
                            <a
                              href={`/payment?id=${id}&amount=${pd.pending_amount}`}
                              style={{
                                marginTop: "8px",
                                display: "block",
                                padding: "12px",
                                borderRadius: "10px",
                                background: "linear-gradient(135deg, #b8905a, #f59e0b)",
                                color: "white",
                                fontWeight: "800",
                                fontSize: "14px",
                                textAlign: "center",
                                textDecoration: "none",
                                letterSpacing: "0.3px",
                                boxShadow: "0 4px 10px rgba(184, 144, 90, 0.25)",
                              }}
                            >
                              Pay Now · {fmt(pd.pending_amount)}
                            </a>
                          )}
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
            Your Patient ID: <strong style={{ color: "#374151" }}>{shortId}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
