"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { openMetaMaskForCurrentDevice } from "../../lib/metamask";

const imgNewTwitter = "/assets/social_twitter.svg";
const imgLinkedin02 = "/assets/social_linkedin.svg";
const imgTelegram = "/assets/social_telegram.svg";

export default function Header() {
  const { data, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const isAuthed = status === "authenticated";
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
    if (typeof window === "undefined") return;
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
  }, []);

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
      openMetaMaskForCurrentDevice();
      return;
    }
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const account = accounts?.[0] || "";
      setWalletAddress(account);
      if (account) {
        window.localStorage.setItem("stillwater.walletAddress", account);
        setMenuOpen(false);
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

  function handleMenuSignOut() {
    setMenuOpen(false);
    void signOut();
  }

  function getShortWalletLabel(address = "") {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function closeAndSignIn() {
    setMenuOpen(false);
    openSignIn();
  }

  async function closeAndConnectWallet() {
    setMenuOpen(false);
    await connectWallet();
  }

  function renderUserMenuItem() {
    if (isAuthed) {
      return (
        <div className="block rounded-lg px-3 py-2 text-sm font-medium text-[#201909] bg-[#f7f3eb]">
          {username}
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={closeAndSignIn}
        className="block w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-[#201909] hover:bg-[#f7f3eb] transition-colors"
      >
        Sign in
      </button>
    );
  }

  function renderWalletMenuItem() {
    if (walletAddress) {
      return (
        <div className="block rounded-lg px-3 py-2 text-sm font-medium text-[#201909] bg-[#f7f3eb]">
          MetaMask: {getShortWalletLabel(walletAddress)}
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={closeAndConnectWallet}
        className="block w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-[#201909] hover:bg-[#f7f3eb] transition-colors"
      >
        Connect MetaMask
      </button>
    );
  }

  function renderMenuItems() {
    const first = isWalletFirstRoute ? renderWalletMenuItem() : renderUserMenuItem();
    const second = isWalletFirstRoute ? renderUserMenuItem() : renderWalletMenuItem();
    return (
      <>
        {first}
        {second}
        {walletAddress ? (
          <Link
            href="/my-earnings"
            onClick={() => setMenuOpen(false)}
            className="mt-1 block rounded-lg px-3 py-2 text-sm font-medium text-[#201909] hover:bg-[#f7f3eb] transition-colors"
          >
            My earnings
          </Link>
        ) : null}
        {isAuthed ? (
          <button
            type="button"
            onClick={handleMenuSignOut}
            className="mt-1 block w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-[#201909] hover:bg-[#f7f3eb] transition-colors"
          >
            Sign out
          </button>
        ) : null}
      </>
    );
  }

  function renderWalletEntry() {
    const walletLabel = walletAddress ? getShortWalletLabel(walletAddress) : "Connect";
    const showConnectAction = isWalletFirstRoute && !walletAddress;
    const showSignInAction = !isWalletFirstRoute && !isAuthed;

    if (showConnectAction) {
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

    if (showSignInAction) {
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

    const primaryLabel = isWalletFirstRoute ? walletLabel : username;
    return renderMenuButton(primaryLabel);
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
              href="https://stilletf.com"
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 bg-[#F7F3EB] rounded-full flex items-center justify-center text-[#201909] transition-all hover:bg-[#efe6d8] hover:scale-[1.04] active:scale-95"
              aria-label="Stillwater on X"
            >
              <img src={imgNewTwitter} alt="X logo" className="h-9 w-9" />
            </a>
            <a
              href="https://stilletf.com"
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
              href="https://stilletf.com"
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
            {menuOpen && (
              <div className="absolute right-0 mt-2 min-w-[180px] rounded-xl border border-[#e6dccd] bg-white shadow-lg p-1.5">
                {renderMenuItems()}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
