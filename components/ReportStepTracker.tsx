"use client"

const NAVY = "#1B2A4A"
const GOLD = "#C9A84C"

const STEP2_UNLOCK_STATUSES = [
  "report_ready", "impression_interested", "ready_to_pay_impression",
  "impression_paid", "impression_taken", "plan_paid", "treatment_started",
]
const STEP3_UNLOCK_STATUSES = ["impression_taken", "plan_paid", "treatment_started"]

/**
 * 3-step progress tracker for the Online Smile Report flow. Steps 2 and 3
 * are locked/inactive until an admin has moved `status` far enough along —
 * see online_reports.status in migrations/015_create_online_smile_report.sql.
 */
export default function ReportStepTracker({ current, status }: { current: 1 | 2 | 3; status: string }) {
  const step2Unlocked = STEP2_UNLOCK_STATUSES.includes(status)
  const step3Unlocked = STEP3_UNLOCK_STATUSES.includes(status)
  const steps = [
    { n: 1 as const, label: "Upload & Info", unlocked: true },
    { n: 2 as const, label: "Impression Interest", unlocked: step2Unlocked },
    { n: 3 as const, label: "Full Plan / Treatment", unlocked: step3Unlocked },
  ]
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : undefined, gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              flexShrink: 0,
              background: s.n === current ? GOLD : s.unlocked ? "#e0f2e9" : "#f3f4f6",
              color: s.n === current ? "white" : s.unlocked ? "#168F83" : "#9ca3af",
              border: s.n === current ? "none" : "1px solid #e5e7eb",
            }}
            title={s.label}
          >
            {s.n}
          </div>
          <span style={{ fontSize: 11, color: s.unlocked || s.n === current ? NAVY : "#9ca3af", fontWeight: s.n === current ? 700 : 500 }}>
            {s.label}
          </span>
          {i < 2 && <div style={{ flex: 1, height: 2, background: steps[i + 1].unlocked ? "#3FB3A4" : "#e5e7eb" }} />}
        </div>
      ))}
    </div>
  )
}
