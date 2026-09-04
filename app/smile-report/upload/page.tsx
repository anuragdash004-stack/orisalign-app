"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabaseClient"
import { BASE_PRICES_RUPEES } from "@/lib/onlineReportPricing"
import { startOnlineReportCheckout, type ReportFormData } from "@/lib/onlineReportCheckout"

const supabase = getSupabaseClient()

const NAVY = "#1B2A4A"
const GOLD = "#C9A84C"

const PHOTO_SLOTS = [
  { key: "front_bite", label: "Front Bite (teeth together)", hint: "Retract your lips with your fingers, as in the sample image, and clench/close your teeth so your back teeth are completely closed." },
  { key: "upper_arch", label: "Upper Arch (top teeth)", hint: "Tilt your head back, photograph the roof-side view of your upper teeth." },
  { key: "lower_arch", label: "Lower Arch (bottom teeth)", hint: "Tilt your head down, photograph the top-down view of your lower teeth." },
  { key: "left_buccal", label: "Left Side Bite", hint: "Bite your teeth together and retract your lips with your two left fingers, as in the sample image, then click the photograph so as to capture your last tooth." },
  { key: "right_buccal", label: "Right Side Bite", hint: "Bite your teeth together and retract your lips with your two right fingers, as in the sample image, then click the photograph so as to capture your last tooth." },
] as const

type PhotoKey = (typeof PHOTO_SLOTS)[number]["key"]

const REFERENCE_IMAGE_SIZE = 140

function PlaceholderDiagram() {
  return (
    <svg viewBox="0 0 64 48" width="60%" height="60%" fill="none" stroke="#b8905a" strokeWidth="1.5">
      <rect x="8" y="10" width="48" height="28" rx="6" />
      <path d="M14 24h36M20 16v16M28 16v16M36 16v16M44 16v16" />
    </svg>
  )
}

/**
 * Real reference photo if one's been dropped into public/smile-report/{key}.jpg,
 * falling back to the generic line-art diagram when the file doesn't exist yet.
 * Square, sits top-left of the card next to the label/instructions.
 */
function ReferenceImage({ photoKey }: { photoKey: PhotoKey }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div style={{ width: REFERENCE_IMAGE_SIZE, height: REFERENCE_IMAGE_SIZE, flexShrink: 0, background: "#fafafa", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PlaceholderDiagram />
      </div>
    )
  }
  return (
    <div style={{ width: REFERENCE_IMAGE_SIZE, height: REFERENCE_IMAGE_SIZE, flexShrink: 0, background: "#fafafa", borderRadius: 10, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- reference photo shown as a fixed-size thumbnail, next/image is overkill here */}
      <img
        src={`/smile-report/${photoKey}.jpg`}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

/**
 * Live preview of the patient's own chosen file, shown directly under the
 * sample so they can compare the two before continuing. Uses a local
 * object URL for an instant preview — separate from the actual upload to
 * Supabase Storage, which happens in parallel (see handlePhoto).
 */
function UploadedPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  if (!url) return null
  return (
    <div style={{ width: REFERENCE_IMAGE_SIZE, height: REFERENCE_IMAGE_SIZE, flexShrink: 0, background: "#fafafa", borderRadius: 10, overflow: "hidden", marginTop: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, next/image doesn't support blob: sources */}
      <img src={url} alt="Your photo" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </div>
  )
}

/**
 * Preview for a photo restored from a resumed draft — there's no local
 * File to build an object URL from, only the already-uploaded public URL.
 */
function RemotePreview({ url }: { url: string }) {
  return (
    <div style={{ width: REFERENCE_IMAGE_SIZE, height: REFERENCE_IMAGE_SIZE, flexShrink: 0, background: "#fafafa", borderRadius: 10, overflow: "hidden", marginTop: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage URL, next/image config for this host isn't set up */}
      <img src={url} alt="Your photo" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </div>
  )
}

const CONDITION_FIELDS = [
  { key: "blood_pressure", label: "Blood pressure" },
  { key: "sugar_diabetes", label: "Sugar / Diabetes" },
  { key: "vitamin_deficiency", label: "Vitamin deficiency" },
  { key: "recent_surgery", label: "Recent surgery (within 6 months to 1 year)" },
  { key: "asthma", label: "Asthma" },
  { key: "pregnancy", label: "Pregnancy" },
  { key: "bone_defect", label: "Any bone defect" },
] as const

const TOOTH_LOCATIONS = [
  "Upper Left Front Tooth",
  "Upper Left Back Tooth",
  "Upper Right Front Tooth",
  "Upper Right Back Tooth",
  "Lower Left Front Tooth",
  "Lower Left Back Tooth",
  "Lower Right Front Tooth",
  "Lower Right Back Tooth",
] as const

/** Selected locations serialize to a comma-joined string for the known_cavities/food_lodgement/tooth_mobility text columns — "Not available" when nothing's picked. */
function serializeLocations(selected: string[]): string {
  return selected.length ? selected.join(", ") : "Not available"
}

/** Inverse of serializeLocations — for restoring a resumed draft's picks. */
function parseLocations(value: string | null | undefined): string[] {
  if (!value || value === "Not available") return []
  return value.split(",").map((s) => s.trim()).filter(Boolean)
}

/**
 * Collapsed by default — just the label and an "+ Add" button. Clicking Add
 * reveals the 8 tooth-location options for this field. Stays expanded once
 * opened, or if it already has selections (e.g. navigating back to this
 * step), so the patient's picks are never hidden from them.
 */
function ToothLocationPicker({
  label,
  selected,
  onChange,
  disabled,
}: {
  label: string
  selected: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const [expanded, setExpanded] = useState(selected.length > 0)
  // Auto-expand if selections arrive after mount — e.g. a resumed draft's
  // locations load asynchronously, after this component already rendered
  // collapsed with an empty `selected`.
  useEffect(() => {
    if (selected.length > 0) setExpanded(true)
  }, [selected.length])

  const toggle = (loc: string) => {
    onChange(selected.includes(loc) ? selected.filter((l) => l !== loc) : [...selected, loc])
  }

  return (
    <div style={{ marginBottom: 18, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: expanded && !disabled ? 8 : 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: NAVY }}>{label}</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setExpanded((e) => !e)}
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            color: expanded ? "#6b7280" : GOLD,
            background: expanded ? "#f3f4f6" : "#fff8ec",
            border: `1px solid ${expanded ? "#e5e7eb" : GOLD}`,
            borderRadius: 999,
            padding: "5px 12px",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {expanded ? "Hide" : "+ Add"}
        </button>
      </div>

      {!expanded && selected.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: "#946F3F" }}>{selected.join(", ")}</p>
      )}

      {expanded && !disabled && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {TOOTH_LOCATIONS.map((loc) => {
              const active = selected.includes(loc)
              return (
                <button
                  type="button"
                  key={loc}
                  onClick={() => toggle(loc)}
                  style={{
                    textAlign: "left",
                    padding: "9px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1.5px solid ${active ? GOLD : "#e5e7eb"}`,
                    background: active ? "#fff8ec" : "white",
                    color: active ? "#946F3F" : "#374151",
                    cursor: "pointer",
                  }}
                >
                  {active ? "✓ " : ""}
                  {loc}
                </button>
              )
            })}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af" }}>Select all that apply — leave blank if not applicable.</p>
        </>
      )}
    </div>
  )
}

const FORM_STEPS = [
  { n: 1, label: "Your Info" },
  { n: 2, label: "Assessment" },
  { n: 3, label: "Photos" },
  { n: 4, label: "Payment" },
] as const

function FormStepTracker({ current }: { current: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {FORM_STEPS.map((s, i) => (
        <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < FORM_STEPS.length - 1 ? 1 : undefined, gap: 6 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              flexShrink: 0,
              background: s.n === current ? GOLD : s.n < current ? "#e0f2e9" : "#f3f4f6",
              color: s.n === current ? "white" : s.n < current ? "#168F83" : "#9ca3af",
            }}
            title={s.label}
          >
            {s.n < current ? "✓" : s.n}
          </div>
          {i < FORM_STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: s.n < current ? "#3FB3A4" : "#e5e7eb" }} />}
        </div>
      ))}
    </div>
  )
}

export default function UploadStepPage() {
  const router = useRouter()

  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0)
  // Not const — swapped out for an existing draft's id if the phone number
  // entered at Step 1 matches an incomplete submission (see checkForDraft).
  const [reportId, setReportId] = useState(() => crypto.randomUUID())
  // Which draft id's Step 2 fields we've already pulled into local state —
  // guards against re-clicking Continue on Step 1 (e.g. after Back-ing up
  // to fix something) re-fetching the old database version and clobbering
  // edits the patient already made this session but hasn't saved forward
  // via goToStep3 yet.
  const appliedDraftIdRef = useRef<string | null>(null)

  // Step 1 — basic info
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [sex, setSex] = useState("")
  const [age, setAge] = useState("")
  const [checkingDraft, setCheckingDraft] = useState(false)
  const [resumedDraft, setResumedDraft] = useState(false)
  /** Set when this phone number already has a completed (paid) report — blocks re-submission below. */
  const [existingMemberReportId, setExistingMemberReportId] = useState<string | null>(null)

  // Step 2 — chief complaint + conditions + dental self-assessment
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [conditions, setConditions] = useState<Record<string, boolean>>({})

  /** "None" is mutually exclusive with every other condition (including Other). */
  const toggleCondition = (key: string) => {
    if (key === "none") {
      const turningOn = !conditions.none
      if (turningOn) {
        setConditions({ none: true })
        setConditionOtherChecked(false)
      } else {
        setConditions((cs) => ({ ...cs, none: false }))
      }
      return
    }
    setConditions((cs) => ({ ...cs, [key]: !cs[key], none: false }))
  }

  const [conditionOtherChecked, setConditionOtherChecked] = useState(false)
  const [conditionOtherText, setConditionOtherText] = useState("")
  const [cavityLocations, setCavityLocations] = useState<string[]>([])
  const [foodLodgementLocations, setFoodLodgementLocations] = useState<string[]>([])
  const [toothMobilityLocations, setToothMobilityLocations] = useState<string[]>([])
  const [painLocations, setPainLocations] = useState<string[]>([])
  const [otherConcerns, setOtherConcerns] = useState("")

  /**
   * "None" for the whole Dental Self-Assessment section — mutually exclusive
   * with every field in it, same pattern as the Existing Conditions "None".
   */
  const [dentalNone, setDentalNone] = useState(false)
  const toggleDentalNone = () => {
    const turningOn = !dentalNone
    setDentalNone(turningOn)
    if (turningOn) {
      setCavityLocations([])
      setFoodLodgementLocations([])
      setToothMobilityLocations([])
      setPainLocations([])
      setOtherConcerns("")
    }
  }
  const setCavityLocationsChecked = (next: string[]) => {
    setCavityLocations(next)
    if (next.length) setDentalNone(false)
  }
  const setFoodLodgementLocationsChecked = (next: string[]) => {
    setFoodLodgementLocations(next)
    if (next.length) setDentalNone(false)
  }
  const setToothMobilityLocationsChecked = (next: string[]) => {
    setToothMobilityLocations(next)
    if (next.length) setDentalNone(false)
  }
  const setPainLocationsChecked = (next: string[]) => {
    setPainLocations(next)
    if (next.length) setDentalNone(false)
  }
  const setOtherConcernsChecked = (val: string) => {
    setOtherConcerns(val)
    if (val.trim()) setDentalNone(false)
  }

  /**
   * Restores everything from Step 2 onward (conditions + dental
   * self-assessment) that a matched draft already had saved. Deliberately
   * does NOT touch fullName/sex/age — those should always reflect whatever
   * the patient typed just now, even if it differs from what's on the old
   * draft, and get saved as the latest Step 1 info for that same record.
   */
  const applyDraftStep2Fields = (draft: {
    chief_complaint?: string | null
    conditions?: Record<string, unknown> | null
    known_cavities?: string | null
    food_lodgement?: string | null
    tooth_mobility?: string | null
    pain?: string | null
    other_concerns?: string | null
    photo_urls?: Record<string, string> | null
  }) => {
    setChiefComplaint(draft.chief_complaint || "")
    if (draft.photo_urls) setPhotoUrls(draft.photo_urls)

    const cond = draft.conditions || {}
    const { other, ...boolFlags } = cond
    setConditions(boolFlags as Record<string, boolean>)
    if (typeof other === "string" && other.trim()) {
      setConditionOtherChecked(true)
      setConditionOtherText(other)
    } else {
      setConditionOtherChecked(false)
      setConditionOtherText("")
    }

    const cavities = parseLocations(draft.known_cavities)
    const food = parseLocations(draft.food_lodgement)
    const mobility = parseLocations(draft.tooth_mobility)
    const pain = parseLocations(draft.pain)
    const otherText = draft.other_concerns || ""
    setCavityLocations(cavities)
    setFoodLodgementLocations(food)
    setToothMobilityLocations(mobility)
    setPainLocations(pain)
    setOtherConcerns(otherText)

    // The DB doesn't store a separate "dental None" flag — infer it from
    // the data itself, so the checkbox reflects the old draft's state
    // instead of appearing unchecked even though nothing was filled.
    setDentalNone(!cavities.length && !food.length && !mobility.length && !pain.length && !otherText.trim())
  }

  /**
   * Fired when the patient leaves the phone field at Step 1 — purely
   * informational (shows the "welcome back" banner). The authoritative
   * lookup that actually resolves the draft id and restores Step 2 data
   * happens in goToStep2 itself, right before saving, so it can never race
   * with — or be skipped ahead of — the Continue click.
   */
  const checkForDraft = async () => {
    const trimmed = phone.trim()
    if (!trimmed) return
    setCheckingDraft(true)
    try {
      const [draftRes, memberRes] = await Promise.all([
        fetch(`/api/online-report/find-draft?phone=${encodeURIComponent(trimmed)}`),
        fetch(`/api/online-report/check-member?phone=${encodeURIComponent(trimmed)}`),
      ])
      const [draftData, memberData] = await Promise.all([draftRes.json(), memberRes.json()])
      if (memberData.isMember) {
        setExistingMemberReportId(memberData.reportId)
      } else {
        setExistingMemberReportId(null)
        if (draftData.found) setResumedDraft(true)
      }
    } catch {
      // Silent — this is a convenience preview, not a required step.
    } finally {
      setCheckingDraft(false)
    }
  }

  // Step 3 — photos. Each photo uploads to Supabase Storage the moment it's
  // chosen (not deferred to Step 4), so it's actually persisted in the
  // backend as soon as it's picked — photoUrls holds the resulting public
  // URL per slot once its upload finishes.
  const [photos, setPhotos] = useState<Partial<Record<PhotoKey, File>>>({})
  const [photoUrls, setPhotoUrls] = useState<Partial<Record<PhotoKey, string>>>({})
  const [photoUploading, setPhotoUploading] = useState<Partial<Record<PhotoKey, boolean>>>({})
  const [photoUploadError, setPhotoUploadError] = useState<Partial<Record<PhotoKey, string>>>({})

  // Step 4 — consent, coupon, payment
  const [consent, setConsent] = useState(true)
  const [couponInput, setCouponInput] = useState("")
  const [couponApplied, setCouponApplied] = useState<{ code: string; discountedAmount: number } | null>(null)
  const [couponChecking, setCouponChecking] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [savingLead, setSavingLead] = useState(false)
  const [savingStep2, setSavingStep2] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allPhotosUploaded = PHOTO_SLOTS.every((s) => photoUrls[s.key])
  const anyPhotoUploading = PHOTO_SLOTS.some((s) => photoUploading[s.key])
  const displayAmount = couponApplied ? couponApplied.discountedAmount : BASE_PRICES_RUPEES.report

  const goToStep2 = async () => {
    setError(null)
    setExistingMemberReportId(null)
    if (!fullName.trim() || !phone.trim() || !sex || !age) {
      setError("Please fill in your full name, phone number, gender and age.")
      return
    }
    setSavingLead(true)
    try {
      // Authoritative check, not just the onBlur preview — a phone number
      // with a completed (paid) report doesn't get a new submission at all.
      const memberRes = await fetch(`/api/online-report/check-member?phone=${encodeURIComponent(phone.trim())}`)
      const memberData = await memberRes.json()
      if (memberData.isMember) {
        setExistingMemberReportId(memberData.reportId)
        return
      }

      // Re-resolve the correct id right before saving, rather than trusting
      // reportId state — the onBlur draft lookup (checkForDraft) is async
      // and can still be in flight if Continue is clicked right after
      // typing the phone number, which previously raced this save and
      // created a duplicate row under a fresh id instead of reusing the
      // patient's existing draft. When a draft is found, also pull its
      // Step 2 answers into local state right now — otherwise, if the
      // patient proceeds straight through Step 2 without editing anything,
      // Step 4 would submit empty values and blank out their old answers.
      let idToUse = reportId
      try {
        const draftRes = await fetch(`/api/online-report/find-draft?phone=${encodeURIComponent(phone.trim())}`)
        const draftData = await draftRes.json()
        if (draftData.found) {
          idToUse = draftData.draft.id
          if (idToUse !== reportId) setReportId(idToUse)
          if (appliedDraftIdRef.current !== idToUse) {
            applyDraftStep2Fields(draftData.draft)
            appliedDraftIdRef.current = idToUse
            setResumedDraft(true)
          }
        }
      } catch {
        // Fall back to the current reportId — worst case a fresh row.
      }

      const res = await fetch("/api/online-report/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: idToUse, fullName: fullName.trim(), phone: phone.trim(), sex, age: Number(age) }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Couldn't save your details — please try again.")
        return
      }
      setStep(2)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      setError("Couldn't reach the server — please check your connection and try again.")
    } finally {
      setSavingLead(false)
    }
  }

  const goToStep3 = async () => {
    setError(null)
    setSavingStep2(true)
    try {
      const res = await fetch("/api/online-report/save-step2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          chiefComplaint: chiefComplaint.trim() || null,
          conditions: { ...conditions, other: conditionOtherChecked ? conditionOtherText.trim() : "" },
          knownCavities: serializeLocations(cavityLocations),
          foodLodgement: serializeLocations(foodLodgementLocations),
          toothMobility: serializeLocations(toothMobilityLocations),
          pain: serializeLocations(painLocations),
          otherConcerns: otherConcerns.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Couldn't save — please try again.")
        return
      }
      setStep(3)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      setError("Couldn't reach the server — please check your connection and try again.")
    } finally {
      setSavingStep2(false)
    }
  }

  const goToStep4 = () => {
    setError(null)
    if (anyPhotoUploading) {
      setError("Please wait for all photos to finish uploading.")
      return
    }
    if (!allPhotosUploaded) {
      setError("Please upload all 5 photos.")
      return
    }
    setStep(4)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const backTo = (n: 0 | 1 | 2 | 3) => {
    setError(null)
    setStep(n)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handlePhoto = async (key: PhotoKey, file: File | null) => {
    if (!file) return
    setPhotos((p) => ({ ...p, [key]: file }))
    setPhotoUrls((p) => ({ ...p, [key]: undefined }))
    setPhotoUploadError((p) => ({ ...p, [key]: undefined }))
    setPhotoUploading((p) => ({ ...p, [key]: true }))
    try {
      const slot = PHOTO_SLOTS.find((s) => s.key === key)!
      const path = `${reportId}/${key}_${file.name}`
      const { error: uploadError } = await supabase!.storage.from("online-report-photos").upload(path, file, { upsert: true })
      if (uploadError) throw new Error(`Failed to upload ${slot.label}: ${uploadError.message}`)
      const { data } = supabase!.storage.from("online-report-photos").getPublicUrl(path)
      setPhotoUrls((p) => ({ ...p, [key]: data.publicUrl }))

      // Persist onto the draft row right away — not deferred to Step 4 — so
      // a patient who drops off after this point can still resume with this
      // photo already showing next time, since the file itself is already
      // sitting in Storage but the row wouldn't otherwise reference it.
      fetch("/api/online-report/save-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, slotKey: key, url: data.publicUrl }),
      }).catch(() => {
        // Non-fatal — the photo is uploaded and usable this session either
        // way; worst case is just that resuming later won't show it.
      })
    } catch (err: unknown) {
      setPhotoUploadError((p) => ({ ...p, [key]: err instanceof Error ? err.message : "Upload failed" }))
    } finally {
      setPhotoUploading((p) => ({ ...p, [key]: false }))
    }
  }

  /** Clears a photo (freshly uploaded or restored from a resumed draft) so the patient can pick a different one. */
  const handleCancelPhoto = (key: PhotoKey) => {
    setPhotos((p) => ({ ...p, [key]: undefined }))
    setPhotoUrls((p) => ({ ...p, [key]: undefined }))
    setPhotoUploadError((p) => ({ ...p, [key]: undefined }))
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

  const handleSubmit = async () => {
    setError(null)

    if (!consent) {
      setError("Please accept the consent section to continue.")
      return
    }
    if (!allPhotosUploaded) {
      setError("Please go back and finish uploading all 5 photos.")
      return
    }

    setSubmitting(true)
    try {
      const formData: ReportFormData = {
        fullName: fullName.trim(),
        age: Number(age),
        sex,
        patientPhone: phone.trim(),
        patientEmail: null,
        chiefComplaint: chiefComplaint.trim() || null,
        conditions: { ...conditions, other: conditionOtherChecked ? conditionOtherText.trim() : "" },
        knownCavities: serializeLocations(cavityLocations),
        foodLodgement: serializeLocations(foodLodgementLocations),
        toothMobility: serializeLocations(toothMobilityLocations),
        pain: serializeLocations(painLocations),
        otherConcerns: otherConcerns.trim() || null,
        photoUrls: photoUrls as Record<string, string>,
      }

      // Free either because the report itself is free now, or because a coupon
      // covers it in full — both skip the gateway.
      if (displayAmount === 0) {
        const res = await fetch("/api/online-report/free-submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId, couponCode: couponApplied?.code, formData }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          setError(data.error || "Failed to submit — please try again.")
          setSubmitting(false)
          return
        }
        router.push(`/report/${reportId}`)
        return
      }

      const result = await startOnlineReportCheckout({
        amountType: "report",
        reportId,
        couponCode: couponApplied?.code,
        patientName: fullName.trim(),
        patientPhone: phone.trim(),
        formData,
      })

      if (!result.success) {
        setError(result.error)
        setSubmitting(false)
        return
      }

      router.push(`/report/${reportId}`)
      return
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 100px" }}>
        {step !== 0 && <FormStepTracker current={step} />}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: 12, fontSize: 13, margin: "20px 0 0" }}>
            {error}
          </div>
        )}

        {/* ── STEP 0 — What's Included ── */}
        {step === 0 && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "20px 0 4px" }}>Your Online Smile Report</h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>Here's what you get, free.</p>

            <Section title="Your Online Smile Report Includes:">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { title: "Treatment Objective", desc: "a clear picture of what your treatment aims to achieve" },
                  { title: "Treatment Planning with Reasoning", desc: "our expert's provisional plan, along with the thinking behind it" },
                  { title: "3D Simulated Plan (for educational purposes only)", desc: "a visual preview of how your smile transformation may look" },
                  { title: "1-on-1 Video Consultation with a Smile Expert", desc: "get your questions answered directly, face to face" },
                ].map((item) => (
                  <div key={item.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, color: GOLD, fontWeight: 800, fontSize: 14, lineHeight: "20px" }}>✓</span>
                    <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700, color: NAVY }}>{item.title}</span> — {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            <button
              onClick={() => {
                setStep(1)
                window.scrollTo({ top: 0, behavior: "smooth" })
              }}
              style={primaryBtn}
            >
              Proceed
            </button>
          </>
        )}

        {/* ── STEP 1 — Basic Info ── */}
        {step === 1 && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "20px 0 4px" }}>Your Information</h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>Step 1 of 4 — a few basic details to get started.</p>

            <Section>
              <Input label="Full Name" value={fullName} onChange={setFullName} />
              <Input label="Phone Number" value={phone} onChange={(v) => { setPhone(v); setExistingMemberReportId(null) }} onBlur={checkForDraft} type="tel" />
              {checkingDraft && <p style={{ margin: "-6px 0 10px", fontSize: 11, color: "#9ca3af" }}>Checking for a previous submission…</p>}
              <div style={{ marginBottom: 10 }}>
                <select value={sex} onChange={(e) => setSex(e.target.value)} style={{ ...inputStyle, color: sex ? "#111827" : "#9ca3af" }}>
                  <option value="" disabled>Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <Input label="Age" value={age} onChange={setAge} type="number" />
            </Section>

            {resumedDraft && (
              <div style={{ background: "#EAF7F5", border: "1px solid #9FD8D1", color: "#12706A", borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16 }}>
                Welcome back! We've restored your previous progress — pick up where you left off.
              </div>
            )}

            <button onClick={goToStep2} disabled={savingLead} style={{ ...primaryBtn, opacity: savingLead ? 0.7 : 1, cursor: savingLead ? "wait" : "pointer" }}>
              {savingLead ? "Saving…" : "Continue"}
            </button>

            {existingMemberReportId && (
              <div style={{ background: "#EAF7F5", border: "1px solid #A9DCD5", color: "#0F5F58", borderRadius: 10, padding: 14, fontSize: 13, marginTop: 14, textAlign: "center" }}>
                <p style={{ margin: "0 0 10px", fontWeight: 700 }}>Already a member. Login instead.</p>
                <button
                  onClick={() => router.push(`/report/${existingMemberReportId}`)}
                  style={{ background: NAVY, color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  Go to Your Report
                </button>
              </div>
            )}
          </>
        )}

        {/* ── STEP 2 — Conditions + Dental Self-Assessment ── */}
        {step === 2 && (
          <>
            <BackLink onClick={() => backTo(1)} />
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "10px 0 4px" }}>Medical & Dental Assessment</h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>Step 2 of 4 — everything here is optional; leave anything blank that doesn't apply.</p>

            <Section title="Chief Complaint">
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: NAVY }}>
                Write your concern or problem in your own words, in your preferred language.
              </p>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                style={{ ...inputStyle, minHeight: 70 }}
              />
            </Section>

            <Section title="Dental Self-Assessment">
              <ToothLocationPicker label="1. Cavity" selected={cavityLocations} onChange={setCavityLocationsChecked} disabled={dentalNone} />
              <ToothLocationPicker label="2. Food Lodgement" selected={foodLodgementLocations} onChange={setFoodLodgementLocationsChecked} disabled={dentalNone} />
              <ToothLocationPicker label="3. Tooth Mobility (shakiness when pressed with finger)" selected={toothMobilityLocations} onChange={setToothMobilityLocationsChecked} disabled={dentalNone} />
              <ToothLocationPicker label="4. Pain" selected={painLocations} onChange={setPainLocationsChecked} disabled={dentalNone} />
              <div style={{ opacity: dentalNone ? 0.5 : 1, marginBottom: 16 }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: NAVY }}>Any other concerns, in your own words</p>
                <textarea
                  value={otherConcerns}
                  disabled={dentalNone}
                  onChange={(e) => setOtherConcernsChecked(e.target.value)}
                  style={{ ...inputStyle, minHeight: 60 }}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: NAVY, cursor: "pointer" }}>
                <input type="checkbox" checked={dentalNone} onChange={toggleDentalNone} />
                None — no cavities, food lodgement, mobility, pain or other concerns
              </label>
            </Section>

            <Section title="Existing Conditions">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: NAVY, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!conditions.none} onChange={() => toggleCondition("none")} />
                  None
                </label>
                {CONDITION_FIELDS.map((c) => (
                  <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: NAVY, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={!!conditions[c.key]}
                      disabled={!!conditions.none}
                      onChange={() => toggleCondition(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: NAVY, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={conditionOtherChecked}
                    disabled={!!conditions.none}
                    onChange={(e) => {
                      setConditionOtherChecked(e.target.checked)
                      if (e.target.checked) setConditions((cs) => ({ ...cs, none: false }))
                    }}
                  />
                  Other
                </label>
              </div>
              {conditionOtherChecked && (
                <input
                  placeholder="Please specify"
                  value={conditionOtherText}
                  onChange={(e) => setConditionOtherText(e.target.value)}
                  style={{ ...inputStyle, marginTop: 10 }}
                />
              )}
            </Section>

            <button onClick={goToStep3} disabled={savingStep2} style={{ ...primaryBtn, opacity: savingStep2 ? 0.7 : 1, cursor: savingStep2 ? "wait" : "pointer" }}>
              {savingStep2 ? "Saving…" : "Continue"}
            </button>
          </>
        )}

        {/* ── STEP 3 — Upload Photos ── */}
        {step === 3 && (
          <>
            <BackLink onClick={() => backTo(2)} />
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "10px 0 4px" }}>Upload Your Photos</h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>Step 3 of 4 — 5 clear photos, one at a time.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {PHOTO_SLOTS.map((slot) => {
                const file = photos[slot.key]
                const uploadedUrl = photoUrls[slot.key]
                const isUploading = photoUploading[slot.key]
                const uploadError = photoUploadError[slot.key]
                const borderColor = uploadError ? "#f87171" : uploadedUrl ? "#3FB3A4" : isUploading ? GOLD : "#e5e7eb"
                return (
                  <div key={slot.key} style={{ background: "white", border: `2px solid ${borderColor}`, borderRadius: 16, padding: 16 }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <div>
                        <ReferenceImage photoKey={slot.key} />
                        {file ? <UploadedPreview file={file} /> : uploadedUrl ? <RemotePreview url={uploadedUrl} /> : null}
                        {uploadedUrl && !isUploading && !uploadError && (
                          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                            <label style={{ fontSize: 12, color: GOLD, fontWeight: 700, cursor: "pointer" }}>
                              Replace
                              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handlePhoto(slot.key, e.target.files?.[0] || null)} />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleCancelPhoto(slot.key)}
                              style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, cursor: "pointer", background: "none", border: "none", padding: 0 }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: NAVY }}>{slot.label}</p>
                        <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{slot.hint}</p>
                      </div>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      {isUploading ? (
                        <p style={{ margin: 0, fontSize: 12, color: GOLD, fontWeight: 700 }}>Uploading…</p>
                      ) : uploadError ? (
                        <div>
                          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#dc2626" }}>{uploadError}</p>
                          <label style={{ display: "inline-block", fontSize: 13, color: "white", fontWeight: 700, cursor: "pointer", background: GOLD, padding: "10px 18px", borderRadius: 8 }}>
                            Retry Upload
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handlePhoto(slot.key, e.target.files?.[0] || null)} />
                          </label>
                        </div>
                      ) : uploadedUrl ? (
                        <p style={{ margin: 0, fontSize: 12, color: "#168F83" }}>✓ Uploaded</p>
                      ) : (
                        <label style={{ display: "inline-block", fontSize: 13, color: "white", fontWeight: 700, cursor: "pointer", background: GOLD, padding: "10px 18px", borderRadius: 8 }}>
                          Upload Photo
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handlePhoto(slot.key, e.target.files?.[0] || null)} />
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button onClick={goToStep4} disabled={anyPhotoUploading} style={{ ...primaryBtn, opacity: anyPhotoUploading ? 0.7 : 1, cursor: anyPhotoUploading ? "wait" : "pointer" }}>
              {anyPhotoUploading ? "Uploading…" : "Continue"}
            </button>
          </>
        )}

        {/* ── STEP 4 — Consent, Coupon, Payment ── */}
        {step === 4 && (
          <>
            <BackLink onClick={() => backTo(3)} disabled={submitting} />
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "10px 0 4px" }}>Review & Pay</h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>
              Step 4 of 4 — <span style={{ textDecoration: "line-through", color: "#9ca3af" }}>₹999</span> FREE
            </p>

            <Section title="Please Read & Accept">
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, fontSize: 12, color: "#4b5563", lineHeight: 1.7 }}>
                <p style={{ margin: "0 0 8px" }}>
                  We implement industry-standard security safeguards to protect your data in accordance with the DPDP
                  Act, 2023.
                </p>
                <p style={{ margin: 0 }}>Your report is free — there is nothing to pay.</p>
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, marginTop: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
                I understand that this is a provisional report, generated based on the photographs and information
                provided by me to the best of my knowledge, and that the final diagnosis may differ from this after a
                thorough in-person checkup by a registered smile expert.
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
              {couponApplied && <p style={{ color: "#168F83", fontSize: 12, marginTop: 6 }}>Coupon "{couponApplied.code}" applied — ₹{couponApplied.discountedAmount} payable.</p>}
            </Section>

            <button onClick={handleSubmit} disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.7 : 1, cursor: submitting ? "wait" : "pointer" }}>
              {submitting ? "Processing…" : displayAmount === 0 ? "Submit — Free" : `Pay ₹${displayAmount} & Submit`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: 20, marginBottom: 16, border: "1px solid #e5e7eb" }}>
      {title && <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h3>}
      {children}
    </div>
  )
}

function BackLink({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: NAVY,
        border: "none",
        borderRadius: 8,
        padding: "8px 16px",
        margin: "20px 0 0",
        fontSize: 13,
        fontWeight: 700,
        color: "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      ← Back
    </button>
  )
}

function Input({ label, value, onChange, type = "text", onBlur }: { label: string; value: string; onChange: (v: string) => void; type?: string; onBlur?: () => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <input placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} type={type} style={inputStyle} />
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

const primaryBtn: React.CSSProperties = {
  width: "100%",
  background: GOLD,
  color: "white",
  border: "none",
  borderRadius: 12,
  padding: "16px",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
}

