// app/etfs/page.js
"use client";

import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function ETFsPage() {
  return (
    <div className="min-h-screen flex flex-col text-[var(--text)]">
      <Header />

      <main className="flex flex-col">
        <div className="sona-container flex flex-col py-12 gap-6">
          <div className="flex flex-col gap-2 max-w-3xl">
            <div className="sona-chip w-fit">Sona funds</div>
            <h1 className="mt-0 text-4xl sm:text-5xl font-extrabold tracking-tight">
              Skill ETFs with Sona discipline
            </h1>
            <p className="text-body max-w-2xl">
              Three on-chain funds that mirror how sophisticated investors allocate:
              pure Bitcoin conviction, a balanced wealth basket, and a focused crypto trio.
            </p>
            <div className="sona-divider w-full max-w-lg" aria-hidden />
          </div>

          {/* Stacked full-width cards */}
          <div className="mt-6 sm:mt-10 mb-16 sm:mb-24 flex flex-col gap-8 sm:gap-10">
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
              className="inline-flex items-center gap-2 sona-btn sona-btn-outline"
            >
              ← Back to builder
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
    "w-full sona-card relative overflow-hidden no-underline transition-transform duration-200";
  const activeClasses = active
    ? "cursor-pointer hover:-translate-y-1"
    : "cursor-default";
  const variantClasses =
    variant === "dark"
      ? "bg-[var(--bg-dark)] text-[var(--footer-text)] border border-[var(--chrome)]"
      : "bg-[rgba(255,255,255,0.98)] text-[var(--text)] border border-[rgba(17,19,24,0.08)]";

  const tagClasses = "sona-chip";
  const titleClasses =
    "mt-5 mb-2 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight";
  const subtitleClasses =
    "text-xl sm:text-2xl md:text-3xl" +
    (variant === "dark" ? " text-white/80" : " text-neutral-800");
  const bodyClasses =
    "mt-6 text-lg sm:text-xl md:text-2xl leading-relaxed" +
    (variant === "dark" ? " text-white/80" : " text-neutral-700");
  const ctaClasses =
    "mt-8 sm:mt-10 flex items-center gap-3 text-base sm:text-lg md:text-xl font-semibold tracking-[0.1em]" +
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
