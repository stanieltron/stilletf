"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function PortfolioDetail() {
  const params = useParams();
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
        const res = await fetch(`/api/portfolios/${params.id}`, {
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
  }, [params.id]);

  const assets = useMemo(() => p?.assets || [], [p]);
  const weights = useMemo(() => p?.weights || [], [p]);

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
      <div className="mx-auto w-[80%] flex flex-col">
        <div className="text-sm text-[var(--muted)] mt-8">Loading…</div>
      </div>
    );

  if (err || !p)
    return (
      <div className="mx-auto w-[80%] flex flex-col">
        <div className="text-sm text-[var(--neg)] mt-8">
          {err || "Error"}
        </div>
      </div>
    );

  const comp = compositionSpans(assets, weights, meta);

  return (
    <main className="flex flex-col">
      <div className="mx-auto w-[80%] flex flex-col">
        {/* Title row */}
        <div className="flex items-center gap-3">
          <h2 className="m-0">{p.nickname || "Portfolio"}</h2>
          <span className="text-sm text-[var(--muted)]">
            Votes: {p._count?.votes ?? 0}
          </span>
          <button
            className="border border-[var(--border)] bg-white rounded-lg px-2.5 py-1.5 font-bold cursor-pointer leading-none"
            onClick={onVote}
          >
            Vote
          </button>
          <div className="ml-auto">
            <Link href="/useretfs" className="text-sm text-[var(--muted)]">
              ← Back to lists
            </Link>
          </div>
        </div>

        {/* Optional comment */}
        {p.comment && (
          <div className="text-sm text-[var(--muted)] mt-8">{p.comment}</div>
        )}

        {/* Two-column content */}
        <div className="grid gap-4 mt-12 grid-cols-1 lg:grid-cols-[320px_1fr]">
          {/* Left pane */}
          <aside className="border border-[var(--border)] rounded-lg p-3 overflow-hidden min-h-0 flex flex-col bg-white h-full max-h-full">
            <h2 className="m-0 mb-3">Composition</h2>
            <div className="text-sm text-[var(--muted)] mt-1.5 leading-[1.5]">
              {comp}
            </div>
          </aside>

          {/* Right pane */}
          <section className="grid gap-4 min-h-0 self-start">
            {/* Chart area */}
            <div className="h-[30vh] min-h-[220px] flex flex-col overflow-visible border border-[var(--border)] rounded-lg bg-white p-3">
              <div className="mt-0 w-full overflow-hidden flex-1 min-h-0 max-w-full">
                <ChartBuilder assets={assets} weights={weights}showYield={true} />
              </div>
            </div>

            {/* Metrics card */}
            <div className="min-h-0 min-w-0 flex flex-col overflow-visible border border-[var(--border)] rounded-lg bg-white p-3">
              <h3 className="mt-0">Portfolio Metrics</h3>
              <MetricsBuilder assets={assets} weights={weights} showYield={true} detail />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
