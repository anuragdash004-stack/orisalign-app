"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { PROVISIONAL_PLAN_FEE, estimateRange, estimateRangeForPlan, formatMonthsDays, applyCouponDiscount, totalCost, monthSlotLabels, PLAN_CONFIGS } from "@/lib/monthlyPlan";
import { INVESTIGATION_TYPES, MAX_INVESTIGATION_FILE_SIZE, isInvestigationDone } from "@/lib/investigations";
import { isNewModelAppointment } from "@/lib/appointmentModel";
import {
  isNativeApp, getNotifPermission, requestNotifPermission, openAppNotificationSettings,
  hasSeenNotifOnboarding, markNotifOnboardingSeen, registerForPush,
} from "@/lib/pushPermission";

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
  { key: "smile_correction",        label: "Smile Correction Started",   expandable: true, smileLink: true },
  { key: "treatment_completed",     label: "Treatment Completed" },
  { key: "post_aligner_treatment",  label: "Post Aligner Treatment" },
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
  { key: "scanning_done",           label: "Scanning" },
  { key: "provisional_planning",    label: "Provisional Planning",        expandable: true },
  { key: "payment_done",            label: "Full Plan",                   expandable: true },
  { key: "investigation_required",  label: "Investigation Required",      expandable: true },
  { key: "plan_approved",           label: "Plan Approval", approveAction: true },
  { key: "prealigner_treatment",    label: "Prealigner Treatment",        expandable: true },
  { key: "aligner_sets",            label: "Aligner Sets",                expandable: true },
  { key: "followup_appointment",    label: "Appointment Book" },
  { key: "aligners_delivered",      label: "Aligners Delivered" },
  { key: "smile_correction",        label: "Smile Correction Started",   expandable: true, smileLink: true },
  { key: "treatment_completed",     label: "Treatment Completed" },
  { key: "post_aligner_treatment",  label: "Post Aligner Treatment" },
  { key: "feedback_submitted",      label: "Feedback Form Submitted",    expandable: true },
];

// ─── Journey arc ──────────────────────────────────────────────────────────────
// The steps ride a circle whose centre sits off the left edge of the screen,
// so the slice that crosses the screen reads as a gentle vertical arc. Nodes
// are laid out by angle; rotating the rail is just a change of offset.
const ARC_CX = 55;           // circle centre, px from the left edge — kept clear of the screen's right edge at rel=0
const ARC_R = 270;           // radius — nodes ride just outside the (bigger) hero circle
const ARC_STEP_ANGLE = 26;   // degrees between neighbouring steps
const ARC_VISIBLE = 3.4;     // steps either side of centre before full fade

// One line icon per step key, in the same thin-stroke style throughout.
const STEP_ICONS = {
  booked: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
  confirmed: '<path d="M20 6L9 17l-5-5"/>',
  scanning_done: '<path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M7 12h10"/>',
  provisional_planning: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>',
  payment_done: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  planning_done: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  investigation_required: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',
  plan_approved: '<path d="M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  prealigner_treatment: '<path d="M12 3c2.5 0 4 1 5.5 1S20 3.5 20 6c0 4-1.5 6-2.5 10-.6 2.4-2.4 2.6-2.9.3-.4-2-.9-3.3-2.6-3.3s-2.2 1.3-2.6 3.3c-.5 2.3-2.3 2.1-2.9-.3C5.5 12 4 10 4 6c0-2.5 1-3 2.5-3S9.5 3 12 3z"/>',
  post_aligner_treatment: '<path d="M12 3c2.5 0 4 1 5.5 1S20 3.5 20 6c0 4-1.5 6-2.5 10-.6 2.4-2.4 2.6-2.9.3-.4-2-.9-3.3-2.6-3.3s-2.2 1.3-2.6 3.3c-.5 2.3-2.3 2.1-2.9-.3C5.5 12 4 10 4 6c0-2.5 1-3 2.5-3S9.5 3 12 3z"/>',
  aligner_sets: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  manufacturing: '<path d="M3 20h18M4 20V10l5 3V10l5 3V6l6 4v10"/>',
  aligners_dispatched: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>',
  aligners_received: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>',
  aligners_delivered: '<path d="M20 7l-8-4-8 4 8 4 8-4z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M9 14l2 2 4-4"/>',
  followup_appointment: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
  smile_correction: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>',
  treatment_completed: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M10 19h4M12 14v5"/>',
  feedback_submitted: '<path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z"/>',
};
const DEFAULT_STEP_ICON = '<circle cx="12" cy="12" r="8"/>';

// ── Neumorphic surface tokens ────────────────────────────────────────────
// One raised value and one sunken value, reused everywhere, so the screen
// reads as a single moulded material rather than a pile of separate shadows.
const NEU = {
  ivory: "#F3F1E8", surface: "#F7F5EE", surface2: "#EFEDE3",
  navy: "#102A43", navy2: "#33506B", slate: "#7B8A99", slate2: "#9BA7B3",
  gold: "#B8893F", goldL: "#CBA164", goldD: "#966E2E",
  up: "-6px -6px 14px rgba(255,255,255,0.95), 7px 7px 16px rgba(163,155,134,0.34)",
  upSm: "-3px -3px 7px rgba(255,255,255,0.95), 4px 4px 9px rgba(163,155,134,0.34)",
  insetSm: "inset -2px -2px 5px rgba(255,255,255,0.9), inset 3px 3px 6px rgba(163,155,134,0.34)",
};
const NEU_BTN = { width: "44px", height: "44px", borderRadius: "15px", border: "none", cursor: "pointer", background: NEU.surface, display: "grid", placeItems: "center", boxShadow: NEU.up };
const NEU_ICON = { fill: "none", stroke: "#41576D", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
const NEU_ROW = { display: "flex", alignItems: "center", gap: "13px", width: "100%", padding: "13px", marginBottom: "10px", borderRadius: "20px", border: "none", cursor: "pointer", background: NEU.surface, boxShadow: NEU.upSm, textAlign: "left", font: "inherit", color: NEU.navy };
const NEU_ROW_ICON = { width: "36px", height: "36px", borderRadius: "13px", display: "grid", placeItems: "center", flexShrink: 0, background: NEU.surface2, boxShadow: NEU.insetSm };
const NEU_FIELD = { width: "100%", padding: "12px 14px", borderRadius: "16px", fontSize: "13.5px", fontFamily: "inherit", color: NEU.navy, background: NEU.surface2, border: "none", boxShadow: NEU.insetSm, outline: "none", boxSizing: "border-box" };
const NEU_LABEL = { display: "block", marginBottom: "6px", fontSize: "10.5px", fontWeight: "700", letterSpacing: "0.14em", textTransform: "uppercase", color: NEU.slate2 };
const NEU_PRIMARY = { display: "block", width: "100%", padding: "15px", borderRadius: "16px", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: "700", fontSize: "13.5px", background: "linear-gradient(135deg, #CBA164, #B8893F)", color: "#fff", boxShadow: "-2px -2px 6px rgba(255,255,255,0.5), 4px 4px 12px rgba(150,110,46,0.45)" };
const NEU_VTITLE = { margin: "4px 2px 15px", fontSize: "16px", fontWeight: "800", color: NEU.navy };
const NEU_NOTE = { margin: "12px 2px 0", fontSize: "11.5px", lineHeight: "1.55", color: NEU.slate };
const NEU_OK = { padding: "22px 16px", borderRadius: "22px", background: NEU.surface, boxShadow: NEU.upSm, textAlign: "center" };
const NEU_TICK = { display: "grid", placeItems: "center", width: "44px", height: "44px", margin: "0 auto 12px", borderRadius: "50%", fontSize: "20px", color: "#fff", background: "linear-gradient(135deg, #CBA164, #B8893F)" };

const NEU_INFO_CARD = { display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "10px 14px", borderRadius: "20px", border: "none", background: NEU.surface, boxShadow: NEU.up, textAlign: "left", font: "inherit", color: NEU.navy, cursor: "pointer" };
const NEU_INFO_ICON = { width: "38px", height: "38px", borderRadius: "13px", display: "grid", placeItems: "center", flexShrink: 0, background: NEU.surface, boxShadow: NEU.upSm };
const NEU_INFO_LABEL = { display: "block", marginBottom: "3px", fontSize: "9.5px", fontWeight: "700", letterSpacing: "0.2em", textTransform: "uppercase", color: NEU.slate2 };
const NEU_INFO_VALUE = { display: "block", fontSize: "14.5px", fontWeight: "800", letterSpacing: "-0.01em", color: NEU.navy };
const NEU_INFO_SUB = { display: "block", marginTop: "1px", fontSize: "11px", lineHeight: "1.45", color: NEU.slate };
const NEU_INFO_CHEV = { width: "7px", height: "7px", flexShrink: 0, borderRight: "1.8px solid " + NEU.slate2, borderBottom: "1.8px solid " + NEU.slate2, transform: "rotate(-45deg)" };

// A kit has to be in the patient's hands before the first set it contains is
// due to go in — this is how many days ahead the order is prompted.
const KIT_LEAD_DAYS = 10;

function formatShortDay(value) {
  const d = value instanceof Date ? new Date(value) : new Date(String(value) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDayLabel(value) {
  const d = value instanceof Date ? new Date(value) : new Date(String(value) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Distance between card centres on the rail, in px.
const CARD_SPACING = 190;

// One plain line per step, so a card says what that step is about.
const STEP_BLURB = {
  booked: "Your consultation is booked.",
  confirmed: "Your appointment is confirmed.",
  scanning_done: "Your scan has been captured.",
  provisional_planning: "Choose your plan and get started.",
  payment_done: "Your full treatment plan.",
  planning_done: "Your treatment plan is ready.",
  investigation_required: "Extra records your orthodontist needs.",
  plan_approved: "Authorise fabrication to begin.",
  prealigner_treatment: "Groundwork before the aligners.",
  aligner_sets: "Order your aligners package by package.",
  manufacturing: "Your aligners are being made.",
  aligners_dispatched: "Your aligners are on the way.",
  aligners_received: "Nearly at your door.",
  followup_appointment: "Your progress review.",
  aligners_delivered: "Wear them 20-22 hours a day.",
  smile_correction: "Photograph each set as you go.",
  treatment_completed: "Final records at the last set.",
  post_aligner_treatment: "Retainers to hold the result.",
  feedback_submitted: "Tell us how it went.",
};

// Treatment-simulation stills (public/journey-stages), one per aligner stage
// of a real completed case: crooked at stage 1, straight at stage 15. They
// sit behind the arc and cross-fade as the rail is scrolled, so the teeth
// visibly straighten as the patient moves through their journey. Two
// adjacent stills are ever visible at once — the fractional part of the
// scroll position is the cross-fade ratio between them.
const STAGE_COUNT = 15;
const STAGE_SRC = (n) => `/journey-stages/stage-${String(n + 1).padStart(2, "0")}.webp`;
// How strongly the simulation shows through the background. Kept as one
// constant so it's a single number to tune.
const STAGE_OPACITY = 0.168;
// ── Screen background ───────────────────────────────────────────────────────
// A supplied wave/contour photo, sized to the phone's own aspect ratio so it
// fills the screen edge to edge without cropping. Replaces the earlier
// generated gradient-plus-SVG-lines background.
const SCREEN_BG_IMAGE = "/journey-bg.webp";

// Feathers all four edges of the simulation (see where it's applied below).
// The model is cut off flat at the top and bottom of every render, so the fade
// has to start inside the gums rather than at the canvas edge — otherwise the
// cut reads as a hard horizontal line. It ramps across the gum and is fully
// opaque by the time it reaches the teeth in the middle.
const STAGE_MASK =
  "linear-gradient(to bottom, transparent 14%, #000 36%, #000 66%, transparent 88%)," +
  "linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%)";

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
  // New leads default to the new model — see lib/appointmentModel.ts.
  const isNewModel = isNewModelAppointment(appt);
  const amountPaid = Number(appt.amount_paid) || 0;

  const base = {
    booked:                  true,
    confirmed:               appt.status === "confirmed" || appt.status === "completed",
    scanning_done:           js.scanning_done        !== undefined ? !!js.scanning_done        : !!appt.stl_submitted,
    // Provisional Planning now also gates payment: a plan must be picked AND
    // paid for (either "first_month" at the plan's monthly rate, or the flat
    // "full_plan" fee) before it counts as done.
    provisional_planning:    isNewModel
      ? (() => {
          const planCfg = PLAN_CONFIGS[appt.payment_data?.plan] || PLAN_CONFIGS.ORISPRO;
          const choice = appt.payment_data?.provisional_payment_choice;
          const threshold = choice === "first_month" ? planCfg.monthRate : choice === "full_plan" ? PROVISIONAL_PLAN_FEE : null;
          return !!appt.payment_data?.plan && threshold !== null && amountPaid >= threshold;
        })()
      : !!appt.payment_data?.plan,
    // "Full Plan" is no longer a payment step — it's just the plan content
    // (final plan text, upper/lower sets, review link), so it's done exactly
    // when Final Plan Review has been completed.
    payment_done:            isNewModel
      ? !!(appt.final_upper_sets && appt.final_lower_sets)
      : (js.payment_done !== undefined ? !!js.payment_done : !!(appt.payment_data?.final_amount)),
    // No pre-aligner procedures selected → nothing to wait on, counts as done.
    prealigner_treatment:    procs.length === 0 ? true : procs.every((p) => !!prealignerDone[p]),
    planning_done:           js.planning_done        !== undefined ? !!js.planning_done        : !!appt.provisional_plan_submitted,
    final_plan_review:       !!(appt.final_upper_sets && appt.final_lower_sets),
    investigation_required:  isInvestigationDone(js),
    // The new model always tracks approval explicitly via /api/approve-plan
    // (journey_steps.plan_approved) — the final_plan-text fallback below is
    // legacy-only, since older patients never had that flag set and used the
    // presence of final plan text as a stand-in signal instead. Applying that
    // same fallback to new-model patients was wrong: their final_plan text is
    // filled in at the "Full Plan" step, long before actual approval.
    plan_approved:           isNewModel ? !!js.plan_approved : (js.plan_approved !== undefined ? !!js.plan_approved : !!(appt.final_plan && appt.final_plan.trim())),
    followup_appointment:    !!js.followup_appointment,
    aligners_delivered:      !!js.aligners_delivered,
    smile_correction:        !!js.smile_correction,
    treatment_completed:     js.treatment_completed  !== undefined ? !!js.treatment_completed  : appt.status === "completed",
    post_aligner_treatment:  !!js.post_aligner_treatment,
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

function moduleFmt(n) {
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

  // ── Notification permission ─────────────────────────────────────────────
  // "granted"/"denied" once the OS has answered, "prompt" before it has,
  // "unsupported" on the web (no native permission to ask for there).
  const [notifPermission, setNotifPermission] = useState("unsupported");
  const [showNotifOnboarding, setShowNotifOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ── Menu drawer and calendar ────────────────────────────────────────
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerView, setDrawerView] = useState("root");
  const [showCalendar, setShowCalendar] = useState(false);
  // Android can't have its notification permission revoked from inside the
  // app, so "off" is our own per-device switch: the token is dropped and not
  // re-registered until the patient turns it back on.
  const [pushOff, setPushOff] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: "", age: "", sex: "", address: "" });
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");
  const [callbackReason, setCallbackReason] = useState("");
  const [callbackSending, setCallbackSending] = useState(false);
  const [callbackSent, setCallbackSent] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [referName, setReferName] = useState("");
  const [referPhone, setReferPhone] = useState("");
  const [referSending, setReferSending] = useState(false);
  const [referSent, setReferSent] = useState(false);
  const [referral, setReferral] = useState(null); // { code, shared, qualified, earned, cap, reward }
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  // Turns a granted permission into an actual FCM token and saves it against
  // this appointment — safe to call repeatedly (a stale/rotated token just
  // overwrites the saved one), so every path that lands on "granted" below
  // calls it.
  const registerPushToken = async () => {
    const token = await registerForPush();
    if (!token) return;
    try { window.localStorage.setItem("orisalign_push_token", token); } catch {}
    try {
      await fetch("/api/push/register-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, token }),
      });
    } catch {
      // best-effort — a failed save here just means this device won't get
      // pushes until the next time this runs (app reopen, toggle, etc.)
    }
  };

  useEffect(() => {
    let off = false;
    try { off = window.localStorage.getItem("orisalign_push_off") === "1"; } catch {}
    setPushOff(off);
    if (!isNativeApp()) return;
    (async () => {
      const state = await getNotifPermission();
      setNotifPermission(state);
      // Ask once, the first time the app is opened on a device where the OS
      // hasn't been asked yet. After that the toggle in Settings is the only
      // way to change it — Android refuses a second in-app prompt once denied.
      if (state === "prompt" && !hasSeenNotifOnboarding()) setShowNotifOnboarding(true);
      else if (state === "granted" && !off) registerPushToken();
    })();
  }, []);

  const handleEnableNotifications = async () => {
    markNotifOnboardingSeen();
    const state = await requestNotifPermission();
    setNotifPermission(state);
    setShowNotifOnboarding(false);
    if (state === "granted") registerPushToken();
  };
  const handleDismissNotifOnboarding = () => {
    markNotifOnboardingSeen();
    setShowNotifOnboarding(false);
  };
  // Switching on clears our own flag first, then makes sure the OS has
  // actually granted permission before re-registering the device.
  const enableNotifications = async () => {
    try { window.localStorage.removeItem("orisalign_push_off"); } catch {}
    setPushOff(false);
    if (notifPermission === "denied") { await openAppNotificationSettings(); return; }
    const state = notifPermission === "granted" ? "granted" : await requestNotifPermission();
    setNotifPermission(state);
    if (state === "granted") registerPushToken();
  };

  const disableNotifications = async () => {
    setShowDisableConfirm(false);
    try { window.localStorage.setItem("orisalign_push_off", "1"); } catch {}
    setPushOff(true);
    let token = null;
    try { token = window.localStorage.getItem("orisalign_push_token"); } catch {}
    if (!token) return;
    try {
      await fetch("/api/push/register-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, token, action: "remove" }),
      });
    } catch {
      // the local flag already stopped this device asking for more
    }
  };

  const handleToggleNotifications = async () => {
    if (notifPermission === "denied") { await openAppNotificationSettings(); return; }
    const state = await requestNotifPermission();
    setNotifPermission(state);
    if (state === "granted") registerPushToken();
  };
  // The stored address is a composed "street | city, district, state | PIN: x
  // | Maps: y" string. Only the first segment is the patient's to edit here,
  // so the rest is carried through untouched on save.
  const openInfoForm = () => {
    const parts = String(patient?.address || "").split(" | ");
    setInfoForm({
      name: patient?.name || "",
      age: patient?.age === null || patient?.age === undefined ? "" : String(patient.age),
      sex: patient?.sex || "",
      address: parts[0] || "",
    });
    setInfoMsg("");
    setDrawerView("info");
  };

  const saveInfoForm = async () => {
    setInfoSaving(true);
    setInfoMsg("");
    try {
      const rest = String(patient?.address || "").split(" | ").slice(1);
      const address = [infoForm.address.trim(), ...rest].filter(Boolean).join(" | ");
      const patch = {
        name: infoForm.name.trim(),
        age: infoForm.age === "" ? null : Number(infoForm.age),
        sex: infoForm.sex || null,
        address,
      };
      const { error } = await supabase.from("appointments_booking").update(patch).eq("id", id);
      if (error) { setInfoMsg("Couldn't save: " + error.message); return; }
      setPatient((prev) => prev && { ...prev, ...patch });
      setInfoMsg("Saved.");
    } catch {
      setInfoMsg("Network error. Please try again.");
    } finally {
      setInfoSaving(false);
    }
  };

  const sendCallbackRequest = async () => {
    setCallbackSending(true);
    try {
      const res = await fetch("/api/request-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, reason: callbackReason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) { alert("Couldn't send that: " + (json.error || "Please try again.")); return; }
      setCallbackSent(true);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setCallbackSending(false);
    }
  };

  const sendFeedback = async () => {
    setFeedbackSending(true);
    try {
      const res = await fetch("/api/submit-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, rating: feedbackRating, comment: feedbackComment }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) { alert("Couldn't send that: " + (json.error || "Please try again.")); return; }
      setFeedbackSent(true);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setFeedbackSending(false);
    }
  };

  // Minted on the server the first time a patient opens this screen.
  const loadReferral = async () => {
    if (referral || referralLoading) return;
    setReferralLoading(true);
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, action: "code" }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.code) setReferral(json);
    } catch {
      // leave it unloaded; reopening the view tries again
    } finally {
      setReferralLoading(false);
    }
  };

  const copyReferralCode = async () => {
    if (!referral?.code) return;
    try {
      await navigator.clipboard.writeText(referral.code);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    } catch {
      // clipboard blocked — the code is on screen to read off anyway
    }
  };

  const sendReferral = async () => {
    if (!referName.trim() || !referPhone.trim()) {
      alert("Please add their name and phone number.");
      return;
    }
    setReferSending(true);
    try {
      const res = await fetch("/api/refer-friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, friendName: referName, friendPhone: referPhone }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) { alert("Couldn't send that: " + (json.error || "Please try again.")); return; }
      setReferSent(true);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setReferSending(false);
    }
  };

  // Journey arc — how far the rail of step icons has been rotated, measured
  // in steps (fractional while a drag is in progress). See ARC_* below.
  const [arcOffset, setArcOffset] = useState(0);
  const arcDrag = useRef({ active: false, lastY: 0, moved: 0 });
  const arcCentred = useRef(false);

  // The open card tracks whichever step the rail is centred on.
  useEffect(() => {
    if (!expandedStep) return;
    const centred = journeySteps[Math.round(arcOffset)]?.key;
    if (centred && centred !== expandedStep) setExpandedStep(centred);
  });

  // ── Patient card tray ───────────────────────────────────────────────────
  // The card slides out through the left edge; its handle rides along on the
  // right, so once the card is tucked away the arrow is left sitting at the
  // screen edge. Both are moved by the card's own width, measured here rather
  // than assumed, since the card's width is a percentage of the screen.
  const cardRef = useRef(null);
  const [cardBox, setCardBox] = useState({ left: 0, top: 0, mid: 0 });
  const cardSlide = cardBox.left;   // card's right edge === distance to the screen edge
  useEffect(() => {
    const measure = () => {
      const el = cardRef.current;
      if (!el) return;
      const next = {
        left: el.offsetLeft + el.offsetWidth,
        top: el.offsetTop,
        mid: el.offsetTop + el.offsetHeight / 2,
      };
      // Bail out when nothing moved: this effect deliberately runs on every
      // render (the card's height depends on content), so setting state
      // unconditionally would loop forever.
      setCardBox((prev) => (prev.left === next.left && prev.top === next.top && prev.mid === next.mid ? prev : next));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  // ── Treatment simulation ────────────────────────────────────────────────
  // Painted onto one canvas rather than cross-faded as two stacked <img>
  // layers: two semi-transparent copies at 50% each only add up to ~75%
  // coverage, so the arch visibly pales halfway through every transition.
  // Drawing frame A at (1-f) and adding frame B at f with 'lighter' is a
  // straight linear interpolation of colour and alpha, which holds coverage
  // constant the whole way across.
  const stageCanvas = useRef(null);
  const stageImgs = useRef([]);
  const stagesReady = useRef(false);
  const stepCount = useRef(1);

  const paintStages = () => {
    const canvas = stageCanvas.current;
    if (!canvas || !stagesReady.current) return;
    const imgs = stageImgs.current;
    // A fresh canvas already reports 300x150, so compare against the real
    // frame size rather than testing for a falsy width.
    if (canvas.width !== imgs[0].naturalWidth) {
      canvas.width = imgs[0].naturalWidth;
      canvas.height = imgs[0].naturalHeight;
    }
    const n = stepCount.current;
    const exact = (n > 1 ? arcOffset / (n - 1) : 0) * (STAGE_COUNT - 1);
    const a = Math.max(0, Math.min(STAGE_COUNT - 1, Math.floor(exact)));
    const b = Math.min(STAGE_COUNT - 1, a + 1);
    const f = exact - a;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1 - f;
    ctx.drawImage(imgs[a], 0, 0);
    if (f > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = f;
      ctx.drawImage(imgs[b], 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  // The treatment simulation was dropped from this screen, so the fifteen
  // stage frames are no longer preloaded — that was roughly half a megabyte
  // fetched on every open for something nothing draws any more. paintStages
  // and its refs stay put, harmless behind their null-canvas guard, ready if
  // the render is ever brought back.


  const [expandedMonth, setExpandedMonth] = useState(null);
  const [selectedPackages, setSelectedPackages] = useState([]); // unpaid package nums chosen to order together
  const [approving, setApproving] = useState(false);
  const [consentChecked, setConsentChecked] = useState(true);
  const [savingProvisionalPlan, setSavingProvisionalPlan] = useState(false);
  const [uploadingInvestigation, setUploadingInvestigation] = useState(null); // investigation type key currently uploading
  const [investigationFileUrls, setInvestigationFileUrls] = useState({}); // type -> signed url, fetched on demand
  const [copiedNum, setCopiedNum] = useState(null);
  const [receivingBatch, setReceivingBatch] = useState(null);
  const [markingProcedureDone, setMarkingProcedureDone] = useState(null);
  const [uploadingSmileImage, setUploadingSmileImage] = useState(null); // "<setNum>-<type>" currently uploading
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

  // Live updates — when the admin changes something on this appointment from
  // the backend Journey tab (or a payment/webhook updates it), reflect it
  // here immediately instead of requiring the patient to refresh.
  useEffect(() => {
    if (!id || !supabase) return;
    const channel = supabase
      .channel(`appointment-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments_booking", filter: `id=eq.${id}` },
        (payload) => {
          setPatient((prev) => (prev ? { ...prev, ...payload.new } : payload.new));
          if (payload.new?.payment_data?.applied_coupons) {
            setAppliedCoupons(payload.new.payment_data.applied_coupons);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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
        // Not a coupon — it may be another patient's referral code. The server
        // validates that (self-referral, already redeemed, already paid) and
        // applies it, so those rules can't be worked around from here.
        try {
          const res = await fetch("/api/referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId: id, action: "redeem", code: couponInput.trim().toUpperCase() }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.success) {
            const { data: fresh } = await supabase
              .from("appointments_booking")
              .select("payment_data")
              .eq("id", id)
              .single();
            const updated = fresh?.payment_data?.applied_coupons || [];
            setAppliedCoupons(updated);
            setPatient((prev) => prev && { ...prev, payment_data: fresh?.payment_data || prev.payment_data });
            setCouponMessage("✓ Referral code applied! Discount: " + fmt(json.discount));
            setCouponInput("");
            setApplyingCoupon(false);
            return;
          }
          setCouponMessage(json.error || "No valid coupon found with this code.");
        } catch {
          setCouponMessage("No valid coupon found with this code.");
        }
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

  // Open the arc on whichever step the patient is actually up to, rather than
  // always at step 1 — done once, so it never fights a drag afterwards.
  useEffect(() => {
    if (!patient || arcCentred.current) return;
    arcCentred.current = true;
    const list = isNewModelAppointment(patient) ? NEW_JOURNEY_STEPS : LEGACY_JOURNEY_STEPS;
    const done = deriveSteps(patient);
    const firstOpen = list.findIndex((s) => !done[s.key]);
    setArcOffset(firstOpen === -1 ? list.length - 1 : firstOpen);
  }, [patient]);

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
  // Demo accounts (journey_steps.demo_account) are shown to prospective
  // patients, other dentists, and friends — real pricing has no place there.
  // Shadows the module-level fmt() for the rest of this render: every call
  // site already reads through fmt(), so this one flag masks every amount
  // on the page without touching each of them individually.
  const isDemoAccount = !!patient.journey_steps?.demo_account;
  const fmt = isDemoAccount ? () => "₹ XX,XXX" : moduleFmt;
  // Counts as "new model" from Provisional Planning onward, not only once
  // Final Plan Review generates monthly_plan — see deriveSteps for why.
  const isNewModel = isNewModelAppointment(patient);
  const journeySteps = isNewModel ? NEW_JOURNEY_STEPS : LEGACY_JOURNEY_STEPS;
  // The step actually in progress: the first one not yet marked done.
  // On means the OS granted it and the patient hasn't switched it off here.
  const notifOn = notifPermission === "granted" && !pushOff;

  const currentStepIndex = (() => {
    const idx = journeySteps.findIndex((s) => !steps[s.key]);
    return idx === -1 ? journeySteps.length - 1 : idx;
  })();
  stepCount.current = journeySteps.length;   // read by paintStages
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

  // New per-arch model's Provisional Planning step — just the plan choice
  // itself (OrisPro vs OrisPro Plus), no pricing/coupon/payment details.
  // Locked once the orthodontist has already generated the monthly schedule
  // from it (monthly_plan present).
  const selectProvisionalPlan = async (planKey) => {
    if (patient.monthly_plan || savingProvisionalPlan) return;
    setSavingProvisionalPlan(true);
    const newPaymentData = { ...(patient.payment_data || {}), plan: planKey };
    const { error } = await supabase.from("appointments_booking").update({ payment_data: newPaymentData }).eq("id", id);
    setSavingProvisionalPlan(false);
    if (error) { alert("Couldn't save: " + error.message); return; }
    setPatient((prev) => prev && { ...prev, payment_data: newPaymentData });
  };

  // Payment choice made right after picking a plan — persists which choice
  // was made (so the cumulative baseline generated at Final Plan Review
  // matches it), then goes straight to checkout for the right amount.
  // `threshold` is the full target (e.g. ₹4,999); recordPaymentReceived is
  // additive against a cap of that same target, so if any amount is already
  // on the row only the shortfall must actually be charged — otherwise the
  // gateway would take the full amount but recordPaymentReceived would then
  // reject saving it for exceeding the cap.
  const selectPaymentChoiceAndPay = async (choice, threshold, gateway) => {
    const amount = Math.max(0, threshold - (Number(patient.amount_paid) || 0));
    if (amount <= 0) return;
    const newPaymentData = { ...(patient.payment_data || {}), provisional_payment_choice: choice };
    const { error } = await supabase.from("appointments_booking").update({ payment_data: newPaymentData }).eq("id", id);
    if (error) { alert("Couldn't save: " + error.message); return; }
    setPatient((prev) => prev && { ...prev, payment_data: newPaymentData });
    handlePayNow(amount, gateway);
  };

  // Investigation Required — patient uploads one file (image or PDF) per
  // investigation type the orthodontist flagged as needed.
  const uploadInvestigationFile = async (typeKey, file) => {
    if (!file) return;
    if (file.size > MAX_INVESTIGATION_FILE_SIZE) {
      alert("That file is too large — please upload an image or PDF under 15MB.");
      return;
    }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      alert("Please upload an image or a PDF file.");
      return;
    }
    setUploadingInvestigation(typeKey);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${id}/investigations/${typeKey}_${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("case-files").upload(path, file, { upsert: true });
      if (upErr) { alert("Failed to upload: " + upErr.message); return; }
      const newFiles = { ...(patient.journey_steps?.investigation_files || {}), [typeKey]: { path, name: file.name, uploadedAt: new Date().toISOString() } };
      const newJourneySteps = { ...(patient.journey_steps || {}), investigation_files: newFiles };
      const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJourneySteps }).eq("id", id);
      if (error) { alert("Failed to save: " + error.message); return; }
      setPatient((prev) => prev && { ...prev, journey_steps: newJourneySteps });
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setUploadingInvestigation(null);
    }
  };

  const viewInvestigationFile = async (path) => {
    const { data, error } = await supabase.storage.from("case-files").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { alert("Couldn't open the file. Please try again."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  // Shrinks a phone photo (often 3-8MB straight off the camera) down to a
  // few hundred KB before it ever hits the network — the smaller the body,
  // the less likely an upload is to stall or silently die, which matters a
  // lot inside WhatsApp's/Instagram's built-in browser (where patients open
  // these reminder links from) — its embedded WebView is known to hang or
  // drop larger uploads that a real browser handles fine. Falls back to the
  // original file untouched if the image can't be decoded (e.g. some HEIC
  // variants Chrome's <img> won't render) rather than blocking the upload.
  const compressPhoto = (file, maxDim = 1600, quality = 0.82) =>
    new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });

  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("upload_timeout")), ms)),
    ]);

  // Smile Correction — one edge-to-edge + one complete-bite bite photo per
  // aligner set, uploaded as the patient goes through the program.
  const uploadSmileSetImage = async (setNum, type, file) => {
    if (!file) return;
    if (file.size > MAX_INVESTIGATION_FILE_SIZE) {
      alert("That photo is too large — please upload an image under 15MB (try switching your camera app to a smaller/normal photo size, not the largest RAW/HEIC setting).");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (JPG or PNG).");
      return;
    }
    const uploadKey = `${setNum}-${type}`;
    setUploadingSmileImage(uploadKey);
    try {
      const upload = file.size > 400 * 1024 ? await compressPhoto(file).catch(() => file) : file;
      const ext = upload.name.split(".").pop();
      const path = `smile-correction/${id}/set-${setNum}/${type}.${ext}`;
      const { error: upErr } = await withTimeout(
        supabase.storage.from("case-files").upload(path, upload, { upsert: true, contentType: upload.type }),
        25000
      );
      if (upErr) { alert("Failed to upload: " + upErr.message + " — please try again, or use a different photo."); return; }
      const { data: { publicUrl } } = supabase.storage.from("case-files").getPublicUrl(path);
      const setImages = patient.journey_steps?.smile_set_images || {};
      const newJourneySteps = {
        ...(patient.journey_steps || {}),
        smile_set_images: { ...setImages, [setNum]: { ...(setImages[setNum] || {}), [type]: publicUrl } },
      };
      const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJourneySteps }).eq("id", id);
      if (error) { alert("Photo uploaded, but saving it to your record failed: " + error.message + " — please try again."); return; }
      setPatient((prev) => prev && { ...prev, journey_steps: newJourneySteps });
    } catch (e) {
      if (e?.message === "upload_timeout") {
        alert("The upload is taking too long — this often happens inside WhatsApp's built-in browser. Please try again, and if it keeps happening, tap the ⋮ menu at the top of the screen and choose \"Open in Chrome\" (or your regular browser) instead of uploading from inside WhatsApp.");
      } else {
        alert("Network error while uploading — please check your connection and try again.");
      }
    } finally {
      setUploadingSmileImage(null);
    }
  };

  const handleSmileRefinement = async () => {
    if (!window.confirm("Mark refinement as done?")) return;
    const newJourneySteps = { ...(patient.journey_steps || {}), refinement: true };
    const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJourneySteps }).eq("id", id);
    if (error) { alert("Couldn't save: " + error.message); return; }
    setPatient((prev) => prev && { ...prev, journey_steps: newJourneySteps });
  };

  const handleEndSmileJourney = async () => {
    if (!window.confirm("End the patient journey? Treatment will be marked as completed.")) return;
    const newJourneySteps = { ...(patient.journey_steps || {}), journey_ended: true };
    const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJourneySteps, status: "completed" }).eq("id", id);
    if (error) { alert("Couldn't save: " + error.message); return; }
    setPatient((prev) => prev && { ...prev, journey_steps: newJourneySteps, status: "completed" });
  };

  const getSmileSetDate = (index, startDateStr, daysPerSet) => {
    const d = new Date(startDateStr);
    d.setDate(d.getDate() + index * (daysPerSet || 15));
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  // planning_done is a legacy-only step (not part of the new per-arch
  // roadmap at all) — requiring it here blocked new-model patients from ever
  // reaching Plan Approval, since nothing in their flow ever sets it.
  const isPlanApprovalReady =
    steps.booked && steps.confirmed && steps.scanning_done && steps.payment_done &&
    (isNewModel
      ? (steps.provisional_planning && steps.final_plan_review && steps.investigation_required)
      : steps.planning_done);

  // Even once every prerequisite is ready, the Approve Plan button stays
  // locked until an admin explicitly switches it on from the Journey tab —
  // it's never automatic.
  const isPlanApprovalUnlocked = !isNewModel || !!patient.journey_steps?.plan_approval_unlocked;

  // For the new model, the admin's switch is the sole authority once
  // flipped on — it deliberately bypasses isPlanApprovalReady (an
  // incomplete Investigation Required, etc. included), per explicit
  // instruction: switching it on should unlock Approve Plan even if an
  // earlier step isn't finished yet. Legacy patients have no switch
  // concept at all, so their button still depends purely on readiness.
  const canApprovePlan = isNewModel ? isPlanApprovalUnlocked : isPlanApprovalReady;

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
    if (step.smileLink && !steps[step.key]) return; // only accessible when admin marks it done
    if (step.expandable) { setExpandedStep(expandedStep === step.key ? null : step.key); }
  };

  // Whatever amount is shown on screen (after admin discount + any coupons
  // the patient applied) must be exactly what the gateway charges. The
  // gateway only trusts payment_type_to_collect/payment_data on the server,
  // so we push the displayed amount there as a custom amount before
  // redirecting — otherwise the server falls back to the stale, undiscounted
  // down_payment/full_amount and overcharges.
  const handlePayNow = async (amount, gateway) => {
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
      router.push(`/checkout?id=${id}&amount=${amount}${gateway ? `&gateway=${gateway}` : ""}`);
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

  // ── Wear schedule ──────────────────────────────────────────────────
  // Set k goes in on smile_start_date + (k-1) x daysPerSet. Everything below
  // is derived from the Smile Correction setup, so it stays in step with what
  // the clinic actually entered rather than a second source of truth.
  const wearPlan = (() => {
    const js = patient.journey_steps || {};
    const total = Number(js.smile_sets_count) || 0;
    if (!js.smile_start_date || !total) return null;
    const start = new Date(String(js.smile_start_date) + "T00:00:00");
    if (Number.isNaN(start.getTime())) return null;
    const daysPerSet = Number(js.smile_days_per_set) || Number(patient.aligner_days_per_set) || 15;
    const setStart = (n) => {
      const d = new Date(start);
      d.setDate(d.getDate() + (n - 1) * daysPerSet);
      return d;
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Whole set-lengths elapsed since the first set went in; negative before
    // the schedule starts, which clamps to set 1.
    const elapsed = Math.floor((today.getTime() - start.getTime()) / (daysPerSet * 86400000));
    const currentSet = Math.min(total, Math.max(1, elapsed + 1));
    const nextSet = currentSet < total ? currentSet + 1 : null;
    return { daysPerSet, total, setStart, currentSet, nextSet };
  })();

  // ── Next kit to order ──────────────────────────────────────────────
  // The first package the payments haven't covered yet, and the date its
  // earliest set is due — the order has to be placed KIT_LEAD_DAYS before it.
  const nextKit = (() => {
    if (!wearPlan || !discountedMonthlyPlan) return null;
    const paid = Number(patient.amount_paid) || 0;
    const pending = discountedMonthlyPlan.months.find((m) => paid < m.discountedCumulative);
    if (!pending) return null;
    const sets = [...(pending.upper || []), ...(pending.lower || [])]
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!sets.length) return null;
    const firstSet = Math.min(...sets);
    const wearFrom = wearPlan.setStart(firstSet);
    const orderBy = new Date(wearFrom);
    orderBy.setDate(orderBy.getDate() - KIT_LEAD_DAYS);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      num: pending.num,
      slots: monthSlotLabels(pending.upper || [], pending.lower || []).join(", "),
      wearFrom,
      orderBy,
      overdue: orderBy.getTime() < today.getTime(),
    };
  })();

  return (
    <div style={{ position: "relative", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", colorScheme: "light", background: NEU.ivory }}>

      {/* ───── JOURNEY CAROUSEL ─────────────────────────────────────────
          Every treatment step is a raised ceramic card on a horizontal rail.
          Dragging sideways moves the rail; the centred card is the live one,
          and tapping it opens that step's full panel. arcDrag.current.lastY
          carries the last clientX here — the rail turned horizontal, the ref
          did not get renamed. */}
      <div
        onPointerDown={(e) => {
          if (e.target.closest && e.target.closest("[data-nodrag]")) return;
          arcDrag.current = { active: true, lastY: e.clientX, moved: 0 };
        }}
        onPointerMove={(e) => {
          if (!arcDrag.current.active) return;
          const dx = e.clientX - arcDrag.current.lastY;
          arcDrag.current.lastY = e.clientX;
          arcDrag.current.moved += Math.abs(dx);
          setArcOffset((prev) => Math.max(0, Math.min(journeySteps.length - 1, prev - dx / CARD_SPACING)));
        }}
        onPointerUp={() => {
          if (!arcDrag.current.active) return;
          arcDrag.current.active = false;
          setArcOffset((prev) => Math.max(0, Math.min(journeySteps.length - 1, Math.round(prev))));
        }}
        onPointerCancel={() => { arcDrag.current.active = false; }}
        onWheel={(e) => {
          const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          setArcOffset((prev) => Math.max(0, Math.min(journeySteps.length - 1, Math.round(prev + (d > 0 ? 1 : -1)))));
        }}
        style={{
          position: "relative", height: "100dvh", overflow: "hidden",
          touchAction: "none", userSelect: "none",
          display: "flex", flexDirection: "column", background: NEU.ivory,
        }}
      >
        {/* Top navigation */}
        <div style={{ position: "relative", zIndex: 6, flex: "0 0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 20px 0" }}>
          <button
            data-nodrag
            onClick={() => { setDrawerView("root"); setShowDrawer(true); }}
            aria-label="Open menu"
            style={NEU_BTN}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" style={NEU_ICON}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <button
            data-nodrag
            onClick={() => setShowCalendar(true)}
            aria-label="Appointments calendar"
            style={NEU_BTN}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" style={NEU_ICON}>
              <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
          </button>
        </div>

        <img src="/logo-mark.webp" alt="OrisAlign" style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", width: "132px", zIndex: 5, mixBlendMode: "multiply", pointerEvents: "none" }} />

        {/* The rail */}
        <div style={{ flex: "0 0 auto", margin: "26px 0 0" }}>
          <div style={{ position: "relative", zIndex: 3, isolation: "isolate", height: "302px" }}>
            {journeySteps.map((step, i) => {
              const rel = i - arcOffset;
              const dist = Math.abs(rel);
              const scale = Math.max(0.6, 1 - dist * 0.2);
              const opacity = dist >= 2.2 ? 0 : Math.max(0, 1 - Math.pow(dist / 2.2, 1.05));
              const done = !!steps[step.key];
              const isCurrent = i === currentStepIndex;
              // Smile Correction stays shut until an admin marks it started.
              const locked = !!step.smileLink && !steps[step.key];
              const label = done ? "Completed" : isCurrent ? "In progress" : "Upcoming";
              return (
                <button
                  key={step.key}
                  onClick={() => {
                    if (arcDrag.current.moved > 6) { arcDrag.current.moved = 0; return; }
                    if (Math.abs(i - arcOffset) > 0.5) { setArcOffset(i); return; }
                    if (locked || !step.expandable) return;
                    setExpandedStep(step.key);
                  }}
                  aria-label={`Step ${i + 1}: ${step.label}`}
                  style={{
                    position: "absolute", left: "50%", top: "50%", width: "214px", margin: "-150px 0 0 -107px",
                    padding: 0, border: "none", background: "none", cursor: "pointer", font: "inherit", color: "inherit",
                    transformOrigin: "center center",
                    transform: `translateX(${rel * CARD_SPACING}px) scale(${scale.toFixed(3)})`,
                    opacity, zIndex: 20 - Math.round(dist),
                    pointerEvents: opacity < 0.35 ? "none" : "auto",
                    transition: arcDrag.current.active ? "none" : "transform 0.34s cubic-bezier(.2,.8,.3,1), opacity 0.3s ease",
                  }}
                >
                  <span style={{
                    position: "relative", display: "flex", flexDirection: "column", alignItems: "center",
                    width: "214px", height: "300px", padding: "76px 16px 24px", borderRadius: "30px",
                    background: NEU.surface,
                    boxShadow: isCurrent
                      ? "-7px -7px 16px rgba(255,255,255,0.95), 9px 9px 20px rgba(163,155,134,0.34), 0 0 0 1px rgba(184,137,63,0.16)"
                      : NEU.up,
                  }}>
                    <span style={{ position: "absolute", top: "18px", left: "18px", width: "46px", height: "46px", borderRadius: "15px", display: "grid", placeItems: "center", background: NEU.surface, boxShadow: NEU.upSm }}>
                      <svg viewBox="0 0 24 24" width="21" height="21"
                        style={{ fill: "none", stroke: isCurrent ? NEU.gold : done ? NEU.slate : NEU.slate2, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}
                        dangerouslySetInnerHTML={{ __html: STEP_ICONS[step.key] || DEFAULT_STEP_ICON }} />
                    </span>
                    <span style={{ position: "absolute", top: "22px", right: "20px", fontSize: "21px", fontWeight: "800", letterSpacing: "-0.02em", color: isCurrent ? NEU.gold : NEU.slate2, fontVariantNumeric: "tabular-nums" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ marginTop: "auto", marginBottom: "auto", display: "flex", flexDirection: "column", gap: "9px", width: "100%" }}>
                      <span style={{ fontSize: isCurrent ? "21px" : "17px", fontWeight: "800", letterSpacing: "-0.025em", lineHeight: "1.16", textAlign: "center", color: isCurrent ? NEU.navy : NEU.navy2 }}>
                        {step.label}
                      </span>
                      <span style={{ fontSize: isCurrent ? "12.5px" : "11.5px", lineHeight: "1.55", textAlign: "center", color: isCurrent ? NEU.slate : NEU.slate2 }}>
                        {STEP_BLURB[step.key] || ""}
                      </span>
                    </span>
                    <span style={{
                      marginTop: "11px", padding: "8px 17px", borderRadius: "99px", fontSize: "11.5px", fontWeight: "700",
                      letterSpacing: "0.07em", textTransform: "uppercase",
                      background: isCurrent ? "linear-gradient(135deg, #CBA164, #B8893F)" : NEU.surface2,
                      color: isCurrent ? "#fff" : NEU.slate,
                      boxShadow: isCurrent ? "-2px -2px 5px rgba(255,255,255,0.5), 3px 3px 8px rgba(150,110,46,0.42)" : NEU.insetSm,
                    }}>
                      {label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Arrows */}
          <div style={{ position: "relative", zIndex: 4, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 36px", marginTop: "20px" }}>
            {[-1, 1].map((dir) => {
              const at = Math.max(0, Math.min(journeySteps.length - 1, Math.round(arcOffset)));
              const off = dir < 0 ? at === 0 : at === journeySteps.length - 1;
              return (
                <button
                  key={dir}
                  data-nodrag
                  disabled={off}
                  onClick={() => setArcOffset(Math.max(0, Math.min(journeySteps.length - 1, at + dir)))}
                  aria-label={dir < 0 ? "Previous step" : "Next step"}
                  style={{
                    width: "38px", height: "38px", borderRadius: "50%", border: "none", flexShrink: 0,
                    display: "grid", placeItems: "center", background: NEU.surface, boxShadow: NEU.upSm,
                    cursor: off ? "default" : "pointer", opacity: off ? 0.4 : 1,
                  }}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" style={{ fill: "none", stroke: "#4E6274", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
                    <path d={dir < 0 ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>

        {/* What's next — only the rows that actually apply */}
        {(wearPlan?.nextSet || nextKit) && (
          <div style={{ position: "relative", zIndex: 4, display: "flex", flexDirection: "column", gap: "8px", margin: "24px 20px 0" }}>
            {wearPlan?.nextSet && (
              <button
                onClick={() => { if (steps.smile_correction) setExpandedStep("smile_correction"); }}
                style={NEU_INFO_CARD}
              >
                <span style={NEU_INFO_ICON}>
                  <svg viewBox="0 0 24 24" width="20" height="20" style={{ fill: "none", stroke: NEU.gold, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}>
                    <path d="M20 7l-8-4-8 4 8 4 8-4z" /><path d="M4 7v10l8 4 8-4V7" />
                  </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={NEU_INFO_LABEL}>Next set</span>
                  <span style={NEU_INFO_VALUE}>Change to Set {wearPlan.nextSet}</span>
                  <span style={NEU_INFO_SUB}>
                    On {formatDayLabel(wearPlan.setStart(wearPlan.nextSet))} &middot; you&apos;re on Set {wearPlan.currentSet} of {wearPlan.total}
                  </span>
                </span>
                <span style={NEU_INFO_CHEV} />
              </button>
            )}

            {nextKit && (
              <button
                onClick={() => setExpandedStep(isNewModel ? "aligner_sets" : "manufacturing")}
                style={NEU_INFO_CARD}
              >
                <span style={NEU_INFO_ICON}>
                  <svg viewBox="0 0 24 24" width="20" height="20" style={{ fill: "none", stroke: nextKit.overdue ? "#A0603F" : NEU.gold, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}>
                    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" />
                  </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={NEU_INFO_LABEL}>Next kit</span>
                  <span style={{ ...NEU_INFO_VALUE, color: nextKit.overdue ? "#A0603F" : NEU.navy }}>
                    {nextKit.overdue ? "Order now" : "Order by " + formatDayLabel(nextKit.orderBy)}
                  </span>
                  <span style={NEU_INFO_SUB}>
                    Package {nextKit.num}{nextKit.slots ? " · " + nextKit.slots : ""} &middot; in wear {formatShortDay(nextKit.wearFrom)}
                  </span>
                </span>
                <span style={NEU_INFO_CHEV} />
              </button>
            )}
          </div>
        )}

        {/* Refer and earn — fills the bottom of the column */}
        <button
          onClick={() => { setDrawerView("refer"); setShowDrawer(true); }}
          style={{
            position: "relative", zIndex: 4, display: "block", width: "auto", margin: "20px 20px 28px",
            padding: 0, borderRadius: "26px", border: "none", cursor: "pointer", overflow: "hidden",
            background: NEU.surface, boxShadow: NEU.up, textAlign: "left", font: "inherit", color: NEU.navy,
          }}
        >
          {/* The illustration's own ground is rgb(249,246,238) — the card
              surface is within a couple of values of it, so it seams in
              without any cut-out. */}
          <img
            src="/refer-friend.webp"
            alt=""
            aria-hidden="true"
            style={{ position: "absolute", right: "-18px", bottom: 0, height: "100%", width: "auto", pointerEvents: "none" }}
          />
          {/* Fades the illustration out under the copy, so the text always
              sits on a clean field however the artwork is positioned. */}
          <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(90deg, " + NEU.surface + " 30%, rgba(247,245,238,0.72) 48%, rgba(247,245,238,0) 66%)" }} />
          <span style={{ position: "relative", zIndex: 1, display: "block", padding: "12px 0 12px 16px", maxWidth: "55%" }}>
            <span style={NEU_INFO_LABEL}>Refer and earn</span>
            <span style={{ display: "block", fontSize: "17.5px", fontWeight: "800", letterSpacing: "-0.03em", lineHeight: "1.12", color: NEU.navy }}>
              Refer a friend
            </span>
            <span style={{ display: "block", marginTop: "4px", fontSize: "11.5px", lineHeight: "1.4", color: NEU.slate }}>
              and get ₹500 discount on your next kit.
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "7px", marginTop: "13px",
              padding: "10px 16px", borderRadius: "99px", fontSize: "13px", fontWeight: "700", color: "#fff",
              background: "linear-gradient(135deg, #CBA164, #B8893F)",
              boxShadow: "-2px -2px 5px rgba(255,255,255,0.45), 3px 3px 9px rgba(150,110,46,0.42)",
            }}>
              Refer Now
              <svg viewBox="0 0 24 24" width="13" height="13" style={{ fill: "none", stroke: "#fff", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          </span>
        </button>

      </div>

      {/* ───── STEP PANEL — the opened step, raised off the ivory ───── */}
      {expandedStep && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
          <div onClick={() => setExpandedStep(null)} style={{ position: "absolute", inset: 0, background: "rgba(30,44,58,0.34)" }} />
          <div
            ref={cardRef}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "relative", width: "100%", maxWidth: "420px",
              maxHeight: "calc(100dvh - 120px)", overflowY: "auto",
              borderRadius: "32px", background: NEU.surface,
              boxShadow: "-8px -8px 20px rgba(255,255,255,0.7), 12px 12px 34px rgba(120,112,94,0.45)",
              padding: "26px 18px 24px",
            }}
          >
            <button
              onClick={() => setExpandedStep(null)}
              aria-label="Close"
              style={{ position: "absolute", top: "16px", right: "16px", zIndex: 3, width: "34px", height: "34px", borderRadius: "50%", border: "none", cursor: "pointer", background: NEU.surface, boxShadow: NEU.upSm, display: "grid", placeItems: "center", color: NEU.navy2, fontSize: "19px", lineHeight: 1 }}
            >
              ×
            </button>
            <div style={{ position: "relative" }}>
            {journeySteps.map((step, index) => {
              // Only the step the patient tapped renders here — the arc above
              // is the navigation now, and the sheet shows one step at a time.
              if (step.key !== expandedStep) return null;
              const done = steps[step.key];
              const isNext = !done && index > 0 && steps[journeySteps[index - 1]?.key];
              const isClickable = step.expandable && (!step.smileLink || steps[step.key]);
              const isExpanded = true;

              return (
                <div key={step.key} style={{ marginBottom: "10px", position: "relative", zIndex: 1 }}>
                  <div
                    onClick={() => isClickable && handleStepClick(step)}
                    style={{ display: "flex", alignItems: "flex-start", gap: "14px", cursor: isClickable ? "pointer" : "default" }}
                  >
                    {/* Circle */}
                    <div style={{ width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0, background: done ? "linear-gradient(155deg, #3FB3A4, #168F83)" : isNext ? "#C6922E" : "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px rgba(255,255,255,0.85)" }}>
                      {done ? <span style={{ color: "white", fontSize: "15px", fontWeight: "700" }}>✓</span> : <span style={{ color: isNext ? "white" : "#71818C", fontSize: "12px", fontWeight: "800" }}>{index + 1}</span>}
                    </div>

                    {/* Box */}
                    <div style={{ flex: 1, padding: 0, background: "transparent", border: "none", boxShadow: "none", marginTop: "4px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ width: "100%" }}>
                          <p style={{ margin: "0 0 3px", fontSize: "10px", fontWeight: "800", letterSpacing: "0.2em", textTransform: "uppercase", color: "#C6922E" }}>
                            Step {index + 1} of {journeySteps.length}
                          </p>
                          <p style={{ margin: 0, fontSize: "20px", fontWeight: "800", lineHeight: "1.15", letterSpacing: "-0.02em", color: "#0D2945" }}>
                            {step.label}
                          </p>
                          {step.key === "plan_approved" && done && (
                            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#168F83", lineHeight: "1.4" }}>
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
                              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#168F83", lineHeight: "1.4" }}>
                                {doneBatches.length > 0 ? `Batch ${doneBatches.join(", ")} — ` : ""}
                                Completed on {new Date(patient.journey_steps.manufacturing_completed_at + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            );
                          })()}
                          {step.subtext && (
                            <p style={{ margin: "2px 0 0", fontSize: "11px", color: done ? "#168F83" : "#9ca3af", lineHeight: "1.4" }}>
                              {step.subtext}
                            </p>
                          )}
                        </div>
                        {step.approveAction && (
                          patient.plan_approved ? (
                            <span style={{ flexShrink: 0, padding: "4px 10px", borderRadius: "99px", background: "rgba(21,158,145,0.12)", color: "#168F83", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap" }}>
                              ✓ Approved
                            </span>
                          ) : canApprovePlan ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApprovePlan(); }}
                              disabled={approving || !consentChecked}
                              style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "8px", border: "none", background: (approving || !consentChecked) ? "#d4a574" : "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: (approving || !consentChecked) ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: !consentChecked ? 0.6 : 1 }}
                            >
                              {approving ? "Approving..." : "Approve Plan"}
                            </button>
                          ) : (
                            <button
                              disabled
                              style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "8px", border: "none", background: "rgba(23,59,87,0.14)", color: "#9ca3af", fontWeight: "700", fontSize: "12px", cursor: "not-allowed", whiteSpace: "nowrap" }}
                            >
                              Approve Plan
                            </button>
                          )
                        )}
                        {step.key === "booked" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/patient/${id}/details`); }}
                            style={{ flexShrink: 0, padding: patient.age ? "4px 10px" : "7px 14px", borderRadius: "8px", border: "none", background: patient.age ? "rgba(21,158,145,0.12)" : "#b8905a", color: patient.age ? "#168F83" : "white", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
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
                        {/* The old stacked list needed a caret to say "this row
                            expands". The card only ever shows the one step the
                            patient opened, so the caret has nothing to toggle —
                            and it collided with the close button. */}
                      </div>
                      {step.key === "plan_approved" && canApprovePlan && !patient.plan_approved && (
                        <label
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(23,59,87,0.14)", cursor: "pointer" }}
                        >
                          <input
                            type="checkbox"
                            checked={consentChecked}
                            onChange={(e) => setConsentChecked(e.target.checked)}
                            style={{ width: "16px", height: "16px", marginTop: "1px", accentColor: "#b8905a", cursor: "pointer", flexShrink: 0 }}
                          />
                          <span style={{ fontSize: "12px", color: "#374151", lineHeight: "1.5" }}>
                            I have read and understood the{" "}
                            <a
                              href="/consent"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: "#b8905a", fontWeight: "700", textDecoration: "underline" }}
                            >
                              Consent Document
                            </a>{" "}
                            and agree to proceed with my treatment
                          </span>
                        </label>
                      )}
                    </div>
                  </div>


                  {/* Expanded Panel — Scanning and Provisional Planning */}
                  {/* Appointment Booked carries the patient's own details —
                      there is no separate patient card any more. */}
                  {step.key === "booked" && (
                    <div style={{ marginTop: "10px" }}>
                      <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#71818C" }}>Your details</p>
                      <div style={{ position: "relative", height: "1.5px", width: "82%", borderRadius: "2px", background: "linear-gradient(90deg, #C6922E 0%, rgba(198,146,46,0.18) 100%)", margin: "0 0 12px" }}>
                        {/* A tiny softly-glowing point near the bright end — light catching the gold line. */}
                        <div style={{ position: "absolute", left: "14%", top: "50%", width: "3px", height: "3px", borderRadius: "50%", transform: "translateY(-50%)", background: "#fff", boxShadow: "0 0 4px rgba(255,255,255,0.9), 0 0 7px rgba(198,146,47,0.55)" }} />
                      </div>
                      <p style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.9", color: "#71818C", fontVariantNumeric: "tabular-nums" }}>
                        <b style={{ color: "#0D2945", fontWeight: "600" }}>{patient.phone || "No phone"}</b><br />
                        ID <b style={{ color: "#C6922E", fontWeight: "700", letterSpacing: "0.02em" }}>{patientIdLabel}</b>
                        {patient.email ? <><br />{patient.email}</> : null}
                      </p>
                      <div style={{ marginTop: "18px" }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontSize: "10.5px", color: "#71818C", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: "600" }}>
                            {completedCount} of {journeySteps.length} steps
                          </span>
                          <span style={{ fontSize: "14px", color: "#159E91", fontWeight: "800" }}>{progressPct}%</span>
                        </div>
                        <div style={{ height: "8px", borderRadius: "99px", background: "#D4DEE3", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: "99px", width: `${progressPct}%`, background: "linear-gradient(90deg, #168F83, #159E91)", transition: "width 0.9s cubic-bezier(.2,.8,.3,1)" }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {step.key === "scanning_done" && isExpanded && (
                    <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
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

                      {/* Legacy model only — duration/plan text now live in Provisional
                          Planning and Full Plan respectively for the new model. */}
                      {!isNewModel && patient?.provisional_min_months && patient?.provisional_max_months && (() => {
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

                      {!isNewModel && (
                        <>
                          <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Your Provisional Plan</p>
                          {patient.provisional_plan ? (
                            <p style={{ margin: 0, fontSize: "14px", color: "#111827", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{patient.provisional_plan}</p>
                          ) : (
                            <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Your treatment plan is being prepared. Please check back soon.</p>
                          )}
                        </>
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

                  {/* Expanded Panel — Provisional Planning (plan choice) */}
                  {step.key === "provisional_planning" && isExpanded && (
                    <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Choose Your Plan</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {Object.values(PLAN_CONFIGS).map((cfg) => {
                          const isSelected = patient.payment_data?.plan === cfg.key;
                          const isLocked = !!patient.monthly_plan;
                          const estimatePlan = patient.journey_steps?.provisional_estimate_plan || "ORISPRO";
                          const hasEstimate = patient.provisional_min_months && patient.provisional_max_months;
                          const durationForCfg = hasEstimate
                            ? estimateRangeForPlan(patient.provisional_min_months, patient.provisional_max_months, estimatePlan, cfg.key)
                            : null;
                          return (
                            <button
                              key={cfg.key}
                              onClick={(e) => { e.stopPropagation(); selectProvisionalPlan(cfg.key); }}
                              disabled={isLocked || savingProvisionalPlan}
                              style={{
                                textAlign: "left", padding: "14px", borderRadius: "10px",
                                border: isSelected ? "2px solid #159E91" : "1px solid rgba(23,59,87,0.14)",
                                background: isSelected ? "rgba(21,158,145,0.10)" : "white",
                                cursor: isLocked ? "default" : "pointer",
                                opacity: isLocked && !isSelected ? 0.5 : 1,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <span style={{ fontSize: "14px", fontWeight: "800", color: "#111827" }}>{cfg.label}</span>
                                {isSelected && <span style={{ fontSize: "11px", fontWeight: "700", color: "#b8905a" }}>✓ SELECTED</span>}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <span style={{ fontSize: "13px", color: "#374151" }}>{fmt(cfg.monthRate)} per month</span>
                                <span style={{ fontSize: "13px", color: "#374151" }}>Wear: {cfg.daysPerSet} days per set / {cfg.setsPerMonth} sets per month</span>
                                <span style={{ fontSize: "13px", color: "#374151" }}>
                                  Estimated duration: {durationForCfg
                                    ? (durationForCfg.min === durationForCfg.max
                                        ? formatMonthsDays(durationForCfg.min)
                                        : `${formatMonthsDays(durationForCfg.min)} – ${formatMonthsDays(durationForCfg.max)}`)
                                    : "to be confirmed by your orthodontist"}
                                </span>
                              </div>
                            </button>
                          );
                        })}

                        {/* Third option — independent of which plan is picked above:
                            pay the flat ₹2,499 planning fee only, straight to Cashfree
                            (no gateway picker), to unlock the final 3D plan now and pay
                            for the first month separately once it's ready. */}
                        {(() => {
                          const amountPaidNow = Number(patient.amount_paid) || 0;
                          const choice = patient.payment_data?.provisional_payment_choice;
                          const isLocked = !!patient.monthly_plan;
                          const fullPlanPaid = choice === "full_plan" && amountPaidNow >= PROVISIONAL_PLAN_FEE;
                          // Mutually exclusive with "Pay First Month" below — once that's
                          // chosen this flat fee no longer applies.
                          if (choice === "first_month") return null;
                          return (
                            <button
                              onClick={(e) => { e.stopPropagation(); selectPaymentChoiceAndPay("full_plan", PROVISIONAL_PLAN_FEE, "cashfree"); }}
                              disabled={isLocked || fullPlanPaid || payNowLoading}
                              style={{
                                textAlign: "left", padding: "14px", borderRadius: "10px",
                                border: fullPlanPaid ? "2px solid #168F83" : "1px dashed #159E91",
                                background: fullPlanPaid ? "rgba(21,158,145,0.08)" : "rgba(21,158,145,0.10)",
                                cursor: (isLocked || fullPlanPaid || payNowLoading) ? "default" : "pointer",
                                opacity: isLocked && !fullPlanPaid ? 0.5 : 1,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                <span style={{ fontSize: "14px", fontWeight: "800", color: "#111827" }}>Pay for Full Planning Only</span>
                                {fullPlanPaid && <span style={{ fontSize: "11px", fontWeight: "700", color: "#168F83" }}>✓ PAID</span>}
                              </div>
                              <span style={{ fontSize: "13px", color: "#374151" }}>
                                {fullPlanPaid
                                  ? `Paid ${fmt(PROVISIONAL_PLAN_FEE)} — your final plan is being prepared.`
                                  : `${fmt(Math.max(0, PROVISIONAL_PLAN_FEE - amountPaidNow))} — get your final 3D plan first, pay for your first month separately once it's ready.`}
                              </span>
                            </button>
                          );
                        })()}
                      </div>
                      {patient.monthly_plan && (
                        <p style={{ margin: "12px 0 0", fontSize: "11px", color: "#9ca3af", fontStyle: "italic" }}>
                          Your plan is locked in now that your final treatment schedule has been generated.
                        </p>
                      )}

                      {/* "Pay First Month" — shown once a plan is picked, unless the
                          flat planning-only fee was already paid instead. */}
                      {patient.payment_data?.plan && patient.payment_data?.provisional_payment_choice !== "full_plan" && (() => {
                        const cfg = PLAN_CONFIGS[patient.payment_data.plan] || PLAN_CONFIGS.ORISPRO;
                        const amountPaidNow = Number(patient.amount_paid) || 0;
                        const isPaid = amountPaidNow >= cfg.monthRate && patient.payment_data?.provisional_payment_choice === "first_month";
                        return (
                          <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(23,59,87,0.14)" }}>
                            <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Payment</p>
                            {isPaid ? (
                              <div style={{ padding: "10px 12px", background: "rgba(21,158,145,0.08)", borderRadius: "8px", border: "1px solid rgba(21,158,145,0.40)" }}>
                                <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: "#168F83" }}>✓ Paid — First Month ({fmt(cfg.monthRate)})</p>
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.6" }}>
                                  Pay your first month upfront — unlocks your final plan and pays for Month 1 in one go.
                                </p>
                                <button
                                  onClick={(e) => { e.stopPropagation(); selectPaymentChoiceAndPay("first_month", cfg.monthRate); }}
                                  disabled={payNowLoading}
                                  style={{ display: "block", width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #b8905a, #f59e0b)", color: "white", fontWeight: "800", fontSize: "14px", cursor: payNowLoading ? "not-allowed" : "pointer", opacity: payNowLoading ? 0.7 : 1 }}
                                >
                                  Pay First Month · {fmt(Math.max(0, cfg.monthRate - amountPaidNow))}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Expanded Panel — Prealigner Treatment */}
                  {step.key === "prealigner_treatment" && isExpanded && (() => {
                    const procs = prealignerProcedures(patient);
                    const doneMap = patient.journey_steps?.prealigner_done || {};
                    return (
                      <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
                        <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Prealigner Treatment</p>
                        {procs.length === 0 ? (
                          <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>No prealigner treatment needed — your dentist didn't flag any procedures.</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {procs.map((proc) => {
                              const doneAt = doneMap[proc];
                              return (
                                <div key={proc} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: doneAt ? "rgba(21,158,145,0.08)" : "rgba(255,255,255,0.28)", borderRadius: "8px", border: doneAt ? "1px solid rgba(21,158,145,0.40)" : "1px solid transparent" }}>
                                  <div>
                                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{proc}</span>
                                    {doneAt && (
                                      <span style={{ display: "block", fontSize: "11px", color: "#168F83", marginTop: "2px" }}>
                                        Done on {new Date(doneAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                      </span>
                                    )}
                                  </div>
                                  {doneAt ? (
                                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#168F83" }}>✓ Done</span>
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
                    <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Your Aligner Plan</p>
                      {patient.aligner_total_sets && patient.aligner_days_per_set ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {[
                            ["Total Number of Sets", patient.aligner_total_sets],
                            ["Wear Duration per Set", `${patient.aligner_days_per_set} days`],
                            ["Total Treatment Duration", `${patient.aligner_total_sets * patient.aligner_days_per_set} days (~${Math.round((patient.aligner_total_sets * patient.aligner_days_per_set) / 30)} months)`],
                          ].map(([lbl, val]) => (
                            <div key={lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.28)", borderRadius: "8px" }}>
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
                      <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
                        <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Manufacturing</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {rows.map((r) => (
                            <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: r.done ? "rgba(21,158,145,0.08)" : "rgba(255,255,255,0.28)", borderRadius: "8px", border: r.done ? "1px solid rgba(21,158,145,0.40)" : "1px solid transparent" }}>
                              <div>
                                <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{r.label}</span>
                                {r.done && r.at && (
                                  <span style={{ display: "block", fontSize: "11px", color: "#168F83", marginTop: "2px" }}>
                                    {r.batches.length > 0 ? `Batch ${r.batches.join(", ")} — ` : ""}
                                    {new Date(r.at + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: "12px", fontWeight: "700", color: r.done ? "#168F83" : "#9ca3af" }}>{r.done ? "✓ Done" : "Pending"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Expanded Panel — Aligners Dispatched */}
                  {step.key === "aligners_dispatched" && isExpanded && (
                    <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
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
                                <div key={batch.num} style={{ padding: "12px", background: "rgba(255,255,255,0.28)", borderRadius: "10px" }}>
                                  <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "700", color: "#111827" }}>
                                    Batch {batch.num}{range}{partnerName ? ` • ${partnerName}` : ""}
                                  </p>
                                  {batch.shipment_id && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <div style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", background: "white", border: "1px solid rgba(23,59,87,0.14)", fontSize: "13px", color: "#111827", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {batch.shipment_id}
                                      </div>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCopyShipmentId(batch.num, batch.shipment_id); }}
                                        style={{ flexShrink: 0, padding: "8px 12px", borderRadius: "8px", border: "none", background: copiedNum === batch.num ? "#168F83" : "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
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
                    <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
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
                                <div key={batch.num} style={{ padding: "12px", background: "rgba(255,255,255,0.28)", borderRadius: "10px" }}>
                                  <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "700", color: "#111827" }}>
                                    Batch {batch.num}{range}
                                  </p>
                                  {batch.aligner_received ? (
                                    <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#168F83" }}>
                                      ✓ Received on {new Date(batch.aligner_received + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                    </p>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMarkReceived(batch.num); }}
                                      disabled={receivingBatch === batch.num}
                                      style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #168F83", background: receivingBatch === batch.num ? "rgba(21,158,145,0.08)" : "white", color: "#168F83", fontWeight: "700", fontSize: "13px", cursor: receivingBatch === batch.num ? "not-allowed" : "pointer" }}
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
                    <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none", opacity: done ? 1 : 0.5 }}>
                      <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "700", color: done ? "#0F5F58" : "#9ca3af" }}>🎁 Share Your Feedback</p>
                      <p style={{ margin: "0 0 14px", fontSize: "13px", color: done ? "#374151" : "#9ca3af", lineHeight: "1.6" }}>
                        We would love to hear from you! Kindly submit your feedback at the end of treatment to avail your <strong>hamper worth ₹5,000</strong>.
                      </p>
                      {done ? (
                        <a href="https://wa.me/918280837370?text=Hi%20OrisAlign%2C%20I%20would%20like%20to%20share%20my%20feedback%20about%20my%20treatment." target="_blank" rel="noopener noreferrer"
                          style={{ display: "block", padding: "12px", borderRadius: "10px", background: "#C9A84C", color: "#1B2A4A", fontWeight: "700", fontSize: "14px", textAlign: "center", textDecoration: "none" }}>
                          ✍️ Write My Feedback
                        </a>
                      ) : (
                        <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(23,59,87,0.14)", color: "#9ca3af", fontWeight: "700", fontSize: "14px", textAlign: "center", cursor: "not-allowed" }}>
                          ✍️ Available after treatment completion
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expanded Panel — Full Plan (content only — payment now lives in Provisional Planning) */}
                  {step.key === "payment_done" && isExpanded && (isNewModel ? (
                    <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Full Plan</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {patient.final_plan && (
                          <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{patient.final_plan}</p>
                        )}
                        <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Your Aligner Plan</p>
                        {patient.monthly_plan?.totalMonths ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {[
                              ["Upper Arch Sets", patient.final_upper_sets],
                              ["Lower Arch Sets", patient.final_lower_sets],
                              ["Wear Duration per Set", `${(PLAN_CONFIGS[patient.payment_data?.plan] || PLAN_CONFIGS.ORISPRO).daysPerSet} days`],
                              ["Upper Arch Duration", formatMonthsDays((patient.final_upper_sets * (PLAN_CONFIGS[patient.payment_data?.plan] || PLAN_CONFIGS.ORISPRO).daysPerSet) / 30)],
                              ["Lower Arch Duration", formatMonthsDays((patient.final_lower_sets * (PLAN_CONFIGS[patient.payment_data?.plan] || PLAN_CONFIGS.ORISPRO).daysPerSet) / 30)],
                            ].map(([lbl, val]) => (
                              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.28)", borderRadius: "8px" }}>
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
                    </div>
                  ) : (
                    <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
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
                                    border: selectedPlan === p.value ? "2px solid #159E91" : "1px solid rgba(23,59,87,0.14)",
                                    background: selectedPlan === p.value ? "rgba(255,255,255,0.28)" : "white",
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
                            <div style={{ padding: "10px 12px", background: "rgba(21,158,145,0.08)", borderRadius: "8px", border: "1px solid rgba(21,158,145,0.40)" }}>
                              <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: "#168F83" }}>✓ Fully Paid</p>
                            </div>
                          )}
                          <div style={{ padding: "14px", background: "rgba(255,255,255,0.28)", borderRadius: "10px", border: "1px solid rgba(23,59,87,0.14)" }}>
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

                          {/* Per-installment payment — each unpaid installment gets its own
                              Pay Now, routing through the existing /checkout page (Razorpay
                              or Cashfree, patient's choice). Payments apply to the oldest
                              unpaid installment first, same as any EMI schedule. */}
                          {pd.pending_plan?.installments?.length > 0 && patient.payment_status !== "paid" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {pd.pending_plan.installments.map((inst) => (
                                <div key={inst.num} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", background: inst.paid ? "rgba(21,158,145,0.08)" : "rgba(255,255,255,0.28)", borderRadius: "8px", border: inst.paid ? "1px solid rgba(21,158,145,0.40)" : "1px solid rgba(23,59,87,0.14)" }}>
                                  <div>
                                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>Installment {inst.num} — {fmt(inst.amount)}</span>
                                    <span style={{ display: "block", fontSize: "11px", color: "#6b7280" }}>
                                      {inst.paid ? `Paid on ${new Date(inst.paid_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : `Due ${new Date(inst.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                                    </span>
                                  </div>
                                  {inst.paid ? (
                                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#168F83" }}>✓ Paid</span>
                                  ) : (
                                    <button
                                      onClick={() => handlePayNow(inst.amount)}
                                      disabled={payNowLoading}
                                      style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "8px", border: "none", background: "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: payNowLoading ? "not-allowed" : "pointer", opacity: payNowLoading ? 0.7 : 1, whiteSpace: "nowrap" }}
                                    >
                                      {payNowLoading ? "..." : "Pay Now"}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {patient.payment_status !== "paid" && !patient.amount_paid && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => setPaymentMode("down")}
                                style={{
                                  flex: 1,
                                  padding: "10px",
                                  borderRadius: "8px",
                                  border: paymentMode === "down" ? "2px solid #159E91" : "1px solid rgba(23,59,87,0.14)",
                                  background: paymentMode === "down" ? "rgba(255,255,255,0.28)" : "white",
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
                                  border: paymentMode === "full" ? "2px solid #159E91" : "1px solid rgba(23,59,87,0.14)",
                                  background: paymentMode === "full" ? "rgba(255,255,255,0.28)" : "white",
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
                                <div style={{ padding: "12px", background: "rgba(21,158,145,0.08)", borderRadius: "8px", border: "1px solid rgba(21,158,145,0.40)" }}>
                                  <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#168F83", textTransform: "uppercase" }}>Amount to Pay</p>
                                  <p style={{ margin: 0, fontSize: "24px", fontWeight: "900", color: "#12706A" }}>{fmt(amountDue)}</p>
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
                                          border: "1px solid rgba(23,59,87,0.14)",
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
                                        background: couponMessage.includes("✓") ? "rgba(21,158,145,0.08)" : "#fee2e2",
                                        border: couponMessage.includes("✓") ? "1px solid rgba(21,158,145,0.40)" : "1px solid #fecaca",
                                        color: couponMessage.includes("✓") ? "#168F83" : "#dc2626",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                      }}>
                                        {couponMessage}
                                      </div>
                                    )}

                                    {appliedCoupons.length > 0 && (
                                      <div style={{ padding: "10px 12px", background: "#D7EFEB", borderRadius: "8px" }}>
                                        <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: "#0F5F58", textTransform: "uppercase" }}>Coupons Applied</p>
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

                  {/* Expanded Panel — Investigation Required */}
                  {step.key === "investigation_required" && isExpanded && (
                    <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Investigation Required</p>
                      {(() => {
                        const types = patient.journey_steps?.investigation_types || [];
                        const files = patient.journey_steps?.investigation_files || {};
                        if (types.length === 0) {
                          return <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>Your orthodontist will confirm shortly whether any investigation is needed before your plan can be approved.</p>;
                        }
                        if (types.includes("NONE")) {
                          return (
                            <div style={{ padding: "10px 12px", background: "rgba(21,158,145,0.08)", borderRadius: "8px", border: "1px solid rgba(21,158,145,0.40)" }}>
                              <p style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: "#168F83" }}>✓ No investigation required</p>
                            </div>
                          );
                        }
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {types.map((t) => {
                              const typeInfo = INVESTIGATION_TYPES.find((it) => it.key === t);
                              const file = files[t];
                              const isUploading = uploadingInvestigation === t;
                              return (
                                <div key={t} style={{ padding: "12px", background: "rgba(255,255,255,0.28)", borderRadius: "10px", border: "1px solid rgba(23,59,87,0.14)" }}>
                                  <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "700", color: "#111827" }}>{typeInfo?.label || t}</p>
                                  {file?.path ? (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                      <span style={{ fontSize: "12px", color: "#168F83", fontWeight: "700" }}>✓ Uploaded — {file.name}</span>
                                      <button
                                        onClick={() => viewInvestigationFile(file.path)}
                                        style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(23,59,87,0.14)", background: "white", color: "#111827", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
                                      >
                                        View
                                      </button>
                                    </div>
                                  ) : (
                                    <label style={{
                                      display: "block", padding: "10px", borderRadius: "8px", textAlign: "center",
                                      background: isUploading ? "rgba(23,59,87,0.14)" : "#b8905a", color: isUploading ? "#9ca3af" : "white",
                                      fontWeight: "700", fontSize: "13px", cursor: isUploading ? "not-allowed" : "pointer",
                                    }}>
                                      {isUploading ? "Uploading..." : "Upload Image or PDF"}
                                      <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        disabled={isUploading}
                                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; uploadInvestigationFile(t, f); }}
                                        style={{ display: "none" }}
                                      />
                                    </label>
                                  )}
                                </div>
                              );
                            })}
                            {patient.journey_steps?.investigation_review_note && (
                              <div style={{ padding: "12px", background: "rgba(21,158,145,0.10)", borderRadius: "10px", border: "1px solid #A9DCD5" }}>
                                <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", color: "#b45309", textTransform: "uppercase" }}>Orthodontist's Review Note</p>
                                <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{patient.journey_steps.investigation_review_note}</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

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
                    <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>Aligner Sets — Package by Package</p>

                      {unpaidNums.length > 0 && (
                        <div style={{ marginBottom: "14px", padding: "12px", background: "rgba(21,158,145,0.08)", borderRadius: "10px", border: "1px solid rgba(21,158,145,0.40)" }}>
                          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#374151" }}>
                            Select one or more packages below, then place your order.
                          </p>
                          <button
                            onClick={() => handlePayNow(selectedTotal)}
                            disabled={payNowLoading || selectedPackages.length === 0}
                            style={{
                              display: "block", width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                              background: selectedPackages.length === 0 ? "rgba(23,59,87,0.14)" : "linear-gradient(135deg, #b8905a, #f59e0b)",
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
                            <div key={m.num} style={{ border: `1px solid ${isPaid ? "rgba(21,158,145,0.40)" : isSelected ? "#159E91" : "rgba(23,59,87,0.14)"}`, borderRadius: "10px", overflow: "hidden" }}>
                              <div
                                onClick={() => (isPaid ? setExpandedMonth(isExpandedMonth ? null : m.num) : toggleSelected(m.num))}
                                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: isPaid ? "rgba(21,158,145,0.08)" : isSelected ? "rgba(21,158,145,0.10)" : "rgba(255,255,255,0.28)", cursor: "pointer" }}
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
                                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: isPaid ? "#168F83" : "#9ca3af" }}>
                                      {fmt(m.payableAmount)}{isPaid ? " · Paid" : ""}
                                    </p>
                                  </div>
                                </div>
                                {isPaid && <span style={{ fontSize: "12px", color: "#168F83" }}>{isExpandedMonth ? "▲" : "▼"}</span>}
                              </div>
                              {isPaid && isExpandedMonth && (
                                <div style={{ padding: "12px", borderTop: "1px solid rgba(23,59,87,0.14)", display: "flex", flexDirection: "column", gap: "8px" }}>
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
                                    <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: r.done ? "rgba(21,158,145,0.08)" : "rgba(255,255,255,0.28)", borderRadius: "8px" }}>
                                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#111827" }}>
                                        {r.label}{r.done && r.at ? ` — ${new Date(r.at + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                                      </span>
                                      <span style={{ fontSize: "11px", fontWeight: "700", color: r.done ? "#168F83" : "#9ca3af" }}>{r.done ? "✓ Done" : "Pending"}</span>
                                    </div>
                                  ))}
                                  {batch?.shipment_id && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <div style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", background: "white", border: "1px solid rgba(23,59,87,0.14)", fontSize: "13px", color: "#111827", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {batch.shipment_id}
                                      </div>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCopyShipmentId(m.num, batch.shipment_id); }}
                                        style={{ flexShrink: 0, padding: "8px 12px", borderRadius: "8px", border: "none", background: copiedNum === m.num ? "#168F83" : "#b8905a", color: "white", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
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
                                    <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#168F83" }}>
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

                  {/* Expanded Panel — Smile Correction (set-by-set bite photos) */}
                  {step.key === "smile_correction" && isExpanded && (() => {
                    const js = patient.journey_steps || {};
                    const isSetup = js.smile_sets_count && js.smile_start_date;
                    const daysPerSet = js.smile_days_per_set || patient.aligner_days_per_set || 15;

                    if (!isSetup) {
                      return (
                        <div style={{ marginLeft: 0, marginTop: "10px", padding: "16px", background: "rgba(255,255,255,0.28)", borderRadius: "12px", border: "1px solid rgba(23,59,87,0.14)", textAlign: "center" }}>
                          <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.6" }}>
                            Our team is finalising your aligner schedule. Once it&apos;s ready, your set-by-set plan and photo uploads will appear here.
                          </p>
                        </div>
                      );
                    }

                    // WhatsApp's/Instagram's built-in browser is known to
                    // stall or silently drop photo uploads that a real
                    // browser (Chrome, Safari) handles fine — patients open
                    // these reminder links straight from WhatsApp, so warn
                    // them upfront instead of only after an upload fails.
                    const inAppBrowser = typeof navigator !== "undefined" && /(WhatsApp|Instagram|FBAN|FBAV|Line\/)/i.test(navigator.userAgent);

                    return (
                      <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
                        {inAppBrowser && (
                          <div style={{ marginBottom: "12px", padding: "10px 12px", borderRadius: "10px", background: "rgba(198,146,47,0.12)", border: "1px solid rgba(198,146,47,0.3)" }}>
                            <p style={{ margin: 0, fontSize: "11.5px", color: "#7a5a1e", lineHeight: "1.5" }}>
                              If photo uploads fail or hang here, tap the ⋮ menu above and choose &quot;Open in Chrome&quot; (or your regular browser) — this often works better than uploading from inside WhatsApp.
                            </p>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                          {[
                            ["Total Sets", js.smile_sets_count],
                            ["Start Date", new Date(js.smile_start_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })],
                            ["Days / Set", String(daysPerSet)],
                          ].map(([label, val]) => (
                            <div key={label} style={{ flex: 1, background: "rgba(255,255,255,0.28)", borderRadius: "10px", padding: "10px 8px", textAlign: "center", border: "1px solid rgba(23,59,87,0.14)" }}>
                              <p style={{ margin: 0, fontSize: "9.5px", fontWeight: "700", color: "#6b7280", letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</p>
                              <p style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: "800", color: "#111827" }}>{val}</p>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {Array.from({ length: js.smile_sets_count }, (_, i) => {
                            const setNum = i + 1;
                            const setDate = getSmileSetDate(i, js.smile_start_date, daysPerSet);
                            const setImages = js.smile_set_images?.[setNum] || {};
                            const bothUploaded = setImages.edge_to_edge && setImages.complete_bite;

                            return (
                              <div key={setNum} style={{ border: `1px solid ${bothUploaded ? "rgba(21,158,145,0.40)" : "rgba(23,59,87,0.14)"}`, borderRadius: "10px", padding: "12px", background: bothUploaded ? "rgba(21,158,145,0.08)" : "rgba(255,255,255,0.28)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                  <div style={{ width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0, background: bothUploaded ? "linear-gradient(135deg, #3FB3A4, #168F83)" : "linear-gradient(135deg, #b8905a, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "13px" }}>
                                    {bothUploaded ? "✓" : setNum}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827" }}>Set {setNum}</p>
                                    <p style={{ margin: 0, fontSize: "11px", color: "#6b7280" }}>Start: {setDate}</p>
                                  </div>
                                  {bothUploaded && (
                                    <span style={{ fontSize: "10px", fontWeight: "700", color: "#168F83", background: "rgba(21,158,145,0.15)", padding: "3px 8px", borderRadius: "99px", whiteSpace: "nowrap" }}>
                                      Complete
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                  {[
                                    { type: "edge_to_edge", label: "Edge to Edge Bite" },
                                    { type: "complete_bite", label: "Complete Bite" },
                                  ].map(({ type, label }) => {
                                    const imgUrl = setImages[type];
                                    const isUploading = uploadingSmileImage === `${setNum}-${type}`;
                                    return (
                                      <div key={type}>
                                        <p style={{ margin: "0 0 5px", fontSize: "9.5px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</p>
                                        <label
                                          onClick={(e) => e.stopPropagation()}
                                          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: "10px", border: `2px dashed ${imgUrl ? "#3FB3A4" : "rgba(23,59,87,0.25)"}`, background: imgUrl ? "rgba(21,158,145,0.10)" : "rgba(255,255,255,0.35)", cursor: "pointer", overflow: "hidden", aspectRatio: "4/3", position: "relative" }}
                                        >
                                          {imgUrl ? (
                                            <img src={imgUrl} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                          ) : isUploading ? (
                                            <p style={{ margin: 0, fontSize: "11px", color: "#6b7280" }}>Uploading...</p>
                                          ) : (
                                            <>
                                              <span style={{ fontSize: "18px", marginBottom: "3px" }}>📷</span>
                                              <p style={{ margin: 0, fontSize: "9.5px", color: "#9ca3af", textAlign: "center", padding: "0 6px" }}>Tap to upload</p>
                                            </>
                                          )}
                                          <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            disabled={isUploading}
                                            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadSmileSetImage(setNum, type, f); }}
                                          />
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSmileRefinement(); }}
                            style={{ padding: "10px 16px", borderRadius: "10px", border: js.refinement ? "none" : "1px solid rgba(23,59,87,0.14)", background: js.refinement ? "rgba(21,158,145,0.15)" : "rgba(255,255,255,0.35)", color: js.refinement ? "#168F83" : "#374151", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
                          >
                            {js.refinement ? "✓ Refinement" : "Refinement"}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEndSmileJourney(); }}
                            style={{ padding: "10px 16px", borderRadius: "10px", background: "#173B57", color: "white", fontWeight: "700", fontSize: "12px", border: "none", cursor: "pointer" }}
                          >
                            End Journey
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
            </div>
          </div>
        </div>
      )}

      {/* ───── NOTIFICATION ONBOARDING — shown once, the first time the app
          opens on a device the OS hasn't been asked on yet. ───── */}
      {showNotifOnboarding && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={handleDismissNotifOnboarding} style={{ position: "absolute", inset: 0, background: "rgba(13,41,68,0.35)" }} />
          <div style={{
            position: "relative", width: "100%", maxWidth: "460px", margin: "0 12px 12px",
            padding: "26px 22px 22px", borderRadius: "22px",
            background: "rgba(255,255,255,0.94)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 24px 60px rgba(26,76,100,0.22)",
          }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", marginBottom: "14px", display: "grid", placeItems: "center", background: "linear-gradient(145deg, #35B7A8 0%, #159F91 55%, #078F82 100%)" }}>
              <svg viewBox="0 0 24 24" width="22" height="22" style={{ fill: "none", stroke: "#fff", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <p style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: "800", color: "#0D2945" }}>Stay updated on your treatment</p>
            <p style={{ margin: "0 0 20px", fontSize: "13.5px", lineHeight: "1.6", color: "#71818C" }}>
              Get notified the moment your plan is approved, your aligners are ready, or a new step needs your attention — instead of having to check back.
            </p>
            <button
              onClick={handleEnableNotifications}
              style={{ display: "block", width: "100%", padding: "13px", marginBottom: "10px", borderRadius: "12px", border: "none", cursor: "pointer", background: "linear-gradient(145deg, #35B7A8, #078F82)", color: "#fff", fontWeight: "800", fontSize: "14px", boxShadow: "0 8px 20px rgba(8,90,90,0.16)" }}
            >
              Enable Notifications
            </button>
            <button
              onClick={handleDismissNotifOnboarding}
              style={{ display: "block", width: "100%", padding: "10px", borderRadius: "12px", border: "none", cursor: "pointer", background: "none", color: "#71818C", fontWeight: "700", fontSize: "13px" }}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* ───── APPOINTMENTS CALENDAR ───── */}
      {showCalendar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 18px" }}>
          <div onClick={() => setShowCalendar(false)} style={{ position: "absolute", inset: 0, background: "rgba(30,44,58,0.34)" }} />
          <div style={{
            position: "relative", width: "100%", maxWidth: "420px", padding: "26px 20px 22px",
            borderRadius: "32px", background: NEU.surface,
            boxShadow: "-8px -8px 20px rgba(255,255,255,0.7), 12px 12px 34px rgba(120,112,94,0.45)",
          }}>
            <button
              onClick={() => setShowCalendar(false)}
              aria-label="Close"
              style={{ position: "absolute", top: "16px", right: "16px", width: "34px", height: "34px", borderRadius: "50%", border: "none", cursor: "pointer", background: NEU.surface, boxShadow: NEU.upSm, display: "grid", placeItems: "center", color: NEU.navy2, fontSize: "19px", lineHeight: 1 }}
            >
              ×
            </button>
            <p style={{ margin: "0 0 18px", fontSize: "20px", fontWeight: "800", letterSpacing: "-0.025em", color: NEU.navy }}>
              {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", marginBottom: "8px" }}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i} style={{ textAlign: "center", fontSize: "10px", fontWeight: "700", letterSpacing: "0.1em", color: NEU.slate2 }}>{d}</span>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px" }}>
              {(() => {
                const now = new Date();
                const first = new Date(now.getFullYear(), now.getMonth(), 1);
                const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const cells = [];
                for (let i = 0; i < first.getDay(); i++) cells.push(<span key={`b${i}`} />);
                for (let d = 1; d <= days; d++) {
                  const today = d === now.getDate();
                  cells.push(
                    <span key={d} style={{
                      display: "grid", placeItems: "center", aspectRatio: "1", borderRadius: "11px",
                      fontSize: "12.5px", fontWeight: "600", fontVariantNumeric: "tabular-nums",
                      color: today ? "#fff" : NEU.navy2,
                      background: today ? "linear-gradient(135deg, #CBA164, #B8893F)" : "transparent",
                      boxShadow: today ? "-2px -2px 5px rgba(255,255,255,0.5), 3px 3px 8px rgba(150,110,46,0.4)" : "none",
                    }}>{d}</span>
                  );
                }
                return cells;
              })()}
            </div>
            <p style={{ margin: "18px 2px 0", fontSize: "11.5px", lineHeight: "1.55", color: NEU.slate }}>
              Your appointments will show up here once they&apos;re scheduled.
            </p>
          </div>
        </div>
      )}

      {/* Turning notifications off is a real setback for the patient, so it
          asks first. Android won't let an app revoke its own OS permission,
          so "off" means this device stops being sent to — its token is
          dropped and not re-registered until they switch it back on. */}
      {showDisableConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 22px" }}>
          <div onClick={() => setShowDisableConfirm(false)} style={{ position: "absolute", inset: 0, background: "rgba(30,44,58,0.4)" }} />
          <div style={{
            position: "relative", width: "100%", maxWidth: "380px", padding: "26px 22px 22px",
            borderRadius: "30px", background: NEU.surface,
            boxShadow: "-8px -8px 20px rgba(255,255,255,0.7), 12px 12px 34px rgba(120,112,94,0.45)",
          }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "16px", marginBottom: "14px", display: "grid", placeItems: "center", background: NEU.surface, boxShadow: NEU.upSm }}>
              <svg viewBox="0 0 24 24" width="22" height="22" style={{ fill: "none", stroke: "#A0603F", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /><path d="M3 3l18 18" />
              </svg>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "800", letterSpacing: "-0.02em", color: NEU.navy }}>
              Turn off notifications?
            </p>
            <p style={{ margin: "0 0 20px", fontSize: "13.5px", lineHeight: "1.6", color: NEU.slate }}>
              Disabling notifications might affect the progress of your treatment, since updates about your aligners will reach you late. Are you sure you want to disable them?
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowDisableConfirm(false)}
                style={{ flex: 1, padding: "14px", borderRadius: "16px", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: "700", fontSize: "13.5px", background: NEU.surface, boxShadow: NEU.upSm, color: NEU.navy }}
              >
                No, keep them on
              </button>
              <button
                onClick={disableNotifications}
                style={{ flex: "0 0 auto", padding: "14px 22px", borderRadius: "16px", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: "700", fontSize: "13.5px", background: NEU.surface2, boxShadow: NEU.insetSm, color: "#A0603F" }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── MENU ───── */}
      {showDrawer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
          <div onClick={() => { setShowDrawer(false); setDrawerView("root"); }} style={{ position: "absolute", inset: 0, background: "rgba(30,44,58,0.36)" }} />
          <aside style={{
            position: "absolute", top: 0, left: 0, bottom: 0, width: "296px", maxWidth: "86%",
            display: "flex", flexDirection: "column", background: NEU.ivory,
            boxShadow: "14px 0 40px -14px rgba(120,112,94,0.55)",
          }}>
            <div style={{ position: "relative", flex: "0 0 auto", padding: "62px 20px 20px" }}>
              {drawerView !== "root" && (
                <button
                  onClick={() => setDrawerView("root")}
                  aria-label="Back"
                  style={{ position: "absolute", top: "16px", left: "18px", width: "34px", height: "34px", borderRadius: "50%", border: "none", cursor: "pointer", background: NEU.surface, boxShadow: NEU.upSm, display: "grid", placeItems: "center" }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" style={{ fill: "none", stroke: "#4E6274", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" }}><path d="M15 18l-6-6 6-6" /></svg>
                </button>
              )}
              <button
                onClick={() => { setShowDrawer(false); setDrawerView("root"); }}
                aria-label="Close menu"
                style={{ position: "absolute", top: "16px", right: "18px", width: "34px", height: "34px", borderRadius: "50%", border: "none", cursor: "pointer", background: NEU.surface, boxShadow: NEU.upSm, display: "grid", placeItems: "center", color: NEU.navy2, fontSize: "18px", lineHeight: 1 }}
              >
                ×
              </button>
              <p style={{ margin: 0, fontSize: "21px", fontWeight: "800", letterSpacing: "-0.025em", color: NEU.navy }}>
                Hi, {patient.name || "there"}
              </p>
              <p style={{ margin: "5px 0 0", fontSize: "10.5px", fontWeight: "700", letterSpacing: "0.18em", textTransform: "uppercase", color: NEU.goldD }}>
                {patientIdLabel}
              </p>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 18px" }}>
              {drawerView === "root" && (
                <div>
                  {[
                    { key: "info", title: "Info", sub: "Name, age, gender, address", icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>' },
                    { key: "push" },
                    { key: "callback", title: "Request a Callback", sub: "We'll ring you back", icon: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L8.1 9.5a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z"/>' },
                    { key: "feedback", title: "Feedback", sub: "Tell us how it's going", icon: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>' },
                    { key: "refer", title: "Refer a Friend", sub: "Share OrisAlign with someone", icon: '<path d="M16 20v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 18.5V20"/><circle cx="10" cy="8" r="3.2"/><path d="M18 8.5v5M20.5 11h-5"/>' },
                  ].map((item) =>
                    item.key === "push" ? (
                      <div key="push" style={{ ...NEU_ROW, cursor: "default" }}>
                        <span style={NEU_ROW_ICON}>
                          <svg viewBox="0 0 24 24" width="17" height="17" style={{ fill: "none", stroke: NEU.gold, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}>
                            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" />
                          </svg>
                        </span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: "14px", fontWeight: "700" }}>
                          Push Notifications
                          <small style={{ display: "block", marginTop: "2px", fontSize: "11.5px", fontWeight: "400", color: NEU.slate }}>
                            {notifPermission === "unsupported"
                              ? "Available in the OrisAlign app."
                              : notifOn
                                ? "On — you'll hear about every step."
                                : notifPermission === "denied"
                                  ? "Turned off in your phone's settings."
                                  : "Off — turn on for treatment updates."}
                          </small>
                        </span>
                        {notifPermission !== "unsupported" && (
                          <button
                            onClick={() => (notifOn ? setShowDisableConfirm(true) : enableNotifications())}
                            role="switch"
                            aria-checked={notifOn}
                            aria-label="Toggle push notifications"
                            style={{
                              position: "relative", flexShrink: 0, width: "46px", height: "26px", borderRadius: "99px",
                              border: "none", cursor: "pointer", padding: 0,
                              background: notifOn ? "linear-gradient(135deg, #CBA164, #B8893F)" : NEU.surface2,
                              boxShadow: NEU.insetSm, transition: "background 0.25s ease",
                            }}
                          >
                            <span style={{
                              position: "absolute", top: "3px", left: "3px", width: "20px", height: "20px", borderRadius: "50%",
                              background: NEU.surface, boxShadow: NEU.upSm,
                              transform: notifOn ? "translateX(20px)" : "translateX(0)",
                              transition: "transform 0.25s cubic-bezier(.2,.8,.3,1)",
                            }} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        key={item.key}
                        onClick={() => {
                          if (item.key === "info") { openInfoForm(); return; }
                          if (item.key === "refer") loadReferral();
                          setDrawerView(item.key);
                        }}
                        style={NEU_ROW}
                      >
                        <span style={NEU_ROW_ICON}>
                          <svg viewBox="0 0 24 24" width="17" height="17" style={{ fill: "none", stroke: NEU.gold, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }} dangerouslySetInnerHTML={{ __html: item.icon }} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: "14px", fontWeight: "700" }}>
                          {item.title}
                          <small style={{ display: "block", marginTop: "2px", fontSize: "11.5px", fontWeight: "400", color: NEU.slate }}>{item.sub}</small>
                        </span>
                        <span style={{ width: "7px", height: "7px", flexShrink: 0, borderRight: `1.8px solid ${NEU.slate2}`, borderBottom: `1.8px solid ${NEU.slate2}`, transform: "rotate(-45deg)" }} />
                      </button>
                    )
                  )}
                </div>
              )}

              {drawerView === "info" && (
                <div>
                  <p style={NEU_VTITLE}>Your information</p>
                  <div style={{ marginBottom: "13px" }}>
                    <label style={NEU_LABEL} htmlFor="i-name">Full name</label>
                    <input id="i-name" style={NEU_FIELD} value={infoForm.name} onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: "13px" }}>
                    <label style={NEU_LABEL} htmlFor="i-age">Age</label>
                    <input id="i-age" type="number" min="1" max="120" style={NEU_FIELD} value={infoForm.age} onChange={(e) => setInfoForm({ ...infoForm, age: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: "13px" }}>
                    <label style={NEU_LABEL} htmlFor="i-sex">Gender</label>
                    <select id="i-sex" style={NEU_FIELD} value={infoForm.sex} onChange={(e) => setInfoForm({ ...infoForm, sex: e.target.value })}>
                      <option value="">Select</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: "13px" }}>
                    <label style={NEU_LABEL} htmlFor="i-addr">Address</label>
                    <textarea id="i-addr" rows={3} style={{ ...NEU_FIELD, resize: "none", lineHeight: "1.5" }} value={infoForm.address} onChange={(e) => setInfoForm({ ...infoForm, address: e.target.value })} />
                  </div>
                  <button onClick={saveInfoForm} disabled={infoSaving} style={{ ...NEU_PRIMARY, opacity: infoSaving ? 0.7 : 1 }}>
                    {infoSaving ? "Saving..." : "Save Changes"}
                  </button>
                  {infoMsg && <p style={NEU_NOTE}>{infoMsg}</p>}
                </div>
              )}

              {drawerView === "callback" && (
                <div>
                  {callbackSent ? (
                    <div style={NEU_OK}>
                      <span style={NEU_TICK}>✓</span>
                      <p style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: "800", color: NEU.navy }}>You&apos;ll be contacted soon</p>
                      <p style={{ margin: 0, fontSize: "12.5px", lineHeight: "1.6", color: "#65788A" }}>
                        Your request has reached the care team. Someone will call you on {patient.phone || "your number"}.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={NEU_VTITLE}>Request a callback</p>
                      <div style={{ marginBottom: "13px" }}>
                        <label style={NEU_LABEL} htmlFor="i-why">What would you like to discuss?</label>
                        <textarea
                          id="i-why" rows={4}
                          placeholder="e.g. My aligner feels tight and I want to check it's tracking correctly."
                          style={{ ...NEU_FIELD, resize: "none", lineHeight: "1.5" }}
                          value={callbackReason}
                          onChange={(e) => setCallbackReason(e.target.value)}
                        />
                      </div>
                      <button onClick={sendCallbackRequest} disabled={callbackSending} style={{ ...NEU_PRIMARY, opacity: callbackSending ? 0.7 : 1 }}>
                        {callbackSending ? "Sending..." : "Request a Callback"}
                      </button>
                      <p style={NEU_NOTE}>Your request goes straight to the OrisAlign care team, along with your name and number.</p>
                    </div>
                  )}
                </div>
              )}

              {drawerView === "feedback" && (
                <div>
                  {feedbackSent ? (
                    <div style={NEU_OK}>
                      <span style={NEU_TICK}>✓</span>
                      <p style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: "800", color: NEU.navy }}>Thank you</p>
                      <p style={{ margin: 0, fontSize: "12.5px", lineHeight: "1.6", color: "#65788A" }}>
                        Your feedback has reached the care team.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={NEU_VTITLE}>How is it going?</p>
                      <div style={{ marginBottom: "13px" }}>
                        <label style={NEU_LABEL}>Your rating</label>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              onClick={() => setFeedbackRating(n)}
                              aria-label={`${n} star${n > 1 ? "s" : ""}`}
                              style={{
                                width: "40px", height: "40px", borderRadius: "14px", border: "none", cursor: "pointer",
                                fontSize: "19px", lineHeight: 1, background: NEU.surface, boxShadow: NEU.upSm,
                                color: n <= feedbackRating ? NEU.gold : "#CFCBBC",
                              }}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginBottom: "13px" }}>
                        <label style={NEU_LABEL} htmlFor="i-fb">What would you like us to know?</label>
                        <textarea
                          id="i-fb" rows={4}
                          placeholder="Comfort, fit, the app, how the clinic visits went — anything."
                          style={{ ...NEU_FIELD, resize: "none", lineHeight: "1.5" }}
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                        />
                      </div>
                      <button onClick={sendFeedback} disabled={feedbackSending} style={{ ...NEU_PRIMARY, opacity: feedbackSending ? 0.7 : 1 }}>
                        {feedbackSending ? "Sending..." : "Send Feedback"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {drawerView === "refer" && (
                <div>
                  {referSent ? (
                    <div style={NEU_OK}>
                      <span style={NEU_TICK}>✓</span>
                      <p style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: "800", color: NEU.navy }}>Referral sent</p>
                      <p style={{ margin: 0, fontSize: "12.5px", lineHeight: "1.6", color: "#65788A" }}>
                        Our team will reach out to them directly.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={NEU_VTITLE}>Refer a friend</p>
                      <p style={{ margin: "0 2px 14px", fontSize: "11.5px", lineHeight: "1.55", color: NEU.slate }}>
                        Share your code. When they order their first aligner package with it, they get ₹{referral?.reward || 500} off — and so do you, on your plan.
                      </p>

                      <div style={{ padding: "16px", borderRadius: "20px", background: NEU.surface2, boxShadow: NEU.insetSm, textAlign: "center", marginBottom: "12px" }}>
                        <span style={{ ...NEU_LABEL, marginBottom: "8px" }}>Your code</span>
                        <span style={{ display: "block", fontSize: "23px", fontWeight: "800", letterSpacing: "0.14em", color: NEU.navy }}>
                          {referral?.code || (referralLoading ? "…" : "—")}
                        </span>
                      </div>

                      <button onClick={copyReferralCode} disabled={!referral?.code} style={{ ...NEU_PRIMARY, opacity: referral?.code ? 1 : 0.6, marginBottom: "10px" }}>
                        {referralCopied ? "Copied" : "Copy Code"}
                      </button>

                      {referral && (
                        <p style={{ margin: "0 2px 16px", fontSize: "11.5px", lineHeight: "1.55", color: NEU.slate }}>
                          {referral.qualified} of {referral.cap} rewards earned
                          {referral.earned > 0 ? " · ₹" + referral.earned + " credited to your plan" : ""}
                          {referral.shared > referral.qualified ? " · " + (referral.shared - referral.qualified) + " waiting on their first package" : ""}
                        </p>
                      )}

                      <p style={{ margin: "0 2px 12px", fontSize: "10.5px", fontWeight: "700", letterSpacing: "0.14em", textTransform: "uppercase", color: NEU.slate2 }}>
                        Or let us reach out
                      </p>
                      <div style={{ marginBottom: "13px" }}>
                        <label style={NEU_LABEL} htmlFor="i-rname">Their name</label>
                        <input id="i-rname" style={NEU_FIELD} placeholder="e.g. Ananya" value={referName} onChange={(e) => setReferName(e.target.value)} />
                      </div>
                      <div style={{ marginBottom: "13px" }}>
                        <label style={NEU_LABEL} htmlFor="i-rphone">Their phone number</label>
                        <input id="i-rphone" type="tel" style={NEU_FIELD} placeholder="+91" value={referPhone} onChange={(e) => setReferPhone(e.target.value)} />
                      </div>
                      <button onClick={sendReferral} disabled={referSending} style={{ ...NEU_PRIMARY, opacity: referSending ? 0.7 : 1 }}>
                        {referSending ? "Sending..." : "Send Referral"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ flex: "0 0 auto", padding: "14px 16px 18px" }}>
              <button
                onClick={() => {
                  try { window.localStorage.removeItem("orisalign_patient_id"); } catch {}
                  try { document.cookie = "orisalign_patient_id=;path=/;max-age=0;samesite=lax"; } catch {}
                  window.location.href = "/login?logout=1";
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", width: "100%",
                  padding: "14px", borderRadius: "18px", border: "none", cursor: "pointer",
                  background: NEU.surface, boxShadow: NEU.upSm, color: "#A0603F",
                  fontFamily: "inherit", fontWeight: "700", fontSize: "13.5px",
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" style={{ fill: "none", stroke: "#A0603F", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" }}>
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" />
                </svg>
                Log Out
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
