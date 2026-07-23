"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { getSupabaseClient } from "@/lib/supabaseClient"

const supabase = getSupabaseClient()

export default function BookPage() {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")

  const [agreeComm, setAgreeComm] = useState(true)
  const [acceptTerms, setAcceptTerms] = useState(true)

  const [loading, setLoading] = useState(false)

  const bookScan = async () => {
    if (!name || !phone) {
      alert("Please enter your name and phone number.")
      return
    }
    if (!acceptTerms) {
      alert("Please accept the terms and conditions and privacy policy.")
      return
    }
    if (!agreeComm) {
      alert("Please agree to receive communications from OrisAlign.")
      return
    }

    setLoading(true)
    try {
      // Save the lead straight away — no email, no OTP verification.
      const res = await fetch("/api/save-booking-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Failed to save booking")
      }

      const { leadId } = await res.json()
      window.location.href = `/patient/${leadId}`
    } catch (err: any) {
      alert(`Error: ${err.message || "Failed to book scan"}`)
      setLoading(false)
    }
  }

  return (
    <div
      className="pattern-bg min-h-screen flex items-center justify-center px-4 py-10"
      style={{ backgroundColor: "#faf7f2" }}
    >
      <style>{styles}</style>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card">
        <Logo />
        <h2 className="title">Book Your Smile Assessment</h2>
        <Input placeholder="Full Name" value={name} set={setName} />
        <Input placeholder="Phone Number" value={phone} set={setPhone} type="tel" />

        <div style={{ marginTop: "16px", padding: "12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#111827" }}>
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              style={{ marginTop: "2px", cursor: "pointer", width: "18px", height: "18px", flexShrink: 0 }}
            />
            <span>
              I accept the <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#b8905a", textDecoration: "none", fontWeight: "600" }}>terms and conditions</a> and <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#b8905a", textDecoration: "none", fontWeight: "600" }}>privacy policy</a>
            </span>
          </label>
        </div>

        <div style={{ marginTop: "12px", padding: "12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#111827" }}>
            <input
              type="checkbox"
              checked={agreeComm}
              onChange={(e) => setAgreeComm(e.target.checked)}
              style={{ marginTop: "2px", cursor: "pointer", width: "18px", height: "18px", flexShrink: 0 }}
            />
            <span>
              I agree to receive all forms of communication from OrisAlign regarding my appointment and treatment.
            </span>
          </label>
        </div>

        <button
          className="btn center-btn"
          onClick={bookScan}
          disabled={loading || !acceptTerms || !agreeComm}
          style={{ marginTop: "20px", opacity: !acceptTerms || !agreeComm ? 0.5 : 1, cursor: !acceptTerms || !agreeComm ? "not-allowed" : "pointer" }}
        >
          {loading ? "Booking..." : "BOOK YOUR SCAN"}
        </button>
      </motion.div>
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
.center-btn {
  display: block;
  width: 60%;
  margin: 20px auto 0;
}
.mt-3 { margin-top: 12px; }
`
