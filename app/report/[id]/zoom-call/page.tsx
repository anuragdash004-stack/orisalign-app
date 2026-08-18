"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ZOOM_TIME_SLOTS } from "@/lib/zoomSlots"

const NAVY = "#1B2A4A"
const GOLD = "#C9A84C"

export default function ZoomCallBookingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [bookedTimes, setBookedTimes] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const minDate = new Date().toISOString().slice(0, 10)

  const handleDateChange = async (val: string) => {
    setDate(val)
    setTime("")
    if (!val) return
    setLoadingSlots(true)
    try {
      const res = await fetch(`/api/online-report/zoom-slots?date=${val}`)
      const data = await res.json()
      setBookedTimes(data.bookedTimes || [])
    } finally {
      setLoadingSlots(false)
    }
  }

  const confirmBooking = async () => {
    if (!date || !time) {
      setError("Please select a date and time.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/online-report/zoom-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id, date, time }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to book slot.")
        return
      }
      setDone(true)
    } catch {
      setError("Something went wrong — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf7f2", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 440, background: "white", borderRadius: 20, padding: "36px 28px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}>
          <h1 style={{ color: NAVY, fontSize: 20, margin: "0 0 10px" }}>Video Call Booked!</h1>
          <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.7, margin: "0 0 20px" }}>
            Confirmed for {date} at {time}. We'll send you a confirmation shortly.
          </p>
          <button onClick={() => router.push(`/report/${id}`)} style={{ background: NAVY, color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px 100px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: "0 0 20px" }}>Book a Video Call with Our Smile Expert</h1>

        <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid #e5e7eb" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>Date</label>
          <input
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, boxSizing: "border-box", marginBottom: 16 }}
          />

          {date && (
            <>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>Time</label>
              {loadingSlots ? (
                <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading available times…</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {ZOOM_TIME_SLOTS.map((t) => {
                    const isBooked = bookedTimes.includes(t)
                    const isSelected = time === t
                    return (
                      <button
                        key={t}
                        disabled={isBooked}
                        onClick={() => setTime(t)}
                        style={{
                          padding: "12px",
                          borderRadius: 10,
                          border: `1.5px solid ${isSelected ? GOLD : "#e5e7eb"}`,
                          background: isBooked ? "#f3f4f6" : isSelected ? "#fff8ec" : "white",
                          color: isBooked ? "#9ca3af" : NAVY,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: isBooked ? "not-allowed" : "pointer",
                        }}
                        title={isBooked ? "This slot is already booked" : ""}
                      >
                        {t}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</p>}

          <button
            onClick={confirmBooking}
            disabled={submitting || !date || !time}
            style={{
              width: "100%",
              marginTop: 20,
              background: GOLD,
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "14px",
              fontWeight: 800,
              fontSize: 14,
              cursor: submitting ? "wait" : "pointer",
              opacity: !date || !time ? 0.5 : 1,
            }}
          >
            {submitting ? "Booking…" : "Confirm Booking"}
          </button>
        </div>
      </div>
    </div>
  )
}
