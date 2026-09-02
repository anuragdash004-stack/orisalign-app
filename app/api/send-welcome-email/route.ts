import { NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, name, patientId } = body

    if (!email || !name || !patientId) {
      return NextResponse.json({
        success: false,
        message: "Missing required fields",
      }, { status: 400 })
    }

    // Send welcome email with patient ID and journey link
    const result = await resend.emails.send({
      from: "OrisAlign <noreply@orisalign.com>",
      to: email,
      subject: "Welcome to OrisAlign! Your Scan is Booked",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #111827; margin: 0 0 10px;">Welcome to OrisAlign</h1>
            <p style="color: #6b7280; font-size: 16px; margin: 0;">Your Smile Assessment is Booked!</p>
          </div>

          <div style="background: #EAF7F5; border: 1px solid #9FD8D1; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <p style="color: #111827; font-size: 14px; margin: 0 0 15px;">Hi <strong>${name}</strong>,</p>
            <p style="color: #111827; font-size: 14px; margin: 0 0 15px;">Thank you for choosing OrisAlign! Your smile assessment scan is booked and confirmed.</p>

            <div style="background: white; border: 1px solid #d1d5db; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 700; margin: 0 0 8px;">Your Patient ID</p>
              <p style="color: #111827; font-size: 20px; font-weight: 700; letter-spacing: 2px; margin: 0;">${patientId.substring(0, 12).toUpperCase()}</p>
              <p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0;">Save this ID to track your journey</p>
            </div>

            <p style="color: #111827; font-size: 14px; margin: 15px 0;">You'll soon get a call from our counselors to confirm your appointment details and answer any questions you may have.</p>
          </div>

          <div style="text-align: center; margin-bottom: 20px;">
            <a href="https://orisalign.com/patient/${patientId}" style="display: inline-block; padding: 12px 30px; background: #b8905a; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
              Go to Your Journey Page
            </a>
          </div>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">If you have any questions, please don't hesitate to contact us.</p>
            <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0;">Best regards,<br/>The OrisAlign Team</p>
          </div>
        </div>
      `,
    })

    if (result.error) {
      console.error("Email send error:", result.error)
      return NextResponse.json({
        success: false,
        message: "Failed to send email",
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Welcome email sent successfully",
    })
  } catch (err: any) {
    console.error("Server error:", err)
    return NextResponse.json({
      success: false,
      message: "Server error",
    }, { status: 500 })
  }
}
