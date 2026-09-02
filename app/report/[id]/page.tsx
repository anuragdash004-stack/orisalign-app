"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabaseClient"
import { startOnlineReportCheckout } from "@/lib/onlineReportCheckout"
import ReportStepTracker from "@/components/ReportStepTracker"

const supabase = getSupabaseClient()

const NAVY = "#1B2A4A"
const GOLD = "#C9A84C"
const WHATSAPP_LINK = "https://wa.me/918280837370?text=Hi%2C+I%27d+like+to+talk+about+my+Online+Smile+Report"

const PHOTO_SLOT_LABELS: Record<string, string> = {
  front_bite: "Front Bite",
  upper_arch: "Upper Arch",
  lower_arch: "Lower Arch",
  left_buccal: "Left Side Bite",
  right_buccal: "Right Side Bite",
}

const CONDITION_LABELS: Record<string, string> = {
  none: "None",
  blood_pressure: "Blood pressure",
  sugar_diabetes: "Sugar / Diabetes",
  vitamin_deficiency: "Vitamin deficiency",
  recent_surgery: "Recent surgery (within 6 months to 1 year)",
  asthma: "Asthma",
  pregnancy: "Pregnancy",
  bone_defect: "Any bone defect",
}

type PhotoReviewEntry = { status?: "approved" | "rejected" | "pending"; reason?: string }

type OnlineReport = {
  id: string
  full_name: string
  age: number | null
  sex: string | null
  patient_phone: string | null
  patient_email: string | null
  status: string
  conditions: Record<string, unknown> | null
  chief_complaint: string | null
  known_cavities: string | null
  food_lodgement: string | null
  tooth_mobility: string | null
  pain: string | null
  other_concerns: string | null
  photo_urls: Record<string, string> | null
  photo_review: Record<string, PhotoReviewEntry> | null
  case_severity: string | null
  dental_concerns: string[] | null
  objectives: string[] | null
  estimated_duration: string | null
  reviewer_notes: string | null
  simulated_plan_url: string | null
  doctor_id: string | null
  plan_choice: string | null
  reviewer_question: string | null
  patient_answer: string | null
  edit_requested_at: string | null
  callback_requested_at: string | null
}

type Doctor = { id: string; name: string; designation: string; registration_number: string | null; location: string | null }

export default function ReportDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [report, setReport] = useState<OnlineReport | null>(null)
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [requestingEdit, setRequestingEdit] = useState(false)
  const [requestingCallback, setRequestingCallback] = useState(false)
  const [callbackDone, setCallbackDone] = useState(false)
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [answering, setAnswering] = useState(false)

  const load = async () => {
    const { data } = await supabase!.from("online_reports").select("*").eq("id", id).single()
    setReport(data)
    if (data?.doctor_id) {
      const { data: doc } = await supabase!.from("doctors").select("*").eq("id", data.doctor_id).single()
      setDoctor(doc)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id])

  const step2Reached = report && ["report_ready"].includes(report.status)
  const step2Waiting = report && report.status === "impression_interested"
  const step2ReadyToPay = report && report.status === "ready_to_pay_impression"
  const step2Paid = report && ["impression_paid", "impression_taken", "plan_paid", "treatment_started"].includes(report.status)
  const step3Unlocked = report && ["impression_taken"].includes(report.status)
  const step3Done = report && ["plan_paid", "treatment_started"].includes(report.status)

  const requestEdit = async () => {
    setRequestingEdit(true)
    try {
      await fetch("/api/online-report/request-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id }),
      })
      await load()
    } finally {
      setRequestingEdit(false)
    }
  }

  const requestCallback = async () => {
    setRequestingCallback(true)
    try {
      await fetch("/api/online-report/request-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id }),
      })
      setCallbackDone(true)
      await load()
    } finally {
      setRequestingCallback(false)
    }
  }

  const reuploadPhoto = async (slotKey: string, file: File) => {
    setUploadingSlot(slotKey)
    setError(null)
    try {
      const path = `${id}/${slotKey}_reupload_${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase!.storage.from("online-report-photos").upload(path, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data } = supabase!.storage.from("online-report-photos").getPublicUrl(path)

      const res = await fetch("/api/online-report/reupload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id, slotKey, url: data.publicUrl }),
      })
      const resData = await res.json()
      if (!res.ok || !resData.success) throw new Error(resData.error || "Failed to save photo")
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong uploading that photo.")
    } finally {
      setUploadingSlot(null)
    }
  }

  const submitAnswer = async () => {
    if (!answerText.trim()) return
    setAnswering(true)
    setError(null)
    try {
      const res = await fetch("/api/online-report/answer-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id, answer: answerText.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to send your answer.")
      setAnswerText("")
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setAnswering(false)
    }
  }

  const registerImpressionInterest = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/online-report/impression-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed")
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  const payImpression = async () => {
    if (!report) return
    setBusy(true)
    setError(null)
    const result = await startOnlineReportCheckout({
      amountType: "impression",
      reportId: report.id,
      patientName: report.full_name,
      patientEmail: report.patient_email || undefined,
      patientPhone: report.patient_phone || undefined,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    await load()
  }

  const payPlan = async (planChoice: "plan_only" | "plan_treatment") => {
    if (!report) return
    setBusy(true)
    setError(null)
    const result = await startOnlineReportCheckout({
      amountType: planChoice,
      reportId: report.id,
      patientName: report.full_name,
      patientEmail: report.patient_email || undefined,
      patientPhone: report.patient_phone || undefined,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    await load()
  }

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>Loading…</div>
  }

  if (!report) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>Report not found.</div>
  }

  const conditionsList = Object.entries(report.conditions || {})
    .filter(([k, v]) => k !== "other" && v)
    .map(([k]) => CONDITION_LABELS[k] || k)
    .concat(report.conditions?.other ? [`Other: ${report.conditions.other as string}`] : [])

  const hasOpenQuestion = !!report.reviewer_question && !report.patient_answer

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 100px" }}>
        <ReportStepTracker current={report.status === "new_submission" ? 1 : step3Unlocked || step3Done ? 3 : 2} status={report.status} />

        <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: "20px 0 4px" }}>Hi {report.full_name.split(" ")[0]},</h1>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: 12, fontSize: 13, margin: "12px 0" }}>{error}</div>
        )}

        {/* Your Submitted Information — always visible, read-only + Edit request */}
        <Card title="Your Submitted Information">
          <Field label="Name" value={report.full_name} />
          <div style={{ display: "flex", gap: 20 }}>
            <Field label="Age" value={report.age != null ? String(report.age) : "—"} />
            <Field label="Gender" value={report.sex || "—"} />
          </div>
          <Field label="Chief Complaint" value={report.chief_complaint || "—"} />
          <Field label="Existing Conditions" value={conditionsList.length > 0 ? conditionsList.join(", ") : "None reported"} />
          <Field label="Known Cavities" value={report.known_cavities || "—"} />
          <Field label="Food Lodgement" value={report.food_lodgement || "—"} />
          <Field label="Tooth Mobility" value={report.tooth_mobility || "—"} />
          <Field label="Pain" value={report.pain || "—"} />
          <Field label="Other Concerns" value={report.other_concerns || "—"} />

          {report.edit_requested_at ? (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#b45309", fontWeight: 700 }}>You&apos;ll be contacted soon.</p>
          ) : (
            <button onClick={requestEdit} disabled={requestingEdit} style={secondaryBtn}>
              {requestingEdit ? "Sending…" : "Edit"}
            </button>
          )}
        </Card>

        {/* Your Photos — read-only, rejected slots get a reupload control */}
        <Card title="Your Photos">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
            {Object.entries(report.photo_urls || {}).map(([slotKey, url]) => {
              const review = (report.photo_review || {})[slotKey]
              const isRejected = review?.status === "rejected"
              const isUploading = uploadingSlot === slotKey
              return (
                <div key={slotKey} style={{ border: `1.5px solid ${isRejected ? "#fecaca" : "#e5e7eb"}`, borderRadius: 10, padding: 8, background: isRejected ? "#fef2f2" : "white" }}>
                  <img src={url} alt={PHOTO_SLOT_LABELS[slotKey] || slotKey} style={{ width: "100%", height: 100, objectFit: "contain", background: "#fafafa", borderRadius: 6 }} />
                  <p style={{ margin: "6px 0 4px", fontSize: 10, color: "#6b7280", textAlign: "center", fontWeight: 700 }}>{PHOTO_SLOT_LABELS[slotKey] || slotKey}</p>
                  {isRejected ? (
                    <>
                      <p style={{ margin: "0 0 6px", fontSize: 10, color: "#dc2626", textAlign: "center", fontWeight: 700 }}>
                        Rejected{review?.reason ? `: ${review.reason}` : ""} — please reupload
                      </p>
                      <label style={{ display: "block", textAlign: "center", fontSize: 11, color: "white", background: GOLD, borderRadius: 6, padding: "6px", cursor: isUploading ? "wait" : "pointer", fontWeight: 700 }}>
                        {isUploading ? "Uploading…" : "Reupload"}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          disabled={isUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) reuploadPhoto(slotKey, file)
                          }}
                        />
                      </label>
                    </>
                  ) : review?.status === "pending" ? (
                    <p style={{ margin: 0, fontSize: 10, color: "#b45309", textAlign: "center", fontWeight: 700 }}>Submitted — awaiting review</p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Reviewer needs more info */}
        {report.reviewer_question && (
          <Card title="Your Smile Expert Needs More Info">
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "#374151" }}>{report.reviewer_question}</p>
            {hasOpenQuestion ? (
              <>
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Type your answer…"
                  style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, boxSizing: "border-box", marginBottom: 10 }}
                />
                <button onClick={submitAnswer} disabled={answering || !answerText.trim()} style={primaryBtn}>
                  {answering ? "Sending…" : "Submit Answer"}
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#168F83", textTransform: "uppercase" }}>Your answer</p>
                <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>{report.patient_answer}</p>
              </>
            )}
          </Card>
        )}

        {report.status === "new_submission" && (
          <Card>
            <p style={{ color: NAVY, fontSize: 16, fontWeight: 800, margin: "0 0 8px" }}>Your report is getting ready.</p>
            <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              A smile expert is being assigned and your personalised smile report will be generated within 24 hours.
              You will be notified soon by email/WhatsApp.
            </p>
          </Card>
        )}

        {report.status !== "new_submission" && (
          <>
            <Card title="Your Report">
              {doctor && (
                <div style={{ marginBottom: 14, padding: 12, background: "#f9fafb", borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: NAVY }}>{doctor.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
                    {doctor.designation}{doctor.location ? ` · ${doctor.location}` : ""}
                  </p>
                  {doctor.registration_number && (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>Reg. No: {doctor.registration_number}</p>
                  )}
                </div>
              )}

              {report.case_severity && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>Case Severity</p>
                  <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 99, background: "#fff7ed", color: "#b45309", fontSize: 12, fontWeight: 800, textTransform: "capitalize" }}>
                    {report.case_severity}
                  </span>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>Concern — Patient Concern</p>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#374151" }}>{report.chief_complaint || "—"}</p>
                {report.dental_concerns && report.dental_concerns.length > 0 && (
                  <>
                    <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>Dental Concern</p>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                      {report.dental_concerns.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </>
                )}
              </div>

              {report.objectives && report.objectives.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>Objectives</p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                    {report.objectives.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </div>
              )}

              {report.estimated_duration && (
                <Field label="Estimated Treatment Duration" value={report.estimated_duration} />
              )}
              {report.reviewer_notes && <Field label="Additional Notes" value={report.reviewer_notes} />}
              {report.simulated_plan_url && (
                <a
                  href={report.simulated_plan_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-block", marginTop: 10, background: NAVY, color: "white", textDecoration: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 13 }}
                >
                  View Your Simulation
                </a>
              )}
            </Card>

            {step2Reached && (
              <Card title="Next Steps">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    onClick={() => router.push(`/report/${id}/zoom-call`)}
                    style={{ background: "white", border: `1.5px solid ${GOLD}`, color: GOLD, borderRadius: 10, padding: "12px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    Book a Video Call with Our Smile Expert
                  </button>
                  {callbackDone || report.callback_requested_at ? (
                    <p style={{ ...mutedText, textAlign: "center" }}>We&apos;ll reach out to you soon.</p>
                  ) : (
                    <button onClick={requestCallback} disabled={requestingCallback} style={{ background: "white", border: "1.5px solid #e5e7eb", color: "#374151", borderRadius: 10, padding: "12px 18px", fontWeight: 700, fontSize: 13, cursor: requestingCallback ? "wait" : "pointer" }}>
                      {requestingCallback ? "Sending…" : "Request a Callback"}
                    </button>
                  )}
                  <a
                    href={WHATSAPP_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "block", textAlign: "center", background: "white", border: "1.5px solid #e5e7eb", color: "#374151", borderRadius: 10, padding: "12px 18px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
                  >
                    Chat on WhatsApp
                  </a>
                </div>
              </Card>
            )}

            <Card title="Step 2 — Dental Impression">
              {step2Reached && (
                <button onClick={registerImpressionInterest} disabled={busy} style={primaryBtn}>
                  Book for Dental Impression — ₹999
                </button>
              )}
              {step2Waiting && <p style={mutedText}>You will be reached out very soon.</p>}
              {step2ReadyToPay && (
                <button onClick={payImpression} disabled={busy} style={primaryBtn}>
                  Pay <span style={{ textDecoration: "line-through", opacity: 0.7, margin: "0 4px" }}>₹1999</span> ₹999 for Impression Visit
                </button>
              )}
              {step2Paid && <p style={mutedText}>✓ Impression payment received.</p>}
            </Card>

            {(step3Unlocked || step3Done) && (
              <Card title="Step 3 — Full Plan / Start Treatment">
                {step3Unlocked && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <PlanCard
                      title="Get Full Plan Only"
                      struck={3499}
                      price={2499}
                      onClick={() => payPlan("plan_only")}
                      busy={busy}
                    />
                    <PlanCard
                      title="Get Full Plan + Start Treatment (Month 1)"
                      price={4999}
                      onClick={() => payPlan("plan_treatment")}
                      busy={busy}
                    />
                  </div>
                )}
                {step3Done && (
                  <p style={mutedText}>
                    ✓ Payment received for {report.plan_choice === "plan_treatment" ? "Full Plan + Start Treatment" : "Full Plan Only"}.
                  </p>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: 20, marginTop: 16, border: "1px solid #e5e7eb" }}>
      {title && <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h3>}
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{value}</p>
    </div>
  )
}

function PlanCard({ title, struck, price, onClick, busy }: { title: string; struck?: number; price: number; onClick: () => void; busy: boolean }) {
  return (
    <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: NAVY }}>{title}</p>
      <p style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 900, color: GOLD }}>
        {struck && <span style={{ textDecoration: "line-through", color: "#9ca3af", fontSize: 13, marginRight: 6 }}>₹{struck}</span>}
        ₹{price}
      </p>
      <button onClick={onClick} disabled={busy} style={{ ...primaryBtn, width: "100%", padding: "10px" }}>Choose</button>
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  background: GOLD,
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "12px 18px",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
}

const secondaryBtn: React.CSSProperties = {
  background: "white",
  color: "#374151",
  border: "1.5px solid #e5e7eb",
  borderRadius: 10,
  padding: "9px 16px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  marginTop: 6,
}

const mutedText: React.CSSProperties = { margin: 0, fontSize: 13, color: "#6b7280" }
