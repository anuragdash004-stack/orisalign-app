"use client";

import type React from "react";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";

// ── Design tokens — matches app/globals.css / app/page.js exactly ──
const INK = "#13181B";
const INK2 = "#5A656B";
const GOLD = "#B8905A";
const GOLDD = "#946F3F";
const MINT = "#EAF3EE";
const MINTD = "#3F9B79";
const LINE = "#E6E9EA";
const CARD_SHADOW = "0 30px 60px -34px rgba(19,24,27,.4)";

const WHATSAPP_NUMBER = "918280837370";

// ── Inline line icons (no emoji) — same stroke style as the homepage ──
const ic = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
type IconProps = { className?: string; style?: React.CSSProperties };
const Check = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} {...ic}><path d="M20 6 9 17l-5-5" /></svg>
);
const Scan = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} {...ic}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></svg>
);
const Clock = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} {...ic}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const ArrowRight = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} {...ic}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
const WhatsAppIcon = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ── Data ──
const TIERS = [
  {
    key: "basic",
    name: "Basic Consultation",
    price: 199,
    tag: "Quick Start",
    highlight: false,
    items: ["Oral checkup", "3D intraoral scan", "Provisional treatment plan"],
  },
  {
    key: "full",
    name: "Full Consultation",
    price: 999,
    tag: "Recommended",
    highlight: true,
    items: [
      "Oral checkup",
      "3D intraoral scan",
      "Provisional treatment plan",
      "Final orthodontist plan delivered in 72 hours",
    ],
  },
] as const;

const ORIS_PRO_PRICE = 3250;
const ORIS_PRO_PLUS_PRICE = 4500;

const TREATMENTS = [
  {
    key: "full-package",
    name: "Full Package",
    tag: "Most Popular",
    highlight: true,
    items: [
      "Complete correction — all teeth, upper and lower",
      "Full orthodontist-planned treatment",
    ],
    priceLabel: "₹50,000 – ₹85,000",
    priceSub: "Duration-based · exact quote after plan",
  },
  {
    key: "as-required",
    name: "As Required",
    tag: null,
    highlight: false,
    items: [
      "You choose the scope (e.g. front gap closure only)",
      "Orthodontist re-plans at no extra charge",
    ],
    priceLabel: null,
    priceSub: "Minimum sets determined by clinical plan only",
  },
] as const;

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function ConsultationClient() {
  const [selectedTier, setSelectedTier] = useState<(typeof TIERS)[number]["key"] | null>(null);
  const [selectedTreatment, setSelectedTreatment] = useState<(typeof TREATMENTS)[number]["key"] | null>(null);
  const [sets, setSets] = useState(1);

  const step2Ref = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);

  const tier = useMemo(() => TIERS.find((t) => t.key === selectedTier) || null, [selectedTier]);
  const treatment = useMemo(() => TREATMENTS.find((t) => t.key === selectedTreatment) || null, [selectedTreatment]);

  const waMessage = useMemo(() => {
    let msg = "Hi, I'd like to book a consultation with Orisalign.";
    if (tier) msg += ` Consultation: ${tier.name} (₹${tier.price}).`;
    if (treatment) msg += ` Treatment interest: ${treatment.name}.`;
    return msg;
  }, [tier, treatment]);

  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  const handleSelectTier = (key: (typeof TIERS)[number]["key"]) => {
    setSelectedTier(key);
    setTimeout(() => step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const handleSelectTreatment = (key: (typeof TREATMENTS)[number]["key"]) => {
    setSelectedTreatment(key);
  };

  const scrollToBook = () => bookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const proTotal = sets * ORIS_PRO_PRICE;
  const proPlusTotal = sets * ORIS_PRO_PLUS_PRICE;

  return (
    <div className="min-h-screen font-sans" style={{ background: "#FAFBFB", color: INK }}>
      {/* ── Minimal header ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center">
            <img src="/logo2.png" alt="OrisAlign" className="h-7 w-auto" />
          </Link>
        </div>
      </header>

      <main className={selectedTier ? "pb-24" : "pb-10"}>
        {/* ── SECTION 1 — Consultation Tiers ── */}
        <section className="px-4 sm:px-6 pt-10 sm:pt-14 pb-10" style={{ background: "#FAFBFB" }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>Step 1</span>
              <h1 className="mt-2 text-2xl sm:text-4xl font-extrabold font-display" style={{ color: INK }}>
                Choose Your Consultation
              </h1>
              <p className="mt-2 text-sm sm:text-base" style={{ color: INK2 }}>
                Start with a checkup and 3D scan — pick the option that suits you.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {TIERS.map((t) => {
                const isSelected = selectedTier === t.key;
                return (
                  <div
                    key={t.key}
                    className="rounded-[22px] overflow-hidden bg-white flex flex-col"
                    style={{
                      border: `2px solid ${isSelected || t.highlight ? GOLD : LINE}`,
                      boxShadow: isSelected ? "0 20px 45px -20px rgba(184,144,90,.45)" : CARD_SHADOW,
                    }}
                  >
                    <div className="px-6 pt-6 pb-4 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className="text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full"
                          style={{
                            background: t.highlight ? GOLD : MINT,
                            color: t.highlight ? "#fff" : MINTD,
                          }}
                        >
                          {t.tag}
                        </span>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-xs font-bold" style={{ color: GOLDD }}>
                            <Check className="w-4 h-4" /> Selected
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold font-display" style={{ color: INK }}>{t.name}</h3>
                      <div className="mt-1 mb-4 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold font-display" style={{ color: GOLD }}>{inr(t.price)}</span>
                        <span className="text-xs font-medium" style={{ color: INK2 }}>one-time</span>
                      </div>
                      <ul className="space-y-2.5">
                        {t.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: INK }}>
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="px-6 pb-6 pt-2">
                      <button
                        onClick={() => handleSelectTier(t.key)}
                        className="w-full rounded-xl py-3 text-sm font-bold transition-colors"
                        style={
                          isSelected
                            ? { background: INK, color: "#fff" }
                            : { background: t.highlight ? GOLD : "#fff", color: t.highlight ? "#fff" : INK, border: `1.5px solid ${t.highlight ? GOLD : LINE}` }
                        }
                      >
                        {isSelected ? "Selected ✓" : "Select"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs mt-6" style={{ color: INK2 }}>
              Consultation fee is not adjusted against treatment cost.
            </p>
          </div>
        </section>

        {/* ── SECTION 2 — Treatment Options ── */}
        <section ref={step2Ref} className="px-4 sm:px-6 py-10 sm:py-14" style={{ background: "#fff", borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>Step 2</span>
              <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold font-display" style={{ color: INK }}>
                Choose Your Treatment
              </h2>
              <p className="mt-2 text-sm sm:text-base" style={{ color: INK2 }}>
                {selectedTier ? "Pick the treatment path that fits your goals." : "Select a consultation option above to unlock this step."}
              </p>
            </div>

            <div
              className="relative"
              style={!selectedTier ? { opacity: 0.45, pointerEvents: "none", filter: "grayscale(0.3)" } : undefined}
            >
              <div className="grid sm:grid-cols-2 gap-5">
                {TREATMENTS.map((t) => {
                  const isSelected = selectedTreatment === t.key;
                  return (
                    <div
                      key={t.key}
                      className="rounded-[22px] overflow-hidden bg-white flex flex-col"
                      style={{
                        border: `2px solid ${isSelected || t.highlight ? GOLD : LINE}`,
                        boxShadow: isSelected ? "0 20px 45px -20px rgba(184,144,90,.45)" : CARD_SHADOW,
                      }}
                    >
                      <div className="px-6 pt-6 pb-4 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          {t.tag ? (
                            <span
                              className="text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full"
                              style={{ background: t.highlight ? GOLD : MINT, color: t.highlight ? "#fff" : MINTD }}
                            >
                              {t.tag}
                            </span>
                          ) : <span />}
                          {isSelected && (
                            <span className="flex items-center gap-1 text-xs font-bold" style={{ color: GOLDD }}>
                              <Check className="w-4 h-4" /> Selected
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold font-display" style={{ color: INK }}>{t.name}</h3>

                        {t.priceLabel && (
                          <div className="mt-1 mb-3">
                            <span className="text-xl font-extrabold font-display" style={{ color: GOLD }}>{t.priceLabel}</span>
                          </div>
                        )}

                        <ul className="space-y-2.5 mb-3">
                          {t.items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: INK }}>
                              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Per-set pricing for "As Required" */}
                        {t.key === "as-required" && (
                          <div className="rounded-xl p-4 mb-2" style={{ background: MINT }}>
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <span className="font-medium" style={{ color: INK }}>Oris Pro <span style={{ color: INK2 }}>(Scheu Duran+)</span></span>
                              <span className="font-bold" style={{ color: MINTD }}>{inr(ORIS_PRO_PRICE)}/set</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium" style={{ color: INK }}>Oris Pro Plus <span style={{ color: INK2 }}>(Zendura FLX)</span></span>
                              <span className="font-bold" style={{ color: MINTD }}>{inr(ORIS_PRO_PLUS_PRICE)}/set</span>
                            </div>
                            <p className="text-[11px] mt-2" style={{ color: INK2 }}>All prices incl. GST</p>

                            {/* Interactive calculator */}
                            <div className="mt-4 pt-4" style={{ borderTop: `1px solid #d8e6de` }}>
                              <p className="text-xs font-bold mb-2" style={{ color: INK }}>Estimate your total</p>
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-xs" style={{ color: INK2 }}>Number of sets</span>
                                <div className="flex items-center gap-2 ml-auto">
                                  <button
                                    type="button"
                                    onClick={() => setSets((s) => Math.max(1, s - 1))}
                                    className="w-7 h-7 rounded-lg font-bold flex items-center justify-center"
                                    style={{ background: "#fff", border: `1px solid ${LINE}`, color: INK }}
                                    aria-label="Decrease sets"
                                  >−</button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={sets}
                                    onChange={(e) => setSets(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-12 text-center rounded-lg py-1 text-sm font-bold"
                                    style={{ border: `1px solid ${LINE}`, color: INK }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setSets((s) => s + 1)}
                                    className="w-7 h-7 rounded-lg font-bold flex items-center justify-center"
                                    style={{ background: "#fff", border: `1px solid ${LINE}`, color: INK }}
                                    aria-label="Increase sets"
                                  >+</button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg bg-white px-3 py-2 text-center" style={{ border: `1px solid ${LINE}` }}>
                                  <p className="text-[10px] font-semibold uppercase" style={{ color: INK2 }}>Oris Pro Total</p>
                                  <p className="text-sm font-extrabold" style={{ color: INK }}>{inr(proTotal)}</p>
                                </div>
                                <div className="rounded-lg bg-white px-3 py-2 text-center" style={{ border: `1px solid ${GOLD}` }}>
                                  <p className="text-[10px] font-semibold uppercase" style={{ color: GOLDD }}>Oris Pro Plus Total</p>
                                  <p className="text-sm font-extrabold" style={{ color: GOLD }}>{inr(proPlusTotal)}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <p className="text-[11px] mt-2" style={{ color: INK2 }}>{t.priceSub}</p>
                      </div>
                      <div className="px-6 pb-6 pt-2">
                        <button
                          onClick={() => handleSelectTreatment(t.key)}
                          className="w-full rounded-xl py-3 text-sm font-bold transition-colors"
                          style={
                            isSelected
                              ? { background: INK, color: "#fff" }
                              : { background: t.highlight ? GOLD : "#fff", color: t.highlight ? "#fff" : INK, border: `1.5px solid ${t.highlight ? GOLD : LINE}` }
                          }
                        >
                          {isSelected ? "Selected ✓" : "Select"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 3 — Book Your Scan CTA ── */}
        <section ref={bookRef} className="px-4 sm:px-6 py-14 sm:py-20" style={{ background: "#FAFBFB" }}>
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: MINT }}>
              <Scan className="w-7 h-7" style={{ color: MINTD }} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display mb-3" style={{ color: INK }}>
              Ready to begin?
            </h2>
            <p className="text-sm sm:text-base mb-8" style={{ color: INK2 }}>
              Book your scan appointment and take the first step toward your new smile.
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-base font-bold text-white transition-transform hover:scale-[1.02]"
              style={{ background: "#25D366", boxShadow: "0 20px 40px -18px rgba(37,211,102,.55)" }}
            >
              <WhatsAppIcon className="w-5 h-5" />
              Book My Scan Appointment
            </a>
            <p className="text-xs mt-5" style={{ color: INK2 }}>
              Or call/WhatsApp us directly at{" "}
              <a href={`tel:+${WHATSAPP_NUMBER}`} className="font-semibold" style={{ color: GOLDD }}>
                +91 82808 37370
              </a>
            </p>
          </div>
        </section>
      </main>

      {/* ── Sticky summary bar ── */}
      {selectedTier && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50"
          style={{ background: INK, boxShadow: "0 -8px 30px rgba(0,0,0,.18)" }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap text-xs sm:text-sm" style={{ color: "#fff" }}>
              <span className="font-semibold whitespace-nowrap">
                Consultation: <span style={{ color: GOLD }}>{inr(tier!.price)}</span>
              </span>
              <span className="opacity-40">|</span>
              <span className="font-semibold whitespace-nowrap truncate">
                Treatment: <span style={{ color: treatment ? GOLD : "#9aa6ac" }}>{treatment ? treatment.name : "Not selected"}</span>
              </span>
            </div>
            <button
              onClick={scrollToBook}
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap"
              style={{ background: GOLD, color: "#fff" }}
            >
              Book Now <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
