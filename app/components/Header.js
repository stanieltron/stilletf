"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Header() {
  const { data } = useSession();
  const router = useRouter();

  const display =
    data?.user?.nickname || data?.user?.name || data?.user?.email || null;
  const isAuthed = !!data?.user?.id;

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const [mineCount, setMineCount] = useState(0);

  const [wallet, setWallet] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("walletAddress") || "";
      if (saved) setWallet(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!open || !isAuthed) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/portfolios?mine=1", { cache: "no-store" });
        const j = await r.json();
        const n = Array.isArray(j?.portfolios) ? j.portfolios.length : 0;
        if (alive) setMineCount(n);
      } catch {
        if (alive) setMineCount(0);
      }
    })();
    return () => { alive = false; };
  }, [open, isAuthed]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function openSignIn() {
    // Always send users to the main builder flow for sign-in
    router.push("/?auth=1#builder", { scroll: false });
  }

  async function connectMetamask() {
    try {
      if (!window?.ethereum) { alert("MetaMask not detected."); return; }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = (accounts && accounts[0]) || "";
      if (!addr) return;
      setWallet(addr);
      try { localStorage.setItem("walletAddress", addr); } catch {}
      try {
        await fetch("/api/me/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: addr }),
        });
      } catch {}
    } catch (e) {
      console.error(e);
      alert("Could not connect MetaMask.");
    }
  }

  function handleBrandClick(e) {
    e.preventDefault();
    router.push("/", { scroll: true });
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
  }

  return (
    <header className="relative w-full bg-[var(--bg-dark)] text-[var(--header-text)] border-b border-[var(--chrome)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-0 py-2 min-h-[70px] grid grid-cols-[auto_1fr_auto] items-center gap-4 w-full">
        {/* Left: logo/brand */}
        <Link
          href="/"
          onClick={handleBrandClick}
          className="text-inherit no-underline font-extrabold tracking-tight text-base sm:text-lg flex items-center gap-2"
        >
          <Image
            src="/logos/sona3.png"
            alt="Sona"
            width={210}
            height={70}
            priority
            className="h-[50px] w-[150px] object-cover"
          />
        </Link>

        {/* Center: nav */}
        <nav className="justify-self-end flex items-center text-sm sm:text-base gap-6 sm:gap-8">
          <Link href="/useretfs" className="text-inherit no-underline">
            Leaderboard
          </Link>
          <button
            type="button"
            onClick={openSignIn}
            className="text-inherit no-underline bg-transparent border-none p-0 cursor-pointer"
          >
            Sign in
          </button>
        </nav>

        {/* Right: auth / account */}
        <div className="justify-self-end relative ml-4 sm:ml-6" ref={menuRef}>
          {!isAuthed ? (
            <Link href="/btcetf" className="cta-btn cta-white no-underline">
              Launch App
            </Link>
          ) : (
            <>
              <button
                onClick={() => setOpen((v) => !v)}
                className="cta-btn cta-white"
                aria-haspopup="true"
                aria-expanded={open ? "true" : "false"}
                title="Account"
              >
                {display}
              </button>

              {open && (
                <div
                  className="absolute right-0 mt-2 w-56 border border-[var(--border)] bg-white text-black shadow-lg z-50"
                  role="menu"
                  aria-label="Account menu"
                >
                  <div className="p-2 grid gap-2">
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-[var(--bg-alt)] font-semibold"
                      onClick={connectMetamask}
                    >
                      Connect MetaMask
                    </button>
                    <Link
                      href="/useretfs"
                      className="block px-3 py-2 hover:bg-[var(--bg-alt)] font-semibold no-underline text-black"
                      onClick={() => setOpen(false)}
                    >
                      My ETFs
                    </Link>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-[var(--bg-alt)] font-semibold text-[var(--neg)]"
                      onClick={() => { setOpen(false); signOut(); }}
                    >
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
