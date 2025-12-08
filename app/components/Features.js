"use client";

export default function Features() {
  return (
    <section className="section-dark">
      <div className="container-main">
        <h2 className="heading-2 text-center uppercase tracking-wide">
          On-chain ETFs, rethought for builders
        </h2>

        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] gap-10 mb-14 text-center">
          <div>
            <h4 className="heading-4 tracking-wide uppercase">
              Composable by design
            </h4>
            <p className="text-body-light">
              Chain-agnostic integrations, public math, and modular vaults.
            </p>
          </div>

          <div>
            <h4 className="heading-4 tracking-wide uppercase">
              Capital efficient
            </h4>
            <p className="text-body-light">
              Route idle collateral to vetted yield sources with guardrails.
            </p>
          </div>

          <div>
            <h4 className="heading-4 tracking-wide uppercase">
              Verifiable performance
            </h4>
            <p className="text-body-light">
              On-chain data provenance and transparent rebalancing logic.
            </p>
          </div>
        </div>

        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))] gap-8 mt-14 pt-14 text-center">
          <div className="col-span-full h-2 bg-[var(--accent)] rounded-[var(--radius-md)] mb-8" aria-hidden />
          <div>
            <div className="text-body-light mb-2.5">
              Built on
            </div>
            <div className="heading-4 uppercase tracking-wide">
              3 chains
            </div>
          </div>

          <div>
            <div className="text-body-light mb-2.5">
              Used in
            </div>
            <div className="heading-4 uppercase tracking-wide">
              Dozens of apps
            </div>
          </div>

          <div>
            <div className="text-body-light mb-2.5">
              Trusted by
            </div>
            <div className="heading-4 uppercase tracking-wide">
              Thousands of users
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
