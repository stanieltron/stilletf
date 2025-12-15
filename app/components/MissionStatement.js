"use client";

export default function MissionStatement() {
  return (
    <div className="w-full flex flex-col justify-center gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="heading-2 m-0">
          Wealth, Tokenized
        </h2>
        <p className="text-body-muted max-w-3xl text-[clamp(1rem,1.1vw,1.05rem)] leading-relaxed m-0">
          Get paid for holding crypto. Tokenized funds that fuse growth and revenue. Keep full ownership of your assets while earning USD-denominated yield. Fully onchain and non-custodial.
        </p>
       
      </div>

      <div className="pt-2">
        <div className="h-2 bg-[var(--accent)] rounded-[var(--radius-md)] w-full" aria-hidden />
      </div>
    </div>
  );
}
