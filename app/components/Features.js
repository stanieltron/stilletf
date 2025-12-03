"use client";

export default function Features() {
  return (
    <section className="section-dark">
      <div className="container-main">
        <h2 className="heading-2 text-center">On-chain ETFs, rethought for builders</h2>

        <div className="feature-grid" style={{ textAlign: "center", marginBottom: 56 }}>
          <div>
            <h4 className="heading-4">Composable by design</h4>
            <p className="text-body-light">
              Chain-agnostic integrations, public math, and modular vaults.
            </p>
          </div>

          <div>
            <h4 className="heading-4">Capital efficient</h4>
            <p className="text-body-light">
              Route idle collateral to vetted yield sources with guardrails.
            </p>
          </div>

          <div>
            <h4 className="heading-4">Verifiable performance</h4>
            <p className="text-body-light">
              On-chain data provenance and transparent rebalancing logic.
            </p>
          </div>
        </div>

        <div
          className="stats-grid"
          style={{
            borderTop: "8px solid #2250f4",
            paddingTop: 48,
            marginTop: 48,
            textAlign: "center",
          }}
        >
          <div>
            <div className="text-body-light">Built on</div>
            <div className="heading-4">3 chains</div>
          </div>

          <div>
            <div className="text-body-light">Used in</div>
            <div className="heading-4">Dozens of apps</div>
          </div>

          <div>
            <div className="text-body-light">Trusted by</div>
            <div className="heading-4">Thousands of users</div>
          </div>
        </div>
      </div>
    </section>
  );
}
