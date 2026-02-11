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
          className="px-2 py-0.5 rounded-md border border-[#f2ebde] bg-[#f7f3eb] text-[11px] sm:text-xs md:text-sm font-semibold"
        >
        {label}: {w}
      </span>
    );
  }

  if (!parts.length) {
    return (
      <span className="text-base sm:text-xl md:text-2xl text-[#756c57] font-semibold">
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
        <div className="text-xs sm:text-sm md:text-base text-[#756c57]">
          End value ($, with yield)
        </div>
        <div className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-[0.2px] text-[#201909]">
          {endVal.toFixed(2)}
        </div>
      </div>
      <div>
        <div className="text-xs sm:text-sm md:text-base text-[#756c57]">
          Total return % (with yield)
        </div>
        <div className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-[0.2px] text-[#201909]">
          {retPct.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

/* --- TOP 3 CARD (for ALL tab only) --- */
function PortfolioCard({ p, meta, rank, onVote, canVote, onRequireAuth }) {
  const router = useRouter();
  const comp = useMemo(
    () => compositionSpans(p.assets, p.weights, meta),
    [p.assets, p.weights, meta]
  );

  function openDetails() {
    router.push(`/leaderboard/${p.id}`);
  }

  function handleVoteClick(e) {
    e.stopPropagation();
    if (!canVote) {
      onRequireAuth?.();
      return;
    }
    onVote();
  }

  return (
    <div
      onClick={openDetails}
      className="border border-[#f2ebde] bg-[#fdfbf9] rounded-[16px] p-3 sm:p-5 md:p-6 flex flex-col h-full shadow-[0_12px_32px_rgba(32,25,9,0.08)] cursor-pointer transition-transform duration-150 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(32,25,9,0.12)] hover:bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 flex items-center justify-center text-xl sm:text-2xl md:text-4xl font-extrabold text-[#201909]">
            #{rank}
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <div className="font-extrabold truncate text-base sm:text-xl md:text-3xl">
              {p.nickname || "Untitled entry"}
            </div>
            <div className="text-[#756c57] text-[11px] sm:text-sm md:text-xl font-semibold">
              {p._count?.votes ?? 0} votes
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleVoteClick}
          className={[
            "shrink-0 border px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-lg md:text-xl font-bold leading-none rounded-[10px] transition-colors",
            canVote
              ? "bg-[#201909] border-[#201909] text-white hover:opacity-90"
              : "bg-[#f7f3eb] border-[#e8decc] text-[#9a8f78] opacity-70 cursor-not-allowed",
          ].join(" ")}
          aria-disabled={!canVote}
          title={canVote ? "Vote" : "Sign in to vote"}
        >
          Vote
        </button>
      </div>

      {/* Chart from ChartBuilder */}
      <div className="mt-4 h-[150px] sm:h-[200px]">
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
          <div className="text-xl md:text-2xl text-[#756c57]">
            No data
          </div>
        )}
      </div>

      {/* Metrics from MetricsBuilder */}
      <div className="mt-3 h-[130px] sm:h-[190px]">
        <MetricsBuilder assets={p.assets} weights={p.weights} showYield={true} />
      </div>

      {/* composition */}
      <div className="mt-4">
        <div className="text-xs sm:text-sm md:text-base uppercase tracking-wide text-[#756c57] mb-2 font-semibold">
          Composition
        </div>
        <div className="text-base sm:text-lg md:text-2xl leading-snug max-w-full">
          {comp}
        </div>
      </div>
    </div>
  );
}

/* --- ROW CARD FOR THE REST (used in ALL + MINE) --- */
function PortfolioRowCard({ p, meta, rank, onVote, canVote, onRequireAuth }) {
  const router = useRouter();
  const comp = useMemo(
    () => compositionSpans(p.assets, p.weights, meta),
    [p.assets, p.weights, meta]
  );

  function openDetails() {
    router.push(`/leaderboard/${p.id}`);
  }

  function handleVoteClick(e) {
    e.stopPropagation();
    if (!canVote) {
      onRequireAuth?.();
      return;
    }
    onVote();
  }

  return (
    <div
      onClick={openDetails}
      className="border border-[#f2ebde] rounded-[14px] px-3 py-3 sm:px-4 sm:py-4 bg-[#fdfbf9] flex flex-col gap-3 sm:gap-4 w-full shadow-[0_8px_24px_rgba(32,25,9,0.07)] cursor-pointer transition-transform duration-150 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(32,25,9,0.1)] hover:bg-white"
    >
      {/* Rank bubble uses GLOBAL rank */}
      {typeof rank === "number" && (
        <div className="flex items-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#756c57]">
            #{rank}
          </div>
        </div>
      )}

      {/* Content: name + compact chart/metrics */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold truncate text-base sm:text-xl md:text-2xl">
            {p.nickname || "Untitled entry"}
          </div>
          <span className="text-xs sm:text-base md:text-lg text-[#756c57] font-semibold">
            {p._count?.votes ?? 0} votes
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-[55%] min-w-[150px]">
            <div className="w-full h-[90px] sm:h-[120px]">
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
                <div className="text-sm sm:text-base text-[#756c57]">
                  No data
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-[120px] flex justify-end">
            <div className="w-full sm:w-auto scale-[0.75] sm:scale-90 origin-top-right">
              <MiniMetrics assets={p.assets} weights={p.weights} />
            </div>
          </div>
        </div>

        <div className="mt-1">
          <span className="text-xs sm:text-sm uppercase tracking-wide text-[#756c57] font-semibold block mb-1">
            Composition
          </span>
          <div className="text-[10px] sm:text-xs md:text-xl text-[#201909] max-w-full">
            {comp}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end w-full lg:w-auto">
        <button
          type="button"
          onClick={handleVoteClick}
          className={[
            "border px-2.5 py-1.5 text-sm sm:text-lg md:text-xl font-bold leading-none w-full lg:w-auto rounded-[10px] transition-colors",
            canVote
              ? "bg-[#201909] border-[#201909] text-white hover:opacity-90"
              : "bg-[#f7f3eb] border-[#e8decc] text-[#9a8f78] opacity-70 cursor-not-allowed",
          ].join(" ")}
          aria-disabled={!canVote}
          title={canVote ? "Vote" : "Sign in to vote"}
        >
          Vote
        </button>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id || null;
  const router = useRouter();
  const canVote = !!userId;

  function openVoteSignIn() {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("auth", "1");
    url.searchParams.set("voteAuth", "1");
    router.push(url.pathname + (url.search ? url.search : "") + url.hash, {
      scroll: false,
    });
  }

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
    if (!canVote) {
      openVoteSignIn();
      return;
    }

    try {
      const r = await fetch(`/api/portfolios/${portfolioId}/vote`, {
        method: "POST",
      });

      const j = await r.json().catch(() => ({}));

      if (r.status === 401) {
        openVoteSignIn();
        return;
      }

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
            ? "You have already voted for this entry."
            : "Could not vote."
        );
      }
    } catch {
      alert("Could not vote.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f3eb] text-[#201909]">
      <Header />

      <main className="flex-1 flex flex-col">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 pb-16 flex flex-col">
          <div className="rounded-[20px] border border-[#f2ebde] bg-[#fdfbf9] px-5 sm:px-7 py-6 sm:py-7 shadow-[0_12px_30px_rgba(32,25,9,0.06)]">
            <h2 className="m-0 text-[32px] sm:text-[42px] font-semibold tracking-[-0.04em] text-[#201909]">
              Leaderboard
            </h2>
            <p className="mt-2 text-[15px] sm:text-[18px] leading-[1.45] text-[#645c4a]">
              Collect votes for future rewards.
            </p>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap mt-5 rounded-[12px] bg-[#f7f3eb] border border-[#f2ebde] p-1.5 w-fit">
              <button
                className={[
                  "h-10 px-5 rounded-[9px] text-[14px] sm:text-[15px] font-semibold transition-all",
                  tab === "all"
                    ? "bg-[#201909] text-white shadow-sm"
                    : "text-[#756c57] hover:text-[#201909]",
                ].join(" ")}
                onClick={() => setTab("all")}
              >
                All
              </button>
              <button
                className={[
                  "h-10 px-5 rounded-[9px] text-[14px] sm:text-[15px] font-semibold transition-all",
                  tab === "mine"
                    ? "bg-[#201909] text-white shadow-sm"
                    : "text-[#756c57] hover:text-[#201909]",
                  !userId ? "cursor-not-allowed opacity-50" : "",
                ].join(" ")}
                onClick={() => setTab("mine")}
                disabled={!userId}
                title={userId ? "Show my entries" : "Login to see yours"}
              >
                Mine
              </button>
            </div>
          </div>

          {err && (
            <div className="text-base sm:text-lg text-rose-700 mt-8">
              {err}
            </div>
          )}
          {loading && (
            <div className="text-base sm:text-lg text-[#756c57] mt-8">
              Loading...
            </div>
          )}

          {!loading && !err && (
            <>
              {/* MINE: empty state */}
              {tab === "mine" && userId && mine.length === 0 && (
                <div className="text-base sm:text-lg text-[#756c57] mt-8">
                  You haven't submitted any entries yet.
                </div>
              )}

              {/* ALL: empty state */}
              {tab === "all" && sortedAll.length === 0 && (
                <div className="text-base sm:text-lg text-[#756c57] mt-8">
                  No leaderboard entries yet.
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
                          canVote={canVote}
                          onRequireAuth={openVoteSignIn}
                        />
                      ))}
                    </div>
                  </section>

                  {/* separator */}
                  {othersAll.length > 0 && <div className="mt-10 mb-6 h-px w-full bg-[#e8decc]" />}

                  {/* full-width black discover button BELOW separator */}
                  {othersAll.length > 0 && (
                    <div className="mb-8">
                      <Link
                        href="/etfs"
                        className="w-full inline-flex items-center justify-center px-6 py-3 rounded-[12px] border border-[#201909] bg-[#201909] text-white text-base sm:text-lg font-semibold transition-transform duration-150 hover:-translate-y-1 hover:opacity-95 hover:shadow-md"
                      >
                        discover Sona ETFs and interact on testnet for additional rewards
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
                            canVote={canVote}
                            onRequireAuth={openVoteSignIn}
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
                        canVote={canVote}
                        onRequireAuth={openVoteSignIn}
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
