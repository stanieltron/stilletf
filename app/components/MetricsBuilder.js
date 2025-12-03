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
export default function MetricsBuilder({
  assets = [],
  weights = [],
  showYield = false,
  detail,
  onReady,
  assetMeta,
}) {
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const ticketRef = useRef(0);
  const assetMetaKey = assetMeta ? Object.keys(assetMeta).join(",") : "";

  useEffect(() => {
    let alive = true;
    const myTicket = ++ticketRef.current;
    const numericWeights = (weights || []).map((w) => {
      const n = Number(w);
      return Number.isFinite(n) ? n : 0;
    });

    (async () => {
      try {
        setErr("");
        const sum = numericWeights.reduce((a, b) => a + b, 0);
        if (sum <= 0) {
          if (alive && ticketRef.current === myTicket) setResult(null);
          return;
        }
        const res = await portfolioCalculator(assets, numericWeights, assetMeta);
        if (!alive || ticketRef.current !== myTicket) return;
        setResult(res);
        const hasData =
          res &&
          Array.isArray(res.series) &&
          res.series.length > 0;
        if (onReady && hasData) {
          setTimeout(() => {
            if (alive && ticketRef.current === myTicket) onReady();
          }, 0);
        }
      } catch (e) {
        if (!alive || ticketRef.current !== myTicket) return;
        setErr(e?.message || String(e));
      }
    })();

    return () => { alive = false; };
  }, [assets, weights, assetMetaKey]);

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
    <div className="metrics">
      <div className="metrics-kpis">
        <KPI label="End Value" value={fmt2(endVal)} tone={m.gain < 0 ? "down" : "up"} />
        <KPI label="Gain" value={fmt2(m.gain)} tone={m.gain < 0 ? "down" : "up"} />
        {hasYieldGain && (
          <KPI
            label="Gain on Yield"
            value={fmt2(m.gainOnYield)}
            tone={m.gainOnYield < 0 ? "down" : "up"}
          />
        )}
      </div>

      <div className="metrics-grid">
        <GaugeRow category="Growth"     score={scoreGrowth}  hint={<Hint text={tips.growth} />} />
        <GaugeRow category="Stability"  score={scoreStab}    hint={<Hint text={tips.stab} />} />
        <GaugeRow category="Resilience" score={scoreResil}   hint={<Hint text={tips.resil} />} />
        <GaugeRow category="Efficiency" score={scoreSharpe}  hint={<Hint text={tips.sharpe} />} />
        <GaugeRow category="Smoothness" score={scoreSortino} hint={<Hint text={tips.sortino} />} />
        <GaugeRow category="Balance"    score={scoreBalance} hint={<Hint text={tips.balance} />} />
      </div>
    </div>
  );
}



/* ---------- Subcomponents ---------- */

function KPI({ label, value, tone }) {
  return (
    <div className="metric-kpi">
      <span className="metric-kpi-label">{label}</span>
      <span className="metric-kpi-value">{value}</span>
    </div>
  );
}

function GaugeRow({ category, score, hint }) {
  const s = Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0;
  const pct = Math.round(s * 100);

  return (
    <div className="metric-gauge">
      <div className="metric-gauge-header">
        <span className="metric-gauge-title">{category}</span>
        {hint}
      </div>
      <div className="metric-gauge-bar">
        <span className="metric-gauge-track" />
        <span
          className="metric-gauge-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}



/* ---------- Helpers ---------- */
function clamp01(x) { return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0; }
function fmt2(v)   { return Number.isFinite(v) ? v.toFixed(2) : "–"; }
function fmtNum(v) { return Number.isFinite(v) ? v.toFixed(2) : "–"; }
function fmtPctStr(v) { return Number.isFinite(v) ? `${v.toFixed(2)}%` : "–"; }
