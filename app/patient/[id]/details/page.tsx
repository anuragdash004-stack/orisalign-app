"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getSupabaseClient } from "@/lib/supabaseClient"
import { useParams, useRouter } from "next/navigation"

const supabase = getSupabaseClient()

const CHIEF_COMPLAINTS = [
  "Crowding — misalignment of teeth",
  "Spacing — gaps in between teeth",
  "Deep bite — upper teeth overlap lower teeth",
  "Underbite — upper teeth close inside lower teeth",
  "Open bite — gap between upper and lower teeth on biting",
  "General smile improvement",
  "Others",
]

export default function PatientDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  const [patient, setPatient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)

  // Step 1 — Personal Info + Address
  const [age, setAge] = useState("")
  const [sex, setSex] = useState("")
  const [fullAddress, setFullAddress] = useState("")
  const [pincode, setPincode] = useState("")
  const [city, setCity] = useState("")
  const [district, setDistrict] = useState("")
  const [areaState, setAreaState] = useState("")
  const [mapsLink, setMapsLink] = useState("")
  const [mapsLinkManual, setMapsLinkManual] = useState("")
  const [locLoading, setLocLoading] = useState(false)
  const [pincodeLoading, setPincodeLoading] = useState(false)

  // Step 2 — Complaint + Date/Time
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [consultationType, setConsultationType] = useState("")
  const [explainConcern, setExplainConcern] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [showSlots, setShowSlots] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [slotLoading, setSlotLoading] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase!
        .from("appointments_booking")
        .select("*")
        .eq("id", id)
        .single()
      if (data) {
        setPatient(data)
        setAge(data.age || "")
        setSex(data.sex || "")
        setDate(data.date || "")
        setTime(data.time || "")

        // Parse address: "fullAddress | city, district, state | PIN: xxx | Maps: link"
        const addressParts = (data.address || "").split(" | ")
        setFullAddress(addressParts[0] || "")
        const pinPart = addressParts.find((p: string) => p.startsWith("PIN: "))
        if (pinPart) setPincode(pinPart.replace("PIN: ", ""))
        const mapsPart = addressParts.find((p: string) => p.startsWith("Maps: "))
        if (mapsPart) setMapsLink(mapsPart.replace("Maps: ", ""))

        // Parse problem: "[CONSULTATIONTYPE] complaint — explanation"
        const problemMatch = (data.problem || "").match(/^\[(\w+)\]\s*(.*)$/)
        if (problemMatch) {
          setConsultationType(problemMatch[1].toLowerCase())
          const rest = problemMatch[2]
          const dashIdx = rest.indexOf(" — ")
          if (dashIdx >= 0) {
            setChiefComplaint(rest.substring(0, dashIdx))
            setExplainConcern(rest.substring(dashIdx + 3))
          } else {
            setChiefComplaint(rest)
          }
        }
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handlePincode = async (val: string) => {
    setPincode(val)
    if (val.length === 6 && /^\d{6}$/.test(val)) {
      setPincodeLoading(true)
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${val}`)
        const json = await res.json()
        if (json[0]?.Status === "Success" && json[0]?.PostOffice?.length > 0) {
          const po = json[0].PostOffice[0]
          setCity(po.Block || po.Name || "")
          setDistrict(po.District || "")
          setAreaState(po.State || "")
        }
      } catch { }
      setPincodeLoading(false)
    } else if (val.length < 6) {
      setCity(""); setDistrict(""); setAreaState("")
    }
  }

  const detectLocation = () => {
    if (!navigator.geolocation) { alert("Geolocation is not supported by your browser."); return }
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setMapsLink(`https://maps.google.com/?q=${latitude},${longitude}`)
        setLocLoading(false)
      },
      () => { alert("Unable to retrieve location. Please allow location access."); setLocLoading(false) }
    )
  }

  const proceedToStep2 = () => {
    if (!age || !sex || !fullAddress || !pincode) {
      alert("Please fill in age, gender, full address and pincode.")
      return
    }
    setStep(2)
  }

  const fetchBookedSlots = async (selectedDate: string) => {
    if (!selectedDate) return
    setSlotLoading(true)
    try {
      const { data, error } = await supabase!
        .from("appointments_booking")
        .select("time")
        .eq("date", selectedDate)
        .neq("status", "lead")
      if (!error) {
        const slots = data?.map(d => d.time) || []
        setBookedSlots(slots)
      }
    } catch (err) {
      console.error("Error fetching booked slots:", err)
    }
    setSlotLoading(false)
  }

  const handleDateChange = (selectedDate: string) => {
    setDate(selectedDate)
    setTime("")
    fetchBookedSlots(selectedDate)
  }

  const handleSubmit = async () => {
    if (!chiefComplaint || !date || !time || !consultationType) {
      alert("Please select your concern, date, time slot and consultation type.")
      return
    }

    setSubmitting(true)
    try {
      const locationLink = mapsLink || mapsLinkManual
      const address = [fullAddress, city && `${city}, ${district}, ${areaState}`, `PIN: ${pincode}`, locationLink ? `Maps: ${locationLink}` : ""].filter(Boolean).join(" | ")
      const problem = chiefComplaint === "Others" ? `Others — ${explainConcern}` : chiefComplaint + (explainConcern ? ` — ${explainConcern}` : "")

      const alreadyConfirmed = patient?.booking_confirmed

      const { error } = await supabase!
        .from("appointments_booking")
        .update({
          age, sex, address, date, time,
          problem: `[${consultationType.toUpperCase()}] ${problem}`,
          booking_confirmed: true,
        })
        .eq("id", id)

      if (error) throw error

      // First time confirming → issue the Patient ID via the welcome email.
      if (!alreadyConfirmed && patient?.email) {
        fetch("/api/send-welcome-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: patient.email, name: patient.name || "Patient", patientId: id }),
        }).catch(() => {})
      }

      router.push(`/patient/${id}`)
    } catch (err: any) {
      console.error("Full error:", err)
      alert(`Failed to save details: ${err.message || err}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <p style={{ color: "#6b7280" }}>Loading...</p>
    </div>
  )

  if (!patient) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: "12px" }}>
      <p style={{ color: "#dc2626", fontWeight: "600" }}>Patient not found</p>
    </div>
  )

  return (
    <div className="pattern-bg min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: "#faf7f2" }}>
      <style>{styles}</style>

      <AnimatePresence mode="wait">

        {/* STEP 1 — Personal Info + Address */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card">
            <Logo />
            <div className="step-indicator">Step 1 of 2</div>
            <h2 className="title">Personal & Address Details</h2>
            <div className="patient-info">
              <p className="patient-name">{patient.name}</p>
              <p className="patient-phone">{patient.phone}</p>
            </div>

            <Input placeholder="Age" value={age} set={setAge} type="number" />

            <select className="input mt-4" value={sex} onChange={(e) => setSex(e.target.value)} style={{ color: sex ? "#111" : "#9ca3af" }}>
              <option value="" disabled>Gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHERS">Others</option>
            </select>

            <div className="section-label">Address</div>

            <textarea
              className="input h-20"
              placeholder="Full Address"
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
              style={{ color: "#111" }}
            />

            <input
              type="text"
              className="input mt-3"
              placeholder="Pincode (e.g. 751001)"
              value={pincode}
              onChange={(e) => handlePincode(e.target.value)}
              maxLength={6}
              style={{ color: "#111" }}
            />

            {pincodeLoading && <p style={{ fontSize: "12px", color: "#b8905a", margin: "6px 0 0" }}>Fetching area details...</p>}

            {(city || district || areaState) && (
              <div style={{ marginTop: "8px", padding: "10px 12px", borderRadius: "10px", background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "13px", color: "#15803d" }}>
                📍 {[city, district, areaState].filter(Boolean).join(", ")}
              </div>
            )}

            <button className="btn mt-6" onClick={proceedToStep2}>
              Save
            </button>
          </motion.div>
        )}

        {/* STEP 2 — Complaint + Date/Time */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card">
            <Logo />
            <div className="step-indicator">Step 2 of 2</div>
            <h2 className="title">Concern & Appointment</h2>

            <div className="section-label">Chief Complaint</div>

            <select
              className="input"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              style={{ color: chiefComplaint ? "#111" : "#9ca3af" }}
            >
              <option value="" disabled>Select your concern</option>
              {CHIEF_COMPLAINTS.map((c) => (
                <option key={c} value={c} style={{ color: "#111" }}>{c}</option>
              ))}
            </select>

            <textarea
              className="input mt-3 h-20"
              placeholder="Explain your concern (optional)"
              value={explainConcern}
              onChange={(e) => setExplainConcern(e.target.value)}
              style={{ color: "#111" }}
            />

            <div className="section-label">Preferred Appointment</div>

            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              style={{ color: date ? "#111" : "#9ca3af" }}
            />

            <button
              onClick={() => setShowSlots(!showSlots)}
              className="input mt-3 text-left"
              style={{ color: time ? "#111" : "#9ca3af" }}
            >
              {time ? `Selected: ${time}` : "Select Time Slot"}
            </button>

            <AnimatePresence>
              {showSlots && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} className="grid grid-cols-2 gap-3 mt-3">
                  {["9 AM", "11 AM", "3:30 PM", "5:30 PM"].map((t) => {
                    const isBooked = bookedSlots.includes(t)
                    return (
                      <motion.button key={t} whileTap={{ scale: 0.95 }} whileHover={{ scale: isBooked ? 1 : 1.05 }}
                        onClick={() => { if (!isBooked) { setTime(t); setShowSlots(false) } }}
                        disabled={isBooked}
                        className={`slot ${time === t ? "slot-active" : ""} ${isBooked ? "slot-disabled" : ""}`}
                        title={isBooked ? "This slot is already booked" : ""}
                      >
                        {t}
                      </motion.button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="section-label">Consultation Type</div>
            <select
              className="input"
              value={consultationType}
              onChange={(e) => setConsultationType(e.target.value)}
              style={{ color: consultationType ? "#111" : "#9ca3af" }}
            >
              <option value="" disabled>Choose consultation type</option>
              <option value="home">🏠 Home Consultation — Dentist visits your home</option>
              <option value="clinic">🏥 Clinic Consultation — Visit our clinic in Bhubaneswar (address will be shared in mail)</option>
              <option value="online">💻 Online Consultation — Video call with our expert</option>
            </select>

            {consultationType === "home" && (
              <>
                <div className="section-label">Location Details</div>

                <button
                  type="button"
                  onClick={detectLocation}
                  className="input mt-3 text-left"
                  style={{ color: mapsLink ? "#16a34a" : "#9ca3af", cursor: "pointer" }}
                >
                  {locLoading ? "📍 Detecting location..." : mapsLink ? "✅ GPS location detected (tap to refresh)" : "📍 Tap to detect your GPS location (optional)"}
                </button>

                <input
                  type="url"
                  className="input mt-3"
                  placeholder="🗺️ Or paste Google Maps link here (optional)"
                  value={mapsLinkManual}
                  onChange={(e) => setMapsLinkManual(e.target.value)}
                  style={{ color: "#111" }}
                />
              </>
            )}

            <div className="flex gap-3 mt-6">
              <button className="btn-back" onClick={() => setStep(1)}>← Back</button>
              <button className="btn flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Confirming..." : "Confirm Booking"}
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex justify-center mb-4">
      <img src="/logo.png" className="w-[270px]" />
    </div>
  )
}

function Input({ placeholder, value, set, type = "text" }: any) {
  return (
    <input
      type={type}
      className="input mt-3"
      placeholder={placeholder}
      value={value}
      onChange={(e) => set(e.target.value)}
      style={{ color: "#111" }}
    />
  )
}

const styles = `
.card {
  background: white;
  padding: 40px;
  border-radius: 24px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 30px 80px rgba(180,140,80,0.15);
}
.title {
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #111;
}
.step-indicator {
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: #b8905a;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.section-label {
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 20px;
  margin-bottom: 8px;
}
.patient-info {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 12px;
  border-radius: 10px;
  margin-top: 16px;
  margin-bottom: 16px;
}
.patient-name {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #15803d;
}
.patient-phone {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
  background: white;
  transition: border-color 0.2s;
}
.input:focus {
  outline: none;
  border-color: #b8905a;
  box-shadow: 0 0 0 3px rgba(184, 144, 90, 0.1);
}
.input.mt-3 { margin-top: 12px; }
.input.mt-4 { margin-top: 16px; }
.h-20 { min-height: 80px; resize: vertical; }
.btn {
  width: 100%;
  padding: 14px 16px;
  background: #b8905a;
  color: white;
  font-weight: 700;
  font-size: 14px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn:hover:not(:disabled) { background: #a0754d; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn.mt-6 { margin-top: 24px; }
.btn-back {
  padding: 14px 16px;
  background: white;
  color: #111;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-back:hover { border-color: #b8905a; background: #f9fafb; }
.flex { display: flex; }
.flex-1 { flex: 1; }
.gap-3 { gap: 12px; }
.mt-4 { margin-top: 16px; }
.slot {
  padding: 12px 14px;
  background: #f0fdf4;
  border: 2px solid #bbf7d0;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: #15803d;
}
.slot:hover:not(.slot-disabled) {
  border-color: #16a34a;
  background: #dcfce7;
}
.slot-active {
  background: #16a34a;
  color: white;
  border-color: #16a34a;
}
.slot-disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: #e5e7eb;
  border-color: #d1d5db;
  color: #9ca3af;
}
.grid {
  display: grid;
}
.grid-cols-2 {
  grid-template-columns: 1fr 1fr;
}
.gap-3 {
  gap: 12px;
}
.mt-3 {
  margin-top: 12px;
}
.text-left {
  text-align: left;
}
`
