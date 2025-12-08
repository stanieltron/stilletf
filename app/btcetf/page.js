<<<<<<< HEAD
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import Footer from "../components/Footer";

const HOW_TO_WALLET_HREF = "/wallets";
const HOW_IT_WORKS_HREF = "/how-it-works";
const DEFAULT_CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";
const DEFAULT_WBTC_DECIMALS = Number(process.env.NEXT_PUBLIC_WBTC_DECIMALS || 8);
const REWARD_DECIMALS = Number(process.env.NEXT_PUBLIC_REWARD_DECIMALS || 6);
const REWARD_SYMBOL = process.env.NEXT_PUBLIC_REWARD_SYMBOL || "USDC";
const TARGET_CHAIN_HEX = `0x${Number(DEFAULT_CHAIN_ID).toString(16)}`;

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
    const loadConfig = async () => {
      try {
        const res = await fetch(`/api/testnetstatus-config?chainId=${DEFAULT_CHAIN_ID}`);
        if (res.ok) {
          const json = await res.json();
          setAddresses((prev) => ({
            ...prev,
            vault: json.addresses?.vault || prev.vault,
            wbtc: json.addresses?.wbtc || prev.wbtc,
          }));
        }
      } catch (e) {
        console.error("config fetch failed", e);
      }
    };
    loadConfig();
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
    <div className="min-h-screen bg-gradient-to-b from-[#f7f9fc] via-[#eef2f8] to-[#e8edf7] text-slate-900 flex flex-col">
      <main className="flex-1 flex flex-col">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6 flex-1">
          <header className="flex items-start justify-between gap-6 pb-2">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <p className="uppercase text-[0.7rem] tracking-[0.35em] text-slate-500">BTC ETF</p>
                <div className="flex items-center gap-2 text-[0.7rem] text-slate-500">
                  <span
                    className={`h-2 w-2 rounded-full ${loadingData ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`}
                  />
                  <span>{loadingData ? "Updating" : "Live data"}</span>
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                earn USD yield for holding crypto assets
              </h1>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={walletAddress ? resetWallet : connectWallet}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-100 transition"
              >
                <span
                  className={`h-2 w-2 rounded-full ${walletAddress && networkOk ? "bg-emerald-500" : "bg-amber-400"}`}
                />
                {walletAddress ? shorten(walletAddress) : "Connect wallet"}
              </button>
              <Link
                href={HOW_TO_WALLET_HREF}
                className="text-xs underline text-slate-700 hover:text-slate-900"
              >
                How to use wallets
              </Link>
            </div>
          </header>

          {err && (
            <div className="rounded-2xl border border-red-500/30 bg-red-100 px-4 py-3 text-sm text-red-800">
              {err}
            </div>
          )}

          <div className="flex flex-col flex-1 justify-center">
            <section className="rounded-3xl border border-slate-200 bg-white shadow-md p-6 md:p-7 space-y-6">
              <div className="grid md:grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-base md:text-lg font-semibold text-slate-900 tracking-tight">
                    My WBTC in the fund
                  </span>
                  <span className="text-xs text-slate-500">Wallet: {walletBalance} WBTC</span>
                </div>
                <div className="flex items-center justify-center">
                  <span
                    className="text-4xl md:text-5xl font-semibold text-amber-500 tabular-nums font-mono text-center min-w-[170px]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {vaultHoldings} BTC
                  </span>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => openDialog("deposit")}
                    disabled={!ready}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-white font-semibold shadow hover:bg-amber-400 disabled:opacity-50"
                  >
                    Add WBTC
                  </button>
                  <button
                    onClick={() => openDialog("withdraw")}
                    disabled={!ready || userStats.shares === 0n}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-900 font-semibold hover:bg-slate-50 disabled:opacity-50"
                  >
                    Withdraw
                  </button>
                </div>
              </div>

              <div className="h-px w-full bg-slate-200" />

              <div className="grid md:grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-base md:text-lg font-semibold text-slate-900 tracking-tight">
                    My {REWARD_SYMBOL} yield
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMoreInfo((prev) => !prev)}
                    className="px-3 py-1 rounded-full border border-amber-500 text-amber-700 text-xs font-semibold hover:bg-amber-500 hover:text-white transition shadow-sm"
                  >
                    *
                  </button>
                </div>
                <div className="flex items-center justify-center">
                  <span
                    className="text-4xl md:text-5xl font-semibold text-emerald-600 tabular-nums font-mono text-center min-w-[170px]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {yieldAmount} {REWARD_SYMBOL}
                  </span>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={withdrawYield}
                    disabled={!ready || userStats.pendingRewards === 0n}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-semibold shadow hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Claim
                  </button>
                </div>
              </div>

              {showInlineStatus && <ActionStatus state={actionState} />}

              {showMoreInfo && (
                <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
                  <p className="text-slate-600">More info</p>
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
              className="text-sm underline text-slate-700 hover:text-slate-900"
            >
              How it works
            </Link>
          </div>
        </div>

        {dialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30 px-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">
                    {dialogMode === "deposit" ? "Add WBTC" : "Withdraw WBTC"}
                  </p>
                  <h3 className="text-xl font-semibold text-white">
                    {dialogMode === "deposit" ? "Deposit" : "Withdraw"}
                  </h3>
                </div>
                <button
                  onClick={() => setDialogOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div>
                <div className="mb-4 flex gap-2 rounded-xl bg-slate-900 p-1 border border-slate-800">
                  <button
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                      dialogMode === "deposit"
                        ? "bg-white text-slate-950 shadow"
                        : "text-slate-300 hover:text-white"
                    }`}
                    onClick={() => setDialogMode("deposit")}
                  >
                    Deposit
                  </button>
                  <button
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                      dialogMode === "withdraw"
                        ? "bg-white text-slate-950 shadow"
                        : "text-slate-300 hover:text-white"
                    }`}
                    onClick={() => setDialogMode("withdraw")}
                  >
                    Withdraw
                  </button>
                </div>

                <label className="text-sm text-slate-300">Amount (WBTC)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-300 focus:ring-amber-300/30"
                  placeholder="0.0"
                />

                <div className="mt-4 text-xs text-slate-400 space-y-1">
                  <p>Wallet: {walletBalance} WBTC</p>
                  <p>Vault balance: {vaultHoldings} BTC</p>
                </div>

                {actionBusy && <ActionStatus state={actionState} />}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setDialogOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-800 text-slate-200 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitAction}
                    disabled={actionBusy || !ready}
                    className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-semibold shadow hover:bg-amber-300 disabled:opacity-50"
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

function ActionStatus({ state }) {
  if (!state || state.phase === "idle") return null;
  const tone = state.phase === "success" ? "text-emerald-600" : "text-amber-600";
  const showSpinner = state.phase !== "success";
  return (
    <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      {showSpinner && (
        <span className="h-3 w-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      )}
      {!showSpinner && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
      <span className={tone}>{state.label}</span>
    </div>
  );
}

function DataStat({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-slate-700 text-sm">{label}</span>
      <span className="text-slate-900 font-mono text-sm">{value}</span>
    </div>
  );
}
=======
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchAssets, portfolioCalculator } from "../../lib/portfolio";
import ChartBuilder from "../components/ChartBuilder";
import MetricsBuilder from "../components/MetricsBuilder";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function BTCETFPage() {
  const [assetsMeta, setAssetsMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const api = await fetchAssets();
        if (!alive) return;
        setAssetsMeta(api.assets || {});
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // BTC only desired mapping
  const desired = useMemo(() => [{ want: "Bitcoin", weight: 1.0 }], []);
  const resolved = useMemo(() => resolveDesired(desired, assetsMeta), [desired, assetsMeta]);

  // Normalize to match builder component API
  const assets = resolved.keys;
  const weights = resolved.weights;

  return (
    <div className="page">
      <Header />
      <main className="site-content">
        <div className="container">

          <h1 className="mt-0">BTC Only ETF <span className="metric-label">(BTCX)</span></h1>
          <p className="metric-label">Objective: pure Bitcoin exposure. High volatility and high potential upside.</p>

          {err && <div className="metric-label neg mt-8">{err}</div>}
          {loading && <div className="metric-label mt-8">Loading…</div>}

          {!loading && (
            <>
              <div className="split">
                <aside className="left-pane">
                  <h2 className="section-title">Holdings</h2>
                  {assets.map((k, i) => {
                    const meta = assetsMeta[k] || {};
                    return (
                      <div key={k} className="metric-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="badge" style={{ background: meta.color || "var(--accent)", border: `1px solid ${meta.color || "var(--accent)"}` }} />
                        <span style={{ minWidth: 160 }}>{meta.name || k}</span>
                        <span className="strong">{Math.round(weights[i] * 100)}%</span>
                      </div>
                    );
                  })}
                  <div className="mt-32">
                    <h3 className="mt-0">Additional info</h3>
                    <ul className="metric-label">
                      <li>Rebalancing: N/A (single-asset)</li>
                      <li>Suggested horizon: 4+ years</li>
                      <li>Risk: Very high</li>
                    </ul>
                  </div>
                </aside>

                <section className="right-pane">
                  {/* Chart (top) and Metrics (bottom) using your builders */}
                  <ChartBuilder assets={assets} weights={weights} />
                  <PortfolioBuilder assets={assets} weights={weights} />
                </section>
              </div>

              <div className="mt-32">
                <Link href="/ETFs" className="btn-step">← Back to ETFs</Link>
                <Link href="/" className="btn-step" style={{ marginLeft: 8 }}>Back to Builder</Link>
              </div>
            </>
          )}

        </div>
      </main>
      <Footer />
    </div>

  );
}



function resolveDesired(desired, assetsMeta) {
  const entries = Object.entries(assetsMeta);
  const findKey = (needle) => {
    const n = needle.toLowerCase();
    let best = null;
    for (const [k, m] of entries) {
      const name = (m?.name || k || "").toLowerCase();
      if (name.startsWith(n)) return k;
      if (name.includes(n)) best = best ?? k;
    }
    return best;
  };
  const keys = [];
  const weights = [];
  for (const item of desired) {
    const k = findKey(item.want);
    if (k) { keys.push(k); weights.push(item.weight); }
  }
  return { keys, weights };
}
>>>>>>> main
