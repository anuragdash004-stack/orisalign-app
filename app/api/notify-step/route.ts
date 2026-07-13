import { NextResponse } from "next/server"
import { sendStepNotification } from "@/lib/notifyStep"

export async function POST(req: Request) {
  try {
    const { appointmentId, stepKey, email, customSubject, customBody } = await req.json()
    const origin = `https://${req.headers.get("host") || "orisalign.com"}`

    const result = await sendStepNotification({
      appointmentId,
      stepKey,
      emailOverride: email,
      customSubject,
      customBody,
      origin,
    })

    if (!result.success) {
      if ("skipped" in result && result.skipped) {
        return NextResponse.json({ skipped: true, reason: result.reason })
      }
      const status = "error" in result && result.error === "Missing appointmentId or stepKey" ? 400
        : "error" in result && result.error === "Appointment not found" ? 404
        : 500
      return NextResponse.json({ error: "error" in result ? result.error : "Failed" }, { status })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
