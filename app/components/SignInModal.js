"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";

/* Make a safe, provider-agnostic nickname seed */
function toNicknameSeed(value) {
  const src = (value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase()
    .slice(0, 32);
  return src;
}

export default function SignInModal() {
  const router = useRouter();
  const params = useSearchParams();
  const wantsOpen = params.get("auth") === "1";

  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";

  const hasUserId = !!session?.user?.id;
  const userExistsFlag = !!session?.user?.exists;
  const userExists = hasUserId || userExistsFlag;

  const needsSignup = isAuthed && !userExists;

  const [open, setOpen] = useState(wantsOpen);
  const [nickname, setNickname] = useState("");

  useEffect(() => setOpen(wantsOpen), [wantsOpen]);

  useEffect(() => {
    if (needsSignup) {
      const seedSource =
        session?.user?.name ||
        session?.providerAccountId ||
        session?.user?.email ||
        "user";
      setNickname((n) => n || toNicknameSeed(seedSource));
    }
  }, [needsSignup, session?.user?.name, session?.user?.email, session?.providerAccountId]);

  function closeModal() {
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    router.replace(url.pathname + (url.search ? url.search : "") + window.location.hash, { scroll: false });
  }

  async function handleRegister(e) {
    e.preventDefault();
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Registration failed");
      return;
    }
    try { await fetch("/api/auth/session?update", { cache: "no-store" }); } catch {}
    try { router.refresh(); } catch {}
    if (typeof window !== "undefined") window.dispatchEvent(new Event("visibilitychange"));
    closeModal();
  }

  function handleContinue() {
    try { router.refresh(); } catch {}
    closeModal();
  }

  function startOAuth(provider) {
    const base = typeof window !== "undefined" ? window.location.pathname : "/";
    const callbackUrl = `${base}?auth=1&skipIntro=1#builder`;
    signIn(provider, { callbackUrl });
  }

  if (!open) return null;

  const displayName =
    session?.user?.nickname ||
    session?.user?.name ||
    (session?.providerAccountId ? `user_${String(session.providerAccountId).slice(-6)}` : null) ||
    session?.user?.email ||
    "User";

  return (
    <div data-auth-modal>
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-[rgba(0,0,0,0.5)] z-[9998]"
        onClick={closeModal}
      />
      {/* dialog */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,480px)] bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.25)] z-[9999] p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in or register"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="m-0 text-[18px] font-semibold">
            {isAuthed ? (needsSignup ? "Finish signing up" : "You're signed in") : "Log in or sign up"}
          </h2>
          <button
            onClick={closeModal}
            aria-label="Close"
            className="border-0 bg-transparent text-[18px] cursor-pointer"
          >
            ✕
          </button>
        </div>

        {!isAuthed ? (
          // Logged out → offer providers
          <div className="grid gap-2.5">
            <button
              onClick={() => startOAuth("google")}
              className="block w-full px-[14px] py-[10px] rounded-lg border border-[var(--border)] bg-white cursor-pointer font-medium text-left"
            >
              Continue with Google
            </button>
            <button
              onClick={() => startOAuth("github")}
              className="block w-full px-[14px] py-[10px] rounded-lg border border-[var(--border)] bg-white cursor-pointer font-medium text-left"
            >
              Continue with GitHub
            </button>
          </div>
        ) : needsSignup ? (
          // First-time signup
          <div className="grid gap-3">
            <div className="border border-[var(--border-soft)] rounded-lg p-2.5">
              <div className="text-xs opacity-75">Signing up as</div>
              <div className="font-semibold">{displayName}</div>
            </div>

            <form onSubmit={handleRegister} className="grid gap-2.5">
              <label>
                <div className="text-xs opacity-75">Choose your nickname</div>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="nickname"
                  maxLength={32}
                  required
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--border)]"
                />
              </label>
              <button
                type="submit"
                className="block w-full px-[14px] py-[10px] rounded-lg border border-[var(--text)] bg-[var(--text)] text-white cursor-pointer font-medium"
              >
                Create account
              </button>
            </form>

            <button
              onClick={() => signOut()}
              className="block w-full px-[14px] py-[10px] rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] cursor-pointer font-medium text-left"
            >
              Sign out
            </button>
          </div>
        ) : (
          // Returning user
          <div className="grid gap-3">
            <div className="border border-[var(--border-soft)] rounded-lg p-2.5">
              <div className="text-xs opacity-75">Signed in as</div>
              <div className="font-semibold">{displayName}</div>
            </div>

            <button
              onClick={handleContinue}
              className="block w-full px-[14px] py-[10px] rounded-lg border border-[var(--text)] bg-[var(--text)] text-white cursor-pointer font-medium"
            >
              Continue
            </button>

            <button
              onClick={() => signOut()}
              className="block w-full px-[14px] py-[10px] rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] cursor-pointer font-medium text-left"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
