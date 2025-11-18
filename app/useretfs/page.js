"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { portfolioCalculator, fetchAssets } from "../../lib/portfolio";

/* --- helpers --- */
function sumPoints(weights = []) {
  return (weights || []).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}
function compositionSpans(assets = [], weights = [], meta = {}) {
  const parts = [];
  for (let i = 0; i < Math.min(assets.length, weights.length); i++) {
    const key = assets[i];
    const w = Number(weights[i] || 0);
    if (w <= 0) continue;
    const label = meta?.[key]?.name || key;
    const color = meta?.[key]?.color || "inherit";
    parts.push(
      <span key={key} style={{ color }}>
        {label}:{w}
      </span>
    );
  }
  // Insert comma separators
  const out = [];
  parts.forEach((el, i) => {
    if (i)
      out.push(
        <span key={`sep-${i}`} style={{ color: "var(--muted)" }}>
          ,{" "}
        </span>
      );
    out.push(el);
  });
  return out.length
    ? out
    : [
        <span key="none" className="text-sm text-[var(--muted)]">
          No positions
        </span>,
      ];
}

/* --- tiny chart: portfolio-with-yield only --- */
function MiniYieldChart({ assets = [], weights = [] }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!sumPoints(weights)) {
          if (alive) setRows([]);
          return;
        }
        const res = await portfolioCalculator(assets, weights);
        const series = res?.seriesWithYield || [];
        if (!series.length) {
          if (alive) setRows([]);
          return;
        }

        const end = new Date(2025, 10, 1);
        const data = series.map((v, idx) => {
          const d = new Date(end);
          d.setMonth(end.getMonth() - (series.length - 1 - idx));
          return { i: idx, v, y: d.getFullYear() };
        });
        if (alive) setRows(data);
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [assets, weights]);

  if (!rows.length) return <div className="text-sm text-[var(--muted)]">No data</div>;

  const years = rows.map((r) => r.y);
  const yearTicks = [];
  for (let i = 0; i < rows.length; i++) if (i === 0 || years[i] !== years[i - 1]) yearTicks.push(i);

  return (
    <div className="w-full h-[110px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="i" ticks={yearTicks} tickFormatter={(i) => years[i]} />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="v"
            name="Portfolio ($, with yield)"
            dot={false}
            stroke="var(--pos)"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --- quick metrics (end value + total return %) --- */
function MiniMetrics({ assets = [], weights = [] }) {
  const [endVal, setEndVal] = useState(0);
  const [retPct, setRetPct] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!sumPoints(weights)) {
          if (alive) {
            setEndVal(0);
            setRetPct(0);
          }
          return;
        }
        const res = await portfolioCalculator(assets, weights);
        const s = res?.seriesWithYield?.length ? res.seriesWithYield : res?.series || [];
        if (!s.length) {
          if (alive) {
            setEndVal(0);
            setRetPct(0);
          }
          return;
        }
        const start = s[0];
        const end = s[s.length - 1];
        const tr = start ? ((end - start) / start) * 100 : 0;
        if (alive) {
          setEndVal(end);
          setRetPct(tr);
        }
      } catch {
        if (alive) {
          setEndVal(0);
          setRetPct(0);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [assets, weights]);

  return (
    <div className="grid grid-cols-2 gap-3 mt-2">
      <div>
        <div className="text-sm text-[var(--muted)]">End value ($)</div>
        <div className="text-[24px] font-extrabold tracking-[0.2px]">{endVal.toFixed(2)}</div>
      </div>
      <div>
        <div className="text-sm text-[var(--muted)]">Total return %</div>
        <div className="text-[24px] font-extrabold tracking-[0.2px]">{retPct.toFixed(2)}</div>
      </div>
    </div>
  );
}

function PortfolioCard({ p, meta }) {
  const comp = useMemo(() => compositionSpans(p.assets, p.weights, meta), [p.assets, p.weights, meta]);

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 bg-white">
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <div className="font-bold truncate">{p.nickname || "Untitled portfolio"}</div>
          {p.comment && (
            <div className="text-[var(--muted)] mt-0.5 text-xs truncate">{p.comment}</div>
          )}
          <div className="text-[var(--muted)] text-xs flex gap-1.5 mt-1.5">
            <span>{p._count?.votes ?? 0} votes</span>
          </div>
        </div>
        <Link
          href={`/useretfs/${p.id}`}
          className="ml-auto inline-block border border-[var(--border)] bg-white rounded-lg px-2.5 py-1.5 font-bold leading-none"
        >
          Open
        </Link>
      </div>

      {/* tiny yield-only chart */}
      <MiniYieldChart assets={p.assets} weights={p.weights} />

      {/* compact metrics */}
      <MiniMetrics assets={p.assets} weights={p.weights} />

      {/* colored composition summary */}
      <div className="text-sm text-[var(--muted)] mt-2">
        Composition: {comp}
      </div>
    </div>
  );
}

export default function UserETFsPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id || null;

  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState([]);
  const [mine, setMine] = useState([]);
  const [meta, setMeta] = useState({});
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("all"); // 'all' | 'mine'

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // asset metadata (names + colors)
        const assetsApi = await fetchAssets();
        const assetsMeta = assetsApi?.assets || {};
        if (alive) setMeta(assetsMeta);

        // All portfolios
        const rAll = await fetch("/api/portfolios", { cache: "no-store" });
        const jAll = await rAll.json();
        const listAll = Array.isArray(jAll?.portfolios) ? jAll.portfolios : [];

        // My portfolios (server derives user from session)
        let listMine = [];
        if (userId) {
          const rMine = await fetch(`/api/portfolios?mine=1`, { cache: "no-store" });
          const jMine = await rMine.json();
          listMine = Array.isArray(jMine?.portfolios) ? jMine.portfolios : [];
        }

        if (!alive) return;
        setAll(listAll);
        setMine(listMine);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const list = tab === "mine" ? mine : all;

  return (
    <div className="min-h-full flex flex-col">
      <Header />

      <main className="flex flex-col">
        <div className="mx-auto w-[80%] flex flex-col">
          <h2>User ETFs</h2>

          {/* Tabs */}
          <div className="flex gap-2 mt-2">
            <button
              className={[
                "border border-[var(--border)] bg-white rounded-lg px-2.5 py-1.5 font-bold leading-none",
                tab === "all" ? "opacity-100" : "opacity-60",
              ].join(" ")}
              onClick={() => setTab("all")}
            >
              All
            </button>
            <button
              className={[
                "border border-[var(--border)] bg-white rounded-lg px-2.5 py-1.5 font-bold leading-none",
                tab === "mine" ? "opacity-100" : "opacity-60",
                !userId ? "cursor-not-allowed opacity-50" : "",
              ].join(" ")}
              onClick={() => setTab("mine")}
              disabled={!userId}
              title={userId ? "Show my portfolios" : "Login to see yours"}
            >
              Mine
            </button>
          </div>

          {err && <div className="text-sm text-[var(--neg)] mt-8">{err}</div>}
          {loading && <div className="text-sm text-[var(--muted)] mt-8">Loading…</div>}

          {!loading && (
            <>
              {tab === "mine" && userId && mine.length === 0 && (
                <div className="text-sm text-[var(--muted)] mt-8">
                  You haven’t saved any portfolios yet.
                </div>
              )}
              <div className="grid gap-3 mt-3 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
                {list.map((p) => (
                  <PortfolioCard key={p.id} p={p} meta={meta} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
