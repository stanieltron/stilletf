// app/etfs/page.js
"use client";

import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function ETFsPage() {
  return (
    <div className="min-h-full flex flex-col bg-white text-black">
      <Header />

      <main className="flex flex-col">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col py-12">
          <h1 className="mt-0 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
            Skill-ETFs roadmap
          </h1>
          <p className="mt-2 text-sm sm:text-base md:text-lg text-neutral-600 max-w-xl">
            Three on-chain funds that mirror the way you actually invest:
            pure Bitcoin, a balanced wealth basket, and a focused crypto fund.
          </p>

          {/* Stacked full-width cards */}
          <div className="mt-10 sm:mt-16 mb-16 sm:mb-24 flex flex-col gap-8 sm:gap-10">
            <FundCard
              variant="dark"
              tag="THE PILOT"
              title="BTC Fund"
              subtitle="Pure Bitcoin exposure with transparent mechanics."
              body="Simple, transparent BTC-only exposure that lets you keep custody while showcasing your skills on-chain."
              cta="Try now for future rewards →"
              href="/btcetf"
              active
            />

            <FundCard
              variant="light"
              tag="THE FLAGSHIP"
              title="Wealth Fund"
              subtitle="Balanced growth &amp; defense."
              body="A diversified mix of BTC, S&amp;P 500, Gold and T-Bills designed for smoother long-term compounding."
              cta="Coming soon"
            />

            <FundCard
              variant="light"
              tag="THE CRYPTO"
              title="3crypto"
              subtitle="Focused crypto basket."
              body="A higher-beta trio of crypto assets for those who want more upside potential and are comfortable with volatility."
              cta="Coming soon"
            />
          </div>

          <div className="mt-4">
            <Link
              href="/"
              className="inline-block border border-black bg-white px-4 py-2 text-sm font-bold tracking-tight uppercase hover:bg-black hover:text-white transition-colors rounded-none"
            >
              Back to builder
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function FundCard({
  variant = "light",
  tag,
  title,
  subtitle,
  body,
  cta,
  href,
  active = false,
}) {
  const Wrapper = href && active ? Link : "div";

  const baseClasses =
    "w-full border px-5 py-8 md:px-10 md:py-16 rounded-3xl no-underline transition-transform transition-shadow";
  const activeClasses = active
    ? "cursor-pointer hover:-translate-y-1 hover:shadow-[0_10px_0_rgba(0,0,0,1)]"
    : "cursor-default";
  const variantClasses =
    variant === "dark"
      ? "bg-black text-white border-white hover:border-[var(--accent)]"
      : "bg-white text-black border-black hover:border-[var(--accent)]";

  const tagClasses =
    "inline-block bg-[var(--accent)] text-[var(--accent-text)] text-xs sm:text-sm md:text-base font-semibold tracking-[0.16em] px-3 sm:px-4 py-1 uppercase";
  const titleClasses =
    "mt-5 mb-2 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight";
  const subtitleClasses =
    "text-xl sm:text-2xl md:text-3xl" +
    (variant === "dark" ? " text-white/80" : " text-neutral-800");
  const bodyClasses =
    "mt-6 text-lg sm:text-xl md:text-3xl leading-relaxed" +
    (variant === "dark" ? " text-white/80" : " text-neutral-800");
  const ctaClasses =
    "mt-8 sm:mt-10 text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight" +
    (active
      ? " text-[var(--accent)]"
      : variant === "dark"
      ? " text-white/60"
      : " text-neutral-500");

  return (
    <Wrapper
      href={href && active ? href : undefined}
      className={`${baseClasses} ${variantClasses} ${activeClasses}`}
    >
      <div className={tagClasses}>{tag}</div>

      <h2 className={titleClasses}>{title}</h2>
      <p
        className={subtitleClasses}
        dangerouslySetInnerHTML={{ __html: subtitle }}
      />

      <p className={bodyClasses}>{body}</p>

      <div className={ctaClasses}>{cta}</div>
    </Wrapper>
  );
}
