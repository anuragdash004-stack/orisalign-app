import { createClient } from "@supabase/supabase-js"
import { sendWhatsApp } from "./notifications/aisensy"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// AiSensy campaign name for each journey step's WhatsApp template. Every
// step takes a single variable, {{1}} = patient name, EXCEPT "confirmed"
// which takes two: {{1}} = patient name, {{2}} = assigned dentist's name
// (see the templateParams branch in sendStepNotification below).
// These must match the campaign names created in the AiSensy dashboard
// exactly, or sends fail (silently, from the caller's point of view — see
// sendWhatsApp's never-throws contract).
const WHATSAPP_STEP_CAMPAIGNS: Record<string, string> = {
  confirmed: "orisalign_appointment_confirmed",
  scanning_done: "orisalign_scanning_done",
  payment_done: "orisalign_payment_done",
  planning_done: "orisalign_planning_done",
  final_plan_review: "orisalign_final_plan_review",
  plan_approved: "orisalign_plan_approved",
  manufacturing_started: "orisalign_manufacturing_started",
  manufacturing_completed: "orisalign_manufacturing_completed",
  aligners_dispatched: "orisalign_aligners_dispatched",
  aligners_received: "orisalign_aligners_received",
  followup_appointment: "orisalign_followup_appointment",
  aligners_delivered: "orisalign_aligners_delivered",
  smile_correction: "orisalign_smile_correction",
  treatment_completed: "orisalign_treatment_completed",
  feedback_submitted: "orisalign_feedback_submitted",
}

// Per-step override for templateParams, for steps whose approved AiSensy
// copy doesn't match the "single {{1}} = patient name" default (see the
// fallback in sendStepNotification below). Add an entry here whenever a
// template gets approved with a different variable count/order than drafted.
const WHATSAPP_STEP_PARAMS: Partial<
  Record<string, (ctx: { name: string; dentistName: string | null }) => string[]>
> = {
  // Approved as fully static text — zero body variables.
  scanning_done: () => [],
  confirmed: ({ name, dentistName }) => [name, dentistName || "our team"],
}

// Kept in sync with app/api/notify-booking/route.ts's CLINIC_INFO.
const CLINIC_INFO: Record<string, { name: string; address: string; mapsLink: string }> = {
  Nayapalli: {
    name: "Nayapalli Clinic",
    address: "April Dental, 242, Indradhanu Market Rd, N4, Block N4, IRC Village, Nayapalli, Bhubaneswar, Odisha 751015",
    mapsLink: "https://maps.app.goo.gl/gtLWbuPZ7BLUMmReA",
  },
  Patia: {
    name: "Patia Clinic",
    address: "Kalp Dental Clinic, Kiss Road, Chandaka Industrial Estate, Patia, Bhubaneswar, Odisha",
    mapsLink: "https://share.google/DPy1ODGR0lb1UZFAT",
  },
}

// ── Per-step content ──────────────────────────────────────────────────────────

type StepContent = {
  subject: string
  headline: string
  body: string
  nextStep: string | null
  emoji: string
}

function getStepContent(stepKey: string): StepContent | null {
  const steps: Record<string, StepContent> = {
    confirmed: {
      emoji: "📅",
      subject: "Your Appointment is Confirmed — OrisAlign",
      headline: "Appointment Confirmed!",
      body: "Great news! Your appointment with OrisAlign has been confirmed. Our dentist will be in touch with you very soon to guide you through what to expect. Please carry any previous dental records if you have them.",
      nextStep: "Scanning & Planning",
    },
    scanning_done: {
      emoji: "🦷",
      subject: "Scanning & Planning Complete — OrisAlign",
      headline: "Scanning & Planning Done!",
      body: "Your scanning session and initial planning have been completed successfully. Our orthodontic team is now working on your personalised treatment proposal. We'll notify you as soon as your plan is ready.",
      nextStep: "Price & Payment",
    },
    payment_done: {
      emoji: "💳",
      subject: "Final Planning Payment Received — OrisAlign",
      headline: "Payment Received!",
      body: "Your ₹999 Final Planning Payment has been received. Thank you for your trust in OrisAlign. Our orthodontic team will now prepare your full treatment plan and keep you updated at every step.",
      nextStep: "Treatment Planning",
    },
    planning_done: {
      emoji: "📋",
      subject: "Your Treatment Plan is Ready — OrisAlign",
      headline: "Treatment Plan Ready!",
      body: "Your personalised 3D treatment plan has been prepared by our orthodontic team! Please visit your journey page to review it.",
      nextStep: "Final Plan Review",
    },
    final_plan_review: {
      emoji: "🔢",
      subject: "Your Final Aligner Count & Schedule Are Ready — OrisAlign",
      headline: "Final Plan Review Ready!",
      body: "Your orthodontist has finalised your exact upper and lower aligner set counts and your month-by-month schedule. Please visit your journey page to review it, then click the Approve Plan button to authorise us to begin fabricating your aligners.",
      nextStep: "Plan Approval",
    },
    plan_approved: {
      emoji: "✅",
      subject: "Plan Approved — Manufacturing Begins Soon — OrisAlign",
      headline: "Plan Approved!",
      body: "Your treatment plan has been approved. Thank you for authorising OrisAlign to begin fabrication of your custom aligners. Our manufacturing team will start work on your aligners shortly. This process typically takes a few weeks — we'll keep you posted.",
      nextStep: "Manufacturing",
    },
    manufacturing_started: {
      emoji: "⚙️",
      subject: "Your Aligners Are Being Made — OrisAlign",
      headline: "Manufacturing Started!",
      body: "Exciting news — manufacturing of your custom aligners has officially begun! Each set is precisely crafted to move your teeth gently and accurately according to your treatment plan. We'll notify you as soon as they're ready.",
      nextStep: "Manufacturing Completed",
    },
    manufacturing_completed: {
      emoji: "📦",
      subject: "Your Aligners Are Ready — OrisAlign",
      headline: "Aligners Ready!",
      body: "Your custom aligners have been manufactured and quality-checked. They are now being prepared for dispatch to you. You'll receive a tracking update very soon. Get ready to start your smile journey!",
      nextStep: "Dispatch",
    },
    aligners_dispatched: {
      emoji: "🚚",
      subject: "Your Aligners Are On Their Way — OrisAlign",
      headline: "Aligners Dispatched!",
      body: "Your aligners are on the move! They have been handed over to our delivery partner and are heading your way. Please ensure someone is available to receive the package. You can track your shipment using the details on your journey page.",
      nextStep: "Aligner Delivery",
    },
    aligners_received: {
      emoji: "📬",
      subject: "Aligners Received by Delivery Partner — OrisAlign",
      headline: "Almost There!",
      body: "Your aligners have been received by our local delivery partner and are on the final leg of their journey to you. Expect delivery very soon. Please have your ID ready if required at the time of delivery.",
      nextStep: "Aligner Delivery at Your Doorstep",
    },
    followup_appointment: {
      emoji: "🗓️",
      subject: "Follow-Up Appointment Scheduled — OrisAlign",
      headline: "Follow-Up Booked!",
      body: "Your follow-up appointment has been scheduled with OrisAlign. This visit is an important part of your treatment — our team will review your progress, make any necessary adjustments, and ensure everything is on track for your smile transformation.",
      nextStep: null,
    },
    aligners_delivered: {
      emoji: "🎁",
      subject: "Aligners Delivered — Start Your Smile Correction — OrisAlign",
      headline: "Aligners Delivered!",
      body: "Your aligners have arrived! Please begin wearing them as instructed by your orthodontist. Consistent wear (20–22 hours per day) is the key to the best results. If you have any questions, reach out to our team — we're always here to help.",
      nextStep: "Smile Correction",
    },
    smile_correction: {
      emoji: "😁",
      subject: "Smile Correction Phase Started — OrisAlign",
      headline: "Smile Correction Begins!",
      body: "Your Smile Correction phase has officially started! You're now actively on your journey to a more confident smile. Wear your aligners consistently and follow the schedule provided. We'll be with you every step of the way.",
      nextStep: "Treatment Completion",
    },
    treatment_completed: {
      emoji: "🏆",
      subject: "Treatment Complete — Congratulations from OrisAlign!",
      headline: "Treatment Complete!",
      body: "Congratulations — your OrisAlign treatment is complete! Your smile has been transformed through precision, care, and your own commitment. We are incredibly proud to have been part of your journey. Share your smile with the world — you've earned it!",
      nextStep: null,
    },
    feedback_submitted: {
      emoji: "🎉",
      subject: "Thank You for Your Feedback — OrisAlign",
      headline: "Feedback Received!",
      body: "Thank you so much for taking the time to share your experience with us. Your feedback helps us improve and inspire others. Your ₹5,000 hamper will be sent to you shortly as a token of our appreciation. Thank you for choosing OrisAlign and trusting us with your smile.",
      nextStep: null,
    },
  }
  return steps[stepKey] ?? null
}

// ── Email HTML builder ────────────────────────────────────────────────────────

function buildEmailHtml(params: {
  name: string
  shortId: string
  journeyUrl: string
  content: StepContent
  detailsBlock?: string
}): string {
  const { name, shortId, journeyUrl, content, detailsBlock } = params

  const nextStepBlock = content.nextStep
    ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#16a34a;letter-spacing:1px;text-transform:uppercase;">NEXT STEP</p>
        <p style="margin:0;font-size:15px;font-weight:700;color:#15803d;">${content.nextStep}</p>
      </div>`
    : `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#92400e;">🎊 You've reached a major milestone!</p>
      </div>`

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#faf7f2;padding:20px;border-radius:12px;">

      <div style="background:linear-gradient(135deg,#1B2A4A,#0f2027);padding:28px 24px;border-radius:8px;text-align:center;margin-bottom:20px;border-bottom:3px solid #C9A84C;">
        <img src="https://orisalign.com/logo.png" alt="OrisAlign" style="height:40px;margin:0 auto 14px;display:block;" />
        <p style="color:#C9A84C;margin:0 0 4px;font-size:22px;font-weight:900;">${content.emoji} ${content.headline}</p>
        <p style="color:#94a3b8;margin:0;font-size:13px;">Your Smile Journey Update · OrisAlign</p>
      </div>

      <p style="color:#374151;font-size:15px;margin:0 0 4px;">Dear <strong>${name}</strong>,</p>
      <p style="color:#6b7280;font-size:11px;margin:0 0 16px;">Patient ID: <strong style="color:#374151;font-family:monospace;letter-spacing:2px;">${shortId}</strong></p>

      <p style="color:#374151;font-size:14px;line-height:1.8;margin:0 0 4px;">${content.body}</p>

      ${detailsBlock || ""}

      ${nextStepBlock}

      <div style="text-align:center;margin:24px 0 16px;">
        <a href="${journeyUrl}" style="display:inline-block;background:#1B2A4A;color:#C9A84C;font-weight:700;font-size:14px;padding:13px 30px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
          View My Journey Page →
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.7;text-align:center;">
        For any queries, reach us at
        <a href="mailto:hello@orisalign.com" style="color:#C9A84C;font-weight:600;">hello@orisalign.com</a>.
      </p>

      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:16px;">
        OrisAlign · Bhubaneswar – 751016, Odisha<br/>
        <a href="${journeyUrl}" style="color:#9ca3af;font-size:11px;">View your journey page</a>
      </p>
    </div>
  `
}

export interface SendStepNotificationParams {
  appointmentId: string
  stepKey: string
  emailOverride?: string | null
  customSubject?: string
  customBody?: string
  /** Origin used to build the journey link, e.g. "https://orisalign.com". Defaults to that if omitted. */
  origin?: string
}

export type SendStepNotificationResult =
  | { success: true }
  | { success: false; skipped: true; reason: string }
  | { success: false; error: string }

/**
 * Sends the patient-facing "journey step completed" email for a given step,
 * using the admin-editable Message Templates (message_templates table) when
 * an active override exists, otherwise the built-in default copy.
 *
 * This is the shared implementation behind POST /api/notify-step. Callers
 * running server-side (crons, other API routes) should call this function
 * directly rather than doing a self-fetch back into /api/notify-step — a
 * server-to-server fetch to the app's own deployment URL can be silently
 * blocked by Vercel's deployment protection (see lib/paymentHelper.ts for
 * the same lesson learned the hard way with payment recording).
 */
export async function sendStepNotification(params: SendStepNotificationParams): Promise<SendStepNotificationResult> {
  const { appointmentId, stepKey, emailOverride, customSubject, customBody } = params
  const origin = params.origin || "https://orisalign.com"

  if (!appointmentId || !stepKey) {
    return { success: false, error: "Missing appointmentId or stepKey" }
  }

  const journeyUrl = `${origin}/patient/${appointmentId}`

  const content = getStepContent(stepKey)
  if (!content) {
    return { success: false, skipped: true, reason: "No notification configured for this step" }
  }

  const { data: appt, error: fetchErr } = await supabase
    .from("appointments_booking")
    .select("id, name, email, phone, date, time, clinic_location, assigned_dentist, problem")
    .eq("id", appointmentId)
    .single()

  if (fetchErr || !appt) {
    return { success: false, error: "Appointment not found" }
  }

  const recipientEmail = appt.email || emailOverride || null
  if (!recipientEmail) {
    return { success: false, skipped: true, reason: "No email on record" }
  }

  // Admin-editable template (Message Templates page) overrides the built-in
  // default. An explicit custom subject/body still wins over both.
  const { data: tmpl } = await supabase
    .from("message_templates")
    .select("subject_line, email_body")
    .eq("step_key", stepKey)
    .eq("is_active", true)
    .single()

  const shortId = appt.id.substring(0, 8).toUpperCase()
  const mergedContent = {
    ...content,
    subject: customSubject || tmpl?.subject_line || content.subject,
    body: customBody || tmpl?.email_body || content.body,
  }

  // The confirmation email additionally spells out the date, which clinic
  // (with address) and which dentist will see the patient — whatever is
  // already on file at confirmation time.
  let detailsBlock: string | undefined
  let dentistName: string | null = null
  if (stepKey === "confirmed") {
    const clinic = appt.clinic_location ? CLINIC_INFO[appt.clinic_location] : null
    // Consultation type is stored as a "[TYPE] complaint" prefix on `problem`
    // (see parseProblem in the Lead Tracker / booking form).
    const consultationType = appt.problem?.match(/^\[(\w+)\]/)?.[1]?.toLowerCase()
    if (appt.assigned_dentist) {
      const { data: dentist } = await supabase
        .from("users")
        .select("full_name, email")
        .eq("id", appt.assigned_dentist)
        .single()
      dentistName = dentist?.full_name || dentist?.email || null
    }
    const rows = [
      appt.date ? { label: "Date & Time", value: [appt.date, appt.time].filter(Boolean).join(" at ") } : null,
      clinic ? {
        label: "Clinic",
        value: `${clinic.name} — ${clinic.address} · <a href="${clinic.mapsLink}" style="color:#1B2A4A;font-weight:700;text-decoration:underline;">View on Google Maps</a>`,
      } : null,
      consultationType === "online"
        ? { label: "Consultation", value: "Video Consultation — a Google Meet link will be shared 1 hour before your appointment." }
        : null,
      dentistName ? { label: "Dentist", value: dentistName } : null,
    ].filter(Boolean) as { label: string; value: string }[]

    if (rows.length > 0) {
      detailsBlock = `
        <div style="background:#f8f6f2;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:16px 0;">
          ${rows.map((r) => `
            <p style="margin:0 0 8px;font-size:12px;">
              <span style="color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${r.label}:</span>
              <span style="color:#374151;font-weight:600;"> ${r.value}</span>
            </p>
          `).join("")}
        </div>`
    }
  }

  const html = buildEmailHtml({ name: appt.name || "Patient", shortId, journeyUrl, content: mergedContent, detailsBlock })

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "OrisAlign <no-reply@orisalign.com>",
      to: [recipientEmail],
      subject: mergedContent.subject,
      html,
    }),
  })

  // WhatsApp fires alongside email, best-effort — a failure here (missing
  // phone, template not yet approved, AiSensy error) never blocks the email
  // channel or the caller. See sendWhatsApp's never-throws contract.
  const campaignName = WHATSAPP_STEP_CAMPAIGNS[stepKey]
  if (campaignName && appt.phone) {
    const paramsBuilder = WHATSAPP_STEP_PARAMS[stepKey]
    const templateParams = paramsBuilder
      ? paramsBuilder({ name: appt.name || "Patient", dentistName })
      : [appt.name || "Patient"]
    sendWhatsApp({
      campaignName,
      destination: appt.phone,
      userName: appt.name || "Patient",
      templateParams,
    })
      .then((waResult) =>
        supabase.from("message_history").insert({
          appointment_id: appointmentId,
          step_key: stepKey,
          message_type: "whatsapp",
          recipient_phone: appt.phone,
          subject: mergedContent.subject,
          body: mergedContent.body,
          is_template: true,
          delivery_status: waResult.success ? "sent" : "failed",
          delivery_provider: "aisensy",
          provider_response: waResult.success ? {} : { error: waResult.error },
          sent_by: "system",
          sent_by_role: "system",
        }),
      )
      .catch(() => {})
  }

  if (!res.ok) {
    const errText = await res.text()
    return { success: false, error: "Resend error: " + errText }
  }

  return { success: true }
}
