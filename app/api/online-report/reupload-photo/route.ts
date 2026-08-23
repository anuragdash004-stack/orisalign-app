import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/notifications/resend"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ONLINE_REPORT_ADMIN_EMAIL

/**
 * POST /api/online-report/reupload-photo
 * Body: { reportId, slotKey, url }
 *
 * Patient-facing — only allowed for a slot the reviewer actually rejected;
 * a patient can't touch an approved or untouched photo through this route.
 * Resets that slot's photo_review back to 'pending' so the reviewer sees it
 * needs re-review, clearing the old rejection reason.
 */
export async function POST(req: Request) {
  try {
    const { reportId, slotKey, url } = await req.json()
    if (!reportId || !slotKey || !url) {
      return NextResponse.json({ error: "reportId, slotKey and url are required" }, { status: 400 })
    }

    const { data: report, error: fetchError } = await supabase
      .from("online_reports")
      .select("full_name, photo_urls, photo_review")
      .eq("id", reportId)
      .maybeSingle()

    if (fetchError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const review = (report.photo_review as Record<string, { status?: string }>) || {}
    if (review[slotKey]?.status !== "rejected") {
      return NextResponse.json({ error: "This photo isn't flagged for reupload" }, { status: 403 })
    }

    const photoUrls = { ...((report.photo_urls as Record<string, string>) || {}), [slotKey]: url }
    const photoReview = { ...review, [slotKey]: { status: "pending" } }

    const { error: updateError } = await supabase
      .from("online_reports")
      .update({ photo_urls: photoUrls, photo_review: photoReview, updated_at: new Date().toISOString() })
      .eq("id", reportId)

    if (updateError) {
      return NextResponse.json({ error: "Failed to save photo" }, { status: 500 })
    }

    if (ADMIN_EMAIL) {
      sendEmail({
        to: ADMIN_EMAIL,
        subject: `Photo reuploaded — ${report.full_name}`,
        html: `<p>${report.full_name} reuploaded their <strong>${slotKey.replace(/_/g, " ")}</strong> photo after it was rejected. Please review it again.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/online-reports/${reportId}">View in Admin Panel</a></p>`,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error reuploading photo:", error)
    return NextResponse.json({ error: "Failed to save photo" }, { status: 500 })
  }
}
