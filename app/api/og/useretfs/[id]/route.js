// app/api/og/useretfs/[id]/route.js
import { ImageResponse } from "next/og";

// Try without forcing edge runtime first – Railway/your config
// might not like edge on this route.
// export const runtime = "edge";
export const contentType = "image/png";

export async function GET(req, { params }) {
  const { id } = params ?? {};

  // Guard: if anything is weird, still return an image
  const safeId = typeof id === "string" ? id : "unknown";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#020617",
          color: "white",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 20 }}>STILL ETF</div>
        <div style={{ fontSize: 26, opacity: 0.9, marginBottom: 10 }}>
          User-created portfolio on STILL
        </div>
        <div style={{ fontSize: 20, opacity: 0.7 }}>
          Portfolio ID: {safeId}
        </div>
        <div style={{ marginTop: 40, fontSize: 18, opacity: 0.7 }}>
          I created this portfolio on{" "}
          <span style={{ fontWeight: 600 }}>stilletf.com</span> — can you do
          better?
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
