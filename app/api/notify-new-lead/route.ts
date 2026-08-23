import { NextResponse } from "next/server"
import { sendWhatsApp } from "@/lib/notifications/aisensy"

// "Thank you for showing your interest in OrisAlign. Your partner for a
// beautiful smile." — static text, no variables.
const WHATSAPP_NEW_LEAD_CAMPAIGN = "orisalign_new_lead_thankyou"

/**
 * POST /api/notify-new-lead
 *
 * Fires the "thanks for your interest" WhatsApp the moment any new lead is
 * created, regardless of source. Called from every lead-creation path:
 *   - app/api/save-booking-lead/route.ts (website /book form)
 *   - lib/onlineReportLeadSync.ts (Online Smile Report Step 1)
 *   - app/api/notify-booking/route.ts's "callback" type (homepage widget)
 *   - app/(dashboard)/leads/page.js (admin manually adding a lead) — the
 *     only client-side insert of the four, hence needing its own route
 *     rather than calling sendWhatsApp directly (would expose the AiSensy
 *     key to the browser bundle).
 *
 * Body: { phone: string, name?: string }
 */
export async function POST(req: Request) {
  try {
    const { phone, name } = await req.json()
    if (!phone) {
      return NextResponse.json({ success: false, error: "phone required" }, { status: 400 })
    }

    const result = await sendWhatsApp({
      campaignName: WHATSAPP_NEW_LEAD_CAMPAIGN,
      destination: phone,
      userName: name || "there",
      templateParams: [],
    })

    return NextResponse.json({ success: result.success, error: "error" in result ? result.error : undefined })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
