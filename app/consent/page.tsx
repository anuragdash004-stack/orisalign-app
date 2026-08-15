import type { Metadata } from "next";
import PolicyFooter from "@/components/PolicyFooter";
import BackButton from "@/components/BackButton";

export const metadata: Metadata = {
  title: "Informed Consent for Orthodontic Treatment | OrisAlign",
  description: "OrisAlign's Informed Consent for Orthodontic Treatment — Clear Aligner Therapy.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConsentPage() {
  const s = { color: "#374151", fontSize: "14px", lineHeight: "1.8", marginBottom: "0" }
  const h2 = { fontSize: "17px", fontWeight: "800" as const, color: "#1B2A4A", borderBottom: "1px solid #e5e7eb", paddingBottom: "8px", marginBottom: "14px", marginTop: "0" }
  const h3 = { fontSize: "14px", fontWeight: "700" as const, color: "#C9A84C", marginBottom: "8px", marginTop: "16px" }
  const li = { ...s, marginBottom: "8px" }
  const sec = { marginBottom: "32px" }

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: "820px", margin: "0 auto", padding: "40px 20px", width: "100%", flex: 1 }}>

        <BackButton />

        <div style={{ padding: "0 0 80px" }}>

          {/* Header */}
          <div style={{ textAlign: "center", borderBottom: "2px solid #1B2A4A", paddingBottom: "24px", marginBottom: "36px" }}>
            <img src="/logo2.png" alt="OrisAlign" style={{ height: "48px", marginBottom: "16px", mixBlendMode: "multiply" }} />
            <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#1B2A4A", margin: "0 0 6px" }}>
              INFORMED CONSENT FOR ORTHODONTIC TREATMENT<br />— CLEAR ALIGNER THERAPY
            </h1>
            <p style={{ color: "#6b7280", fontSize: "13px", margin: "8px 0 0" }}>Document Ref: ORI/CONSENT/02 &nbsp;•&nbsp; Version 1.0</p>
            <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>
              Orisalign Private Limited &nbsp;|&nbsp; CIN: U32501OD2026PTC053289 &nbsp;|&nbsp; GSTIN: 21AAFCO1245F1Z0
            </p>
            <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "2px" }}>
              MIG-1, 43/5, Housing Board Colony, Chandrasekharpur, Bhubaneswar – 751016, Odisha
            </p>
            <p style={{ color: "#374151", fontSize: "13px", fontStyle: "italic", marginTop: "14px", padding: "12px 16px", background: "#FBF7EE", borderRadius: "8px", border: "1px solid #E8D5A0" }}>
              This document constitutes a legally binding consent under Indian law.
            </p>
          </div>

          {/* Section 1 */}
          <div style={sec}>
            <h2 style={h2}>1. PURPOSE OF THIS CONSENT</h2>
            <p style={s}>This document is the formal informed consent issued by Orisalign Private Limited (&quot;Orisalign&quot;) to every patient who has received a treatment plan and is proceeding with clear aligner orthodontic treatment. This consent must be accepted before the first set of aligners is issued or any active orthodontic treatment begins.</p>
            <p style={{ ...s, marginTop: "10px" }}>By accepting this consent, you confirm that Orisalign&apos;s supervising consultant orthodontist has presented you with a personalised treatment plan; that you have understood the nature, expected outcomes, risks, limitations, and your own responsibilities in this treatment; and that you voluntarily choose to commence treatment.</p>
          </div>

          {/* Section 2 */}
          <div style={sec}>
            <h2 style={h2}>2. ABOUT CLEAR ALIGNER TREATMENT</h2>
            <h3 style={h3}>2.1 What Clear Aligners Are</h3>
            <p style={s}>Clear aligners are a series of custom-fabricated, removable, transparent orthodontic trays designed to move teeth progressively into a planned position. Orisalign&apos;s aligners are fabricated from medical-grade thermoplastic material and are designed by a qualified MDS Orthodontist based on your individual intraoral scan and diagnostic records.</p>
            <h3 style={h3}>2.2 How Treatment Progresses</h3>
            <p style={s}>Treatment is delivered as a sequence of aligner sets. Each set is worn for approximately 15 days before progressing to the next. The number of sets required depends on the complexity of your case and is specified in your individual treatment plan. Aligners must be worn for 20 to 22 hours per day for treatment to progress as planned.</p>
            <h3 style={h3}>2.3 When to Remove Aligners</h3>
            <p style={s}>Aligners should only be removed when eating, drinking anything other than plain water, brushing teeth, and flossing. They must be reinserted immediately after. Failure to wear aligners for the prescribed hours per day is the most common cause of delayed treatment or suboptimal outcomes.</p>
            <h3 style={h3}>2.4 Duration of Treatment</h3>
            <p style={s}>Treatment duration varies by case. The estimate provided in your treatment plan is based on your diagnostic data and represents the planned trajectory under full compliance. Actual duration may be shorter or longer depending on your response to treatment and adherence to wear instructions.</p>
          </div>

          {/* Section 3 */}
          <div style={sec}>
            <h2 style={h2}>3. ORISALIGN&apos;S CLINICAL MODEL — REMOTE SUPERVISION</h2>
            <p style={s}>Orisalign operates a clinically supervised D2C model. Your aligners are designed by a qualified MDS Orthodontist. Scheduled physical check-in visits are conducted by a qualified BDS clinician (Orisalign&apos;s city dentist) at a registered clinic or at your location as clinically appropriate.</p>
            <p style={{ ...s, marginTop: "10px" }}>All invasive in-treatment procedures — including interproximal reduction (IPR) and attachment bonding — are performed exclusively at registered partner clinic premises by Orisalign&apos;s qualified clinician. Orisalign does not perform any invasive procedure at a patient&apos;s home.</p>
            <p style={{ ...s, marginTop: "10px" }}>In the event of any aligner-related concern, discomfort, breakage, or clinical query during treatment, Orisalign&apos;s clinical support team will respond within 24 to 48 hours of being notified.</p>
          </div>

          {/* Section 4 */}
          <div style={sec}>
            <h2 style={h2}>4. IN-TREATMENT PROCEDURES THAT MAY APPLY</h2>
            <p style={{ ...s, marginBottom: "10px" }}>Depending on your treatment plan, one or more of the following supplementary procedures may be required during the course of your treatment:</p>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              <li style={li}><strong>Interproximal Reduction (IPR):</strong> This involves the controlled removal of a very small and clinically insignificant amount of enamel from the sides of specific teeth to create the space required for tooth movement. IPR is a standard, widely accepted orthodontic procedure. The amount removed is minimal and is performed by a qualified clinician using precision instruments. You will be informed in advance if IPR is required in your plan. IPR is a permanent and irreversible procedure.</li>
              <li style={li}><strong>Tooth-Coloured Attachments:</strong> Small tooth-coloured composite resin bumps may be bonded to the surface of specific teeth to assist the aligner in gripping and moving them in the planned direction. Attachments are temporary and will be removed by a clinician upon completion of active treatment. They do not damage the tooth enamel when correctly placed and removed.</li>
              <li style={li}><strong>Refinements:</strong> After completion of the originally planned aligner sets, additional aligner sets (refinements) may be required to complete the final tooth positions. Whether refinements are included in or separate from your treatment fee will have been communicated to you as part of your treatment plan.</li>
              <li style={li}><strong>Retainers:</strong> Following completion of active aligner treatment, retainers must be worn as instructed by the orthodontist — typically at night — to prevent teeth from returning toward their original position. Retention is a lifelong commitment. Orisalign is not responsible for relapse or reversal of treatment outcomes resulting from non-compliance with prescribed retainer wear.</li>
            </ul>
          </div>

          {/* Section 5 */}
          <div style={sec}>
            <h2 style={h2}>5. RISKS, LIMITATIONS &amp; DISCLOSURES</h2>
            <p style={{ ...s, marginBottom: "10px" }}>Orisalign is required to inform every patient of the following known risks, limitations, and important disclosures associated with clear aligner orthodontic treatment. By accepting this consent, you confirm that you have been made aware of all of the following:</p>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              {[
                "Clear aligner therapy may not be suitable for all orthodontic conditions. Severely complex malocclusions, cases requiring surgical intervention, or cases involving active gum disease or significant bone loss may not be treatable with aligners alone. Orisalign will advise you if your case requires a different treatment modality.",
                "Treatment outcomes depend significantly on patient compliance. Wearing aligners for fewer than 20 hours per day consistently will delay treatment and may result in the treatment plan requiring revision, additional aligner sets at additional cost, or in some cases treatment being unable to be completed as originally planned.",
                "The simulated or animated treatment outcome (‘ClinCheck’ or equivalent simulation) provided as part of your treatment plan is a predictive tool and an approximation. It is not a guarantee of the exact clinical outcome. Actual tooth movement may differ from the simulation.",
                "Temporary discomfort, pressure, or soreness is a normal and expected response — particularly when first wearing aligners and when transitioning to a new aligner set. This typically resolves within 2 to 4 days per set change.",
                "Some patients experience a minor temporary speech change (slight lisp) when first wearing aligners. This typically resolves within 1 to 2 weeks as the tongue adapts.",
                "Increased salivation is a common and temporary experience when first wearing aligners.",
                "Aligners may be lost or broken. Replacement of lost or broken aligners may be chargeable. Aligners must be stored in their protective case when not in use and must not be exposed to heat, as heat will warp and render them ineffective.",
                "IPR, where required, involves permanent and irreversible removal of a small amount of tooth enamel. Although the amount removed is clinically safe and standard, patients must understand the permanent nature of this step before it is performed.",
                "Root resorption — a shortening of tooth roots — is a known but rare complication of all orthodontic treatment including clear aligner therapy. Its occurrence and severity are unpredictable and may be influenced by factors unrelated to treatment quality.",
                "Gum health and alveolar bone levels may be affected during or after orthodontic treatment. Patients with pre-existing gum disease must ensure it is treated and in a stable state before aligner treatment commences. Orisalign will not commence treatment in the presence of active, untreated gum disease.",
                "Teeth naturally tend to return toward their original position after orthodontic treatment if retainers are not worn as prescribed. This relapse is a biological phenomenon and is not a failure of treatment. Orisalign is not liable for relapse caused by non-compliance with retainer instructions.",
                "Orisalign does not guarantee any specific aesthetic or clinical outcome. The treatment plan represents the best professional judgement of the supervising consultant dentist/orthodontist based on diagnostic data available at the time of planning.",
                "Any deciduous teeth if present might show signs of mobility or come out of socket.",
              ].map((t, i) => <li key={i} style={li}>{t}</li>)}
            </ul>
          </div>

          {/* Section 6 */}
          <div style={sec}>
            <h2 style={h2}>6. PATIENT RESPONSIBILITIES</h2>
            <p style={{ ...s, marginBottom: "10px" }}>By accepting this consent, you commit to the following responsibilities for the entire duration of your treatment:</p>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              {[
                "Wearing aligners for 20 to 22 hours per day as instructed, without exception.",
                "Removing aligners only for eating, drinking (other than water), brushing, and flossing.",
                "Maintaining excellent oral hygiene — brushing teeth thoroughly after every meal before reinserting aligners, and flossing daily.",
                "Cleaning aligners as instructed — gently with a soft toothbrush and lukewarm water. Hot water, toothpaste, and coloured mouthwash must not be used on aligners as they can damage or stain them.",
                "Attending all scheduled clinical check-in visits and supervision appointments as advised by Orisalign.",
                "Reporting any clinical concern, discomfort, aligner breakage, or tooth sensitivity to Orisalign promptly through the designated contact channel.",
                "Not altering, cutting, filing, or modifying the aligners in any way.",
                "Wearing retainers as prescribed by the orthodontist following completion of active aligner treatment.",
                "Informing Orisalign promptly of any change in your medical condition, new medication, pregnancy, or any other health development that may be relevant to your ongoing treatment.",
              ].map((t, i) => <li key={i} style={li}>{t}</li>)}
            </ul>
          </div>

          {/* Section 7 */}
          <div style={sec}>
            <h2 style={h2}>7. FINANCIAL TERMS &amp; REFUND POLICY</h2>
            <p style={s}>7.1 Treatment is provided on the financial terms communicated to you at the time of your treatment plan presentation, including total fees, payment schedule, and applicable subscription or instalment structure.</p>
            <p style={{ ...s, marginTop: "10px" }}>7.2 Clear aligners are custom-fabricated to your individual dental anatomy. Fees paid for aligners that have already been fabricated and dispatched to you are non-refundable, as these cannot be reused or resupplied to any other patient.</p>
            <p style={{ ...s, marginTop: "10px" }}>7.3 In the event that Orisalign determines, based on clinical grounds, that treatment cannot safely or effectively continue, an appropriate refund will be calculated based on the stage of treatment reached, in accordance with Orisalign&apos;s refund policy available at <a href="https://www.orisalign.com" style={{ color: "#b8905a" }}>www.orisalign.com</a>.</p>
            <p style={{ ...s, marginTop: "10px" }}>7.4 Any pre-treatment dental procedures required to be completed before aligner treatment can commence — such as fillings, extractions, scaling, or gum treatment — are not included in the aligner treatment fee and will be charged separately.</p>
            <p style={{ ...s, marginTop: "10px" }}>7.5 If treatment discontinuation is initiated by the patient without clinical cause, no refund will be applicable for aligners already fabricated, whether delivered or not, as these are custom-manufactured exclusively for your case.</p>
          </div>

          {/* Section 8 */}
          <div style={sec}>
            <h2 style={h2}>8. PHOTOGRAPHY &amp; TESTIMONIAL</h2>
            <p style={s}>Clinical photographs taken during the course of your treatment are maintained as confidential clinical records. They will not be used for any commercial, marketing, advertising, or social media purpose without your separate explicit written consent obtained at the relevant time.</p>
            <p style={{ ...s, marginTop: "10px" }}>Any request for a testimonial, before-and-after case study publication, or video testimonial will be sought separately and will be entirely voluntary. Your treatment, clinical care, and relationship with Orisalign will not be affected in any way by your choice in this regard.</p>
          </div>

          {/* Section 9 */}
          <div style={sec}>
            <h2 style={h2}>9. DATA PROTECTION (DPDP ACT, 2023)</h2>
            <p style={{ ...s, marginBottom: "10px" }}>Orisalign processes your personal and clinical data as a Data Fiduciary under the Digital Personal Data Protection Act, 2023. By accepting this consent, you acknowledge that:</p>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              {[
                "Your personal data — including scan files, clinical photographs, treatment records, case correspondence, and payment records — is stored securely in Orisalign's internal patient management system.",
                "Access to your data is limited to: the supervising consultant orthodontist, the attending city dentist, and Orisalign's clinical and administrative personnel on a strict need-to-know basis.",
                "Your treatment data will be retained for a minimum of seven years from the date of your last treatment interaction, in compliance with applicable medical records regulations.",
                "You retain the right to access, correct, and request erasure of your personal data (subject to mandatory retention obligations) by writing to anurag@orisalign.com.",
              ].map((t, i) => <li key={i} style={li}>{t}</li>)}
            </ul>
          </div>

          {/* Section 10 */}
          <div style={sec}>
            <h2 style={h2}>10. PATIENT DECLARATION</h2>
            <p style={{ ...s, marginBottom: "10px" }}>By accepting this consent, you declare that:</p>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              {[
                "You have read this entire consent document carefully, or it has been read to you and explained in a language you fully understand.",
                "You have had the opportunity to ask questions about your treatment plan, expected outcomes, risks, and obligations, and all your questions have been answered to your satisfaction.",
                "You understand and accept the nature, risks, limitations, and alternatives to clear aligner treatment as described in this document.",
                "You understand that the simulated treatment outcome is a planning tool and not a clinical guarantee.",
                "You voluntarily and freely consent to commencing clear aligner orthodontic treatment as planned by Orisalign's supervising consultant orthodontist.",
                "You have not been pressured, coerced, or misled in any way in arriving at this decision.",
                "You consent to Orisalign collecting, processing, and retaining your personal and clinical data as described in Section 9 of this document.",
                "You accept and commit to all patient responsibilities listed in Section 6 of this document.",
                "You understand and accept the financial terms and refund policy described in Section 7.",
                "If you are below 18 years of age, this consent is being accepted by your parent or legal guardian who confirms they have full legal authority to consent on your behalf.",
              ].map((t, i) => <li key={i} style={li}>{t}</li>)}
            </ul>
          </div>

          {/* Section 11 */}
          <div style={sec}>
            <h2 style={h2}>11. GOVERNING LAW &amp; JURISDICTION</h2>
            <p style={s}>This consent document is governed by the laws of India, including but not limited to the Dentists Act, 1948; the Consumer Protection Act, 2019; the Digital Personal Data Protection Act, 2023; the Information Technology Act, 2000; and all applicable dental ethics regulations prescribed by the Dental Council of India. Any dispute arising from or relating to this consent or the treatment provided by Orisalign shall be subject to the exclusive jurisdiction of the competent courts at Bhubaneswar, Odisha.</p>
          </div>

          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "12px", marginTop: "40px" }}>
            <p style={{ margin: 0 }}>Orisalign Private Limited &nbsp;|&nbsp; hello@orisalign.com &nbsp;|&nbsp; www.orisalign.com</p>
            <p style={{ margin: "4px 0 0" }}>Document Ref: ORI/CONSENT/02 &nbsp;|&nbsp; Version 1.0 &nbsp;|&nbsp; © 2026 Orisalign Private Limited. All rights reserved.</p>
          </div>

        </div>
      </div>
      <PolicyFooter />
    </div>
  );
}
