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

type OnlineReport = {
  id: string
  full_name: string
  patient_phone: string | null
  patient_email: string | null
  status: string
  estimated_duration: string | null
  reviewer_notes: string | null
  simulated_plan_url: string | null
  doctor_id: string | null
  plan_choice: string | null
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

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 100px" }}>
        <ReportStepTracker current={report.status === "new_submission" ? 1 : step3Unlocked || step3Done ? 3 : 2} status={report.status} />

        <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: "20px 0 4px" }}>Hi {report.full_name.split(" ")[0]},</h1>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: 12, fontSize: 13, margin: "12px 0" }}>{error}</div>
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
              {report.estimated_duration && (
                <Field label="Estimated Treatment Duration" value={report.estimated_duration} />
              )}
              {report.reviewer_notes && <Field label="Notes" value={report.reviewer_notes} />}
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
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={() => router.push(`/report/${id}/zoom-call`)}
                  style={{ background: "white", border: `1.5px solid ${GOLD}`, color: GOLD, borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  Book a Video Call with Our Smile Expert
                </button>
              </div>
            </Card>

            <Card title="Step 2 — Impression Interest">
              {step2Reached && (
                <button onClick={registerImpressionInterest} disabled={busy} style={primaryBtn}>
                  Book Your Dental Impression Appointment
                </button>
              )}
              {step2Waiting && <p style={mutedText}>Thank you for your interest. You will be contacted soon.</p>}
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

const mutedText: React.CSSProperties = { margin: 0, fontSize: 13, color: "#6b7280" }
