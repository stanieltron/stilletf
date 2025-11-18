"use client";

import { useMemo, useState, useEffect } from "react";
import ChartBuilder from "./ChartBuilder";
import PortfolioBuilder from "./MetricsBuilder";

/**
 * Props:
 * - open, onClose
 * - onBack?: () => void
 * - onSave: async ({ comment }) => any
 * - assets, weights
 * - userDisplay
 * - assetMeta: { [key]: { name, color } }
 * - onSignIn?: () => void           // optional handler to open sign-in modal
 * - signInHref?: string             // optional fallback href for sign-in (default "#signin")
 */
export default function SavePortfolioModal({
  open,
  onClose,
  onBack,
  onSave,
  assets = [],
  weights = [],
  userDisplay = "",
  assetMeta = {},
  onSignIn,
  signInHref = "#signin",
}) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset modal state on open
  useEffect(() => {
    if (open) {
      setSaving(false);
      setComment("");
    }
  }, [open]);

  const isSignedIn = !!userDisplay;

  const composition = useMemo(() => {
    const parts = [];
    for (let i = 0; i < Math.min(assets.length, weights.length); i++) {
      const w = Number(weights[i] || 0);
      if (w <= 0) continue;
      const key = assets[i];
      const label = assetMeta?.[key]?.name || key;
      const color = assetMeta?.[key]?.color || "inherit";
      parts.push({ key, label, color, w });
    }
    return parts;
  }, [assets, weights, assetMeta]);

  function handleSignIn() {
    if (onSignIn) {
      onSignIn();
      return;
    }
    if (typeof window !== "undefined" && signInHref) {
      window.location.href = signInHref;
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      await onSave({ comment });
      if (onClose) onClose();
    } catch (e) {
      alert(e?.message || "Could not save portfolio.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrimaryAction() {
    if (!isSignedIn) {
      handleSignIn();
      return;
    }
    await handleSave();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[rgba(0,0,0,.5)]"
      role="dialog"
      aria-modal="true"
    >
      {/* add 'spm' class to scope all modal styles */}
      <div className="spm bg-white border border-[var(--border)] w-full max-h-[90vh] overflow-auto p-6 flex flex-col gap-6 [width:min(100%,1120px)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mt-0 mb-1">
              Share your portfolio
            </h2>
            <p className="text-sm leading-snug text-[var(--muted)] max-w-3xl">
              Share this ETF-style crypto portfolio, explain why it wins, and
              start a friendly on-chain battle over who can design the best mix.
              Every action here can unlock more future rewards.
            </p>
            <div className="mt-3 text-xs text-[var(--muted)]">
              {isSignedIn ? (
                <>
                  Signed in as{" "}
                  <span className="font-semibold text-[var(--text)]">
                    {userDisplay}
                  </span>
                  . Saving this portfolio lets you collect votes, build
                  reputation and qualify for future reward drops.
                </>
              ) : (
                <>
                  <span className="font-semibold text-[var(--text)]">
                    Not signed in.
                  </span>{" "}
                  Sign in to join the waiting list, save this portfolio and
                  start collecting votes on-chain.
                </>
              )}
            </div>
          </div>
          <button
            className="border border-[var(--border)] bg-white px-2.5 py-1.5 font-bold cursor-pointer leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Thesis textarea */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] mb-2">
            Explain why this portfolio is the best
          </div>
          <textarea
            id="saveComment"
            className="w-full p-3 border border-[var(--border)] text-sm md:text-base leading-snug"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Describe your thesis. Why did you choose this composition? What edge does it have vs. other portfolios?"
            style={{ resize: "vertical" }}
          />
        </div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* LEFT: Share & actions */}
          <div className="border border-[var(--border)] p-4 flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-semibold mt-0 mb-1">
                Share &amp; challenge others
              </h3>
              <p className="text-xs md:text-sm text-[var(--muted)] max-w-xl">
                Share this portfolio on your favorite social platforms with a
                pre-filled message. The shared link can include a generated
                preview image with your chart, key metrics, composition and
                explanation, so others see exactly how you built it.
              </p>
            </div>

            {/* Social buttons */}
            <div className="flex flex-wrap gap-3">
              <button className="flex items-center gap-2 border border-[var(--border)] px-4 py-3 text-xs md:text-sm font-semibold uppercase tracking-wide cursor-pointer">
                <span className="text-xl leading-none">𝕏</span>
                <span>Share on X</span>
              </button>
              <button className="flex items-center gap-2 border border-[var(--border)] px-4 py-3 text-xs md:text-sm font-semibold uppercase tracking-wide cursor-pointer">
                <span className="text-xl leading-none">✈️</span>
                <span>Share on Telegram</span>
              </button>
              <button className="flex items-center gap-2 border border-[var(--border)] px-4 py-3 text-xs md:text-sm font-semibold uppercase tracking-wide cursor-pointer">
                <span className="text-xl leading-none">in</span>
                <span>Share on LinkedIn</span>
              </button>
              <button className="flex items-center gap-2 border border-[var(--border)] px-4 py-3 text-xs md:text-sm font-semibold uppercase tracking-wide cursor-pointer">
                <span className="text-xl leading-none">👽</span>
                <span>Share on Reddit</span>
              </button>
              <button className="flex items-center gap-2 border border-[var(--border)] px-4 py-3 text-xs md:text-sm font-semibold uppercase tracking-wide cursor-pointer">
                <span className="text-xl leading-none">🔗</span>
                <span>Copy share link</span>
              </button>
            </div>

            {/* Share preview explanation + image stub */}
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] items-stretch">
              <div className="text-[11px] md:text-xs text-[var(--muted)] leading-relaxed">
                When you share, your post can include:
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  <li>
                    A generated image showing this performance chart and key
                    portfolio metrics.
                  </li>
                  <li>
                    A short description starting with{" "}
                    <span className="italic">
                      “I built this ETF-style crypto portfolio on STILL…”
                    </span>
                  </li>
                  <li>
                    A live link to{" "}
                    <span className="font-semibold">
                      http://localhost:3000
                    </span>{" "}
                    so others can open the builder and tweak your mix.
                  </li>
                </ul>
              </div>
              <div className="border border-dashed border-[var(--border)] flex items-center justify-center text-[10px] md:text-xs text-[var(--muted)] min-h-[96px]">
                Preview image of your chart, metrics &amp; composition will be
                generated for shared posts.
              </div>
            </div>

            {/* Rewards + CTAs */}
            <div className="border-t border-[var(--border)] pt-4 mt-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2">
                More actions. More future rewards.
              </div>
              <ul className="text-xs md:text-sm space-y-1 text-[var(--text)]">
                <li>
                  <span className="font-semibold">Share this mix</span> and tag
                  others to battle over whose portfolio performs best.
                </li>
                <li>
                  <span className="font-semibold">
                    {isSignedIn
                      ? "Save your portfolio to collect votes"
                      : "Sign in to save your portfolio"}
                  </span>{" "}
                  and climb on-chain leaderboards.
                </li>
                <li>
                  <span className="font-semibold">
                    Try the Pilot STILL BTC ETF on Sepolia
                  </span>{" "}
                  and experience the strategy live on testnet.
                </li>
                <li>
                  Every action adds to your on-chain reputation and can unlock
                  more rewards in future STILL campaigns.
                </li>
              </ul>

              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  className="border border-[var(--border)] px-4 py-3 text-xs md:text-sm font-semibold uppercase tracking-wide cursor-pointer"
                  onClick={handlePrimaryAction}
                  disabled={saving && isSignedIn}
                >
                  {isSignedIn
                    ? saving
                      ? "Saving…"
                      : "Save to get votes"
                    : "Sign in to save & get votes"}
                </button>
                <a
                  href="/btcetf"
                  className="inline-flex items-center justify-center px-4 py-3 text-xs md:text-sm font-semibold uppercase tracking-wide bg-black text-white"
                >
                  Pilot STILL BTC ETF on Sepolia
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT: Chart & metrics */}
          <div className="flex flex-col gap-4">
            <div className="border border-[var(--border)] p-4 flex flex-col gap-3">
              <h3 className="text-lg font-semibold mt-0 mb-1">
                Performance preview
              </h3>
              <div className="w-full h-[260px] flex flex-col min-h-[240px]">
                <ChartBuilder
                  assets={assets}
                  weights={weights}
                  showYield={true}
                />
              </div>
            </div>

            <div className="border border-[var(--border)] p-4 flex flex-col gap-3">
              <h3 className="text-lg font-semibold mt-0 mb-1">
                Portfolio metrics
              </h3>
              <div className="max-h-[360px] overflow-auto">
                <PortfolioBuilder
                  assets={assets}
                  weights={weights}
                  showYield={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Composition */}
        <div className="border border-[var(--border)] p-4">
          <h3 className="text-lg font-semibold mt-0 mb-3">Composition</h3>
          {composition.length ? (
            <div className="flex flex-wrap gap-4 text-sm md:text-base">
              {composition.map((p) => (
                <div key={p.key} className="min-w-[140px]">
                  <div
                    className="font-semibold text-sm md:text-base"
                    style={{ color: p.color }}
                  >
                    {p.label}
                  </div>
                  <div className="text-xs md:text-sm text-[var(--muted)]">
                    Weight: {p.w}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)]">No positions</div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-2">
          <button
            className="border border-[var(--border)] bg-white px-3 py-2 text-xs md:text-sm font-semibold cursor-pointer leading-none"
            onClick={onBack || onClose}
          >
            Back
          </button>
          <button
            className="border border-[var(--border)] bg-white px-3 py-2 text-xs md:text-sm font-semibold cursor-pointer leading-none disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handlePrimaryAction}
            disabled={saving && isSignedIn}
          >
            {isSignedIn
              ? saving
                ? "Saving…"
                : "Save to get votes"
              : "Sign in to save & get votes"}
          </button>
        </div>
      </div>
    </div>
  );
}
