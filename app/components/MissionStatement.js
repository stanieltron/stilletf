"use client";

export default function MissionStatement() {
  return (
    <div className="w-full flex justify-center">
      <div className="max-w-[840px] w-full">
        <div
          className="relative overflow-hidden rounded-[20px] border border-[rgba(202,163,74,0.3)] bg-white text-[var(--text)] shadow-[0_16px_44px_rgba(17,19,24,0.12)] px-6 md:px-8 py-7 md:py-9"
        >
          {/* light glow accents */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(520px circle at 10% 14%, rgba(202,163,74,0.22), transparent 52%), radial-gradient(520px circle at 90% 90%, rgba(17,19,24,0.08), transparent 60%)",
            }}
          />

          <div className="relative flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span
                className="badge bg-white text-[12px] font-semibold uppercase tracking-[0.24em] shadow-sm"
                style={{ color: "var(--accent)", borderColor: "rgba(202,163,74,0.35)" }}
              >
                Mission
              </span>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-[rgba(202,163,74,0.4)] via-[var(--accent)]/60 to-transparent" />
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="m-0 font-extrabold tracking-tight text-[clamp(1.8rem,3vw,2.2rem)] leading-tight">
                Wealth, tokenized
              </h2>
              <p className="m-0 text-[clamp(1rem,1.1vw,1.06rem)] leading-relaxed opacity-90 max-w-3xl">
                Get paid for holding crypto. Sona provide access to tokenized funds that fuse growth and revenue. Keep full ownership of your assets while earning USD-denominated yield, always onchain and non-custodial.
              </p>
            </div>


            <div className="h-[3px] w-full rounded-full bg-gradient-to-r from-[rgba(202,163,74,0.16)] via-[var(--accent)] to-[rgba(202,163,74,0.08)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
