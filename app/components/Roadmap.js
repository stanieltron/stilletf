"use client";

export default function Roadmap() {
  return (
    <section className="section-compact">
      <div className="container-main">
        <div className="eyebrow" style={{ color: "var(--muted)" }}>
          Product Roadmap
        </div>

        {/* Roadmap stage area */}
        <div style={{ padding: "56px 0" }}>
          <div style={{ position: "relative", width: "100%" }}>
            {/* Keep the square aspect ratio */}
            <div
              style={{
                position: "relative",
                width: "100%",
                paddingBottom: "100%",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  isolation: "isolate",
                }}
              >
                {/* Diagonal line (desktop) */}
                <svg
                  className="roadmap-line-desktop"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M 0 0 L 100 100"
                    stroke="#2563eb"
                    strokeWidth="8"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                  />
                </svg>

                {/* Vertical guide (mobile) */}
                <svg
                  className="roadmap-line-mobile"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M 50 0 L 50 100"
                    stroke="#2563eb"
                    strokeWidth="4"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                  />
                </svg>

                {/* === Desktop cards === */}
                <div className="roadmap-desktop">
                  {/* 1) Top-left */}
                  <div className="roadmap-node tl">
                    <div className="card-strong roadmap-card">
                      <div className="card-overlay" />
                      <span className="badge" style={{ background: "var(--accent)" }}>
                        The Pilot
                      </span>
                      <h3 className="heading-3">BTC Fund</h3>
                      <p className="text-body-muted break-words">
                        Pure Bitcoin exposure with transparent mechanics.
                      </p>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <button className="btn btn-primary">Try now for future rewards →</button>
                    </div>
                  </div>

                  {/* 2) Center */}
                  <div className="roadmap-node center">
                    <div className="card-strong roadmap-card">
                      <div className="card-overlay" />
                      <span className="badge" style={{ background: "#000" }}>
                        The Flagship
                      </span>
                      <h3 className="heading-3">Wealth Fund</h3>
                      <p className="text-body-muted break-words">
                        Balanced growth &amp; defense: BTC + S&amp;P 500 + Gold + T-Bills.
                      </p>
                    </div>
                  </div>

                  {/* 3) Bottom-right */}
                  <div className="roadmap-node br">
                    <div className="card-strong roadmap-card">
                      <div className="card-overlay" />
                      <span className="badge" style={{ background: "#000" }}>
                        The Crypto
                      </span>
                      <h3 className="heading-3">3crypto</h3>
                      <p className="text-body-muted break-words">
                        Focused crypto basket for higher-beta participation.
                      </p>
                    </div>
                  </div>
                </div>

                {/* === Mobile stacked cards === */}
                <div className="roadmap-mobile">
                  <div className="card-strong">
                    <span className="badge" style={{ background: "var(--accent)" }}>
                      The Pilot
                    </span>
                    <h3 className="heading-3">BTC Fund</h3>
                    <p className="text-body-muted">
                      Pure Bitcoin exposure with transparent mechanics.
                    </p>
                    <button className="btn btn-primary" style={{ marginTop: 16 }}>
                      Try now for future rewards →
                    </button>
                  </div>

                  <div className="card-strong">
                    <span className="badge" style={{ background: "#000" }}>
                      The Flagship
                    </span>
                    <h3 className="heading-3">Wealth Fund</h3>
                    <p className="text-body-muted">
                      Balanced growth &amp; defense: BTC + S&amp;P 500 + Gold + T-Bills.
                    </p>
                  </div>

                  <div className="card-strong">
                    <span className="badge" style={{ background: "#000" }}>
                      The Crypto
                    </span>
                    <h3 className="heading-3">3crypto</h3>
                    <p className="text-body-muted">
                      Focused crypto basket for higher-beta participation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
