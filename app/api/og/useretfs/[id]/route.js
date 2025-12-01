// app/api/og/useretfs/[id]/route.js
import { ImageResponse } from "next/og";

export const runtime = "edge";        // OG routes usually run on the edge
export const contentType = "image/png";

export async function GET(req, { params }) {
  const { id } = params;

  const { origin } = new URL(req.url);

  let title = "STILL ETF portfolio";
  let description = "User-created ETF portfolio on STILL.";
  let assets = [];
  let weights = [];

  try {
    // Reuse your existing portfolio API
    const res = await fetch(`${origin}/api/portfolios/${id}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const p = data?.portfolio || {};

      if (p.nickname) title = p.nickname;
      if (p.comment) description = p.comment;

      assets = Array.isArray(p.assets) ? p.assets : [];
      weights = Array.isArray(p.weights) ? p.weights : [];
    }
  } catch (e) {
    console.error("OG useretfs fetch error:", e);
  }

  // Build a simple “metrics” summary from assets + weights,
  // similar spirit to MetricsBuilder output.
  const assetEntries = [];
  const len = Math.min(assets.length, weights.length);
  for (let i = 0; i < len; i++) {
    const symbol = String(assets[i] || "").toUpperCase();
    const w = Number(weights[i] || 0);
    assetEntries.push({ symbol, weight: w });
  }

  // Sort by weight desc, show top N
  assetEntries.sort((a, b) => b.weight - a.weight);
  const topAssets = assetEntries.slice(0, 6);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 675,
          boxSizing: "border-box",
          padding: 40,
          backgroundColor: "#ffffff",
          display: "grid",
          gridTemplateColumns: "260px minmax(0, 1fr)",
          columnGap: 40,
          rowGap: 64,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: "#000000",
        }}
      >
        {/* LEFT COLUMN – matches ShareModal hidden card layout */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={`${origin}/logos/stilllogo.png`}
              alt="STILL logo"
              width={220}
              height={220}
              style={{ objectFit: "contain" }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https%3A%2F%2Fstilletf.com"
              alt="stilletf.com QR"
              width={220}
              height={220}
            />
            <span
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "#64748b", // slate-500
              }}
            >
              stilletf.com
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN – chart + tagline + “metrics” */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* “Chart area” – we can’t render ChartBuilder here, so show a stylised block */}
          <div
            style={{
              width: "100%",
              height: 260,
              borderRadius: 16,
              border: "1px solid #0f172a",
              padding: 20,
              boxSizing: "border-box",
              background:
                "linear-gradient(135deg, #020617, #0f172a, #1e293b)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              color: "white",
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 16,
                opacity: 0.9,
                maxWidth: 640,
              }}
            >
              {description}
            </div>

            {/* Fake bars to mimic chart + show top allocations */}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {topAssets.length === 0 ? (
                <div style={{ fontSize: 14, opacity: 0.8 }}>
                  No positions yet
                </div>
              ) : (
                topAssets.map((a, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: "#e5e7eb",
                      }}
                    />
                    <span style={{ minWidth: 70 }}>{a.symbol}</span>
                    <div
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: "#e5e7eb",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(
                            5,
                            Math.min(100, a.weight)
                          )}%`,
                          height: "100%",
                          borderRadius: 999,
                          background:
                            "linear-gradient(90deg, #22c55e, #eab308)",
                        }}
                      />
                    </div>
                    <span style={{ minWidth: 60, textAlign: "right" }}>
                      {a.weight.toFixed(1)}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tagline – straight from ShareModal hidden card */}
          <p
            style={{
              marginTop: 40,
              marginBottom: 24,
              textAlign: "center",
              fontSize: 22,
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            I created this portfolio on{" "}
            <span style={{ fontWeight: 700 }}>stilletf.com</span> — can you
            do better?
          </p>

          {/* “Metrics” area (simplified MetricsBuilder vibe) */}
          <div
            style={{
              flex: 1,
              minHeight: 160,
              fontSize: 14,
              color: "#0f172a",
              borderTop: "1px solid #e5e7eb",
              paddingTop: 12,
            }}
          >
            {topAssets.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {topAssets.map((a, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                    }}
                  >
                    {a.symbol} · {a.weight.toFixed(1)}%
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>No metrics available yet.</div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 675,
    }
  );
}
