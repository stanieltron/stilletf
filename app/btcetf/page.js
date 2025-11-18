"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchAssets, portfolioCalculator } from "../../lib/portfolio";
import ChartBuilder from "../components/ChartBuilder";
import MetricsBuilder from "../components/MetricsBuilder";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function BTCETFPage() {
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

  // BTC only desired mapping
  const desired = useMemo(() => [{ want: "Bitcoin", weight: 1.0 }], []);
  const resolved = useMemo(() => resolveDesired(desired, assetsMeta), [desired, assetsMeta]);

  // Normalize to match builder component API
  const assets = resolved.keys;
  const weights = resolved.weights;

  return (
    <div className="page">
      <Header />
      <main className="site-content">
        <div className="container">

          <h1 className="mt-0">BTC Only ETF <span className="metric-label">(BTCX)</span></h1>
          <p className="metric-label">Objective: pure Bitcoin exposure. High volatility and high potential upside.</p>

          {err && <div className="metric-label neg mt-8">{err}</div>}
          {loading && <div className="metric-label mt-8">Loading…</div>}

          {!loading && (
            <>
              <div className="split">
                <aside className="left-pane">
                  <h2 className="section-title">Holdings</h2>
                  {assets.map((k, i) => {
                    const meta = assetsMeta[k] || {};
                    return (
                      <div key={k} className="metric-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="badge" style={{ background: meta.color || "#999", border: `1px solid ${meta.color || "#999"}` }} />
                        <span style={{ minWidth: 160 }}>{meta.name || k}</span>
                        <span className="strong">{Math.round(weights[i] * 100)}%</span>
                      </div>
                    );
                  })}
                  <div className="mt-32">
                    <h3 className="mt-0">Additional info</h3>
                    <ul className="metric-label">
                      <li>Rebalancing: N/A (single-asset)</li>
                      <li>Suggested horizon: 4+ years</li>
                      <li>Risk: Very high</li>
                    </ul>
                  </div>
                </aside>

                <section className="right-pane">
                  {/* Chart (top) and Metrics (bottom) using your builders */}
                  <ChartBuilder assets={assets} weights={weights} />
                  <PortfolioBuilder assets={assets} weights={weights} />
                </section>
              </div>

              <div className="mt-32">
                <Link href="/ETFs" className="btn-step">← Back to ETFs</Link>
                <Link href="/" className="btn-step" style={{ marginLeft: 8 }}>Back to Builder</Link>
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
