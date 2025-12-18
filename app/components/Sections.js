"use client";

import Link from "next/link";

function PointCard({ index, text }) {
  return (
    <div className="card h-full border-2 border-[var(--border)] bg-[var(--bg-alt)] relative overflow-hidden transition-transform duration-300 hover:-translate-y-1">
      <div
        className="pointer-events-none absolute -inset-6 opacity-70"
        style={{
          background:
            "radial-gradient(420px circle at 10% 0%, rgba(202,163,74,0.22), transparent 55%)",
        }}
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="badge bg-[var(--bg-dark)] text-[var(--footer-text)]">
            {String(index).padStart(2, "0")}
          </span>
          <div className="h-[2px] flex-1 bg-[var(--border)]" aria-hidden />
        </div>
        <p className="mt-6 m-0 font-semibold tracking-tight text-[clamp(1.05rem,1.6vw,1.35rem)] leading-snug break-words">
          {text}
        </p>
      </div>
    </div>
  );
}

export function PaidSection() {
  return (
    <div className="w-full relative">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(900px circle at 15% 0%, rgba(202,163,74,0.14), transparent 55%), radial-gradient(900px circle at 90% 85%, rgba(17,19,24,0.06), transparent 55%)",
        }}
        aria-hidden
      />

      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-[260px]">
            <span className="badge">Unique</span>
            <h2 className="heading-2 mt-4 mb-0">Get paid for owning your investments</h2>
          </div>

          <div
            className="hidden md:block h-2 rounded-[var(--radius-md)] w-[min(420px,45%)]"
            style={{ backgroundColor: "var(--accent)" }}
            aria-hidden
          />
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3 items-stretch">
          <PointCard index={1} text="Every fund provides USD-denominated yield" />
          <PointCard index={2} text="You keep full custody of your assets" />
          <PointCard index={3} text="You invest in the strongest assets on the market" />
        </div>

        <div
          className="mt-10 h-2 rounded-[var(--radius-md)] w-full"
          style={{ backgroundColor: "var(--accent)" }}
          aria-hidden
        />
      </div>
    </div>
  );
}

export function LiveSection() {
  return (
    <div className="w-full relative">
      <div className="max-w-[840px] mx-auto w-full">
        <div
          className="card-strong overflow-hidden relative w-full"
          style={{
            backgroundColor: "var(--bg-dark)",
            borderColor: "var(--accent)",
            color: "var(--footer-text)",
            boxShadow: "0 18px 54px rgba(17,19,24,0.2)",
          }}
        >
          <div
            className="pointer-events-none absolute -inset-1 opacity-60"
            style={{
              background:
                "radial-gradient(900px circle at 15% 10%, rgba(202,163,74,0.25), transparent 55%), radial-gradient(800px circle at 95% 70%, rgba(202,163,74,0.18), transparent 58%)",
            }}
            aria-hidden
          />

          <div className="relative space-y-8">
            <div className="flex items-center gap-3">
              <span
                className="badge bg-white shadow-sm"
                style={{ color: "var(--accent)", borderColor: "rgba(202,163,74,0.45)" }}
              >
                Live
              </span>
            </div>

            <div className="flex flex-col gap-4 max-w-[560px] mx-auto w-full">
              {[
                { intro: "Live on", number: "3    ", tail: "chains" },
                { intro: "Powered by", number: "12    ", tail: "protocols" },
                { intro: "Serving", number: "10k+    ", tail: "transactions executed" },
              ].map((item) => (
                <div
                  key={`${item.intro}-${item.number}`}
                  className="px-2 py-1 md:px-3 md:py-2"
                >
                  <div className="grid grid-cols-[150px_1fr] items-baseline gap-3">
                    <span className="text-[13px] md:text-[14px] uppercase tracking-[0.2em] text-white/75 whitespace-nowrap">
                      {item.intro}
                    </span>
                    <div className="flex items-baseline gap-2 whitespace-nowrap">
                      <span className="text-[clamp(2.6rem,5vw,3.4rem)] font-extrabold tracking-tight text-white leading-none text-left">
                        {item.number}
                      </span>
                      <span className="text-xl md:text-2xl font-semibold text-white/90 tracking-tight leading-tight">
                        {item.tail}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center flex-wrap gap-3 pt-2">
              <Link href="/?auth=1" className="cta-btn cta-orange no-underline">
                Try
              </Link>
              <a
                href="https://x.com/sonaetf"
                target="_blank"
                rel="noreferrer"
                className="cta-btn cta-white no-underline"
              >
                Follow on X
              </a>
            </div>

            <div className="mt-6 h-[1px] w-full bg-[var(--chrome)] opacity-70" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoveSection() {
  return (
    <div className="w-full relative">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(900px circle at 20% 0%, rgba(17,19,24,0.07), transparent 55%), radial-gradient(900px circle at 90% 75%, rgba(202,163,74,0.16), transparent 55%)",
        }}
        aria-hidden
      />

      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-[260px]">
            <span className="badge">join us</span>
            <h2 className="heading-2 mt-4 mb-0">why people love SONA</h2>
          </div>

          <div
            className="hidden md:block h-2 rounded-[var(--radius-md)] w-[min(420px,45%)]"
            style={{ backgroundColor: "var(--accent)" }}
            aria-hidden
          />
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3 items-stretch">
          <PointCard
            index={1}
            text="Democratizing DeFi. You no longer need an IT degree to access the best yields"
          />
          <PointCard
            index={2}
            text="Low management costs that match the ETF experience"
          />
          <PointCard
            index={3}
            text="Modular and efficient yield sources powering your holdings"
          />
        </div>

        <div
          className="mt-10 h-2 rounded-[var(--radius-md)] w-full"
          style={{ backgroundColor: "var(--accent)" }}
          aria-hidden
        />
      </div>
    </div>
  );
}

 
