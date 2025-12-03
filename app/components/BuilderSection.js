"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { fetchAssets } from "../../lib/portfolio";
import PortfolioBuilder from "./MetricsBuilder";
import ChartBuilder from "./ChartBuilder";
import ShareModal from "./ShareModal";
import ShareModalSignedIn from "./ShareModalSignedIn";

/**
 * BuilderSection
 * Keeps original behavior: 2-column split with fixed height, scrollable left pane,
 * yield toggle flow, and share modal triggers.
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
  const LS_EVER_COMPLETE = "dw-ever-complete"; // yield ever activated
  const LS_YIELD_ON = "dw-yield-on";

  useEffect(() => {
    if (!keepAssets) {
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
    if (!keepAssets) return;
    try {
      localStorage.setItem(
        LS_WEIGHTS,
        JSON.stringify({ keys: assetKeys, weights })
      );
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
      shareTimerRef.current = setTimeout(() => setShareOpen(true), 1000);
    } catch {}
  };

  useEffect(() => () => shareTimerRef.current && clearTimeout(shareTimerRef.current), []);

  const searchKey = searchParams?.toString() || "";

  useEffect(() => {
    if (!searchParams) return;
    const authPending = searchParams.get("auth") === "1" && !isAuthed;
    const wantsShare = searchParams.get("share") === "1";
    if (authPending) {
      setShareOpen(false);
      return;
    }
    if (wantsShare) setShareOpen(true);
  }, [searchKey, isAuthed]);

  /* ===== Yield flow ===== */
  const [yieldOn, setYieldOn] = useState(false);
  const [yieldEverActivated, setYieldEverActivated] = useState(false);

  useEffect(() => {
    try {
      const storedOn = localStorage.getItem(LS_YIELD_ON) === "1";
      const storedEver = localStorage.getItem(LS_EVER_COMPLETE) === "1";
      if (storedOn) {
        setYieldOn(true);
        setYieldEverActivated(true);
      } else if (storedEver) {
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
    if (isETFComplete) openShareWithDelay();
  }

  function handleToggleYield() {
    if (!yieldEverActivated) {
      handleFirstYieldActivate();
      return;
    }
    setYieldOn((prev) => !prev);
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
      const notAtBottom =
        el.scrollTop < el.scrollHeight - el.clientHeight - 2;
      setShowScrollHint(overflow && notAtBottom);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
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
  const shouldPulsePlus = max1asset || numActiveAssets === 0;

  const BUILDER_HEIGHT = 720;
  const leftWidth = hasPortfolio ? "30%" : "40%";
  const rightHeight = `${BUILDER_HEIGHT}px`;

  return (
    <section className="builder-shell" id="builder">
      <div className="builder-main">
        <h2 className="heading-2">Build your ETF</h2>
        <p className="text-body-muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Assign up to 20 points across assets. Turn yield on when ready.
        </p>

        {errAssets && <div className="metric-label neg">{errAssets}</div>}
        {loadingAssets && <div className="metric-label">Loading assets…</div>}

        {!loadingAssets && (
          <div
            className="builder-grid builder-divider"
            style={{
              height: rightHeight,
              gridTemplateColumns: `${leftWidth} minmax(0,1fr)`,
              ["--divider-x"]: leftWidth,
              minWidth: 0,
            }}
          >
            {/* Left pane */}
            <aside className="builder-left" style={{ height: rightHeight }}>
              <header>
                <h3 className="heading-4" style={{ margin: 0 }}>
                  Asset weights
                </h3>
              </header>

              <div className="builder-scroll" ref={listRef}>
                {assetKeys.map((key, idx) => {
                  const current = weights[idx] ?? 0;
                  const sumOthers = totalPointsUsed - current;
                  const maxForThis = Math.max(current, Math.min(10, 20 - sumOthers));
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
                            (a, b, j) => (j === idx ? a : a + (Number.isFinite(b) ? b : 0)),
                            0
                          );
                          const allowed = Math.max(copy[idx] ?? 0, Math.min(10, 20 - others));
                          const next = Math.max(
                            0,
                            Math.min(allowed, Number.isFinite(desiredVal) ? desiredVal : 0)
                          );
                          copy[idx] = next;
                          return copy;
                        })
                      }
                      highlightPlus={shouldPulsePlus}
                      highlightMinus={numActiveAssets === 1 && idx === 0 && Number(current) > 0}
                    />
                  );
                })}

                {showScrollHint && (
                  <div
                    style={{
                      position: "sticky",
                      bottom: 0,
                      paddingTop: 18,
                      marginTop: 18,
                      textAlign: "center",
                      background: "linear-gradient(180deg, transparent, #fff)",
                    }}
                  >
                    <div className="metric-label" style={{ fontWeight: 700 }}>
                      Scroll for more
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Right pane */}
            <section
              className="builder-right"
              style={{
                height: rightHeight,
                display: "grid",
                gridTemplateRows: hasPortfolio
                  ? "auto auto 320px auto 320px"
                  : "1fr",
                alignItems: "stretch",
                minWidth: 0,
              }}
            >
              {hasPortfolio ? (
                <>
                  {/* Top controls */}
                  <div className="builder-topline">
                    <button
                      className="btn btn-outline"
                      style={{
                        background: "var(--brand)",
                        color: "#fff",
                        borderColor: "var(--brand)",
                        borderRadius: 0,
                      }}
                    >
                      {isETFComplete
                        ? "ETF COMPLETE · 20 / 20"
                        : `FILL ETF WITH ${pointsRemaining} MORE POINTS TO COMPLETE`}
                    </button>
                    <span
                      className="badge"
                      style={{
                        background: "#eef2ff",
                        color: "var(--accent-text)",
                        borderRadius: 999,
                      }}
                    >
                      {numActiveAssets} assets
                    </span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                      {isETFComplete && !yieldEverActivated && (
                      <button className="btn btn-outline" onClick={handleFirstYieldActivate} style={{ border: "none" }}>
                        ⚡ Turn yield on
                      </button>
                    )}
                    {yieldEverActivated && (
                      <button className="btn btn-outline" onClick={handleToggleYield} style={{ border: "none" }}>
                        {yieldOn ? "⬜ Turn yield off" : "🟦 Turn yield on"}
                      </button>
                    )}
                    {isETFComplete && yieldOn && (
                      <button
                        className="btn btn-primary"
                        onClick={handleCompletePortfolioClick}
                          style={{ boxShadow: "0 0 14px rgba(255,138,0,0.55)", borderColor: "transparent" }}
                      >
                        ✅ Complete portfolio
                      </button>
                    )}
                  </div>
                  </div>

                  {/* Progress bar */}
                  <div className="progress-bar" aria-label={`ETF completeness ${pointsForBar} of 20`}>
                    <div
                      className="progress-fill"
                      style={{ width: `${(pointsForBar / MAX_TOTAL_POINTS) * 100}%`, background: "var(--brand)" }}
                    />
                  </div>

                  {/* Chart */}
                  <div
                    style={{
                      height: 320,
                      minHeight: 320,
                      width: "100%",
                      minWidth: 0,
                      overflow: "hidden",
                      display: "block",
                    }}
                  >
                    <ChartBuilder assets={assetKeys} weights={weights} showYield={yieldOn} size="l" />
                  </div>

                  {/* Spacer text */}
                  <div className="text-body" style={{ textAlign: "center", fontWeight: 800 }}>
                    If you invested $1000 5 years ago, you would have:
                  </div>

                  {/* Metrics */}
                  <div style={{ height: 320, minHeight: 320, overflow: "auto" }}>
                    <PortfolioBuilder assets={assetKeys} weights={weights} showYield={yieldOn} detail />
                  </div>
                </>
              ) : (
                <div className="builder-empty" role="status" aria-live="polite" style={{ height: rightHeight }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1.4rem", color: "var(--muted)" }}>
                      start building with adding assets
                    </div>
                    <div className="metric-label">Great ETF balances growth, stability and resilience.</div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

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
      </div>
    </section>
  );
}

function WeightInput({
  label,
  value,
  onChange,
  accentColor,
  nameOnly = "",
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

  return (
    <div
      style={accentColor ? { "--accent": accentColor } : undefined}
      className="weight-control"
    >
      <div>
        <span className="weight-label" style={{ color: "var(--accent, var(--text))" }}>
          {nameOnly || label}
        </span>
      </div>

      <div className="weight-row">
        <button
          type="button"
          className="weight-button"
          onClick={dec}
          disabled={decDisabled}
          aria-label={`Decrease ${label}`}
          title="Decrease"
          style={{
            color: "var(--brand)",
            boxShadow: highlightMinus ? "0 0 14px rgba(34,80,244,0.8)" : undefined,
          }}
        >
          −
        </button>

        <button
          type="button"
          onClick={handleBarClick}
          className="weight-track"
          aria-label={`${label}: current ${v} of 10`}
          title={`${v} / 10`}
        >
          <span
            className="fill"
            style={{ width: `${coloredPct}%`, background: "var(--brand)" }}
            aria-hidden="true"
          />

          {freeHere > 0 && (
            <span
              className="free"
              style={{
                left: `${coloredPct}%`,
                width: `${freePct}%`,
                background: "#d7dde7",
              }}
              aria-hidden="true"
            />
          )}
        </button>

        <button
          type="button"
          className="weight-button"
          onClick={inc}
          disabled={incDisabled}
          aria-label={`Increase ${label}`}
          title="Increase"
          style={{
            color: "var(--brand)",
            boxShadow: highlightPlus ? "0 0 14px rgba(34,80,244,0.8)" : undefined,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
