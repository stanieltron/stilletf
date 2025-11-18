// app/etfs/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { fetchAssets, portfolioCalculator } from "../../lib/portfolio";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function ETFsPage() {
  const [assetsMeta, setAssetsMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const api = await fetchAssets();
        if (!alive) return;
        setAssetsMeta(api.assets || {});
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <Header />

      <main className="flex flex-col">
        <div className="mx-auto w-[80%] flex flex-col">
          <h1 className="mt-0">Explore ETFs</h1>
          <p className="text-sm text-[var(--muted)]">
            Each card shows the portfolio <b>with-yield</b> trendline, colored asset list, and the same “character” metrics used on the builder.
          </p>

          {err && <div className="text-sm text-[var(--neg)] mt-8">{err}</div>}
          {loading && <div className="text-sm text-[var(--muted)] mt-8">Loading…</div>}

          {!loading && (
            <div className="grid gap-4 mt-12 md:grid-cols-1 grid-cols-2">
              <ETFCard
                href="/btcetf"
                title="BTC Only ETF"
                ticker="BTCX"
                description="Pure Bitcoin exposure."
                desired={[{ want: "Bitcoin", weight: 1.0 }]}
                assetsMeta={assetsMeta}
              />

              <ETFCard
                href="/digitalwealthetf"
                title="Tokenized Wealth"
                ticker="TWLTH"
                description="Blend of growth (BTC, S&P 500) and defensive (Gold, T-Bills)."
                desired={[
                  { want: "Bitcoin",  weight: 0.40 },
                  { want: "Gold",     weight: 0.20 },
                  { want: "S&P 500",  weight: 0.30 },
                  { want: "T-Bills",  weight: 0.10 },
                ]}
                assetsMeta={assetsMeta}
              />
            </div>
          )}

          <div className="mt-32">
            <Link
              href="/"
              className="border border-[var(--border)] bg-white rounded-lg px-2.5 py-1.5 font-bold cursor-pointer leading-none inline-block"
            >
              Back to Builder
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function ETFCard({ href, title, ticker, description, desired, assetsMeta }) {
  const [calc, setCalc] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const resolved = useMemo(() => resolveDesired(desired, assetsMeta), [desired, assetsMeta]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        setCalc(null);
        if (!resolved.keys.length) {
          setErr("No matching assets found on server.");
          return;
        }
        const res = await portfolioCalculator(resolved.keys, resolved.weights);
        if (!alive) return;
        setCalc(res);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [resolved.keys.join(","), JSON.stringify(resolved.weights)]);

  // With-yield series only → mini chart data
  const seriesWithYield = calc?.seriesWithYield || [];
  const miniData = useMemo(() => {
    if (!Array.isArray(seriesWithYield) || !seriesWithYield.length) return [];
    return seriesWithYield.map((v, i) => ({ i, y: Number.isFinite(v) ? v : 0 }));
  }, [seriesWithYield]);

  // Metrics (WITH yield)
  const m = calc?.metricsOn || {};
  const endVal = seriesWithYield.length ? seriesWithYield.at(-1) : 0;

  // Character scores (same normalization as MetricsBuilder)
  const scoreGrowth   = clamp01((m.cagrPct ?? 0) / 30);                                // higher better
  const scoreStab     = 1 - clamp01((Math.abs(m.annualizedVolatilityPct ?? 0)) / 120); // lower vol better
  const ddMag         = Math.abs(m.maxDrawdownPct ?? 0);
  const scoreResil    = 1 - clamp01(ddMag / 80);                                       // lower DD better
  const scoreSharpe   = clamp01((m.sharpe ?? 0) / 2);
  const scoreSortino  = clamp01((m.sortino ?? 0) / 3);
  const scoreBalance  = clamp01(m.diversificationScore ?? 0);

  return (
    <Link
      href={href}
      className="block border border-[var(--border)] rounded-xl p-4 no-underline bg-white hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <h3 className="mt-0">
        {title}{" "}
        <span className="text-sm text-[var(--muted)]">({ticker})</span>
      </h3>
      <p className="text-sm text-[var(--muted)]">{description}</p>

      {/* Colored asset list (names in their color) */}
      <div className="mt-3 grid gap-1.5">
        {resolved.keys.map((k, i) => {
          const meta = assetsMeta[k] || {};
          const color = meta.color || "#999";
          return (
            <div key={k} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block w-[10px] h-[10px] rounded-full align-middle"
                style={{ background: color, border: `1px solid ${color}` }}
              />
              <span style={{ color }}>{meta.name || k}</span>
              <span className="font-bold ml-auto">{Math.round(resolved.weights[i] * 100)}%</span>
            </div>
          );
        })}
      </div>

      {/* Mini chart: with-yield trendline only */}
      <div className="mt-12 h-[180px] w-full border border-[var(--border)] rounded-lg p-2">
        {loading && <div className="text-sm text-[var(--muted)]">Computing…</div>}
        {err && <div className="text-sm text-[var(--neg)]">{err}</div>}
        {!loading && !err && miniData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={miniData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="i" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                formatter={(val) => [`$${Number(val).toFixed(2)}`, "Portfolio (with yield)"]}
                labelFormatter={() => ""}
              />
              <Line
                type="monotone"
                dataKey="y"
                stroke="var(--pos)"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* KPI row (compact) */}
      <div className="mt-12 grid grid-cols-3 gap-3 md:grid-cols-1">
        <KPI
          icon="💰"
          label={<>End Value <span className="inline-block text-[11px] text-[var(--muted)] px-1.5 py-[2px] border border-[var(--border)] rounded-full leading-[1.1]">with yield</span></>}
          value={fmt2(endVal)}
        />
        <KPI
          icon="🚀"
          label="Growth (CAGR %)"
          value={fmtPct(m.cagrPct)}
          cls={Number.isFinite(m.cagrPct) && m.cagrPct < 0 ? "text-red-700" : "text-green-700"}
        />
        <KPI
          icon="🧩"
          label="Diversification"
          value={fmt2(m.diversificationScore)}
        />
      </div>

      {/* Character grid with gauges — same visual as main page */}
      <div className="mt-12 grid grid-cols-3 gap-3 md:grid-cols-2 sm:grid-cols-1">
        <GaugeRow icon="🚀" category="Growth"      score={scoreGrowth} />
        <GaugeRow icon="📏" category="Stability"   score={scoreStab} />
        <GaugeRow icon="🛡️" category="Resilience" score={scoreResil} />
        <GaugeRow icon="📊" category="Efficiency"  score={scoreSharpe} />
        <GaugeRow icon="🧘" category="Smoothness"  score={scoreSortino} />
        <GaugeRow icon="⚖️" category="Balance"     score={scoreBalance} />
      </div>

      <div className="text-sm text-[var(--muted)] mt-8">Click to view full details →</div>
    </Link>
  );
}

/* ---------- helpers ---------- */
function resolveDesired(desired, assetsMeta) {
  const entries = Object.entries(assetsMeta);
  const findKey = (needle) => {
    const n = needle.toLowerCase();
    let best = null;
    for (const [k, m] of entries) {
      const name = (m?.name || k || "").toLowerCase();
      if (name.startsWith(n)) return k;
      if (name.includes(n)) best = best ?? k;
    }
    return best;
  };
  const keys = [];
  const weights = [];
  const missing = [];
  for (const item of desired) {
    const k = findKey(item.want);
    if (k) { keys.push(k); weights.push(item.weight); } else { missing.push(item.want); }
  }
  return { keys, weights, missing };
}
function fmt2(v) { return Number.isFinite(v) ? v.toFixed(2) : "—"; }
function fmtPct(v) { return Number.isFinite(v) ? v.toFixed(2) : "—"; }
function clamp01(x) { return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0; }
function scoreToColor(score) {
  const s = clamp01(score);
  const hue = 120 * s;       // 0 (red) → 120 (green)
  const sat = 90;
  const light = 45 + 10 * s;
  return `hsl(${hue}deg ${sat}% ${light}%)`;
}

/* ---------- UI bits (Tailwind-only) ---------- */
function KPI({ icon, label, value, cls }) {
  return (
    <div
      className={`grid grid-cols-[34px_1fr] gap-[10px] items-center p-3 border border-[var(--border)] rounded-[12px] bg-white ${cls ?? ""}`}
    >
      <div className="text-[20px] leading-none" aria-hidden>{icon}</div>
      <div>
        <div className="text-xs text-[var(--muted)] flex gap-2 items-center">{label}</div>
        <div className="text-[24px] font-extrabold tracking-[0.2px]">{value}</div>
      </div>
    </div>
  );
}

function GaugeRow({ icon, category, score }) {
  const s = clamp01(score);
  const pct = Math.round(s * 100);
  const color = scoreToColor(s);
  return (
    <div className="grid grid-cols-[32px_1fr] gap-[10px] items-center p-[10px] px-3 border border-[var(--border)] rounded-[12px] bg-white relative overflow-visible">
      <div className="text-[20px] leading-none" aria-hidden>{icon}</div>
      <div className="flex flex-col">
        <div className="text-xs text-[var(--muted)] flex gap-1.5 items-center">
          <span>{category}</span>
        </div>
        <div className="mt-1.5" aria-label={`${category} score ${pct}%`}>
          <div className="relative h-[10px] w-full rounded-full bg-gradient-to-r from-rose-200 via-amber-200 to-green-200 ring-1 ring-[var(--border)] ring-inset overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      </div>
    </div>
  );
}
