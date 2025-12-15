"use client";

export default function HeroSection() {
  return (
    <div className="w-full flex flex-col justify-center gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="font-bold tracking-tight leading-tight [font-size:clamp(2.25rem,4.4vw,3.4rem)] m-0">
          Your fund. Your assets. Your yield.
        </h1>

        <p className="text-body-muted max-w-3xl text-[clamp(1rem,1.25vw,1.1rem)] leading-relaxed m-0">
          Build your portfolio with best assets on the market. Get paid for it.
        </p>
      </div>

      <div
        className="h-2 bg-[var(--accent)] rounded-[var(--radius-md)] w-full"
        aria-hidden
      />
    </div>
  );
}

