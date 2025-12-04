"use client";

export default function Roadmap() {
  return (
    <section className="section-compact">
      <div className="container-main">
        <div className="eyebrow text-slate-500">
          Product Roadmap
        </div>

        {/* Roadmap stage area */}
        <div className="py-14">
          <div className="relative w-full">
            {/* Keep the square aspect ratio */}
            <div className="relative w-full pb-[100%] md:pb-[60%]">
              <div className="absolute inset-0 overflow-hidden isolate">
                {/* Diagonal line (desktop) */}
                <svg
                  className="absolute inset-0 -z-10 pointer-events-none hidden md:block w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M 0 0 L 100 100"
                    stroke="#2563eb"
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
                    stroke="#2563eb"
                    strokeWidth="4"
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
                      <span className="badge bg-blue-600">
                        The Pilot
                      </span>
                      <h3 className="heading-3">
                        BTC Fund
                      </h3>
                      <p className="text-body-muted break-words">
                        Pure Bitcoin exposure with transparent mechanics.
                      </p>
                    </div>
                    <div className="mt-4">
                      <button className="btn-primary">
                        Try now for future rewards →
                      </button>
                    </div>
                  </div>

                  {/* 2) Center */}
                  <div className="absolute left-[37.5%] top-[calc(50%-16.5%)] w-[25%] h-[33%]">
                    <div className="card-strong h-full overflow-hidden transition-transform duration-300 hover:-translate-y-1">
                      <div className="card-overlay" />
                      <span className="badge bg-black">
                        The Flagship
                      </span>
                      <h3 className="heading-3">
                        Wealth Fund
                      </h3>
                      <p className="text-body-muted break-words">
                        Balanced growth &amp; defense: BTC + S&amp;P 500 + Gold + T-Bills.
                      </p>
                    </div>
                  </div>

                  {/* 3) Bottom-right */}
                  <div className="absolute left-[75%] bottom-[0%] w-[25%] h-[33%]">
                    <div className="card-strong h-full overflow-hidden transition-transform duration-300 hover:-translate-y-1">
                      <div className="card-overlay" />
                      <span className="badge bg-black">
                        The Crypto
                      </span>
                      <h3 className="heading-3">
                        3crypto
                      </h3>
                      <p className="text-body-muted break-words">
                        Focused crypto basket for higher-beta participation.
                      </p>
                    </div>
                  </div>
                </div>

                {/* === Mobile stacked cards === */}
                <div className="md:hidden absolute inset-0 flex flex-col justify-center gap-8 px-1">
                  <div className="card-strong">
                    <span className="badge bg-blue-600">
                      The Pilot
                    </span>
                    <h3 className="heading-3">
                      BTC Fund
                    </h3>
                    <p className="text-body-muted">
                      Pure Bitcoin exposure with transparent mechanics.
                    </p>
                    <button className="btn-primary mt-4">
                      Try now for future rewards →
                    </button>
                  </div>

                  <div className="card-strong">
                    <span className="badge bg-black">
                      The Flagship
                    </span>
                    <h3 className="heading-3">
                      Wealth Fund
                    </h3>
                    <p className="text-body-muted">
                      Balanced growth &amp; defense: BTC + S&amp;P 500 + Gold + T-Bills.
                    </p>
                  </div>

                  <div className="card-strong">
                    <span className="badge bg-black">
                      The Crypto
                    </span>
                    <h3 className="heading-3">
                      3crypto
                    </h3>
                    <p className="text-body-muted">
                      Focused crypto basket for higher-beta participation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
