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
const ArrowRight = ({ className, style }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} style={style} {...ic}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

// ── Data ──
const TIERS = [
  {
    key: "basic",
    name: "3D Consultation",
    price: 199,
    tag: "Quick Start",
    highlight: false,
    items: ["Oral checkup", "3D intraoral scan", "Provisional treatment plan"],
  },
  {
    key: "full",
    name: "3D Consultation + 3D Plan",
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

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function ConsultationClient() {
  const [selectedTier, setSelectedTier] = useState<(typeof TIERS)[number]["key"] | null>(null);

  const bookRef = useRef<HTMLDivElement>(null);

  const tier = useMemo(() => TIERS.find((t) => t.key === selectedTier) || null, [selectedTier]);

  const handleSelectTier = (key: (typeof TIERS)[number]["key"]) => {
    setSelectedTier(key);
    setTimeout(() => bookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const scrollToBook = () => bookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

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
              <h1 className="text-2xl sm:text-4xl font-extrabold font-display" style={{ color: INK }}>
                Choose Your 3D Scan Type
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

        {/* ── SECTION 2 — Book Your Scan CTA ── */}
        <section ref={bookRef} className="px-4 sm:px-6 py-14 sm:py-20" style={{ background: "#fff", borderTop: `1px solid ${LINE}` }}>
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
            <Link
              href="/book"
              className="inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-base font-bold text-white transition-transform hover:scale-[1.02]"
              style={{ background: INK, boxShadow: "0 20px 40px -18px rgba(19,24,27,.45)" }}
            >
              Book My Scan Appointment
              <ArrowRight className="w-5 h-5" />
            </Link>
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
                Consultation: <span style={{ color: GOLD }}>{inr(tier!.price)}</span> — {tier!.name}
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
