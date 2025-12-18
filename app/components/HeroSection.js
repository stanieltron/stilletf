"use client";

export default function HeroSection() {
  return (
    <div className="w-full flex flex-col justify-center gap-7">
      <div className="flex flex-col gap-3">
        {/* <div className="sona-chip w-fit">Your fund. Your assets. Your yield.</div> */}
        <h1 className="m-0 font-extrabold tracking-tight leading-tight [font-size:clamp(2.6rem,4.4vw,3.8rem)]">
          The simplest way to
          <span className="text-[var(--accent)]"> earn on crypto</span>
        </h1>
        <p className="text-body max-w-3xl text-[clamp(1rem,1.2vw,1.1rem)] leading-relaxed m-0">
          Sona makes wealth building with crypto effortless. You hold the assets, and Sona handles the yield and strategy in the background. A modern, onchain portfolio designed to grow with you.
        </p>
      </div>

      {/* <div className="h-2 rounded-[var(--radius-md)] w-full bg-gradient-to-r from-[rgba(202,163,74,0.85)] via-[var(--accent)] to-[rgba(17,19,24,0.4)]" /> */}

    </div>
  );
}
