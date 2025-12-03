"use client";

export default function Benefits() {
  return (
    <section className="section">
      <div className="container-main">
        <h2 className="heading-2">Why people choose Tokenized Wealth</h2>

        <div
          className="grid-auto"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}
        >
          <div className="card">
            <h4 className="heading-4">Transparent risk</h4>
            <p className="text-body-muted">
              Open-source math, on-chain events, and explicit drawdown budgeting signal how a strategy behaves across regimes.
            </p>
          </div>

          <div className="card">
            <h4 className="heading-4">Operator-grade tooling</h4>
            <p className="text-body-muted">
              Get a bird&apos;s-eye view of positions, inflows, and rebalance actions—without giving up custody.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
