"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { portfolioCalculator, fetchAssets } from "../../lib/portfolio";
import ChartBuilder from "../components/ChartBuilder";
import MetricsBuilder from "../components/MetricsBuilder";

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
      <span
        key={key}
        style={{ color }}
        className="px-2 py-1 bg-[var(--bg-soft,#f4f4f4)] text-sm sm:text-base md:text-xl font-semibold"
      >
        {label}: {w}
      </span>
    );
  }

  if (!parts.length) {
    return (
      <span className="text-base sm:text-xl md:text-2xl text-[var(--muted)] font-semibold">
        No positions
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 max-w-full">
      {parts}
    </div>
  );
}

/* --- simple metrics for REST cards (end value + total return with yield) --- */
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
        const s = res?.seriesWithYield?.length
          ? res.seriesWithYield
          : res?.series || [];
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
    <div className="grid grid-cols-1 gap-1.5 text-right text-sm sm:text-base md:text-xl">
      <div>
        <div className="text-xs sm:text-sm md:text-base text-[var(--muted)]">
          End value ($, with yield)
        </div>
        <div className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-[0.2px]">
          {endVal.toFixed(2)}
        </div>
      </div>
      <div>
        <div className="text-xs sm:text-sm md:text-base text-[var(--muted)]">
          Total return % (with yield)
        </div>
        <div className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-[0.2px]">
          {retPct.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

/* --- TOP 3 CARD (for ALL tab only) --- */
function PortfolioCard({ p, meta, rank, onVote }) {
  const router = useRouter();
  const comp = useMemo(
    () => compositionSpans(p.assets, p.weights, meta),
    [p.assets, p.weights, meta]
  );

  function openDetails() {
    router.push(`/useretfs/${p.id}`);
  }

  function handleVoteClick(e) {
    e.stopPropagation();
    onVote();
  }

  return (
    <div
      onClick={openDetails}
      className="border border-[var(--border)] bg-white p-3 sm:p-5 md:p-6 flex flex-col h-full shadow-md cursor-pointer transition-transform duration-150 hover:-translate-y-1 hover:shadow-xl hover:bg-[var(--bg-soft,#fafafa)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 flex items-center justify-center text-xl sm:text-2xl md:text-4xl font-extrabold text-black">
            #{rank}
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <div className="font-extrabold truncate text-base sm:text-xl md:text-3xl">
              {p.nickname || "Untitled portfolio"}
            </div>
            <div className="text-[var(--muted)] text-[11px] sm:text-sm md:text-xl font-semibold">
              {p._count?.votes ?? 0} votes
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleVoteClick}
          className="shrink-0 border border-[var(--border)] bg-black text-white px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-lg md:text-xl font-bold leading-none hover:bg-[#111]"
        >
          Vote
        </button>
      </div>

      {/* Chart from ChartBuilder */}
      <div className="mt-4 h-[110px] sm:h-[180px]">
        {sumPoints(p.weights) > 0 ? (
          <ChartBuilder
            assets={p.assets}
            weights={p.weights}
            showYield={true}
            animated={true}
            yieldOnly={false}
            legendOff={false}
          />
        ) : (
          <div className="text-xl md:text-2xl text-[var(--muted)]">
            No data
          </div>
        )}
      </div>

      {/* Metrics from MetricsBuilder */}
      <div className="mt-4 h-[140px] sm:h-[200px]">
        <MetricsBuilder assets={p.assets} weights={p.weights} showYield={true} />
      </div>

      {/* composition big & pronounced, lots of space */}
      <div className="mt-6">
        <div className="text-sm md:text-base uppercase tracking-wide text-[var(--muted)] mb-3 font-semibold">
          Composition
        </div>
        <div className="text-lg sm:text-xl md:text-2xl leading-snug max-w-full">
          {comp}
        </div>
      </div>
    </div>
  );
}

/* --- ROW CARD FOR THE REST (used in ALL + MINE) --- */
function PortfolioRowCard({ p, meta, rank, onVote }) {
  const router = useRouter();
  const comp = useMemo(
    () => compositionSpans(p.assets, p.weights, meta),
    [p.assets, p.weights, meta]
  );

  function openDetails() {
    router.push(`/useretfs/${p.id}`);
  }

  function handleVoteClick(e) {
    e.stopPropagation();
    onVote();
  }

  return (
    <div
      onClick={openDetails}
      className="border border-[var(--border)] px-3 py-3 sm:px-4 sm:py-4 bg-white flex flex-col lg:flex-row items-stretch gap-3 sm:gap-4 w-full shadow-sm cursor-pointer transition-transform duration-150 hover:-translate-y-1 hover:shadow-md hover:bg-[var(--bg-soft,#fafafa)]"
    >
      {/* Rank bubble uses GLOBAL rank */}
      {typeof rank === "number" && (
        <div className="flex items-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--muted)]">
            #{rank}
          </div>
        </div>
      )}

      {/* Left: name + meta + composition */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-3">
          <div className="font-bold truncate text-lg sm:text-xl md:text-2xl">
            {p.nickname || "Untitled portfolio"}
          </div>
          <span className="text-sm sm:text-base md:text-lg text-[var(--muted)] font-semibold">
            {p._count?.votes ?? 0} votes
          </span>
        </div>

        {/* fixed-height comment so rows align */}
        <div className="mt-2 min-h-[56px]">
          {p.comment && (
            <div className="text-base sm:text-lg md:text-xl text-[var(--muted)] line-clamp-2">
              {p.comment}
            </div>
          )}
        </div>

        <div className="mt-3">
          <span className="text-xs sm:text-sm uppercase tracking-wide text-[var(--muted)] font-semibold block mb-2">
            Composition
          </span>
          <div className="text-lg sm:text-xl md:text-2xl text-[var(--fg)] max-w-full">
            {comp}
          </div>
        </div>
      </div>

      {/* Middle: slim chart using ChartBuilder (yield-only to keep slim) */}
      <div className="hidden lg:flex flex-[1.2] items-center">
        <div className="w-full h-[120px]">
          {sumPoints(p.weights) > 0 ? (
            <ChartBuilder
              assets={p.assets}
              weights={p.weights}
              showYield={true}
              animated={false}
              yieldOnly={true}
              legendOff={true}
            />
          ) : (
            <div className="text-lg md:text-xl text-[var(--muted)]">
              No data
            </div>
          )}
        </div>
      </div>

      {/* Right: tiny metrics + vote button */}
      <div className="flex flex-col items-end justify-between w-full lg:w-auto gap-4">
        <div className="w-full">
          <MiniMetrics assets={p.assets} weights={p.weights} />
        </div>
        <button
          type="button"
          onClick={handleVoteClick}
          className="border border-[var(--border)] bg-black text-white px-3 py-2 text-base sm:text-lg md:text-xl font-bold leading-none hover:bg-[#111]"
        >
          Vote
        </button>
      </div>
    </div>
  );
}

export default function UserETFsPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id || null;
  const userEmail = session?.user?.email || null;
  const router = useRouter();

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

  // GLOBAL ranking based on ALL portfolios
  const sortedAll = [...all].sort(
    (a, b) => (b?._count?.votes || 0) - (a?._count?.votes || 0)
  );
  const globalRankById = new Map(
    sortedAll.map((p, idx) => [p.id, idx + 1]) // 1-based global rank
  );
  const top3All = sortedAll.slice(0, 3);
  const othersAll = sortedAll.slice(3);

  // MINE tab: keep global ranking, just filter to my portfolios
  const sortedMineByGlobal = [...mine].sort((a, b) => {
    const ra = globalRankById.get(a.id) || Infinity;
    const rb = globalRankById.get(b.id) || Infinity;
    return ra - rb;
  });

  async function handleVote(portfolioId) {
    if (!userId && !userEmail) {
      router.push("?auth=1", { scroll: false });
      return;
    }

    try {
      const r = await fetch(`/api/portfolios/${portfolioId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || null,
          userEmail: userEmail || null,
        }),
      });

      const j = await r.json().catch(() => ({}));

      if (r.ok && j?.portfolio) {
        const updated = j.portfolio;
        setAll((prev) =>
          Array.isArray(prev)
            ? prev.map((p) => (p.id === portfolioId ? updated : p))
            : prev
        );
        setMine((prev) =>
          Array.isArray(prev)
            ? prev.map((p) => (p.id === portfolioId ? updated : p))
            : prev
        );
      } else {
        alert(
          j?.error === "already_voted"
            ? "You have already voted for this portfolio."
            : "Could not vote."
        );
      }
    } catch {
      alert("Could not vote.");
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <Header />

      <main className="flex flex-col">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-5 md:px-8 flex flex-col pb-10 text-sm sm:text-lg md:text-2xl">
          <h2 className="mt-6 sm:mt-8 text-3xl sm:text-4xl md:text-5xl font-extrabold">
            Leaderboard
          </h2>
          <p className="mt-2 text-sm sm:text-lg md:text-2xl text-[var(--muted)]">
            Collect votes for future rewards.
          </p>

          {/* Tabs */}
          <div className="flex gap-3 flex-wrap mt-6">
            <button
              className={[
                "border border-[var(--border)] bg-white px-4 sm:px-5 py-2.5 sm:py-3 font-bold leading-none text-lg sm:text-xl md:text-2xl",
                tab === "all" ? "opacity-100" : "opacity-60",
              ].join(" ")}
              onClick={() => setTab("all")}
            >
              All
            </button>
            <button
              className={[
                "border border-[var(--border)] bg-white px-4 sm:px-5 py-2.5 sm:py-3 font-bold leading-none text-lg sm:text-xl md:text-2xl",
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

          {err && (
            <div className="text-xl md:text-2xl text-[var(--neg)] mt-10">
              {err}
            </div>
          )}
          {loading && (
            <div className="text-xl md:text-2xl text-[var(--muted)] mt-10">
              Loading…
            </div>
          )}

          {!loading && !err && (
            <>
              {/* MINE: empty state */}
              {tab === "mine" && userId && mine.length === 0 && (
                <div className="text-xl md:text-2xl text-[var(--muted)] mt-10">
                  You haven’t saved any portfolios yet.
                </div>
              )}

              {/* ALL: empty state */}
              {tab === "all" && sortedAll.length === 0 && (
                <div className="text-xl md:text-2xl text-[var(--muted)] mt-10">
                  No user portfolios yet.
                </div>
              )}

              {/* ALL TAB CONTENT */}
              {tab === "all" && sortedAll.length > 0 && (
                <>
                  {/* TOP 3 BIG CARDS (use global ranks) */}
                  <section className="mt-10">
                    <div className="mt-5 grid gap-6 md:grid-cols-3">
                      {top3All.map((p) => (
                        <PortfolioCard
                          key={p.id}
                          p={p}
                          meta={meta}
                          rank={globalRankById.get(p.id)}
                          onVote={() => handleVote(p.id)}
                        />
                      ))}
                    </div>
                  </section>

                  {/* blue separator */}
                  {othersAll.length > 0 && (
                    <div className="mt-10 mb-6 h-2 w-full bg-blue-600" />
                  )}

                  {/* full-width black discover button BELOW separator */}
                  {othersAll.length > 0 && (
                    <div className="mb-8">
                      <Link
                        href="/ETFs"
                        className="w-full inline-flex items-center justify-center px-6 py-3 border border-black bg-black text-white text-lg md:text-2xl font-semibold transition-transform duration-150 hover:-translate-y-1 hover:bg-white hover:text-black hover:shadow-md"
                      >
                        discover STILLETFs and interact on testnet for additional rewards
                      </Link>
                    </div>
                  )}

                  {/* REST AS WIDE SLIM ROWS (still global ranks) */}
                  {othersAll.length > 0 && (
                    <section>
                      <div className="flex flex-col gap-5 w-full">
                        {othersAll.map((p) => (
                          <PortfolioRowCard
                            key={p.id}
                            p={p}
                            meta={meta}
                            rank={globalRankById.get(p.id)}
                            onVote={() => handleVote(p.id)}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* MINE TAB CONTENT – no top 3, just rows with GLOBAL ranks */}
              {tab === "mine" && mine.length > 0 && (
                <section className="mt-10">
                  <div className="flex flex-col gap-5 w-full">
                    {sortedMineByGlobal.map((p) => (
                      <PortfolioRowCard
                        key={p.id}
                        p={p}
                        meta={meta}
                        rank={globalRankById.get(p.id)}
                        onVote={() => handleVote(p.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}



