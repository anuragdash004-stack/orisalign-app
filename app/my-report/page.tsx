"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const NAVY = "#1B2A4A"
const GOLD = "#C9A84C"

/**
 * Self-service lookup for a patient who's lost their /report/[id] link —
 * uses the same phone-number check as Step 1's "Already a member" block
 * (see /api/online-report/check-member), so it only finds a report once
 * payment has actually gone through.
 */
export default function MyReportLookupPage() {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const find = async () => {
    const trimmed = phone.trim()
    if (!trimmed) {
      setError("Please enter your phone number.")
      return
    }
    setError(null)
    setChecking(true)
    try {
      const res = await fetch(`/api/online-report/check-member?phone=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (data.isMember && data.reportId) {
        router.push(`/report/${data.reportId}`)
        return
      }
      setError("No paid Online Smile Report found for this number. If you haven't submitted one yet, you can start below.")
    } catch {
      setError("Couldn't reach the server — please check your connection and try again.")
    } finally {
      setChecking(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, width: "100%", background: "white", borderRadius: 20, padding: "36px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: "0 0 6px", textAlign: "center" }}>Find Your Smile Report</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px", textAlign: "center" }}>
          Enter the phone number you used to submit your Online Smile Report.
        </p>

        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && find()}
          placeholder="Phone Number"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, outline: "none", boxSizing: "border-box", color: "#111827", marginBottom: 12 }}
        />

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          onClick={find}
          disabled={checking}
          style={{ width: "100%", background: GOLD, color: "white", border: "none", borderRadius: 10, padding: 14, fontSize: 14, fontWeight: 800, cursor: checking ? "wait" : "pointer", opacity: checking ? 0.7 : 1 }}
        >
          {checking ? "Looking…" : "Find My Report"}
        </button>

        <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", margin: "18px 0 0" }}>
          Haven't submitted one yet?{" "}
          <a href="/smile-report/upload" style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>
            Get your Online Smile Report
          </a>
        </p>
      </div>
    </div>
  )
}
