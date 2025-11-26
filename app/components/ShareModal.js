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
  const [copying, setCopying] = useState(false);

  const shareText =
    "I created this portfolio on stilletf.com — can you do better?";
  const shareUrl = "https://stilletf.com";

  const router = useRouter();

  // same sign-in logic as Header
  function openSignIn() {
    const base =
      typeof window !== "undefined" ? window.location.pathname : "/";
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );

    // mark that we're going through auth and want to skip intro on return
    params.set("auth", "1");
    params.set("skipIntro", "1");

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
    setCopying(false);
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

  const handleCopyImage = async () => {
    if (!imgDataUrl) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof window === "undefined" ||
      !window.ClipboardItem
    ) {
      setError("Copy to clipboard is not supported in this browser.");
      return;
    }

    setCopying(true);
    setError(null);
    try {
      const res = await fetch(imgDataUrl);
      const blob = await res.blob();
      const item = new window.ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
    } catch (err) {
      console.error("Error copying image", err);
      setError("Could not copy image to clipboard.");
    } finally {
      setCopying(false);
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

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="bg-black text-white shadow-xl w-[80%] flex flex-col border border-[var(--border)] px-8 py-6"
        style={{ fontSize: "200%" }}
      >
        {/* MAIN ROW – stretch columns; height is now content-driven */}
        <div className="flex items-stretch justify-between gap-8">
          {/* LEFT COLUMN */}
          <div className="flex-1 flex flex-col gap-4">
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
                onClick={handleCopyImage}
                disabled={!imgDataUrl || copying}
                className="px-6 py-3 border border-[var(--border)] text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white hover:text-black transition"
              >
                {copying ? "Copying…" : "Copy image"}
              </button>
              <span className="text-sm text-[var(--muted)]">
                (then paste straight into X, Discord or anywhere else)
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-[var(--muted)]">
                …or share directly:
              </span>
              <div className="flex flex-wrap gap-3 text-base">
                {/* black background -> white on hover */}
                <button
                  type="button"
                  onClick={handleShareX}
                  className="flex items-center gap-2 px-5 py-3 border border-[var(--border)] bg-black text-white hover:bg-white hover:text-black transition text-lg font-semibold"
                >
                  <span className="text-2xl font-bold leading-none">𝕏</span>
                  <span>X</span>
                </button>

                {/* white background -> black on hover */}
                <button
                  type="button"
                  onClick={handleShareFacebook}
                  className="flex items-center gap-2 px-5 py-3 border border-[var(--border)] bg-white text-black hover:bg-black hover:text-white transition text-lg font-semibold"
                >
                  <span className="text-2xl font-bold leading-none">f</span>
                  <span>Facebook</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareLinkedIn}
                  className="flex items-center gap-2 px-5 py-3 border border-[var(--border)] bg-white text-black hover:bg-black hover:text-white transition text-lg font-semibold"
                >
                  <span className="text-xl font-bold leading-none">in</span>
                  <span>LinkedIn</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareReddit}
                  className="flex items-center gap-2 px-5 py-3 border border-[var(--border)] bg-white text-black hover:bg-black hover:text-white transition text-lg font-semibold"
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
                className="w-full px-6 py-3 bg-white text-black text-lg font-semibold hover:bg-black hover:text-white transition"
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
                  ? "Generating your share image…"
                  : "We’ll generate the image automatically once the chart is ready."}
              </div>
            )}
          </div>

          {/* MIDDLE: bigger preview */}
          <div className="flex-[1.4] flex items-center justify-center">
            <div className="border border-[var(--border)] bg-white max-w-full overflow-hidden flex items-center justify-center">
              {imgDataUrl ? (
                <img
                  src={imgDataUrl}
                  alt="Share preview"
                  className="h-[360px] w-auto"
                />
              ) : (
                <div className="h-[360px] w-[560px] flex items-center justify-center text-base text-black">
                  Preparing preview…
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: top buttons + bottom-anchored Try pilot */}
          <div className="flex flex-col justify-between items-stretch text-base">
            <div className="flex flex-col items-stretch gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 border border-[var(--border)] hover:bg-white hover:text-black transition text-lg font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!imgDataUrl}
                className="px-5 py-3 border border-[var(--border)] bg-white text-black hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition text-lg font-semibold"
              >
                Download PNG
              </button>
            </div>

            <Link
              href="/btcetf"
              className="mt-6 inline-flex items-center justify-center px-5 py-3 text-lg font-semibold bg-blue-600 text-white hover:bg-blue-500 transition no-underline"
            >
              Try pilot BTCETF on testnet
            </Link>
          </div>
        </div>

        {/* HIDDEN LIVE CARD (HTML) – captured at 1200×675 */}
        {open && (!imgDataUrl || generating) && (
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
                <div className="flex flex-col items-center justify-between">
                  <div className="flex items-center justify-center">
                    <img
                      src="/logos/stilllogo.png"
                      alt="stillwater logo"
                      className="w-[220px] h-[220px] object-contain"
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https%3A%2F%2Fstilletf.com"
                      alt="stilletf.com QR"
                      className="w-[220px] h-[220px]"
                    />
                    <span className="mt-2 text-[11px] text-slate-500">
                      stilletf.com
                    </span>
                  </div>
                </div>

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
                    <span className="font-bold">stilletf.com</span> — can you
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
