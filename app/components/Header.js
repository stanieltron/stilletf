"use client";

import Link from "next/link";
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
    return () => {
      alive = false;
    };
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
    const base = typeof window !== "undefined" ? window.location.pathname : "/";
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    params.set("auth", "1");
    const qs = params.toString();
    const target = qs ? `${base}?${qs}` : base;
    try {
      router.push(target, { scroll: false });
    } catch {
      if (typeof window !== "undefined") window.location.assign(target);
    }
  }

  async function connectMetamask() {
    try {
      if (!window?.ethereum) {
        alert("MetaMask not detected.");
        return;
      }
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const addr = (accounts && accounts[0]) || "";
      if (!addr) return;
      setWallet(addr);
      try {
        localStorage.setItem("walletAddress", addr);
      } catch {}
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
      requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      );
    }
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        {/* Left: logo/brand */}
        <Link
          href="/"
          onClick={handleBrandClick}
          className="brand"
        >
          STILLWATER
        </Link>

        {/* Center: nav */}
        <nav className="main-nav">
          <Link href="/ETFs" className="nav-link">
            Still-ETFs
          </Link>
          <Link href="/useretfs" className="nav-link">
            Leaderboard
          </Link>
        </nav>

        {/* Right: auth / account */}
        <div className="account-area" ref={menuRef}>
          {!isAuthed ? (
            <button
              className="btn btn-outline"
              onClick={openSignIn}
            >
              Sign in
            </button>
          ) : (
            <>
              <button
                onClick={() => setOpen((v) => !v)}
                className="account-button"
                aria-haspopup="true"
                aria-expanded={open ? "true" : "false"}
                title="Account"
              >
                {display}
              </button>

              {open && (
                <div
                  className="dropdown"
                  role="menu"
                  aria-label="Account menu"
                >
                  <button onClick={connectMetamask}>Connect MetaMask</button>
                  <Link href="/useretfs" onClick={() => setOpen(false)}>
                    My ETFs
                  </Link>
                  <button
                    onClick={() => {
                      setOpen(false);
                      signOut();
                    }}
                    style={{ color: "var(--neg)" }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
