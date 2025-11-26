"use client";

import { useState } from "react";

/**
 * LogoCarousel
 * Black & white, auto-scrolling carousel for protocol / partner logos,
 * with graceful fallback to text when an image is missing/broken.
 */
const LOGOS = [
    //  { name: "Ethereum", src: "/logos/ethereum.svg" },
  { name: "Ethereum", src: "/logos/ethereum.svg" },
  { name: "BOB", src: "../logos/bob.svg" },
  { name: "Mantle", src: "../../../logos/mantle.svg" },
  { name: "MetaMask", src: "../../logos/metamask.svg" },
  { name: "Aave", src: "../../logos/aave.svg" },
  { name: "Lido", src: "../../logos/lido.svg" },
  { name: "Fluid", src: "../../logos/fluid.svg"}, // no logo yet → text
  { name: "WETH", src: "../../logos/weth.svg" },
  { name: "WBTC", src: "../../logos/wbtc.svg" },
  { name: "BTC", src: "../../logos/btc.svg" },
  { name: "Trezor", src: "../../logos/trezor.svg" },
  { name: "Daonysus" }, // text for now
  { name: "Solidity", src: "../../logos/solidity.svg" },
];

function LogoItem({ name, src }) {
  const [failed, setFailed] = useState(!src);

  return (
    <div className="flex items-center justify-center shrink-0 min-w-[160px]"> 
      {!failed && src && (
        <img
          src={src}
          alt={name}
          onError={() => setFailed(true)}
          className={[
            "h-20 max-w-[240px] object-contain",            // ⬅️ 2× larger
            "filter grayscale invert contrast-110 opacity-80",
            "transition-transform transition-opacity duration-300 ease-in-out",
            "hover:opacity-100 hover:scale-105",
          ].join(" ")}
        />
      )}

      {(failed || !src) && (
        <span
          className={[
            "text-white text-sm uppercase tracking-[0.16em] opacity-80", 
            "transition-opacity duration-300 ease-in-out hover:opacity-100",
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
  const logos = [...LOGOS, ...LOGOS]; // duplicate for seamless scroll

  return (
    <section className="section border-y border-[var(--border-soft)] bg-black">
      <div className="container-main ">
        <div className="w-full overflow-hidden">
          <div className="flex items-center gap-12 animate-logo-scroll">
            {logos.map((logo, idx) => (
              <LogoItem key={`${logo.name}-${idx}`} name={logo.name} src={logo.src} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
