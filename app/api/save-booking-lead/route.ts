import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, phone, email } = body

    if (!name || !phone) {
      return NextResponse.json({
        success: false,
        message: "Missing required fields (name, phone)",
      }, { status: 400 })
    }

    const bookedAt = new Date().toISOString()

    // Save lead to appointments_booking table. No OTP step anymore — the
    // lead is registered straight from the website form, so mark it
    // verified immediately.
    const { data, error } = await supabase
      .from("appointments_booking")
      .insert([
        {
          name,
          phone,
          email: email || null,
          status: "lead",
          lead_verified: true,
          created_at: bookedAt,
        },
      ])
      .select("id")

    if (error) {
      console.error("Error saving lead:", error)
      return NextResponse.json({
        success: false,
        message: "Failed to save booking lead",
      }, { status: 500 })
    }

    const leadId = data?.[0]?.id

    // Send email notification to leads@orisalign.com
    const emailResult = await resend.emails.send({
      from: "OrisAlign Leads <noreply@orisalign.com>",
      to: "leads@orisalign.com",
      subject: `New Lead: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #111827; margin: 0;">New Lead Received</h1>
            <p style="color: #6b7280; margin: 8px 0 0;">Scan Booking Lead Information</p>
          </div>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: 700; color: #6b7280; width: 30%;">Name:</td>
                <td style="padding: 12px 0; color: #111827;">${name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: 700; color: #6b7280; width: 30%;">Phone:</td>
                <td style="padding: 12px 0; color: #111827;">${phone}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: 700; color: #6b7280; width: 30%;">Patient ID:</td>
                <td style="padding: 12px 0; color: #111827; font-weight: 700; font-family: monospace;">${leadId?.substring(0, 12).toUpperCase()}</td>
              </tr>
            </table>
          </div>

          <div style="background: #ede9fe; border: 1px solid #d8b4fe; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="margin: 0; color: #6d28d9; font-size: 12px; font-weight: 600;">
              Lead received on ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}
            </p>
          </div>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              This is an automated notification from OrisAlign's booking system.
            </p>
          </div>
        </div>
      `,
    }).catch((err) => {
      console.error("Error sending lead email:", err)
      return null
    })

    if (!emailResult) {
      console.warn("Lead email notification failed for:", leadId)
      // Continue despite email failure — lead was saved successfully
    }

    return NextResponse.json({
      success: true,
      leadId: leadId,
      message: "Lead saved successfully",
    })
  } catch (err: any) {
    console.error("Server error:", err)
    return NextResponse.json({
      success: false,
      message: "Server error",
    }, { status: 500 })
  }
}
