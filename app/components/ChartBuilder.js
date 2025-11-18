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
 * Custom legend – only show ETF & ETF (with yield).
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
 * ChartBuilder
 * - Returns size-aware content that fills its parent container.
 * - No fixed heights here; parent .chart-wrap/.chart-area governs size.
 */
export default function ChartBuilder({
  assets = [],
  weights = [],
  showYield = false,
}) {
  const [result, setResult] = useState(null);
  const [assetMap, setAssetMap] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const initialCapital = 1000;

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoading(true);
        setErr("");
        const sum = weights.reduce(
          (a, b) => a + (Number.isFinite(b) ? b : 0),
          0
        );
        if (sum <= 0) {
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

        if (!res.assets) {
          const all = await fetchAssets();
          if (!alive) return;
          setAssetMap(all.assets || null);
        } else {
          setAssetMap(res.assets);
        }
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
  }, [assets, weights]);

  const chartData = useMemo(() => {
    if (!result)
      return { rows: [], perAsset: [], activeKeys: [], years: [], yearTicks: [] };

    const pct = result.weights ?? [];
    const activeKeys = assets.filter((_, i) => (pct[i] ?? 0) > 0);

    const perAsset = activeKeys.map((key) => {
      const i = assets.indexOf(key);
      const a = assetMap?.[key];
      const name = a?.name || key;
      const color = a?.color || "#8884d8";
      const prices = a?.prices || [];
      const alloc = (pct[i] ?? 0) * initialCapital;
      const p0 = prices?.[0] || 1;
      const series = Array.isArray(prices)
        ? prices.map((pt) => Number((alloc * (pt / p0)).toFixed(2)))
        : [];
      return { key, name, color, series };
    });

    const portfolio = result.series || [];
    const portfolioYield = result.seriesWithYield || [];

    const len = Math.min(
      portfolio.length || 0,
      portfolioYield.length || portfolio.length || 0,
      ...(perAsset.length ? perAsset.map((a) => a.series.length || 0) : [Infinity])
    );

    const end = new Date(2025, 10, 1);
    const years = new Array(len);
    const months = new Array(len);
    for (let i = 0; i < len; i++) {
      const d = new Date(end);
      d.setMonth(end.getMonth() - (len - 1 - i));
      years[i] = d.getFullYear();
      months[i] = d.getMonth();
    }
    const yearTicks = [];
    for (let i = 0; i < len; i++) if (months[i] === 0) yearTicks.push(i);

    const rows = [];
    for (let i = 0; i < len; i++) {
      const row = { i, year: years[i], portfolio: portfolio[i] };
      if (portfolioYield.length) row.portfolioYield = portfolioYield[i];
      for (const a of perAsset) row[a.key] = a.series[i];
      rows.push(row);
    }

    return { rows, perAsset, activeKeys, years, yearTicks };
  }, [result, assets, assetMap, showYield]);

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
    return <div className="text-sm text-[var(--muted)]">No data</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData.rows}
        margin={{ top: 6, right: 12, left: 0, bottom: 24 }} // extra bottom room for legend
      >
        {/* No grid for a cleaner ETF-style look */}
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
        <Tooltip
          formatter={(val, name) => [fmtUSD(val), name]}
          labelFormatter={(i) => chartData.years[i]}
          wrapperStyle={{ outline: "none" }}
          contentStyle={{
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            color: "var(--text)",
          }}
        />
        <Legend
          verticalAlign="bottom"
          align="left"
          layout="horizontal"
          content={<ETFLegend />}
        />

        {/* ETF main line – bright green */}
        <Line
          type="monotone"
          dataKey="portfolio"
          name="ETF"
          dot={false}
          activeDot={{ r: 3 }}
          stroke="var(--pos, #ff0000ff)"
          strokeWidth={5}
          strokeLinecap="round"
          animationDuration={400}
        />

        {/* ETF with yield – thicker blue with a bit of “shine” via round caps */}
        {showYield && (
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
            animationDuration={400}
          />
        )}

        {/* Asset lines keep their configured colors; excluded from legend via custom legend */}
        {chartData.perAsset.map((a) => (
          <Line
            key={a.key}
            type="monotone"
            dataKey={a.key}
            name={a.name}
            dot={false}
            activeDot={{ r: 2 }}
            stroke={a.color || "#8884d8"}
            strokeWidth={2}
            strokeOpacity={0.9}
            animationDuration={350}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
