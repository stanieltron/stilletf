"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as htmlToImage from "html-to-image";
import ChartBuilder from "./ChartBuilder";
import MetricsBuilder from "./MetricsBuilder";

export default function ShareModalSignedIn({
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
  const [metricsReady, setMetricsReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imgDataUrl, setImgDataUrl] = useState(null);
  const [error, setError] = useState(null);
  const [copying, setCopying] = useState(false);

  const shareText =
    "I created this portfolio on stilletf.com - can you do better?";
  const shareUrl = "https://stilletf.com";
  const showYieldLine = typeof showYield === "boolean" ? showYield : true;

  const numericWeights = useMemo(
    () =>
      (weights || []).map((w) =>
        Number.isFinite(Number(w)) ? Number(w) : 0
      ),
    [weights]
  );
  const captureAssets = useMemo(
    () => (Array.isArray(assets) ? assets : []),
    [assets]
  );
  const hasData =
    captureAssets.length > 0 &&
    captureAssets.length === numericWeights.length &&
    numericWeights.some((w) => Number(w) > 0);
  const dataKey = useMemo(
    () => `${captureAssets.join(",")}||${numericWeights.join(",")}`,
    [captureAssets, numericWeights]
  );

  useEffect(() => {
    setChartReady(false);
    setMetricsReady(false);
    setGenerating(false);
    setImgDataUrl(null);
    setError(null);
    setCopying(false);
  }, [open, dataKey]);

  const handleCaptureChartReady = useCallback(() => setChartReady(true), []);
  const handleMetricsReady = useCallback(() => setMetricsReady(true), []);

  const CaptureGrid = ({ attachRef, onReady }) => (
    <>
      {hasData && (
        <div
          key={dataKey}
          ref={attachRef ? captureRef : undefined}
          className="capture-frame"
          style={{ background: "#fff" }}
        >
          <div className="capture-cell capture-logo">
            <img
              src="/logos/stilllogo.png"
              alt="Stillwater logo"
              className="capture-logo-img"
            />
          </div>

          <div className="capture-cell capture-chart">
            <div className="capture-chart-inner">
              <ChartBuilder
                assets={captureAssets}
                weights={numericWeights}
                assetMeta={assetMeta}
                showYield={showYieldLine}
                animated={false}
                yieldOnly={false}
                legendOff={true}
                onReady={onReady}
              />
            </div>
          </div>

          <div className="capture-cell capture-text">
            <span>
              I created this portfolio on <strong>stilletf.com</strong> - can you do
              better?
            </span>
          </div>

          <div className="capture-cell capture-qr">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=https%3A%2F%2Fstilletf.com"
              alt="stilletf.com QR"
              className="capture-qr-img"
            />
          </div>

          <div className="capture-cell capture-metrics">
            <div className="capture-metrics-inner">
              <MetricsBuilder
                assets={captureAssets}
                weights={numericWeights}
                showYield={showYieldLine}
                assetMeta={assetMeta}
                onReady={handleMetricsReady}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );

  const doCapture = async () => {
    if (!captureRef.current) return;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const dataUrl = await htmlToImage.toPng(captureRef.current, {
      width: 1200,
      height: 675,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      useCors: true,
    });
    setImgDataUrl(dataUrl);
  };

  const ensureReadyAndCapture = async () => {
    if (!captureRef.current) return;
    setGenerating(true);
    setError(null);
    try {
      await new Promise((res) => setTimeout(res, 150));
      await doCapture();
    } catch (e) {
      setError("Something went wrong while generating the image.");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (open && hasData && chartReady && metricsReady && !imgDataUrl && !generating) {
      ensureReadyAndCapture();
    }
  }, [open, hasData, chartReady, metricsReady, imgDataUrl, generating]);

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
    } catch (e) {
      setError("Could not copy image to clipboard.");
    } finally {
      setCopying(false);
    }
  };

  const openShareWindow = (url) => {
    if (typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareX = () =>
    openShareWindow(
      `https://x.com/intent/post?text=${encodeURIComponent(
        `${shareText} ${shareUrl}`
      )}`
    );
  const handleShareLinkedIn = () =>
    openShareWindow(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        shareUrl
      )}`
    );

  if (!open) return null;

  return (
    <section className="share-overlay">
      <div
        className="share-dialog"
        style={{ gridTemplateColumns: "1fr", alignItems: "flex-start" }}
      >
        <div className="share-column" style={{ gap: 18, textAlign: "center", alignItems: "center" }}>
          <div className="share-column" style={{ alignItems: "center" }}>
            <h2 className="share-title" style={{ textAlign: "center" }}>Share your portfolio in one click</h2>
            <p className="share-subtext" style={{ textAlign: "center" }}>
              Copy the image and paste it straight into a post.
            </p>
          </div>

          <div className="share-actions">
            <button
              type="button"
              onClick={handleCopyImage}
              disabled={!imgDataUrl || copying}
              className="btn btn-outline btn-light"
              style={{ width: "100%", justifyContent: "center" }}
            >
              {copying ? "Copying..." : "Copy image"}
            </button>
          </div>

          <div className="share-column" style={{ alignItems: "center" }}>
            <span
              className="share-inline-note"
              style={{ textAlign: "center", fontSize: "0.98rem" }}
            >
              and share (just paste) on:
            </span>
            <div
              className="share-button-row"
              style={{ width: "100%", justifyContent: "stretch" }}
            >
              <button
                type="button"
                onClick={handleShareX}
                className="btn btn-outline btn-dark"
                style={{ flex: 1 }}
              >
                X
              </button>
              <button
                type="button"
                onClick={handleShareLinkedIn}
                className="btn btn-outline btn-light"
                style={{ flex: 1 }}
              >
                LinkedIn
              </button>
            </div>
          </div>

          <div className="share-column share-preview-col">
            <div
              className="share-preview-frame"
              style={{ maxWidth: 1200, width: "100%", padding: 18 }}
            >
              {imgDataUrl ? (
                <img src={imgDataUrl} alt="Share preview" className="share-preview-img" />
              ) : (
                <div className="share-preview-placeholder">Preparing preview...</div>
              )}
            </div>
          </div>

          <div
            className="share-actions-right"
            style={{
              alignItems: "center",
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={handleDownload}
              disabled={!imgDataUrl}
              className="btn btn-outline btn-light"
              style={{ flex: 1 }}
            >
              Download PNG
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline btn-dark"
              style={{ flex: 1 }}
            >
              Close
            </button>
          </div>

          {error && <div className="share-error">{error}</div>}
          {!imgDataUrl && !error && (
            <div className="share-status">
              {generating
                ? "Generating your share image..."
                : "We'll generate the image once the chart is ready."}
            </div>
          )}
        </div>
      </div>

      {open && hasData && (!imgDataUrl || generating) && (
        <div className="capture-offscreen">
          <CaptureGrid attachRef onReady={handleCaptureChartReady} />
        </div>
      )}

    </section>
  );
}
