"use client";

export default function Roadmap() {
  return (
    <div className="w-full">
      <h2 className="heading-2 m-0">
          Roadmap
      </h2>

      {/* Roadmap stage area */}
      <div className="mt-8 md:mt-10">
          <div className="relative w-full">
            {/* Keep the square aspect ratio */}
            <div className="relative w-full pb-0 md:pb-[60%] md:h-0">
              <div className="relative md:absolute md:inset-0 md:overflow-hidden md:isolate md:h-full">
                {/* Diagonal line (desktop) */}
                <svg
                  className="absolute inset-0 -z-10 pointer-events-none hidden md:block w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M 0 0 L 100 100"
                    stroke="var(--accent)"
                    strokeWidth="8"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                  />
                </svg>

                {/* Vertical guide (mobile) */}
                <svg
                  className="absolute inset-0 -z-10 pointer-events-none md:hidden w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M 50 0 L 50 100"
                    stroke="var(--accent)"
                    strokeWidth="6"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                  />
                </svg>

                {/* === Desktop cards === */}
                <div className="hidden md:block h-full w-full">
                  {/* 1) Top-left */}
                  <div className="absolute left-[0%] top-[0%] w-[25%] h-[33%]">
                    <div className="card-strong h-full overflow-hidden transition-transform duration-300 hover:-translate-y-1">
                      <div className="card-overlay" />
                      <span className="badge bg-[var(--accent)] text-[var(--accent-text)]">
                        The core
                      </span>
                      <h3 className="heading-3">
                        Bitcoin-based crypto traded fund
                      </h3>
                      <p className="text-body-muted break-words">
                        Get paid for owning the best cryptocurrency in the world.
                      </p>
                    </div>
                  </div>

                  {/* 2) Center */}
                  <div className="absolute left-[37.5%] top-[calc(50%-16.5%)] w-[25%] h-[33%]">
                    <div className="card-strong h-full overflow-hidden transition-transform duration-300 hover:-translate-y-1">
                      <div className="card-overlay" />
                      <span className="badge bg-black">
                        The flagship
                      </span>
                      <h3 className="heading-3">
                        Best assets of a generation combined
                      </h3>
                      <p className="text-body-muted break-words">
                        Bitcoin, S&amp;P 500, gold, and US treasuries.
                      </p>
                    </div>
                  </div>

                  {/* 3) Bottom-right */}
                  <div className="absolute left-[75%] bottom-[0%] w-[25%] h-[33%]">
                    <div className="card-strong h-full overflow-hidden transition-transform duration-300 hover:-translate-y-1">
                      <div className="card-overlay" />
                      <span className="badge bg-black">
                        The crypto
                      </span>
                      <h3 className="heading-3">
                        Staples of the digital economy
                      </h3>
                      <p className="text-body-muted break-words">
                        BTC, ETH, USDT.
                      </p>
                    </div>
                  </div>
                </div>

                {/* === Mobile stacked cards === */}
                <div className="md:hidden relative flex flex-col justify-center gap-8 px-1">
                  <div
                    className="absolute left-1/2 top-0 bottom-0 w-[6px] -translate-x-1/2 bg-[var(--accent)] opacity-80"
                    aria-hidden
                  />

                  <div
                    className="card-strong text-white relative z-10"
                    style={{ backgroundColor: "var(--bg-dark)", borderColor: "var(--bg-dark)", color: "var(--bg-alt)" }}
                  >
                    <span className="badge bg-[var(--accent)] text-[var(--accent-text)]">
                      The core
                    </span>
                    <h3 className="heading-3">
                      Bitcoin-based crypto traded fund
                    </h3>
                    <p className="text-body-light">
                      Get paid for owning the best cryptocurrency in the world.
                    </p>
                  </div>

                  <div className="card-strong relative z-10">
                    <span className="badge bg-black">
                      The flagship
                    </span>
                    <h3 className="heading-3">
                      Best assets of a generation combined
                    </h3>
                    <p className="text-body-muted">
                      Bitcoin, S&amp;P 500, gold, and US treasuries.
                    </p>
                  </div>

                  <div className="card-strong relative z-10">
                    <span className="badge bg-black">
                      The crypto
                    </span>
                    <h3 className="heading-3">
                      Staples of the digital economy
                    </h3>
                    <p className="text-body-muted">
                      BTC, ETH, USDT.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
