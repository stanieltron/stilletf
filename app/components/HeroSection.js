"use client";

import Link from "next/link";

export default function HeroSection({ ctaHref = "/?auth=1", onCtaClick }) {
  return (
    <section className="section !py-0">
      <div className="container-main pb-12">
        <h1 className="font-bold mb-4 tracking-tight leading-tight [font-size:clamp(2rem,4vw,3rem)]">
          SONA - Tokenized Wealth
        </h1>

        <p className="text-body-muted max-w-3xl">
          Build fully on-chain, composable and yield-generating ETF products. Start with proven DeFi
          strategies and maintain complete control of your assets.
        </p>

        <div className="mt-4">
          <Link href={ctaHref} onClick={onCtaClick} className="cta-btn cta-black no-underline">
            REGISTER FOR EARLY ACCESS &rarr;
          </Link>
        </div>

        <div className="mt-6 h-2 bg-[var(--accent)] rounded-[var(--radius-md)] w-full" aria-hidden />
      </div>
    </section>
  );
}

