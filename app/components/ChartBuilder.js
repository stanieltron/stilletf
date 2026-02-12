"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
function ETFLegend({ payload, showEtf, showYield }) {
  if (!payload) return null;

  const items = payload.filter(
    (item) =>
      item.dataKey === "portfolio" || item.dataKey === "portfolioYield"
  );
  const legendItems = [];

  if (showEtf) {
    const base = items.find((item) => item.dataKey === "portfolio");
      legendItems.push({
        key: "portfolio",
        label: base?.value || "ETF",
        color: base?.color || "var(--text, #201909)",
      });
    }

  if (showYield) {
    const yieldItem = items.find((item) => item.dataKey === "portfolioYield");
      legendItems.push({
        key: "portfolioYield",
        label: yieldItem?.value || "ETF (with yield)",
        color: yieldItem?.color || "var(--yield-gold, #f2c55f)",
      });
    }

  if (!legendItems.length) return null;

  return (
    <div className="mt-2 flex gap-4 text-xs text-[var(--muted)]">
      {legendItems.map((item) => (
        <div key={item.key} className="flex items-center gap-1.5">
          <span
            className="inline-block"
            style={{
              width: 18,
              height: 3,
              borderRadius: 999,
              background: item.color,
            }}
          />
          <span>{item.label}</span>
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
  const chartWrapRef = useRef(null);
  const [isTouchMode, setIsTouchMode] = useState(false);
  const [pinnedTooltipState, setPinnedTooltipState] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 900px), (hover: none), (pointer: coarse)");
    const updateTouchMode = () => setIsTouchMode(media.matches);
    updateTouchMode();
    if (media.addEventListener) {
      media.addEventListener("change", updateTouchMode);
      return () => media.removeEventListener("change", updateTouchMode);
    }
    media.addListener(updateTouchMode);
    return () => media.removeListener(updateTouchMode);
  }, []);

  useEffect(() => {
    if (!isTouchMode) setPinnedTooltipState(null);
  }, [isTouchMode]);

  useEffect(() => {
    if (!isTouchMode || !pinnedTooltipState) return;
    const handleOutsideTap = (event) => {
      const target = event.target;
      if (
        chartWrapRef.current &&
        target instanceof Node &&
        chartWrapRef.current.contains(target)
      ) {
        return;
      }
      setPinnedTooltipState(null);
    };
    document.addEventListener("pointerdown", handleOutsideTap);
    return () => document.removeEventListener("pointerdown", handleOutsideTap);
  }, [isTouchMode, pinnedTooltipState]);

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
      const color = meta.color || "#8884d8";
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
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    for (let i = 0; i < len; i++) {
      const row = {
        i,
        year: years[i],
        month: months[i],
        periodLabel: `${monthNames[months[i]]} ${years[i]}`,
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

  const readTooltipState = (chartState) => {
    if (!chartState) return null;
    let payload = Array.isArray(chartState.activePayload)
      ? chartState.activePayload
      : [];
    const indexRaw = Number(
      payload[0]?.payload?.i ?? chartState.activeTooltipIndex ?? chartState.activeLabel
    );
    const index = Number.isFinite(indexRaw) ? indexRaw : null;
    if (!payload.length && index != null && index >= 0 && index < chartData.rows.length) {
      const point = chartData.rows[index];
      if (point) {
        const fallback = [];
        if (!yieldOnly && Number.isFinite(point.portfolio)) {
          fallback.push({
            dataKey: "portfolio",
            name: "ETF",
            value: point.portfolio,
            color: "var(--text, #201909)",
            payload: point,
          });
        }
        if ((showYield || yieldOnly) && Number.isFinite(point.portfolioYield)) {
          fallback.push({
            dataKey: "portfolioYield",
            name: "ETF (with yield)",
            value: point.portfolioYield,
            color: "var(--yield-gold, #f2c55f)",
            payload: point,
          });
        }
        if (!yieldOnly) {
          for (const asset of chartData.perAsset) {
            const value = point?.[asset.key];
            if (Number.isFinite(value)) {
              fallback.push({
                dataKey: asset.key,
                name: asset.name,
                value,
                color: asset.color || "#8884d8",
                payload: point,
              });
            }
          }
        }
        payload = fallback;
      }
    }
    if (!payload.length) return null;
    const coordinateRaw = chartState.activeCoordinate;
    const coordinate =
      coordinateRaw &&
      Number.isFinite(coordinateRaw.x) &&
      Number.isFinite(coordinateRaw.y)
        ? { x: coordinateRaw.x, y: coordinateRaw.y }
        : null;
    return {
      payload,
      label: index ?? chartState.activeLabel ?? 0,
      index,
      coordinate,
    };
  };

  const handleChartClick = (chartState) => {
    if (!isTouchMode) return;
    const nextState = readTooltipState(chartState);
    if (!nextState) {
      setPinnedTooltipState(null);
      return;
    }
    setPinnedTooltipState((current) =>
      current?.index === nextState.index ? null : nextState
    );
  };

  const mobileTooltipStyle = useMemo(() => {
    if (!isTouchMode || !pinnedTooltipState?.payload?.length) return null;
    const container = chartWrapRef.current;
    const width = container?.clientWidth || 0;
    const height = container?.clientHeight || 0;
    const coordinate = pinnedTooltipState.coordinate || {
      x: width / 2,
      y: height / 2,
    };
    const tooltipWidth = width > 0 ? Math.min(280, Math.max(180, width - 12)) : 240;
    const tooltipHeight = 120;

    let left = coordinate.x - tooltipWidth / 2;
    left = Math.max(6, Math.min(left, Math.max(6, width - tooltipWidth - 6)));

    let top = coordinate.y - tooltipHeight - 12;
    if (top < 6) {
      top = Math.min(Math.max(6, height - tooltipHeight - 6), coordinate.y + 12);
    }
    if (!Number.isFinite(top)) top = 6;

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${tooltipWidth}px`,
    };
  }, [isTouchMode, pinnedTooltipState]);

  const renderPortfolioTooltip = ({ active, payload, label }) => {
    if (!active || !Array.isArray(payload) || !payload.length) return null;
    const point = payload[0]?.payload || {};
    const title = point.periodLabel || `Point ${Number(label) + 1}`;
    return (
      <div className="rounded-[14px] border border-[var(--line)] bg-white/95 px-3 py-2 shadow-[0_8px_20px_rgba(32,25,9,0.14)]">
        <p className="text-[12px] font-semibold text-[var(--text)]">{title}</p>
        <div className="mt-2 space-y-1.5">
          {payload.map((entry) => (
            <div
              key={entry.dataKey}
              className="flex items-center justify-between gap-3 text-[11px]"
            >
              <span className="flex items-center gap-1.5 text-[var(--muted)]">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: entry.color || "var(--text)" }}
                />
                {entry.name}
              </span>
              <span className="font-semibold text-[var(--text)]">
                {fmtUSD(Number(entry.value))}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
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
      <Tooltip
        isAnimationActive={false}
        cursor={{ stroke: "rgba(32,25,9,0.22)", strokeWidth: 1 }}
        content={isTouchMode ? (() => null) : renderPortfolioTooltip}
        wrapperStyle={{ outline: "none", zIndex: 30, pointerEvents: "none" }}
      />

      {!legendOff && (
        <Legend
          verticalAlign="bottom"
          align="left"
          layout="horizontal"
          content={
            <ETFLegend
              showEtf={!yieldOnly}
              showYield={showYield || yieldOnly}
            />
          }
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
          stroke="var(--text, #201909)"
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
          stroke="var(--yield-gold, #f2c55f)"
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
            stroke={a.color || "#8884d8"}
            strokeWidth={2}
            strokeOpacity={0.9}
            isAnimationActive={animated}
          />
        ))}
    </>
  );

  // Responsive-only: fill parent (width & height)
  return (
    <div
      ref={chartWrapRef}
      className="relative w-full h-full"
      style={{ minHeight: 0, minWidth: 0 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData.rows}
          margin={{ top: 6, right: 12, left: 0, bottom: 24 }}
          onClick={handleChartClick}
        >
          {inner}
        </LineChart>
      </ResponsiveContainer>
      {isTouchMode && pinnedTooltipState?.payload?.length && mobileTooltipStyle ? (
        <div className="pointer-events-none absolute z-30" style={mobileTooltipStyle}>
          {renderPortfolioTooltip({
            active: true,
            payload: pinnedTooltipState.payload,
            label: pinnedTooltipState.label,
          })}
        </div>
      ) : null}
    </div>
  );
}
