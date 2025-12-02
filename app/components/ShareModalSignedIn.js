"use client";

import { useState, useEffect } from "react";
import ChartBuilder from "./ChartBuilder";
import MetricsBuilder from "./MetricsBuilder";
import Link from "next/link";

// Helper: generate a basic OG image on the client and upload it
async function generateAndUploadSimpleOgImage(portfolioId) {
  if (typeof document === "undefined") return false;

  console.log("[OG] generating simple image for portfolio", portfolioId);

  const width = 1200;
  const height = 675;
  const label = `ETF-${portfolioId}`;

  try {
    // Create an off-screen canvas
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("[OG] no canvas context");
      return false;
    }

    // Red background
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, width, height);

    // White centered text
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font =
      "bold 64px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(label, width / 2, height / 2);

    // Convert to PNG data URL
    const dataUrl = canvas.toDataURL("image/png");

    console.log("[OG] dataUrl length", dataUrl.length);

    // Send to server to store in DB
    const res = await fetch(`/api/portfolios/${portfolioId}/og-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl }),
    });

    console.log("[OG] upload response", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error("[OG] upload failed:", res.status, text);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[OG] error generating/uploading image", err);
    return false;
  }
}

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

  useEffect(() => {
    if (open) {
      setSaving(false);
      setError(null);
      setSaved(false);
      setShareUrl("");
    }
  }, [open]);

  if (!open) return null;

  const baseShareText =
    "I built this ETF-style crypto portfolio on STILL – can you beat it?";

  const fullShareText = shareUrl
    ? `${baseShareText}\n\n${shareUrl}`
    : baseShareText;

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

      console.log("[OG] saved portfolio", portfolio.id);

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const url = origin
        ? `${origin}/useretfs/${portfolio.id}`
        : `/useretfs/${portfolio.id}`;

      setShareUrl(url);
      setSaved(true);

      // 🔥 Generate simple OG image *right here* after Save
      const ok = await generateAndUploadSimpleOgImage(portfolio.id);
      if (!ok) {
        console.warn("[OG] generation/upload failed");
      } else {
        console.log("[OG] generation/upload succeeded");
      }
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
      "My ETF-style crypto portfolio on STILL"
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
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="bg-black text-white shadow-xl w-[80%] flex flex-col border border-[var(--border)] px-8 py-6"
        style={{ fontSize: "200%" }}
      >
        <div className="flex items-stretch justify-between gap-8">
          {/* LEFT COLUMN */}
          <div className="flex-1 flex flex-col gap-4">
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

            {/* PRE-SAVED STATE */}
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
                  className="px-6 py-3 border border-[var(--border)] bg-white text-black text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black hover:text-white transition"
                >
                  {saving ? "Saving…" : "Save portfolio"}
                </button>
              </div>
            )}

            {/* SAVED STATE */}
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
                    className="px-4 py-2 border border-[var(--border)] text-xs font-semibold uppercase tracking-wide hover:bg-white hover:text-black transition bg-white text-black"
                  >
                    Copy link
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 text-base">
                  <button
                    type="button"
                    onClick={handleShareX}
                    className="flex items-center gap-2 px-5 py-3 border border-[var(--border)] bg-black text-white hover:bg-white hover:text-black transition text-lg font-semibold"
                  >
                    <span className="text-2xl font-bold leading-none">𝕏</span>
                    <span>Share on X</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareTelegram}
                    className="flex items-center gap-2 px-5 py-3 border border-[var(--border)] bg-white text-black hover:bg-black hover:text-white transition text-lg font-semibold">
                    <span className="text-xl leading-none">✈️</span>
                    <span>Telegram</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareLinkedIn}
                    className="flex items-center gap-2 px-5 py-3 border border-[var(--border)] bg-white text-black hover:bg-black hover:text-white transition text-lg font-semibold">
                    <span className="text-xl font-bold leading-none">in</span>
                    <span>LinkedIn</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareReddit}
                    className="flex items-center gap-2 px-5 py-3 border border-[var(--border)] bg-white text-black hover:bg-black hover:text-white transition text-lg font-semibold">
                    <span className="text-2xl font-bold leading-none">r</span>
                    <span>Reddit</span>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="text-base text-red-500 mt-2">{error}</div>
            )}
          </div>

          {/* MIDDLE: chart + metrics */}
          <div className="flex-[1.4] flex flex-col gap-4">
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
          <div className="flex flex-col justify-between items-stretch text-base w-[260px] shrink-0">
            <div className="flex flex-col items-stretch gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 border border-[var(--border)] hover:bg-white hover:text-black transition text-lg font-semibold"
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
                className="inline-flex items-center justify-center px-5 py-3 text-lg font-semibold bg-blue-600 text-white hover:bg-blue-500 transition no-underline"
              >
                Try pilot BTCETF on testnet
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
