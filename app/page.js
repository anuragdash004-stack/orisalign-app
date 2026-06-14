'use client'
import { useState } from 'react'
import Link from 'next/link'

const NAVY = '#1B2A4A'
const GOLD = '#C9A84C'

const NAV_LINKS = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Before & After', href: '#gallery' },
  { label: 'OrisPromise', href: '#orispromise' },
  { label: 'FAQs', href: '#faq' },
]

const COMPARISON = [
  { feature: 'Visibility', orisalign: 'Invisible', braces: 'Very visible', invisalign: 'Nearly invisible' },
  { feature: 'Monthly cost', orisalign: '₹3,999/mo*', braces: '₹2,499/mo*', invisalign: '₹5,000–10,000/mo*' },
  { feature: 'Total cost', orisalign: '₹40–60K*', braces: '₹30–40K*', invisalign: '₹1.5L–3L*' },
  { feature: 'Treatment time', orisalign: '6–12 months*', braces: '12–36 months*', invisalign: '6–12 months*' },
  { feature: 'Removable', orisalign: '✓ Yes', braces: '✗ No', invisalign: '✓ Yes' },
  { feature: 'Food restrictions', orisalign: 'None', braces: 'Many', invisalign: 'None' },
  { feature: 'Made in India', orisalign: '✓ Yes', braces: '✓ Yes', invisalign: '✗ Imported' },
  { feature: 'Doctor supervised', orisalign: '✓ Always', braces: '✓ Always', invisalign: '✓ Always' },
  { feature: 'Transparent Pricing', orisalign: '✓ Yes', braces: '✗ No', invisalign: '✗ No' },
  { feature: 'Clinic', orisalign: 'Personal clinic', braces: 'Varies', invisalign: '✗ No' },
  { feature: '24/7 Support', orisalign: '✓ Yes', braces: '✗ No', invisalign: '✗ No' },
  { feature: 'Waiting period', orisalign: '10 days', braces: '15 days', invisalign: '1.5–2 months' },
]

const STEPS = [
  { icon: '🦷', title: 'Consultation', desc: 'Visit our clinic or book a home consultation. Our expert dentist reviews your teeth — at just ₹199 (regular price ₹599).' },
  { icon: '📡', title: '3D Scan', desc: 'A quick, painless 3D scan of your teeth. No moulds. Done in minutes.' },
  { icon: '📋', title: 'Planning', desc: 'Your provisional plan and planning video are shared immediately. On enrolling, the final treatment plan and duration will be given within 48 hours.' },
  { icon: '📦', title: 'Aligners Delivered', desc: 'Your custom aligners are manufactured in India and delivered to you in just 10 days.' },
  { icon: '😁', title: 'Smile in 6 Months*', desc: 'Wear aligners 20–22 hrs/day, swap sets every 2 weeks. Track progress with monthly check-ins and 24/7 support.' },
]

const FAQS = [
  { q: 'How much do OrisAlign aligners cost?', a: 'Treatment starts at ₹47,999 (EMI available from ₹3,999/month*). Final cost depends on complexity. We give a full quote after the consultation — no surprises.' },
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
const WA_LINK = "https://wa.me/918069645412?text=Hi%2C+I%27d+like+to+know+more+about+OrisAlign"

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
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-[#F0E4B8] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img
              src="/logo2.png"
              alt="OrisAlign – Clear Aligners Bhubaneswar"
              className="h-14 w-auto"
              style={{ mixBlendMode: 'multiply' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
            {/* Fallback text if logo2.png not yet uploaded */}
            <span className="items-center gap-1 hidden" style={{display:'none'}}>
              <span className="text-2xl font-black tracking-tight" style={{ color: NAVY }}>Oris</span>
              <span className="text-2xl font-black tracking-tight" style={{ color: GOLD }}>Align</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} className="text-sm font-medium transition-colors hover:opacity-70" style={{ color: NAVY }}>{l.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a href="/patient" className="hidden sm:block text-sm font-semibold px-5 py-2 rounded-full transition-colors hover:opacity-80" style={{ background: GOLD, color: NAVY }}>
              Patient Login
            </a>
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden px-4 pb-4 border-t border-[#F0E4B8] bg-white">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} className="block py-3 text-sm border-b border-gray-50" style={{ color: NAVY }}>{l.label}</a>
            ))}
            <a href="/patient" onClick={() => setMenuOpen(false)} className="block mt-3 text-center text-sm font-semibold px-4 py-3 rounded-full" style={{ background: GOLD, color: NAVY }}>
              Patient Login
            </a>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="pt-16 min-h-screen flex items-center" style={{ background: 'linear-gradient(135deg, #FBF7EE 0%, #ffffff 50%, #F5EDD6 100%)' }}>
        <div className="max-w-6xl mx-auto px-4 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-wide" style={{ background: '#F5EDD6', color: NAVY }}>
              #1 Clear Aligners in Odisha
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-2" style={{ color: NAVY }}>
              Straighter teeth<br />
              <span style={{ color: GOLD }}>in 6 months*</span>
            </h1>
            <p className="text-xs text-gray-400 mb-4">*Terms & conditions apply</p>
            <p className="text-lg sm:text-xl text-gray-600 mb-4 leading-relaxed">
              Clear aligners starting with an easy EMI of <span className="font-bold" style={{ color: NAVY }}>₹3,999/- per month*</span>. Designed and supervised by our team of expert dentists.
            </p>
            <p className="text-base font-semibold mb-8" style={{ color: GOLD }}>
              🇮🇳 Made in India &nbsp;·&nbsp; Invisible &nbsp;·&nbsp; No food restrictions
            </p>
            {/* Yellow banner with i button inline after text */}
            <div className="mb-4 rounded-2xl overflow-hidden" style={{ border: '1.5px solid #f59e0b' }}>
              <div className="px-4 py-3 font-semibold" style={{ background: '#FFF3CD', color: '#92400e' }}>
                <div className="flex items-center gap-1 text-xs flex-wrap">
                  🎯 Book your smile assessment for
                  <button
                    onClick={() => setAssessmentOpen(o => !o)}
                    className="w-5 h-5 rounded-full border-2 inline-flex items-center justify-center font-black transition-colors flex-shrink-0"
                    style={{ borderColor: '#92400e', background: assessmentOpen ? '#92400e' : '#FFF3CD', fontSize: '11px', fontStyle: 'italic', lineHeight: 1 }}
                    aria-label="What's included in the smile assessment"
                  >
                    <span style={{ color: assessmentOpen ? '#fff' : '#92400e' }}>i</span>
                  </button>
                  <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>₹599</span>
                  <span className="font-black" style={{ color: '#b45309' }}>₹199</span>
                  — offer ends soon!
                </div>
                <div className="text-xs mt-1 font-medium" style={{ color: '#92400e' }}>✅ No prior payment &nbsp;·&nbsp; Pay on spot &nbsp;·&nbsp; ⚡ Hurry up — limited slots!</div>
              </div>
              {assessmentOpen && (
                <div className="border-t" style={{ borderColor: '#f59e0b' }}>
                  {[
                    { label: 'Expert dentist consultation', value: 'worth ₹499' },
                    { label: '3D dental scan', value: 'worth ₹7,999' },
                    { label: 'Provisional diagnosis & planning', value: 'Included' },
                    { label: 'Provisional 3D planning video', value: 'Included' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 text-sm" style={{ borderColor: '#FDE68A', background: '#FFFDF5' }}>
                      <span className="font-medium" style={{ color: NAVY }}>✦ {item.label}</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full ml-2 flex-shrink-0" style={{ background: '#f59e0b', color: '#fff' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="/book" className="text-base font-bold px-8 py-4 rounded-full transition-all shadow-lg text-center" style={{ background: GOLD, color: NAVY, boxShadow: `0 8px 24px ${GOLD}55` }}>
                Book your smile assessment →
              </a>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 border-2 text-base font-semibold px-8 py-4 rounded-full hover:border-green-500 hover:text-green-700 transition-all" style={{ borderColor: '#e5e7eb', color: '#374151' }}>
                <svg className="w-5 h-5 fill-current text-green-600" viewBox="0 0 24 24"><path d={WA_ICON}/></svg>
                Chat on WhatsApp
              </a>
            </div>

          </div>
          <div className="relative">
            <div className="rounded-3xl overflow-hidden shadow-xl aspect-square">
              <img
                src="/smiles-collage.jpg"
                alt="OrisAlign patients – 500+ smiles transformed in Bhubaneswar Odisha"
                className="w-full h-full object-cover"
              />
              <div className="absolute -bottom-4 -right-4 bg-white rounded-2xl shadow-lg p-4 flex items-center gap-3">
                <div className="text-3xl">⭐</div>
                <div>
                  <div className="font-black text-lg" style={{ color: NAVY }}>4.9/5</div>
                  <div className="text-xs text-gray-500">Google Rating</div>
                </div>
              </div>
            </div>
            <div className="absolute -top-4 -left-4 bg-white rounded-2xl shadow-lg p-3 flex items-center gap-2">
              <div className="text-2xl">✅</div>
              <div className="text-xs font-bold" style={{ color: NAVY }}>500+ Smiles</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className="py-5 text-white" style={{ background: NAVY }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm font-medium">
            <span className="flex items-center gap-2">👨‍⚕️ Designed by expert dentists</span>
            <span className="hidden sm:block" style={{ color: GOLD }}>|</span>
            <span className="flex items-center gap-2">😁 500+ Smiles Transformed</span>
            <span className="hidden sm:block" style={{ color: GOLD }}>|</span>
            <span className="flex items-center gap-2">🇮🇳 Made in India</span>
            <span className="hidden sm:block" style={{ color: GOLD }}>|</span>
            <span className="flex items-center gap-2">⭐ 4.9 Google Rating</span>
            <span className="hidden sm:block" style={{ color: GOLD }}>|</span>
            <span className="flex items-center gap-2">📍 Bhubaneswar, Odisha</span>
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="py-20 bg-white" id="compare">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>OrisAlign vs Metal Braces vs Other Aligner Brands</h2>
            <p className="text-gray-500 max-w-xl mx-auto">An honest comparison. We believe you should choose with full information.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border shadow-sm" style={{ borderColor: '#F0E4B8' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-5 py-4 font-bold text-gray-500 w-1/4">Feature</th>
                  <th className="px-5 py-5 border-x-2" style={{ color: GOLD, background: '#FBF7EE', borderColor: '#E8D5A0' }}>
                    <span className="block text-2xl font-black tracking-tight leading-tight" style={{ color: GOLD }}>OrisAlign</span>
                    <span className="block text-lg font-black mt-0.5" style={{ color: GOLD }}>✓</span>
                  </th>
                  <th className="px-5 py-5 text-[11px] font-medium text-gray-400 leading-tight">Metal<br/>Braces</th>
                  <th className="px-5 py-5 text-[11px] font-medium text-gray-400 leading-tight">Other<br/>Aligner Brands</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-5 py-3.5 font-medium text-gray-700">{row.feature}</td>
                    <td className="px-5 py-3.5 text-center font-semibold border-x-2" style={{ color: GOLD, background: '#FBF7EE', borderColor: '#F0E4B8' }}>{row.orisalign}</td>
                    <td className="px-5 py-3.5 text-center text-gray-600">{row.braces}</td>
                    <td className="px-5 py-3.5 text-center text-gray-600">{row.invisalign}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">*Prices are indicative. Exact cost depends on case complexity.</p>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20" id="how-it-works" style={{ background: 'linear-gradient(to bottom, #FBF7EE, #ffffff)' }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>How It Works</h2>
            <p className="text-gray-500">5 simple steps to your new smile.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="relative bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                <div className="absolute top-3 left-3 z-10 text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center" style={{ background: GOLD, color: NAVY }}>
                  {i + 1}
                </div>
                {i === 0 ? (
                  <img src="/consult.jpg" alt="Consultation" className="w-full h-44 object-cover" />
                ) : i === 1 ? (
                  <img src="/step-scan.jpg" alt="3D Scan" className="w-full h-44 object-cover" />
                ) : i === 2 ? (
                  <img src="/step-plan.jpg" alt="Planning" className="w-full h-44 object-cover" />
                ) : i === 3 ? (
                  <img src="/alignerwear.png" alt="Aligners Delivered" className="w-full h-44 object-cover" />
                ) : (
                  <img src="/girlsmile.png" alt="Smile in 6 Months" className="w-full h-44 object-cover" />
                )}
                <div className="p-5">
                  <h3 className="font-bold mb-2" style={{ color: NAVY }}>{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="/book" className="font-bold px-8 py-4 rounded-full transition-all shadow-lg inline-block" style={{ background: GOLD, color: NAVY, boxShadow: `0 8px 24px ${GOLD}44` }}>
              Start Step 1 — Book Free Consult →
            </a>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-20 bg-white" id="pricing">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>Transparent Pricing</h2>
            <p className="text-gray-500">No hidden fees. What you see is what you pay.</p>
          </div>

          {/* Single pricing card */}
          <div className="rounded-3xl border-2 overflow-hidden shadow-lg" style={{ borderColor: GOLD }}>
            {/* Header */}
            <div className="px-8 py-8 text-center" style={{ background: `linear-gradient(135deg, ${NAVY}, #0F1E33)` }}>
              <div className="flex items-end justify-center gap-2 mb-1">
                <span className="text-lg font-semibold" style={{ color: '#E8D9A0' }}>Starts at</span>
                <span className="text-2xl font-bold line-through mb-1" style={{ color: '#94a3b8' }}>₹54,999</span>
                <span className="text-5xl font-black" style={{ color: GOLD }}>₹47,999</span>
                <span className="text-base font-semibold mb-1" style={{ color: '#E8D9A0' }}>*</span>
              </div>
              <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>or ₹3,999/month* — No cost EMI available*</p>
            </div>

            {/* Freebies */}
            <div className="px-8 py-6 space-y-3" style={{ background: '#FBF7EE' }}>
              {/* Freebies header — styled as a card row, i button tight after ₹9,999 */}
              <div className="rounded-xl bg-white border overflow-hidden" style={{ borderColor: '#E8D5A0' }}>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="flex items-center gap-3 text-sm font-medium" style={{ color: NAVY }}>
                    <span className="text-base">🎁</span>
                    <span>
                      Benefits <span className="text-xs font-semibold" style={{ color: GOLD }}>worth ₹9,999</span>
                      <button
                        onClick={() => setFreebiesOpen(!freebiesOpen)}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full border-2 font-black transition-colors align-middle ml-1 flex-shrink-0"
                        style={{ borderColor: NAVY, background: freebiesOpen ? NAVY : '#FBF7EE', fontSize: '11px', fontStyle: 'italic', lineHeight: 1 }}
                        aria-label="What's included in freebies"
                      >
                        <span style={{ color: freebiesOpen ? '#fff' : NAVY }}>i</span>
                      </button>
                    </span>
                  </span>
                  <span className="text-xs text-gray-400 italic">included with every treatment</span>
                </div>

                {/* 3 freebies — expand when i is tapped */}
                {freebiesOpen && (
                  <div className="border-t" style={{ borderColor: '#F0E4B8' }}>
                    {[
                      { icon: '✨', label: 'Scaling & polishing ×2' },
                      { icon: '💎', label: '1 set transparent retainer' },
                      { icon: '🦷', label: '1 set metal retainer' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0" style={{ borderColor: '#F0E4B8', background: '#FFFDF5' }}>
                        <span className="flex items-center gap-3 text-sm font-medium" style={{ color: NAVY }}>
                          <span className="text-base">{item.icon}</span>
                          {item.label}
                        </span>
                        <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: GOLD, color: NAVY }}>Free</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lifetime membership card — always visible, i button before Free badge */}
              <ul className="space-y-3">
                <li className="rounded-xl bg-white border overflow-hidden" style={{ borderColor: '#E8D5A0' }}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="flex items-center gap-2 text-sm font-medium" style={{ color: NAVY }}>
                      <span className="text-base">🪪</span>
                      Lifetime membership card <span className="text-xs font-semibold" style={{ color: GOLD }}>worth ₹4,999</span>
                      <button
                        onClick={() => setMembershipOpen(!membershipOpen)}
                        className="w-5 h-5 rounded-full border-2 inline-flex items-center justify-center font-black transition-colors flex-shrink-0"
                        style={{ borderColor: NAVY, background: membershipOpen ? NAVY : '#FBF7EE', fontSize: '11px', fontStyle: 'italic', lineHeight: 1 }}
                        aria-label="Membership card details"
                      >
                        <span style={{ color: membershipOpen ? '#fff' : NAVY }}>i</span>
                      </button>
                    </span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: GOLD, color: NAVY }}>Free</span>
                  </div>
                  {membershipOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs leading-relaxed space-y-1.5 border-t" style={{ borderColor: '#F0E4B8', background: '#FFFDF5' }}>
                      <p className="font-bold text-sm mb-2" style={{ color: NAVY }}>What's included in your Lifetime Membership:</p>
                      <div className="flex items-start gap-2">
                        <span style={{ color: GOLD }}>✦</span>
                        <span style={{ color: '#374151' }}><strong>30% off</strong> on any dental treatment or surgery — for the lifetime of the card holder</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span style={{ color: GOLD }}>✦</span>
                        <span style={{ color: '#374151' }}>Benefit also applies to <strong>+1 person</strong> of the card holder's choice <span className="text-gray-400">(add-on facility available)</span></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span style={{ color: GOLD }}>✦</span>
                        <span style={{ color: '#374151' }}><strong>15% off</strong> for friends &amp; family</span>
                      </div>
                    </div>
                  )}
                </li>
              </ul>
            </div>

            {/* CTA */}
            <div className="px-8 py-6 text-center bg-white">
              <a href="/book" className="inline-block font-bold px-10 py-4 rounded-full text-base transition-all shadow-lg" style={{ background: GOLD, color: NAVY, boxShadow: `0 8px 24px ${GOLD}55` }}>
                Book Your ₹199 Scan →
              </a>
              <p className="text-xs text-gray-400 mt-3">Exact pricing shared after consultation — your case may cost less.</p>
              <p className="text-xs text-gray-400 mt-1">The lifetime membership card is provided by <span className="font-semibold">Kalp Dental Clinic</span>.</p>
              <p className="text-xs mt-1.5 font-semibold" style={{ color: NAVY }}>Other solutions available — <a href="#still-in-doubt" style={{ color: GOLD, textDecoration: 'underline' }}>contact us to know more</a></p>
            </div>
          </div>

          {/* EMI note */}
          <div className="mt-6 rounded-2xl p-5 text-center" style={{ background: '#FBF7EE', border: `1px solid ${GOLD}66` }}>
            <p className="text-sm" style={{ color: NAVY }}>
              <strong>💳 No-cost EMI*</strong> available via HDFC, ICICI, Bajaj Finserv & more.
            </p>
          </div>

          {/* OrisPromise */}
          <div id="orispromise" className="mt-6 rounded-3xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0f2027 100%)`, boxShadow: `0 8px 32px ${NAVY}88` }}>
            {/* Badge header */}
            <div className="px-6 pt-7 pb-4 text-center border-b" style={{ borderColor: 'rgba(201,168,76,0.2)' }}>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{ background: 'rgba(201,168,76,0.12)', border: `2px solid ${GOLD}` }}>
                <span className="text-2xl">🛡️</span>
              </div>
              <div className="text-2xl font-black uppercase tracking-widest mb-1" style={{ color: GOLD }}>ORIS-PROMISE</div>
              <h3 className="text-xl font-black" style={{ color: '#fff' }}>You trust us.</h3>
              <h3 className="text-xl font-black mb-1" style={{ color: '#fff' }}>We take your responsibility.</h3>
            </div>

            {/* Promise body */}
            <div className="px-6 py-5 space-y-4">
              {/* Condition */}
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="mt-0.5 text-base flex-shrink-0">📋</span>
                <p className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>
                  Just follow our instructions and complete the treatment as per our doctor's advice.
                </p>
              </div>

              {/* Guarantee */}
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(201,168,76,0.08)', border: `1px solid ${GOLD}33` }}>
                <span className="mt-0.5 text-base flex-shrink-0">✨</span>
                <p className="text-sm leading-relaxed" style={{ color: '#E8D9A0' }}>
                  Any extension of treatment beyond the committed timeline will be <strong style={{ color: '#fff' }}>entirely on us — no additional charges, ever.</strong>
                </p>
              </div>

              {/* Pills */}
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {['✅ Treatment guarantee', '✅ No hidden charges', '✅ Extension covered by us'].map((t, i) => (
                  <span key={i} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALLBACK / CONTACT ── */}
      <section id="still-in-doubt" className="py-16" style={{ background: 'linear-gradient(135deg, #FBF7EE 0%, #ffffff 100%)' }}>
        <div className="max-w-2xl mx-auto px-4">
          <div className="rounded-3xl overflow-hidden shadow-md border" style={{ borderColor: '#E8D5A0' }}>

            {/* Header */}
            <div className="px-8 pt-8 pb-6 text-center" style={{ background: `linear-gradient(135deg, ${NAVY}, #0F1E33)` }}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4" style={{ background: 'rgba(201,168,76,0.15)', border: `1.5px solid ${GOLD}` }}>
                <span className="text-2xl">🤔</span>
              </div>
              <h2 className="text-2xl font-black mb-1" style={{ color: '#fff' }}>Still in doubt?</h2>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Let our expert team reach out to you — no pressure, just answers.</p>
            </div>

            <div className="px-8 py-8 bg-white">
              {!callbackSubmitted ? (
                <>
                  {/* Collapsible callback trigger — attractive box */}
                  <div className="rounded-2xl overflow-hidden mb-4" style={{ border: `1.5px solid ${callbackOpen ? GOLD : '#E8D5A0'}`, boxShadow: callbackOpen ? `0 4px 20px ${GOLD}33` : 'none', transition: 'box-shadow 0.3s' }}>
                    <button
                      onClick={() => setCallbackOpen(o => !o)}
                      className="w-full flex items-center justify-between px-5 py-4 transition-all"
                      style={{ background: callbackOpen ? `linear-gradient(135deg, ${NAVY}, #0F1E33)` : 'linear-gradient(135deg, #FBF7EE, #FFF8E7)' }}
                    >
                      <span className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0" style={{ background: callbackOpen ? 'rgba(201,168,76,0.2)' : GOLD }}>
                          <span className="text-base">📞</span>
                        </span>
                        <span>
                          <span className="block font-black text-sm" style={{ color: callbackOpen ? '#fff' : NAVY }}>Request a free callback</span>
                          <span className="block text-xs mt-0.5" style={{ color: callbackOpen ? '#94a3b8' : '#6b7280' }}>We'll call you within 24 hours</span>
                        </span>
                      </span>
                      <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: callbackOpen ? 'rgba(255,255,255,0.1)' : '#E8D5A0' }}>
                        <svg className="w-3.5 h-3.5 transition-transform" style={{ transform: callbackOpen ? 'rotate(180deg)' : 'none', fill: callbackOpen ? '#fff' : NAVY }} viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                      </span>
                    </button>

                  {/* Expandable form */}
                  {callbackOpen && (
                    <form onSubmit={handleCallbackSubmit} className="space-y-4 px-5 pb-5 pt-4" style={{ background: '#FFFDF5', borderTop: `1px solid ${GOLD}44` }}>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: NAVY }}>Your Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Priya Sharma"
                          value={callbackForm.name}
                          onChange={e => setCallbackForm(f => ({ ...f, name: e.target.value }))}
                          required
                          className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
                          style={{ borderColor: '#E8D5A0', background: '#FFFDF5' }}
                          onFocus={e => e.target.style.borderColor = GOLD}
                          onBlur={e => e.target.style.borderColor = '#E8D5A0'}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: NAVY }}>Phone Number</label>
                        <input
                          type="tel"
                          placeholder="e.g. 98765 43210"
                          value={callbackForm.phone}
                          onChange={e => setCallbackForm(f => ({ ...f, phone: e.target.value }))}
                          required
                          className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
                          style={{ borderColor: '#E8D5A0', background: '#FFFDF5' }}
                          onFocus={e => e.target.style.borderColor = GOLD}
                          onBlur={e => e.target.style.borderColor = '#E8D5A0'}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={callbackLoading}
                        className="w-full py-3.5 rounded-xl font-bold text-sm transition-all"
                        style={{ background: GOLD, color: NAVY, opacity: callbackLoading ? 0.7 : 1 }}
                      >
                        {callbackLoading ? 'Submitting…' : 'Submit →'}
                      </button>
                    </form>
                  )}
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px" style={{ background: '#E8D5A0' }} />
                    <span className="text-xs text-gray-400 font-medium">or reach us directly</span>
                    <div className="flex-1 h-px" style={{ background: '#E8D5A0' }} />
                  </div>

                  {/* Direct contact buttons */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <a
                      href="mailto:hello@orisalign.com"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition-all hover:shadow-md"
                      style={{ borderColor: '#E8D5A0', color: NAVY, background: '#FFFDF5' }}
                    >
                      <span className="text-base">✉️</span>
                      Mail Us
                    </a>
                    <a
                      href={WA_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-md"
                      style={{ background: '#25D366', color: '#fff' }}
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d={WA_ICON}/></svg>
                      WhatsApp
                    </a>
                  </div>
                  <p className="text-center text-xs text-gray-400 mt-3">hello@orisalign.com</p>
                </>
              ) : (
                /* Success state */
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: '#F0FDF4', border: '2px solid #86efac' }}>
                    <span className="text-3xl">✅</span>
                  </div>
                  <h3 className="text-lg font-black mb-2" style={{ color: NAVY }}>Request received!</h3>
                  <p className="text-sm text-gray-500 mb-6">We'll call you within <strong>24 hours</strong>. Our team looks forward to speaking with you.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href="mailto:hello@orisalign.com"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm"
                      style={{ borderColor: '#E8D5A0', color: NAVY, background: '#FFFDF5' }}
                    >
                      <span className="text-base">✉️</span>
                      Mail Us
                    </a>
                    <a
                      href={WA_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm"
                      style={{ background: '#25D366', color: '#fff' }}
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d={WA_ICON}/></svg>
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
      <section className="py-20 bg-gray-50" id="gallery">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>Real Patient Results</h2>
            <p className="text-gray-500">Before & after photos from actual OrisAlign patients. No editing.</p>
          </div>
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100">
              <img src="/beforeafter.jpeg" alt="Before and After OrisAlign Treatment" className="w-full object-cover" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-black" style={{ color: NAVY }}>Crowding & Spacing Correction</span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#F5EDD6', color: NAVY }}>8 months*</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">From misaligned, crowded teeth to a confident, straight smile — achieved with OrisAlign clear aligners in just 8 months. Shared with patient consent.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 bg-white" id="testimonials">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>What Our Patients Say</h2>
            <p className="text-gray-500">Real people. Real results. From Bhubaneswar.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            {[
              { name: 'Priya M.', age: '24', duration: '7 months*', quote: 'I was nervous about the process but our expert dentist explained everything clearly. My teeth look amazing and nobody even noticed I was wearing aligners!' },
              { name: 'Rahul K.', age: '31', duration: '13 months*', quote: 'Compared quotes from 3 clinics — OrisAlign was the most affordable with the most professional setup. It took time but it was the best decision I made.' },
              { name: 'Ananya S.', age: '19', duration: '9 months*', quote: "As a college student I was worried about how I'd look. Completely invisible. My confidence has gone through the roof." },
            ].map((t, i) => (
              <div key={i} className="rounded-2xl p-6 border" style={{ background: '#FBF7EE', borderColor: '#E8D5A0' }}>
                <div className="flex text-yellow-400 text-sm mb-3">★★★★★</div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: '#E8D5A0', color: NAVY }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: NAVY }}>{t.name}, {t.age}</div>
                    <div className="text-xs text-gray-400">Treated in {t.duration}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Video testimonial */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-black mb-2" style={{ color: NAVY }}>Watch a Patient Story</h3>
            <p className="text-gray-500 text-sm mb-6">Real experience, real results.</p>
          </div>
          <div className="max-w-sm mx-auto">
            <a
              href="https://www.instagram.com/reel/DXcsnVrkr6c/?igsh=YTYxOWVwOHdoYWtu"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              style={{ background: NAVY }}
            >
              <div className="aspect-[9/16] flex flex-col items-center justify-center gap-4 p-8" style={{ background: 'linear-gradient(135deg, #1B2A4A, #0F1E33)' }}>
                <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl" style={{ background: 'linear-gradient(135deg, #C9A84C, #f59e0b)' }}>
                  <svg className="w-9 h-9 fill-white ml-1.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-base mb-1">Patient Testimonial</p>
                  <p className="text-gray-400 text-sm">Watch on Instagram →</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="url(#ig)">
                    <defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="25%" stopColor="#e6683c"/><stop offset="50%" stopColor="#dc2743"/><stop offset="75%" stopColor="#cc2366"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs>
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <span className="text-xs text-gray-400">@orisalign on Instagram</span>
                </div>
              </div>
            </a>
          </div>

        </div>
      </section>

      {/* ── MEET THE DOCTOR ── */}
      <section className="py-20 text-white" id="doctor" style={{ background: `linear-gradient(135deg, ${NAVY}, #0F1E33)` }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-black mb-6">Meet Our Expert Team</h2>
            <p className="text-base mb-8 leading-relaxed" style={{ color: '#E8D9A0' }}>
              Our expert dentists have more than 10 years of experience and have transformed 5000+ smiles using clear aligner therapy. The vision is to make OrisAlign a premium orthodontic care accessible to everyone in Odisha — at a fair, transparent price.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm mb-8 text-left max-w-md mx-auto" style={{ color: '#F5EDD6' }}>
              {[
                '🎓 Expertise in Aligner therapy',
                '📍 Practicing since 10 years',
                '🦷 5000+ clear aligner cases',
                '🇮🇳 Committed to Made-in-India dentistry',
              ].map((item, i) => <div key={i} className="flex items-center gap-2">{item}</div>)}
            </div>
            <div className="inline-block mb-5 px-5 py-2 rounded-full text-sm font-semibold" style={{ background: 'rgba(201,168,76,0.2)', color: GOLD, border: `1px solid ${GOLD}66` }}>
              📹 We also provide video consultations
            </div>
            <div>
              <a href="/book" className="inline-block font-bold px-6 py-3 rounded-full transition-colors" style={{ background: GOLD, color: NAVY }}>
                Book with an Expert →
              </a>
            </div>
          </div>
        </div>
      </section>


      {/* ── FAQ ── */}
      <section className="py-20 bg-gray-50" id="faq">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>Frequently Asked Questions</h2>
            <p className="text-gray-500">Honest answers to the questions we get most.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  className="w-full text-left px-6 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-sm leading-snug" style={{ color: NAVY }}>{faq.q}</span>
                  <span className="font-bold text-lg mt-0.5 flex-shrink-0 transition-transform" style={{ color: GOLD, transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-50">
                    <p className="pt-3">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TERMS & CONDITIONS ── */}
      <section className="py-12 bg-gray-50" id="terms">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-lg font-black mb-4" style={{ color: NAVY }}>Terms & Conditions</h2>
          <div className="text-sm text-gray-500 leading-relaxed space-y-2">
            <p>* <strong>Treatment Duration:</strong> The duration of treatment depends on the complexity of each individual case. Results and timelines vary from person to person. The "6 months" claim is indicative of average mild-to-moderate cases and is not a guarantee for all patients.</p>
            <p>* Pricing mentioned is indicative and subject to change. Final treatment cost will be communicated after a clinical assessment and 3D scan during the free consultation.</p>
            <p>* OrisAlign aligners must be worn 20–22 hours per day for optimal results. Non-compliance may affect treatment outcome and duration.</p>
            <p>* Results may vary. Before-and-after images shown are of actual OrisAlign patients and individual outcomes vary.</p>
          </div>
        </div>
      </section>


      {/* ── FOOTER ── */}
      <footer className="py-16 text-gray-300" style={{ background: NAVY }} id="contact">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="lg:col-span-2">
              <img src="/logo2.png" alt="OrisAlign" className="h-10 w-auto mb-3 brightness-0 invert" />
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">Clear aligners designed and supervised by expert dentists. Helping Bhubaneswar smile better — affordably.</p>
              <div className="flex gap-3">
                {[
                  { label: 'Facebook', href: 'https://www.facebook.com/share/1Dn6whtfiS/' },
                  { label: 'Instagram', href: 'https://www.instagram.com/orisalign?igsh=ZjF3ZThpdHAzM2pm' },
                  { label: 'YouTube', href: '#' },
                ].map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-full transition-colors" style={{ background: 'rgba(255,255,255,0.1)', color: '#e5e7eb' }}
                    onMouseEnter={e => { e.currentTarget.style.background = GOLD; e.currentTarget.style.color = NAVY }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#e5e7eb' }}
                  >{s.label}</a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wide">Quick Links</h4>
              <div className="space-y-2 text-sm">
                {['How It Works', 'Pricing', 'Before & After', 'FAQs', 'Book Consultation'].map(l => (
                  <div key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wide">Contact</h4>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2"><span>📍</span><span>Bhubaneswar – 751016, Odisha</span></div>
                <div className="flex gap-2"><span>📧</span><a href="mailto:hello@orisalign.com" className="hover:text-white">hello@orisalign.com</a></div>
                <div className="flex gap-2"><span>🕐</span><span>Mon–Sat, 10am–7pm</span></div>
              </div>
            </div>
          </div>


          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <p>© 2026 OrisAlign. All rights reserved. | Designed by expert dentists</p>
            <div className="flex gap-4">
              <a href="/terms" className="hover:text-white">Terms &amp; Conditions</a>
              <a href="/privacy-policy" className="hover:text-white">Privacy Policy</a>
              <a href="/refund-policy" className="hover:text-white">Refund Policy</a>
              <Link href="/login" className="hover:text-white">Staff Login</Link>
            </div>
          </div>
        </div>
      </footer>


      {/* ── FLOATING WHATSAPP (desktop) ── */}
      <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
        className="hidden sm:flex fixed bottom-6 right-6 z-40 bg-green-500 hover:bg-green-600 text-white w-14 h-14 rounded-full items-center justify-center shadow-xl transition-all hover:scale-110"
        title="Chat on WhatsApp"
      >
        <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24"><path d={WA_ICON}/></svg>
      </a>

    </div>
  )
}
