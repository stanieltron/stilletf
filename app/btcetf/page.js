"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import Header from "../components/Header";
import Footer from "../components/Footer";

const HOW_TO_WALLET_HREF = "/wallets";
const HOW_IT_WORKS_HREF = "/how-it-works";
const DEFAULT_CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";
const DEFAULT_WBTC_DECIMALS = Number(process.env.NEXT_PUBLIC_WBTC_DECIMALS || 8);
const REWARD_DECIMALS = Number(process.env.NEXT_PUBLIC_REWARD_DECIMALS || 6);
const REWARD_SYMBOL = process.env.NEXT_PUBLIC_REWARD_SYMBOL || "USDC";
const TARGET_CHAIN_HEX = `0x${Number(DEFAULT_CHAIN_ID).toString(16)}`;
const ENV_ADDRESSES = {
  vault: process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS || "",
  wbtc: process.env.NEXT_PUBLIC_WBTC_ADDRESS || "",
};

const STAKING_VAULT_ABI = [
  "function stake(uint256 amountUA) external returns (uint256)",
  "function unstake(uint256 shares) external returns (uint256)",
  "function claim() external returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function sharePrice() external view returns (uint256)",
  "function getPendingRewards(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
];

function formatBigAmount(value, decimals, options = {}) {
  const { minimumFractionDigits = 2, maximumFractionDigits = 6 } = options;
  try {
    const asNum = Number(formatUnits(value || 0n, decimals));
    if (!Number.isFinite(asNum)) return "0";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(asNum);
  } catch {
    return "0";
  }
}

async function safeRead(promise, fallback) {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default function BTCETFPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [vault, setVault] = useState(null);
  const [wbtc, setWbtc] = useState(null);
  const [wbtcDecimals, setWbtcDecimals] = useState(DEFAULT_WBTC_DECIMALS);
  const [addresses, setAddresses] = useState({ vault: "", wbtc: "" });

  const [loadingData, setLoadingData] = useState(false);
  const [err, setErr] = useState("");
  const [networkOk, setNetworkOk] = useState(true);
  const [actionState, setActionState] = useState({ phase: "idle", label: "" });

  const [vaultStats, setVaultStats] = useState({
    totalAssets: 0n,
    totalSupply: 0n,
    sharePrice: 0n,
    decimals: DEFAULT_WBTC_DECIMALS,
  });
  const [userStats, setUserStats] = useState({
    shares: 0n,
    pendingRewards: 0n,
    walletBalance: 0n,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  const ready = useMemo(
    () => !!walletAddress && !!vault && !!wbtc && !!addresses.vault && !!addresses.wbtc && networkOk,
    [walletAddress, vault, wbtc, addresses, networkOk]
  );

  const actionBusy = actionState.phase !== "idle";
  const showInlineStatus = actionBusy && !dialogOpen;
  const vaultHoldings = useMemo(
    () => formatBigAmount(userStats.shares, vaultStats.decimals, { maximumFractionDigits: 8 }),
    [userStats.shares, vaultStats.decimals]
  );
  const vaultTvl = useMemo(
    () => formatBigAmount(vaultStats.totalAssets, vaultStats.decimals, { maximumFractionDigits: 4 }),
    [vaultStats.totalAssets, vaultStats.decimals]
  );
  const yieldAmount = useMemo(
    () => formatBigAmount(userStats.pendingRewards, REWARD_DECIMALS, { maximumFractionDigits: 4 }),
    [userStats.pendingRewards]
  );
  const walletBalance = useMemo(
    () => formatBigAmount(userStats.walletBalance, wbtcDecimals, { maximumFractionDigits: 8 }),
    [userStats.walletBalance, wbtcDecimals]
  );

  useEffect(() => {
    setAddresses(ENV_ADDRESSES);
    if (!ENV_ADDRESSES.vault || !ENV_ADDRESSES.wbtc) {
      setErr(
        "Vault/WBTC address missing in env. Set NEXT_PUBLIC_STAKING_VAULT_ADDRESS and NEXT_PUBLIC_WBTC_ADDRESS."
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const eth = window.ethereum;
    eth
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts && accounts[0]) initializeWallet(accounts[0]);
      })
      .catch(() => {});

    const onAccountsChanged = (accounts) => {
      if (!accounts || !accounts.length) {
        resetWallet();
        return;
      }
      initializeWallet(accounts[0]);
    };
    const onChainChanged = () => {
      setActionState({ phase: "idle", label: "" });
      refresh();
    };
    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);
    return () => {
      eth.removeListener("accountsChanged", onAccountsChanged);
      eth.removeListener("chainChanged", onChainChanged);
    };
  }, [addresses.vault, addresses.wbtc]);

  useEffect(() => {
    if (walletAddress && addresses.vault && addresses.wbtc) {
      initializeWallet(walletAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.vault, addresses.wbtc]);

  useEffect(() => {
    if (ready) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const resetWallet = () => {
    setWalletAddress("");
    setProvider(null);
    setSigner(null);
    setVault(null);
    setWbtc(null);
    setNetworkOk(true);
  };

  async function ensureCorrectChain(nextProvider) {
    try {
      const network = await nextProvider.getNetwork();
      if (network.chainId?.toString() === DEFAULT_CHAIN_ID) return true;
      if (!window.ethereum?.request) return false;
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TARGET_CHAIN_HEX }],
      });
      return true;
    } catch (e) {
      console.error("chain switch failed", e);
      return false;
    }
  }

  async function initializeWallet(address) {
    if (!window.ethereum) {
      setErr("MetaMask not detected.");
      return;
    }
    if (!addresses.vault || !addresses.wbtc) {
      setErr("Vault/token address not configured.");
      return;
    }
    try {
      setErr("");
      const nextProvider = new BrowserProvider(window.ethereum);
      const nextSigner = await nextProvider.getSigner();

      const chainReady = await ensureCorrectChain(nextProvider);
      setNetworkOk(chainReady);
      if (!chainReady) {
        setErr(`Switch to chain ${DEFAULT_CHAIN_ID} to continue.`);
      }

      setProvider(nextProvider);
      setSigner(nextSigner);
      setWalletAddress(address);

      const vaultContract = new Contract(addresses.vault, STAKING_VAULT_ABI, nextSigner);
      const wbtcContract = new Contract(addresses.wbtc, ERC20_ABI, nextSigner);
      setVault(vaultContract);
      setWbtc(wbtcContract);

      try {
        const dec = await wbtcContract.decimals();
        if (Number.isFinite(Number(dec))) setWbtcDecimals(Number(dec));
      } catch {
        setWbtcDecimals(DEFAULT_WBTC_DECIMALS);
      }

      await refresh(vaultContract, wbtcContract, address);
    } catch (e) {
      console.error(e);
      setErr("Failed to initialize wallet. Please retry.");
    }
  }

  const openDialog = (mode = "deposit") => {
    setDialogMode(mode);
    setDialogOpen(true);
    setAmount("");
    setErr("");
  };

  async function connectWallet() {
    if (typeof window === "undefined" || !window.ethereum) {
      setErr("Please install MetaMask to continue.");
      return;
    }
    try {
      setErr("");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts[0]) {
        await initializeWallet(accounts[0]);
      }
    } catch (e) {
      console.error(e);
      setErr("Wallet connection was rejected.");
    }
  }

  async function refresh(nextVault = vault, nextWbtc = wbtc, address = walletAddress) {
    if (!nextVault || !nextWbtc || !address || !provider) return;
    try {
      setLoadingData(true);
      setErr("");
      const [network, shares, totalAssetsRaw, totalSupply, sharePrice, pendingRewards, walletBal, vaultDecimals] =
        await Promise.all([
          provider.getNetwork(),
          safeRead(nextVault.balanceOf(address), 0n),
          safeRead(nextVault.totalAssets(), 0n),
          safeRead(nextVault.totalSupply(), 0n),
          safeRead(nextVault.sharePrice(), 0n),
          safeRead(nextVault.getPendingRewards(address), 0n),
          safeRead(nextWbtc.balanceOf(address), 0n),
          safeRead(nextVault.decimals(), BigInt(wbtcDecimals)),
        ]);
      const chainMatches = network.chainId?.toString() === DEFAULT_CHAIN_ID;
      setNetworkOk(chainMatches);
      if (!chainMatches) {
        setErr(`Wrong network. Connect to chain ${DEFAULT_CHAIN_ID}.`);
        return;
      }
      const shareScale = 10n ** BigInt(Number(vaultDecimals) || wbtcDecimals);
      const totalAssets =
        totalSupply === 0n ? 0n : (sharePrice * totalSupply) / shareScale || totalAssetsRaw;
      setVaultStats({
        totalAssets,
        totalSupply,
        sharePrice,
        decimals: Number(vaultDecimals) || wbtcDecimals,
      });
      setUserStats({ shares, pendingRewards, walletBalance: walletBal });
      setErr("");
    } catch (e) {
      console.error(e);
      setErr("Could not fetch vault data.");
    } finally {
      setLoadingData(false);
    }
  }

  async function handleSubmitAction() {
    if (actionBusy) return;
    if (!ready) {
      setErr("Connect your wallet first.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setErr("Enter an amount greater than zero.");
      return;
    }
    try {
      setErr("");
      setActionState({ phase: "approval", label: "Waiting for your wallet" });
      const value = parseUnits(amount, wbtcDecimals);

      if (dialogMode === "deposit") {
        const allowance = await wbtc.allowance(walletAddress, addresses.vault);
        if (allowance < value) {
          const approveTx = await wbtc.approve(addresses.vault, value);
          setActionState({ phase: "pending", label: "Approval pending on-chain" });
          await approveTx.wait();
        }
        setActionState({ phase: "pending", label: "Depositing WBTC..." });
        const tx = await vault.stake(value);
        await tx.wait();
      } else {
        const sharesNeeded = value;
        if (sharesNeeded === 0n) {
          setErr("No shares available to withdraw.");
          setActionState({ phase: "idle", label: "" });
          return;
        }
        if (sharesNeeded > userStats.shares) {
          setErr("You do not have enough staked balance for that amount.");
          setActionState({ phase: "idle", label: "" });
          return;
        }
        setActionState({ phase: "pending", label: "Withdrawing from vault..." });
        const tx = await vault.unstake(sharesNeeded);
        await tx.wait();
      }
      setActionState({ phase: "success", label: "Confirmed on-chain" });
      setAmount("");
      setDialogOpen(false);
      await refresh();
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Transaction failed.");
    } finally {
      setTimeout(() => setActionState({ phase: "idle", label: "" }), 800);
    }
  }

  async function withdrawYield() {
    if (actionBusy) return;
    if (!ready) {
      setErr("Connect your wallet first.");
      return;
    }
    try {
      setErr("");
      setActionState({ phase: "pending", label: "Claiming yield..." });
      const tx = await vault.claim();
      await tx.wait();
      setActionState({ phase: "success", label: "Yield claimed" });
      await refresh();
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Could not withdraw yield.");
    } finally {
      setTimeout(() => setActionState({ phase: "idle", label: "" }), 800);
    }
  }

  return (
    <div className="min-h-screen flex flex-col text-[var(--text)]">
      <Header />
      <main className="flex-1 flex flex-col pt-6 md:pt-8">
        <div className="sona-container pb-8 flex flex-col gap-6 flex-1">
          <header className="flex flex-col md:flex-row items-start justify-between gap-6 pb-2">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="sona-chip">BTC ETF</div>
                <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
                  <span
                    className={`h-2 w-2 rounded-full ${loadingData ? "bg-[var(--accent)] animate-pulse" : "bg-[var(--pos)]"}`}
                  />
                  <span>{loadingData ? "Updating" : "Live data"}</span>
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Earn USD yield for holding crypto assets
              </h1>
              <p className="text-body max-w-2xl">
                Stake WBTC into the Sona vault, keep your Bitcoin, and collect {REWARD_SYMBOL} yield backed by disciplined strategy.
              </p>
              <div className="sona-divider max-w-md" aria-hidden />
            </div>
            <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
              <button
                onClick={walletAddress ? resetWallet : connectWallet}
                className="sona-btn sona-btn-ghost justify-center"
              >
                <span
                  className={`h-2 w-2 rounded-full ${walletAddress && networkOk ? "bg-[var(--pos)]" : "bg-[var(--accent)]"}`}
                />
                {walletAddress ? shorten(walletAddress) : "Connect wallet"}
              </button>
              <Link
                href={HOW_TO_WALLET_HREF}
                className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--accent)] text-right"
              >
                How to use wallets
              </Link>
            </div>
          </header>

          {err && (
            <div className="sona-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {err}
            </div>
          )}

          <div className="flex flex-col flex-1 justify-center">
            <section className="sona-card space-y-6">
              <div className="grid md:grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-base md:text-lg font-semibold tracking-tight">
                    My WBTC in the fund
                  </span>
                  <span className="text-xs text-[var(--muted)]">Wallet: {walletBalance} WBTC</span>
                </div>
                <div className="flex items-center justify-center">
                  <span
                    className="text-4xl md:text-5xl font-semibold text-[var(--accent)] tabular-nums font-mono text-center min-w-[170px]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {vaultHoldings} BTC
                  </span>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => openDialog("deposit")}
                    disabled={!ready}
                    className="sona-btn sona-btn-primary disabled:opacity-50"
                  >
                    Add WBTC
                  </button>
                  <button
                    onClick={() => openDialog("withdraw")}
                    disabled={!ready || userStats.shares === 0n}
                    className="sona-btn sona-btn-outline disabled:opacity-50"
                  >
                    Withdraw
                  </button>
                </div>
              </div>

              <div className="sona-divider w-full" />

              <div className="grid md:grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-base md:text-lg font-semibold tracking-tight">
                    My {REWARD_SYMBOL} yield
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMoreInfo((prev) => !prev)}
                    className="sona-pill sona-pill-gold"
                    title="Show more info"
                  >
                    Details
                  </button>
                </div>
                <div className="flex items-center justify-center">
                  <span
                    className="text-4xl md:text-5xl font-semibold text-[var(--pos)] tabular-nums font-mono text-center min-w-[170px]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {yieldAmount} {REWARD_SYMBOL}
                  </span>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={withdrawYield}
                    disabled={!ready || userStats.pendingRewards === 0n}
                    className="sona-btn sona-btn-ghost disabled:opacity-50"
                  >
                    Claim
                  </button>
                </div>
              </div>

              {showInlineStatus && <ActionStatus state={actionState} />}

              {showMoreInfo && (
                <div className="border-t border-[rgba(17,19,24,0.08)] pt-4 space-y-2 text-sm">
                  <p className="text-[var(--muted)]">More info</p>
                  <div className="space-y-2">
                    <DataStat label="Total WBTC in fund" value={`${vaultTvl} BTC`} />
                    <DataStat
                      label="Total USDC claimed to date"
                      value="Not available from contract"
                    />
                    <DataStat
                      label="Vault address"
                      value={addresses.vault ? shorten(addresses.vault) : "Not set"}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="mt-4 text-center">
            <Link
              href={HOW_IT_WORKS_HREF}
              className="text-sm uppercase tracking-[0.18em] text-[var(--muted)] hover:text-[var(--accent)]"
            >
              How it works
            </Link>
          </div>
        </div>

        {dialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30 px-4">
            <div className="sona-card-dark max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">
                    {dialogMode === "deposit" ? "Add WBTC" : "Withdraw WBTC"}
                  </p>
                  <h3 className="text-xl font-semibold text-white">
                    {dialogMode === "deposit" ? "Deposit" : "Withdraw"}
                  </h3>
                </div>
                <button
                  onClick={() => setDialogOpen(false)}
                  className="text-white/70 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div>
                <div className="mb-4 flex gap-2 rounded-xl bg-[rgba(255,255,255,0.05)] p-1 border border-[rgba(255,255,255,0.08)]">
                  <button
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      dialogMode === "deposit"
                        ? "bg-white text-[var(--text)] shadow"
                        : "text-white/80 hover:text-white"
                    }`}
                    onClick={() => setDialogMode("deposit")}
                  >
                    Deposit
                  </button>
                  <button
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      dialogMode === "withdraw"
                        ? "bg-white text-[var(--text)] shadow"
                        : "text-white/80 hover:text-white"
                    }`}
                    onClick={() => setDialogMode("withdraw")}
                  >
                    Withdraw
                  </button>
                </div>

                <label className="text-sm text-white/80">Amount (WBTC)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-2 bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] rounded-xl px-3 py-2 text-white outline-none focus:border-[var(--accent)] focus:ring-[var(--accent)]/30"
                  placeholder="0.0"
                />

                <div className="mt-4 text-xs text-white/70 space-y-1">
                  <p>Wallet: {walletBalance} WBTC</p>
                  <p>Vault balance: {vaultHoldings} BTC</p>
                </div>

                {actionBusy && <ActionStatus state={actionState} dark />}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setDialogOpen(false)}
                    className="sona-btn sona-btn-outline bg-transparent border border-[rgba(255,255,255,0.2)] text-white hover:text-[var(--accent-text)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitAction}
                    disabled={actionBusy || !ready}
                    className="sona-btn sona-btn-primary disabled:opacity-50"
                  >
                    {dialogMode === "deposit" ? "Confirm deposit" : "Confirm withdrawal"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function shorten(address = "") {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function ActionStatus({ state, dark = false }) {
  if (!state || state.phase === "idle") return null;
  const tone =
    state.phase === "success"
      ? dark ? "text-[var(--accent-soft)]" : "text-[var(--pos)]"
      : dark ? "text-[var(--accent-soft)]" : "text-[var(--accent)]";
  const showSpinner = state.phase !== "success";
  const baseClasses = dark
    ? "mt-4 flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-xs text-white"
    : "mt-4 flex items-center gap-2 rounded-xl border border-[rgba(17,19,24,0.08)] bg-[rgba(255,255,255,0.9)] px-3 py-2 text-xs";
  return (
    <div className={baseClasses}>
      {showSpinner && (
        <span className="h-3 w-3 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      )}
      {!showSpinner && <span className="h-2 w-2 rounded-full bg-[var(--pos)]" />}
      <span className={tone}>{state.label}</span>
    </div>
  );
}

function DataStat({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[rgba(17,19,24,0.08)] bg-[rgba(255,255,255,0.92)] px-3 py-2">
      <span className="text-[var(--muted)] text-sm">{label}</span>
      <span className="text-[var(--text)] font-mono text-sm">{value}</span>
    </div>
  );
}
