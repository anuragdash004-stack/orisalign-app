"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabaseClient"
import { startOnlineReportCheckout, type ReportFormData } from "@/lib/onlineReportCheckout"
import ReportStepTracker from "@/components/ReportStepTracker"

const supabase = getSupabaseClient()

const NAVY = "#1B2A4A"
const GOLD = "#C9A84C"

const PHOTO_SLOTS = [
  { key: "front_bite", label: "Front Bite (teeth together)", hint: "Smile straight at the camera with teeth closed together." },
  { key: "upper_arch", label: "Upper Arch (top teeth)", hint: "Tilt your head back, photograph the roof-side view of your upper teeth." },
  { key: "lower_arch", label: "Lower Arch (bottom teeth)", hint: "Tilt your head down, photograph the top-down view of your lower teeth." },
  { key: "left_buccal", label: "Left Side Bite", hint: "Turn your head to show the left side of your bite, teeth together." },
  { key: "right_buccal", label: "Right Side Bite", hint: "Turn your head to show the right side of your bite, teeth together." },
] as const

type PhotoKey = (typeof PHOTO_SLOTS)[number]["key"]

function PlaceholderDiagram() {
  return (
    <svg viewBox="0 0 64 48" width="56" height="42" fill="none" stroke="#b8905a" strokeWidth="1.5">
      <rect x="8" y="10" width="48" height="28" rx="6" />
      <path d="M14 24h36M20 16v16M28 16v16M36 16v16M44 16v16" />
    </svg>
  )
}

const CONDITION_FIELDS = [
  { key: "blood_pressure", label: "Blood pressure" },
  { key: "sugar_diabetes", label: "Sugar / Diabetes" },
  { key: "pcod", label: "PCOD" },
  { key: "vitamin_deficiency", label: "Vitamin deficiency" },
  { key: "recent_surgery", label: "Recent surgery" },
  { key: "asthma", label: "Asthma" },
  { key: "pregnancy", label: "Pregnancy" },
] as const

export default function UploadStepPage() {
  const router = useRouter()

  const [reportId] = useState(() => crypto.randomUUID())

  const [photos, setPhotos] = useState<Partial<Record<PhotoKey, File>>>({})
  const [uploading, setUploading] = useState(false)

  const [fullName, setFullName] = useState("")
  const [age, setAge] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  const [conditions, setConditions] = useState<Record<string, boolean>>({})
  const [conditionOther, setConditionOther] = useState("")

  const [knownCavities, setKnownCavities] = useState("")
  const [foodLodgement, setFoodLodgement] = useState("")
  const [toothMobility, setToothMobility] = useState("")
  const [otherConcerns, setOtherConcerns] = useState("")

  const [consent, setConsent] = useState(false)

  const [couponInput, setCouponInput] = useState("")
  const [couponApplied, setCouponApplied] = useState<{ code: string; discountedAmount: number } | null>(null)
  const [couponChecking, setCouponChecking] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const allPhotosSelected = PHOTO_SLOTS.every((s) => photos[s.key])
  const displayAmount = couponApplied ? couponApplied.discountedAmount : 399

  const handlePhoto = (key: PhotoKey, file: File | null) => {
    if (!file) return
    setPhotos((p) => ({ ...p, [key]: file }))
  }

  const applyCoupon = async () => {
    if (!couponInput.trim()) return
    setCouponChecking(true)
    setCouponError(null)
    try {
      const res = await fetch("/api/online-report/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim(), amountType: "report" }),
      })
      const data = await res.json()
      if (!data.valid) {
        setCouponError(data.error || "Invalid coupon")
        setCouponApplied(null)
        return
      }
      setCouponApplied({ code: couponInput.trim().toUpperCase(), discountedAmount: data.discountedAmount })
    } catch {
      setCouponError("Couldn't validate coupon — please try again.")
    } finally {
      setCouponChecking(false)
    }
  }

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = []
    for (const slot of PHOTO_SLOTS) {
      const file = photos[slot.key]
      if (!file) continue
      const path = `${reportId}/${slot.key}_${file.name}`
      const { error: uploadError } = await supabase!.storage.from("online-report-photos").upload(path, file, { upsert: true })
      if (uploadError) throw new Error(`Failed to upload ${slot.label}: ${uploadError.message}`)
      const { data } = supabase!.storage.from("online-report-photos").getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    return urls
  }

  const handleSubmit = async () => {
    setError(null)

    if (!fullName.trim() || !age || !phone.trim()) {
      setError("Please fill in your name, age and phone number.")
      return
    }
    if (!allPhotosSelected) {
      setError("Please upload all 5 photos.")
      return
    }
    if (!consent) {
      setError("Please accept the consent section to continue.")
      return
    }

    setSubmitting(true)
    setUploading(true)
    try {
      const photoUrls = await uploadPhotos()
      setUploading(false)

      const formData: ReportFormData = {
        fullName: fullName.trim(),
        age: Number(age),
        patientPhone: phone.trim(),
        patientEmail: email.trim() || null,
        conditions: { ...conditions, other: conditionOther.trim() },
        knownCavities: knownCavities.trim() || null,
        foodLodgement: foodLodgement.trim() || null,
        toothMobility: toothMobility.trim() || null,
        otherConcerns: otherConcerns.trim() || null,
        photoUrls,
      }

      if (couponApplied && couponApplied.discountedAmount === 0) {
        const res = await fetch("/api/online-report/free-submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId, couponCode: couponApplied.code, formData }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          setError(data.error || "Failed to submit — please try again.")
          setSubmitting(false)
          return
        }
        setDone(true)
        setSubmitting(false)
        return
      }

      const result = await startOnlineReportCheckout({
        amountType: "report",
        reportId,
        couponCode: couponApplied?.code,
        patientName: fullName.trim(),
        patientEmail: email.trim() || undefined,
        patientPhone: phone.trim(),
        formData,
      })

      if (!result.success) {
        setError(result.error)
        setSubmitting(false)
        return
      }

      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.")
    } finally {
      setSubmitting(false)
      setUploading(false)
    }
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf7f2", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 480, background: "white", borderRadius: 20, padding: "40px 32px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}>
          <h1 style={{ color: NAVY, fontSize: 22, margin: "0 0 12px" }}>Thank you for your payment.</h1>
          <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.7, margin: "0 0 20px" }}>
            Your online report will be generated in 24–48 hours. We'll notify you by email/WhatsApp when it's ready.
          </p>
          <button
            onClick={() => router.push(`/report/${reportId}`)}
            style={{ background: NAVY, color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}
          >
            View Your Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 100px" }}>
        <ReportStepTracker current={1} status="new_submission" />

        <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "20px 0 4px" }}>Upload Your Photos & Info</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>
          ₹399 <span style={{ textDecoration: "line-through", color: "#9ca3af" }}>₹999</span> — provisional assessment
        </p>

        <Section title="Upload 5 Photos">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            {PHOTO_SLOTS.map((slot) => (
              <div key={slot.key} style={{ border: `2px dashed ${photos[slot.key] ? "#22c55e" : "#e5e7eb"}`, borderRadius: 12, padding: 14, background: photos[slot.key] ? "#f0fdf4" : "#fafafa" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <PlaceholderDiagram />
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#374151" }}>{slot.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "#9ca3af" }}>{slot.hint}</p>
                  </div>
                </div>
                {photos[slot.key] ? (
                  <p style={{ margin: 0, fontSize: 11, color: "#16a34a", wordBreak: "break-all" }}>✓ {photos[slot.key]!.name}</p>
                ) : (
                  <label style={{ display: "block", fontSize: 12, color: GOLD, fontWeight: 700, cursor: "pointer" }}>
                    Choose photo
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handlePhoto(slot.key, e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
            Reference diagrams shown are placeholders — sample reference photos should be added before this goes live.
          </p>
        </Section>

        <Section title="Your Information">
          <Input label="Full Name" value={fullName} onChange={setFullName} />
          <Input label="Age" value={age} onChange={setAge} type="number" />
          <Input label="Phone Number" value={phone} onChange={setPhone} type="tel" />
          <Input label="Email (optional)" value={email} onChange={setEmail} type="email" />
        </Section>

        <Section title="Existing Conditions">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {CONDITION_FIELDS.map((c) => (
              <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: NAVY, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!conditions[c.key]}
                  onChange={(e) => setConditions((cs) => ({ ...cs, [c.key]: e.target.checked }))}
                />
                {c.label}
              </label>
            ))}
          </div>
          <textarea
            placeholder="Other conditions (optional)"
            value={conditionOther}
            onChange={(e) => setConditionOther(e.target.value)}
            style={{ ...inputStyle, marginTop: 10, minHeight: 60 }}
          />
        </Section>

        <Section title="Dental Self-Assessment">
          <textarea placeholder="Known cavities" value={knownCavities} onChange={(e) => setKnownCavities(e.target.value)} style={{ ...inputStyle, minHeight: 50, marginBottom: 10 }} />
          <textarea placeholder="Food lodgement issues" value={foodLodgement} onChange={(e) => setFoodLodgement(e.target.value)} style={{ ...inputStyle, minHeight: 50, marginBottom: 10 }} />
          <textarea placeholder="Any tooth mobility / shakiness when pressed with finger" value={toothMobility} onChange={(e) => setToothMobility(e.target.value)} style={{ ...inputStyle, minHeight: 50, marginBottom: 10 }} />
          <textarea placeholder="Any other concerns, in your own words" value={otherConcerns} onChange={(e) => setOtherConcerns(e.target.value)} style={{ ...inputStyle, minHeight: 50 }} />
        </Section>

        <Section title="Please Read & Accept">
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, fontSize: 12, color: "#4b5563", lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 8px" }}>
              This is a provisional/estimated assessment, not a final diagnosis. Final diagnosis requires an
              in-person intraoral scan and impression by a registered dentist.
            </p>
            <p style={{ margin: "0 0 8px" }}>
              We implement industry-standard security safeguards to protect your data in accordance with the DPDP
              Act, 2023.
            </p>
            <p style={{ margin: "0 0 8px" }}>₹399 is non-refundable.</p>
            <p style={{ margin: 0 }}>
              The reviewing doctor's name, qualification, and registration number will be shown once the report is
              delivered.
            </p>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, marginTop: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
            I have read and accept the above.
          </label>
        </Section>

        <Section title="Coupon Code">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="Enter coupon code"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={applyCoupon} disabled={couponChecking} style={{ background: NAVY, color: "white", border: "none", borderRadius: 10, padding: "0 18px", fontWeight: 700, cursor: "pointer" }}>
              {couponChecking ? "Checking…" : "Apply"}
            </button>
          </div>
          {couponError && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>{couponError}</p>}
          {couponApplied && <p style={{ color: "#16a34a", fontSize: 12, marginTop: 6 }}>Coupon "{couponApplied.code}" applied — ₹{couponApplied.discountedAmount} payable.</p>}
        </Section>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: "100%",
            background: GOLD,
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "16px",
            fontSize: 15,
            fontWeight: 800,
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {uploading ? "Uploading photos…" : submitting ? "Processing…" : displayAmount === 0 ? "Submit — Free" : `Pay ₹${displayAmount} & Submit`}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: 20, marginBottom: 16, border: "1px solid #e5e7eb" }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h3>
      {children}
    </div>
  )
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <input placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} type={type} style={inputStyle} />
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  color: "#111827",
  fontFamily: "inherit",
}
