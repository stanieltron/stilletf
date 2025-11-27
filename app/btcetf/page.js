"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BrowserProvider,
  Contract,
  formatUnits,
  parseUnits,
} from "ethers";
import Footer from "../components/Footer";

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS || "";
const WBTC_ADDRESS = process.env.NEXT_PUBLIC_WBTC_ADDRESS || "";
const HOW_TO_WALLET_HREF = "/wallets";
const HOW_IT_WORKS_HREF = "/how-it-works";

const DEFAULT_WBTC_DECIMALS = Number(process.env.NEXT_PUBLIC_WBTC_DECIMALS || 8);
const REWARD_DECIMALS = Number(process.env.NEXT_PUBLIC_REWARD_DECIMALS || 6);
const REWARD_SYMBOL = process.env.NEXT_PUBLIC_REWARD_SYMBOL || "USDT";

const STAKING_VAULT_ABI = [
  "function stake(uint256 amountUA) external returns (uint256)",
  "function unstake(uint256 shares) external returns (uint256)",
  "function claim() external returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function sharePrice() external view returns (uint256)",
  "function getPendingRewards(address account) external view returns (uint256)",
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

export default function BTCETFPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [vault, setVault] = useState(null);
  const [wbtc, setWbtc] = useState(null);
  const [wbtcDecimals, setWbtcDecimals] = useState(DEFAULT_WBTC_DECIMALS);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [txMessage, setTxMessage] = useState("");

  const [vaultStats, setVaultStats] = useState({
    totalAssets: 0n,
    totalSupply: 0n,
    sharePrice: 0n,
    decimals: DEFAULT_WBTC_DECIMALS,
  });
  const [userStats, setUserStats] = useState({
    shares: 0n,
    vaultValue: 0n,
    pendingRewards: 0n,
    walletBalance: 0n,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const ready = useMemo(
    () => !!walletAddress && !!vault && !!wbtc,
    [walletAddress, vault, wbtc]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const eth = window.ethereum;
    eth
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts && accounts[0]) {
          initializeWallet(accounts[0]);
        }
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
      setTxMessage("");
      refresh();
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);
    return () => {
      eth.removeListener("accountsChanged", onAccountsChanged);
      eth.removeListener("chainChanged", onChainChanged);
    };
  }, []);

  const resetWallet = () => {
    setWalletAddress("");
    setProvider(null);
    setSigner(null);
    setVault(null);
    setWbtc(null);
  };

  async function initializeWallet(address) {
    if (!window.ethereum) {
      setErr("MetaMask not detected.");
      return;
    }
    if (!VAULT_ADDRESS || !WBTC_ADDRESS) {
      setErr("Vault/token address not configured.");
      return;
    }
    try {
      setErr("");
      const nextProvider = new BrowserProvider(window.ethereum);
      const nextSigner = await nextProvider.getSigner();
      setProvider(nextProvider);
      setSigner(nextSigner);
      setWalletAddress(address);

      const vaultContract = new Contract(
        VAULT_ADDRESS,
        STAKING_VAULT_ABI,
        nextSigner
      );
      const wbtcContract = new Contract(WBTC_ADDRESS, ERC20_ABI, nextSigner);

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

  async function connectWallet() {
    if (typeof window === "undefined" || !window.ethereum) {
      setErr("Please install MetaMask to continue.");
      return;
    }
    try {
      setErr("");
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts && accounts[0]) {
        await initializeWallet(accounts[0]);
      }
    } catch (e) {
      console.error(e);
      setErr("Wallet connection was rejected.");
    }
  }

  async function refresh(nextVault = vault, nextWbtc = wbtc, address = walletAddress) {
    if (!nextVault || !nextWbtc || !address) return;
    try {
      setLoading(true);
      setErr("");
      const [shares, totalAssets, totalSupply, sharePrice, pendingRewards, walletBalance, vaultDecimals] =
        await Promise.all([
          nextVault.balanceOf(address),
          nextVault.totalAssets(),
          nextVault.totalSupply(),
          nextVault.sharePrice(),
          nextVault.getPendingRewards(address),
          nextWbtc.balanceOf(address),
          nextVault.decimals(),
        ]);
      const vaultValue =
        totalSupply === 0n ? 0n : (shares * totalAssets) / totalSupply;
      setVaultStats({ totalAssets, totalSupply, sharePrice, decimals: Number(vaultDecimals) || wbtcDecimals });
      setUserStats({ shares, vaultValue, pendingRewards, walletBalance });
    } catch (e) {
      console.error(e);
      setErr("Could not fetch vault data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAction() {
    if (!ready) {
      setErr("Connect your wallet first.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setErr("Enter an amount greater than zero.");
      return;
    }
    try {
      setLoading(true);
      setErr("");
      setTxMessage(dialogMode === "deposit" ? "Adding WBTC..." : "Withdrawing WBTC...");
      const value = parseUnits(amount, wbtcDecimals);

      if (dialogMode === "deposit") {
        const allowance = await wbtc.allowance(walletAddress, VAULT_ADDRESS);
        if (allowance < value) {
          const approveTx = await wbtc.approve(VAULT_ADDRESS, value);
          await approveTx.wait();
        }
        const tx = await vault.stake(value);
        await tx.wait();
        setTxMessage("Deposit confirmed on-chain.");
      } else {
        const { totalAssets, totalSupply } = vaultStats;
        const sharesNeeded =
          totalAssets === 0n ? 0n : (value * totalSupply) / totalAssets;
        if (sharesNeeded === 0n) {
          setErr("No shares available to withdraw.");
          setTxMessage("");
          return;
        }
        if (sharesNeeded > userStats.shares) {
          setErr("You do not have enough staked balance for that amount.");
          setTxMessage("");
          return;
        }
        const tx = await vault.unstake(sharesNeeded);
        await tx.wait();
        setTxMessage("Withdrawal confirmed on-chain.");
      }
      setAmount("");
      setDialogOpen(false);
      await refresh();
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Transaction failed.");
    } finally {
      setTxMessage("");
      setLoading(false);
    }
  }

  async function withdrawYield() {
    if (!ready) {
      setErr("Connect your wallet first.");
      return;
    }
    try {
      setLoading(true);
      setErr("");
      setTxMessage("Withdrawing yield...");
      const tx = await vault.claim();
      await tx.wait();
      setTxMessage("Yield withdrawn.");
      await refresh();
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Could not withdraw yield.");
    } finally {
      setTxMessage("");
      setLoading(false);
    }
  }

  const vaultHoldings = useMemo(
    () => formatBigAmount(userStats.vaultValue, wbtcDecimals, { maximumFractionDigits: 8 }),
    [userStats.vaultValue, wbtcDecimals]
  );
  const yieldAmount = useMemo(
    () => formatBigAmount(userStats.pendingRewards, REWARD_DECIMALS, { maximumFractionDigits: 4 }),
    [userStats.pendingRewards]
  );
  const walletBalance = useMemo(
    () => formatBigAmount(userStats.walletBalance, wbtcDecimals, { maximumFractionDigits: 8 }),
    [userStats.walletBalance, wbtcDecimals]
  );

  const missingAddresses = !VAULT_ADDRESS || !WBTC_ADDRESS;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff] text-slate-900 flex flex-col relative">
      <main className="flex-1 relative overflow-hidden">
        <div className="absolute top-6 right-6 flex flex-col items-end gap-2 z-20">
          <button
            onClick={connectWallet}
            className="px-4 py-2 rounded-full bg-white border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition text-slate-900 shadow-sm"
          >
            {walletAddress ? shorten(walletAddress) : "Connect MetaMask"}
          </button>
          <Link
            href={HOW_TO_WALLET_HREF}
            className="text-xs underline text-[var(--accent-strong)] hover:text-[var(--accent)]"
          >
            How to use wallets
          </Link>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-20 relative z-10">
          <div className="backdrop-blur-lg bg-white/90 border border-slate-200 rounded-3xl p-8 md:p-12 shadow-2xl">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="uppercase tracking-[0.3em] text-xs text-slate-500 mb-3">
                  BTC ETF Vault
                </p>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                  StakingVault — BTCX
                </h1>
                <p className="text-slate-600 mt-2 max-w-xl">
                  Stake WBTC into the vault, earn stablecoin yield, and withdraw your rewards anytime.
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Share price</p>
                <p className="text-2xl font-bold text-[#f97316]">
                  {formatBigAmount(vaultStats.sharePrice, vaultStats.decimals, { maximumFractionDigits: 6 })} WBTC
                </p>
              </div>
            </div>

            {missingAddresses && (
              <div className="mt-6 text-sm text-amber-900 bg-amber-100 border border-amber-200 rounded-xl p-3">
                Configure <code>NEXT_PUBLIC_STAKING_VAULT_ADDRESS</code> and <code>NEXT_PUBLIC_WBTC_ADDRESS</code> to enable on-chain actions.
              </div>
            )}

            {err && (
              <div className="mt-6 text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-3">
                {err}
              </div>
            )}

            {txMessage && (
              <div className="mt-6 text-sm text-slate-900 bg-blue-50 border border-blue-200 rounded-xl p-3">
                {txMessage}
              </div>
            )}

            <div className="flex flex-col gap-6 mt-8">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-3 shadow-inner">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Your BTC in the fund</p>
                    <p className="text-3xl font-extrabold mt-1 text-[#f97316]">
                      {vaultHoldings} BTC
                    </p>
                  </div>
                  <button
                    onClick={() => { setDialogMode("deposit"); setDialogOpen(true); }}
                    disabled={!ready || missingAddresses}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-strong)] disabled:opacity-50 shadow-sm"
                  >
                    Add / Withdraw
                  </button>
                </div>
                <div className="text-sm text-slate-600 flex flex-wrap gap-2">
                  <span>WBTC wallet: {walletBalance}</span>
                  <span>•</span>
                  <span>Staked shares: {formatBigAmount(userStats.shares, 18, { maximumFractionDigits: 6 })}</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-3 shadow-inner">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      My yield
                      <button
                        type="button"
                        onClick={() => setShowDetails((v) => !v)}
                        className="w-7 h-7 rounded-full border border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-500 flex items-center justify-center text-sm"
                        title="Show vault details"
                      >
                        *
                      </button>
                    </p>
                    <p className="text-3xl font-extrabold mt-1 text-[#16a34a]">
                      {yieldAmount} {REWARD_SYMBOL}
                    </p>
                  </div>
                  <button
                    onClick={withdrawYield}
                    disabled={!ready || userStats.pendingRewards === 0n || missingAddresses}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 shadow-sm"
                  >
                    Withdraw
                  </button>
                </div>
                <div className="text-sm text-slate-600">
                  Total assets: {formatBigAmount(vaultStats.totalAssets, vaultStats.decimals, { maximumFractionDigits: 4 })} BTC
                </div>
              </div>
            </div>

            {showDetails && (
              <div className="mt-10 grid md:grid-cols-3 gap-4 text-sm text-slate-700">
                <InfoCard label="Vault address" value={VAULT_ADDRESS || "Not set"} />
                <InfoCard label="Underlying token" value={WBTC_ADDRESS || "Not set"} />
                <InfoCard label="Wallet status" value={walletAddress ? shorten(walletAddress) : "Not connected"} />
              </div>
            )}

            <div className="mt-12 flex items-center justify-center">
              <Link
                href={HOW_IT_WORKS_HREF}
                className="underline text-[var(--accent-strong)] hover:text-[var(--accent)] text-sm"
              >
                How it works
              </Link>
            </div>
          </div>
        </div>

        {dialogOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-30 px-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <DialogTab
                    active={dialogMode === "deposit"}
                    onClick={() => setDialogMode("deposit")}
                  >
                    Add WBTC
                  </DialogTab>
                  <DialogTab
                    active={dialogMode === "withdraw"}
                    onClick={() => setDialogMode("withdraw")}
                  >
                    Withdraw WBTC
                  </DialogTab>
                </div>
                <button
                  onClick={() => setDialogOpen(false)}
                  className="text-slate-500 hover:text-slate-800 text-sm"
                >
                  Close
                </button>
              </div>

              <label className="text-sm text-slate-600">Amount (WBTC)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[var(--accent)]"
                placeholder="0.0"
              />

              <div className="mt-4 text-xs text-slate-600 space-y-1">
                <p>Wallet: {walletBalance} WBTC</p>
                <p>Vault balance: {vaultHoldings} BTC</p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAction}
                  disabled={loading || missingAddresses}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-strong)] disabled:opacity-50 shadow-sm"
                >
                  {dialogMode === "deposit" ? "Confirm deposit" : "Confirm withdrawal"}
                </button>
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
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function InfoCard({ label, value }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold break-all text-slate-900">{value}</p>
    </div>
  );
}

function DialogTab({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${active ? "bg-[var(--accent)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
    >
      {children}
    </button>
  );
}
