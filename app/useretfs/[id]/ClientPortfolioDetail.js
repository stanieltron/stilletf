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
    const color = meta?.[key]?.color || "var(--text)";
    parts.push({
      key,
      label,
      weight: w,
      color,
    });
  }

  if (!parts.length) {
    return (
      <span key="none" className="text-sm text-[var(--muted)]">
        No positions
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {parts.map((item) => (
        <span
          key={item.key}
          style={{ color: item.color, borderColor: item.color }}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full border bg-[var(--bg-alt)] text-xs sm:text-sm font-semibold shadow-sm"
        >
          <span className="text-[var(--muted)]">*</span>
          <span className="truncate max-w-[200px]">{item.label}</span>
          <span className="text-[11px] sm:text-xs text-[var(--muted)]">
            {item.weight}
          </span>
        </span>
      ))}
    </div>
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

  const LoadingState = (
    <main className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col py-12">
        <div className="w-full p-6 sm:p-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-alt)] shadow-md">
          <div className="text-base sm:text-lg text-[var(--muted)]">Loading...</div>
        </div>
      </div>
    </main>
  );

  const ErrorState = (
    <main className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col py-12">
        <div className="w-full p-6 sm:p-8 rounded-2xl border border-[var(--neg)] bg-[var(--bg-alt)] shadow-md">
          <div className="text-base sm:text-lg text-[var(--neg)]">
            {err || "Error loading portfolio."}
          </div>
        </div>
      </div>
    </main>
  );

  if (loading) return LoadingState;
  if (err || !p) return ErrorState;

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col py-10 sm:py-14 lg:py-16 gap-10">
        {/* Title row */}
        <div className="w-full rounded-3xl border border-[var(--border)] bg-gradient-to-r from-[var(--bg-alt)] to-[var(--bg-soft)] p-6 sm:p-8 shadow-lg">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h1 className="m-0 text-3xl sm:text-4xl font-extrabold tracking-tight">
              {p.nickname || "Portfolio"}
            </h1>

            <span className="text-sm sm:text-base text-[var(--muted)] bg-[var(--bg)] border border-[var(--border)] px-3 py-1.5 rounded-full shadow-sm">
              Votes: <span className="font-semibold text-[var(--text)]">{p._count?.votes ?? 0}</span>
            </span>

            <button
              className="px-4 sm:px-5 py-2 rounded-full border border-[var(--border)] bg-[var(--accent)] text-[var(--bg)] text-sm sm:text-base font-semibold uppercase tracking-tight shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
              onClick={onVote}
            >
              Vote
            </button>

            <div className="ml-auto text-sm sm:text-base">
              <Link
                href="/useretfs"
                className="inline-flex items-center gap-2 text-[var(--text)] hover:text-[var(--accent)] underline-offset-4 hover:underline transition-colors"
              >
                Back to lists
              </Link>
            </div>
          </div>

          {p.comment && (
            <div className="mt-6 text-base sm:text-lg leading-relaxed text-[var(--text)]/90 max-w-3xl">
              {p.comment}
            </div>
          )}
        </div>

        {/* Two-column content */}
        <div className="grid gap-8 lg:gap-10 grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Left pane: composition */}
          <aside className="border border-[var(--border)] rounded-3xl p-6 sm:p-7 bg-[var(--bg-alt)] shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-xl sm:text-2xl font-semibold tracking-tight">
                Composition
              </h2>
              <span className="text-xs sm:text-sm text-[var(--muted)] font-semibold uppercase tracking-wide">
                weights
              </span>
            </div>
            <div className="text-sm sm:text-base leading-relaxed text-[var(--text)]">
              {comp}
            </div>
          </aside>

          {/* Right pane: chart + metrics */}
          <section className="grid gap-6 sm:gap-8 min-h-0 self-start">
            {/* Chart area */}
            <div className="flex flex-col overflow-hidden border border-[var(--border)] rounded-3xl bg-[var(--bg-alt)] p-6 sm:p-8 shadow-md">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="m-0 text-xl sm:text-2xl font-semibold tracking-tight">
                  Performance preview
                </h3>
                <span className="text-xs sm:text-sm text-[var(--muted)] uppercase tracking-wide">
                  yield on
                </span>
              </div>
              <div className="mt-0 w-full overflow-hidden flex-1 min-h-[260px] max-w-full rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
                <ChartBuilder assets={assets} weights={weights} showYield={true} />
              </div>
            </div>

            {/* Metrics card */}
            <div className="min-h-0 min-w-0 flex flex-col overflow-hidden border border-[var(--border)] rounded-3xl bg-[var(--bg-alt)] p-6 sm:p-8 shadow-md gap-3">
              <h3 className="mt-0 text-xl sm:text-2xl font-semibold tracking-tight">
                Portfolio metrics
              </h3>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 sm:p-5">
                <MetricsBuilder assets={assets} weights={weights} showYield={true} detail />
              </div>
            </div>
          </section>
        </div>

        <div className="mt-2">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-3 px-6 sm:px-8 py-4 rounded-full bg-[var(--text)] text-[var(--bg)] font-semibold text-base sm:text-lg shadow-lg border border-[var(--border)] hover:-translate-y-0.5 hover:shadow-xl transition-all"
          >
            Can you do better? Try on your own
          </Link>
        </div>
      </div>
    </main>
  );
}
