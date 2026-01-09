"use client";

import { useState } from "react";

/**
 * LogoCarousel
 * Auto-scrolling carousel for protocol / partner logos,
 * with graceful fallback to text when an image is missing/broken.
 */
const LOGOS = [
  { name: "Ethereum", src: "/logos/eth-logo.png" },
  { name: "BOB", src: "/logos/bob-logo.png" },
  { name: "Mantle", src: "/logos/mantle-logo.png" },
  { name: "MetaMask", src: "/logos/metamask-logo.png" },
  { name: "Aave", src: "/logos/aave-logo.png" },
  { name: "Lido", src: "/logos/lido-logo.png" },
  { name: "Fluid", src: "/logos/fluid-logo.png" },
  { name: "WETH", src: "/logos/weth-logo.png" },
  { name: "WBTC", src: "/logos/wbtc-logo.png" },
  { name: "BTC", src: "/logos/btc-logo.png" },
  { name: "Trezor", src: "/logos/trezor-logo.png" },
  { name: "Daonysus" }, // text for now
  { name: "Solidity", src: "/logos/solidity-logo.png" },
];

function LogoItem({ name, src }) {
  const [failed, setFailed] = useState(!src);

  return (
    <div className="flex items-center justify-center gap-4 shrink-0 min-w-[220px]">
      {!failed && src && (
        <img
          src={src}
          alt={name}
          onError={() => setFailed(true)}
          className={[
            "h-16 max-w-[160px] object-contain",
            "transition-transform transition-opacity duration-300 ease-in-out",
            "hover:opacity-100 hover:scale-105",
          ].join(" ")}
        />
      )}

      {(failed || !src) ? (
        <span
          className={[
            "text-black text-xl uppercase tracking-[0.18em]",
            "transition-opacity duration-300 ease-in-out hover:opacity-80",
            "whitespace-nowrap",
          ].join(" ")}
        >
          {name}
        </span>
      ) : (
        <span
          className={[
            "text-black text-lg uppercase tracking-[0.16em]",
            "transition-opacity duration-300 ease-in-out hover:opacity-80",
            "whitespace-nowrap",
          ].join(" ")}
        >
          {name}
        </span>
      )}
    </div>
  );
}


export default function LogoCarousel() {
  const logos = LOGOS;

  return (
    <section
      className="section border-y border-[var(--border-soft)] bg-black"
      style={{ paddingTop: 0, paddingBottom: 0 }}
    >
      <div className="container-main ">
                <div className="py-0">
          <span className="badge w-fit">Made possible by</span>
          <h2 className="heading-2 m-0"></h2>
        </div>
        <div className="w-full overflow-hidden relative">
          <div className="flex items-center gap-12 animate-logo-scroll">
            {logos.map((logo, idx) => (
              <LogoItem key={`${logo.name}-${idx}`} name={logo.name} src={logo.src} />
            ))}
          </div>
          <div
            className="flex items-center gap-12 animate-logo-scroll-next"
            aria-hidden="true"
          >
            {logos.map((logo, idx) => (
              <LogoItem key={`${logo.name}-clone-${idx}`} name={logo.name} src={logo.src} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

