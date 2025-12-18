"use client";

export default function HeroSection() {
  return (
    <div className="w-full flex flex-col justify-center gap-7">
      <div className="flex flex-col gap-3">
        {/* <div className="sona-chip w-fit">Your fund. Your assets. Your yield.</div> */}
        <div className="max-w-5xl">
          <h1 className="m-0 font-extrabold tracking-tight leading-tight [font-size:clamp(2.8rem,4.6vw,4.1rem)]">
            The simplest way to
            <span className="text-[var(--accent)]"> earn on crypto</span>
          </h1>
        </div>
        <div className="max-w-4xl">
          <p
            className="font-medium text-[clamp(1.08rem,1.35vw,1.22rem)] leading-[1.7] tracking-[0.01em] text-[rgba(17,19,24,0.78)] m-0"
          >
            Sona makes wealth building with crypto effortless. You hold the assets, and Sona handles the yield and strategy in the background. A modern, onchain portfolio designed to grow with you.
          </p>
        </div>
      </div>

      {/* <div className="h-2 rounded-[var(--radius-md)] w-full bg-gradient-to-r from-[rgba(202,163,74,0.85)] via-[var(--accent)] to-[rgba(17,19,24,0.4)]" /> */}

    </div>
  );
}
