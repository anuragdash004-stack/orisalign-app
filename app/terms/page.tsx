import type { Metadata } from "next";
import PolicyFooter from "@/components/PolicyFooter";
import BackButton from "@/components/BackButton";

export const metadata: Metadata = {
  title: "Terms and Conditions | OrisAlign",
  description: "Read OrisAlign's Terms and Conditions, including consent policies, privacy notice, and terms of service for clear aligner treatment in Bhubaneswar, Odisha.",
  keywords: "terms and conditions, privacy notice, consent policy, OrisAlign, clear aligners Bhubaneswar",
  openGraph: {
    title: "Terms and Conditions – OrisAlign",
    description: "OrisAlign Terms and Conditions, Consent Policy and Privacy Notice for clear aligner treatment.",
    url: "https://orisalign.com/terms",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsPage() {
  const s = { color: "#374151", fontSize: "14px", lineHeight: "1.8", marginBottom: "0" }
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
          <h1 style={{ fontSize: "24px", fontWeight: "900", color: "#1B2A4A", margin: "0 0 6px" }}>
            TERMS AND CONDITIONS, CONSENT POLICY<br />AND PRIVACY NOTICE
          </h1>
          <p style={{ color: "#6b7280", fontSize: "13px", margin: "8px 0 0" }}>Version 1.0 &nbsp;•&nbsp; Effective from date of publication</p>
          <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>
            Orisalign Private Limited &nbsp;|&nbsp; MIG-1, 43/5, Housing Board Colony, Chandrasekharpur, Bhubaneswar – 751016, Odisha
          </p>
          <p style={{ color: "#374151", fontSize: "13px", fontStyle: "italic", marginTop: "14px", padding: "12px 16px", background: "#FBF7EE", borderRadius: "8px", border: "1px solid #E8D5A0" }}>
            By proceeding to book an appointment with Orisalign Private Limited, you confirm that you have read, understood, and agree to all terms, conditions, consents, and policies set out in this document. This document is legally binding and applies to all patients, clients, and users of Orisalign Private Limited's services.
          </p>
        </div>

        <div style={{ color: "#374151", fontSize: "14px", lineHeight: "1.8", marginBottom: "28px" }}>
          <p>This document governs all services offered by Orisalign Private Limited, including consultations conducted at the patient's home (Home Consultation), at Orisalign's clinic premises (Clinic Consultation), and via video, audio, or digital messaging (Online / Telemedicine Consultation). By booking an appointment through any channel, you acknowledge that you have read and accepted all provisions of this document in full.</p>
          <p style={{ marginTop: "12px" }}>These terms, consents, and policies are applicable to all patients and clients who book or receive services from Orisalign Private Limited, and to all practitioners who provide services on behalf of Orisalign Private Limited.</p>
          <p style={{ marginTop: "12px" }}>Orisalign Private Limited reserves the right to update these terms from time to time. The current version will always be made available prior to booking.</p>
        </div>

        {/* Section 1 */}
        <div style={sec}>
          <h2 style={h2}>1. ABOUT ORISALIGN PRIVATE LIMITED</h2>
          <p style={s}>Orisalign Private Limited is a healthcare and aesthetic services company registered and operating in the State of Odisha, India. Orisalign provides medical and aesthetic consultations and treatments through trained and qualified practitioners registered with the Odisha Council of Medical Registration (OCMR).</p>
          <p style={{ ...s, marginTop: "10px" }}>All services are delivered in compliance with the National Medical Commission Act, 2019; the Telemedicine Practice Guidelines, 2020; the Odisha Council of Medical Registration Act, 1916 (as amended 2010); the Indian Medical Council (Professional Conduct, Etiquette and Ethics) Regulations, 2002; the Consumer Protection Act, 2019; the Digital Personal Data Protection Act, 2023; and the Information Technology Act, 2000.</p>
          <p style={{ ...s, marginTop: "10px" }}><strong>Registered Office:</strong> MIG-1, 43/5, Housing Board Colony, Chandrasekharpur, Bhubaneswar – 751016, Odisha. &nbsp;<strong>Contact:</strong> hello@orisalign.com</p>
        </div>

        {/* Section 2 */}
        <div style={sec}>
          <h2 style={h2}>2. ELIGIBILITY</h2>
          <p style={{ ...s, marginBottom: "10px" }}>By booking an appointment, you confirm and warrant that:</p>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {["You are 18 years of age or older, or that you are the parent or legal guardian of a patient who is under 18 years of age and that you are booking on their behalf with full authority to give consent.", "You are of sound mind and are entering into this agreement freely and voluntarily, without coercion or undue pressure.", "All information you provide during the booking process and during consultations is truthful, accurate, and complete to the best of your knowledge.", "You understand that providing false, incomplete, or misleading information may compromise the safety of the services provided and may reduce Orisalign Private Limited's liability for any resulting adverse outcomes."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <p style={{ ...s, marginTop: "10px" }}>Orisalign Private Limited reserves the right to decline to provide a consultation or treatment at its sole discretion where it is clinically, ethically, legally, or professionally inappropriate, without being required to give a reason.</p>
        </div>

        {/* Section 3 */}
        <div style={sec}>
          <h2 style={h2}>3. CONSULTATION TYPES AND APPLICABLE TERMS</h2>
          <p style={s}>Orisalign Private Limited offers three modes of consultation. The terms specific to each mode are set out below and apply in addition to all general terms in this document.</p>
          <h3 style={h3}>3.1 Home Consultation</h3>
          <p style={{ ...s, marginBottom: "8px" }}>A Home Consultation involves a practitioner from Orisalign Private Limited travelling to the patient's specified residential address to conduct a consultation and/or treatment.</p>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {["By booking a Home Consultation, the patient voluntarily invites the practitioner to their private residence for the sole purpose of the agreed consultation or treatment.", "The visiting practitioner will carry a valid OCMR-registered photo identity. The patient has the right to verify the practitioner's credentials before permitting entry.", "The patient is responsible for ensuring a safe, reasonably clean, adequately lit, and accessible environment for the consultation or procedure.", "Orisalign Private Limited and its practitioners are not liable for treatment limitations or adverse outcomes arising directly from environmental conditions at the patient's premises.", "Other persons present at the premises during the visit are present with the patient's knowledge and consent.", "A travel or home visit fee may be charged in addition to the consultation fee. This will be disclosed at the time of booking.", "In the event of a medical emergency during a home visit, the practitioner will contact emergency services immediately (Dial 112, Odisha State Emergency)."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <h3 style={h3}>3.2 Clinic Consultation</h3>
          <p style={{ ...s, marginBottom: "8px" }}>A Clinic Consultation involves the patient attending the Orisalign clinic premises at MIG-1, 43/5, Housing Board Colony, Chandrasekharpur, Bhubaneswar – 751016, Odisha.</p>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {["Patients are expected to present themselves at the clinic at their agreed appointment date and time. Late arrivals may result in a reduced appointment duration or rescheduling.", "All procedures performed at the clinic are carried out by OCMR-registered practitioners or directly under their supervision.", "Patients are expected to conduct themselves respectfully towards all clinic staff and other patients at all times.", "Orisalign Private Limited is not liable for the loss of personal belongings on clinic premises.", "For infection control or clinical safety reasons, the clinic may request that a patient attend without companions."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <h3 style={h3}>3.3 Online / Telemedicine Consultation</h3>
          <p style={{ ...s, marginBottom: "8px" }}>An Online or Telemedicine Consultation is conducted via video call, audio call, or digital messaging, in accordance with the Telemedicine Practice Guidelines, 2020.</p>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {["By booking an online consultation, the patient gives explicit consent to receive the consultation via the agreed telemedicine medium.", "The practitioner will identify themselves by name, qualification, and OCMR registration number at the start of every telemedicine session.", "The patient must be physically located within India at the time of the telemedicine consultation.", "Telemedicine consultation is not a substitute for an in-person clinical examination. Diagnoses and treatment recommendations issued via telemedicine may be provisional.", "Neither the patient nor the practitioner may record a telemedicine session without the prior explicit consent of the other party.", "Orisalign Private Limited is not liable for outcomes attributable to internet connectivity failures, device limitations, or third-party platform issues."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
        </div>

        {/* Section 4 */}
        <div style={sec}>
          <h2 style={h2}>4. INFORMED CONSENT FOR MEDICAL AND AESTHETIC TREATMENT</h2>
          <p style={{ ...s, marginBottom: "8px" }}>By booking an appointment, the patient acknowledges that prior to any treatment being performed, the treating practitioner will explain or has explained the following:</p>
          <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
            {["The nature and purpose of the proposed treatment or procedure.", "The expected benefits and realistic outcomes of the treatment.", "The potential risks, side effects, and possible complications including rare but serious ones.", "Available alternative treatments including the option of no treatment.", "The estimated cost of the treatment.", "Post-treatment aftercare instructions and the expected recovery period.", "The patient's right to refuse or withdraw consent at any time before a procedure begins, without penalty."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <p style={{ ...s, marginBottom: "8px" }}>The patient acknowledges and agrees that:</p>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {["They have disclosed or will disclose their complete and accurate medical history to the practitioner before each treatment.", "Results of aesthetic and medical treatments vary from person to person. No specific outcome has been or will be guaranteed to any patient.", "Potential side effects may include but are not limited to redness, swelling, bruising, discomfort, pigmentation changes, and allergic reactions.", "Consent for treatment is ongoing. Any patient may withdraw consent at any time before a procedure begins."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <p style={{ ...s, marginTop: "10px" }}>For patients under 18 years of age, all disclosures will be made to the parent or legal guardian, who must be present throughout the consultation and treatment.</p>
        </div>

        {/* Section 5 */}
        <div style={sec}>
          <h2 style={h2}>5. PHOTOGRAPHY AND MEDIA CONSENT</h2>
          <p style={s}>Photography consent is entirely optional and is separate from treatment consent. A patient's decision regarding photography in no way affects the quality of care or treatment they receive.</p>
          {[{ t: "5.1 Clinical Documentation", b: "Photographs taken solely for clinical documentation purposes are stored as part of the patient's medical record. They are used exclusively for tracking treatment progress and are never shared externally without additional specific consent." }, { t: "5.2 Educational Use", b: "Where a patient has specifically consented to educational use, photographs may be shared on an anonymous basis with qualified medical professionals for training or peer review purposes." }, { t: "5.3 Promotional Use with Identity Protection", b: "Where a patient has consented to promotional use with identity protection, before-and-after images may be used on Orisalign's website or social media. The patient's face will be masked or cropped, and no identifying information will be included." }, { t: "5.4 Promotional Use with Full Identity", b: "Where a patient consents to promotional use with their full identity, this requires a separate written Testimonial and Media Release Form. No identifiable content will be published without this additional consent." }].map((item, i) => (<div key={i}><h3 style={h3}>{item.t}</h3><p style={s}>{item.b}</p></div>))}
          <h3 style={h3}>5.5 Patient Rights Regarding Photography</h3>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {["Any photography consent given may be withdrawn at any time by written request to hello@orisalign.com. Future use of photographs will cease within 30 days.", "Promotional content already published before the date of a withdrawal request cannot be retroactively removed but will be excluded from future publications.", "Patients may request access to or deletion of photographs held in their clinical file, subject to mandatory clinical record-keeping requirements."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
        </div>

        {/* Section 6 */}
        <div style={sec}>
          <h2 style={h2}>6. COMMUNICATION CONSENT</h2>
          <p style={s}>By booking an appointment, all patients and clients agree that Orisalign Private Limited may contact them through the following channels:</p>
          <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
            {["Phone calls — for appointment confirmations, reminders, follow-up care, and service-related communications.", "SMS and text messages — for appointment reminders, booking confirmations, and service updates.", "WhatsApp — for appointment communications, treatment information, and general service updates.", "Email — for appointment confirmations, consultation summaries, invoices, and promotional communications."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <p style={{ ...s, marginTop: "10px" }}>Any patient may opt out of promotional communications at any time by sending a written request to hello@orisalign.com or by responding STOP to any SMS or WhatsApp message. Opting out will not affect appointment-related or clinical communications. Orisalign Private Limited will not share any patient's contact details with third parties for their independent marketing purposes.</p>
        </div>

        {/* Section 7 */}
        <div style={sec}>
          <h2 style={h2}>7. DATA PROTECTION AND PRIVACY POLICY</h2>
          <p style={{ ...s, fontStyle: "italic", marginBottom: "10px" }}>Governed by the Digital Personal Data Protection Act, 2023. Orisalign Private Limited operates as a Data Fiduciary under this Act.</p>
          {[{ t: "7.1 Data collected and purposes", items: ["Personal identifiers (name, date of birth, address, phone, email): Used for patient identification, appointment booking, record-keeping, and billing.", "Sensitive health data (medical history, medications, allergies, clinical notes, treatment records): Used for safe treatment planning and clinical documentation.", "Visual data (photographs and video stills): Used for clinical documentation and, where specifically consented to, for educational or promotional purposes.", "Financial and payment data: Used for invoicing and GST compliance. Full card details are never stored.", "Communication data: Used for service delivery, follow-up care, and promotional communications where consented to."] }, { t: "7.2 Legal basis for processing", text: "Personal data is processed on the basis of the patient's consent, given at the time of booking, and in fulfilment of Orisalign Private Limited's legal and professional obligations as a healthcare service provider under applicable Indian law." }, { t: "7.3 Data retention", items: ["Medical records are retained for a minimum of three years from the date of the patient's last treatment.", "Photographs are retained for the duration covered by the patient's photography consent.", "Financial records are retained for the period required under applicable GST and tax legislation.", "After the applicable retention period, data is securely and permanently deleted."] }, { t: "7.4 Data security", text: "All patient data is stored with encrypted access controls. Digital records are accessible only to authorised Orisalign Private Limited personnel. All staff and practitioners are bound by confidentiality obligations. In the event of a personal data breach, affected patients and the Data Protection Board of India will be notified without undue delay." }, { t: "7.5 Patient rights under the DPDP Act, 2023", items: ["Right to Access: Any patient may request a copy of all personal data held about them.", "Right to Correction: Any patient may request that inaccurate or incomplete personal data be corrected.", "Right to Erasure: Any patient may request deletion of their personal data, subject to mandatory legal record-retention obligations.", "Right to Withdraw Consent: Any consent given may be withdrawn at any time.", "Right to Grievance Redressal: Any patient may raise a data protection concern at hello@orisalign.com or file a complaint with the Data Protection Board of India."] }].map((item: any, i) => (<div key={i}><h3 style={h3}>{item.t}</h3>{item.text && <p style={s}>{item.text}</p>}{item.items && <ul style={{ paddingLeft: "20px", margin: 0 }}>{item.items.map((t: string, j: number) => <li key={j} style={li}>{t}</li>)}</ul>}</div>))}
          <p style={{ ...s, marginTop: "10px" }}>All data protection enquiries and requests may be directed to: <strong>hello@orisalign.com</strong></p>
        </div>

        {/* Section 8 */}
        <div style={sec}>
          <h2 style={h2}>8. MINOR PATIENTS</h2>
          <p style={{ ...s, marginBottom: "8px" }}>Where services are sought for a patient under 18 years of age, the following terms apply:</p>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {["A parent or legal guardian must book the appointment on behalf of the minor and must agree to these terms on the minor's behalf.", "The parent or legal guardian must be physically present throughout all home and clinic consultations involving a minor patient.", "Written consent from the parent or legal guardian will be required before any treatment is performed on a minor patient.", "All photography and communication consents for minor patients are given by and managed through the parent or legal guardian.", "Once a patient reaches 18 years of age, their independent consent is required for all future appointments, treatments, and communications.", "Aesthetic procedures will only be performed on minor patients where clinically appropriate and in accordance with NMC and OCMR professional ethical standards."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
        </div>

        {/* Section 9 */}
        <div style={sec}>
          <h2 style={h2}>9. TERMS OF SERVICE</h2>
          {[{ t: "9.1 Professional standards", text: "All services provided by Orisalign Private Limited are delivered by or under the direct supervision of practitioners registered with the Odisha Council of Medical Registration (OCMR)." }, { t: "9.2 No guarantee of results", text: "Aesthetic and medical treatments do not guarantee specific outcomes. Results vary depending on individual physiology, lifestyle, age, adherence to aftercare instructions, and other factors beyond Orisalign Private Limited's control. No warranty, express or implied, is made regarding the achievement of any specific result." }, { t: "9.3 Aftercare", text: "All patients are responsible for following the post-treatment aftercare instructions provided by the treating practitioner. Orisalign Private Limited will not be held liable for complications or unsatisfactory outcomes arising directly from a patient's non-compliance with aftercare instructions." }, { t: "9.4 Payment", text: "All fees for services are as agreed at the time of booking and will be confirmed in writing prior to the appointment. For information regarding cancellations and refunds, please refer to the Refund Policy published on the Orisalign Private Limited website." }, { t: "9.5 Limitation of liability", text: "To the maximum extent permitted under applicable Indian law, Orisalign Private Limited's aggregate liability to any patient shall not exceed the total fees paid by that patient for the specific consultation or treatment session in connection with which the liability arises." }, { t: "9.6 Governing law and jurisdiction", text: "These terms and conditions are governed by the laws of India and the State of Odisha. Any disputes shall be subject to the exclusive jurisdiction of the competent courts in Bhubaneswar, Odisha." }].map((item, i) => (<div key={i}><h3 style={h3}>{item.t}</h3><p style={s}>{item.text}</p></div>))}
        </div>

        {/* Section 10 */}
        <div style={sec}>
          <h2 style={h2}>10. DISCLAIMERS</h2>
          {[{ t: "10.1 No guarantee of results", text: "Aesthetic and medical treatments are not an exact science. No representations, warranties, or guarantees of specific outcomes are made or implied by Orisalign Private Limited. Photographs and case studies are illustrative of possible outcomes and are not promises of results." }, { t: "10.2 Limitations of telemedicine", text: "Physical examination cannot be performed via telemedicine. Diagnoses and treatment recommendations issued through telemedicine may be provisional and subject to revision following an in-person assessment." }, { t: "10.3 Home environment", text: "Orisalign Private Limited is not liable for treatment limitations or adverse outcomes arising from environmental conditions at a patient's home premises, including inadequate lighting, limited space, hygiene conditions, or domestic interruptions." }, { t: "10.4 Not a substitute for emergency or primary care", text: "Orisalign Private Limited's services are elective and do not replace hospital-based care, emergency medical services, or a patient's primary care physician. In any medical emergency, patients should call 112 (Odisha State Emergency) immediately." }, { t: "10.5 Regulatory compliance", text: "Orisalign Private Limited's services are provided in compliance with the National Medical Commission Act, 2019; the Telemedicine Practice Guidelines, 2020; the Consumer Protection Act, 2019; the Digital Personal Data Protection Act, 2023; and the Information Technology Act, 2000." }].map((item, i) => (<div key={i}><h3 style={h3}>{item.t}</h3><p style={s}>{item.text}</p></div>))}
        </div>

        {/* Section 11 */}
        <div style={sec}>
          <h2 style={h2}>11. ACCEPTANCE OF THESE TERMS</h2>
          <p style={{ ...s, marginBottom: "10px" }}>By clicking 'I Agree' or by proceeding to book an appointment, you confirm that:</p>
          <ul style={{ paddingLeft: "20px", margin: "0 0 14px" }}>
            {["You have read this entire document in full, including all terms, conditions, consents, and policies.", "You understand the nature, scope, and limitations of the services provided by Orisalign Private Limited.", "You consent to the receipt of home, clinic, or online consultations and treatments as applicable to your booking.", "You consent to the collection, storage, and processing of your personal data for the purposes described in Section 7.", "You consent to being contacted through phone calls, SMS, WhatsApp, and email for the purposes described in Section 6.", "You are 18 years of age or older, or are the legal guardian of a minor patient, and are entering into this agreement freely and voluntarily.", "You accept that this agreement is legally binding and is governed by the laws of India and the State of Odisha."].map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
          <p style={s}>If you do not agree with any part of this document, you must not proceed with booking an appointment.</p>
        </div>

        {/* Contact box */}
        <div style={{ background: "#1B2A4A", color: "white", borderRadius: "12px", padding: "20px 24px", fontSize: "14px", lineHeight: "1.8", marginBottom: "20px" }}>
          <strong>For all queries, concerns, or data protection requests, contact:</strong><br />
          Orisalign Private Limited<br />
          MIG-1, 43/5, Housing Board Colony, Chandrasekharpur, Bhubaneswar – 751016, Odisha, India<br />
          <a href="mailto:hello@orisalign.com" style={{ color: "#C9A84C" }}>hello@orisalign.com</a>
        </div>

        <div style={{ textAlign: "center", padding: "16px", background: "#f3f4f6", borderRadius: "10px", fontSize: "12px", color: "#6b7280" }}>
          This is a legally binding document. Please retain a copy for your records.<br />
          © 2026 Orisalign Private Limited. All rights reserved.
        </div>

        </div>
      </div>

      <PolicyFooter />
    </div>
  )
}
