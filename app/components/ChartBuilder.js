"use client";

import { useEffect, useMemo, useState } from "react";
import { portfolioCalculator, fetchAssets } from "../../lib/portfolio";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * Legend that only shows ETF + ETF (with yield).
 */
function ETFLegend({ payload }) {
  if (!payload) return null;

  const items = payload.filter(
    (item) =>
      item.dataKey === "portfolio" || item.dataKey === "portfolioYield"
  );
  if (!items.length) return null;

  return (
    <div className="mt-2 flex gap-4 text-xs text-[var(--muted)]">
      {items.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-1.5">
          <span
            className="inline-block"
            style={{
              width: 18,
              height: 3,
              borderRadius: 999,
              background: item.color,
            }}
          />
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * ChartBuilder (responsive-only)
 *
 * Props:
 * - assets: string[]
 * - weights: number[]
 * - showYield: boolean
 * - animated: boolean – if false, disable all line animations.
 * - yieldOnly: boolean – if true, show *only* the yield line (no asset lines, no baseline ETF).
 * - legendOff: boolean – if true, hide the ETF legend.
 * - onReady: optional callback when data is loaded.
 *
 * The chart always fills 100% of its parent (width & height).
 */
export default function ChartBuilder({
  assets = [],
  weights = [],
  showYield = false,
  animated = true,
  yieldOnly = false,
  legendOff = false,
  onReady,
}) {
  const [result, setResult] = useState(null);
  const [assetMap, setAssetMap] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const initialCapital = 1000;

  // fetch / compute portfolio result whenever assets or weights change
  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setErr("");

        const sum = (weights || []).reduce(
          (a, b) => a + (Number.isFinite(b) ? b : 0),
          0
        );

        if (!sum || sum <= 0) {
          if (alive) {
            setResult(null);
            setAssetMap(null);
            setLoading(false);
          }
          return;
        }

        const res = await portfolioCalculator(assets, weights);
        if (!alive) return;

        setResult(res);

        if (res && res.assets) {
          setAssetMap(res.assets);
        } else {
          const all = await fetchAssets();
          if (!alive) return;
          setAssetMap(all.assets || null);
        }

        if (onReady) onReady();
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
    // join() keeps deps stable while still reacting to changes
  }, [assets.join(","), weights.join(","), onReady]);

  // build Recharts rows
  const chartData = useMemo(() => {
    if (!result)
      return {
        rows: [],
        perAsset: [],
        years: [],
        yearTicks: [],
      };

    const pct = result.weights || [];
    const activeKeys = assets.filter((_, i) => (pct[i] ?? 0) > 0);

    // per-asset series
    const perAsset = activeKeys.map((key) => {
      const idx = assets.indexOf(key);
      const meta = assetMap?.[key] || {};
      const name = meta.name || key;
      const color = meta.color || "var(--accent)";
      const prices = Array.isArray(meta.prices) ? meta.prices : [];
      const alloc = (pct[idx] ?? 0) * initialCapital;
      const p0 = prices[0] || 1;
      const series = prices.map((p) =>
        Number((alloc * (p / p0)).toFixed(2))
      );
      return { key, name, color, series };
    });

    const portfolio = Array.isArray(result.series) ? result.series : [];

    // yield line (fall back to portfolio if yield data missing)
    let portfolioYield = Array.isArray(result.seriesWithYield)
      ? result.seriesWithYield
      : [];
    if (!portfolioYield.length && portfolio.length) {
      portfolioYield = portfolio;
    }

    const lengths = [];
    if (portfolio.length && !yieldOnly) lengths.push(portfolio.length);
    if (portfolioYield.length) lengths.push(portfolioYield.length);
    if (!yieldOnly) {
      perAsset.forEach((a) => {
        if (a.series.length) lengths.push(a.series.length);
      });
    }

    const len = lengths.length ? Math.min(...lengths) : 0;
    if (!len)
      return {
        rows: [],
        perAsset,
        years: [],
        yearTicks: [],
      };

    const end = new Date();
    const years = new Array(len);
    const months = new Array(len);
    for (let i = 0; i < len; i++) {
      const d = new Date(end);
      d.setMonth(end.getMonth() - (len - 1 - i));
      years[i] = d.getFullYear();
      months[i] = d.getMonth();
    }

    const yearTicks = [];
    for (let i = 0; i < len; i++) {
      if (months[i] === 0) yearTicks.push(i);
    }

    const rows = [];
    for (let i = 0; i < len; i++) {
      const row = {
        i,
        year: years[i],
      };
      if (!yieldOnly && portfolio.length) {
        row.portfolio = portfolio[i];
      }
      if (portfolioYield.length) {
        row.portfolioYield = portfolioYield[i];
      }
      if (!yieldOnly) {
        for (const a of perAsset) {
          row[a.key] = a.series[i];
        }
      }
      rows.push(row);
    }

    return { rows, perAsset, years, yearTicks };
  }, [result, assets, assetMap, yieldOnly]);

  const fmtUSD = (v) => {
    if (v == null || Number.isNaN(v)) return "";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v);
    } catch {
      return `$${Math.round(v).toLocaleString()}`;
    }
  };

  if (err)
    return <div className="text-sm text-[var(--neg)] mt-8">{err}</div>;
  if (!result)
    return (
      <div className="text-sm text-[var(--muted)]">
        No data yet – add some asset weight.
      </div>
    );

  const inner = (
    <>
      <XAxis
        dataKey="i"
        ticks={chartData.yearTicks}
        tickFormatter={(i) => chartData.years[i]}
        axisLine={false}
        tickLine={false}
        interval="preserveStartEnd"
        tick={{ fill: "var(--muted)", fontSize: 12 }}
      />
      <YAxis
        width={56}
        tickFormatter={fmtUSD}
        axisLine={false}
        tickLine={false}
        tick={{ fill: "var(--muted)", fontSize: 12 }}
      />
      {/* <Tooltip
        formatter={(val, name) => [fmtUSD(val), name]}
        labelFormatter={(i) => chartData.years[i]}
        wrapperStyle={{ outline: "none" }}
        contentStyle={{
          background: "var(--bg)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          color: "var(--text)",
        }}
      /> */}

      {!legendOff && (
        <Legend
          verticalAlign="bottom"
          align="left"
          layout="horizontal"
          content={<ETFLegend />}
        />
      )}

      {/* ETF main line (only when not yieldOnly) */}
      {!yieldOnly && (
        <Line
          type="monotone"
          dataKey="portfolio"
          name="ETF"
          dot={false}
          activeDot={{ r: 3 }}
          stroke="var(--text)"
          strokeWidth={5}
          strokeLinecap="round"
          isAnimationActive={animated}
        />
      )}

      {/* ETF with yield – shown if showYield OR yieldOnly */}
      {(showYield || yieldOnly) && (
        <Line
          type="monotone"
          dataKey="portfolioYield"
          name="ETF (with yield)"
          dot={false}
          activeDot={{ r: 3 }}
          stroke="var(--accent)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeOpacity={0.98}
          isAnimationActive={animated}
        />
      )}

      {/* Asset lines – only when not yieldOnly */}
      {!yieldOnly &&
        chartData.perAsset.map((a) => (
          <Line
            key={a.key}
            type="monotone"
            dataKey={a.key}
            name={a.name}
            dot={false}
            activeDot={{ r: 2 }}
            stroke={a.color || "var(--muted)"}
            strokeWidth={2}
            strokeOpacity={0.9}
            isAnimationActive={animated}
          />
        ))}
    </>
  );

  // Responsive-only: fill parent (width & height)
  return (
    <div className="w-full h-full" style={{ minHeight: 0, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData.rows}
          margin={{ top: 6, right: 12, left: 0, bottom: 24 }}
        >
          {inner}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
