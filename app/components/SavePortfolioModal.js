"use client";

import { useMemo, useState, useEffect } from "react";
import ChartBuilder from "./ChartBuilder";
import MetricsBuilder from "./MetricsBuilder";

/**
 * Props:
 * - open, onClose
 * - onSave: async ({ comment }) => { id, url? }
 * - assets, weights
 * - userDisplay
 * - assetMeta: { [key]: { name, color } }
 */
export default function SavePortfolioModal({
  open,
  onClose,
  onSave,
  assets = [],
  weights = [],
  userDisplay = "",
  assetMeta = {},
}) {
  const [comment, setComment] = useState("");
  const [step, setStep] = useState("form"); // 'form' | 'share'
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null); // { id, url }
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (open) {
      setStep("form");
      setSaving(false);
      setSaved(null);
      setShareUrl("");
      setComment("");
    }
  }, [open]);

  const normalized = useMemo(() => {
    const s = (weights || []).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return s > 0 ? weights.map((w) => w / s) : assets.map(() => 0);
  }, [assets, weights]);

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

  async function handleSave() {
    try {
      setSaving(true);
      const result = await onSave({ comment });
      const id = result?.id;
      const url =
        result?.url ||
        (typeof window !== "undefined"
          ? `${window.location.origin}/useretfs/${id}`
          : `/useretfs/${id}`);
      setSaved({ id, url });
      setShareUrl(url);
      setStep("share");
    } catch (e) {
      alert(e?.message || "Could not save portfolio.");
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    try {
      navigator.clipboard.writeText(shareUrl);
      alert("Link copied!");
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  }

  if (!open) return null;

  /* ---------- Step 1: Save form ---------- */
  if (step === "form") {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true">
        {/* add 'spm' class to scope all modal styles */}
        <div className="modal-card spm">
          <div className="modal-header">
            <h3 className="mt-0">Save portfolio</h3>
            <button className="btn-step" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <div className="modal-section">
            <div className="metric-label">Signed in as: <span className="strong">{userDisplay || "Unknown user"}</span></div>
            <label className="metric-label mt-8" htmlFor="saveComment">Comment (optional)</label>
            <textarea
              id="saveComment"
              className="input"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Why did you build this portfolio?"
              style={{ resize: "vertical" }}
            />
          </div>

          <div className="modal-grid">
            <div className="card modal-subcard">
              <h4 className="mt-0">Preview</h4>
              {/* scoped chart container */}
              <div className="spm-chart">
                <ChartBuilder assets={assets} weights={weights} showYield={true} />
              </div>
            </div>

            <div className="card modal-subcard">
              <h4 className="mt-0">Metrics</h4>
              <div className="modal-metrics-wrap">
                <MetricsBuilder assets={assets} weights={weights} showYield={true} />
              </div>
            </div>
          </div>

          <div className="card modal-subcard">
            <h4 className="mt-0">Composition</h4>
            <div className="metric-label" style={{ lineHeight: 1.5 }}>
              {composition.length
                ? composition.map((p, i) => (
                    <span key={p.key} style={{ color: p.color }}>
                      {i ? <span style={{ color: "var(--muted)" }}>, </span> : null}
                      {p.label}:{p.w}
                    </span>
                  ))
                : "No positions"}
            </div>
            <div className="metric-label mt-8">
              Normalized: {normalized.map((p) => (p * 100).toFixed(1)).join("% / ")}%
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn-step" onClick={onClose}>Cancel</button>
            <button className="btn-step" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save portfolio"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Step 2: Saved → Share ---------- */
  const prefilled =
    `Check out my ETF portfolio built on Digital Wealth — ` +
    composition.map(c => `${c.label}:${c.w}`).join(", ") +
    ` ${shareUrl}`;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(prefilled)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent("My custom ETF portfolio")}`;
  const farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(prefilled)}&embeds[]=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card spm">
        <div className="modal-header">
          <h3 className="mt-0">Saved! Share your portfolio</h3>
          <button className="btn-step" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-grid">
          <div className="card modal-subcard">
            <h4 className="mt-0">Preview</h4>
            <div className="spm-chart">
              <ChartBuilder assets={assets} weights={weights} showYield={true} />
            </div>
            <div className="metric-label mt-8" style={{ lineHeight: 1.5 }}>
              {composition.length
                ? composition.map((p, i) => (
                    <span key={p.key} style={{ color: p.color }}>
                      {i ? <span style={{ color: "var(--muted)" }}>, </span> : null}
                      {p.label}:{p.w}
                    </span>
                  ))
                : "No positions"}
            </div>
          </div>

          <div className="card modal-subcard">
            <h4 className="mt-0">Metrics</h4>
            <div className="modal-metrics-wrap">
              <MetricsBuilder assets={assets} weights={weights} showYield={true} />
            </div>
            <div className="metric-label mt-12">
              <span className="strong">Your comment:&nbsp;</span>
              {comment ? comment : <span style={{ color: "var(--muted)" }}>No comment</span>}
            </div>
          </div>
        </div>

        <div className="modal-section">
          <div className="metric-label">Share link</div>
          <div className="grid-2" style={{ alignItems: "center" }}>
            <input className="input" value={shareUrl} readOnly />
            <button className="btn-step" onClick={copyLink}>Copy link</button>
          </div>

          <div className="metric-label mt-12">Share to socials</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="btn-step" href={twitterUrl} target="_blank" rel="noreferrer">Share on X</a>
            <a className="btn-step" href={farcasterUrl} target="_blank" rel="noreferrer">Share on Farcaster</a>
            <a className="btn-step" href={linkedinUrl} target="_blank" rel="noreferrer">Share on LinkedIn</a>
            <a className="btn-step" href={redditUrl} target="_blank" rel="noreferrer">Share on Reddit</a>
          </div>
        </div>

        <div className="modal-actions">
          <a className="btn-step" href={shareUrl}>View portfolio</a>
          <button className="btn-step" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
