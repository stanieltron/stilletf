"use client";

export default function Roadmap() {
  const items = [
    {
      badge: "The core",
      title: "Bitcoin-based crypto traded fund",
      body: "Get paid for owning the best cryptocurrency in the world.",
    },
    {
      badge: "The flagship",
      title: "Best assets of a generation combined",
      body: "Bitcoin, S&P 500, gold, and US treasuries for balanced strength.",
    },
    {
      badge: "The crypto",
      title: "Staples of the digital economy",
      body: "BTC, ETH, USDT — the liquidity bedrock of onchain markets.",
    },
  ];

  return (
    <div className="w-full">
      <div className="flex flex-col gap-2 mb-6">
        <span className="badge w-fit">Premium assets. Onchain yield.</span>
        <h2 className="heading-2 m-0">Premium assets. Onchain yield.</h2>
        <p className="text-body max-w-3xl">
          A disciplined lineup of onchain ETFs — from pure Bitcoin conviction to balanced multi-asset and crypto staples —
          each built to deliver calm, premium yield.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {items.map((item, i) => (
          <article
            key={item.title}
            className={[
              "relative overflow-hidden rounded-[18px] border",
              "bg-[var(--bg-dark)] text-[var(--footer-text)] border-[var(--chrome)]",
              "shadow-[0_14px_40px_rgba(17,19,24,0.18)] p-5 md:p-6 flex flex-col gap-3",
              i === 0 ? "md:translate-y-0" : i === 1 ? "md:translate-y-10" : "md:translate-y-20",
              "transition-transform duration-500 ease-in-out hover:-translate-y-2 hover:shadow-[0_18px_48px_rgba(17,19,24,0.25)]",
            ].join(" ")}
            style={{
              animation: "roadmapFloat 7s ease-in-out infinite",
              animationDelay: `${i * 0.5}s`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-70 -z-10"
              style={{
                background:
                  "radial-gradient(420px circle at 15% 20%, rgba(202,163,74,0.18), transparent 55%), radial-gradient(420px circle at 90% 90%, rgba(17,19,24,0.18), transparent 55%)",
              }}
              aria-hidden
            />

            <div className="flex items-center justify-between gap-3">
              <span
                className="badge bg-white shadow-sm"
                style={{ color: "var(--accent)", borderColor: "rgba(202,163,74,0.45)" }}
              >
                {item.badge}
              </span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                Stage {i + 1}
              </span>
            </div>

            <h3
              className="m-0 font-semibold tracking-tight text-[clamp(1.2rem,2vw,1.45rem)]"
              style={{ color: "var(--footer-text)" }}
            >
              {item.title}
            </h3>

            <p
              className="m-0 text-body"
              style={{ color: "rgba(243,244,248,0.82)" }}
            >
              {item.body}
            </p>

            <div className="h-[3px] w-full rounded-full bg-gradient-to-r from-[rgba(202,163,74,0.08)] via-[var(--accent)] to-[rgba(202,163,74,0.08)]" />
          </article>
        ))}
      </div>
    </div>
  );
}

// subtle float animation
const style = document?.documentElement;
if (style && !style.dataset.roadmapFloatInjected) {
  const css = `
  @keyframes roadmapFloat {
    0% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
    100% { transform: translateY(0); }
  }`;
  const el = document.createElement("style");
  el.innerHTML = css;
  document.head.appendChild(el);
  style.dataset.roadmapFloatInjected = "1";
}
