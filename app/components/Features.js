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

        <div className="mt-14 pt-14">
          <div
            className="mx-auto mb-10 h-1.5 w-full max-w-4xl bg-[var(--accent)] rounded-full"
            aria-hidden
          />
          <div className="grid [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] gap-10 text-center">
            <div>
              <h4 className="heading-4 tracking-wide uppercase">
                Built on
              </h4>
              <p className="text-body-light">
                3 chains
              </p>
            </div>

            <div>
              <h4 className="heading-4 tracking-wide uppercase">
                Used in
              </h4>
              <p className="text-body-light">
                Dozens of apps
              </p>
            </div>

            <div>
              <h4 className="heading-4 tracking-wide uppercase">
                Trusted by
              </h4>
              <p className="text-body-light">
                Thousands of users
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
