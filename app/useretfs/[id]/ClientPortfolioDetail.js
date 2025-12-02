// app/useretfs/[id]/ClientPortfolioDetail.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ChartBuilder from "../../components/ChartBuilder";
import MetricsBuilder from "../../components/MetricsBuilder";
import Link from "next/link";
import { fetchAssets } from "../../../lib/portfolio";

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

  return out.length ? (
    out
  ) : (
    <span key="none" className="text-sm text-[var(--muted)]">
      No positions
    </span>
  );
}

export default function ClientPortfolioDetail({ id }) {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id || null;
  const userEmail = session?.user?.email || null;

  const [loading, setLoading] = useState(true);
  const [p, setP] = useState(null);
  const [meta, setMeta] = useState({});
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/portfolios/${id}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Portfolio not found");
        const json = await res.json();
        setP(json.portfolio);

        const assetsApi = await fetchAssets();
        setMeta(assetsApi?.assets || {});
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const assets = useMemo(() => p?.assets || [], [p]);
  const weights = useMemo(() => p?.weights || [], [p]);
  const comp = useMemo(
    () => compositionSpans(assets, weights, meta),
    [assets, weights, meta]
  );

  async function onVote() {
    if (!userId && !userEmail) {
      router.push("?auth=1", { scroll: false });
      return;
    }
    const r = await fetch(`/api/portfolios/${p.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId || null,
        userEmail: userEmail || null,
      }),
    });
    if (r.ok) {
      const j = await r.json();
      setP(j.portfolio);
    } else {
      const j = await r.json().catch(() => ({}));
      alert(
        j?.error === "already_voted"
          ? "You have already voted for this portfolio."
          : "Could not vote."
      );
    }
  }

  if (loading)
    return (
      <main className="flex flex-col bg-white text-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-0 flex flex-col py-12">
          <div className="text-base text-[var(--muted)]">Loading…</div>
        </div>
      </main>
    );

  if (err || !p)
    return (
      <main className="flex flex-col bg-white text-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-0 flex flex-col py-12">
          <div className="text-base text-[var(--neg)]">
            {err || "Error loading portfolio."}
          </div>
        </div>
      </main>
    );

  return (
    <main className="flex flex-col bg-white text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-0 flex flex-col py-12">
        {/* Title row */}
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="m-0 text-3xl md:text-4xl font-extrabold tracking-tight">
            {p.nickname || "Portfolio"}
          </h1>

          <span className="text-base md:text-lg text-neutral-600">
            Votes: <span className="font-semibold">{p._count?.votes ?? 0}</span>
          </span>

          <button
            className="px-4 py-2 border border-black bg-white text-sm md:text-base font-semibold uppercase tracking-tight hover:bg-black hover:text-white transition-colors rounded-none"
            onClick={onVote}
          >
            Vote
          </button>

          <div className="ml-auto text-sm md:text-base">
            <Link
              href="/useretfs"
              className="text-neutral-600 hover:text-black underline-offset-4 hover:underline"
            >
              ← Back to lists
            </Link>
          </div>
        </div>

        {/* Optional comment */}
        {p.comment && (
          <div className="mt-6 text-lg leading-relaxed text-neutral-700 max-w-3xl">
            {p.comment}
          </div>
        )}

        {/* Two-column content */}
        <div className="grid gap-8 mt-16 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Left pane: composition */}
          <aside className="border border-black rounded-none p-8 overflow-hidden min-h-0 flex flex-col bg-white h-full max-h-full">
            <h2 className="m-0 text-xl md:text-2xl font-semibold tracking-tight">
              Composition
            </h2>
            <div className="mt-4 text-base md:text-lg leading-relaxed text-neutral-700">
              {comp}
            </div>
          </aside>

          {/* Right pane: chart + metrics + OG image */}
          <section className="grid gap-8 min-h-0 self-start">
            {/* Chart area */}
            <div className="flex flex-col overflow-visible border border-black rounded-none bg-white p-8">
              <h3 className="m-0 mb-4 text-xl md:text-2xl font-semibold tracking-tight">
                Performance preview
              </h3>
              <div className="mt-0 w-full overflow-hidden flex-1 min-h-[260px] max-w-full">
                <ChartBuilder
                  assets={assets}
                  weights={weights}
                  showYield={true}
                />
              </div>
            </div>

            {/* Metrics card */}
            <div className="min-h-0 min-w-0 flex flex-col overflow-visible border border-black rounded-none bg-white p-8">
              <h3 className="mt-0 mb-4 text-xl md:text-2xl font-semibold tracking-tight">
                Portfolio metrics
              </h3>
              <MetricsBuilder
                assets={assets}
                weights={weights}
                showYield={true}
                detail
              />
            </div>

            {/* Saved share image preview */}
            <div className="min-h-0 min-w-0 flex flex-col overflow-hidden border border-black rounded-none bg-white p-8">
              <h3 className="mt-0 mb-4 text-xl md:text-2xl font-semibold tracking-tight">
                Share image
              </h3>
              <p className="text-sm text-neutral-600 mb-4">
                This is the image generated when the portfolio was saved and
                used for social sharing.
              </p>
              <div className="w-full flex items-center justify-center bg-neutral-100 border border-dashed border-neutral-300 py-4">
                <img
                  src={`/api/portfolio-og/${p.id}`}
                  alt="Portfolio share preview"
                  className="max-w-full h-auto"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
