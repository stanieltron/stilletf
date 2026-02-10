"use client";

import { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import Link from "next/link";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { fetchAssets } from "../../lib/portfolio";

const BTC_ICON = "/assets/btc%20small.png";
const DEFAULT_CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";
const TARGET_CHAIN_HEX = `0x${Number(DEFAULT_CHAIN_ID).toString(16)}`;
const DEFAULT_WBTC_DECIMALS = Number(
  process.env.NEXT_PUBLIC_WBTC_DECIMALS || 8
);
const REWARD_DECIMALS = Number(process.env.NEXT_PUBLIC_REWARD_DECIMALS || 6);
const REWARD_SYMBOL = process.env.NEXT_PUBLIC_REWARD_SYMBOL || "USDC";
const ENV_ADDRESSES = {
  vault: process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS || "",
  wbtc: process.env.NEXT_PUBLIC_WBTC_ADDRESS || "",
};
const TARGET_APY = 0.03;
const INITIAL_CAPITAL = 1000;

const TIMEFRAMES = [
  { id: "1w", label: "1W", points: 8 },
  { id: "1m", label: "1M", points: 16 },
  { id: "3m", label: "3M", points: 30 },
  { id: "all", label: "ALL", points: 60 },
];

const STAKING_VAULT_ABI = [
  "function stake(uint256 amountUA) external returns (uint256)",
  "function unstake(uint256 shares) external returns (uint256)",
  "function claim() external returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function getPendingRewards(address account) external view returns (uint256)",
  "function sharePrice() external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
];

async function safeRead(promise, fallback) {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function MyEarningsPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [provider, setProvider] = useState(null);
  const [vault, setVault] = useState(null);
  const [wbtc, setWbtc] = useState(null);
  const [addresses, setAddresses] = useState({ vault: "", wbtc: "" });
  const [networkOk, setNetworkOk] = useState(true);

  const [wbtcDecimals, setWbtcDecimals] = useState(DEFAULT_WBTC_DECIMALS);
  const [vaultStats, setVaultStats] = useState({
    sharePrice: 0n,
    decimals: DEFAULT_WBTC_DECIMALS,
  });
  const [userStats, setUserStats] = useState({
    shares: 0n,
    pendingRewards: 0n,
    walletBalance: 0n,
  });

  const [timeframe, setTimeframe] = useState("1m");
  const [priceSeries, setPriceSeries] = useState([]);
  const [showDetails, setShowDetails] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [err, setErr] = useState("");
  const [actionState, setActionState] = useState({ phase: "idle", label: "" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("deposit");
  const [amount, setAmount] = useState("");

  const ready = useMemo(
    () =>
      !!walletAddress &&
      !!provider &&
      !!vault &&
      !!wbtc &&
      !!addresses.vault &&
      !!addresses.wbtc &&
      networkOk,
    [walletAddress, provider, vault, wbtc, addresses, networkOk]
  );

  const actionBusy = actionState.phase !== "idle";

  useEffect(() => {
    const loadPrices = async () => {
      try {
        const data = await fetchAssets();
        const btc = data?.assets?.asset1?.prices;
        if (Array.isArray(btc) && btc.length > 1) setPriceSeries(btc);
      } catch {
        // no-op
      }
    };

    setAddresses(ENV_ADDRESSES);
    if (!ENV_ADDRESSES.vault || !ENV_ADDRESSES.wbtc) {
      setErr(
        "Vault/WBTC address missing in env. Set NEXT_PUBLIC_STAKING_VAULT_ADDRESS and NEXT_PUBLIC_WBTC_ADDRESS."
      );
    }
    loadPrices();
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
        setWalletAddress("");
        setProvider(null);
        setVault(null);
        setWbtc(null);
        return;
      }
      initializeWallet(accounts[0]);
    };
    const onChainChanged = () => refresh();

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
    if (ready) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function ensureCorrectChain(nextProvider) {
    try {
      const network = await nextProvider.getNetwork();
      if (network.chainId?.toString() === DEFAULT_CHAIN_ID) return true;
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TARGET_CHAIN_HEX }],
      });
      return true;
    } catch {
      return false;
    }
  }

  async function initializeWallet(address) {
    if (!window.ethereum || !addresses.vault || !addresses.wbtc) return;
    try {
      const nextProvider = new BrowserProvider(window.ethereum);
      const nextSigner = await nextProvider.getSigner();
      const chainReady = await ensureCorrectChain(nextProvider);
      setNetworkOk(chainReady);
      if (!chainReady) setErr(`Switch to chain ${DEFAULT_CHAIN_ID} to continue.`);

      const vaultContract = new Contract(addresses.vault, STAKING_VAULT_ABI, nextSigner);
      const wbtcContract = new Contract(addresses.wbtc, ERC20_ABI, nextSigner);

      const tokenDecimals = await safeRead(
        wbtcContract.decimals(),
        BigInt(DEFAULT_WBTC_DECIMALS)
      );
      setWbtcDecimals(Number(tokenDecimals) || DEFAULT_WBTC_DECIMALS);

      setWalletAddress(address);
      setProvider(nextProvider);
      setVault(vaultContract);
      setWbtc(wbtcContract);
      await refresh(vaultContract, wbtcContract, nextProvider, address);
    } catch {
      setErr("Failed to initialize wallet.");
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setErr("Please install MetaMask to continue.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts && accounts[0]) await initializeWallet(accounts[0]);
    } catch {
      setErr("Wallet connection was rejected.");
    }
  }

  async function refresh(
    nextVault = vault,
    nextWbtc = wbtc,
    nextProvider = provider,
    address = walletAddress
  ) {
    if (!nextVault || !nextWbtc || !nextProvider || !address) return;
    try {
      setLoadingData(true);
      const [network, shares, pendingRewards, walletBalance, vaultDecimals, sharePrice] =
        await Promise.all([
          nextProvider.getNetwork(),
          safeRead(nextVault.balanceOf(address), 0n),
          safeRead(nextVault.getPendingRewards(address), 0n),
          safeRead(nextWbtc.balanceOf(address), 0n),
          safeRead(nextVault.decimals(), BigInt(wbtcDecimals)),
          safeRead(nextVault.sharePrice(), 0n),
        ]);

      const chainMatches = network.chainId?.toString() === DEFAULT_CHAIN_ID;
      setNetworkOk(chainMatches);
      if (!chainMatches) {
        setErr(`Wrong network. Connect to chain ${DEFAULT_CHAIN_ID}.`);
        return;
      }

      setVaultStats({
        sharePrice,
        decimals: Number(vaultDecimals) || wbtcDecimals,
      });
      setUserStats({ shares, pendingRewards, walletBalance });
      setErr("");
    } catch {
      setErr("Could not fetch vault data.");
    } finally {
      setLoadingData(false);
    }
  }

  function openDialog(mode) {
    if (!walletAddress) {
      connectWallet();
      return;
    }
    setDialogMode(mode);
    setDialogOpen(true);
    setAmount("");
  }

  async function runTransactionStep({
    signingLabel,
    confirmingLabel,
    successLabel,
    sendTx,
  }) {
    setActionState({ phase: "signing", label: signingLabel });
    const tx = await sendTx();
    setActionState({ phase: "pending", label: confirmingLabel });
    await tx.wait();
    setActionState({ phase: "success", label: successLabel });
  }

  async function handleSubmitAction() {
    if (!ready || actionBusy) return;
    if (!amount || Number(amount) <= 0) {
      setErr("Enter an amount greater than zero.");
      return;
    }
    try {
      setErr("");
      const value = parseUnits(amount, wbtcDecimals);
      if (value <= 0n) {
        throw new Error("Enter an amount greater than zero.");
      }
      if (dialogMode === "deposit") {
        const allowance = await wbtc.allowance(walletAddress, addresses.vault);
        if (allowance < value) {
          await runTransactionStep({
            signingLabel: "Confirming approval...",
            confirmingLabel: "Approval pending...",
            successLabel: "Approval completed.",
            sendTx: () => wbtc.approve(addresses.vault, value),
          });
          await sleep(350);
        }
        await runTransactionStep({
          signingLabel: "Confirming deposit...",
          confirmingLabel: "Deposit pending...",
          successLabel: "Deposit complete.",
          sendTx: () => vault.stake(value),
        });
      } else {
        if (value > userStats.shares) throw new Error("Not enough principal to withdraw.");
        await runTransactionStep({
          signingLabel: "Confirming withdrawal...",
          confirmingLabel: "Withdrawal pending...",
          successLabel: "Withdrawal complete.",
          sendTx: () => vault.unstake(value),
        });
      }
      setDialogOpen(false);
      await refresh();
    } catch (error) {
      setErr(error?.shortMessage || error?.message || "Transaction failed.");
    } finally {
      setTimeout(() => setActionState({ phase: "idle", label: "" }), 800);
    }
  }

  async function claimEarnings() {
    if (!ready || actionBusy) return;
    try {
      setErr("");
      await runTransactionStep({
        signingLabel: "Confirming claim...",
        confirmingLabel: "Claim pending...",
        successLabel: "Claim complete.",
        sendTx: () => vault.claim(),
      });
      await refresh();
    } catch (error) {
      setErr(error?.shortMessage || error?.message || "Could not claim earnings.");
    } finally {
      setTimeout(() => setActionState({ phase: "idle", label: "" }), 800);
    }
  }

  const latestBtcPrice = priceSeries[priceSeries.length - 1] || 0;
  const principalRaw = useMemo(() => {
    const scale = 10n ** BigInt(vaultStats.decimals || wbtcDecimals);
    if (vaultStats.sharePrice > 0n) return (userStats.shares * vaultStats.sharePrice) / scale;
    return userStats.shares;
  }, [vaultStats, userStats.shares, wbtcDecimals]);

  const principalDisplay = useMemo(
    () => formatTokenAmount(principalRaw, vaultStats.decimals, 4, 4),
    [principalRaw, vaultStats.decimals]
  );
  const walletBalanceDisplay = useMemo(
    () => formatTokenAmount(userStats.walletBalance, wbtcDecimals, 6),
    [userStats.walletBalance, wbtcDecimals]
  );
  const earningsDisplay = useMemo(
    () => formatTokenAmount(userStats.pendingRewards, REWARD_DECIMALS, 6, 6),
    [userStats.pendingRewards]
  );
  const maxAmountForMode = useMemo(() => {
    if (dialogMode === "deposit") {
      return formatInputAmount(userStats.walletBalance, wbtcDecimals);
    }
    return formatInputAmount(userStats.shares, vaultStats.decimals || wbtcDecimals);
  }, [
    dialogMode,
    userStats.walletBalance,
    userStats.shares,
    vaultStats.decimals,
    wbtcDecimals,
  ]);
  const principalUsdDisplay = useMemo(() => {
    const v = toNumber(principalRaw, vaultStats.decimals) * latestBtcPrice;
    return Number.isFinite(v) ? formatCurrency(v) : "-";
  }, [principalRaw, vaultStats.decimals, latestBtcPrice]);

  const chartState = useMemo(() => {
    if (!priceSeries.length) return { data: [], monthAddedValue: 0 };
    const frame = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[1];
    const sample =
      frame.id === "all"
        ? priceSeries.slice()
        : priceSeries.slice(-Math.min(frame.points, priceSeries.length));
    if (sample.length < 2) return { data: [], monthAddedValue: 0 };
    const base = resampleSeries(buildValueSeries(sample, INITIAL_CAPITAL), 60).map((v) => Number((v - INITIAL_CAPITAL).toFixed(2)));
    const yieldSeries = resampleSeries(buildCompoundingSeries(sample, INITIAL_CAPITAL, TARGET_APY), 60).map((v) => Number((v - INITIAL_CAPITAL).toFixed(2)));
    const data = base.map((v, i) => ({ i, btc: v, stillwater: yieldSeries[i] ?? v }));
    const month = priceSeries.slice(-Math.min(12, priceSeries.length));
    const monthBase = buildValueSeries(month, INITIAL_CAPITAL);
    const monthYield = buildCompoundingSeries(month, INITIAL_CAPITAL, TARGET_APY);
    const monthAddedValue = (monthYield.at(-1) || INITIAL_CAPITAL) - (monthBase.at(-1) || INITIAL_CAPITAL);
    return { data, monthAddedValue };
  }, [priceSeries, timeframe]);

  return (
    <PageView
      actionBusy={actionBusy}
      actionState={actionState}
      chartState={chartState}
      connectWallet={connectWallet}
      dialogMode={dialogMode}
      dialogOpen={dialogOpen}
      earningsDisplay={earningsDisplay}
      err={err}
      handleSubmitAction={handleSubmitAction}
      loadingData={loadingData}
      maxAmountForMode={maxAmountForMode}
      openDialog={openDialog}
      principalDisplay={principalDisplay}
      principalUsdDisplay={principalUsdDisplay}
      ready={ready}
      setAmount={setAmount}
      setDialogMode={setDialogMode}
      setDialogOpen={setDialogOpen}
      setShowDetails={setShowDetails}
      setTimeframe={setTimeframe}
      showDetails={showDetails}
      timeframe={timeframe}
      walletAddress={walletAddress}
      walletBalanceDisplay={walletBalanceDisplay}
      claimEarnings={claimEarnings}
      amount={amount}
      pendingRewards={userStats.pendingRewards}
      shares={userStats.shares}
    />
  );
}

function PageView({
  actionBusy,
  actionState,
  chartState,
  connectWallet,
  dialogMode,
  dialogOpen,
  earningsDisplay,
  err,
  handleSubmitAction,
  loadingData,
  maxAmountForMode,
  openDialog,
  principalDisplay,
  principalUsdDisplay,
  ready,
  setAmount,
  setDialogMode,
  setDialogOpen,
  setShowDetails,
  setTimeframe,
  showDetails,
  timeframe,
  walletAddress,
  walletBalanceDisplay,
  claimEarnings,
  amount,
  pendingRewards,
  shares,
}) {
  return (
    <div className="min-h-screen flex flex-col text-[#201909]">
      <Header />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 pt-12 pb-28">
          <div className="mb-5">
            <Link
              href="/ETFs"
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#201909] hover:opacity-70 transition-opacity"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M15 6L9 12L15 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Back to ETFs</span>
            </Link>
          </div>
          <section className="bg-[#fdfbf9] rounded-[24px] border border-[#e2dacd] shadow-sm p-5 md:p-7">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className="text-[32px] font-semibold tracking-[-0.96px] text-[#201909] leading-none">
                  Core bundle
                </h2>
                <div className="bg-[#f7f3eb] border border-[#f2ebde] rounded-full px-3 py-1.5 flex items-center gap-2">
                  <img src={BTC_ICON} alt="Bitcoin" className="h-5 w-5 rounded-full" />
                  <span className="text-[14px] font-semibold text-[#201909]">Bitcoin</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[#756c57]">
                  <span className={`h-2 w-2 rounded-full ${loadingData ? "bg-[#f1c255] animate-pulse" : "bg-[#009966]"}`} />
                  <span>{loadingData ? "Updating" : "Live data"}</span>
                </div>
              </div>

              {walletAddress ? (
                <span className="text-[12px] text-[#756c57]">Wallet {shorten(walletAddress)}</span>
              ) : (
                <button
                  type="button"
                  onClick={connectWallet}
                  className="h-10 px-4 rounded-3xl border border-[#201909] text-[14px] font-medium hover:bg-[#201909] hover:text-white transition-all"
                >
                  Connect wallet
                </button>
              )}
            </div>

            {err && (
              <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {err}
              </div>
            )}

            <div className="mt-7 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <p className="text-[#756c57] text-[16px] font-medium">My principal in the bundle</p>
                <p className="mt-2 text-[20px] font-semibold tracking-[-0.96px] leading-none">{principalDisplay} wBTC</p>
                <p className="mt-2 text-[#756c57] text-[14px] leading-none">{principalUsdDisplay}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => openDialog("withdraw")}
                  disabled={!ready || shares === 0n || actionBusy}
                  className="h-[40px] px-[16px] rounded-[8px] border border-[#cfbfa2] text-[#9a8f78] text-[14px] font-semibold hover:bg-[#f2ebde]/60 transition-colors disabled:opacity-50"
                >
                  Withdraw
                </button>
                <button
                  onClick={() => openDialog("deposit")}
                  disabled={actionBusy}
                  className="bg-[#201909] h-[40px] px-[32px] rounded-[8px] flex items-center justify-center gap-2 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  <span className="text-[20px] leading-none">+</span>
                  <span>Add wBTC</span>
                </button>
              </div>
            </div>

            <div className="mt-7 bg-[#f7f3eb] rounded-[16px] border border-[#f2ebde] p-6">
              <div className="flex flex-col md:flex-row justify-between items-start gap-5">
                <div>
                  <p className="text-[#756c57] text-[16px] font-medium">My earnings</p>
                  <div className="mt-2 inline-flex items-baseline gap-2 whitespace-nowrap">
                    <span className="inline-block tabular-nums text-[48px] leading-none font-semibold tracking-[-1.6px] text-[#201909]">
                      {earningsDisplay}
                    </span>
                    <span className="inline-block text-[32px] leading-none font-semibold tracking-[-1.6px] text-[#201909]">
                      {REWARD_SYMBOL}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowDetails((v) => !v)}
                    className="mt-5 text-[#6f664f] text-[14px] font-medium flex items-center gap-1 hover:text-[#201909] transition-colors"
                  >
                    <span>Earnings details</span>
                    <svg className={`h-6 w-6 transition-transform ${showDetails ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none">
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={claimEarnings}
                  disabled={!ready || pendingRewards === 0n || actionBusy}
                  className="bg-[#f1c255] h-[48px] min-w-[210px] px-[44px] rounded-[12px] text-[#201909] text-[16px] font-semibold hover:bg-[#eab444] transition-colors shadow-sm disabled:opacity-50"
                >
                  Claim Earnings
                </button>
              </div>

              {showDetails && (
                <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_280px]">
                  <section className="bg-[#fbfaf7] rounded-[16px] border border-[#f2ebde] p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                      <div>
                        <h3 className="font-semibold text-[#201909] text-[20px] tracking-[-0.02em]">Portfolio Performance</h3>
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mt-3">
                          <LegendDot color="#009966" label="Earning yield with Stillwater" />
                          <LegendDot color="#a79f89" label="Only holding BTC" />
                        </div>
                      </div>
                      <div className="bg-[#f7f3eb] rounded-[16px] border border-[#f2ebde] p-[4px] flex gap-[2px]">
                        {TIMEFRAMES.map((item) => {
                          const active = timeframe === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setTimeframe(item.id)}
                              className={`w-[48px] h-[24px] flex items-center justify-center rounded-[12px] text-[11px] font-semibold transition-all ${active ? "bg-white text-[#201909] shadow-sm border border-[#f2ebde]" : "text-[#756c57] hover:text-[#201909]"}`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-[240px] w-full">
                      {chartState.data.length ? (
                        <PerformanceChart data={chartState.data} />
                      ) : (
                        <ChartPlaceholder />
                      )}
                    </div>
                  </section>

                  <aside className="pt-5">
                    <DataBlock title="Assets in the bundle">
                      <div className="flex items-center gap-2 mt-2">
                        <img src={BTC_ICON} alt="BTC" className="h-6 w-6 rounded-full" />
                        <span className="text-[16px] font-bold text-[#201909]">BTC</span>
                      </div>
                    </DataBlock>
                    <DataBlock title="Current APY">
                      <div className="mt-2 text-[15px] leading-none font-bold text-[#201909]">
                        {(TARGET_APY * 100).toFixed(0)}%
                      </div>
                    </DataBlock>
                    <DataBlock title="1M Cumulative Added Value">
                      <div className="mt-2 text-[16px] leading-none font-bold text-[#009966]">
                        {formatSignedCurrency(chartState.monthAddedValue)}
                      </div>
                    </DataBlock>
                  </aside>
                </div>
              )}
            </div>

            <div className="mt-5 text-[12px] text-[#9a9079]">Wallet balance: {walletBalanceDisplay} wBTC</div>
            {actionBusy && !dialogOpen && (
              <div className="mt-4">
                <ActionStatus state={actionState} />
              </div>
            )}
          </section>
        </div>

        {dialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30 px-4">
            <div className="bg-[#1c1a15] rounded-2xl border border-[rgba(255,255,255,0.14)] max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[24px] font-semibold text-white leading-none">
                  {dialogMode === "deposit" ? "Deposit" : "Withdraw"}
                </h3>
                <button onClick={() => setDialogOpen(false)} className="text-white/70 hover:text-white text-2xl">x</button>
              </div>
              <div className="mb-2 flex gap-2 rounded-xl bg-[rgba(255,255,255,0.05)] p-1 border border-[rgba(255,255,255,0.08)]">
                <button className={`flex-1 rounded-lg px-3 py-2 text-[14px] font-semibold transition ${dialogMode === "deposit" ? "bg-white text-[#201909]" : "text-white/80"}`} onClick={() => setDialogMode("deposit")}>Deposit</button>
                <button className={`flex-1 rounded-lg px-3 py-2 text-[14px] font-semibold transition ${dialogMode === "withdraw" ? "bg-white text-[#201909]" : "text-white/80"}`} onClick={() => setDialogMode("withdraw")}>Withdraw</button>
              </div>
              <div className="relative mt-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] rounded-xl px-3 pr-16 py-3 text-[18px] text-white outline-none"
                  placeholder="0.0"
                />
                <button
                  type="button"
                  onClick={() => setAmount(maxAmountForMode)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold tracking-[0.08em] text-white/70 hover:text-white transition-colors"
                >
                  MAX
                </button>
              </div>
              {actionBusy && <div className="text-[14px] text-white/80">{actionState.label}</div>}
              <div className="pt-2 flex justify-end gap-3">
                <button onClick={() => setDialogOpen(false)} className="h-11 px-4 rounded-xl border border-[rgba(255,255,255,0.2)] text-white text-[14px]">Cancel</button>
                <button onClick={handleSubmitAction} disabled={actionBusy || !ready} className="h-11 px-5 rounded-xl bg-[#f1c255] text-[#201909] text-[14px] font-semibold disabled:opacity-50">
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

function PerformanceChart({ data }) {
  const values = data.flatMap((point) => [point.btc, point.stillwater]).filter(Number.isFinite);
  const minValue = values.length ? Math.min(...values, 0) : 0;
  const maxValue = values.length ? Math.max(...values, 0) : 0;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="stillwater-performance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#009966" stopOpacity="0.14" />
            <stop offset="95%" stopColor="#009966" stopOpacity="0" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#ece7de" />
        <XAxis dataKey="i" hide />
        <YAxis hide domain={[minValue, maxValue]} tickCount={4} />
        <Area type="monotone" dataKey="stillwater" stroke="#009966" strokeWidth={3} fill="url(#stillwater-performance-fill)" fillOpacity={1} dot={false} baseValue={0} isAnimationActive={false} />
        <Line type="monotone" dataKey="btc" stroke="#a79f89" strokeWidth={2.3} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ActionStatus({ state }) {
  if (!state || state.phase === "idle") return null;
  const showSpinner = state.phase !== "success";
  const tone =
    state.phase === "success" ? "text-[#009966]" : "text-[#645c4a]";
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[rgba(17,19,24,0.08)] bg-white/80 px-3 py-2 text-xs">
      {showSpinner ? (
        <span className="h-3 w-3 rounded-full border-2 border-[#201909] border-t-transparent animate-spin" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-[#009966]" />
      )}
      <span className={tone}>{state.label}</span>
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div className="h-full w-full rounded-xl border border-[#f0ebe1] bg-white/30 flex items-center justify-center text-[#9b917b] text-sm">
      Loading chart...
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[13px] text-[#756c57] font-medium">{label}</span>
    </div>
  );
}

function DataBlock({ title, children }) {
  return (
    <div className="mb-10">
      <p className="text-[#6f664f] text-[14px] font-semibold tracking-[-0.01em]">
        {title}
      </p>
      {children}
    </div>
  );
}

function buildValueSeries(prices, initial) {
  const start = prices[0] || 1;
  return prices.map((price) => Number((initial * (price / start)).toFixed(2)));
}

function buildCompoundingSeries(prices, initial, apy) {
  if (prices.length === 0) return [];
  const rMonthly = Math.pow(1 + apy, 1 / 12) - 1;
  const series = [initial];
  for (let i = 1; i < prices.length; i++) {
    const priceFactor = prices[i] / prices[i - 1];
    const nextValue = series[i - 1] * priceFactor * (1 + rMonthly);
    series.push(Number(nextValue.toFixed(2)));
  }
  return series;
}

function resampleSeries(values, targetLength) {
  const len = values.length;
  if (targetLength <= 0 || len === 0) return [];
  if (len === targetLength) return values.slice();
  if (len === 1) return Array.from({ length: targetLength }, () => values[0]);

  const lastIndex = len - 1;
  const scale = lastIndex / (targetLength - 1);
  const out = [];
  for (let i = 0; i < targetLength; i++) {
    const idx = i * scale;
    const low = Math.floor(idx);
    const high = Math.min(lastIndex, Math.ceil(idx));
    if (low === high) {
      out.push(values[low]);
    } else {
      const t = idx - low;
      const v = values[low] + (values[high] - values[low]) * t;
      out.push(Number(v.toFixed(2)));
    }
  }
  return out;
}

function toNumber(value, decimals) {
  try {
    return Number(formatUnits(value || 0n, decimals));
  } catch {
    return 0;
  }
}

function formatTokenAmount(
  value,
  decimals,
  maximumFractionDigits = 6,
  minimumFractionDigits = 0
) {
  const num = toNumber(value, decimals);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num);
}

function formatInputAmount(value, decimals) {
  try {
    const raw = formatUnits(value || 0n, decimals);
    if (!raw.includes(".")) return raw;
    return raw.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
  } catch {
    return "0";
  }
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "-";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function formatSignedCurrency(value) {
  if (!Number.isFinite(value)) return "$0.00";
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

function shorten(address = "") {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
