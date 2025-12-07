"use client";

import { useEffect, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";
import ChartBuilder from "./ChartBuilder";
import MetricsBuilder from "./MetricsBuilder";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ShareModal({
  open,
  onClose,
  assets,
  weights,
  showYield,
  userDisplay,
  assetMeta,
}) {
  const captureRef = useRef(null);

  const [chartReady, setChartReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imgDataUrl, setImgDataUrl] = useState(null);
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);

  const shareText =
    "I created this portfolio on stilletf.com - can you do better?";
  const shareUrl = "https://stilletf.com";

  const router = useRouter();

  // same sign-in logic as Header
  function openSignIn() {
    const base =
      typeof window !== "undefined" ? window.location.pathname : "/";
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );

    // mark that we're going through auth so we can reopen on return
    params.set("auth", "1");

    // remember that auth was triggered from the Share modal so we can reopen it
    params.set("share", "1");

    router.push(`${base}?${params.toString()}#builder`, { scroll: false });
  }

  // Reset state when modal opens/closes
  useEffect(() => {
    setChartReady(false);
    setGenerating(false);
    setImgDataUrl(null);
    setError(null);
    setSharing(false);
  }, [open]);

  const handleCaptureChartReady = () => {
    setChartReady(true);
  };

  const doCapture = async () => {
    if (!captureRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(captureRef.current, {
        width: 1200,
        height: 675,
        pixelRatio: 2,
      });
      setImgDataUrl(dataUrl);
    } catch (err) {
      console.error("Error generating share image", err);
      setError("Something went wrong while generating the image.");
    }
  };

  const ensureReadyAndCapture = async () => {
    if (!captureRef.current) return;
    setGenerating(true);
    setError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await doCapture();
    } finally {
      setGenerating(false);
    }
  };

  // Whenever modal is open and chart becomes ready, generate image
  useEffect(() => {
    if (open && chartReady && !imgDataUrl && !generating) {
      ensureReadyAndCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chartReady]);

  const handleDownload = () => {
    if (!imgDataUrl) return;
    const a = document.createElement("a");
    a.href = imgDataUrl;
    a.download = "portfolio-share.png";
    a.click();
  };

  const handleShareNative = async () => {
    if (!imgDataUrl) return;
    if (typeof navigator === "undefined" || typeof window === "undefined" || !navigator.share) {
      setError("Sharing is not supported on this device/browser.");
      return;
    }
    setSharing(true);
    setError(null);
    try {
      const res = await fetch(imgDataUrl);
      const blob = await res.blob();
      const file = new File([blob], "portfolio-share.png", { type: blob.type || "image/png" });
      const data = {
        files: navigator.canShare && navigator.canShare({ files: [file] }) ? [file] : undefined,
        text: shareText,
        title: "My portfolio",
        url: shareUrl,
      };
      await navigator.share(data);
    } catch (err) {
      console.error("Error sharing image", err);
      setError("Could not open the share sheet.");
    } finally {
      setSharing(false);
    }
  };

  const openShareWindow = (url) => {
    if (typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareX = () => {
    const url = `https://x.com/intent/post?text=${encodeURIComponent(
      `${shareText} ${shareUrl}`
    )}`;
    openShareWindow(url);
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareUrl
    )}&quote=${encodeURIComponent(shareText)}`;
    openShareWindow(url);
  };

  const handleShareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      shareUrl
    )}`;
    openShareWindow(url);
  };

  const handleShareReddit = () => {
    const url = `https://www.reddit.com/submit?url=${encodeURIComponent(
      shareUrl
    )}&title=${encodeURIComponent(shareText)}`;
    openShareWindow(url);
  };

  // Disable background scroll when any modal (including this one) is open
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

  const renderCaptureContent = (withRef = false) => (
    <div
      ref={withRef ? captureRef : null}
      className="bg-white overflow-hidden"
      style={{
        width: "1200px",
        height: "675px",
        boxSizing: "border-box",
      }}
    >
      <div
        className="w-full h-full grid"
        style={{
          gridTemplateColumns: "repeat(4, 300px)",
          gridTemplateRows: "300px 75px 300px",
        }}
      >
        {/* Row 1 Col 1: Logo */}
        <div className="flex items-center justify-center" style={{ padding: 10 }}>
          <div className="flex items-center justify-center w-full h-full bg-white">
            <img
              src="/logos/stilllogo.png"
              alt="stillwater logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Row 1 Col 2-4: Chart */}
        <div
          className="flex items-center justify-center"
          style={{ gridColumn: "2 / span 3", gridRow: "1 / span 1", padding: 10 }}
        >
          <div className="w-full h-full bg-white flex items-center justify-center">
            <ChartBuilder
              assets={assets}
              weights={weights}
              showYield={true}
              size="l"
              fixed
              width={880}
              height={280}
              animated={false}
              yieldOnly={true}
              onReady={handleCaptureChartReady}
              legendOff={true}
            />
          </div>
        </div>

        {/* Row 2 Col 1-4: Text */}
        <div
          className="flex items-center justify-center text-center"
          style={{ gridColumn: "1 / span 4", gridRow: "2 / span 1", padding: 10 }}
        >
          <p className="w-full text-[22px] font-semibold leading-snug text-black m-0">
            I created this portfolio on{" "}
            <span className="font-bold">stilletf.com</span> - can you do better?
          </p>
        </div>

        {/* Row 3 Col 1: QR */}
        <div
          className="flex flex-col items-center justify-center"
          style={{ gridColumn: "1 / span 1", gridRow: "3 / span 1", padding: 10 }}
        >
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https%3A%2F%2Fstilletf.com"
            alt="stilletf.com QR"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Row 3 Col 2-4: Metrics */}
        <div
          className="flex"
          style={{ gridColumn: "2 / span 3", gridRow: "3 / span 1", padding: 10 }}
        >
          <div className="w-full h-full text-[14px] text-black bg-white">
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
  );

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 sm:px-4">
      <div
        className="bg-black text-white shadow-xl w-full max-w-6xl flex flex-col border border-[var(--border)] px-4 py-4 sm:px-8 sm:py-6 max-h-[90vh] overflow-y-auto"
        style={{ fontSize: "clamp(0.95rem, 1.6vw, 1.1rem)" }}
      >
        {/* MAIN ROW - stretch columns; height is now content-driven */}
        <div className="flex flex-col lg:flex-row items-stretch justify-between gap-6 lg:gap-8">
          {/* LEFT COLUMN */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-semibold leading-snug">
                Share your portfolio in one click
              </h2>
              <p className="text-base text-[var(--muted)]">
                Copy the image and paste it straight into a post.
              </p>
              {userDisplay && (
                <p className="text-base text-[var(--muted)]">
                  Created by{" "}
                  <span className="font-semibold text-white">
                    {userDisplay}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleShareNative}
                disabled={!imgDataUrl || sharing}
                className="cta-btn cta-btn-sm cta-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sharing ? "Opening share sheet..." : "Share image from device"}
              </button>
              <span className="text-sm text-[var(--muted)]">
                Uses your device share sheet (Twitter app, Messages, etc.)
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-[var(--muted)]">
                ...or share directly:
              </span>
              <div className="flex flex-wrap gap-3 text-base">
                {/* black background -> white on hover */}
                <button
                  type="button"
                  onClick={handleShareX}
                  className="cta-btn cta-btn-sm cta-black gap-2"
                >
                  <span className="text-2xl font-bold leading-none">X</span>
                  <span>X</span>
                </button>

                {/* white background -> black on hover */}
                <button
                  type="button"
                  onClick={handleShareFacebook}
                  className="cta-btn cta-btn-sm cta-white gap-2"
                >
                  <span className="text-2xl font-bold leading-none">f</span>
                  <span>Facebook</span>
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
            </div>

            {/* full-width sign-in */}
            <div className="mt-2">
              <button
                type="button"
                onClick={openSignIn}
                className="cta-btn cta-btn-sm cta-white w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign in to share, get votes and future rewards
              </button>
            </div>

            {error && (
              <div className="text-base text-red-500 mt-2">{error}</div>
            )}
            {!imgDataUrl && !error && (
              <div className="text-base text-[var(--muted)] mt-1">
                {generating
                  ? "Generating your share image..."
                  : "We'll generate the image automatically once the chart is ready."}
              </div>
            )}
          </div>

          {/* MIDDLE: bigger preview */}
          <div className="flex lg:flex-[1.4] flex-col items-center justify-center gap-3">
            <div className="border border-[var(--border)] bg-white max-w-full overflow-hidden flex items-center justify-center w-full max-w-[640px]" style={{ aspectRatio: "16 / 9" }}>
              {imgDataUrl ? (
                <img
                  src={imgDataUrl}
                  alt="Share preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-base text-black px-4 text-center">
                  Preparing preview...
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: top buttons + bottom-anchored Try pilot */}
          <div className="flex flex-col lg:justify-between items-stretch text-base gap-3 w-full lg:w-auto lg:min-w-[220px]">
            <div className="flex flex-row lg:flex-col items-stretch gap-3">
              <button
                type="button"
                onClick={onClose}
                className="cta-btn cta-white flex-1"
                style={{ height: "40px", minHeight: "40px" }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!imgDataUrl}
                className="cta-btn cta-black disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                style={{ height: "40px", minHeight: "40px" }}
              >
                Download PNG
              </button>
            </div>

            <Link
              href="/btcetf"
              className="cta-btn cta-btn-sm cta-blue no-underline lg:mt-6 text-center"
            >
              Try pilot BTCETF on testnet
            </Link>
          </div>
        </div>

        {/* Hidden capture content (only for image generation) */}
        <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
          {renderCaptureContent(true)}
        </div>

      </div>
    </section>
  );
}
