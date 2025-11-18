"use client";

import Link from "next/link";

/**
 * HeroSection
 * Clean, outer spacing is controlled via the shared .section utilities.
 */
export default function HeroSection({ ctaHref = "/?auth=1", onCtaClick }) {
  return (
    <section className="section border-b-0">
      <div className="container-main border-b-8 border-[var(--accent)] pb-12">
        <h1 className="font-bold mb-4 tracking-tight leading-tight [font-size:clamp(2rem,4vw,3rem)]">
          Tokenized Wealth
        </h1>

        <p className="text-body-muted max-w-3xl">
          Build fully on-chain, composable and yield-generating ETF products. Start with proven DeFi
          strategies and maintain complete control of your assets.
        </p>

        <div className="mt-4">
          <Link
            href={ctaHref}
            onClick={onCtaClick}
            className={[
              "inline-flex items-center justify-center gap-2",
              "border border-[var(--text)] bg-[var(--text)] px-4 py-2.5",
              "font-extrabold text-[var(--bg)] no-underline uppercase tracking-wide",
              "hover:opacity-95 active:opacity-90",
            ].join(" ")}
          >
            REGISTER FOR EARLY ACCESS →
          </Link>
        </div>
      </div>
    </section>
  );
}
