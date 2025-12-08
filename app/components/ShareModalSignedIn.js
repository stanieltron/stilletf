"use client";

import { useState, useEffect, useRef } from "react";
import * as htmlToImage from "html-to-image";
import ChartBuilder from "./ChartBuilder";
import MetricsBuilder from "./MetricsBuilder";
import Link from "next/link";

export default function ShareModalSignedIn({
  open,
  onClose,
  assets = [],
  weights = [],
  showYield = true,
  userDisplay = "",
  assetMeta = {},
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  // For OG generation
  const captureRef = useRef(null);
  const [chartReady, setChartReady] = useState(false);
  const [generatingOg, setGeneratingOg] = useState(false);

  useEffect(() => {
    if (open) {
      setSaving(false);
      setError(null);
      setSaved(false);
      setShareUrl("");
      setChartReady(false);
      setGeneratingOg(false);
    }
  }, [open]);

  if (!open) return null;

  const baseShareText =
    "I built this ETF-style crypto portfolio on Sona — can you beat it?";

  const fullShareText = shareUrl
    ? `${baseShareText}\n\n${shareUrl}`
    : baseShareText;

  const shareHost = (() => {
    try {
      return shareUrl
        ? new URL(shareUrl).hostname.replace(/^www\\./, "")
        : "sonaetf.com";
    } catch {
      return "sonaetf.com";
    }
  })();

  const qrLink =
    shareUrl || process.env.NEXT_PUBLIC_BASE_URL || "https://sonaetf.com";
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    qrLink
  )}`;

  const handleCaptureChartReady = () => {
    setChartReady(true);
  };

  // Capture the hidden card and upload PNG to the OG-image API
  const doCaptureAndUpload = async (portfolioId) => {
    if (!captureRef.current) return;

    try {
      // small delay so ChartBuilder/MetricsBuilder finish rendering
      if (!chartReady) {
        await new Promise((r) => setTimeout(r, 200));
      }

      const dataUrl = await htmlToImage.toPng(captureRef.current, {
        width: 1200,
        height: 675,
        pixelRatio: 2,
      });

      await fetch(`/api/portfolios/${portfolioId}/og-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
    } catch (err) {
      console.error("[OG] error capturing/uploading real image", err);
    }
  };

  const generateOgImageForPortfolio = async (portfolioId) => {
    setGeneratingOg(true);
    try {
      await doCaptureAndUpload(portfolioId);
    } finally {
      setGeneratingOg(false);
    }
  };

  async function handleSave() {
    setError(null);
    try {
      setSaving(true);

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

      const data = await res.json();
      const portfolio = data?.portfolio;
      if (!portfolio || !portfolio.id) {
        throw new Error("Saved, but missing portfolio id from server.");
      }

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const url = origin
        ? `${origin}/useretfs/${portfolio.id}`
        : `/useretfs/${portfolio.id}`;

      setShareUrl(url);
      setSaved(true);

      // =ƒöÑ Generate the REAL OG image (logo + QR + chart + metrics)
      generateOgImageForPortfolio(portfolio.id).catch((err) => {
        console.error("[OG] failed to generate real OG image", err);
      });
    } catch (e) {
      console.error(e);
      setError(e.message || "Could not save portfolio.");
    } finally {
      setSaving(false);
    }
  }

  function openShareWindow(url) {
    if (typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleShareX() {
    if (!shareUrl) return;
    const url = `https://x.com/intent/post?text=${encodeURIComponent(
      fullShareText
    )}`;
    openShareWindow(url);
  }

  function handleShareTelegram() {
    if (!shareUrl) return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(
      shareUrl
    )}&text=${encodeURIComponent(fullShareText)}`;
    openShareWindow(url);
  }

  function handleShareLinkedIn() {
    if (!shareUrl) return;
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      shareUrl
    )}`;
    openShareWindow(url);
  }

  function handleShareReddit() {
    if (!shareUrl) return;
    const url = `https://www.reddit.com/submit?url=${encodeURIComponent(
      shareUrl
    )}&title=${encodeURIComponent(
      "My ETF-style crypto portfolio on Sona"
    )}`;
    openShareWindow(url);
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 sm:px-4">
      <div
        className="bg-black text-white shadow-xl w-full max-w-6xl flex flex-col border border-[var(--border)] px-4 py-4 sm:px-8 sm:py-6 max-h-[90vh] overflow-y-auto"
        style={{ fontSize: "clamp(0.95rem, 1.6vw, 1.1rem)" }}
      >
        <div className="flex flex-col lg:flex-row items-stretch justify-between gap-6 lg:gap-8">
          {/* LEFT COLUMN */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-semibold leading-snug">
                ETF ready, save yours to share, get votes, climb the leaderboard
                and get future rewards.
              </h2>
              {userDisplay && (
                <p className="text-base text-[var(--muted)]">
                  Signed in as{" "}
                  <span className="font-semibold text-white">
                    {userDisplay}
                  </span>
                  .
                </p>
              )}
            </div>

            {!saved && (
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-base text-[var(--muted)]">
                  Save this ETF to get a shareable link and start climbing the
                  leaderboard.
                </p>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="cta-btn cta-btn-sm cta-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "SavingGÇª" : "Save portfolio"}
                </button>
              </div>
            )}

            {saved && shareUrl && (
              <div className="flex flex-col gap-3 mt-4">
                <p className="text-sm text-[var(--muted)]">
                  Share, get votes, climb the leaderboard and get future
                  rewards.
                </p>

                <div className="flex flex-wrap gap-2 items-center text-sm">
                  <code className="px-3 py-2 bg-white/5 border border-[var(--border)] rounded-sm break-all">
                    {shareUrl}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    title="Copy link to clipboard"
                    className="cta-btn cta-btn-sm cta-white text-xs"
                  >
                    Copy link
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 text-base">
                  <button
                    type="button"
                    onClick={handleShareX}
                    className="cta-btn cta-btn-sm cta-black gap-2"
                  >
                    <span className="text-2xl font-bold leading-none">X</span>
                    <span>Share on X</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareTelegram}
                    className="cta-btn cta-btn-sm cta-white gap-2"
                  >
                    <span className="text-xl leading-none">TG</span>
                    <span>Telegram</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareLinkedIn}
                    className="cta-btn cta-btn-sm cta-white gap-2"
                  >
                    <span className="text-xl font-bold leading-none">in</span>
                    <span>LinkedIn</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareReddit}
                    className="cta-btn cta-btn-sm cta-white gap-2"
                  >
                    <span className="text-2xl font-bold leading-none">r</span>
                    <span>Reddit</span>
                  </button>
                </div>

                {generatingOg && (
                  <p className="text-xs text-[var(--muted)]">
                    Generating share image in the backgroundGÇª
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="text-base text-red-500 mt-2">{error}</div>
            )}
          </div>

          {/* MIDDLE: chart + metrics preview (live) */}
          <div className="flex lg:flex-[1.4] flex-col gap-4">
            <div className="border border-[var(--border)] bg-white text-black p-4 flex flex-col gap-3">
              <h3 className="text-lg font-semibold mt-0 mb-1">
                Performance preview
              </h3>
              <div className="w-full h-[260px] flex flex-col min-h-[240px]">
                <ChartBuilder
                  assets={assets}
                  weights={weights}
                  showYield={showYield}
                />
              </div>
            </div>
            <div className="border border-[var(--border)] bg-white text-black p-4 flex flex-col gap-3">
              <h3 className="text-lg font-semibold mt-0 mb-1">
                Portfolio metrics
              </h3>
              <div className="max-h-[260px] overflow-auto">
                <MetricsBuilder
                  assets={assets}
                  weights={weights}
                  showYield={showYield}
                  assetMeta={assetMeta}
                />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col lg:justify-between items-stretch text-base gap-3 w-full lg:w-[260px] shrink-0">
            <div className="flex flex-row lg:flex-col items-stretch gap-3">
              <button
                type="button"
                onClick={onClose}
                className="cta-btn cta-white flex-1"
                style={{ height: "40px", minHeight: "40px" }}
              >
                Close
              </button>
            </div>

            <div className="flex flex-col items-stretch gap-3">
              <p className="text-sm text-[var(--muted)]">
                Bonus: try our pilot BTC ETF on testnet to unlock additional
                reward opportunities.
              </p>
              <Link
                href="/btcetf"
                className="cta-btn cta-btn-sm cta-blue no-underline text-center"
              >
                Try pilot BTCETF on testnet
              </Link>
            </div>
          </div>
        </div>

        {/* =ƒöÆ HIDDEN LIVE CARD GÇô SAME layout as ShareModal.js, used ONLY for OG capture */}
        {open && (
          <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
            <div
              ref={captureRef}
              className="bg-white overflow-hidden"
              style={{
                width: "1200px",
                height: "675px",
                boxSizing: "border-box",
                padding: "40px",
              }}
            >
              <div className="w-full h-full grid grid-cols-[260px_minmax(0,1fr)] gap-x-40 gap-y-16">
                {/* LEFT: logo + QR */}
                <div className="flex flex-col items-center justify-between">
                  <div className="flex items-center justify-center">
                    <img
                      src="/logos/stilllogo.png"
                      alt="Sona logo"
                      className="w-[220px] h-[220px] object-contain"
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <img
                      src={qrSrc}
                      alt={`${shareHost} share QR`}
                      className="w-[220px] h-[220px]"
                    />
                    <span className="mt-2 text-[11px] text-slate-500">
                      {shareHost}
                    </span>
                  </div>
                </div>

                {/* RIGHT: chart + tagline + metrics */}
                <div className="flex flex-col">
                  <div className="w-full" style={{ height: 260 }}>
                    <ChartBuilder
                      assets={assets}
                      weights={weights}
                      showYield={true}
                      size="l"
                      fixed
                      width={800}
                      height={260}
                      animated={false}
                      yieldOnly={true}
                      onReady={handleCaptureChartReady}
                      legendOff={true}
                    />
                  </div>

                  <p className="mt-10 mb-6 text-center text-[22px] font-semibold leading-snug text-black">
                    I created this portfolio on{" "}
                    <span className="font-bold">Sona</span> &mdash; can you
                    do better?
                  </p>

                  <div className="flex-1 min-h-[160px] text-[14px] text-black">
                    <MetricsBuilder
                      assets={assets}
                      weights={weights}
                      showYield={true}
                      assetMeta={assetMeta}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}




