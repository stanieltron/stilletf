"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";
import ChartBuilder from "./ChartBuilder";
import MetricsBuilder from "./MetricsBuilder";

export default function ShareModalSignedIn({
  open,
  onClose,
  assets = [],
  weights = [],
  showYield = true,
  userDisplay = "",
  assetMeta = {},
}) {
  const captureRef = useRef(null);
  const savePromiseRef = useRef(null);
  const ogUploadedPortfolioIdRef = useRef(null);

  const [chartReady, setChartReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imgDataUrl, setImgDataUrl] = useState(null);
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const CAPTURE_SAFE_MARGIN = 32;

  const [saving, setSaving] = useState(false);
  const [portfolioId, setPortfolioId] = useState(null);
  const [shareUrl, setShareUrl] = useState("");

  const qrLink = "https://stilletf.com";
  const shareText = "I created this portfolio on Stillwater - can you do better?";

  const shareHost = (() => {
    try {
      return new URL(qrLink).hostname.replace(/^www\./, "");
    } catch {
      return "stilletf.com";
    }
  })();

  const shareQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    qrLink
  )}`;
  const compositionItems = useMemo(() => {
    const rows = (assets || [])
      .map((asset, index) => ({
        asset,
        weight: Number(weights?.[index]) || 0,
      }))
      .filter((item) => item.weight > 0);

    const total = rows.reduce((sum, item) => sum + item.weight, 0);
    return rows.map((item) => {
      const meta = assetMeta?.[item.asset] || {};
      const label =
        meta.name ||
        meta.symbol ||
        meta.ticker ||
        meta.shortName ||
        item.asset;
      const pct = total > 0 ? (item.weight / total) * 100 : 0;
      return {
        key: item.asset,
        label,
        pctLabel: `${pct.toFixed(1)}%`,
      };
    });
  }, [assets, weights, assetMeta]);
  const compositionVisibleItems = useMemo(
    () => compositionItems.slice(0, 7),
    [compositionItems]
  );
  const compositionHasMore = compositionItems.length > 7;

  useEffect(() => {
    setChartReady(false);
    setGenerating(false);
    setImgDataUrl(null);
    setError(null);
    setSharing(false);
    setSaving(false);
    setPortfolioId(null);
    setShareUrl("");
    savePromiseRef.current = null;
    ogUploadedPortfolioIdRef.current = null;
  }, [open]);

  useEffect(() => {
    const check = () =>
      setIsMobile(
        typeof window !== "undefined"
          ? window.matchMedia("(max-width: 768px)").matches
          : false
      );
    check();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", check, { passive: true });
      return () => window.removeEventListener("resize", check);
    }
    return undefined;
  }, []);

  const doCapture = async () => {
    if (!captureRef.current) return;
    const dataUrl = await htmlToImage.toPng(captureRef.current, {
      width: 1200,
      height: 675,
      pixelRatio: 2,
    });
    setImgDataUrl(dataUrl);
  };

  const ensureReadyAndCapture = async () => {
    if (!captureRef.current) return;
    setGenerating(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await doCapture();
    } catch (err) {
      console.error("Error generating share image", err);
      setError("Something went wrong while generating the image.");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (open && chartReady && !imgDataUrl && !generating) {
      ensureReadyAndCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chartReady]);

  useEffect(() => {
    if (open && chartReady && shareUrl && !generating) {
      ensureReadyAndCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareUrl]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const body = document.body;
    const current = parseInt(body.dataset.modalLocks || "0", 10) || 0;
    const next = open ? current + 1 : Math.max(0, current - 1);
    body.dataset.modalLocks = String(next);
    body.style.overflow = next > 0 ? "hidden" : "";

    return () => {
      if (!open) return;
      const cur = parseInt(body.dataset.modalLocks || "0", 10) || 0;
      const n = Math.max(0, cur - 1);
      body.dataset.modalLocks = String(n);
      body.style.overflow = n > 0 ? "hidden" : "";
    };
  }, [open]);

  const handleDownload = () => {
    if (!imgDataUrl) return;
    const a = document.createElement("a");
    a.href = imgDataUrl;
    a.download = "portfolio-share.png";
    a.click();
  };

  async function savePortfolio() {
    const res = await fetch("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: userDisplay || "",
        assets,
        weights,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || "Could not save portfolio.");
    }

    const data = await res.json().catch(() => ({}));
    const portfolio = data?.portfolio;
    if (!portfolio?.id) throw new Error("Saved, but missing portfolio id.");

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = origin
      ? `${origin}/leaderboard/${portfolio.id}`
      : `/leaderboard/${portfolio.id}`;

    setPortfolioId(portfolio.id);
    setShareUrl(url);
    return { id: portfolio.id, url };
  }

  async function ensureSaved() {
    if (shareUrl && portfolioId) return { id: portfolioId, url: shareUrl };
    if (savePromiseRef.current) return savePromiseRef.current;

    savePromiseRef.current = (async () => {
      setSaving(true);
      setError(null);
      try {
        return await savePortfolio();
      } finally {
        setSaving(false);
        savePromiseRef.current = null;
      }
    })();

    return savePromiseRef.current;
  }

  async function captureSharePng() {
    if (!captureRef.current) throw new Error("Share preview is not ready yet.");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const dataUrl = await htmlToImage.toPng(captureRef.current, {
      width: 1200,
      height: 675,
      pixelRatio: 2,
    });
    setImgDataUrl(dataUrl);
    return dataUrl;
  }

  async function uploadOgImage(portfolioIdToUpload) {
    if (!portfolioIdToUpload) throw new Error("Missing portfolio id.");
    if (ogUploadedPortfolioIdRef.current === portfolioIdToUpload) return;

    const png = await captureSharePng();
    const res = await fetch(`/api/portfolios/${portfolioIdToUpload}/og-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: png }),
    });
    if (!res.ok) throw new Error("Could not upload share image.");
    ogUploadedPortfolioIdRef.current = portfolioIdToUpload;
  }

  function openShareWindow(url) {
    if (typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleShareX() {
    setError(null);
    const saved = await ensureSaved();
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    await uploadOgImage(saved.id);
    const url = `https://x.com/intent/post?text=${encodeURIComponent(
      `${shareText}\n\n${saved.url}`
    )}`;
    openShareWindow(url);
  }

  async function handleShareFacebook() {
    setError(null);
    const saved = await ensureSaved();
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    await uploadOgImage(saved.id);
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      saved.url
    )}&quote=${encodeURIComponent(shareText)}`;
    openShareWindow(url);
  }

  const handleShareNative = async () => {
    if (
      typeof navigator === "undefined" ||
      typeof window === "undefined" ||
      !navigator.share
    ) {
      setError("Sharing is not supported on this device/browser.");
      return;
    }

    setSharing(true);
    setError(null);

    try {
      let text = shareText;
      try {
        const saved = await ensureSaved();
        text = `${shareText}\n\n${saved.url}`;
      } catch {
        // If saving fails, still try to share the image (if we have it).
      }

      if (imgDataUrl) {
        const res = await fetch(imgDataUrl);
        const blob = await res.blob();
        const file = new File([blob], "portfolio-share.png", {
          type: blob.type || "image/png",
        });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text, title: "My portfolio" });
          return;
        }
      }

      await navigator.share({ text, title: "My portfolio" });
    } catch (err) {
      console.error("Error sharing", err);
      setError("Could not open the share sheet.");
    } finally {
      setSharing(false);
    }
  };

  const renderCaptureContent = (withRef = false) => (
    <div
      ref={withRef ? captureRef : null}
      className="bg-white overflow-hidden"
      style={{ width: "1200px", height: "675px", boxSizing: "border-box" }}
    >
      <div
        className="w-full h-full"
        style={{
          padding: `${CAPTURE_SAFE_MARGIN}px`,
          boxSizing: "border-box",
        }}
      >
        <div
          className="w-full h-full grid"
          style={{
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gridTemplateRows: "4fr 1fr 4fr",
          }}
        >
          <div className="flex items-center justify-center" style={{ padding: 10 }}>
            <div className="w-full h-full bg-white border border-[#f2ebde] rounded-[10px] px-3 pt-2 pb-2 flex flex-col">
              <div className="text-center text-[30px] font-semibold tracking-[-0.03em] text-[#201909] leading-none">
                stillwater
              </div>
              <div className="mt-3 text-center text-[10px] font-semibold tracking-[0.11em] uppercase text-[#756c57]">
                composition
              </div>

              <div className="mt-2 flex-1 min-h-0">
                {compositionVisibleItems.length ? (
                  <div
                    className="grid gap-x-3 gap-y-1 content-start"
                    style={{
                      gridTemplateColumns: `repeat(${
                        compositionVisibleItems.length > 5 ? 2 : 1
                      }, minmax(0, 1fr))`,
                    }}
                  >
                    {compositionVisibleItems.map((item, index) => (
                      <div
                        key={`${item.key}-${index}`}
                        className="min-w-0 flex items-center justify-between gap-2 leading-tight"
                      >
                        <span className="truncate text-[12px] font-semibold text-[#201909]">
                          {item.label}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#756c57]">
                          {item.pctLabel}
                        </span>
                      </div>
                    ))}
                    {compositionHasMore && (
                      <div className="text-[12px] font-semibold text-[#756c57] leading-tight">
                        ...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-[11px] text-[#756c57] text-center">
                    Add assets to show composition
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            className="flex items-center justify-center"
            style={{ gridColumn: "2 / span 3", gridRow: "1 / span 1", padding: 10 }}
          >
            <div className="w-full h-full bg-white flex items-center justify-center">
              <ChartBuilder
                assets={assets}
                weights={weights}
                showYield={showYield}
                size="l"
                fixed
                width={880}
                height={280}
                animated={false}
                yieldOnly={true}
                onReady={() => setChartReady(true)}
                legendOff={true}
              />
            </div>
          </div>

          <div
            className="flex items-center justify-center text-center"
            style={{ gridColumn: "1 / span 4", gridRow: "2 / span 1", padding: 10 }}
          >
            <p className="w-full text-[22px] font-semibold leading-snug text-black m-0">
              {shareText}
            </p>
          </div>

          <div
            className="flex flex-col items-center justify-center"
            style={{ gridColumn: "1 / span 1", gridRow: "3 / span 1", padding: 10 }}
          >
            <img
              src={shareQrUrl}
              alt={`${shareHost} share QR`}
              className="w-full h-full object-contain"
            />
          </div>

          <div
            className="flex"
            style={{ gridColumn: "2 / span 3", gridRow: "3 / span 1", padding: 10 }}
          >
            <div className="w-full h-full text-[14px] text-black bg-white">
              <MetricsBuilder
                assets={assets}
                weights={weights}
                showYield={showYield}
                assetMeta={assetMeta}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div
        className="w-full flex flex-col overflow-y-auto rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[#1c1a15] text-white shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
        style={{
          maxWidth: 560,
          maxHeight: "90vh",
        }}
      >
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-semibold leading-none m-0">
                Share your portfolio
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-full border border-[rgba(255,255,255,0.2)] text-white/70 text-[24px] leading-none hover:text-white hover:border-[rgba(255,255,255,0.35)] transition-colors"
              aria-label="Close"
              title="Close"
            >
              x
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 flex flex-col items-center gap-4">
          <div
            className="w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] overflow-hidden flex items-center justify-center"
            style={{ aspectRatio: "16 / 9" }}
          >
            {imgDataUrl ? (
              <img
                src={imgDataUrl}
                alt="Share preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-base text-white/80 px-4 text-center">
                {error ? "Could not generate preview." : "Preparing preview..."}
              </div>
            )}
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={handleShareNative}
              disabled={sharing || saving}
              className="h-11 w-full rounded-xl bg-[#f1c255] text-[#201909] text-sm font-semibold hover:bg-[#eab444] transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sharing ? "Opening share..." : saving ? "Saving..." : "Share"}
            </button>
          ) : (
            <div className="w-full flex gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!imgDataUrl}
                className="h-11 flex-1 rounded-xl bg-[#f1c255] text-[#201909] text-sm font-semibold hover:bg-[#eab444] transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => handleShareX().catch((e) => setError(e?.message || String(e)))}
                disabled={saving}
                className="h-11 flex-1 rounded-xl border border-[rgba(255,255,255,0.2)] bg-transparent text-white/90 text-sm font-semibold hover:text-white hover:border-[rgba(255,255,255,0.35)] transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Share on X"
                title={shareUrl ? "Share on X" : "Save and share on X"}
              >
                X
              </button>
              <button
                type="button"
                onClick={() =>
                  handleShareFacebook().catch((e) => setError(e?.message || String(e)))
                }
                disabled={saving}
                className="h-11 flex-1 rounded-xl border border-[rgba(255,255,255,0.2)] bg-transparent text-white/90 text-sm font-semibold hover:text-white hover:border-[rgba(255,255,255,0.35)] transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Share on Facebook"
                title={shareUrl ? "Share on Facebook" : "Save and share on Facebook"}
              >
                Facebook
              </button>
            </div>
          )}

          {!!error && <div className="text-sm text-rose-300 w-full">{error}</div>}
          {!imgDataUrl && !error && (
            <div className="text-sm text-white/70 w-full">
              {generating ? "Generating preview..." : ""}
            </div>
          )}
        </div>

        <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
          {renderCaptureContent(true)}
        </div>
      </div>
    </section>
  );
}
