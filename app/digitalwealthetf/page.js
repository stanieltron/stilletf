"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchAssets } from "../../lib/portfolio";
import ChartBuilder from "../components/ChartBuilder";
import MetricsBuilder from "../components/MetricsBuilder";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function DigitalWealthETFPage() {
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

  // Tokenized Wealth target mix
  const desired = useMemo(() => ([
    { want: "Bitcoin", weight: 0.40 },
    { want: "Gold", weight: 0.20 },
    { want: "S&P 500", weight: 0.30 },
    { want: "T-Bills", weight: 0.10 }, // matches “Yield Dollars (T-Bills)”
  ]), []);
  const resolved = useMemo(() => resolveDesired(desired, assetsMeta), [desired, assetsMeta]);

  const assets = resolved.keys;
  const weights = resolved.weights;

  return (
    <div className="min-h-screen flex flex-col text-[var(--text)]">
      <Header />
      <main className="flex-1">
        <div className="sona-container py-12 flex flex-col gap-8">
          <div className="flex flex-col gap-3 max-w-3xl">
            <div className="sona-chip w-fit">Flagship mix</div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mt-0">
              Tokenized Wealth <span className="text-[var(--muted)]">(TWLTH)</span>
            </h1>
            <p className="text-body max-w-2xl">
              Diversified exposure across Bitcoin, global equities, gold, and T-Bills — rebalanced quarterly to stay
              disciplined through cycles.
            </p>
            <div className="sona-divider max-w-md" aria-hidden />
          </div>

          {err && (
            <div className="sona-card border border-rose-100 text-rose-800">
              {err}
            </div>
          )}
          {loading && (
            <div className="sona-card text-body">Loading…</div>
          )}

          {!loading && (
            <>
              <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
                <aside className="sona-card flex flex-col gap-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="heading-3 mb-0">Holdings</h2>
                    <div className="sona-pill-gold sona-pill">Quarterly rebalance</div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {assets.map((k, i) => {
                      const meta = assetsMeta[k] || {};
                      return (
                        <div
                          key={k}
                          className="flex items-center gap-3 text-body"
                        >
                          <span
                            className="w-8 h-8 rounded-full border border-[rgba(17,19,24,0.08)]"
                            style={{ background: meta.color || "var(--accent)" }}
                          />
                          <span className="flex-1 font-semibold">{meta.name || k}</span>
                          <span className="font-extrabold text-lg text-[var(--text)]">
                            {Math.round(weights[i] * 100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-4 border-t border-[rgba(17,19,24,0.06)]">
                    <h3 className="heading-4 mb-1">Additional info</h3>
                    <ul className="text-body-muted list-disc pl-5 space-y-1">
                      <li>Rebalancing: Quarterly</li>
                      <li>Suggested horizon: 3–5 years</li>
                      <li>Risk: Medium–High</li>
                    </ul>
                  </div>
                </aside>

                <section className="sona-card flex flex-col gap-4">
                  <ChartBuilder assets={assets} weights={weights} />
                  <MetricsBuilder assets={assets} weights={weights} showYield />
                </section>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-6">
                <Link href="/etfs" className="sona-btn sona-btn-outline">
                  ← Back to ETFs
                </Link>
                <Link href="/" className="sona-btn sona-btn-primary">
                  Back to Builder
                </Link>
              </div>
            </>
          )}

        </div>
      </main>
      <Footer />
    </div>
  );
}


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
  for (const item of desired) {
    const k = findKey(item.want);
    if (k) { keys.push(k); weights.push(item.weight); }
  }
  return { keys, weights };
}
