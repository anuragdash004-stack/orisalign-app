import type { Metadata } from "next";
import PolicyFooter from "@/components/PolicyFooter";
import BackButton from "@/components/BackButton";

export const metadata: Metadata = {
  title: "Privacy Policy | OrisAlign",
  description: "OrisAlign Privacy Policy explains how we collect, use, and protect your personal data under the Digital Personal Data Protection Act, 2023 and applicable Indian laws.",
  keywords: "privacy policy, data protection, DPDP Act, personal data, OrisAlign, Bhubaneswar",
  openGraph: {
    title: "Privacy Policy – OrisAlign",
    description: "Learn how OrisAlign protects your personal data and complies with DPDP Act, 2023.",
    url: "https://orisalign.com/privacy-policy",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPolicyPage() {
  const s = { color: "#374151", fontSize: "14px", lineHeight: "1.8" }
  const h2 = { fontSize: "17px", fontWeight: "800" as const, color: "#1B2A4A", borderBottom: "1px solid #e5e7eb", paddingBottom: "8px", marginBottom: "14px", marginTop: "0" }
  const h3 = { fontSize: "14px", fontWeight: "700" as const, color: "#C9A84C", marginBottom: "8px", marginTop: "16px" }
  const li = { ...s, marginBottom: "6px" }
  const sec = { marginBottom: "32px" }

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: "820px", margin: "0 auto", padding: "40px 20px", width: "100%", flex: 1 }}>

        {/* Back Button */}
        <BackButton />

        <div style={{ padding: "0 0 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "2px solid #1B2A4A", paddingBottom: "24px", marginBottom: "36px" }}>
          <img src="/logo2.png" alt="OrisAlign" style={{ height: "48px", marginBottom: "16px", mixBlendMode: "multiply" }} />
          <h1 style={{ fontSize: "26px", fontWeight: "900", color: "#1B2A4A", margin: "0 0 6px" }}>PRIVACY POLICY</h1>
          <p style={{ color: "#6b7280", fontSize: "13px", margin: "6px 0 0" }}>
            Last Updated: 30 April 2026 &nbsp;•&nbsp; Effective Date: 1 May 2026 &nbsp;•&nbsp; Version 1.0
          </p>
          <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>
            Orisalign Private Limited &nbsp;|&nbsp; Bhubaneswar – 751016, Odisha
          </p>
          <p style={{ color: "#374151", fontSize: "13px", fontStyle: "italic", marginTop: "14px", padding: "12px 16px", background: "#FBF7EE", borderRadius: "8px", border: "1px solid #E8D5A0" }}>
            This Privacy Policy explains how Orisalign Private Limited collects, uses, stores, shares, and protects your personal data. It applies to all patients, clients, website visitors, and users who interact with Orisalign Private Limited through any channel including our website, booking platform, and all consultation services.
          </p>
          <p style={{ ...s, marginTop: "12px", fontSize: "13px" }}>
            By using any Orisalign Private Limited service or by booking an appointment, you acknowledge that you have read and understood this Privacy Policy. This policy is governed by the Digital Personal Data Protection Act, 2023 (DPDP Act), the Information Technology Act, 2000, and all other applicable Indian laws.
          </p>
        </div>

        {/* Section 1 */}
        <div style={sec}>
          <h2 style={h2}>1. WHO WE ARE</h2>
          <p style={s}>Orisalign Private Limited is a healthcare and aesthetic services company incorporated and operating in the State of Odisha, India. We provide medical and aesthetic consultations and treatments through qualified practitioners registered with the Odisha Council of Medical Registration (OCMR).</p>
          <p style={{ ...s, marginTop: "10px" }}>Under the Digital Personal Data Protection Act, 2023, Orisalign Private Limited is the <strong>Data Fiduciary</strong> responsible for your personal data.</p>
          <div style={{ marginTop: "12px", background: "white", borderRadius: "8px", padding: "14px 16px", border: "1px solid #e5e7eb", fontSize: "14px", color: "#374151" }}>
            <strong>Registered Office:</strong> Bhubaneswar – 751016, Odisha<br />
            <strong>Data Protection Contact:</strong> <a href="mailto:hello@orisalign.com" style={{ color: "#C9A84C" }}>hello@orisalign.com</a>
          </div>
        </div>

        {/* Section 2 */}
        <div style={sec}>
          <h2 style={h2}>2. WHAT PERSONAL DATA WE COLLECT</h2>
          <p style={{ ...s, marginBottom: "10px" }}>We collect and process the following categories of personal data:</p>
          <h3 style={h3}>2.1 Data you provide directly</h3>
          <ul style={{ paddingLeft: "20px", margin: "0 0 10px" }}>
            {[
              "Identity data: Full name, date of birth, age, gender.",
              "Contact data: Phone number, email address, residential address.",
              "Identity verification data: Government-issued ID type and number such as Aadhaar, PAN, or driving licence, collected where required for verification purposes.",
              "Health and medical data: Medical history, current medications, known allergies, previous procedures, treatment records, clinical notes, and any other health information you disclose to our practitioners. This is Sensitive Personal Data under the DPDP Act, 2023 and is handled with the highest level of care.",
              "Financial data: Payment details sufficient to process transactions. We do not store full card or bank account numbers.",
              "Visual data: Clinical photographs and video stills, where you have given specific consent under our Photography and Media Consent policy.",
              "Communication data: Records of communications between you and Orisalign Private Limited via phone, SMS, WhatsApp, and email.",
            ].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <h3 style={h3}>2.2 Data we collect automatically</h3>
          <ul style={{ paddingLeft: "20px", margin: "0 0 10px" }}>
            {[
              "Website usage data: IP address, browser type, pages visited, time and date of visit, and referral source, collected through cookies and similar tracking technologies when you visit our website.",
              "Booking platform data: Appointment history, service preferences, and booking behaviour collected through our booking system.",
            ].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <h3 style={h3}>2.3 Data we receive from third parties</h3>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            <li style={li}>Where you book through a third-party platform or are referred to us by another healthcare provider, we may receive basic identification and contact data from that source. Such data is handled in accordance with this policy from the point of receipt.</li>
          </ul>
        </div>

        {/* Section 3 */}
        <div style={sec}>
          <h2 style={h2}>3. HOW WE USE YOUR PERSONAL DATA</h2>
          <p style={{ ...s, marginBottom: "10px" }}>We use your personal data only for the purposes for which it was collected or for purposes that are compatible with those original purposes.</p>
          {[
            { t: "3.1 Providing and managing our services", items: ["Scheduling, confirming, and managing your appointments across home, clinic, and online consultations.", "Conducting safe and appropriate medical and aesthetic consultations and treatments.", "Maintaining accurate clinical records as required by professional and legal obligations.", "Sending pre-treatment instructions and post-treatment aftercare follow-up communications."] },
            { t: "3.2 Billing and payments", items: ["Processing payments and issuing invoices and receipts.", "Maintaining financial records in compliance with applicable GST and tax law."] },
            { t: "3.3 Communications", items: ["Sending appointment reminders, booking confirmations, and rescheduling notifications.", "Sending promotional offers, new service announcements, and health and wellness information, where you have consented to receive such communications.", "We may contact you via WhatsApp for appointment reminders, treatment follow-ups, promotional offers, and service updates, where you have provided your WhatsApp number and consented to such communications. You may opt out at any time by messaging 'STOP' to our WhatsApp number.", "Collecting feedback and satisfaction information about your experience with us."] },
            { t: "3.4 Safety and legal compliance", items: ["Complying with our legal and professional obligations under applicable Indian law, OCMR regulations, and NMC guidelines.", "Protecting the safety and welfare of our patients and practitioners.", "Responding to complaints, disputes, or legal proceedings."] },
            { t: "3.5 Marketing and promotional content", items: ["Using anonymised or consented photographs and case studies for promotional, educational, or marketing purposes, strictly in accordance with the terms of the specific consent given.", "We will never use your identifiable image or name for promotional purposes without a separate and specific written consent from you."] },
            { t: "3.6 Improving our services", items: ["Analysing aggregated and anonymised data to understand how our services are used and how they can be improved. No individual patient is identified in this analysis."] },
          ].map((item, i) => (
            <div key={i}><h3 style={h3}>{item.t}</h3><ul style={{ paddingLeft: "20px", margin: "0 0 4px" }}>{item.items.map((t, j) => <li key={j} style={li}>{t}</li>)}</ul></div>
          ))}
        </div>

        {/* Section 4 */}
        <div style={sec}>
          <h2 style={h2}>4. LEGAL BASIS FOR PROCESSING</h2>
          <p style={{ ...s, marginBottom: "10px" }}>Under the Digital Personal Data Protection Act, 2023, we process your personal data on the following legal bases:</p>
          <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
            <li style={li}><strong>Consent:</strong> For the collection of health data, photography, promotional communications, and marketing contact, we rely on your freely given, specific, informed, and unambiguous consent, provided at the time of booking or at a subsequent point.</li>
            <li style={li}><strong>Legitimate interest and legal obligation:</strong> For maintaining clinical records, processing payments, complying with OCMR and NMC professional obligations, and responding to legal claims, we process data as necessary to fulfil our legal and professional duties.</li>
          </ul>
          <p style={s}>You may withdraw any consent given to us at any time by contacting us at <a href="mailto:hello@orisalign.com" style={{ color: "#C9A84C" }}>hello@orisalign.com</a>. Withdrawal of consent does not affect the lawfulness of any processing carried out before the withdrawal.</p>
        </div>

        {/* Section 5 */}
        <div style={sec}>
          <h2 style={h2}>5. WHO WE SHARE YOUR DATA WITH</h2>
          <p style={{ ...s, marginBottom: "10px" }}>Orisalign Private Limited <strong>does not sell your personal data</strong> to any third party. We share your personal data only in the following limited circumstances:</p>
          <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
            {[
              "Practitioners: Your health and appointment data is shared with the specific practitioner conducting your consultation or treatment. All practitioners are bound by professional confidentiality obligations.",
              "Payment processors: Basic transaction data is shared with payment processing partners solely for the purpose of processing your payment. We do not share health data with payment processors.",
              "Technology platforms: Where telemedicine sessions are conducted via third-party platforms such as WhatsApp, Zoom, or Google Meet, the communication itself passes through those platforms' infrastructure. We do not share your full medical record with these platforms.",
              "Advertising & analytics platforms: We use Meta Pixel and Google Ads on our website. These tools collect anonymised/pseudonymised browsing and conversion data and transmit it to Meta Platforms Inc. and Google LLC, both based in the United States. No personally identifiable health data is shared with these platforms. By using our website, you consent to this data transfer. You can manage your ad preferences through your account settings on Meta and Google platforms.",
              "Legal and regulatory authorities: We may disclose your data to regulatory bodies, courts, law enforcement agencies, or the Data Protection Board of India where required by law or in response to a valid legal process.",
              "Professional advisors: We may share data with our legal advisors, auditors, or insurers on a strictly confidential basis where necessary.",
            ].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <p style={s}>In all cases of data sharing, we take reasonable steps to ensure that recipients handle your data with an equivalent standard of care.</p>
        </div>

        {/* Section 6 */}
        <div style={sec}>
          <h2 style={h2}>6. COOKIES AND WEBSITE TRACKING</h2>
          <p style={{ ...s, marginBottom: "10px" }}>Our website uses cookies and similar tracking technologies to improve your browsing experience and to understand how visitors use our site.</p>
          <h3 style={h3}>6.1 What cookies we use</h3>
          <ul style={{ paddingLeft: "20px", margin: "0 0 10px" }}>
            {["Essential cookies: Necessary for the website to function correctly, including enabling the booking system to operate. These cannot be disabled.", "Analytics cookies: Used to collect aggregated information about how visitors use our website, such as pages visited and time spent. This data is anonymised and not linked to individual users.", "Functional cookies: Used to remember your preferences and improve your experience on return visits."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <h3 style={h3}>6.2 Managing cookies</h3>
          <p style={s}>You can manage or disable non-essential cookies through your browser settings at any time. Disabling certain cookies may affect the functionality of our website. A cookie consent banner will be displayed on your first visit to our website where required by applicable law.</p>
        </div>

        {/* Section 7 */}
        <div style={sec}>
          <h2 style={h2}>7. HOW LONG WE KEEP YOUR DATA</h2>
          <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
            {["Medical and clinical records: Retained for a minimum of three years from the date of your last appointment, or for such longer period as is required under applicable Indian law or professional regulations.", "Photographs: Retained for the period covered by your photography consent, or until you withdraw that consent, subject to any mandatory clinical record-keeping requirements.", "Financial records: Retained for the period required under GST legislation and applicable tax law.", "Communication records: Retained for a period of two years from the date of the communication, or for longer where relevant to an ongoing dispute or legal matter.", "Website and booking data: Retained for a period of one year from your last interaction with our website or booking platform, unless a longer period is required."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <p style={s}>After the applicable retention period, all personal data is securely and permanently deleted or anonymised in a manner that prevents re-identification.</p>
        </div>

        {/* Section 8 */}
        <div style={sec}>
          <h2 style={h2}>8. HOW WE PROTECT YOUR DATA</h2>
          <p style={{ ...s, marginBottom: "10px" }}>Orisalign Private Limited takes the security of your personal data seriously and implements appropriate technical and organisational measures to protect it, including:</p>
          <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
            {["Encrypted digital storage for all electronic patient records and clinical data.", "Access controls ensuring that only authorised personnel can access patient data, limited to what is necessary for their specific role.", "Locked physical storage for all paper-based records.", "Confidentiality obligations for all practitioners and staff who handle patient data.", "Regular review of data security practices."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <p style={s}>In the event of a personal data breach, we will notify affected individuals and the Data Protection Board of India without undue delay, in accordance with the requirements of the DPDP Act, 2023.</p>
        </div>

        {/* Section 9 */}
        <div style={sec}>
          <h2 style={h2}>9. YOUR RIGHTS UNDER THE DPDP ACT, 2023</h2>
          <p style={{ ...s, marginBottom: "10px" }}>As a data principal under the Digital Personal Data Protection Act, 2023, you have the following rights in relation to your personal data:</p>
          <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
            {["Right to Access: You may request a copy of all personal data that Orisalign Private Limited holds about you.", "Right to Correction: You may request that any inaccurate or incomplete personal data be corrected or updated.", "Right to Erasure: You may request the deletion of your personal data. We will comply subject to any mandatory legal record-retention obligations that prevent immediate deletion.", "Right to Withdraw Consent: You may withdraw any consent you have given to us at any time. Withdrawal does not affect processing already carried out.", "Right to Grievance Redressal: You may raise a data protection complaint or concern directly with us. If you are not satisfied with our response, you may file a complaint with the Data Protection Board of India.", "Right to Nominate: You may nominate another individual to exercise your data rights on your behalf in the event of your death or incapacity."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <p style={s}>To exercise any of these rights, please contact us at <a href="mailto:hello@orisalign.com" style={{ color: "#C9A84C" }}>hello@orisalign.com</a>. We will acknowledge your request within a reasonable time and respond within the period required under applicable law.</p>
        </div>

        {/* Section 10 */}
        <div style={sec}>
          <h2 style={h2}>10. CHILDREN AND MINOR PATIENTS</h2>
          <p style={s}>Where services are provided to patients under 18 years of age, all data collection and processing is conducted through and with the consent of the parent or legal guardian. We do not knowingly collect data directly from individuals under 18 without verified parental or guardian consent.</p>
          <p style={{ ...s, marginTop: "10px" }}>Parents or guardians may exercise all data rights on behalf of a minor patient by contacting us at <a href="mailto:hello@orisalign.com" style={{ color: "#C9A84C" }}>hello@orisalign.com</a>.</p>
        </div>

        {/* Section 11 */}
        <div style={sec}>
          <h2 style={h2}>11. THIRD-PARTY LINKS AND PLATFORMS</h2>
          <p style={s}>Our website may contain links to third-party websites or services. This Privacy Policy does not apply to those third-party sites. We are not responsible for the privacy practices of any third-party website or platform. We encourage you to read the privacy policy of any external site you visit.</p>
          <p style={{ ...s, marginTop: "10px" }}>For telemedicine consultations conducted via third-party platforms, those platforms' own privacy policies govern the data processed by their systems. Please review those policies before using those platforms.</p>
        </div>

        {/* Section 12 */}
        <div style={sec}>
          <h2 style={h2}>12. CHANGES TO THIS PRIVACY POLICY</h2>
          <p style={s}>Orisalign Private Limited may update this Privacy Policy from time to time to reflect changes in our services, legal requirements, or data practices. The current version will always be available on our website and will include the effective date of the latest revision. Where changes are material, we will notify existing patients via email.</p>
          <p style={{ ...s, marginTop: "10px" }}>Continued use of our services after any update to this policy constitutes acceptance of the revised terms.</p>
        </div>

        {/* Section 13 */}
        <div style={sec}>
          <h2 style={h2}>13. CONTACT AND GRIEVANCE</h2>
          <p style={{ ...s, marginBottom: "14px" }}>For all privacy-related queries, data access requests, consent withdrawals, or complaints, please contact:</p>
          <div style={{ background: "#1B2A4A", color: "white", borderRadius: "12px", padding: "20px 24px", fontSize: "14px", lineHeight: "1.8" }}>
            <strong>Orisalign Private Limited</strong><br />
            Grievance Officer (Data Protection): <a href="mailto:hello@orisalign.com" style={{ color: "#C9A84C" }}>hello@orisalign.com</a><br />
            Bhubaneswar – 751016, Odisha
          </div>
          <p style={{ ...s, marginTop: "14px" }}>We aim to respond to all data-related requests within <strong>seven working days</strong>. If you are not satisfied with our response, you may escalate your complaint to the Data Protection Board of India.</p>
        </div>

        <div style={{ textAlign: "center", padding: "16px", background: "#f3f4f6", borderRadius: "10px", fontSize: "12px", color: "#6b7280", fontStyle: "italic" }}>
          This Privacy Policy has been prepared in accordance with the Digital Personal Data Protection Act, 2023; the Information Technology Act, 2000; and applicable rules thereunder. It does not constitute legal advice.<br /><br />
          © 2026 Orisalign Private Limited. All rights reserved.
        </div>

        </div>
      </div>

      <PolicyFooter />
    </div>
  )
}
