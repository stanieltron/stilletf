"use client";

import { Suspense, useState } from "react";
import Link from "next/link";

import Header from "./components/Header";
import Footer from "./components/Footer";
import BuilderSection from "./components/BuilderSection";

const imgTokenBtc = "/assets/btc%20small.png";
const imgTokenEth = "/assets/eth%20small.png";
const imgTokenUsdt = "/assets/usd%20small.png";
const imgTokenTreasuries = "/assets/us%20treasury%20small.png";
const imgTokenSp500 = "/assets/snp%20500.png";
const imgTokenGold = "/assets/gold%20small.png";

const imgIconYield = "/assets/paid%20in.svg";
const imgIconCustody = "/assets/full%20custody.svg";
const imgIconWithdraw = "/assets/no%20lockups.svg";

const imgCheckShield = "/assets/check-shield.svg";

const imgFaqArrow = "/icons/faq-arrow.svg";

export default function HomeClient() {
  const partnerLabels = [
    "Metamask",
    "Trezor",
    "Bitcoin",
    "Mantle",
    "Aave",
    "Lido",
    "Fluid",
  ];

  const scrollToFaq = () => {
    const faq = document.getElementById("faq");
    if (faq) {
      faq.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="home-root">
      <Header />

      <main className="home-main">
        <section className="w-full">
          <div className="max-w-6xl mx-auto px-6 pt-12 pb-16 md:pb-32">
            <div className="w-full flex flex-col items-center pt-8 space-y-12">
              <div className="flex flex-col items-center text-center max-w-3xl space-y-8">
                <div className="bg-[#f6e6c1] px-4 py-2 rounded-full flex items-center gap-2 border border-[#f2ebde]">
                  <img
                    src={imgCheckShield}
                    alt=""
                    className="h-[18px] w-[18px]"
                  />
                  <span className="text-[#906504] text-[15px] font-medium tracking-tight">
                    Secure & self-custodial by design
                  </span>
                </div>
                <h1 className="text-[38px] sm:text-[52px] md:text-[72px] font-semibold leading-[0.95] tracking-[-1.2px] sm:tracking-[-2px] md:tracking-[-2.88px] text-[#201909]">
                  Earn passive income <br /> on your crypto
                </h1>
                <p className="text-[20px] leading-[1.4] text-[#645c4a] max-w-2xl">
                  Buy yield-generating tokenized bundles of Bitcoin, Gold, or
                  Stocks that combine asset growth with passive revenue. Get
                  paid in USDC just for holding your crypto.
                </p>
                <div className="flex flex-col items-center gap-12 pt-4">
                  <Link
                    href="/etfs"
                    className="bg-[#201909] text-white px-8 py-4 rounded-[34px] flex items-center gap-3 text-lg font-semibold hover:opacity-90 transition-all active:scale-95 shadow-xl shadow-[#f2ebde]"
                  >
                    Start earning
                    <TrendingUpIcon />
                  </Link>
                  <button
                    type="button"
                    className="text-[#645c4a] text-base underline decoration-[#dfd2b9] underline-offset-4 hover:text-[#201909] transition-colors"
                    onClick={scrollToFaq}
                  >
                    How does it work?
                  </button>
                </div>
              </div>

              <div className="w-full flex flex-col gap-2">
                <div className="w-full grid md:grid-cols-3 gap-2">
                  <Link href="/etfs" className="bundle-card bundle-card-muted min-h-[145px] md:h-[200px] block cursor-pointer hover:opacity-95 transition-opacity">
                    <div className="bundle-header">
                      <div className="bundle-title-row">
                        <div className="bundle-title">Crypto Bundle</div>
                        <div className="bundle-tag bundle-tag-muted">
                          Coming Soon
                        </div>
                      </div>
                      <div className="bundle-desc">
                        Staples of the digital economy.
                      </div>
                    </div>

                    <div className="bundle-tokens">
                      <TokenPill label="bitcoin" img={imgTokenBtc} />
                      <TokenPill label="ethereum" img={imgTokenEth} />
                      <TokenPill label="usdt" img={imgTokenUsdt} />
                    </div>
                  </Link>

                  <Link href="/etfs" className="bundle-card bundle-card-core min-h-[145px] md:h-[200px] block cursor-pointer hover:opacity-95 transition-opacity">
                    <div className="bundle-spotlight">
                      <div className="bundle-spotlight-inner">
                        <img
                          src={imgTokenBtc}
                          alt=""
                          className="bundle-spotlight-img"
                        />
                        <div className="bundle-spotlight-wash" />
                      </div>
                    </div>

                    <div className="bundle-header bundle-core-content">
                      <div className="bundle-title-row">
                        <div className="bundle-title">Core Bundle</div>
                        <div className="bundle-tag">Available</div>
                      </div>
                      <div className="bundle-desc">
                        Earn 3% yield on top of your Bitcoin.
                      </div>
                    </div>

                    <div className="bundle-tokens bundle-core-content">
                      <TokenPill label="bitcoin" img={imgTokenBtc} />
                    </div>
                  </Link>

                  <Link href="/etfs" className="bundle-card bundle-card-muted min-h-[145px] md:h-[200px] block cursor-pointer hover:opacity-95 transition-opacity">
                    <div className="bundle-header">
                      <div className="bundle-title-row">
                        <div className="bundle-title">Flagship Bundle</div>
                        <div className="bundle-tag bundle-tag-muted">
                          Coming Soon
                        </div>
                      </div>
                      <div className="bundle-desc">
                        Best assets of generation, combined.
                      </div>
                    </div>

                    <div className="bundle-tokens bundle-tokens-tight">
                      <TokenPill label="bitcoin" img={imgTokenBtc} />
                      <TokenPill label="us treasuries" img={imgTokenTreasuries} />
                      <TokenPill label="s&p 500" img={imgTokenSp500} />
                      <TokenPill label="gold" img={imgTokenGold} />
                    </div>
                  </Link>
                </div>

                <div id="builder" className="w-full">
                  <div className="launch-card w-full">
                    <div className="launch-stack">
                      <div className="launch-row">
                        <div className="launch-left">
                          <div className="launch-copy">
                            <div className="launch-tag">Launch Campaign</div>
                            <div className="launch-copy-block">
                              <div className="launch-title">
                                Build your own
                                <br />
                                investment bundle
                              </div>
                              <p className="launch-desc">
                                All the custom bundles are published to the
                                leaderboard for public voting.
                              </p>
                            </div>
                          </div>
                        <Link href="/leaderboard" className="launch-link">
                          Explore Leaderboard
                        </Link>
                        </div>

                        <div className="launch-right">
                          <div className="steps-stack">
                            <StepLine
                              number="1"
                              strong="Select assets"
                              rest={
                                <>
                                  for your bundle
                                  <br />
                                  based on your strategy preference.
                                </>
                              }
                            />
                            <StepLine
                              number="2"
                              strong="Share"
                              rest="your bundle on socials."
                            />
                            <StepLine
                              number="3"
                              strong="Get access to"
                              rest={
                                <>
                                  <span className="text-semibold">
                                    early-adopter rewards.
                                  </span>
                                </>
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <Suspense fallback={null}>
                        <BuilderSection embedded />
                      </Suspense>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-center how-section" id="how">
          <div className="container-1080 how-stack">
            <div className="how-header">
              <div className="how-left">
                <div className="how-kicker">How does it work?</div>
                <div className="how-title">
                  Like ETFs,
                  <br />
                  on blockchain!
                </div>
              </div>
              <p className="how-copy">
                Each bundle deploys capital into transparent,
                <br />
                on-chain strategies such as liquidity provision
                <br />
                and over-collateralized lending.
                <br />
                <br />
                Yield is generated from real market activity, trading fees, and
                interest paid by borrowers.
              </p>
            </div>

            <div className="how-info-row">
              <InfoBlock
                img={imgIconYield}
                text={
                  <>
                    Each tokenized bundle earns
                    <br />
                    yield <span className="text-bold">paid in $USDC.</span>
                  </>
                }
              />
              <Divider />
              <InfoBlock
                img={imgIconCustody}
                text={
                  <>
                    Keep <span className="text-bold">full custody</span>
                    <br />& control over your assets.
                  </>
                }
              />
              <Divider />
              <InfoBlock
                img={imgIconWithdraw}
                text={
                  <>
                    Withdraw your earnings, or principal, anytime.{" "}
                    <span className="text-bold">No lock-ups.</span>
                  </>
                }
              />
            </div>
          </div>
        </section>

        <section className="section-center activity-section">
          <div className="activity-stack">
            <div className="activity-row">
              <div className="activity-left">
                <div className="activity-kicker">Activity</div>
                <div className="activity-main">
                  <div className="activity-number">10,000+</div>
                  <div className="activity-caption">
                    <div>executed</div>
                    <div>transactions</div>
                  </div>
                </div>
              </div>

              <div className="activity-right">
                <div className="activity-stat">
                  <div className="activity-kicker">Live On</div>
                  <div className="activity-stat-row">
                    <div className="activity-stat-number">3</div>
                    <div className="activity-stat-label">chains</div>
                  </div>
                </div>
                <div className="activity-stat">
                  <div className="activity-kicker">Powered by</div>
                  <div className="activity-stat-row">
                    <div className="activity-stat-number">12</div>
                    <div className="activity-stat-label">protocols</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="partner-row">
              <div className="partner-marquee">
                <div className="partner-track">
                  {[...partnerLabels, ...partnerLabels].map((label, index) => (
                    <div key={`${label}-${index}`} className="partner-item">
                      <div className="partner-dot" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-center faq-section" id="faq">
          <div className="faq-stack">
            <div>
              <div className="faq-title">Have questions?</div>
              <div className="faq-subtitle">Find your answers here.</div>
            </div>

            <div className="faq-list">
              <FaqItem
                title="Where does the yield actually come from?"
                body={`It's not magic. We automate professional decentralized finance strategies like liquidity provision and lending that are usually too complex for individuals to manage manually. We package these strategies into a simple "deposit," and you get the profit.`}
              />
              <FaqItem
                title="Is my Bitcoin locked? Can I withdraw anytime?"
                body={`Your funds are never locked. You can withdraw your profits (yield) or your principal (original deposit) whenever you want, instantly.`}
              />
              <FaqItem
                title="What happens if the Stillwater website goes down?"
                body={`Your funds remain safe. Because our product is "On-Chain," your assets live on the blockchain, not on our company servers. You can always interact directly with the smart contract to recover your funds, even without our website.`}
              />
              <FaqItem
                title='Why do I need "WBTC" instead of regular Bitcoin?'
                body={`To use advanced yield strategies, Bitcoin needs to speak the language of smart contracts (DeFi). WBTC (Wrapped Bitcoin) is simply Bitcoin that has been "translated" so it can work on the network where yield exists. It holds the same value as BTC.`}
              />
              <FaqItem
                title="How does Stillwater makes money?"
                body={`We align our incentives with yours. We take a small performance fee only from the profit generated, not from your principal deposit. We only earn if you earn.`}
                hideDivider
              />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function TrendingUpIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="h-5 w-5"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function TokenPill({ label, img }) {
  return (
    <div className="token-pill">
      <img src={img} alt="" />
      <span>{label}</span>
    </div>
  );
}

function StepLine({ number, strong, rest }) {
  return (
    <div className="step-line">
      <div className="step-pill">{number}</div>
      <div className="step-text">
        <strong>{strong} </strong>
        {rest}
      </div>
    </div>
  );
}

function InfoBlock({ img, text }) {
  return (
    <div className="info-block">
      <img src={img} alt="" />
      <div className="info-text">{text}</div>
    </div>
  );
}

function Divider() {
  return <div className="divider" aria-hidden="true" />;
}

function FaqItem({ title, body, hideDivider }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`faq-item ${hideDivider ? "" : "faq-item-divider"}`}>
      <div className="faq-content font-inter">
        <button
          type="button"
          className="faq-toggle"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <span className="faq-question font-albert">{title}</span>
          <img
            src={imgFaqArrow}
            alt=""
            className={`faq-arrow ${open ? "is-open" : ""}`}
          />
        </button>
        {open ? (
          <>
            <div className="faq-spacer" />
            <div className="faq-body font-albert">{body}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}
