"use client";

import { useState, useEffect } from "react";

const colors = {
  bg: "#F7F2E9",
  card: "#FFFFFF",
  ink: "#2B2420",
  inkSoft: "#6B5F4F",
  inkFaint: "#9C8E78",
  brand: "#B8905A",
  brandDark: "#8C6A3D",
  rule: "#E2D6C2",
  ruleSoft: "#EDE4D2",
  good: "#4F6B52",
  goodBg: "#E9EFE7",
  bad: "#A8553C",
  badBg: "#F3E5DE",
};

const PRODUCTS = {
  pro: { label: "Oris Pro", perSet: 1047.9, dp: 13000, wear: "15 days/set" },
  proPlus: { label: "Oris Pro Plus", perSet: 1467.9, dp: 17000, wear: "10 days/set" },
};

const RATES = {
  noDp: { 6: 0.0849, 9: 0.1203 },
  withDp: { 6: 0.0613, 9: 0.0967, 12: 0.15452 },
};

const FIXED_COST = 5000; // ortho 3000 + CAC 2000
const GST_RATE = 0.18;
const TARGET_PROFIT = 0.4;

function formatINR(n) {
  if (!isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const num = Math.round(Math.abs(n));
  const str = num.toString();
  const last3 = str.slice(-3);
  const other = str.slice(0, -3);
  const grouped = other ? other.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return sign + "₹" + grouped;
}

function zigzag(teeth = 22, depth = 3) {
  const pts = ["0% 0%", "100% 0%"];
  for (let i = 0; i <= teeth; i++) {
    const x = 100 - (i / teeth) * 100;
    const y = i % 2 === 0 ? 100 : 100 - depth;
    pts.push(`${x.toFixed(3)}% ${y}%`);
  }
  return `polygon(${pts.join(",")})`;
}

function Step({ n, label }) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <span style={{ color: colors.brand, fontFamily: "'Fraunces', serif", fontSize: 13, letterSpacing: 1 }}>
        {n.toString().padStart(2, "0")}
      </span>
      <span style={{ color: colors.inkSoft, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

function Pill({ active, onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 rounded-md text-sm transition-colors"
      style={{
        background: active ? colors.brand : "#FFFFFF",
        color: active ? "#FFFFFF" : disabled ? colors.inkFaint : colors.ink,
        border: `1px solid ${active ? colors.brand : colors.rule}`,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}

function LedgerRow({ label, value, sub, bold, accentColor }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <div>
        <span style={{ fontSize: bold ? 14 : 13, color: bold ? colors.ink : colors.inkSoft, fontWeight: bold ? 700 : 400 }}>
          {label}
        </span>
        {sub && <div style={{ fontSize: 10.5, color: colors.inkFaint, marginTop: 1 }}>{sub}</div>}
      </div>
      <span
        style={{
          fontFamily: "'Fraunces', serif",
          fontVariantNumeric: "tabular-nums",
          fontSize: bold ? 18 : 14.5,
          fontWeight: bold ? 700 : 500,
          color: accentColor || (bold ? colors.ink : colors.ink),
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function EMICalculator() {
  const [mode, setMode] = useState("solve");
  const [productKey, setProductKey] = useState("pro");
  const [sets, setSets] = useState(18);
  const [dpOption, setDpOption] = useState("withDp");
  const [tenure, setTenure] = useState(6);
  const [checkTicket, setCheckTicket] = useState(70000);

  const product = PRODUCTS[productKey];
  const availableTenures = dpOption === "withDp" ? [6, 9, 12] : [6, 9];

  useEffect(() => {
    if (!availableTenures.includes(tenure)) setTenure(6);
  }, [dpOption]);

  const costPrice = Math.max(sets, 0) * product.perSet + FIXED_COST;
  const dp = dpOption === "withDp" ? product.dp : 0;
  const rate = dpOption === "withDp" ? RATES.withDp[tenure] : RATES.noDp[tenure];

  let ticket;
  if (mode === "solve") {
    ticket = (costPrice - rate * dp) / (0.42 - rate);
  } else {
    ticket = Number(checkTicket) || 0;
  }

  const financeAmount = Math.max(ticket - dp, 0);
  const financeFee = financeAmount * rate;
  const gst = ticket * GST_RATE;
  const profit = ticket - costPrice - gst - financeFee;
  const profitPct = ticket > 0 ? (profit / ticket) * 100 : 0;
  const monthlyEMI = tenure > 0 ? financeAmount / tenure : 0;
  const cashPrice = costPrice / 0.42;
  const profitDelta = profitPct - TARGET_PROFIT * 100;
  const isGood = profitPct >= TARGET_PROFIT * 100 - 0.3;

  return (
    <div style={{ background: colors.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: colors.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      <div className="max-w-md mx-auto px-5 py-8">
        <div style={{ fontSize: 11, letterSpacing: 2, color: colors.brand, textTransform: "uppercase", fontWeight: 600 }}>
          Orisalign · Finance Desk
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 700, marginTop: 4, marginBottom: 6 }}>
          No-Cost EMI Calculator
        </h1>
        <p style={{ fontSize: 13, color: colors.inkSoft, lineHeight: 1.5, marginBottom: 24 }}>
          The Fibe finance fee is already loaded into every invoice — patients see one price, no surprises later.
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <Pill active={mode === "solve"} onClick={() => setMode("solve")}>
            Solve the price
          </Pill>
          <Pill active={mode === "check"} onClick={() => setMode("check")}>
            Check a price
          </Pill>
        </div>

        <div style={{ background: colors.card, borderRadius: 14, padding: 20, border: `1px solid ${colors.rule}`, marginBottom: 18 }}>
          <Step n={1} label="Product" />
          <div className="flex gap-2 mb-5">
            <Pill active={productKey === "pro"} onClick={() => setProductKey("pro")}>
              Oris Pro
            </Pill>
            <Pill active={productKey === "proPlus"} onClick={() => setProductKey("proPlus")}>
              Oris Pro Plus
            </Pill>
          </div>
          <div style={{ fontSize: 11, color: colors.inkFaint, marginTop: -16, marginBottom: 16 }}>
            {product.wear} · down payment {formatINR(product.dp)}
          </div>

          <Step n={2} label="Number of sets" />
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => setSets((s) => Math.max(1, s - 2))}
              style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${colors.rule}`, background: "#fff", fontSize: 16, color: colors.brandDark }}
            >
              −
            </button>
            <input
              type="number"
              value={sets}
              onChange={(e) => setSets(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: 70,
                textAlign: "center",
                fontFamily: "'Fraunces', serif",
                fontSize: 18,
                fontWeight: 600,
                border: `1px solid ${colors.rule}`,
                borderRadius: 8,
                padding: "6px 4px",
                background: "#fff",
              }}
            />
            <button
              onClick={() => setSets((s) => s + 2)}
              style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${colors.rule}`, background: "#fff", fontSize: 16, color: colors.brandDark }}
            >
              +
            </button>
            <span style={{ fontSize: 12, color: colors.inkFaint }}>sets</span>
          </div>

          <Step n={3} label="Down payment" />
          <div className="flex gap-2 mb-5">
            <Pill active={dpOption === "withDp"} onClick={() => setDpOption("withDp")}>
              With DP
            </Pill>
            <Pill active={dpOption === "noDp"} onClick={() => setDpOption("noDp")}>
              No DP
            </Pill>
          </div>

          <Step n={4} label="Tenure" />
          <div className="flex gap-2">
            {[6, 9, 12].map((t) => (
              <Pill key={t} active={tenure === t} disabled={!availableTenures.includes(t)} onClick={() => availableTenures.includes(t) && setTenure(t)}>
                {t} mo
              </Pill>
            ))}
          </div>
          {dpOption === "noDp" && (
            <div style={{ fontSize: 11, color: colors.inkFaint, marginTop: 8 }}>
              12-month financing is only offered with the down payment, per Fibe's terms.
            </div>
          )}

          {mode === "check" && (
            <>
              <div style={{ marginTop: 20 }}>
                <Step n={5} label="Ticket size to check" />
              </div>
              <input
                type="number"
                value={checkTicket}
                onChange={(e) => setCheckTicket(e.target.value)}
                style={{
                  width: "100%",
                  fontFamily: "'Fraunces', serif",
                  fontSize: 18,
                  fontWeight: 600,
                  border: `1px solid ${colors.rule}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  background: "#fff",
                }}
              />
            </>
          )}
        </div>

        {/* Ledger */}
        <div
          style={{
            background: colors.card,
            borderRadius: "14px 14px 0 0",
            padding: "22px 20px 36px 20px",
            border: `1px solid ${colors.rule}`,
            borderBottom: "none",
            clipPath: zigzag(),
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: colors.inkFaint, textTransform: "uppercase", marginBottom: 10 }}>
            Invoice breakdown
          </div>

          <LedgerRow label="Cost price" sub={`${sets} sets × ${formatINR(product.perSet)} + ₹5,000`} value={formatINR(costPrice)} />
          <div style={{ borderTop: `1px dashed ${colors.ruleSoft}` }} />
          <LedgerRow label="Down payment" sub={dpOption === "withDp" ? "Collected upfront" : "None"} value={formatINR(dp)} />
          <LedgerRow label="Finance amount" sub="Ticket − down payment" value={formatINR(financeAmount)} />
          <LedgerRow label={`Finance fee (${(rate * 100).toFixed(2)}%)`} sub="Fibe subvention + GST + platform fee" value={formatINR(financeFee)} />
          <LedgerRow label="GST (18%)" sub="On invoice amount" value={formatINR(gst)} />

          <div style={{ borderTop: `1px solid ${colors.rule}`, margin: "10px 0" }} />

          <LedgerRow label={mode === "solve" ? "Required ticket size" : "Ticket size"} bold value={formatINR(ticket)} />

          <div style={{ background: isGood ? colors.goodBg : colors.badBg, borderRadius: 10, padding: "12px 14px", marginTop: 14 }}>
            <LedgerRow label="Your profit" bold value={formatINR(profit)} accentColor={isGood ? colors.good : colors.bad} />
            <div style={{ fontSize: 12, color: isGood ? colors.good : colors.bad, marginTop: 2 }}>
              {profitPct.toFixed(1)}% margin
              {mode === "check" && (profitDelta >= 0 ? ` · +${profitDelta.toFixed(1)}pp above 40% target` : ` · ${profitDelta.toFixed(1)}pp below 40% target`)}
            </div>
          </div>

          <div className="flex justify-between items-center" style={{ marginTop: 16, paddingTop: 14, borderTop: `1px dashed ${colors.ruleSoft}` }}>
            <div>
              <div style={{ fontSize: 11, color: colors.inkFaint, textTransform: "uppercase", letterSpacing: 1 }}>Patient pays monthly</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: colors.brandDark }}>
                {formatINR(monthlyEMI)}<span style={{ fontSize: 12, fontWeight: 400, color: colors.inkFaint }}> / mo × {tenure}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: colors.inkFaint }}>Cash price (no EMI)</div>
              <div style={{ fontSize: 14, color: colors.inkSoft, fontVariantNumeric: "tabular-nums" }}>{formatINR(cashPrice)}</div>
            </div>
          </div>
        </div>
        <div style={{ height: 4, background: colors.bg }} />

        <p style={{ fontSize: 11, color: colors.inkFaint, textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
          Finance fee rates are all-in (Fibe subvention + 18% GST on subvention + 2% platform fee), as confirmed with Fibe.
        </p>
      </div>
    </div>
  );
}
