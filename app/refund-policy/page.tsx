import type { Metadata } from "next";
import PolicyFooter from "@/components/PolicyFooter";
import BackButton from "@/components/BackButton";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | OrisAlign",
  description: "OrisAlign's Refund and Cancellation Policy outlines refund eligibility, timelines, and procedures for clear aligner treatment in Bhubaneswar, Odisha.",
  keywords: "refund policy, cancellation policy, clear aligners, OrisAlign, Bhubaneswar",
  openGraph: {
    title: "Refund & Cancellation Policy – OrisAlign",
    description: "Understand OrisAlign's refund and cancellation policies for clear aligner treatment services.",
    url: "https://orisalign.com/refund-policy",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RefundPolicyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: "820px", margin: "0 auto", padding: "40px 20px", width: "100%", flex: 1 }}>

        {/* Back Button */}
        <BackButton />

        <div style={{ padding: "0 0 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "2px solid #1B2A4A", paddingBottom: "24px", marginBottom: "36px" }}>
          <img src="/logo2.png" alt="OrisAlign" style={{ height: "48px", marginBottom: "16px", mixBlendMode: "multiply" }} />
          <h1 style={{ fontSize: "28px", fontWeight: "900", color: "#1B2A4A", margin: "0 0 6px" }}>REFUND AND CANCELLATION POLICY</h1>
          <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>Effective Date: 23 April 2026 &nbsp;•&nbsp; Version: 1.0</p>
          <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "6px" }}>
            Orisalign Private Limited &nbsp;|&nbsp; MIG-1, 43/5, Housing Board Colony, Chandrasekharpur, Bhubaneswar – 751016, Odisha
          </p>
        </div>

        {[
          {
            num: "1", title: "Introduction",
            content: `This Refund and Cancellation Policy ("Policy") is issued by Orisalign Private Limited ("Orisalign", "the Company", "We", "Us", or "Our"), a company incorporated and operating under the laws of India, with its registered office at MIG-1, 43/5, Housing Board Colony, Chandrasekharpur, Bhubaneswar – 751016, Odisha.

This Policy governs all financial transactions between Orisalign and its clients ("Patient", "Client", "You", or "Your") in relation to the procurement of clear aligner treatment plans, orthodontic consultation services, three-dimensional (3D) dental scanning, and associated orthodontic treatment planning services offered by the Company.

By making a payment to Orisalign and/or accepting our treatment proposal, you acknowledge that you have read, understood, and agree to be bound by the terms of this Policy.`
          },
          {
            num: "2", title: "Scope and Applicability",
            content: "This Policy applies to:",
            bullets: [
              "All payments made by patients toward clear aligner treatment plans;",
              "Fees collected for consultation, 3D scanning, orthodontic assessment, and treatment planning;",
              "Any advance, deposit, or full payment received prior to the dispatch or delivery of physical aligner sets;",
              "All transactions conducted at Orisalign's facilities, through partner clinics, or via any digital/online payment channel authorised by Orisalign.",
            ]
          },
          {
            num: "3", title: "Non-Refundable Service Charge",
            subsections: [
              {
                title: "3.1 Consultation & Planning Fee",
                content: `Orisalign incurs substantial clinical, technical, and professional resources from the moment a patient engages with our services. Accordingly, a fixed, non-refundable fee of INR 5,000/- (Rupees Five Thousand Only) shall be retained by Orisalign on all eligible refund requests. This charge represents the cost of services already rendered at the time of the refund request.`
              },
              {
                title: "3.2 Breakdown of the Non-Refundable Fee",
                bullets: [
                  "Orthodontic Consultation: In-person or tele-consultation conducted by a licensed orthodontist or dental professional.",
                  "3D Intraoral Scanning: High-precision digital scanning of the patient's dentition using advanced intraoral scanning technology.",
                  "Orthodontic Assessment & Involvement: Clinical evaluation, interpretation of scans and radiographs, and professional oversight by a registered orthodontist.",
                  "3D Treatment Planning: Digital simulation and formulation of a customised, stage-by-stage treatment plan.",
                ]
              }
            ]
          },
          {
            num: "4", title: "Refund Eligibility",
            subsections: [
              {
                title: "4.1 Eligible for Refund",
                content: "A refund (less the non-refundable fee of INR 5,000/-) shall be applicable under the following conditions:",
                bullets: [
                  "The patient submits a written refund request before the physical aligner sets have been dispatched or shipped;",
                  "The refund request is submitted prior to the Company's confirmation that fabrication of the aligner sets has commenced;",
                  "Acceptance of the final treatment plan via written confirmation, email, WhatsApp message, or patient portal approval shall constitute the patient's authorisation to commence fabrication. From that point, refunds are only considered on the undelivered balance of a treatment, and only prior to fabrication of those remaining sets (mandatory deduction of ₹5,999/- is applicable on any refund request post payment).",
                ]
              },
              {
                title: "4.2 Not Eligible for Refund",
                content: "No refund shall be provided under the following circumstances:",
                bullets: [
                  "The aligner sets have been dispatched or delivered to the patient or a partner dental clinic;",
                  "The patient has acknowledged and accepted the 3D treatment plan and fabrication has been initiated;",
                  "The request is made after aligner sets have been manufactured and are ready for dispatch;",
                  "The patient fails to provide required documentation or does not respond within stipulated timeframes;",
                  "The refund request arises due to a change of mind after fabrication has commenced;",
                  "Services procured from third-party partner clinics are subject to their own separate refund terms.",
                ]
              }
            ]
          },
          {
            num: "5", title: "Refund Request Process",
            subsections: [
              {
                title: "5.1 How to Initiate a Refund",
                content: "To initiate a refund, the patient must:",
                bullets: [
                  "Submit a written request via email to the official Orisalign support email address or by visiting the registered office in person;",
                  "Include: full name, registered mobile number, patient ID/case reference number, reason for refund, and proof of payment;",
                  "The refund request must be received prior to the dispatch of the aligner sets.",
                ]
              },
              {
                title: "5.2 Processing Timelines",
                content: "Upon receipt of a valid and complete refund request:",
                bullets: [
                  "Acknowledgement will be sent within three (3) business days;",
                  "The Company will verify eligibility and process the refund within seven (7) to fourteen (14) business days from the date of approval;",
                  "Refunds shall be processed to the original payment source (bank account, UPI, card, or other payment instrument);",
                  "In the event of cash payments, refunds shall be made by bank transfer.",
                ]
              }
            ]
          },
          {
            num: "6", title: "Refund Amount Calculation",
            content: `The refundable amount shall be calculated as follows:\n\nRefund Amount = Total Amount Paid – INR 5,000 (Non-Refundable Fee)\n\nAny applicable payment gateway or transaction charges are non-refundable.\n\nExample: If a patient has paid INR 25,000/- and submits a valid refund request before dispatch, the refundable amount shall be INR 20,000/-. The INR 5,000/- will be retained as the service charge for consultation, scanning, and planning services already provided.`
          },
          {
            num: "6.1", title: "EMI Refunds",
            content: `For payments made via Equated Monthly Installment (EMI) through any financial institution or lending partner, refunds requested prior to aligner fabrication will be processed back to the original EMI source after deduction of the ₹5,999/- non-refundable fee and any foreclosure, processing, or transaction charges levied by the financier. Orisalign is not liable for any charges imposed by the lending institution.`
          },
          {
            num: "7", title: "Cancellation Policy",
            content: "Patients may cancel their treatment order at any time before the commencement of aligner fabrication. Upon cancellation:",
            bullets: [
              "Before fabrication begins: Entitled to a refund of the amount paid, less the non-refundable fee of INR 5,000/-.",
              "After fabrication has commenced but before dispatch: No refund shall be applicable. The full amount paid shall be forfeited.",
              "After dispatch: No refund or cancellation shall be entertained.",
              "Partial treatment: No refund shall be applicable for any aligner sets already delivered as part of an ongoing treatment. (Remember: aligners are custom-made and cannot be used for any other patients.) Refunds are only considered on the undelivered balance of a treatment, and only prior to fabrication of those remaining sets (mandatory deduction of ₹5,999/- is applicable on any refund request post payment).",
            ],
            footer: "All cancellation requests must be submitted in writing to Orisalign's official communication channels as described in Section 5.1 above."
          },
          {
            num: "8", title: "Exceptions and Special Circumstances",
            content: "Orisalign acknowledges that exceptional circumstances may arise. The Company, at its sole discretion, may consider refund requests on a case-by-case basis in the following scenarios:",
            bullets: [
              "Medical Emergency: If a patient is medically advised to discontinue treatment due to a health condition arising after payment, Orisalign may consider a special refund, subject to submission of a valid medical certificate.",
              "Errors by Orisalign: If a refund request arises due to a verified error on Orisalign's part (e.g., incorrect treatment plan, technical failure in scanning), the Company shall review and resolve the matter without applying the standard non-refundable deduction.",
            ],
            footer: "Such exceptions are evaluated entirely at the discretion of Orisalign's management and do not constitute a general waiver of this Policy."
          },
          {
            num: "9", title: "Dispute Resolution",
            content: "In the event of any dispute arising out of or in connection with a refund or cancellation request:",
            bullets: [
              "The patient shall first attempt to resolve the matter by writing to Orisalign's designated customer service channel with full details of the complaint;",
              "Orisalign shall endeavour to resolve the dispute within fifteen (15) business days;",
              "If the dispute remains unresolved, it shall be subject to mediation in the first instance;",
              "All disputes shall be subject to the exclusive jurisdiction of the courts located in Bhubaneswar, Odisha, India.",
            ]
          },
          {
            num: "10", title: "Governing Law",
            content: "This Policy shall be governed by and construed in accordance with the laws of the Republic of India, including but not limited to the Consumer Protection Act, 2019, the Information Technology Act, 2000, the Indian Contract Act, 1872, and all other applicable statutes and regulations in force in India."
          },
          {
            num: "11", title: "Amendments to this Policy",
            content: "Orisalign reserves the right to amend, revise, or update this Policy at any time without prior notice. The revised Policy will be effective from the date of publication and will be made available on the Company's website and at the registered office. Continued use of Orisalign's services after any such modification constitutes your acceptance of the revised terms."
          },
          {
            num: "12", title: "Contact Information",
            content: "For all refund and cancellation inquiries, please contact:",
          },
        ].map((section: any) => (
          <div key={section.num} style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#1B2A4A", borderBottom: "1px solid #e5e7eb", paddingBottom: "8px", marginBottom: "14px" }}>
              {section.num}. {section.title}
            </h2>
            {section.content && (
              <p style={{ color: "#374151", fontSize: "14px", lineHeight: "1.8", whiteSpace: "pre-line", marginBottom: section.bullets ? "10px" : "0" }}>
                {section.content}
              </p>
            )}
            {section.bullets && (
              <ul style={{ paddingLeft: "20px", margin: "0 0 10px", color: "#374151", fontSize: "14px", lineHeight: "2" }}>
                {section.bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
              </ul>
            )}
            {section.footer && <p style={{ color: "#374151", fontSize: "14px", lineHeight: "1.8", marginTop: "10px" }}>{section.footer}</p>}
            {section.subsections?.map((sub: any) => (
              <div key={sub.title} style={{ marginBottom: "16px", marginTop: "12px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#C9A84C", marginBottom: "8px" }}>{sub.title}</h3>
                {sub.content && <p style={{ color: "#374151", fontSize: "14px", lineHeight: "1.8", marginBottom: sub.bullets ? "8px" : "0" }}>{sub.content}</p>}
                {sub.bullets && (
                  <ul style={{ paddingLeft: "20px", margin: 0, color: "#374151", fontSize: "14px", lineHeight: "2" }}>
                    {sub.bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
                  </ul>
                )}
              </div>
            ))}
            {section.num === "12" && (
              <div style={{ background: "#1B2A4A", color: "white", borderRadius: "12px", padding: "20px 24px", fontSize: "14px", lineHeight: "1.8" }}>
                <strong>Orisalign Private Limited</strong><br />
                MIG-1, 43/5, Housing Board Colony, Chandrasekharpur<br />
                Bhubaneswar – 751016, Odisha, India<br />
                Email: hello@orisalign.com<br />
                Phone: +91 8069645412
              </div>
            )}
          </div>
        ))}

        <div style={{ textAlign: "center", marginTop: "40px", padding: "16px", background: "#f3f4f6", borderRadius: "10px", fontSize: "12px", color: "#6b7280" }}>
          This is a legally binding document. Please retain a copy for your records.<br />
          © 2026 Orisalign Private Limited. All rights reserved.
        </div>

        </div>
      </div>

      <PolicyFooter />
    </div>
  )
}
