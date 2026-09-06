/**
 * Friendly, patient-facing label for an online_reports.status value —
 * used everywhere a patient needs to see "where am I in this process"
 * without exposing the internal status name (login routing, the patient
 * dashboard's report card, etc). Keep in sync with the status check
 * constraint on online_reports and with app/report/[id]/page.tsx's own
 * step tracker, which is the source of truth for what each stage means.
 */
export function onlineReportStageLabel(status: string | null | undefined): string {
  switch (status) {
    case "new_submission":
      return "Submitted — In Review";
    case "report_ready":
      return "Ready to View";
    case "impression_interested":
      return "Awaiting Your Response";
    case "ready_to_pay_impression":
      return "Impression — Payment Pending";
    case "impression_paid":
      return "Impression — In Progress";
    case "impression_taken":
      return "Impression Received — Planning";
    case "plan_paid":
      return "Plan Paid — In Progress";
    case "treatment_started":
      return "Treatment Started";
    default:
      return "In Progress";
  }
}
