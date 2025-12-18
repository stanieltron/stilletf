"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { fetchAssets } from "../../lib/portfolio";
import PortfolioBuilder from "./MetricsBuilder";
import ChartBuilder from "./ChartBuilder";
import ShareModal from "./ShareModal";
import ShareModalSignedIn from "./ShareModalSignedIn";


/**
 * BuilderSection
 * Takes a single prop: keepAssets (boolean | null).
 * - false: reset local data and start empty.
 * - true: restore from localStorage if available.
 * - null: defer decision (do nothing until resolved).
 */
export default function BuilderSection({ keepAssets = true }) {
  const { data: sessionData } = useSession();
  const isAuthed = !!sessionData?.user;
  const searchParams = useSearchParams();

  /* ===== Assets & weights with persistence ===== */
  const [assetKeys, setAssetKeys] = useState([]);
  const [assetMeta, setAssetMeta] = useState({});
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [errAssets, setErrAssets] = useState("");

  const LS_WEIGHTS = "dw-weights-v1";
  const LS_EVER_COMPLETE = "dw-ever-complete"; // repurposed as "yield ever activated"
  const LS_YIELD_ON = "dw-yield-on";

  // If we shouldn't keep assets (hard reload without auth), clear storage *once* on mount.
  useEffect(() => {
    if (keepAssets === false) {
      try {
        localStorage.removeItem(LS_WEIGHTS);
        localStorage.removeItem(LS_EVER_COMPLETE);
        localStorage.removeItem(LS_YIELD_ON);
      } catch {}
    }
  }, [keepAssets]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingAssets(true);
        setErrAssets("");
        const api = await fetchAssets();
        if (!alive) return;
        const keys = Object.keys(api.assets || {});
        setAssetKeys(keys);
        setAssetMeta(api.assets || {});
      } catch (e) {
        if (!alive) return;
        setErrAssets(e?.message || String(e));
      } finally {
        if (alive) setLoadingAssets(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const [weights, setWeights] = useState([]);


  // initialize weights (empty or from storage) after assets are known
  useEffect(() => {
    if (!assetKeys.length) return;

    // default: first asset has weight 1, others 0
    const defaultOneAsset = assetKeys.map((_, i) => (i === 0 ? 1 : 0));

    // If keepAssets is false, always initialize fresh
    if (!keepAssets) {
      setWeights(defaultOneAsset);
      return;
    }

    // Otherwise try to restore from storage
    try {
      const raw = localStorage.getItem(LS_WEIGHTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.keys) && Array.isArray(parsed?.weights)) {
          const sameOrder =
            parsed.keys.length === assetKeys.length &&
            parsed.keys.every((k, i) => k === assetKeys[i]);
          if (sameOrder) {
            setWeights(parsed.weights.map((n) => (Number.isFinite(n) ? n : 0)));
            return;
          }
        }
      }
    } catch { }

    // fallback: first asset 1, rest 0
    setWeights(defaultOneAsset);
  }, [assetKeys, keepAssets]);


  // persist weights if we are keeping assets
  useEffect(() => {
    if (!assetKeys.length) return;
    if (keepAssets === false) return; // skip only when explicitly resetting
    try {
      localStorage.setItem(
        LS_WEIGHTS,
        JSON.stringify({ keys: assetKeys, weights })
      );
    } catch { }
  }, [assetKeys, weights, keepAssets]);

  const totalPointsUsed = useMemo(
    () => weights.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
    [weights]
  );

  /* ===== ETF completeness ===== */
  const MAX_TOTAL_POINTS = 20;
  const pointsForBar = Math.min(MAX_TOTAL_POINTS, totalPointsUsed);
  const isETFComplete = pointsForBar === MAX_TOTAL_POINTS;
  const pointsRemaining = Math.max(0, MAX_TOTAL_POINTS - pointsForBar);

  /* ===== Share flow (panel with image) ===== */
  const [shareOpen, setShareOpen] = useState(false);
  const user = sessionData?.user || {};
  const userDisplay = user?.nickname || user?.name || user?.email || "User";

  // helper: open Share panel (can be triggered by yield completion or share button)
  const shareTimerRef = useRef(null);
  const openShareWithDelay = () => {
    try {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
      shareTimerRef.current = setTimeout(() => {
        setShareOpen(true);
      }, 0);
    } catch {}
  };

  // clean up timer
  useEffect(() => {
    return () => {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, []);

  // if URL has ?share=1 (e.g. after signing in from share modal), auto-open the share modal
  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get("share") === "1") {
      setShareOpen(true);
    }
  }, [searchParams]);



  /* ===== Yield flow (new spec) ===== */
  const [yieldOn, setYieldOn] = useState(false);
  const [yieldEverActivated, setYieldEverActivated] = useState(false);

  // Close share modal when user logs out to prevent showing signed-in flows
  useEffect(() => {
    if (!isAuthed) {
      setShareOpen(false);
    }
  }, [isAuthed]);

  // restore yield state
  useEffect(() => {
    try {
      const storedOn = localStorage.getItem(LS_YIELD_ON) === "1";
      const storedEver = localStorage.getItem(LS_EVER_COMPLETE) === "1";
      if (storedOn) {
        setYieldOn(true);
        setYieldEverActivated(true);
      } else if (storedEver) {
        // yield was turned on at least once in the past
        setYieldOn(true);
        setYieldEverActivated(true);
      }
    } catch { }
  }, []);

  // persist yieldOn state whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(LS_YIELD_ON, yieldOn ? "1" : "0");
    } catch { }
  }, [yieldOn]);

  // first-time activation from grey/intro button (only when ETF is complete)
  function handleFirstYieldActivate() {
    setYieldOn(true);
    setYieldEverActivated(true);
    try {
      localStorage.setItem(LS_YIELD_ON, "1");
      localStorage.setItem(LS_EVER_COMPLETE, "1");
    } catch { }

    // 1st fill: after user turns yield on, auto-open Share panel with 1s delay,
    // even if not signed in
    if (isETFComplete) {
      openShareWithDelay();
    }
  }


  // clicking "Share portfolio" (appears when ETF full + yield ON)
  function handleCompletePortfolioClick() {
    openShareWithDelay();
  }

  /* ===== Height sync refs (kept for layout) ===== */
  const splitRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  // ===== Scroll hint for asset weights list =====
  const listRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const check = () => {
      const overflow = el.scrollHeight - el.clientHeight > 4;
      const notAtBottom =
        el.scrollTop < el.scrollHeight - el.clientHeight - 2;
      setShowScrollHint(overflow && notAtBottom);
    };

    check(); // initial

    el.addEventListener("scroll", check, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(check)
        : null;
    if (ro) ro.observe(el);

    window.addEventListener("resize", check, { passive: true });

    const id = setTimeout(check, 0); // after layout

    return () => {
      el.removeEventListener("scroll", check);
      ro && ro.disconnect();
      window.removeEventListener("resize", check);
      clearTimeout(id);
    };
  }, [assetKeys.length, JSON.stringify(weights)]);

  const hasPortfolio =
    (typeof totalPointsUsed === "number" && totalPointsUsed > 0) ||
    (Array.isArray(weights) && weights.some((w) => Number(w) > 0));

  // number of assets with non-zero weight
  const numActiveAssets = Array.isArray(weights)
    ? weights.filter((w) => Number(w) > 0).length
    : 0;

  // used only for blinking logic on "+"
  //  - true when we have 0 or 1 active asset
  //  - false when >1 (no blinking)
  const max1asset = numActiveAssets <= 1;

  const showFirstYield = isETFComplete && !yieldEverActivated;
  const showCompleteBtn = isETFComplete && yieldOn;
  const hasSecondaryAction = showFirstYield; // share button relocated
  const shareDisabled = !isETFComplete;

  return (
    <main
      className="container-main w-full flex flex-col overflow-hidden px-2 sm:px-0"
      style={{ fontSize: "120%" }} // keep mobile sizing comfortable
    >
      <div className="w-full flex-1 flex flex-col gap-3 md:gap-5 min-h-0">
        <h2 className="section-hero center font-bold tracking-tight leading-tight [font-size:clamp(1.5rem,2.5vw,2rem)] m-0">
          
        </h2>

        {errAssets && (
          <div className="text-[clamp(.8rem,0.9vw,.9rem)] text-[var(--neg)] mt-2">
            {errAssets}
          </div>
        )}
        {loadingAssets && (
          <div className="text-[clamp(.8rem,0.9vw,.9rem)] text-[var(--muted)] mt-2">
            Loading assets...
          </div>
        )}

        {!loadingAssets && (
          <>
          <div className="sona-card border border-[rgba(17,19,24,0.08)] shadow-[0_14px_40px_rgba(17,19,24,0.12)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 w-full">
            <div className="flex flex-col gap-2 w-full">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Hands-on</span>
              <div className="text-[clamp(1rem,2vw,1.35rem)] font-semibold tracking-tight leading-snug break-words w-full">
                Choose the assets you believe in. Share your portfolio. Get rewarded for it.
              </div>
            </div>
          </div>
          <div
            ref={splitRef}
            className={[
              "split",
              hasPortfolio ? "has-portfolio" : "no-portfolio",
              "relative",
              "grid items-stretch content-stretch gap-4 md:gap-6 min-h-0 w-full max-w-full box-border overflow-visible",
              "grid-cols-1",
              "md:h-[560px]",
              "md:[grid-template-columns:var(--left-w)_minmax(0,1fr)]",
            ].join(" ")}
            style={{
              ["--left-w"]: hasPortfolio ? "30%" : "40%",
            }}
          >
            {/* BLUE DIVIDER BETWEEN LEFT & RIGHT PANE, ANCHORED TO --left-w */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 hidden md:block"
              style={{
                left: "calc(var(--left-w) + 0.75rem)", // centered in 1.5rem gap
                width: "8px",
                transform: "translateX(-50%)",
                background: "var(--accent)",
                borderRadius: "999px",
                zIndex: 10,
              }}
            />

            {/* LEFT PANE */}
            <aside
              ref={leftRef}
              className={[
                "bg-white rounded-[var(--radius-md)] shadow-[0_12px_32px_rgba(17,19,24,0.12)]",
                "overflow-hidden min-h-0 w-full flex flex-col",
                "self-stretch h-full",
                "min-h-[320px]",
              ].join(" ")}
              style={{ contain: "content" }}
            >
              <div className="flex-none px-3 pt-3 pb-2 border-b border-[var(--border)]">
                <h2 className="m-0 font-semibold tracking-[.2px] [font-size:clamp(.9rem,1.1vw,1rem)]">
                  Assets selection
                </h2>
              </div>

              <div className="relative flex-1 min-h-0">
                <div
                  ref={listRef}
                  className="grid grid-cols-1 gap-0 px-3 py-2 min-h-0 h-full overflow-y-auto no-scrollbar pb-10 local-scroll-container"
                >
                  {assetKeys.map((key, idx) => {
                    const current = weights[idx] ?? 0;
                    const sumOthers = totalPointsUsed - current;
                    const maxForThis = Math.max(
                      current,
                      Math.min(10, MAX_TOTAL_POINTS - sumOthers)
                    );
                    return (


<WeightInput
  key={`w-${key}`}
  label={`${assetMeta[key]?.name ?? key} weight`}
  nameOnly={assetMeta[key]?.name ?? key}
  accentColor={assetMeta[key]?.color || undefined}
  value={current}
  maxForThis={maxForThis}
  pointsRemaining={pointsRemaining}   // <- NEW
  onChange={(desiredVal) =>
    setWeights((w) => {
      const copy = [...w];
      const others = copy.reduce(
        (a, b, j) =>
          j === idx
            ? a
            : a + (Number.isFinite(b) ? b : 0),
        0
      );
       const allowed = Math.max(
         copy[idx] ?? 0,
         Math.min(10, MAX_TOTAL_POINTS - others)
       );
      const next = Math.max(
        0,
        Math.min(
          allowed,
          Number.isFinite(desiredVal) ? desiredVal : 0
        )
      );
      copy[idx] = next;
      return copy;
    })
  }
  /* pulse + when no asset is added at all */
  highlightPlus={max1asset}
  highlightMinus={
    numActiveAssets === 1 &&
    idx === 0 &&
    Number(current) > 0
  }
/>


                    );
                  })}
                </div>

                {showScrollHint && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 z-10 flex items-end justify-center bg-gradient-to-t from-white via-white/85 to-transparent">
                    <div className="mb-2 flex flex-col items-center gap-2 text-blue-600">
                      <span className="[font-size:clamp(.72rem,.9vw,.75rem)] font-bold tracking-wide uppercase">
                        Scroll for more
                      </span>
                      <div className="w-8 h-8 flex items-center justify-center animate-bounce">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-6 h-6"
                          aria-hidden="true"
                        >
                          <path d="M12 16.5a1 1 0 0 1-.7-.3l-6-6a1 1 0 1 1 1.4-1.4l5.3 5.3 5.3-5.3a1 1 0 0 1 1.4 1.4l-6 6a1 1 0 0 1-.7.3Z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </aside>

            {/* RIGHT PANE */}
            <section
              ref={rightRef}
              className={[
                "right-pane shadow-[0_12px_32px_rgba(17,19,24,0.12)]",
                hasPortfolio ? "" : "is-empty",
                "min-h-0 self-stretch h-full",
                hasPortfolio
                  ? "flex flex-col gap-4 h-auto"
                  : "md:grid gap-3 [grid-template-rows:500px]",
              ].join(" ")}
            >
              {hasPortfolio ? (
                <>
                  {/* Status + actions + progress (rounded group) */}
                  <div className="bg-white rounded-[var(--radius-md)] overflow-hidden flex flex-col p-3 gap-3 w-full">
                    <div
                      className={[
                        // Allow content to grow vertically on mobile so the progress bar doesn't overlap buttons.
                        "w-full h-auto sm:h-10 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2",
                        "[font-size:clamp(.8rem,1vw,.9rem)] leading-[1.2]",
                      ].join(" ")}
                    >
                      <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-3 w-full">
                        {/* LEFT: ETF STATUS / FILL CTA */}
                        <div className="min-w-0 flex-1 w-full flex">
                          {!isETFComplete ? (
                            <div className="h-[30px] md:h-[40px] px-3 flex items-center justify-center flex-1 w-full text-[var(--text)] cursor-default select-none">
                              <span className="whitespace-nowrap text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.08em]">
                                Fill ETF with {pointsRemaining} more point{pointsRemaining === 1 ? "" : "s"} to complete
                              </span>
                            </div>
                          ) : (
                            <div className="h-[30px] md:h-[40px] px-3 flex items-center justify-center flex-1 w-full text-[var(--text)] cursor-default select-none">
                              <span className="whitespace-nowrap text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.08em]">
                                ETF complete
                              </span>
                            </div>
                          )}
                        </div>

                        {/* RIGHT: YIELD INFO / BUTTONS (render only when needed) */}
                        {hasSecondaryAction && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                            {/* FIRST-TIME YIELD INTRO (only once, when ETF just complete and yield not yet activated) */}
                            {showFirstYield ? (
                              <div className="flex items-center gap-2 text-right">
                                <button
                                  type="button"
                                  onClick={handleFirstYieldActivate}
                                  className="relative cta-btn cta-btn-sm cta-blue text-[10px] sm:text-xs shadow-[0_0_18px_rgba(37,99,235,0.9)]"
                                >
                                  {/* Pulsating blue aura around the button */}
                                  <span
                                    className="pointer-events-none absolute inset-[-4px] rounded-none border border-blue-400/70 animate-ping"
                                    aria-hidden="true"
                                  />
                                  <span className="relative flex items-center gap-1">
                                    <span className="text-[14px] leading-none">[+]</span>
                                    <span>Add STILL yield</span>
                                  </span>
                                </button>
                              </div>
                            ) : null}

                          </div>
                        )}


                      </div>
                    </div>

                    {/* Progress (12px total height) */}
                    <div
                      className="flex items-center h-3"
                      aria-label={`ETF completeness ${pointsForBar} of ${MAX_TOTAL_POINTS}`}
                    >
                      <div className="relative h-[8px] w-full bg-gray-300 overflow-hidden rounded-[var(--radius-sm)]">
                        <div
                          className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-[width] rounded-[var(--radius-sm)]"
                          style={{ width: `${(pointsForBar / MAX_TOTAL_POINTS) * 100}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Chart + text + metrics grouped */}
                  <div className="bg-white rounded-[var(--radius-md)] overflow-hidden flex flex-col">
                    <div className="px-3 py-2 flex h-[180px] md:h-[260px]">
                      <div className="w-full h-full overflow-hidden flex-1 min-h-0 min-w-0 max-w-full">
                        <ChartBuilder
                          assets={assetKeys}
                          weights={weights}
                          showYield={yieldOn}
                          size="l"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-3 h-[180px] md:h-[260px] overflow-auto flex flex-col">
                      <PortfolioBuilder
                        assets={assetKeys}
                        weights={weights}
                        showYield={yieldOn}
                        detail
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div
                  className="row-[1] h-full flex items-center justify-center text-center min-h-0 bg-white "
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex flex-col gap-2 items-center justify-center">
                        <div className="font-extrabold [font-size:clamp(1.125rem,2.4vw,1.5rem)] tracking-[.2px] text-[var(--muted)] opacity-90 lowercase">
                      <div className="flex flex-col items-center justify-center gap-1 text-center">
                        <div className="[font-size:clamp(.8rem,.9vw,.85rem)] text-[var(--muted)] opacity-90">
                          {"<- start building with adding assets"}
                        </div>
                        <div className="font-extrabold [font-size:clamp(1.25rem,2.8vw,1.75rem)] tracking-[.2px]">
                          build your ETF for future rewards
                        </div>
                        <div className="[font-size:clamp(.8rem,.9vw,.85rem)] text-[var(--muted)] opacity-90">
                          great ETF balances growth, stability and resilience
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Global actions below builder */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-7">
            <button
              type="button"
              onClick={handleCompletePortfolioClick}
              disabled={shareDisabled}
              className={`cta-btn cta-orange no-underline text-[20px] font-semibold tracking-[0.22em] shadow-[0_10px_26px_rgba(17,19,24,0.12)] ${shareDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              style={{ minHeight: "4rem", paddingLeft: "2.125rem", paddingRight: "2.125rem" }}
              aria-disabled={shareDisabled}
              title={shareDisabled ? "Complete your ETF and enable yield to share" : "Share portfolio"}
            >
              Share portfolio
            </button>
            <Link
              href="/?auth=1"
              className="cta-btn cta-black no-underline text-[20px] font-semibold tracking-[0.22em] shadow-[0_10px_26px_rgba(17,19,24,0.12)]"
              style={{ minHeight: "4rem", paddingLeft: "2.125rem", paddingRight: "2.125rem" }}
            >
              Want more?
            </Link>
          </div>
          </>
        )}
      </div>

        {(() => {
        const ActiveShareModal = isAuthed ? ShareModalSignedIn : ShareModal;
        return (
          <ActiveShareModal
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            assets={assetKeys}
            weights={weights}
            showYield={yieldOn}
            userDisplay={userDisplay}
            assetMeta={assetMeta}
          />
        );
      })()}

    </main>
  );
}

function WeightInput({
  label,
  value,
  onChange,
  accentColor,
  nameOnly = "",
  maxForThis = 10,
  pointsRemaining = 0,          // <- NEW
  highlightPlus = false,        // pulsing +
  highlightMinus = false,       // pulsing - (for "1 default asset" state)
}) {
  const v0 = Number.isFinite(value) ? value : 0;
  const v = Math.max(0, Math.min(10, Math.round(v0)));

  const dec = () => onChange(Math.max(0, v - 1));
  const inc = () => onChange(Math.min(maxForThis, v + 1));
  const setTo = (n) =>
    onChange(Math.max(0, Math.min(maxForThis, Math.round(n === v ? 0 : n))));

  const incDisabled = v >= maxForThis;
  const decDisabled = v <= 0;

  // --- progress bar math (10 units per asset) ---
  const maxUnits = 10;
  const coloredPct = (v / maxUnits) * 100;

  // how many more points we can still put into THIS asset
  // (limited by both global remaining points and per-asset cap)
  const freeHere = Math.max(0, Math.min(pointsRemaining, maxForThis - v));
  const freePct = (freeHere / maxUnits) * 100;

  const handleBarClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const desired = Math.round(ratio * maxUnits);
    setTo(desired);
  };

  return (
    <div
      style={accentColor ? { "--accent": accentColor } : undefined}
      className="select-none"
    >
      <div className="mb-0.5 md:mb-1 leading-tight h-[30px] md:h-[35px] flex items-center">
        <span
          className="font-semibold [font-size:55%] md:[font-size:65%]"
          style={{ color: "var(--accent, var(--text))" }}
        >
          {nameOnly || label}
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1.5 md:gap-2 h-[36px] md:h-[40px]">
        {/* - button */}
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 w-9 md:h-10 md:w-10 text-[26px] md:text-[32px] leading-none font-extrabold cursor-pointer bg-white text-[var(--brand)] hover:bg-[var(--bg-alt)] active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed rounded-[var(--radius-sm)]"
          onClick={dec}
          disabled={decDisabled}
          aria-label={`Decrease ${label}`}
          title="Decrease"
        >
          <span
            className={[
              "relative -translate-y-[1px] transition-[text-shadow,transform]",
              highlightMinus
                ? "[text-shadow:0_0_14px_rgba(202,163,74,0.9)] animate-pulse"
                : "",
            ].join(" ")}
          >
            -
          </span>
        </button>

        {/* middle: progress bar instead of 10 steps */}
        <button
          type="button"
          onClick={handleBarClick}
          className="relative h-[8px] md:h-[10px] w-full rounded-[var(--radius-sm)] bg-[var(--bg)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--border)]"
          aria-label={`${label}: current ${v} of 10`}
          title={`${v} / 10`}
        >
          {/* filled value */}
          <span
            className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-[width] rounded-[var(--radius-sm)]"
            style={{ width: `${coloredPct}%` }}
            aria-hidden="true"
          />

          {/* free grey part (from remaining global points) */}
          {freeHere > 0 && (
            <span
              className="absolute inset-y-0 bg-gray-300 rounded-[var(--radius-sm)]"
              style={{
                left: `${coloredPct}%`,
                width: `${freePct}%`,
              }}
              aria-hidden="true"
            />
          )}
        </button>

        {/* + button */}
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 w-9 md:h-10 md:w-10 text-[26px] md:text-[32px] leading-none font-extrabold cursor-pointer bg-white text-[var(--brand)] hover:bg-[var(--bg-alt)] active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed rounded-[var(--radius-sm)]"
          onClick={inc}
          disabled={incDisabled}
          aria-label={`Increase ${label}`}
          title="Increase"
        >
          <span
            className={[
              "relative -translate-y-[1px] transition-[text-shadow,transform]",
              highlightPlus
                ? "[text-shadow:0_0_14px_rgba(202,163,74,0.9)] animate-pulse"
                : "",
            ].join(" ")}
          >
            +
          </span>
        </button>
      </div>
    </div>
  );
}
