
import { ImageResponse } from "next/og";

export const contentType = "image/png";

export async function GET(req, { params }) {
  const id = params?.id ?? "unknown";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          color: "white",
          fontSize: 40,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        STILL ETF – {id}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
