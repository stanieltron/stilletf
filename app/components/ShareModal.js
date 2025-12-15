"use client";

import { useEffect, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";
import ChartBuilder from "./ChartBuilder";
import MetricsBuilder from "./MetricsBuilder";
import { useRouter } from "next/navigation";

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
  const [isMobile, setIsMobile] = useState(false);

  const shareUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://sonaetf.com";
  const shareText = "I created this portfolio on Sona — can you do better?";

  const shareHost = (() => {
    try {
      return new URL(shareUrl).hostname.replace(/^www\./, "");
    } catch {
      return "sonaetf.com";
    }
  })();

  const shareQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    shareUrl
  )}`;

  const router = useRouter();

  function openSignIn() {
    const base = typeof window !== "undefined" ? window.location.pathname : "/";
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    params.set("auth", "1");
    params.set("share", "1");
    params.set("shareAuth", "1");
    router.push(`${base}?${params.toString()}#builder`, { scroll: false });
  }

  useEffect(() => {
    setChartReady(false);
    setGenerating(false);
    setImgDataUrl(null);
    setError(null);
    setSharing(false);
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

  const handleDownload = () => {
    if (!imgDataUrl) return;
    const a = document.createElement("a");
    a.href = imgDataUrl;
    a.download = "portfolio-share.png";
    a.click();
  };

  const handleShareNative = async () => {
    if (!imgDataUrl) return;
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
      const res = await fetch(imgDataUrl);
      const blob = await res.blob();
      const file = new File([blob], "portfolio-share.png", {
        type: blob.type || "image/png",
      });

      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        setError("This device/browser cannot share images via the native sheet.");
        return;
      }

      await navigator.share({
        files: [file],
        text: shareText,
        title: "My portfolio",
      });
    } catch (err) {
      console.error("Error sharing image", err);
      setError("Could not open the share sheet.");
    } finally {
      setSharing(false);
    }
  };

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
      style={{ width: "1200px", height: "675px", boxSizing: "border-box" }}
    >
      <div
        className="w-full h-full grid"
        style={{
          gridTemplateColumns: "repeat(4, 300px)",
          gridTemplateRows: "300px 75px 300px",
        }}
      >
        <div className="flex items-center justify-center" style={{ padding: 10 }}>
          <div className="flex items-center justify-center w-full h-full bg-white">
            <img
              src="/logos/stilllogo.png"
              alt="Sona logo"
              className="w-full h-full object-contain"
            />
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
            {shareText.replace(" — ", " ")}
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
  );

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 sm:px-4">
      <div
        className="bg-black text-white shadow-xl w-full flex flex-col border border-[var(--border)] overflow-y-auto"
        style={{
          fontSize: "clamp(0.95rem, 1.6vw, 1.1rem)",
          maxWidth: 560,
          maxHeight: "90vh",
        }}
      >
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl sm:text-3xl font-semibold leading-snug m-0">
              Share your portfolio
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="cta-btn cta-white"
              aria-label="Close"
              title="Close"
              style={{ height: "40px", minHeight: "40px", width: "40px", padding: 0 }}
            >
              X
            </button>
          </div>
        </div>

        <div className="px-4 pb-4 pt-5 flex flex-col items-center gap-4">
          <div
            className="border border-[var(--border)] bg-white overflow-hidden flex items-center justify-center w-full"
            style={{ aspectRatio: "16 / 9" }}
          >
            {imgDataUrl ? (
              <img
                src={imgDataUrl}
                alt="Share preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-base text-black px-4 text-center">
                {error ? "Could not generate preview." : "Preparing preview..."}
              </div>
            )}
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={handleShareNative}
              disabled={!imgDataUrl || sharing}
              className="cta-btn cta-black w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sharing ? "Opening share..." : "Share"}
            </button>
          ) : (
            <div className="w-full flex gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!imgDataUrl}
                className="cta-btn cta-black flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Download
              </button>
              <button
                type="button"
                onClick={openSignIn}
                className="cta-btn cta-btn-sm cta-grey flex-1 opacity-60"
                aria-label="Share on X (sign in required)"
                title="Share on X (sign in required)"
              >
                X
              </button>
              <button
                type="button"
                onClick={openSignIn}
                className="cta-btn cta-btn-sm cta-grey flex-1 opacity-60"
                aria-label="Share on Facebook (sign in required)"
                title="Share on Facebook (sign in required)"
              >
                Facebook
              </button>
            </div>
          )}

          {!!error && (
            <div className="text-sm text-red-400 w-full">{error}</div>
          )}
          {!imgDataUrl && !error && (
            <div className="text-sm text-[var(--muted)] w-full">
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
