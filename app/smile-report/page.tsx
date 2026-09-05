import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Choose Your Consultation | OrisAlign",
  description: "Get your Online Smile Report or book a 3D scan with OrisAlign.",
}

const NAVY = "#1B2A4A"
const GOLD = "#C9A84C"

export default function ChooseConsultationPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 20px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <Link href="/" style={{ display: "inline-block", fontSize: "20px", fontWeight: 900, color: NAVY, textDecoration: "none", letterSpacing: "1px" }}>
            ORIS<span style={{ color: GOLD }}>ALIGN</span>
          </Link>
          <h1 style={{ margin: "18px 0 8px", fontSize: "28px", fontWeight: 900, color: NAVY }}>Choose Your Consultation</h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>Pick the option that works best for you.</p>
        </div>

        <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "1fr", maxWidth: "560px", margin: "0 auto" }}>
          <Link
            href="/smile-report/upload"
            style={{
              display: "block",
              textDecoration: "none",
              background: "white",
              border: `2px solid ${GOLD}`,
              borderRadius: "18px",
              padding: "26px 24px",
              boxShadow: "0 12px 30px rgba(201,168,76,0.15)",
            }}
          >
            <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: GOLD, textTransform: "uppercase" }}>
              From anywhere · ₹599
            </p>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 800, color: NAVY }}>Get Your Online Smile Report</h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280", lineHeight: 1.6 }}>
              Upload 5 intraoral photos and get a provisional assessment reviewed by our dental team within 24–48 hours.
            </p>
          </Link>

          <Link
            href="/book"
            style={{
              display: "block",
              textDecoration: "none",
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "18px",
              padding: "26px 24px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
            }}
          >
            <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", color: "#6b7280", textTransform: "uppercase" }}>
              In-clinic
            </p>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 800, color: NAVY }}>Book Your 3D Scan</h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280", lineHeight: 1.6 }}>
              An in-person 3D intraoral scan and consultation at our clinic in Bhubaneswar.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
