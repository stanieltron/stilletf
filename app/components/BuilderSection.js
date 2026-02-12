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
 * Props:
 * - keepAssets (boolean | null)
 * - embedded (boolean): when true, hides the top "Builder" heading + intro banner (for Figma embed)
 */
export default function BuilderSection({ keepAssets = true, embedded = false }) {
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

  useEffect(() => {
    if (!assetKeys.length) return;

    const defaultOneAsset = assetKeys.map((_, i) => (i === 0 ? 1 : 0));

    if (!keepAssets) {
      setWeights(defaultOneAsset);
      return;
    }

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
    } catch {}

    setWeights(defaultOneAsset);
  }, [assetKeys, keepAssets]);

  useEffect(() => {
    if (!assetKeys.length) return;
    if (keepAssets === false) return;
    try {
      localStorage.setItem(LS_WEIGHTS, JSON.stringify({ keys: assetKeys, weights }));
    } catch {}
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

  /* ===== Share flow ===== */
  const [shareOpen, setShareOpen] = useState(false);
  const user = sessionData?.user || {};
  const userDisplay = user?.nickname || user?.name || user?.email || "User";

  const shareTimerRef = useRef(null);
  const openShareWithDelay = () => {
    try {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
      shareTimerRef.current = setTimeout(() => {
        setShareOpen(true);
      }, 0);
    } catch {}
  };

  useEffect(() => {
    return () => {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get("share") === "1") {
      setShareOpen(true);
    }
  }, [searchParams]);

  /* ===== Yield flow ===== */
  const [yieldOn, setYieldOn] = useState(false);
  const [yieldEverActivated, setYieldEverActivated] = useState(false);

  useEffect(() => {
    if (!isAuthed) {
      setShareOpen(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    try {
      const storedOn = localStorage.getItem(LS_YIELD_ON) === "1";
      const storedEver = localStorage.getItem(LS_EVER_COMPLETE) === "1";
      if (storedOn) {
        setYieldOn(true);
        setYieldEverActivated(true);
      } else if (storedEver) {
        setYieldOn(true);
        setYieldEverActivated(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_YIELD_ON, yieldOn ? "1" : "0");
    } catch {}
  }, [yieldOn]);

  function handleFirstYieldActivate() {
    setYieldOn(true);
    setYieldEverActivated(true);
    try {
      localStorage.setItem(LS_YIELD_ON, "1");
      localStorage.setItem(LS_EVER_COMPLETE, "1");
    } catch {}

    if (isETFComplete) {
      openShareWithDelay();
    }
  }

  function handleCompletePortfolioClick() {
    openShareWithDelay();
  }

  /* ===== Scroll hint ===== */
  const listRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const check = () => {
      const overflow = el.scrollHeight - el.clientHeight > 4;
      const notAtBottom = el.scrollTop < el.scrollHeight - el.clientHeight - 2;
      setShowScrollHint(overflow && notAtBottom);
    };

    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    if (ro) ro.observe(el);

    window.addEventListener("resize", check, { passive: true });
    const id = setTimeout(check, 0);

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

  const numActiveAssets = Array.isArray(weights)
    ? weights.filter((w) => Number(w) > 0).length
    : 0;

  const max1asset = numActiveAssets <= 1;

  const showFirstYield = isETFComplete && !yieldEverActivated;
  const hasSecondaryAction = showFirstYield;
  const shareDisabled = !isETFComplete;

  const builderContent = (
    <div
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
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 bottom-0 hidden md:block"
        style={{
          left: "calc(var(--left-w) + 0.75rem)",
          width: "8px",
          transform: "translateX(-50%)",
          background: "var(--accent)",
          borderRadius: "999px",
          zIndex: 10,
        }}
      />

      {/* LEFT PANE */}
      <aside
        className={[
          "hidden md:flex",
          "bg-white rounded-[var(--radius-md)]",
          "overflow-hidden min-h-0 w-full flex-col",
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
                  pointsRemaining={pointsRemaining}
                  onChange={(desiredVal) =>
                    setWeights((w) => {
                      const copy = [...w];
                      const others = copy.reduce(
                        (a, b, j) =>
                          j === idx ? a : a + (Number.isFinite(b) ? b : 0),
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
                  highlightPlus={max1asset}
                  highlightMinus={
                    numActiveAssets === 1 && idx === 0 && Number(current) > 0
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
        className={[
          "right-pane",
          hasPortfolio ? "" : "is-empty",
          "min-h-0 self-stretch h-full",
          hasPortfolio
            ? "flex flex-col gap-4 h-auto"
            : "md:grid gap-3 [grid-template-rows:500px]",
          "order-1 md:order-none",
        ].join(" ")}
      >
        {hasPortfolio ? (
          <>
            <div className="bg-white rounded-[var(--radius-md)] overflow-hidden flex flex-col p-3 gap-3 w-full">
              <div
                className={[
                  "w-full h-auto sm:h-10 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2",
                  "[font-size:clamp(.8rem,1vw,.9rem)] leading-[1.2]",
                ].join(" ")}
              >
                <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-3 w-full">
                  <div className="min-w-0 flex-1 w-full flex">
                    {!isETFComplete ? (
                      <div className="h-[30px] md:h-[40px] px-3 flex items-center justify-center flex-1 w-full text-[var(--text)] cursor-default select-none">
                        <span className="whitespace-nowrap text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.08em]">
                          Fill ETF with {pointsRemaining} more point
                          {pointsRemaining === 1 ? "" : "s"} to complete
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

                  {hasSecondaryAction && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                      {showFirstYield ? (
                        <div className="flex items-center gap-2 text-right">
                          <button
                            type="button"
                            onClick={handleFirstYieldActivate}
                            className={[
                              "relative inline-flex items-center justify-center gap-1",
                              "h-9 sm:h-10 px-3 sm:px-4 rounded-3xl",
                              "border border-[#dfd2b9] bg-white/70 text-[#201909]",
                              "text-[10px] sm:text-xs font-semibold uppercase tracking-[0.04em]",
                              "hover:bg-white hover:border-[#cdbb97] transition-all active:scale-[0.98]",
                              "shadow-[0_8px_20px_rgba(242,197,95,0.4)]",
                            ].join(" ")}
                          >
                            <span
                              className="pointer-events-none absolute inset-[-4px] rounded-3xl border border-[#f2c55f] opacity-80 animate-ping"
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

      <div className="md:hidden order-2">
        <div className="bg-white rounded-[var(--radius-md)] shadow-[0_12px_32px_rgba(17,19,24,0.12)] overflow-hidden border border-[var(--border)]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
            <h3 className="m-0 font-semibold text-base">Assets selection</h3>
          </div>
          <div className="max-h-[360px] overflow-y-auto px-3 py-2.5 space-y-2">
            {assetKeys.map((key, idx) => {
              const current = weights[idx] ?? 0;
              const sumOthers = totalPointsUsed - current;
              const maxForThis = Math.max(
                current,
                Math.min(10, MAX_TOTAL_POINTS - sumOthers)
              );
              return (
                <WeightInput
                  key={`m-${key}`}
                  label={`${assetMeta[key]?.name ?? key} weight`}
                  nameOnly={assetMeta[key]?.name ?? key}
                  compactMobile
                  accentColor={assetMeta[key]?.color || undefined}
                  value={current}
                  maxForThis={maxForThis}
                  pointsRemaining={pointsRemaining}
                  onChange={(desiredVal) =>
                    setWeights((w) => {
                      const copy = [...w];
                      const others = copy.reduce(
                        (a, b, j) =>
                          j === idx ? a : a + (Number.isFinite(b) ? b : 0),
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
                  highlightPlus={max1asset}
                  highlightMinus={
                    numActiveAssets === 1 && idx === 0 && Number(current) > 0
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const wrapperClass = embedded
    ? "w-full"
    : "w-full rounded-[12px] border border-[#F2EBDE] bg-[#fdfbf9] px-6 pt-6 pb-14";

  const innerClass = embedded
    ? "w-full flex flex-col gap-14"
    : "w-full max-w-[1032px] mx-auto flex flex-col gap-14";

  return (
    <main className="w-full flex flex-col overflow-hidden">
      <div className={wrapperClass}>
        <div className={innerClass}>
          {!embedded && (
            <div className="flex flex-col gap-10">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-20 min-h-[252px]">
                <div className="flex flex-col gap-4 flex-1 max-w-[480px]">
                  <span className="inline-flex items-center justify-center h-[22px] px-[7px] text-[14px] font-medium rounded-[6px] bg-[#F2C55F] text-[#201909]">
                    Launch Campaign
                  </span>
                  <div className="flex flex-col gap-3">
                    <h2 className="text-[48px] leading-[110%] font-semibold tracking-[-0.04em] text-[#201909]">
                      Build your own investment bundle
                    </h2>
                    <p className="text-[18px] leading-[140%] text-[#645C4A]">
                      All the custom bundles are published to the leaderboard for public voting.
                    </p>
                  </div>
                  <Link href="/leaderboard" className="text-[16px] underline text-[#201909]">
                    Explore Leaderboard
                  </Link>
                </div>

                <div className="flex flex-1 max-w-[552px]">
                  <div className="w-[366px] flex flex-col gap-7">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-[44px] h-[28px] rounded-[38px] bg-[#F4E0B3] text-[#201909] text-[16px] font-medium">
                        1
                      </span>
                      <p className="text-[18px] leading-[140%] font-semibold text-[#201909]">
                        Select assets for your bundle based on your strategy preference.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-[44px] h-[28px] rounded-[38px] bg-[#F4E0B3] text-[#201909] text-[16px] font-medium">
                        2
                      </span>
                      <p className="text-[18px] leading-[140%] font-semibold text-[#201909]">
                        Share your bundle on socials.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-[44px] h-[28px] rounded-[38px] bg-[#F4E0B3] text-[#201909] text-[16px] font-medium">
                        3
                      </span>
                      <p className="text-[18px] leading-[140%] text-[#201909]">
                        Get access to early-adopter rewards.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {errAssets && <div className="text-[14px] text-[var(--neg)]">{errAssets}</div>}
          {loadingAssets && (
            <div className="text-[14px] text-[var(--muted)]">Loading assets...</div>
          )}

          <div className="w-full">{builderContent}</div>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleCompletePortfolioClick}
              disabled={shareDisabled}
              className={[
                "flex items-center justify-center",
                "h-[60px] w-[387px] rounded-[48px]",
                "bg-[#201909] text-white",
                "text-[15px] md:text-[17px] leading-[150%] font-semibold",
                shareDisabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-95",
              ].join(" ")}
              aria-disabled={shareDisabled}
              title={shareDisabled ? "Complete your ETF to share" : "Share portfolio"}
            >
              Share your portfolio &amp; earn future rewards!
            </button>
          </div>
        </div>
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
  compactMobile = false,
  maxForThis = 10,
  pointsRemaining = 0,
  highlightPlus = false,
  highlightMinus = false,
}) {
  const v0 = Number.isFinite(value) ? value : 0;
  const v = Math.max(0, Math.min(10, Math.round(v0)));

  const dec = () => onChange(Math.max(0, v - 1));
  const inc = () => onChange(Math.min(maxForThis, v + 1));
  const setTo = (n) =>
    onChange(Math.max(0, Math.min(maxForThis, Math.round(n === v ? 0 : n))));

  const incDisabled = v >= maxForThis;
  const decDisabled = v <= 0;

  const maxUnits = 10;
  const coloredPct = (v / maxUnits) * 100;

  const freeHere = Math.max(0, Math.min(pointsRemaining, maxForThis - v));
  const freePct = (freeHere / maxUnits) * 100;

  const handleBarClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const desired = Math.round(ratio * maxUnits);
    setTo(desired);
  };

  const labelRowClass = compactMobile
    ? "mb-0.5 leading-tight h-[22px] md:h-[35px] flex items-center"
    : "mb-0.5 md:mb-1 leading-tight h-[30px] md:h-[35px] flex items-center";

  const controlRowClass = compactMobile
    ? "grid grid-cols-[auto_1fr_auto] items-center gap-1 md:gap-2 h-[30px] md:h-[40px]"
    : "grid grid-cols-[auto_1fr_auto] items-center gap-1.5 md:gap-2 h-[36px] md:h-[40px]";

  const controlButtonClass = compactMobile
    ? "inline-flex items-center justify-center h-7 w-7 md:h-10 md:w-10 text-[22px] md:text-[32px] leading-none font-extrabold cursor-pointer bg-white text-[var(--brand)] hover:bg-[var(--bg-alt)] active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed rounded-[var(--radius-sm)]"
    : "inline-flex items-center justify-center h-9 w-9 md:h-10 md:w-10 text-[26px] md:text-[32px] leading-none font-extrabold cursor-pointer bg-white text-[var(--brand)] hover:bg-[var(--bg-alt)] active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed rounded-[var(--radius-sm)]";

  const barClass = compactMobile
    ? "relative h-[7px] md:h-[10px] w-full rounded-[var(--radius-sm)] bg-[var(--bg)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--border)]"
    : "relative h-[8px] md:h-[10px] w-full rounded-[var(--radius-sm)] bg-[var(--bg)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--border)]";

  return (
    <div style={accentColor ? { "--accent": accentColor } : undefined} className="select-none">
      <div className={labelRowClass}>
        <span
          className="font-semibold [font-size:55%] md:[font-size:65%]"
          style={{ color: "var(--accent, var(--text))" }}
        >
          {nameOnly || label}
        </span>
      </div>

      <div className={controlRowClass}>
        <button
          type="button"
          className={controlButtonClass}
          onClick={dec}
          disabled={decDisabled}
          aria-label={`Decrease ${label}`}
          title="Decrease"
        >
          <span
            className={[
              "relative -translate-y-[1px] transition-[text-shadow,transform]",
              highlightMinus ? "[text-shadow:0_0_14px_rgba(202,163,74,0.9)] animate-pulse" : "",
            ].join(" ")}
          >
            -
          </span>
        </button>

        <button
          type="button"
          onClick={handleBarClick}
          className={barClass}
          aria-label={`${label}: current ${v} of 10`}
          title={`${v} / 10`}
        >
          <span
            className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-[width] rounded-[var(--radius-sm)]"
            style={{ width: `${coloredPct}%` }}
            aria-hidden="true"
          />

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

        <button
          type="button"
          className={controlButtonClass}
          onClick={inc}
          disabled={incDisabled}
          aria-label={`Increase ${label}`}
          title="Increase"
        >
          <span
            className={[
              "relative -translate-y-[1px] transition-[text-shadow,transform]",
              highlightPlus ? "[text-shadow:0_0_14px_rgba(202,163,74,0.9)] animate-pulse" : "",
            ].join(" ")}
          >
            +
          </span>
        </button>
      </div>
    </div>
  );
}
