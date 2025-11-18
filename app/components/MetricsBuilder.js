"use client";

import { useEffect, useRef, useState } from "react";
import { portfolioCalculator } from "../../lib/portfolio";

/**
 * PortfolioBuilder — 300px tall, no wrapper radius, 8px bars, no badges
 * - KPIs on one line (2→3 smooth resize)
 * - Bars use exact 8px height (match strokeWidth=8)
 * - No "with yield" / "price only" anywhere
 * - No rounded border around the whole thing
 * - Fits inside 300px, no scrolling
 */
export default function MetricsBuilder({ assets = [], weights = [], showYield = false, detail }) {
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const ticketRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const myTicket = ++ticketRef.current;

    (async () => {
      try {
        setErr("");
        const sum = weights.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
        if (sum <= 0) {
          if (alive && ticketRef.current === myTicket) setResult(null);
          return;
        }
        const res = await portfolioCalculator(assets, weights);
        if (!alive || ticketRef.current !== myTicket) return;
        setResult(res);
      } catch (e) {
        if (!alive || ticketRef.current !== myTicket) return;
        setErr(e?.message || String(e));
      }
    })();

    return () => { alive = false; };
  }, [assets, weights]);

  if (err) return <div className="mt-8 text-red-700 text-sm">{err}</div>;
  if (!result) return null;

  const { series, seriesWithYield, metricsOff, metricsOn } = result;
  const m = showYield ? metricsOn : metricsOff;
  const s = showYield ? seriesWithYield : series;
  const endVal = s[s.length - 1];

  // no badges at all
  const showGainOnYield = Number.isFinite(m.gainOnYield) && Math.abs(m.gainOnYield) > 0.00001;
  const hasYieldGain = showGainOnYield;
  const kpiCount = hasYieldGain ? 3 : 2;
  const widthPercent = 100 / kpiCount;

  // gauges
  const scoreGrowth   = clamp01((m.cagrPct ?? 0) / 30);
  const scoreStab     = 1 - clamp01((Math.abs(m.annualizedVolatilityPct ?? 0)) / 120);
  const ddMag         = Math.abs(m.maxDrawdownPct ?? 0);
  const scoreResil    = 1 - clamp01(ddMag / 80);
  const scoreSharpe   = clamp01((m.sharpe ?? 0) / 2);
  const scoreSortino  = clamp01((m.sortino ?? 0) / 3);
  const scoreBalance  = clamp01(m.diversificationScore ?? 0);

  const Hint = ({ text }) =>
    detail ? (
      <span
        className="inline-flex items-center justify-center w-8 h-8 text-[20px] font-semibold text-slate-600 cursor-help select-none"
        title={text}
        aria-label={text}
      >
        ?
      </span>
    ) : null;

  const tips = {
    growth:   `CAGR: ${fmtPctStr(m.cagrPct)} — higher is better.`,
    stab:     `Volatility: ${fmtPctStr(m.annualizedVolatilityPct)} — lower is smoother.`,
    resil:    `Max drawdown: ${fmtPctStr(m.maxDrawdownPct)} — less negative is better.`,
    sharpe:   `Sharpe: ${fmtNum(m.sharpe)} — higher is better.`,
    sortino:  `Sortino: ${fmtNum(m.sortino)} — higher is better.`,
    balance:  `Diversification: ${fmtNum(m.diversificationScore)} — higher is better.`
  };

  return (
  <div className="relative flex flex-col bg-white overflow-hidden h-full ">
    <section className="flex flex-col flex-1 min-h-0 p-4 justify-between">
        <header>
          <h3 className="text-[18px] font-semibold text-slate-900 m-0 leading-none">
            Portfolio Metrics
          </h3>
          <div className="mt-1 h-px bg-slate-200" />
        </header>

        {/* KPIs: one line, centered, smooth 1300ms */}
        <div className="flex flex-nowrap items-stretch justify-between w-full mt-2">
          <div
            className="shrink-0"
            style={{ width: `${widthPercent}%`, transition: "width 1300ms ease" }}
          >
            <KPI label="End Value" value={fmt2(endVal)} />
          </div>

          <div
            className="shrink-0"
            style={{ width: `${widthPercent}%`, transition: "width 1300ms ease" }}
          >
            <KPI
              label="Gain"
              value={fmt2(m.gain)}
              tone={m.gain < 0 ? "down" : "up"}
            />
          </div>

          {hasYieldGain && (
            <div
              className="shrink-0"
              style={{ width: `${widthPercent}%`, transition: "width 1300ms ease" }}
            >
              <KPI
                label="Gain on Yield"
                value={fmt2(m.gainOnYield)}
                tone={m.gainOnYield < 0 ? "down" : "up"}
              />
            </div>
          )}
        </div>

        {/* Gauges: two rows of three; labels + ? bigger; bars 8px exact */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <GaugeRow category="Growth"     score={scoreGrowth}  hint={<Hint text={tips.growth} />} />
          <GaugeRow category="Stability"  score={scoreStab}    hint={<Hint text={tips.stab} />} />
          <GaugeRow category="Resilience" score={scoreResil}   hint={<Hint text={tips.resil} />} />
          <GaugeRow category="Efficiency" score={scoreSharpe}  hint={<Hint text={tips.sharpe} />} />
          <GaugeRow category="Smoothness" score={scoreSortino} hint={<Hint text={tips.sortino} />} />
          <GaugeRow category="Balance"    score={scoreBalance} hint={<Hint text={tips.balance} />} />
        </div>
      </section>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function KPI({ label, value, tone }) {
  const toneClass =
    tone === "up" ? "text-slate-900" :
    tone === "down" ? "text-slate-900" :
    "text-slate-900";

  return (
    <div className="p-3 bg-white h-full text-center flex flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center">
        <span className="text-[10px] tracking-wider uppercase text-slate-500">{label}</span>
      </div>
      <div className={`mt-1 text-[22px] font-semibold leading-none ${toneClass}`}>{value}</div>
    </div>
  );
}

function GaugeRow({ category, score, hint }) {
  const s = Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0;
  const pct = Math.round(s * 100);

  return (
    <div className="p-1 bg-white h-[44px] flex flex-col justify-center">
      <div className="flex items-center justify-between mb-[2px]">
        <span className="text-[18px] tracking-wider uppercase text-slate-700 leading-none">
          {category}
        </span>
        {hint /* larger ? already handled above */}
      </div>

      {/* 8px thick line that never scales */}
      <div className="w-full">
        <svg width="100%" height="8" viewBox="0 0 100 8" preserveAspectRatio="none">
          {/* track */}
          <path
            d="M 0 4 L 100 4"
            stroke="var(--line)"
            strokeWidth="8"
            vectorEffect="non-scaling-stroke"
            fill="none"
            strokeLinecap="round"
          />
          {/* fill */}
          <path
            d={`M 0 4 L ${pct} 4`}
            stroke="var(--brand, #2563eb)"
            strokeWidth="8"
            vectorEffect="non-scaling-stroke"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}


/* ---------- Helpers ---------- */
function clamp01(x) { return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0; }
function fmt2(v)   { return Number.isFinite(v) ? v.toFixed(2) : "—"; }
function fmtNum(v) { return Number.isFinite(v) ? v.toFixed(2) : "—"; }
function fmtPctStr(v) { return Number.isFinite(v) ? `${v.toFixed(2)}%` : "—"; }
