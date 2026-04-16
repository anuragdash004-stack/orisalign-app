"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function BookPage() {
  const [step, setStep] = useState(1)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")

  const [age, setAge] = useState("")
  const [sex, setSex] = useState("")
  const [address, setAddress] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [showSlots, setShowSlots] = useState(false)

  const [loading, setLoading] = useState(false)

  // OTP DEMO
  const sendOTP = () => {
    if (!name || !phone) return alert("Enter details")
    alert("OTP sent (1234)")
    setStep(2)
  }

  const verifyOTP = () => {
    if (otp === "1234") setStep(3)
    else alert("Invalid OTP")
  }

  const handleBooking = async () => {
    if (!date || !time) return alert("Select slot")

    setLoading(true)

    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        age,
        sex,
        address,
        date,
        time,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (data.success) {
      alert("Appointment booked. We will call you shortly.")
      window.location.href = "https://www.orisalign.com"
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundColor: "#faf7f2",
        backgroundImage: "url('/pattern-icon.png')",
        backgroundSize: "110px 110px",
      }}
    >
      <style>{styles}</style>

      <AnimatePresence mode="wait">

        {/* STEP 1 */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -30 }}
            className="card"
          >
            <Logo />

            <h2 className="title">Enter Details</h2>

            <Input placeholder="Full Name" value={name} set={setName} />
            <Input placeholder="Phone Number" value={phone} set={setPhone} />

            <button className="btn center-btn" onClick={sendOTP}>
              SEND OTP
            </button>
          </motion.div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="card"
          >
            <Logo />

            <h2 className="title">Verify OTP</h2>

            <Input placeholder="Enter OTP" value={otp} set={setOtp} />

            <button className="btn mt-6" onClick={verifyOTP}>
              VERIFY OTP
            </button>
          </motion.div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card"
          >
            <Logo />

            <h2 className="title">Book Appointment</h2>

            <p className="subtitle">
              {name} • {phone}
            </p>

            <Input placeholder="AGE" value={age} set={setAge} />

            <select
              className="input mt-4"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
            >
              <option value="">GENDER</option>
              <option>MALE</option>
              <option>FEMALE</option>
              <option>TRANSGENDER</option>
            </select>

            <textarea
              className="input mt-4 h-24"
              placeholder="ADDRESS"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            <input
              type="date"
              className="input mt-4"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <button
              onClick={() => setShowSlots(!showSlots)}
              className="input mt-4 text-left"
            >
              {time ? `SELECTED: ${time}` : "TIME SLOT"}
            </button>

            <AnimatePresence>
              {showSlots && (
                <motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.25 }}
  className="grid grid-cols-2 gap-3 mt-4"
>
                  {["9 AM", "11 AM", "4 PM", "6 PM"].map((t) => (
                    <motion.button
                      key={t}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => {
                        setTime(t)
                        setShowSlots(false)
                      }}
                      className={`slot ${
                        time === t ? "slot-active" : ""
                      }`}
                    >
                      {t}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <button className="btn mt-6" onClick={handleBooking}>
              {loading ? "Booking..." : "CONFIRM BOOKING"}
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}

/* COMPONENTS */

function Logo() {
  return (
    <div className="flex justify-center mb-1">
      <img src="/logo.png" className="w-[180px]" />
    </div>
  )
}

function Input({ placeholder, value, set }: any) {
  return (
    <input
      style={{ backgroundColor: "white", color: "black" }}
      className="input mt-3"
      placeholder={placeholder}
      value={value}
      onChange={(e) => set(e.target.value)}
    />
  )
}

/* STYLES */

const styles = `
.card {
  background: white;
  padding: 40px;
  border-radius: 24px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 30px 80px rgba(180,140,80,0.15);
}

.title {
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 2px;
}

.subtitle {
  text-align: center;
  color: #777;
  margin-bottom: 20px;
}

.input {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #ddd;
  background: white;
  color: black;
  outline: none;
  transition: 0.3s;
}

.input:focus {
  border-color: #b8905a;
  box-shadow: 0 0 0 2px rgba(184,144,90,0.2);
}

/* 🔥 AUTOFILL FIX */
input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px white inset !important;
  -webkit-text-fill-color: black !important;
}

.btn {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  font-weight: 600;
  color: white;
  background: #b8905a;
  transition: 0.3s;
}

.btn:hover {
  opacity: 0.9;
}

.center-btn {
  display: block;
  width: 60%;
  margin: 20px auto 0;
}

.slot {
  padding: 12px;
  border-radius: 12px;
  background: white;
  border: 1px solid #d1d5db;
  color: black;
  font-weight: 500;
  transition: all 0.2s ease;
}

.slot:hover {
  border-color: #b8905a;
  background: #f9f5ef;
}

.slot-active {
  background: #b8905a;
  color: white;
  border: 1px solid #b8905a;
}

.slot-active {
  background: #b8905a;
  color: white;
}
`