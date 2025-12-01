import { ImageResponse } from "next/og";

export const contentType = "image/png";

export async function GET(req, { params }) {
  const id = params?.id ?? "unknown";
  const url = new URL(req.url);
  const origin = url.origin;

  let title = "STILL ETF portfolio";
  let description = "User-created ETF portfolio on STILL.";
  let entries = [];

  try {
    // This mirrors what your page.js does, but in the OG route
    const res = await fetch(`${origin}/api/portfolios/${id}`, {
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      const p = data?.portfolio || {};

      if (p.nickname) title = p.nickname;
      if (p.comment) description = p.comment;

      // Adapt these to your actual portfolio shape
      const assets = Array.isArray(p.assets) ? p.assets : [];
      const weights = Array.isArray(p.weights) ? p.weights : [];

      for (let i = 0; i < Math.min(assets.length, weights.length); i++) {
        const symbol = String(assets[i] || "").toUpperCase();
        const w = Number(weights[i] || 0);
        entries.push({ symbol, weight: w });
      }

      entries.sort((a, b) => b.weight - a.weight);
      entries = entries.slice(0, 6);
    }
  } catch (e) {
    console.error("OG useretfs fetch error:", e);
    // Non-fatal: we still render a default card below
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 675,
          boxSizing: "border-box",
          padding: 40,
          backgroundColor: "#ffffff",
          display: "flex",              // NO GRID
          flexDirection: "row",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: "#000000",
        }}
      >
        {/* LEFT COLUMN: logo “block” */}
        <div
          style={{
            width: 260,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            marginRight: 40,
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

          {/* Simple “QR card” block instead of remote QR fetch */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                color: "#64748b",
              }}
            >
              stilletf.com
            </div>
            <span
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "#64748b",
              }}
            >
              stilletf.com
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* “Chart” area */}
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

            {/* Bars to mimic ChartBuilder allocations */}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                // gap not strictly required, we can simulate with margins
              }}
            >
              {entries.length === 0 ? (
                <div style={{ fontSize: 14, opacity: 0.8 }}>
                  No positions yet
                </div>
              ) : (
                entries.map((a, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontSize: 14,
                      marginTop: idx === 0 ? 0 : 6,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: "#e5e7eb",
                        marginRight: 8,
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
                        marginLeft: 8,
                        marginRight: 8,
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

          {/* Tagline – same text as in ShareModal hidden card */}
          <p
            style={{
              marginTop: 40,
              marginBottom: 24,
              textAlign: "center",
              fontSize: 22,
              fontWeight: 600,
              lineHeight: 1.3,
              color: "#000000",
            }}
          >
            I created this portfolio on{" "}
            <span style={{ fontWeight: 700 }}>stilletf.com</span> — can you
            do better?
          </p>

          {/* “Metrics” chips – similar spirit to MetricsBuilder */}
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
            {entries.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  // again, can just use margins
                }}
              >
                {entries.map((a, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                      marginRight: 8,
                      marginBottom: 8,
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
    { width: 1200, height: 675 }
  );
}
