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
  hasSeenNotifOnboarding, markNotifOnboardingSeen,
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

  useEffect(() => {
    if (!isNativeApp()) return;
    (async () => {
      const state = await getNotifPermission();
      setNotifPermission(state);
      // Ask once, the first time the app is opened on a device where the OS
      // hasn't been asked yet. After that the toggle in Settings is the only
      // way to change it — Android refuses a second in-app prompt once denied.
      if (state === "prompt" && !hasSeenNotifOnboarding()) setShowNotifOnboarding(true);
    })();
  }, []);

  const handleEnableNotifications = async () => {
    markNotifOnboardingSeen();
    const state = await requestNotifPermission();
    setNotifPermission(state);
    setShowNotifOnboarding(false);
  };
  const handleDismissNotifOnboarding = () => {
    markNotifOnboardingSeen();
    setShowNotifOnboarding(false);
  };
  const handleToggleNotifications = async () => {
    if (notifPermission === "denied") { await openAppNotificationSettings(); return; }
    const state = await requestNotifPermission();
    setNotifPermission(state);
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

  useEffect(() => {
    let loaded = 0;
    stageImgs.current = Array.from({ length: STAGE_COUNT }, (_, i) => {
      const im = new window.Image();
      im.onload = () => {
        if (++loaded === STAGE_COUNT) { stagesReady.current = true; paintStages(); }
      };
      im.src = STAGE_SRC(i);
      return im;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repaint after every render — that's what moves the simulation as the
  // rail is dragged. Two drawImage calls, so cheap enough to do unguarded.
  useEffect(() => { paintStages(); });
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

  // Smile Correction — one edge-to-edge + one complete-bite bite photo per
  // aligner set, uploaded as the patient goes through the program.
  const uploadSmileSetImage = async (setNum, type, file) => {
    if (!file) return;
    const uploadKey = `${setNum}-${type}`;
    setUploadingSmileImage(uploadKey);
    try {
      const ext = file.name.split(".").pop();
      const path = `smile-correction/${id}/set-${setNum}/${type}.${ext}`;
      const { error: upErr } = await supabase.storage.from("case-files").upload(path, file, { upsert: true });
      if (upErr) { alert("Failed to upload: " + upErr.message); return; }
      const { data: { publicUrl } } = supabase.storage.from("case-files").getPublicUrl(path);
      const setImages = patient.journey_steps?.smile_set_images || {};
      const newJourneySteps = {
        ...(patient.journey_steps || {}),
        smile_set_images: { ...setImages, [setNum]: { ...(setImages[setNum] || {}), [type]: publicUrl } },
      };
      const { error } = await supabase.from("appointments_booking").update({ journey_steps: newJourneySteps }).eq("id", id);
      if (error) { alert("Failed to save: " + error.message); return; }
      setPatient((prev) => prev && { ...prev, journey_steps: newJourneySteps });
    } catch {
      alert("Network error. Please try again.");
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

  return (
    <div style={{ position: "relative", minHeight: "100vh", paddingBottom: "60px", fontFamily: "'Inter', system-ui, sans-serif", colorScheme: "light" }}>

      {/* ───── JOURNEY ARC ─────────────────────────────────────────────
          Patient details sit in the navy circle; every treatment step is a
          node riding an arc whose centre is off the left edge of the screen.
          Dragging vertically rotates the rail (see ARC_* at the top of this
          file); tapping a node opens that step's full panel in the sheet
          below — the same panels as before, just no longer all stacked. */}
      <div
        className="motif-bg"
        onPointerDown={(e) => {
          arcDrag.current = { active: true, lastY: e.clientY, moved: 0 };
        }}
        onPointerMove={(e) => {
          if (!arcDrag.current.active) return;
          const dy = e.clientY - arcDrag.current.lastY;
          arcDrag.current.lastY = e.clientY;
          arcDrag.current.moved += Math.abs(dy);
          setArcOffset((prev) => Math.max(0, Math.min(journeySteps.length - 1, prev - dy / 58)));
        }}
        onPointerUp={() => {
          if (!arcDrag.current.active) return;
          arcDrag.current.active = false;
          setArcOffset((prev) => Math.max(0, Math.min(journeySteps.length - 1, Math.round(prev))));
        }}
        onPointerCancel={() => { arcDrag.current.active = false; }}
        onWheel={(e) => {
          setArcOffset((prev) => Math.max(0, Math.min(journeySteps.length - 1, Math.round(prev + (e.deltaY > 0 ? 1 : -1)))));
        }}
        style={{
          position: "relative", minHeight: "100dvh", overflow: "hidden",
          touchAction: "none", userSelect: "none",
          "--stage-opacity": STAGE_OPACITY,
        }}
      >
        {/* The background image, shown exactly as supplied — no filter, no tint. */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `url(${SCREEN_BG_IMAGE})`, backgroundSize: "cover", backgroundPosition: "center",
        }} />

        {/* Treatment simulation. All 15 stills are preloaded (15KB each) so
            dragging the rail never waits on a fetch mid-fade — see
            paintStages above for why this is one canvas, not stacked imgs. */}
        <div style={{
          position: "absolute", top: "47%", left: "1%", transform: "translateY(-50%)",
          width: "93.6%", zIndex: 1, pointerEvents: "none", opacity: "var(--stage-opacity)",
          // Shown in the render's own colour. The previous set was near-white
          // and had to be tinted and multiplied to survive the pale background;
          // these renders carry their own pink gums and shaded teeth, so they
          // read as a real mouth at plain opacity and need neither.
          // The frames are cropped tight, so the gums end in flat lines on every
          // side — feather all four edges so it dissolves into the background.
          WebkitMaskImage: STAGE_MASK, maskImage: STAGE_MASK,
          WebkitMaskComposite: "source-in", maskComposite: "intersect",
          // Richer colour depth at the same opacity — the pink of the gums and
          // the shading on the teeth read more vivid within their faint
          // presence, rather than looking pastel/washed at low opacity.
          filter: "saturate(1.35) contrast(1.12)",
        }}>
          <canvas ref={stageCanvas} aria-hidden="true" style={{ display: "block", width: "100%", height: "auto" }} />
        </div>

        {/* Logo, centred at the top. Deliberately NOT inside a z-indexed
            wrapper: mix-blend-mode only blends within its own stacking
            context, so a positioned+z-indexed parent would leave the logo's
            white plate sitting on the ivory instead of dissolving into it. */}
        <img
          src="/logo.png"
          alt="OrisAlign"
          style={{
            position: "absolute", top: "18px", left: "50%", transform: "translateX(-50%)",
            width: "184px", height: "auto", objectFit: "contain", mixBlendMode: "multiply",
          }}
        />
        <button
          onClick={() => {
            // Clear both halves of the saved session, then tell the login page
            // this was a deliberate logout. Without that flag it looks for a
            // saved session on mount and, if either store survived the clear —
            // a cookie the WebView holds on a different path, say — sends the
            // patient straight back here.
            try { window.localStorage.removeItem("orisalign_patient_id"); } catch {}
            try { document.cookie = "orisalign_patient_id=;path=/;max-age=0;samesite=lax"; } catch {}
            window.location.href = "/login?logout=1";
          }}
          style={{ position: "absolute", top: "20px", right: "16px", zIndex: 6, background: "none", border: "none", color: "#A9A395", fontSize: "10.5px", fontWeight: "700", letterSpacing: "0.06em", cursor: "pointer", padding: "4px" }}
        >
          LOGOUT
        </button>
        <button
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
          style={{ position: "absolute", top: "17px", right: "78px", zIndex: 6, background: "none", border: "none", color: "#A9A395", cursor: "pointer", padding: "4px", display: "grid", placeItems: "center" }}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>

        {/* The rail the step nodes ride on. Drawn as its own arc now that the
            card is a rectangle — it used to be the hero circle's border. */}
        <svg
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, pointerEvents: "none" }}
        >
          <g style={{ transform: "translateY(50%)" }}>
            <path
              d={(() => {
                let d = "";
                for (let a = -98; a <= 98; a += 3) {
                  const r = (a * Math.PI) / 180;
                  d += (d ? " L" : "M") + (ARC_CX + ARC_R * Math.cos(r)).toFixed(1) + " " + (ARC_R * Math.sin(r)).toFixed(1);
                }
                return d;
              })()}
              fill="none"
              stroke={expandedStep ? "rgba(53,184,172,0.30)" : "#35B8AC"}
              strokeWidth="2"
              style={{ filter: "drop-shadow(0 0 5px rgba(21,159,145,0.22))", transition: "stroke 0.3s ease" }}
            />
            {/* A few small glowing points riding the path, between the nodes —
                a suggestion of flow along the journey, not a particle effect. */}
            {!expandedStep && [-1.55, -0.6, 0.6, 1.55].map((rel) => {
              const ang = (rel * ARC_STEP_ANGLE * Math.PI) / 180;
              return (
                <circle
                  key={rel}
                  cx={ARC_CX + ARC_R * Math.cos(ang)}
                  cy={ARC_R * Math.sin(ang)}
                  r="3"
                  fill="#fff"
                  style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,1)) drop-shadow(0 0 14px rgba(48,190,175,0.36))" }}
                />
              );
            })}
          </g>
        </svg>

        {/* Who this is, kept on screen under the logo whether or not a card is
            open. The patient's own details now live in the Appointment Booked
            step, so there is no separate patient card any more. */}
        <div style={{ position: "absolute", top: "148px", right: "18px", zIndex: 7, textAlign: "right", pointerEvents: "none" }}>
          <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", letterSpacing: "-0.015em", color: "#0D2945" }}>{patient.name || "Patient"}</p>
          <p style={{ margin: "2px 0 0", fontSize: "10.5px", fontWeight: "600", letterSpacing: "0.08em", textTransform: "uppercase", color: "#71818C", fontVariantNumeric: "tabular-nums" }}>
            ID <b style={{ color: "#C6922E", fontWeight: "800" }}>{patientIdLabel}</b>
          </p>
        </div>

        {/* The handle that pulls the card out. It is a SIBLING of the card, not
            a child: step nodes are painted above the card on purpose, and a
            handle inside it would sit underneath whichever node happens to be
            beside it and never receive the tap. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // Collapsed, the arrow opens whichever step the rail is centred on.
            setExpandedStep((prev) => (prev ? null : journeySteps[Math.round(arcOffset)]?.key || journeySteps[0].key));
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={expandedStep ? "Hide details" : "Show details"}
          aria-expanded={!!expandedStep}
          style={{
            position: "absolute", zIndex: 30,
            left: `${cardBox.left}px`, top: expandedStep && cardBox.mid ? `${cardBox.mid}px` : "50%",
            width: "26px", height: "54px", padding: 0, border: "none",
            borderRadius: "0 13px 13px 0", cursor: "pointer",
            display: "grid", placeItems: "center",
            background: "rgba(255,255,255,0.92)",
            boxShadow: "2px 4px 14px -6px rgba(23,59,87,0.45)",
            color: "#168F83",
            transform: `translate(${expandedStep ? 0 : -cardSlide}px, -50%)`,
            transition: "transform 0.42s cubic-bezier(.2,.8,.3,1)",
          }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" style={{ fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", transform: expandedStep ? "none" : "scaleX(-1)", transition: "transform 0.42s cubic-bezier(.2,.8,.3,1)" }}>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>

        {/* Step nodes on the arc */}
        {journeySteps.map((step, i) => {
          const rel = i - arcOffset;
          const ang = (rel * ARC_STEP_ANGLE) * Math.PI / 180;
          const x = ARC_CX + ARC_R * Math.cos(ang);
          const y = ARC_R * Math.sin(ang);
          const dist = Math.abs(rel);
          const scale = Math.max(0.62, 1 - dist * 0.09);
          const opacity = dist > ARC_VISIBLE ? 0 : Math.max(0, 1 - Math.pow(dist / (ARC_VISIBLE + 0.2), 2.2));
          const isDone = !!steps[step.key];
          const isCurrent = !isDone && i > 0 && !!steps[journeySteps[i - 1]?.key];
          const isClickable = step.expandable && (!step.smileLink || steps[step.key]);
          return (
            <div
              key={step.key}
              onClick={() => {
                // Ignore the click that ends a drag, so scrolling the rail
                // never opens a step by accident.
                if (arcDrag.current.moved > 6) { arcDrag.current.moved = 0; return; }
                setArcOffset(i);
                if (step.smileLink && !steps[step.key]) return; // only accessible when admin marks it done
                setExpandedStep(step.key);
              }}
              style={{
                position: "absolute", top: "50%", left: 0, zIndex: 20 - Math.round(dist),
                width: "128px", marginLeft: "-64px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "7px",
                transform: `translate(${x}px, ${y + 5}px) scale(${scale})`,
                transformOrigin: "center top",
                opacity: expandedStep ? opacity * 0.34 : opacity,
                pointerEvents: opacity < 0.25 || expandedStep ? "none" : "auto",
                cursor: "pointer",
                transition: arcDrag.current.active ? "none" : "transform 0.28s cubic-bezier(.22,.8,.3,1), opacity 0.3s ease",
              }}
            >
              <div style={{
                position: "relative", width: "72px", height: "72px", borderRadius: "50%", flexShrink: 0,
                display: "grid", placeItems: "center", border: "2px solid rgba(255,255,255,0.85)",
                // The current step is the one actually in progress — it should
                // read exactly as solid as a completed step, with only the
                // stronger glow below marking it out. The faded gradient is
                // reserved for steps that haven't started yet.
                // Denser teal — pushed darker and more saturated at the edges
                // than the original, so it reads heavier and more pigmented.
                background: (isDone || isCurrent)
                  ? "linear-gradient(145deg, #2BAE9C 0%, #0E8C7E 55%, #04564D 100%)"
                  : "linear-gradient(145deg, #B0DAD3 0%, #7FC7BE 60%, #68B9AF 100%)",
                boxShadow: isCurrent
                  ? "0 0 0 5px rgba(255,255,255,0.30), 0 0 25px rgba(21,159,145,0.36), 0 12px 30px rgba(8,80,90,0.22)"
                  : isDone
                    ? "0 0 0 5px rgba(255,255,255,0.34), 0 10px 25px rgba(8,90,90,0.19), 0 0 20px rgba(21,159,145,0.14)"
                    : "0 0 0 5px rgba(255,255,255,0.29), 0 8px 20px rgba(8,90,90,0.12)",
              }}>
                {/* Lit from the upper left, like polished glass. */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", background: "linear-gradient(135deg, rgba(255,255,255,0.34), transparent 45%)" }} />
                {/* A soft brushed-metal sweep, on the completed/current buttons
                    only — an upcoming button is meant to look quieter, not
                    like a finished object yet. */}
                {(isDone || isCurrent) && (
                  <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.30) 46%, rgba(255,255,255,0.06) 54%, transparent 68%)" }} />
                )}
                <svg viewBox="0 0 24 24" width="30" height="30" style={{ position: "relative", fill: "none", stroke: "#fff", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}
                  dangerouslySetInnerHTML={{ __html: STEP_ICONS[step.key] || DEFAULT_STEP_ICON }} />
              </div>
              {dist <= 1.6 && (
                <span style={{
                  fontSize: "10.5px", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase",
                  lineHeight: "1.35", textAlign: "center",
                  color: "#173B57",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {step.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Scroll affordance + contact line */}
        <div style={{ position: "absolute", right: "16px", bottom: "56px", zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", fontSize: "9px", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", color: "#A9A395", pointerEvents: "none" }}>
          <span style={{ fontSize: "12px" }}>▲</span>
          <span>Scroll</span>
        </div>
        <p style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "18px", zIndex: 5,
          margin: 0, display: "flex", alignItems: "center", gap: "9px", whiteSpace: "nowrap",
          padding: "10px 18px", borderRadius: "99px",
          background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.75)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 10px 30px rgba(25,80,100,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
          fontSize: "11.5px", color: "#71818C",
        }}>
          <svg viewBox="0 0 24 24" width="14" height="14" style={{ stroke: "#159E91", fill: "none", strokeWidth: 1.8, flexShrink: 0 }}>
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-2.8-.4L3 21l1.5-4.6A8.3 8.3 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
          </svg>
          Questions? <a href="mailto:hello@orisalign.com" style={{ color: "#A9762E", fontWeight: "700", textDecoration: "none" }}>hello@orisalign.com</a>
        </p>
      </div>

      {/* ───── STEP PANEL — the opened step, shown as the card itself ─────
          This is the same card the patient's name sits in: opening a step
          grows it in place rather than sliding a separate sheet over the
          screen, so the journey behind it stays visible. */}
      {expandedStep && (
        <div style={{ position: "absolute", inset: 0, zIndex: 60, pointerEvents: "none" }}>
          <div
            ref={cardRef}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "absolute", left: "10px", top: "37%",
              width: "72%", maxWidth: "460px",
              // Height follows the content — a short step stays a small card,
              // a long one grows until it would reach the contact line, then
              // scrolls inside itself.
              maxHeight: "calc(100dvh - 37% - 76px)",
              overflowY: "auto", pointerEvents: "auto",
              // Near-transparent glass: an outline holding the content, with
              // the background image and dental simulation showing straight
              // through. A hair of blur keeps text legible over them without
              // milking the panel into looking like a solid surface.
              background: "rgba(255,255,255,0)",
              backdropFilter: "blur(1px) saturate(112%)", WebkitBackdropFilter: "blur(1px) saturate(112%)",
              border: "1px solid rgba(255,255,255,0.85)",
              borderRadius: "20px",
              boxShadow:
                "0 24px 60px rgba(26,76,100,0.10), 0 8px 24px rgba(26,76,100,0.07), " +
                "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(255,255,255,0.10), " +
                "inset 12px 0 30px rgba(255,255,255,0.05), inset -12px 0 30px rgba(120,190,210,0.03)",
              padding: "30px 0 18px",
            }}
          >
            {/* A luminous 1px edge, brighter toward the upper-left — light
                catching the rim of the glass, not a glow. */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
              padding: "1.5px",
              background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.30) 40%, rgba(255,255,255,0.65) 100%)",
              WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor", maskComposite: "exclude",
            }} />
            <div className="journey-panel-shine" style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", overflow: "hidden" }} />
            <button
              onClick={() => setExpandedStep(null)}
              aria-label="Back to patient details"
              style={{ position: "absolute", top: "12px", right: "14px", background: "none", border: "none", color: "#71818C", fontSize: "20px", cursor: "pointer", lineHeight: 1, zIndex: 2 }}
            >
              ×
            </button>
            {/* position:relative lifts this above the edge-highlight and shine
                overlays, which are positioned absolute with no z-index — the
                content would otherwise paint underneath them and disappear. */}
            <div style={{ position: "relative", padding: "0 14px" }}>
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

                    return (
                      <div style={{ marginLeft: 0, marginTop: "10px", background: "transparent", border: "none", borderRadius: 0, padding: 0, boxShadow: "none" }}>
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

      {/* ───── SETTINGS ───── */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={() => setShowSettings(false)} style={{ position: "absolute", inset: 0, background: "rgba(13,41,68,0.35)" }} />
          <div style={{
            position: "relative", width: "100%", maxWidth: "460px", margin: "0 12px 12px",
            padding: "22px 20px 24px", borderRadius: "22px",
            background: "rgba(255,255,255,0.94)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 24px 60px rgba(26,76,100,0.22)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0D2945" }}>Settings</p>
              <button onClick={() => setShowSettings(false)} aria-label="Close" style={{ background: "none", border: "none", color: "#71818C", fontSize: "22px", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "14px 4px" }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 3px", fontSize: "14px", fontWeight: "700", color: "#0D2945" }}>Push Notifications</p>
                <p style={{ margin: 0, fontSize: "12px", lineHeight: "1.5", color: "#71818C" }}>
                  {notifPermission === "unsupported"
                    ? "Available in the OrisAlign app — install it to turn this on."
                    : notifPermission === "granted"
                      ? "You'll be notified about updates to your treatment."
                      : notifPermission === "denied"
                        ? "Turned off in your phone's Settings. Tap to open it."
                        : "Get notified about updates to your treatment."}
                </p>
              </div>
              {notifPermission !== "unsupported" && (
                <button
                  onClick={handleToggleNotifications}
                  role="switch"
                  aria-checked={notifPermission === "granted"}
                  aria-label="Toggle push notifications"
                  style={{
                    position: "relative", flexShrink: 0, width: "46px", height: "27px", borderRadius: "99px", border: "none", cursor: "pointer", padding: "3px",
                    background: notifPermission === "granted" ? "linear-gradient(90deg, #168F83, #159E91)" : "#D4DEE3",
                    transition: "background 0.2s ease",
                  }}
                >
                  <span style={{
                    display: "block", width: "21px", height: "21px", borderRadius: "50%", background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transform: notifPermission === "granted" ? "translateX(19px)" : "translateX(0)",
                    transition: "transform 0.2s ease",
                  }} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
