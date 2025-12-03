"use client";

import Link from "next/link";

export default function HeroSection({
  ctaHref = "/?auth=1",
  onCtaClick,
  sectionRef,
}) {
  return (
    <section ref={sectionRef} className="hero">
      <div className="container-main hero-shell">
        <h1 className="hero-title">Tokenized Wealth</h1>

        <p className="hero-text">
          Build fully on-chain, composable and yield-generating ETF products.
          Start with proven DeFi strategies and maintain complete control of
          your assets.
        </p>

        <div className="hero-cta">
          <Link href={ctaHref} onClick={onCtaClick} className="hero-button">
            Register for early access →
          </Link>
        </div>
      </div>
    </section>
  );
}
