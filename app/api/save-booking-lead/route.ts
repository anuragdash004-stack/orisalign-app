import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { promises as dns } from "dns"
import { validateName, validatePhone, validateEmail } from "@/lib/validateContact"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Confirms the email's domain can actually receive mail by looking up its
 * MX records (falling back to an A record for the rare MX-less domain).
 * Returns false only when the domain genuinely does not resolve — transient
 * DNS errors fail open so we never block a real customer over a network blip.
 */
async function emailDomainIsReal(email: string): Promise<boolean> {
  const domain = email.split("@")[1]
  if (!domain) return false
  const notFound = (e: any) => e?.code === "ENOTFOUND" || e?.code === "ENODATA" || e?.code === "ESERVFAIL"
  try {
    const mx = await dns.resolveMx(domain)
    if (mx && mx.length > 0) return true
  } catch (e) {
    if (!notFound(e)) return true // transient error → don't block
  }
  try {
    const a = await dns.resolve(domain)
    return Array.isArray(a) && a.length > 0
  } catch (e) {
    if (notFound(e)) return false
    return true // transient error → don't block
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, phone, email } = body

    if (!name || !phone || !email) {
      return NextResponse.json({
        success: false,
        message: "Missing required fields (name, phone, email)",
      }, { status: 400 })
    }

    // ✅ Reject fake names / phone numbers / malformed emails
    const contactError = validateName(name) || validatePhone(phone) || validateEmail(email)
    if (contactError) {
      return NextResponse.json({ success: false, message: contactError }, { status: 400 })
    }

    // ✅ Confirm the email address is real (its domain can receive mail)
    if (!(await emailDomainIsReal(email))) {
      return NextResponse.json({
        success: false,
        message: "Please enter a real email address — we couldn't verify this email provider.",
      }, { status: 400 })
    }

    const bookedAt = new Date().toISOString()

    // Save lead to appointments_booking table as an UNVERIFIED lead entry.
    // It becomes verified only after the patient confirms the OTP (see
    // /api/verify-lead).
    const { data, error } = await supabase
      .from("appointments_booking")
      .insert([
        {
          name,
          phone,
          email,
          status: "lead",
          lead_verified: false,
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
      subject: `🕗 Unverified Lead: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #111827; margin: 0;">New Lead Received</h1>
            <p style="color: #6b7280; margin: 8px 0 0;">Scan Booking Lead Information</p>
            <p style="display:inline-block;margin:12px 0 0;padding:4px 12px;background:#fef3c7;color:#92400e;border-radius:99px;font-size:12px;font-weight:700;">UNVERIFIED — awaiting email OTP</p>
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
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-weight: 700; color: #6b7280; width: 30%;">Email:</td>
                <td style="padding: 12px 0; color: #111827;">${email}</td>
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
