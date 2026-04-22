'use client'
import { useState } from 'react'
import Link from 'next/link'

const NAVY = '#1B2A4A'
const GOLD = '#C9A84C'

const NAV_LINKS = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Before & After', href: '#gallery' },
  { label: 'FAQs', href: '#faq' },
]

const COMPARISON = [
  { feature: 'Visible?', orisalign: 'Nearly invisible', braces: 'Very visible', invisalign: 'Nearly invisible' },
  { feature: 'Monthly cost', orisalign: '₹2,499/mo', braces: '₹1,500–3,000/mo', invisalign: '₹5,000–8,000/mo' },
  { feature: 'Total cost', orisalign: '₹60K–90K', braces: '₹40K–80K', invisalign: '₹1.5L–3L' },
  { feature: 'Treatment time', orisalign: '6–12 months', braces: '18–36 months', invisalign: '12–18 months' },
  { feature: 'Removable', orisalign: '✓ Yes', braces: '✗ No', invisalign: '✓ Yes' },
  { feature: 'Food restrictions', orisalign: 'None', braces: 'Many', invisalign: 'None' },
  { feature: 'Made in India', orisalign: '✓ Yes', braces: '✓ Yes', invisalign: '✗ Imported' },
  { feature: 'Doctor supervised', orisalign: '✓ Always', braces: '✓ Always', invisalign: '✓ Always' },
  { feature: 'Clinic in Bhubaneswar', orisalign: '✓ Yes', braces: 'Varies', invisalign: 'Varies' },
]

const STEPS = [
  { icon: '🦷', title: 'Free Consultation', desc: 'Visit our Bhubaneswar clinic or book online. Dr. Dash reviews your teeth — no cost, no commitment.' },
  { icon: '📡', title: '3D Scan', desc: 'A quick, painless 3D scan of your teeth. No moulds. Done in minutes.' },
  { icon: '📦', title: 'Aligners Delivered', desc: 'Your custom aligners are manufactured in India and delivered to the clinic within 2–3 weeks.' },
  { icon: '😁', title: 'Smile in 6 Months', desc: 'Wear aligners 20–22 hrs/day, swap sets every 2 weeks. Track progress with monthly check-ins.' },
]

const FAQS = [
  { q: 'How much do OrisAlign aligners cost?', a: 'Treatment starts at ₹59,999 (paid as ₹2,499/month EMI). Final cost depends on complexity. We give a full quote after the free consultation — no surprises.' },
  { q: 'Are OrisAlign aligners as effective as Invisalign?', a: 'Yes. OrisAlign uses the same clear aligner technology, manufactured in India to international standards, supervised by Dr. Anurag Dash. Invisalign is imported and costs 2–3x more for comparable results.' },
  { q: 'How long does treatment take?', a: 'Most cases: 6–12 months. Mild cases can finish in as little as 4 months. Complex cases may take up to 18 months. Dr. Dash will give you an honest timeline at consultation.' },
  { q: 'Is the consultation really free?', a: 'Yes. No hidden charges. You get a full assessment, 3D scan preview, and treatment plan — completely free.' },
  { q: 'Can I eat normally with aligners?', a: 'Yes. Remove the aligners before eating or drinking anything other than water. No food restrictions at all.' },
  { q: 'Does it hurt?', a: 'There may be mild pressure for 1–2 days after switching to a new set. This is normal and means the aligners are working. Most patients describe it as discomfort, not pain.' },
  { q: 'How many hours a day do I wear them?', a: '20–22 hours per day. You take them out to eat, drink, brush, and floss.' },
  { q: 'What if I lose or break an aligner?', a: 'Contact us immediately. Replacement aligners can be ordered quickly. Avoid wearing a damaged aligner.' },
  { q: 'Do I need to visit the clinic often?', a: 'Monthly check-ins (15–20 minutes each). We also offer video consultations for minor queries.' },
  { q: 'Will I need retainers after treatment?', a: 'Yes. Retainers are essential to maintain your results. We provide retainers as part of the treatment package.' },
  { q: 'Is OrisAlign suitable for teenagers?', a: 'Yes, from age 14+ when adult teeth are fully grown. We have specific protocols for teen patients.' },
  { q: 'Can severe crowding be treated?', a: 'Mild to moderate cases respond excellently. Severe cases may need a combination approach — Dr. Dash will advise honestly.' },
  { q: 'What are the EMI options?', a: 'No-cost EMI available via major banks and fintech apps (Bajaj Finserv, HDFC, ICICI, etc.). Ask us at consultation.' },
  { q: 'Is OrisAlign available outside Bhubaneswar?', a: 'Currently we operate from our Bhubaneswar clinic. We are expanding — join the waitlist for other cities.' },
]

const BEFORE_AFTER = [
  { label: 'Crowding — 7 months', tag: 'Crowding' },
  { label: 'Spacing — 5 months', tag: 'Spacing' },
  { label: 'Overbite — 9 months', tag: 'Overbite' },
  { label: 'Mild crowding — 4 months', tag: 'Crowding' },
  { label: 'Deep bite — 10 months', tag: 'Deep Bite' },
  { label: 'Crossbite — 8 months', tag: 'Crossbite' },
]

const WA_ICON = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
const WA_LINK = "https://wa.me/918280837370?text=Hi%2C+I%27d+like+to+know+more+about+OrisAlign"

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-[#F0E4B8] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img
              src="/logo2.png"
              alt="OrisAlign"
              className="h-10 w-auto"
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
            <a href="#book" className="hidden sm:block text-sm font-semibold px-5 py-2 rounded-full transition-colors" style={{ background: GOLD, color: NAVY }}>
              Book Free Scan
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
            <a href="#book" onClick={() => setMenuOpen(false)} className="block mt-3 text-center text-sm font-semibold px-4 py-3 rounded-full" style={{ background: GOLD, color: NAVY }}>
              Book Free Scan
            </a>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="pt-16 min-h-screen flex items-center" style={{ background: 'linear-gradient(135deg, #FBF7EE 0%, #ffffff 50%, #F5EDD6 100%)' }}>
        <div className="max-w-6xl mx-auto px-4 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-wide" style={{ background: '#F5EDD6', color: NAVY }}>
              #1 Clear Aligners in Bhubaneswar
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6" style={{ color: NAVY }}>
              Straighter teeth<br />
              <span style={{ color: GOLD }}>in 6 months.</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-4 leading-relaxed">
              Clear aligners starting at <span className="font-bold" style={{ color: NAVY }}>₹2,499/month</span>. Designed and supervised by Dr. Anurag Dash, Bhubaneswar.
            </p>
            <p className="text-base font-semibold mb-8" style={{ color: GOLD }}>
              🇮🇳 Made in India &nbsp;·&nbsp; Nearly invisible &nbsp;·&nbsp; No food restrictions
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#book" className="text-base font-bold px-8 py-4 rounded-full transition-all shadow-lg text-center" style={{ background: GOLD, color: NAVY, boxShadow: `0 8px 24px ${GOLD}55` }}>
                Book Free Scan →
              </a>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 border-2 text-base font-semibold px-8 py-4 rounded-full hover:border-green-500 hover:text-green-700 transition-all" style={{ borderColor: '#e5e7eb', color: '#374151' }}>
                <svg className="w-5 h-5 fill-current text-green-600" viewBox="0 0 24 24"><path d={WA_ICON}/></svg>
                Chat on WhatsApp
              </a>
            </div>
            <p className="mt-4 text-xs text-gray-400">Free consultation · No credit card · Cancel anytime</p>
          </div>
          <div className="relative">
            <div className="rounded-3xl aspect-square flex items-center justify-center text-8xl shadow-xl" style={{ background: `linear-gradient(135deg, #F5EDD6, #E8D5A0)` }}>
              😁
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
            <span className="flex items-center gap-2">👨‍⚕️ Designed by Dr. Anurag Dash</span>
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
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>OrisAlign vs Braces vs Invisalign</h2>
            <p className="text-gray-500 max-w-xl mx-auto">An honest comparison. We believe you should choose with full information.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border shadow-sm" style={{ borderColor: '#F0E4B8' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-5 py-4 font-bold text-gray-500 w-1/4">Feature</th>
                  <th className="px-5 py-4 font-black border-x-2" style={{ color: GOLD, background: '#FBF7EE', borderColor: '#E8D5A0' }}>OrisAlign ✓</th>
                  <th className="px-5 py-4 font-semibold text-gray-600">Metal Braces</th>
                  <th className="px-5 py-4 font-semibold text-gray-600">Invisalign</th>
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
          <p className="text-center text-xs text-gray-400 mt-4">*Prices are indicative. Exact cost depends on case complexity. Invisalign® is a registered trademark of Align Technology.</p>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20" id="how-it-works" style={{ background: 'linear-gradient(to bottom, #FBF7EE, #ffffff)' }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>How It Works</h2>
            <p className="text-gray-500">4 simple steps to your new smile.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center" style={{ background: GOLD, color: NAVY }}>
                  {i + 1}
                </div>
                <div className="text-5xl mt-2 mb-4">{step.icon}</div>
                <h3 className="font-bold mb-2" style={{ color: NAVY }}>{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="#book" className="font-bold px-8 py-4 rounded-full transition-all shadow-lg inline-block" style={{ background: GOLD, color: NAVY, boxShadow: `0 8px 24px ${GOLD}44` }}>
              Start Step 1 — Book Free Consult →
            </a>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-20 bg-white" id="pricing">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>Transparent Pricing</h2>
            <p className="text-gray-500">No hidden fees. What you see is what you pay.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { name: 'Mild', price: '₹59,999', emi: '₹2,499/mo', months: '24 months', desc: 'Minor spacing or crowding. Typical 4–6 month treatment.' },
              { name: 'Moderate', price: '₹79,999', emi: '₹3,333/mo', months: '24 months', desc: 'Moderate crowding, spacing, or bite issues. 6–10 months.', popular: true },
              { name: 'Complex', price: '₹99,999', emi: '₹4,166/mo', months: '24 months', desc: 'Severe crowding, bite correction. 10–18 months.' },
            ].map((plan, i) => (
              <div key={i} className={`relative rounded-2xl border-2 p-6 flex flex-col shadow-sm`} style={plan.popular ? { borderColor: GOLD, background: '#FBF7EE', boxShadow: `0 8px 32px ${GOLD}33` } : { borderColor: '#e5e7eb' }}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 rounded-full" style={{ background: GOLD, color: NAVY }}>
                    Most Popular
                  </div>
                )}
                <h3 className="font-black text-xl mb-1" style={{ color: NAVY }}>{plan.name}</h3>
                <div className="text-3xl font-black mb-1" style={{ color: GOLD }}>{plan.price}</div>
                <div className="text-sm text-gray-500 mb-4">or <span className="font-bold text-gray-700">{plan.emi}</span> × {plan.months} (no-cost EMI)</div>
                <p className="text-sm text-gray-600 mb-6 flex-1">{plan.desc}</p>
                <a href="#book" className="block text-center text-sm font-bold py-3 rounded-full transition-all" style={plan.popular ? { background: GOLD, color: NAVY } : { background: '#f3f4f6', color: '#374151' }}>
                  Book Free Consult
                </a>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl p-5 text-center" style={{ background: '#FBF7EE', border: `1px solid ${GOLD}66` }}>
            <p className="text-sm" style={{ color: NAVY }}>
              <strong>💳 No-cost EMI</strong> available via HDFC, ICICI, Bajaj Finserv & more. &nbsp;·&nbsp;
              <strong>Exact pricing given after free consultation</strong> — your case may cost less.
            </p>
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BEFORE_AFTER.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="grid grid-cols-2 divide-x divide-gray-100">
                  <div className="bg-red-50 aspect-square flex flex-col items-center justify-center p-4">
                    <span className="text-4xl mb-2">😬</span>
                    <span className="text-xs font-bold text-red-400 uppercase">Before</span>
                  </div>
                  <div className="bg-green-50 aspect-square flex flex-col items-center justify-center p-4">
                    <span className="text-4xl mb-2">😁</span>
                    <span className="text-xs font-bold text-green-500 uppercase">After</span>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: NAVY }}>{item.label}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#F5EDD6', color: NAVY }}>{item.tag}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            📸 Replace placeholders above with real patient photos. Add a note: "Shared with patient consent."
          </p>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 bg-white" id="testimonials">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>What Our Patients Say</h2>
            <p className="text-gray-500">Real people. Real results. From Bhubaneswar.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 mb-10">
            {[
              { name: 'Priya M.', age: '24', duration: '7 months', quote: 'I was nervous about the process but Dr. Dash explained everything clearly. My teeth look amazing and nobody even noticed I was wearing aligners!' },
              { name: 'Rahul K.', age: '31', duration: '6 months', quote: 'Compared quotes from 3 clinics — OrisAlign was the most affordable with the most professional setup. Best decision I made.' },
              { name: 'Ananya S.', age: '19', duration: '5 months', quote: "As a college student I was worried about how I'd look. Completely invisible. My confidence has gone through the roof." },
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

          <h3 className="text-xl font-black mb-4 text-center" style={{ color: NAVY }}>Video Testimonials</h3>
          <div className="grid sm:grid-cols-3 gap-6">
            {['Patient Story — 6 months', 'Before vs After walkthrough', 'Why I chose OrisAlign'].map((title, i) => (
              <div key={i} className="bg-gray-100 rounded-2xl aspect-video flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-md" style={{ background: NAVY }}>
                  <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <span className="text-xs text-gray-500 font-medium text-center px-4">{title}</span>
                <span className="text-xs text-gray-400">Upload your video here</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MEET THE DOCTOR ── */}
      <section className="py-20 text-white" id="doctor" style={{ background: `linear-gradient(135deg, ${NAVY}, #0F1E33)` }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="rounded-3xl aspect-square flex items-center justify-center text-9xl order-2 md:order-1" style={{ background: 'rgba(201,168,76,0.15)' }}>
              👨‍⚕️
            </div>
            <div className="order-1 md:order-2">
              <p className="font-semibold text-sm uppercase tracking-widest mb-2" style={{ color: GOLD }}>Meet Your Doctor</p>
              <h2 className="text-3xl sm:text-4xl font-black mb-4">Dr. Anurag Dash</h2>
              <p className="mb-2 font-semibold" style={{ color: GOLD }}>BDS — Bachelor of Dental Surgery</p>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: '#E8D9A0' }}>
                Dr. Dash has been practicing in Bhubaneswar for over X years and has transformed 500+ smiles using clear aligner therapy. He founded OrisAlign to make premium orthodontic care accessible to everyone in Odisha — at a fair, transparent price.
              </p>
              <div className="space-y-2 text-sm mb-8" style={{ color: '#F5EDD6' }}>
                {[
                  '🎓 BDS from [Your Dental College]',
                  '📍 Practicing in Bhubaneswar since [Year]',
                  '🦷 500+ clear aligner cases',
                  '🇮🇳 Committed to Made-in-India dentistry',
                ].map((item, i) => <div key={i}>{item}</div>)}
              </div>
              <a href="#book" className="inline-block font-bold px-6 py-3 rounded-full transition-colors" style={{ background: GOLD, color: NAVY }}>
                Book with Dr. Dash →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOOK CTA ── */}
      <section className="py-20 bg-white" id="book">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: NAVY }}>Book Your Free Consultation</h2>
          <p className="text-gray-500 mb-8">Takes 2 minutes. No payment required. Dr. Dash will assess your teeth and give you a full treatment plan — free.</p>
          <div className="rounded-2xl p-8 border" style={{ background: '#FBF7EE', borderColor: '#F0E4B8' }}>
            <div className="space-y-4">
              <input type="text" placeholder="Your name" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none bg-white" style={{ '--tw-ring-color': GOLD }} onFocus={e => e.target.style.outline = `2px solid ${GOLD}`} onBlur={e => e.target.style.outline = 'none'} />
              <input type="tel" placeholder="Mobile number (WhatsApp preferred)" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none" onFocus={e => e.target.style.outline = `2px solid ${GOLD}`} onBlur={e => e.target.style.outline = 'none'} />
              <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 bg-white focus:outline-none" onFocus={e => e.target.style.outline = `2px solid ${GOLD}`} onBlur={e => e.target.style.outline = 'none'}>
                <option value="">Main concern (optional)</option>
                <option>Crowded teeth</option>
                <option>Gaps between teeth</option>
                <option>Overbite / underbite</option>
                <option>General smile improvement</option>
                <option>Not sure</option>
              </select>
              <button className="w-full font-bold py-4 rounded-xl transition-colors text-base shadow-lg" style={{ background: GOLD, color: NAVY, boxShadow: `0 8px 24px ${GOLD}44` }}>
                Book Free Consultation →
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-4">We'll call/WhatsApp you within 2 hours to confirm your appointment.</p>
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

      {/* ── FOOTER ── */}
      <footer className="py-16 text-gray-300" style={{ background: NAVY }} id="contact">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="lg:col-span-2">
              <img src="/logo2.png" alt="OrisAlign" className="h-10 w-auto mb-3 brightness-0 invert" />
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">Clear aligners designed and supervised by Dr. Anurag Dash. Helping Bhubaneswar smile better — affordably.</p>
              <div className="flex gap-3">
                {['Facebook', 'Instagram', 'YouTube'].map(s => (
                  <a key={s} href="#" className="text-xs px-3 py-1.5 rounded-full transition-colors" style={{ background: 'rgba(255,255,255,0.1)', color: '#e5e7eb' }}
                    onMouseEnter={e => { e.target.style.background = GOLD; e.target.style.color = NAVY }}
                    onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.color = '#e5e7eb' }}
                  >{s}</a>
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
                <div className="flex gap-2"><span>📍</span><span>[Clinic Address], Bhubaneswar, Odisha</span></div>
                <div className="flex gap-2"><span>📞</span><a href="tel:+918280837370" className="hover:text-white">+91 82808 37370</a></div>
                <div className="flex gap-2"><span>📧</span><a href="mailto:hello@orisalign.com" className="hover:text-white">hello@orisalign.com</a></div>
                <div className="flex gap-2"><span>🕐</span><span>Mon–Sat, 10am–7pm</span></div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl h-48 flex items-center justify-center mb-8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="text-center text-gray-500 text-sm">
              <div className="text-3xl mb-2">🗺️</div>
              <p>Embed Google Maps here</p>
              <p className="text-xs mt-1">Replace with: &lt;iframe src="https://maps.google.com/..." /&gt;</p>
            </div>
          </div>

          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <p>© 2025 OrisAlign. All rights reserved. | Designed by Dr. Anurag Dash</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <a href="#" className="hover:text-white">Terms</a>
              <Link href="/login" className="hover:text-white">Staff Login</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ── STICKY MOBILE CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white border-t border-gray-200 px-4 py-3 flex gap-3 shadow-2xl">
        <a href="#book" className="flex-1 text-sm font-bold py-3 rounded-full text-center" style={{ background: GOLD, color: NAVY }}>
          Book Free Consultation
        </a>
        <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="bg-green-500 text-white px-4 py-3 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d={WA_ICON}/></svg>
        </a>
      </div>

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
