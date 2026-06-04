import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
      subject: "Payment Confirmed — OrisAlign",
      headline: "Payment Confirmed!",
      body: "Your payment details have been finalised. Thank you for your trust in OrisAlign. Our team will now proceed with your treatment planning and keep you updated at every step.",
      nextStep: "Treatment Planning",
    },
    planning_done: {
      emoji: "📋",
      subject: "Your Treatment Plan is Ready — OrisAlign",
      headline: "Treatment Plan Ready!",
      body: "Your personalised 3D treatment plan has been prepared by our orthodontic team! Please visit your journey page to review it. Once you're satisfied, click the Approve Plan button to authorise us to begin fabricating your aligners.",
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
  patientId: string
  content: StepContent
}): string {
  const { name, shortId, patientId, content } = params
  const journeyUrl = `https://app.orisalign.com/patient/${patientId}`

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

      ${nextStepBlock}

      <div style="text-align:center;margin:24px 0 16px;">
        <a href="${journeyUrl}" style="display:inline-block;background:#1B2A4A;color:#C9A84C;font-weight:700;font-size:14px;padding:13px 30px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
          View My Journey Page →
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.7;text-align:center;">
        For any queries, reach us at
        <a href="mailto:hello@orisalign.com" style="color:#C9A84C;font-weight:600;">hello@orisalign.com</a>
        or call <strong>+91 80 6217 8511</strong>.
      </p>

      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:16px;">
        OrisAlign · Chandrasekharpur, Bhubaneswar, Odisha<br/>
        <a href="${journeyUrl}" style="color:#9ca3af;font-size:11px;">Your journey page: app.orisalign.com/patient/${shortId.toLowerCase()}</a>
      </p>
    </div>
  `
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { appointmentId, stepKey } = await req.json()

    if (!appointmentId || !stepKey) {
      return NextResponse.json({ error: "Missing appointmentId or stepKey" }, { status: 400 })
    }

    const content = getStepContent(stepKey)
    if (!content) {
      return NextResponse.json({ skipped: true, reason: "No notification configured for this step" })
    }

    const { data: appt, error: fetchErr } = await supabase
      .from("appointments_booking")
      .select("id, name, email")
      .eq("id", appointmentId)
      .single()

    if (fetchErr || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    if (!appt.email) {
      return NextResponse.json({ skipped: true, reason: "No email on record" })
    }

    const shortId = appt.id.substring(0, 8).toUpperCase()
    const html = buildEmailHtml({ name: appt.name || "Patient", shortId, patientId: appt.id, content })

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "OrisAlign <no-reply@orisalign.com>",
        to: [appt.email],
        subject: content.subject,
        html,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: "Resend error: " + errText }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
