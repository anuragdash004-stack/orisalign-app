"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getSupabaseClient } from "@/lib/supabaseClient"

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

export default function BookPage() {
  const [step, setStep] = useState(1)

  // Step 1
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [otpToken, setOtpToken] = useState("")
  const [otp, setOtp] = useState("")

  // Step 3 — Personal + Address
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

  // Step 4 — Complaint + Slot
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [consultationType, setConsultationType] = useState("")
  const [explainConcern, setExplainConcern] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [showSlots, setShowSlots] = useState(false)

  const [agreeComm, setAgreeComm] = useState(true)
  const [agreeTnc, setAgreeTnc] = useState(true)
  const [tncError, setTncError] = useState(false)

  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [bookedInfo, setBookedInfo] = useState({ date: "", time: "", patientId: "" })

  const sendOTP = async () => {
    if (!name || !phone || !email) {
      alert("Please enter your name, phone number, and email.")
      return
    }
    setLoading(true)
    const res = await fetch("/api/send-booking-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    })
    setLoading(false)
    if (!res.ok) { alert("Failed to send OTP. Please try again."); return }
    const { token } = await res.json()
    setOtpToken(token)
    setStep(2)
  }

  const verifyOTP = async () => {
    if (!otp) return alert("Please enter the OTP.")
    setLoading(true)
    const res = await fetch("/api/verify-booking-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, token: otpToken }),
    })
    setLoading(false)
    if (!res.ok) { alert("Invalid OTP. Please try again."); return }
    setStep(3)
  }

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
      } catch { /* ignore */ }
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

  const proceedToStep4 = () => {
    if (!age || !sex || !fullAddress || !pincode) {
      alert("Please fill in age, gender, full address and pincode.")
      return
    }
    setStep(4)
  }

  const handleBooking = async () => {
    if (!agreeTnc) {
      setTncError(true)
      return
    }
    setTncError(false)
    if (!chiefComplaint || !date || !time || !consultationType) {
      alert("Please select your concern, date, time slot and consultation type.")
      return
    }
    setLoading(true)
    const locationLink = mapsLink || mapsLinkManual
    const address = [fullAddress, city && `${city}, ${district}, ${areaState}`, `PIN: ${pincode}`, locationLink ? `Maps: ${locationLink}` : ""].filter(Boolean).join(" | ")
    const problem = chiefComplaint === "Others" ? `Others — ${explainConcern}` : chiefComplaint + (explainConcern ? ` — ${explainConcern}` : "")

    const { data: inserted, error } = await supabase!
      .from("appointments_booking")
      .insert([{ name, phone, email, age, sex, address, problem: `[${consultationType.toUpperCase()}] ${problem}`, date, time, status: "pending" }])
      .select("id")
      .single()

    setLoading(false)
    if (error) { alert(`Booking failed: ${error.message}`); return }

    // Fire notification email (non-blocking)
    fetch("/api/notify-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, phone, email, age, sex, address, problem, date, time,
        consultationType,
        patientId: inserted?.id || "",
      }),
    }).catch(() => {})

    setBookedInfo({ date, time, patientId: inserted?.id || "" })
    setShowConfirmation(true)
  }

  return (
    <div
      className="pattern-bg min-h-screen flex items-center justify-center px-4 py-10"
      style={{ backgroundColor: "#faf7f2" }}
    >
      <style>{styles}</style>

      {showConfirmation && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            style={{ background: "white", borderRadius: "24px", padding: "36px", maxWidth: "400px", width: "100%", textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.2)" }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#111" }}>Booking Confirmed!</h2>
            <p style={{ color: "#555", fontSize: "15px", lineHeight: "1.6", marginBottom: "8px" }}>Your appointment is confirmed for</p>
            <p style={{ fontWeight: "700", fontSize: "16px", color: "#b8905a", marginBottom: "8px" }}>{bookedInfo.date} at {bookedInfo.time}</p>
            {bookedInfo.patientId && (
              <div style={{ background: "#f8f7f5", borderRadius: "10px", padding: "10px 16px", marginBottom: "12px" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af", fontWeight: "700", letterSpacing: "0.6px" }}>YOUR PATIENT ID</p>
                <p style={{ margin: "2px 0 0", fontSize: "20px", fontWeight: "800", color: "#111", letterSpacing: "3px" }}>{bookedInfo.patientId.substring(0, 8).toUpperCase()}</p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9ca3af" }}>Save this to track your journey</p>
              </div>
            )}
            <p style={{ color: "#555", fontSize: "14px", lineHeight: "1.6", marginBottom: "28px" }}>You will soon be contacted by our representative. Thank you for visiting OrisAlign!</p>
            <button className="btn" onClick={() => { window.location.href = `/patient/${bookedInfo.patientId}` }}>OK</button>
          </motion.div>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* STEP 1 — Contact Info */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -30 }} className="card">
            <Logo />
            <h2 className="title">Enter Details</h2>
            <Input placeholder="Full Name" value={name} set={setName} />
            <Input placeholder="Phone Number" value={phone} set={setPhone} type="tel" />
            <Input placeholder="Email Address" value={email} set={setEmail} type="email" />
            <button className="btn center-btn" onClick={sendOTP} disabled={loading}>
              {loading ? "Sending OTP..." : "SEND OTP"}
            </button>
          </motion.div>
        )}

        {/* STEP 2 — OTP */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="card">
            <Logo />
            <h2 className="title">Verify OTP</h2>
            <p className="subtitle-small">OTP sent to {email}</p>
            <Input placeholder="Enter OTP" value={otp} set={setOtp} />
            <button className="btn mt-6" onClick={verifyOTP} disabled={loading}>
              {loading ? "Verifying..." : "VERIFY OTP"}
            </button>
          </motion.div>
        )}

        {/* STEP 3 — Personal Info + Address */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card">
            <Logo />
            <div className="step-indicator">Step 1 of 2</div>
            <h2 className="title">Personal & Address Details</h2>
            <div className="patient-info">
              <p className="patient-name">{name}</p>
              <p className="patient-phone">{phone}</p>
            </div>

            <Input placeholder="Age" value={age} set={setAge} type="number" />

            <select className="input mt-4" value={sex} onChange={(e) => setSex(e.target.value)} style={{ color: sex ? "#111" : "#9ca3af" }}>
              <option value="" disabled>Gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="TRANSGENDER">Transgender</option>
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

            <button className="btn mt-6" onClick={proceedToStep4}>
              Confirm & Proceed →
            </button>
          </motion.div>
        )}

        {/* STEP 4 — Complaint + Date/Time */}
        {step === 4 && (
          <motion.div key="step4" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card">
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
              onChange={(e) => setDate(e.target.value)}
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
                  {["9 AM", "11 AM", "4 PM", "6 PM"].map((t) => (
                    <motion.button key={t} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}
                      onClick={() => { setTime(t); setShowSlots(false) }}
                      className={`slot ${time === t ? "slot-active" : ""}`}
                    >
                      {t}
                    </motion.button>
                  ))}
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
              <option value="clinic">🏥 Clinic Consultation — Visit our clinic in Bhubaneswar</option>
              <option value="online">💻 Online Consultation — Video call with our expert</option>
            </select>

            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", fontSize: "13px", color: "#374151" }}>
                <input type="checkbox" checked={agreeComm} onChange={e => setAgreeComm(e.target.checked)}
                  style={{ marginTop: "2px", accentColor: "#b8905a", flexShrink: 0, width: "16px", height: "16px" }} />
                I agree to receive all forms of communication from OrisAlign regarding my appointment and treatment.
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", fontSize: "13px", color: "#374151" }}>
                <input type="checkbox" checked={agreeTnc} onChange={e => { setAgreeTnc(e.target.checked); setTncError(false) }}
                  style={{ marginTop: "2px", accentColor: "#b8905a", flexShrink: 0, width: "16px", height: "16px" }} />
                I agree to the <a href="/terms" style={{ color: "#b8905a", fontWeight: "600", textDecoration: "underline" }}>terms and conditions and privacy policy</a>.
              </label>
              {tncError && (
                <p style={{ color: "#dc2626", fontSize: "13px", margin: 0, fontWeight: "600" }}>
                  ⚠️ Please agree to T&amp;C to confirm your booking.
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button className="btn-back" onClick={() => setStep(3)}>← Back</button>
              <button className="btn flex-1" onClick={handleBooking} disabled={loading}>
                {loading ? "Booking..." : "CONFIRM BOOKING"}
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
  text-align: center;
  margin-bottom: 20px;
}
.patient-name {
  font-size: 18px;
  font-weight: 700;
  color: #111;
  margin: 0 0 4px;
  text-transform: capitalize;
}
.patient-phone {
  font-size: 16px;
  font-weight: 600;
  color: #555;
  margin: 0;
}
.subtitle-small {
  text-align: center;
  color: #777;
  font-size: 13px;
  margin-bottom: 16px;
}
.input {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #ddd;
  background: white;
  color: #111;
  outline: none;
  transition: 0.3s;
  font-size: 14px;
  display: block;
  box-sizing: border-box;
}
.input::placeholder { color: #9ca3af; opacity: 1; }
.input::-webkit-input-placeholder { color: #9ca3af; opacity: 1; }
.input:focus { border-color: #b8905a; box-shadow: 0 0 0 2px rgba(184,144,90,0.2); }
input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px white inset !important;
  -webkit-text-fill-color: #111 !important;
}
.btn {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  font-weight: 600;
  color: white;
  background: #b8905a;
  transition: 0.3s;
  cursor: pointer;
}
.btn:hover { opacity: 0.9; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-back {
  padding: 12px 20px;
  border-radius: 12px;
  font-weight: 600;
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  white-space: nowrap;
  transition: 0.2s;
}
.btn-back:hover { background: #e5e7eb; }
.center-btn {
  display: block;
  width: 60%;
  margin: 20px auto 0;
}
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.mt-6 { margin-top: 24px; }
.h-20 { height: 80px; resize: vertical; }
.flex { display: flex; }
.flex-1 { flex: 1; }
.gap-3 { gap: 12px; }
.slot {
  padding: 12px;
  border-radius: 12px;
  background: white;
  border: 1px solid #d1d5db;
  color: #111;
  font-weight: 500;
  transition: all 0.2s ease;
}
.slot:hover { border-color: #b8905a; background: #f9f5ef; }
.slot-active { background: #b8905a; color: white; border: 1px solid #b8905a; }
`
