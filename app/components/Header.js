"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const imgNewTwitter = "/assets/social_twitter.svg";
const imgLinkedin02 = "/assets/social_linkedin.svg";
const imgTelegram = "/assets/social_telegram.svg";

export default function Header() {
  const { data } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const isAuthed = !!data?.user?.id;
  const isWalletFirstRoute = useMemo(() => {
    const normalized = (pathname || "").toLowerCase();
    return normalized === "/etfs" || normalized === "/my-earnings";
  }, [pathname]);
  const username =
    data?.user?.nickname ||
    data?.user?.name ||
    data?.user?.email?.split?.("@")?.[0] ||
    "Account";

  function openSignIn() {
    router.push("/?auth=1#builder", { scroll: false });
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

  useEffect(() => {
    if (!isWalletFirstRoute || isAuthed || typeof window === "undefined") return;
    const storageKey = "stillwater.walletAddress";
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setWalletAddress(saved);

    const eth = window.ethereum;
    if (!eth?.request) {
      setWalletAddress("");
      window.localStorage.removeItem(storageKey);
      return;
    }

    let alive = true;
    const refreshWallet = async () => {
      try {
        const accounts = await eth.request({ method: "eth_accounts" });
        if (!alive) return;
        const account = accounts?.[0] || "";
        setWalletAddress(account);
        if (account) {
          window.localStorage.setItem(storageKey, account);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch {
        if (!alive) return;
        setWalletAddress("");
      }
    };

    refreshWallet();
    eth.on("accountsChanged", refreshWallet);
    eth.on("chainChanged", refreshWallet);
    return () => {
      alive = false;
      eth.removeListener("accountsChanged", refreshWallet);
      eth.removeListener("chainChanged", refreshWallet);
    };
  }, [isWalletFirstRoute, isAuthed]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  async function connectWallet() {
    if (typeof window === "undefined") return;
    const eth = window.ethereum;
    if (!eth?.request) {
      window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const account = accounts?.[0] || "";
      setWalletAddress(account);
      if (account) {
        window.localStorage.setItem("stillwater.walletAddress", account);
        setMenuOpen(true);
      }
    } catch {
      // user rejected or wallet unavailable
    }
  }

  function renderMenuButton(label) {
    return (
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="h-10 px-4 inline-flex items-center justify-center gap-2 border border-[#f2ebde] bg-white/70 text-[#201909] text-sm font-medium rounded-3xl hover:bg-white transition-all"
      >
        <span className="max-w-[180px] truncate">{label}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 text-[#645c4a] transition-transform ${menuOpen ? "rotate-180" : ""}`}
          fill="none"
        >
          <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  function renderWalletEntry() {
    if (!isWalletFirstRoute) {
      if (isAuthed) {
        return (
          <Link
            href="/useretfs"
            className="h-10 px-5 inline-flex items-center justify-center border border-[#201909] text-[#201909] text-base font-medium rounded-3xl hover:bg-[#201909] hover:text-white transition-all active:scale-95"
          >
            My Portfolio
          </Link>
        );
      }
      return (
        <button
          type="button"
          onClick={openSignIn}
          className="h-10 px-5 inline-flex items-center justify-center border border-[#201909] text-[#201909] text-base font-medium rounded-3xl hover:bg-[#201909] hover:text-white transition-all active:scale-95"
        >
          Sign in
        </button>
      );
    }

    if (isAuthed) {
      return renderMenuButton(username);
    }

    if (walletAddress) {
      return renderMenuButton(`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
    }

    return (
      <button
        type="button"
        onClick={connectWallet}
        className="h-10 px-5 inline-flex items-center justify-center border border-[#201909] text-[#201909] text-base font-medium rounded-3xl hover:bg-[#201909] hover:text-white transition-all active:scale-95"
      >
        Connect
      </button>
    );
  }

  return (
    <header className="w-full sticky top-0 z-40 bg-[#f7f3eb]/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link
          href="/"
          onClick={handleBrandClick}
          className="font-semibold text-[26px] tracking-[-0.78px] text-[#201909] hover:opacity-80 transition-opacity"
        >
          stillwater
        </Link>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center w-[120px] h-10 gap-0">
            <a
              href="https://x.com/sonaetf"
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 bg-[#F7F3EB] rounded-full flex items-center justify-center text-[#201909] transition-all hover:bg-[#efe6d8] hover:scale-[1.04] active:scale-95"
              aria-label="Stillwater on X"
            >
              <img src={imgNewTwitter} alt="X logo" className="h-9 w-9" />
            </a>
            <a
              href="https://www.linkedin.com/company/sona-etf/"
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 bg-[#F7F3EB] rounded-full flex items-center justify-center text-[#201909] transition-all hover:bg-[#efe6d8] hover:scale-[1.04] active:scale-95"
              aria-label="Stillwater on LinkedIn"
            >
              <img
                src={imgLinkedin02}
                alt="LinkedIn logo"
                className="h-9 w-9"
              />
            </a>
            <a
              href="https://t.me/sonaetf"
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 bg-[#F7F3EB] rounded-full flex items-center justify-center text-[#201909] transition-all hover:bg-[#efe6d8] hover:scale-[1.04] active:scale-95"
              aria-label="Stillwater on Telegram"
            >
              <img src={imgTelegram} alt="Telegram logo" className="h-9 w-9" />
            </a>
          </div>

          <div ref={menuRef} className="relative">
            {renderWalletEntry()}
            {menuOpen && isWalletFirstRoute && (
              <div className="absolute right-0 mt-2 min-w-[180px] rounded-xl border border-[#e6dccd] bg-white shadow-lg p-1.5">
                <Link
                  href="/my-earnings"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-[#201909] hover:bg-[#f7f3eb] transition-colors"
                >
                  My earnings
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
