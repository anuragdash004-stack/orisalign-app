'use client'
import { useState } from 'react'
import Link from 'next/link'

// ── Clinical health-tech palette ──
const INK = '#13181B'
const INK2 = '#5A656B'
const GOLD = '#B8905A'
const GOLDD = '#946F3F'
const MINT = '#EAF3EE'
const MINTD = '#3F9B79'
const LINE = '#E6E9EA'
const CARD_SHADOW = '0 30px 60px -34px rgba(19,24,27,.4)'

const NAV_LINKS = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Before & After', href: '#gallery' },
  { label: 'OrisPromise', href: '#orispromise' },
  { label: 'FAQs', href: '#faq' },
]

const COMPARISON = [
  { feature: 'Visibility', orisalign: 'Invisible', braces: 'Very visible', invisalign: 'Nearly invisible' },
  { feature: 'Monthly cost', orisalign: '₹4,999/mo*', braces: '₹4,999/mo*', invisalign: '₹9,999/mo*' },
  { feature: 'Total cost', orisalign: 'No minimum price', braces: '₹30–40K*', invisalign: '₹1.5L–3L*' },
  { feature: 'Treatment time', orisalign: '6–12 months*', braces: '12–36 months*', invisalign: '6–12 months*' },
  { feature: 'Removable', orisalign: '✓ Yes', braces: '✗ No', invisalign: '✓ Yes' },
  { feature: 'Food restrictions', orisalign: 'None', braces: 'Many', invisalign: 'None' },
  { feature: 'Made in India', orisalign: '✓ Yes', braces: '✓ Yes', invisalign: '✗ Imported' },
  { feature: 'Doctor supervised', orisalign: '✓ Always', braces: '✓ Always', invisalign: '✓ Always' },
  { feature: 'Transparent Pricing', orisalign: '✓ Yes', braces: '✗ No', invisalign: '✗ No' },
  { feature: 'Clinic', orisalign: 'Personal clinic', braces: 'Varies', invisalign: '✗ No' },
  { feature: '24/7 Support', orisalign: '✓ Yes', braces: '✗ No', invisalign: '✗ No' },
  { feature: 'Waiting period', orisalign: '15 days', braces: '15 days', invisalign: '1.5–2 months' },
]

// Serviceable pincodes — Bhubaneswar (751xxx) and Cuttack city (753xxx) only
const SERVICEABLE_PINCODES = new Set([
  '751001', '751002', '751003', '751004', '751005', '751006', '751007', '751008', '751009', '751010',
  '751011', '751012', '751013', '751014', '751015', '751016', '751017', '751018', '751019', '751020',
  '751021', '751022', '751023', '751024', '751025', '751030',
  '753001', '753002', '753003', '753004', '753006', '753007', '753008', '753009', '753010',
  '753011', '753012', '753013', '753014', '753015',
])

const STEPS = [
  { icon: '🦷', title: 'Consultation', desc: 'Visit our clinic or book a home consultation. Our expert dentist reviews your teeth — at just ₹199 (regular price ₹599).' },
  { icon: '📡', title: '3D Scan', desc: 'A quick, painless 3D scan of your teeth. No moulds. Done in minutes.' },
  { icon: '📋', title: 'Planning', desc: 'Your provisional plan is shared immediately. 48 hours within enrolling, the final treatment plan and duration will be given.' },
  { icon: '📦', title: 'Aligners Delivered', desc: 'Your custom aligners are manufactured in India and delivered to you in just 15 days.' },
  { icon: '😁', title: 'Smile in 6 Months*', desc: 'Wear aligners 20–22 hrs/day, swap sets every 2 weeks. Track progress with monthly check-ins and 24/7 support.' },
]

const FAQS = [
  { q: 'How much do OrisAlign aligners cost?', a: 'Treatment costs ₹4,999 per month* (EMI available). *Final pricing and duration depend on your individual teeth condition, confirmed after your 3D scan. We give a full quote after the consultation — no surprises.' },
  { q: 'Are OrisAlign aligners as effective as other imported brands?', a: 'OrisAlign uses the most advanced clear aligner technology, manufactured in India to international standards, supervised by expert dentists. OrisAlign uses the most premium materials to manufacture its aligners and is completely transparent about its cost.' },
  { q: 'How long does treatment take?', a: 'Most cases: 6–12 months. Mild cases can finish in as little as 5 months. Complex cases may take up to 18 months or more. Our expert dentist will give you an honest timeline at consultation.' },
  { q: 'Why is the consultation not free?', a: 'Our experienced dentist will visit your home or assess you at our clinic. The consultation and 3D scanning normally costs upwards of ₹3,999, but is offered to you at a minimal cost of ₹199. The fee is simply to keep things fair and maintain quality of service.' },
  { q: 'Can I eat normally with aligners?', a: 'Yes. Remove the aligners before eating or drinking anything other than water. No food restrictions at all.' },
  { q: 'Does it hurt?', a: 'There may be mild pressure for 3–6 days after switching to a new set. This is normal and means the aligners are working. Most patients describe it as discomfort, not pain.' },
  { q: 'How many hours a day do I wear them?', a: '20–22 hours per day. You take them out to eat, drink, brush, and floss.' },
  { q: 'What if I lose or break an aligner?', a: 'Contact us immediately. Replacement aligners can be ordered quickly. Until then, keep wearing your previous aligner if you do not have the next one.' },
  { q: 'Do I need to visit the clinic often?', a: 'No — and that is the most interesting part of aligners. Unlike braces, you do not have to visit every month. The full aligner treatment can be completed in just 3 short visits. Any additional visits in between are covered by OrisAlign. We also offer video consultations for minor queries.' },
  { q: 'Will I need retainers after treatment?', a: 'Yes. Retainers are essential to maintain your results. We provide retainers as part of the treatment package.' },
  { q: 'Is OrisAlign suitable for teenagers?', a: 'Yes, from age 13+ when adult teeth are fully grown. We have specific protocols for teen patients.' },
  { q: 'Can severe crowding be treated?', a: 'Yes, 99% of cases respond excellently. Severe cases may need a combination approach — we maintain complete transparency and after the initial assessment our expert dentist and specialist will advise honestly.' },
  { q: 'What are the EMI options?', a: 'No-cost EMI is available via major banks and fintech apps (Bajaj Finserv, HDFC, ICICI, etc.). EMI options may vary as per individual banking history and CIBIL score. Ask us at consultation.' },
  { q: 'Is OrisAlign available outside Bhubaneswar?', a: 'Yes, we serve the whole of Odisha. Please contact us to know more.' },
]

const BEFORE_AFTER = [
  { label: 'Crowding — 7 months*', tag: 'Crowding' },
  { label: 'Spacing — 5 months*', tag: 'Spacing' },
  { label: 'Overbite — 9 months*', tag: 'Overbite' },
  { label: 'Mild crowding — 4 months*', tag: 'Crowding' },
  { label: 'Deep bite — 10 months*', tag: 'Deep Bite' },
  { label: 'Crossbite — 8 months*', tag: 'Crossbite' },
]

const WA_ICON = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
const WA_LINK = "https://wa.me/918280837370?text=Hi%2C+I%27d+like+to+know+more+about+OrisAlign"

// ── Inline line icons (no emoji) ──
const ic = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
const Check = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><path d="M20 6 9 17l-5-5" /></svg>
const StarSolid = ({ className }) => <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
const MapPin = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
const Shield = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
const Phone = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
const Mail = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>
const Clock = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
const Scan = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></svg>
const Clipboard = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1" /><path d="M9 12h6M9 16h4" /></svg>
const Package = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><path d="m7.5 4.27 9 5.15M21 8l-9 5-9-5 9-5 9 5Z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
const Stethoscope = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><path d="M4 3v6a4 4 0 0 0 8 0V3M6 3v0M10 3v0M8 13v3a5 5 0 0 0 10 0v-1" /><circle cx="18" cy="11" r="2" /></svg>
const Gift = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" /><rect x="2" y="7" width="20" height="5" rx="1" /><path d="M12 7v14M12 7S9 3 6.5 4.5 8 7 12 7Zm0 0s3-4 5.5-2.5S16 7 12 7Z" /></svg>
const IdCard = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M14 9h4M14 13h4M5 16c.5-1.5 1.7-2 3-2s2.5.5 3 2" /></svg>
const Sparkle = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" /></svg>
const CreditCard = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></svg>
const Video = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4V8Z" /></svg>
const ChevronDown = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><path d="m6 9 6 6 6-6" /></svg>
const HelpCircle = ({ className }) => <svg viewBox="0 0 24 24" className={className} {...ic}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" /><path d="M12 17h.01" /></svg>

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(f => ({
    "@type": "Question",
    "name": f.q,
    "acceptedAnswer": { "@type": "Answer", "text": f.a }
  }))
}

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "MedicalProcedure",
  "name": "OrisAlign Clear Aligner Treatment",
  "description": "OrisAlign provides clear aligner orthodontic treatment in Bhubaneswar, Odisha. Custom-made invisible braces manufactured in India, supervised by expert dentists.",
  "procedureType": "Therapeutic",
  "followUp": "Monthly check-ins and video consultations",
  "preparation": "Free 3D scan and consultation at just ₹199",
  "provider": {
    "@type": "MedicalBusiness",
    "name": "OrisAlign",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "MIG-1, 43/5, Housing Board Colony, Chandrasekharpur",
      "addressLocality": "Bhubaneswar",
      "addressRegion": "Odisha",
      "postalCode": "751016",
      "addressCountry": "IN"
    }
  }
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [membershipOpen, setMembershipOpen] = useState(false)
  const [assessmentOpen, setAssessmentOpen] = useState(false)
  const [freebiesOpen, setFreebiesOpen] = useState(false)
  const [callbackOpen, setCallbackOpen] = useState(false)
  const [callbackForm, setCallbackForm] = useState({ name: '', phone: '' })
  const [callbackSubmitted, setCallbackSubmitted] = useState(false)
  const [callbackLoading, setCallbackLoading] = useState(false)
  const [pincode, setPincode] = useState('')
  const [pincodeResult, setPincodeResult] = useState(null) // null | 'available' | 'unavailable'

  const handlePincodeCheck = (e) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(pincode)) return
    setPincodeResult(SERVICEABLE_PINCODES.has(pincode) ? 'available' : 'unavailable')
  }

  const handleCallbackSubmit = async (e) => {
    e.preventDefault()
    if (!callbackForm.name.trim() || !callbackForm.phone.trim()) return
    setCallbackLoading(true)
    try {
      await fetch('/api/notify-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'callback', name: callbackForm.name, phone: callbackForm.phone }),
      })
    } catch (_) {}
    setCallbackLoading(false)
    setCallbackSubmitted(true)
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: '#FAFBFB', color: INK }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img
              src="/logo2.png"
              alt="OrisAlign – Clear Aligners Bhubaneswar"
              className="h-12 w-auto"
              style={{ mixBlendMode: 'multiply' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
            {/* Fallback text if logo2.png not yet uploaded */}
            <span className="items-center gap-1 hidden" style={{ display: 'none' }}>
              <span className="text-2xl font-extrabold tracking-tight font-display" style={{ color: INK }}>Oris</span>
              <span className="text-2xl font-extrabold tracking-tight font-display" style={{ color: GOLD }}>Align</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-9">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} className="text-sm font-medium transition-colors" style={{ color: INK2 }}
                onMouseEnter={e => e.currentTarget.style.color = INK}
                onMouseLeave={e => e.currentTarget.style.color = INK2}>{l.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a href="/patient" className="hidden sm:inline-flex items-center text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors" style={{ background: GOLD, color: '#fff' }}
              onMouseEnter={e => e.currentTarget.style.background = GOLDD}
              onMouseLeave={e => e.currentTarget.style.background = GOLD}>
              Patient Login
            </a>
            <button className="md:hidden p-2 rounded-lg" style={{ color: INK }} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden px-4 pb-4 bg-white" style={{ borderTop: `1px solid ${LINE}` }}>
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} className="block py-3 text-sm" style={{ color: INK, borderBottom: `1px solid ${LINE}` }}>{l.label}</a>
            ))}
            <a href="/patient" onClick={() => setMenuOpen(false)} className="block mt-3 text-center text-sm font-semibold px-4 py-3 rounded-xl" style={{ background: GOLD, color: '#fff' }}>
              Patient Login
            </a>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="pt-16" style={{ background: 'linear-gradient(180deg, #FAFBFB 0%, #FFFFFF 100%)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid md:grid-cols-2 gap-12 md:gap-14 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6" style={{ background: MINT, color: MINTD, border: `1px solid ${LINE}` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: MINTD }} />
              #1 Clear Aligners
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-3" style={{ color: INK }}>
              Straighter teeth<br />
              <span style={{ color: GOLD }}>in 6 months*</span>
            </h1>
            <p className="text-xs mb-5" style={{ color: INK2 }}>*Terms &amp; conditions apply</p>
            <p className="text-lg sm:text-xl mb-5 leading-relaxed" style={{ color: INK2 }}>
              International quality and precision, designed and fabricated by expert dentists of India.
            </p>
            <div className="flex flex-col gap-2.5 mb-8">
              {['🇮🇳 Made in India', 'Invisible', 'No food restrictions'].map((t, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm font-medium" style={{ color: INK }}>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0" style={{ background: MINT, color: MINTD }}><Check className="w-3 h-3" /></span>
                  {t}
                </div>
              ))}
            </div>

            {/* Smile assessment offer card */}
            <div className="mb-7 rounded-2xl overflow-hidden" style={{ border: `1px solid ${LINE}`, background: '#fff', boxShadow: '0 1px 2px rgba(19,24,27,.04)' }}>
              <div className="px-5 py-4">
                <div className="flex items-center gap-1.5 text-sm flex-wrap font-medium" style={{ color: INK }}>
                  Book your scan for
                  <button
                    onClick={() => setAssessmentOpen(o => !o)}
                    className="w-5 h-5 rounded-full inline-flex items-center justify-center font-bold transition-colors flex-shrink-0"
                    style={{ border: `1.5px solid ${GOLD}`, background: assessmentOpen ? GOLD : '#fff', fontSize: '11px', fontStyle: 'italic', lineHeight: 1 }}
                    aria-label="What's included in the smile assessment"
                  >
                    <span style={{ color: assessmentOpen ? '#fff' : GOLD }}>i</span>
                  </button>
                  <span style={{ textDecoration: 'line-through', color: INK2 }}>₹599</span>
                  <span className="font-extrabold" style={{ color: GOLD }}>₹199</span>
                  — offer ends soon!
                </div>
                <div className="text-xs mt-2 flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: INK2 }}>
                  <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" style={{ color: MINTD }} /> No prior payment</span>
                  <span style={{ color: LINE }}>·</span>
                  <span>Pay on spot</span>
                  <span style={{ color: LINE }}>·</span>
                  <span style={{ color: GOLD }} className="font-semibold">Hurry up — limited slots!</span>
                </div>
              </div>
              {assessmentOpen && (
                <div style={{ borderTop: `1px solid ${LINE}` }}>
                  {[
                    { label: 'Expert dentist consultation', value: 'worth ₹499' },
                    { label: '3D dental scan', value: 'worth ₹7,999' },
                    { label: 'Provisional diagnosis & planning', value: 'Included' },
                    { label: 'Provisional 3D planning video', value: 'Included' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-5 py-2.5 text-sm" style={{ borderTop: idx ? `1px solid ${LINE}` : 'none', background: '#FCFDFD' }}>
                      <span className="font-medium flex items-center gap-2" style={{ color: INK }}><Check className="w-4 h-4" style={{ color: GOLD }} /> {item.label}</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full ml-2 flex-shrink-0" style={{ background: MINT, color: MINTD }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right — treatment plan card */}
          <div className="relative pt-8">
            <div className="rounded-[22px] bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: INK2 }}>Your treatment plan</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: MINT, color: MINTD }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: MINTD }} /> Doctor-supervised
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden aspect-square" style={{ border: `1px solid ${LINE}` }}>
                <video
                  src="/hero-video.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-label="OrisAlign patients – 500+ smiles transformed in Bhubaneswar Odisha"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* progress strip */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                {[{ Icon: Scan, l: 'Scan' }, { Icon: Clipboard, l: 'Plan' }, { Icon: Package, l: 'Aligners' }, { Icon: StarSolid, l: 'New smile' }].map(({ Icon, l }, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 rounded-xl py-2.5" style={{ background: '#FAFBFB', border: `1px solid ${LINE}` }}>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ background: '#fff', border: `1px solid ${LINE}`, color: GOLD }}><Icon className="w-3.5 h-3.5" /></span>
                    <span className="text-[10px] font-semibold" style={{ color: INK2 }}>{l}</span>
                  </div>
                ))}
              </div>
              {/* price chip */}
              <div className="mt-4 flex items-center justify-center rounded-xl px-4 py-3" style={{ background: INK }}>
                <span className="text-sm font-extrabold font-display" style={{ color: GOLD }}>EMI available*</span>
              </div>
            </div>
            {/* floating badges */}
            <div className="absolute top-0 -left-3 bg-white rounded-xl px-4 py-2.5 flex items-center gap-2.5" style={{ border: `1px solid ${LINE}`, boxShadow: '0 12px 24px -16px rgba(19,24,27,.5)' }}>
              <MapPin className="w-5 h-5" style={{ color: GOLD }} />
              <span className="text-sm leading-tight" style={{ color: INK }}>
                <span className="font-extrabold" style={{ color: GOLD }}>International Quality</span>
                <span className="font-bold"> · Made in India · 15-day delivery</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Choose your consultation ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 sm:pb-20">
          <div className="flex justify-center mb-6">
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 text-base font-semibold px-7 py-3.5 rounded-xl transition-colors" style={{ background: '#fff', color: INK, border: `1px solid ${LINE}` }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#cfd4d6'}
              onMouseLeave={e => e.currentTarget.style.borderColor = LINE}>
              <svg className="w-5 h-5 fill-current" style={{ color: '#25D366' }} viewBox="0 0 24 24"><path d={WA_ICON} /></svg>
              Click to Connect
            </a>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            <a
              href="/smile-report/upload"
              className="group block rounded-2xl px-6 sm:px-7 py-7 sm:py-8 text-center transition-transform hover:scale-[1.015]"
              style={{ background: '#fff', border: `2px solid ${GOLD}`, boxShadow: '0 24px 50px -30px rgba(184,144,90,.55)' }}
            >
              <div className="inline-flex items-center justify-center rounded-xl px-4 py-3 mb-3" style={{ background: INK }}>
                <h3 className="font-display text-lg sm:text-xl font-extrabold uppercase tracking-wide" style={{ color: GOLD }}>
                  Online Smile Report
                </h3>
              </div>
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-2xl sm:text-3xl font-extrabold font-display" style={{ color: GOLD }}>₹399</span>
                <span className="text-base sm:text-lg font-semibold" style={{ color: INK2, textDecoration: 'line-through' }}>₹999</span>
              </div>
              <p className="text-sm mb-5" style={{ color: INK2 }}>
                Upload teeth images and get your personalised provisional plan from our smile expert within 24 hours.
              </p>
              <span className="inline-flex items-center justify-center gap-2 text-sm font-bold px-6 py-2.5 rounded-full transition-colors" style={{ background: GOLD, color: '#fff' }}>
                Book now
                <svg viewBox="0 0 24 24" className="w-4 h-4 transition-transform group-hover:translate-x-1" {...ic} stroke="#fff"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
            </a>

            <div
              className="rounded-2xl px-6 sm:px-7 py-7 sm:py-8 text-center"
              style={{ background: '#fff', border: `2px solid ${GOLD}`, boxShadow: '0 24px 50px -30px rgba(184,144,90,.55)' }}
            >
              <div className="inline-flex items-center justify-center rounded-xl px-4 py-3 mb-3" style={{ background: INK }}>
                <h3 className="font-display text-lg sm:text-xl font-extrabold uppercase tracking-wide" style={{ color: GOLD }}>
                  Book Your 3D Scan
                </h3>
              </div>
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-2xl sm:text-3xl font-extrabold font-display" style={{ color: GOLD }}>₹199</span>
                <span className="text-base sm:text-lg font-semibold" style={{ color: INK2, textDecoration: 'line-through' }}>₹999</span>
              </div>
              <p className="text-sm mb-5" style={{ color: INK2 }}>
                At home or in-clinic consultation available.
              </p>
              <a href="/book" className="group inline-flex items-center justify-center gap-2 text-sm font-bold px-6 py-2.5 rounded-full transition-colors" style={{ background: GOLD, color: '#fff' }}>
                Book now
                <svg viewBox="0 0 24 24" className="w-4 h-4 transition-transform group-hover:translate-x-1" {...ic} stroke="#fff"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </a>
              <p className="text-xs mt-3" style={{ color: INK2 }}>Available in selected locations only</p>

              <form onSubmit={handlePincodeCheck} className="mt-4 flex items-stretch gap-2 max-w-xs mx-auto">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="Enter your PIN code"
                  value={pincode}
                  onChange={e => { setPincode(e.target.value.replace(/\D/g, '').slice(0, 6)); setPincodeResult(null) }}
                  className="flex-1 min-w-0 text-sm px-3.5 py-2.5 rounded-lg outline-none"
                  style={{ border: `1px solid ${LINE}`, color: INK }}
                  aria-label="PIN code"
                />
                <button
                  type="submit"
                  disabled={pincode.length !== 6}
                  className="text-xs font-bold px-4 py-2.5 rounded-lg flex-shrink-0 disabled:opacity-40"
                  style={{ background: INK, color: '#fff' }}
                >
                  Check
                </button>
              </form>

              {pincodeResult === 'available' && (
                <p className="text-xs font-semibold mt-2.5 flex items-center justify-center gap-1.5" style={{ color: MINTD }}>
                  <Check className="w-3.5 h-3.5" /> Available at your location
                </p>
              )}
              {pincodeResult === 'unavailable' && (
                <p className="text-xs font-semibold mt-2.5" style={{ color: INK2 }}>
                  3D scan is yet to start at your location — proceed with{' '}
                  <a href="/smile-report/upload" style={{ color: GOLD, textDecoration: 'underline' }}>Online Smile Report</a>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAND ── */}
      <section className="py-10" style={{ background: '#fff', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { Icon: Stethoscope, label: 'Designed by expert dentists' },
              { Icon: StarSolid, label: '500+ Smiles Transformed' },
              { Icon: MapPin, label: 'Made in India' },
              { Icon: MapPin, label: 'Bhubaneswar, Odisha' },
            ].map(({ Icon, label }, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: '#FAFBFB', border: `1px solid ${LINE}` }}>
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ background: MINT, color: GOLD }}><Icon className="w-4 h-4" /></span>
                <span className="text-xs sm:text-sm font-medium leading-tight" style={{ color: INK }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="py-14 sm:py-20" id="compare">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: INK }}>OrisAlign vs Metal Braces vs Other Aligner Brands</h2>
            <p className="max-w-xl mx-auto" style={{ color: INK2 }}>An honest comparison. We believe you should choose with full information.</p>
          </div>
          <div className="overflow-x-auto rounded-[22px]" style={{ background: INK, boxShadow: CARD_SHADOW }}>
            <table className="w-full text-sm" style={{ minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                  <th className="text-left px-5 py-5 font-semibold w-1/4" style={{ color: '#8a949a' }}>Feature</th>
                  <th className="px-5 py-5" style={{ borderLeft: `1px solid ${GOLD}55`, borderRight: `1px solid ${GOLD}55`, background: 'rgba(184,144,90,0.10)' }}>
                    <span className="block text-xl font-extrabold tracking-tight font-display" style={{ color: GOLD }}>OrisAlign</span>
                  </th>
                  <th className="px-5 py-5 text-[11px] font-medium leading-tight" style={{ color: '#8a949a' }}>Metal<br />Braces</th>
                  <th className="px-5 py-5 text-[11px] font-medium leading-tight" style={{ color: '#8a949a' }}>Other<br />Aligner Brands</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => {
                  const oYes = row.orisalign.startsWith('✓')
                  return (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td className="px-5 py-3.5 font-medium" style={{ color: '#c3cace' }}>{row.feature}</td>
                      <td className="px-5 py-3.5 text-center font-semibold" style={{ borderLeft: `1px solid ${GOLD}55`, borderRight: `1px solid ${GOLD}55`, background: 'rgba(184,144,90,0.07)', color: oYes ? '#7fd1ad' : GOLD }}>{row.orisalign}</td>
                      <td className="px-5 py-3.5 text-center" style={{ color: '#8a949a' }}>{row.braces}</td>
                      <td className="px-5 py-3.5 text-center" style={{ color: '#8a949a' }}>{row.invisalign}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs mt-4" style={{ color: INK2 }}>*Prices are indicative. Exact cost depends on case complexity.</p>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-14 sm:py-20" id="how-it-works" style={{ background: '#fff', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: INK }}>How It Works</h2>
            <p style={{ color: INK2 }}>5 simple steps to your new smile.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {STEPS.map((step, i) => (
              <div key={i} className="relative bg-white rounded-2xl overflow-hidden transition-shadow" style={{ border: `1px solid ${LINE}` }}>
                <div className="absolute top-3 left-3 z-10 text-xs font-extrabold w-7 h-7 rounded-full flex items-center justify-center" style={{ background: GOLD, color: '#fff' }}>
                  {i + 1}
                </div>
                {i === 0 ? (
                  <img src="/consult.jpg" alt="Consultation" className="w-full h-44 object-cover" />
                ) : i === 1 ? (
                  <img src="/step-scan.jpg" alt="3D Scan" className="w-full h-44 object-cover" />
                ) : i === 2 ? (
                  <video
                    src="/step-plan.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    aria-label="Planning"
                    className="w-full h-44 object-cover"
                  />
                ) : i === 3 ? (
                  <img src="/alignerwear.png" alt="Aligners Delivered" className="w-full h-44 object-cover" />
                ) : (
                  <img src="/girlsmile.png" alt="Smile in 6 Months" className="w-full h-44 object-cover" />
                )}
                <div className="p-5">
                  <h3 className="font-display font-bold mb-2" style={{ color: INK }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: INK2 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-14 sm:py-20" id="pricing">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: INK }}>Transparent Pricing</h2>
            <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl" style={{ background: MINT, border: `1.5px solid ${MINTD}55` }}>
              <Shield className="w-5 h-5 flex-shrink-0" style={{ color: MINTD }} />
              <p className="text-base sm:text-lg font-extrabold" style={{ color: MINTD }}>No Hidden Charges. What You See is What You Pay.</p>
            </div>
          </div>

          {/* Single pricing card */}
          <div className="rounded-[22px] overflow-hidden bg-white" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            {/* Header */}
            <div className="px-8 py-8 text-center" style={{ background: INK }}>
              <div className="flex items-end justify-center gap-2 mb-1 flex-wrap">
                <span className="text-xl font-bold line-through mb-1" style={{ color: '#6b7479' }}>₹66,999</span>
                <span className="text-5xl font-extrabold font-display" style={{ color: GOLD }}>₹4,999<span className="text-2xl"> / month</span></span>
                <span className="text-base font-semibold mb-1" style={{ color: '#9aa6ac' }}>*</span>
              </div>
              <p className="text-sm mt-2" style={{ color: '#9aa6ac' }}>*Final pricing and treatment duration depend on your individual teeth condition, confirmed after your 3D scan</p>
            </div>

            {/* Freebies */}
            <div className="px-6 sm:px-8 py-6 space-y-3" style={{ background: '#FAFBFB' }}>
              <div className="rounded-xl bg-white overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
                <div className="flex items-center justify-between px-4 py-3 gap-2">
                  <span className="flex items-center gap-2.5 text-sm font-medium" style={{ color: INK }}>
                    <Gift className="w-5 h-5" style={{ color: GOLD }} />
                    <span>
                      OrisPro-Plus Benefits <span className="text-xs font-semibold" style={{ color: GOLD }}>worth ₹19,999</span>
                      <button
                        onClick={() => setFreebiesOpen(!freebiesOpen)}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full font-bold transition-colors align-middle ml-1 flex-shrink-0"
                        style={{ border: `1.5px solid ${INK}`, background: freebiesOpen ? INK : '#fff', fontSize: '11px', fontStyle: 'italic', lineHeight: 1 }}
                        aria-label="What's included in freebies"
                      >
                        <span style={{ color: freebiesOpen ? '#fff' : INK }}>i</span>
                      </button>
                    </span>
                  </span>
                  <span className="text-xs italic flex-shrink-0" style={{ color: INK2 }}>included with every treatment</span>
                </div>

                {freebiesOpen && (
                  <div style={{ borderTop: `1px solid ${LINE}` }}>
                    {[
                      { Icon: Sparkle, label: '2 × Scaling & polishing' },
                      { Icon: Shield, label: '1 × Premium transparent retainer' },
                      { Icon: Shield, label: '1 × Lingual retainer' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: i ? `1px solid ${LINE}` : 'none', background: '#FCFDFD' }}>
                        <span className="flex items-center gap-2.5 text-sm font-medium" style={{ color: INK }}>
                          <item.Icon className="w-4 h-4" style={{ color: GOLD }} />
                          {item.label}
                        </span>
                        <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: MINT, color: MINTD }}>Free</span>
                      </div>
                    ))}

                    {/* Lifetime membership card — nested inside OrisPro-Plus Benefits */}
                    <div style={{ borderTop: `1px solid ${LINE}` }}>
                      <div className="flex items-center justify-between px-4 py-2.5 gap-2" style={{ background: '#FCFDFD' }}>
                        <span className="flex items-center gap-2.5 text-sm font-medium" style={{ color: INK }}>
                          <IdCard className="w-4 h-4" style={{ color: GOLD }} />
                          Lifetime membership card <span className="text-xs font-semibold" style={{ color: GOLD }}>worth ₹9,999</span>
                          <button
                            onClick={() => setMembershipOpen(!membershipOpen)}
                            className="w-5 h-5 rounded-full inline-flex items-center justify-center font-bold transition-colors flex-shrink-0"
                            style={{ border: `1.5px solid ${INK}`, background: membershipOpen ? INK : '#fff', fontSize: '11px', fontStyle: 'italic', lineHeight: 1 }}
                            aria-label="Membership card details"
                          >
                            <span style={{ color: membershipOpen ? '#fff' : INK }}>i</span>
                          </button>
                        </span>
                        <span className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0" style={{ background: MINT, color: MINTD }}>Free</span>
                      </div>
                      {membershipOpen && (
                        <div className="px-4 pb-4 pt-3 text-xs leading-relaxed space-y-2" style={{ borderTop: `1px solid ${LINE}`, background: '#FCFDFD' }}>
                          <p className="font-bold text-sm mb-2" style={{ color: INK }}>What's included in your Lifetime Membership:</p>
                          <div className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                            <span style={{ color: INK2 }}><strong style={{ color: INK }}>30% off</strong> on any dental treatment or surgery — for the lifetime of the card holder</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                            <span style={{ color: INK2 }}>Benefit also applies to <strong style={{ color: INK }}>+1 person</strong> of the card holder's choice <span style={{ color: INK2 }}>(add-on facility available)</span></span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                            <span style={{ color: INK2 }}><strong style={{ color: INK }}>15% off</strong> for friends &amp; family</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="px-8 py-6 text-center bg-white">
              <p className="text-xs mt-3" style={{ color: INK2 }}>Exact pricing shared after consultation — your case may cost less.</p>
              <p className="text-xs mt-1" style={{ color: INK2 }}>The lifetime membership card is provided by <span className="font-semibold">Kalp Dental Clinic</span>.</p>
              <p className="text-xs mt-1.5 font-semibold" style={{ color: INK }}>Other solutions available — <a href="#still-in-doubt" style={{ color: GOLD, textDecoration: 'underline' }}>contact us to know more</a></p>
            </div>
          </div>

          {/* OrisPromise */}
          <div id="orispromise" className="mt-12 rounded-[22px] overflow-hidden" style={{ background: INK, boxShadow: CARD_SHADOW }}>
            <div className="px-6 pt-8 pb-5 text-center" style={{ borderBottom: '1px solid rgba(184,144,90,0.2)' }}>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{ background: 'rgba(184,144,90,0.12)', border: `1.5px solid ${GOLD}`, color: GOLD }}>
                <Shield className="w-6 h-6" />
              </div>
              <div className="inline-block px-5 py-2 rounded-full mb-3" style={{ background: 'rgba(184,144,90,0.15)', border: `1.5px solid ${GOLD}` }}>
                <div className="text-2xl sm:text-3xl font-extrabold uppercase tracking-[0.18em] font-display" style={{ color: GOLD }}>ORIS-PROMISE</div>
              </div>
              <h3 className="font-display text-xl font-extrabold" style={{ color: '#fff' }}>You trust us.</h3>
              <h3 className="font-display text-xl font-extrabold mb-1" style={{ color: '#fff' }}>We take your responsibility.</h3>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Clipboard className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#9aa6ac' }} />
                <p className="text-sm leading-relaxed" style={{ color: '#c3cace' }}>
                  Just follow our instructions and complete the treatment as per our doctor's advice.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(184,144,90,0.08)', border: `1px solid ${GOLD}33` }}>
                <Sparkle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                <p className="text-sm leading-relaxed" style={{ color: '#E8D9C2' }}>
                  Any extension of treatment beyond the committed timeline will be <strong style={{ color: '#fff' }}>entirely on us — no additional charges, ever.</strong>
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {['Treatment guarantee', 'No hidden charges', 'Extension covered by us'].map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#c3cace', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Check className="w-3.5 h-3.5" style={{ color: MINTD }} /> {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALLBACK / CONTACT ── */}
      <section id="still-in-doubt" className="py-14 sm:py-16" style={{ background: '#fff', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="rounded-[22px] overflow-hidden bg-white" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            {/* Header */}
            <div className="px-8 pt-8 pb-6 text-center" style={{ background: INK }}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4" style={{ background: 'rgba(184,144,90,0.15)', border: `1.5px solid ${GOLD}`, color: GOLD }}>
                <HelpCircle className="w-5 h-5" />
              </div>
              <h2 className="font-display text-2xl font-extrabold mb-1" style={{ color: '#fff' }}>Still in doubt?</h2>
              <p className="text-sm" style={{ color: '#9aa6ac' }}>Let our expert team reach out to you — no pressure, just answers.</p>
            </div>

            <div className="px-6 sm:px-8 py-8 bg-white">
              {!callbackSubmitted ? (
                <>
                  <div className="rounded-2xl overflow-hidden mb-4" style={{ border: `1px solid ${callbackOpen ? GOLD : LINE}`, transition: 'border-color 0.3s' }}>
                    <button
                      onClick={() => setCallbackOpen(o => !o)}
                      className="w-full flex items-center justify-between px-5 py-4 transition-all"
                      style={{ background: callbackOpen ? INK : '#FAFBFB' }}
                    >
                      <span className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0" style={{ background: callbackOpen ? 'rgba(184,144,90,0.2)' : MINT, color: callbackOpen ? GOLD : MINTD }}>
                          <Phone className="w-4 h-4" />
                        </span>
                        <span className="text-left">
                          <span className="block font-bold text-sm" style={{ color: callbackOpen ? '#fff' : INK }}>Request a free callback</span>
                          <span className="block text-xs mt-0.5" style={{ color: callbackOpen ? '#9aa6ac' : INK2 }}>We'll call you within 24 hours</span>
                        </span>
                      </span>
                      <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: callbackOpen ? 'rgba(255,255,255,0.1)' : '#fff', border: `1px solid ${callbackOpen ? 'transparent' : LINE}` }}>
                        <ChevronDown className="w-4 h-4" style={{ transform: callbackOpen ? 'rotate(180deg)' : 'none', color: callbackOpen ? '#fff' : INK, transition: 'transform 0.2s' }} />
                      </span>
                    </button>

                    {callbackOpen && (
                      <form onSubmit={handleCallbackSubmit} className="space-y-4 px-5 pb-5 pt-4" style={{ background: '#FCFDFD', borderTop: `1px solid ${LINE}` }}>
                        <div>
                          <label className="block text-xs font-semibold mb-1.5" style={{ color: INK }}>Your Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Priya Sharma"
                            value={callbackForm.name}
                            onChange={e => setCallbackForm(f => ({ ...f, name: e.target.value }))}
                            required
                            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                            style={{ border: `1px solid ${LINE}`, background: '#fff' }}
                            onFocus={e => e.target.style.borderColor = GOLD}
                            onBlur={e => e.target.style.borderColor = LINE}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1.5" style={{ color: INK }}>Phone Number</label>
                          <input
                            type="tel"
                            placeholder="e.g. 98765 43210"
                            value={callbackForm.phone}
                            onChange={e => setCallbackForm(f => ({ ...f, phone: e.target.value }))}
                            required
                            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                            style={{ border: `1px solid ${LINE}`, background: '#fff' }}
                            onFocus={e => e.target.style.borderColor = GOLD}
                            onBlur={e => e.target.style.borderColor = LINE}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={callbackLoading}
                          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
                          style={{ background: INK, color: '#fff', opacity: callbackLoading ? 0.7 : 1 }}
                        >
                          {callbackLoading ? 'Submitting…' : 'Submit →'}
                        </button>
                      </form>
                    )}
                  </div>

                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px" style={{ background: LINE }} />
                    <span className="text-xs font-medium" style={{ color: INK2 }}>or reach us directly</span>
                    <div className="flex-1 h-px" style={{ background: LINE }} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <a
                      href="mailto:hello@orisalign.com"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
                      style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
                    >
                      <Mail className="w-4 h-4" />
                      Mail Us
                    </a>
                    <a
                      href={WA_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
                      style={{ background: '#25D366', color: '#fff' }}
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d={WA_ICON} /></svg>
                      WhatsApp
                    </a>
                  </div>
                  <p className="text-center text-xs mt-3" style={{ color: INK2 }}>hello@orisalign.com</p>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: MINT, border: `1.5px solid ${MINTD}`, color: MINTD }}>
                    <Check className="w-7 h-7" />
                  </div>
                  <h3 className="font-display text-lg font-extrabold mb-2" style={{ color: INK }}>Request received!</h3>
                  <p className="text-sm mb-6" style={{ color: INK2 }}>We'll call you within <strong>24 hours</strong>. Our team looks forward to speaking with you.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href="mailto:hello@orisalign.com"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm"
                      style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
                    >
                      <Mail className="w-4 h-4" />
                      Mail Us
                    </a>
                    <a
                      href={WA_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm"
                      style={{ background: '#25D366', color: '#fff' }}
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d={WA_ICON} /></svg>
                      WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── BEFORE & AFTER ── */}
      <section className="py-14 sm:py-20" id="gallery">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: INK }}>Real Patient Results</h2>
            <p style={{ color: INK2 }}>Before &amp; after photos from actual OrisAlign patients. No editing.</p>
          </div>
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-[22px] overflow-hidden" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
              <img src="/beforeafter.jpeg" alt="Before and After OrisAlign Treatment" className="w-full object-cover" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-2 gap-3">
                  <span className="text-sm font-bold font-display" style={{ color: INK }}>Crowding &amp; Spacing Correction</span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0" style={{ background: MINT, color: MINTD }}>8 months*</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: INK2 }}>From misaligned, crowded teeth to a confident, straight smile — achieved with OrisAlign clear aligners in just 8 months. Shared with patient consent.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-14 sm:py-20" id="testimonials" style={{ background: '#fff', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: INK }}>What Our Patients Say</h2>
            <p style={{ color: INK2 }}>Real people. Real results. From Bhubaneswar.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5 mb-12">
            {[
              { name: 'Priya M.', age: '24', duration: '7 months*', quote: 'I was nervous about the process but our expert dentist explained everything clearly. My teeth look amazing and nobody even noticed I was wearing aligners!' },
              { name: 'Rahul K.', age: '31', duration: '13 months*', quote: 'Compared quotes from 3 clinics — OrisAlign was the most affordable with the most professional setup. It took time but it was the best decision I made.' },
              { name: 'Ananya S.', age: '19', duration: '9 months*', quote: "As a college student I was worried about how I'd look. Completely invisible. My confidence has gone through the roof." },
            ].map((t, i) => (
              <div key={i} className="rounded-[22px] p-6 bg-white" style={{ border: `1px solid ${LINE}` }}>
                <div className="flex gap-0.5 mb-3" style={{ color: GOLD }}>
                  {[0, 1, 2, 3, 4].map(s => <StarSolid key={s} className="w-4 h-4" />)}
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: INK }}>&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm font-display" style={{ background: MINT, color: MINTD }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: INK }}>{t.name}, {t.age}</div>
                    <div className="text-xs" style={{ color: INK2 }}>Treated in {t.duration}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Video testimonial */}
          <div className="text-center mb-6">
            <h3 className="font-display text-xl font-extrabold mb-2" style={{ color: INK }}>Watch a Patient Story</h3>
            <p className="text-sm mb-6" style={{ color: INK2 }}>Real experience, real results.</p>
          </div>
          <div className="max-w-sm mx-auto">
            <a
              href="https://www.instagram.com/reel/DXcsnVrkr6c/?igsh=YTYxOWVwOHdoYWtu"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-[22px] overflow-hidden transition-shadow"
              style={{ background: INK, boxShadow: CARD_SHADOW }}
            >
              <div className="aspect-[9/16] flex flex-col items-center justify-center gap-4 p-8" style={{ background: INK }}>
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: GOLD }}>
                  <svg className="w-9 h-9 fill-white ml-1.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-base mb-1">Patient Testimonial</p>
                  <p className="text-sm" style={{ color: '#9aa6ac' }}>Watch on Instagram →</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="url(#ig)">
                    <defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433" /><stop offset="25%" stopColor="#e6683c" /><stop offset="50%" stopColor="#dc2743" /><stop offset="75%" stopColor="#cc2366" /><stop offset="100%" stopColor="#bc1888" /></linearGradient></defs>
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <span className="text-xs" style={{ color: '#9aa6ac' }}>@orisalign on Instagram</span>
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── MEET THE DOCTOR ── */}
      <section className="py-14 sm:py-20 text-white" id="doctor" style={{ background: INK }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-6">Meet Our Expert Team</h2>
            <p className="text-base mb-8 leading-relaxed" style={{ color: '#c3cace' }}>
              Our expert dentists have more than 10 years of experience and have transformed 5000+ smiles using clear aligner therapy. The vision is to make OrisAlign a premium orthodontic care accessible to everyone in Odisha — at a fair, transparent price.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 text-sm mb-8 text-left max-w-md mx-auto">
              {[
                { Icon: Stethoscope, label: 'Expertise in Aligner therapy' },
                { Icon: Clock, label: 'Practicing since 10 years' },
                { Icon: Sparkle, label: '5000+ clear aligner cases' },
                { Icon: MapPin, label: 'Committed to Made-in-India dentistry' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8D9C2' }}>
                  <item.Icon className="w-4 h-4 flex-shrink-0" style={{ color: GOLD }} />
                  {item.label}
                </div>
              ))}
            </div>
            <div className="inline-flex items-center gap-2 mb-6 px-5 py-2 rounded-full text-sm font-semibold" style={{ background: 'rgba(184,144,90,0.18)', color: GOLD, border: `1px solid ${GOLD}66` }}>
              <Video className="w-4 h-4" />
              We also provide video consultations
            </div>
            <div>
              <a href="/book" className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-colors" style={{ background: GOLD, color: '#fff' }}
                onMouseEnter={e => e.currentTarget.style.background = GOLDD}
                onMouseLeave={e => e.currentTarget.style.background = GOLD}>
                Book with an Expert
                <svg viewBox="0 0 24 24" className="w-4 h-4" {...ic}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-14 sm:py-20" id="faq">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: INK }}>Frequently Asked Questions</h2>
            <p style={{ color: INK2 }}>Honest answers to the questions we get most.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
                <button
                  className="w-full text-left px-6 py-4 flex items-start justify-between gap-4 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-sm leading-snug" style={{ color: INK }}>{faq.q}</span>
                  <span className="font-bold text-lg mt-0.5 flex-shrink-0 transition-transform" style={{ color: GOLD, transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm leading-relaxed" style={{ color: INK2, borderTop: `1px solid ${LINE}` }}>
                    <p className="pt-3">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TERMS & CONDITIONS ── */}
      <section className="py-12" id="terms" style={{ background: '#fff', borderTop: `1px solid ${LINE}` }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="font-display text-lg font-extrabold mb-4" style={{ color: INK }}>Terms &amp; Conditions</h2>
          <div className="text-sm leading-relaxed space-y-2" style={{ color: INK2 }}>
            <p>* <strong>Treatment Duration:</strong> The duration of treatment depends on the complexity of each individual case. Results and timelines vary from person to person. The "6 months" claim is indicative of average mild-to-moderate cases and is not a guarantee for all patients.</p>
            <p>* <strong>Pricing:</strong> ₹4,999 per month is indicative. Final pricing and treatment duration depend on your individual teeth condition and will be communicated after a clinical assessment and 3D scan during the free consultation.</p>
            <p>* OrisAlign aligners must be worn 20–22 hours per day for optimal results. Non-compliance may affect treatment outcome and duration.</p>
            <p>* Results may vary. Before-and-after images shown are of actual OrisAlign patients and individual outcomes vary.</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-16" style={{ background: INK, color: '#c3cace' }} id="contact">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="lg:col-span-2">
              <img src="/logo2.png" alt="OrisAlign" className="h-10 w-auto mb-4 brightness-0 invert" />
              <p className="text-sm mb-4 leading-relaxed" style={{ color: '#8a949a' }}>Clear aligners designed and supervised by expert dentists. Helping Bhubaneswar smile better — affordably.</p>
              <div className="flex gap-3">
                {[
                  { label: 'Facebook', href: 'https://www.facebook.com/share/1Dn6whtfiS/' },
                  { label: 'Instagram', href: 'https://www.instagram.com/orisalign?igsh=ZjF3ZThpdHAzM2pm' },
                  { label: 'YouTube', href: '#' },
                ].map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-full transition-colors" style={{ background: 'rgba(255,255,255,0.08)', color: '#e5e7eb' }}
                    onMouseEnter={e => { e.currentTarget.style.background = GOLD; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e5e7eb' }}
                  >{s.label}</a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wide">Quick Links</h4>
              <div className="space-y-2 text-sm">
                {['How It Works', 'Pricing', 'Before & After', 'FAQs'].map(l => (
                  <div key={l}><a href="#" className="transition-colors" style={{ color: '#8a949a' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#8a949a'}>{l}</a></div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wide">Contact</h4>
              <div className="space-y-3 text-sm" style={{ color: '#8a949a' }}>
                <div className="flex gap-2.5"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} /><span>MIG-1, 43/5, Housing Board Colony, Chandrasekharpur, Bhubaneswar – 751016, Odisha</span></div>
                <div className="flex gap-2.5"><Mail className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} /><a href="mailto:hello@orisalign.com" className="transition-colors" onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#8a949a'}>hello@orisalign.com</a></div>
                <div className="flex gap-2.5"><Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} /><span>Mon–Sat, 10am–7pm</span></div>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: '#6b7479' }}>
            <p>© 2026 OrisAlign. All rights reserved. | Designed by expert dentists</p>
            <div className="flex gap-4 flex-wrap justify-center">
              <a href="/checkout/login" className="transition-colors" onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#6b7479'}>Checkout</a>
              <a href="/terms" className="transition-colors" onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#6b7479'}>Terms &amp; Conditions</a>
              <a href="/privacy-policy" className="transition-colors" onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#6b7479'}>Privacy Policy</a>
              <a href="/refund-policy" className="transition-colors" onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#6b7479'}>Refund Policy</a>
              <Link href="/login" className="transition-colors" onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#6b7479'}>Staff Login</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ── FLOATING WHATSAPP (desktop) ── */}
      <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
        className="hidden sm:flex fixed bottom-6 right-6 z-40 text-white w-14 h-14 rounded-full items-center justify-center transition-transform hover:scale-105"
        style={{ background: '#25D366', boxShadow: '0 12px 28px -8px rgba(37,211,102,.6)' }}
        title="Chat on WhatsApp"
      >
        <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24"><path d={WA_ICON} /></svg>
      </a>

    </div>
  )
}
