// app/etfs/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import { useRouter } from "next/navigation";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { fetchAssets } from "../../lib/portfolio";
import {
  getMissingMetaMaskMessage,
  isLikelyMobileDevice,
  openMetaMaskForCurrentDevice,
} from "../../lib/metamask";

const imgTokenBtc = "/assets/btc%20small.png";
const imgTokenEth = "/assets/eth%20small.png";
const imgTokenUsd = "/assets/usd%20small.png";
const imgTokenTreasuries = "/assets/us%20treasury%20small.png";
const imgTokenSp500 = "/assets/snp%20500.png";
const imgTokenGold = "/assets/gold%20small.png";
const TIMEFRAMES = [
  // { id: "1y", label: "1Y AGO", months: 12 },
  { id: "3y", label: "3Y AGO", months: 36 },
  { id: "5y", label: "5Y AGO", months: 60 },
];
const TARGET_POINTS = 60;
const INITIAL_CAPITAL = 1000;
const STILLWATER_EARNINGS_MODE = "compounding"; // "monthly" | "compounding"
const DEFAULT_CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";
const TARGET_CHAIN_HEX = `0x${Number(DEFAULT_CHAIN_ID).toString(16)}`;
const DEFAULT_WBTC_DECIMALS = Number(
  process.env.NEXT_PUBLIC_WBTC_DECIMALS || 8
);
const ENV_VAULT_ADDRESS = process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS || "";
const ENV_WBTC_ADDRESS = process.env.NEXT_PUBLIC_WBTC_ADDRESS || "";

const STAKING_VAULT_ABI = [
  "function stake(uint256 amountUA) external returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
];

const BUNDLES = [
  {
    id: "core",
    title: "Core bundle",
    description: "Earning passive yield on the top of Bitcoin yearly growth.",
    assetItems: [{ key: "asset1", label: "bitcoin", img: imgTokenBtc }],
    fixedApy: 0.03,
    chartSourceLabel: "Projection based on the historical Bitcoin market performance.",
    growthSource: "onchain",
    isLiveOnChain: true,
  },
  {
    id: "crypto",
    title: "Crypto bundle",
    description: "Staples of the digital economy in one basket.",
    assetItems: [
      { key: "asset1", label: "bitcoin", img: imgTokenBtc },
      { key: "asset2", label: "ethereum", img: imgTokenEth },
      { key: "asset11", label: "usdt", img: imgTokenUsd },
    ],
    fixedApy: 0.07,
    chartSourceLabel:
      "Projection based on equal-weight historical performance of Bitcoin, Ethereum, and USDT.",
    growthSource: "historical",
    isLiveOnChain: false,
  },
  {
    id: "flagship",
    title: "Flagship bundle",
    description: "Best assets of this generation, combined.",
    assetItems: [
      { key: "asset1", label: "bitcoin", img: imgTokenBtc },
      { key: "asset10", label: "us treasuries", img: imgTokenTreasuries },
      { key: "asset3", label: "s&p 500", img: imgTokenSp500 },
      { key: "asset7", label: "gold", img: imgTokenGold },
    ],
    fixedApy: 0.055,
    chartSourceLabel:
      "Projection based on equal-weight historical performance of Bitcoin, US Treasuries, S&P 500, and Gold.",
    growthSource: "historical",
    isLiveOnChain: false,
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVaultConfig() {
  const vault = ENV_VAULT_ADDRESS;
  const wbtc = ENV_WBTC_ADDRESS;
  if (!vault || !wbtc) {
    throw new Error(
      "Vault/WBTC address missing in env. Set NEXT_PUBLIC_STAKING_VAULT_ADDRESS and NEXT_PUBLIC_WBTC_ADDRESS."
    );
  }
  return { vault, wbtc };
}

export default function EtfsPage() {
  const router = useRouter();
  const [timeframeByBundle, setTimeframeByBundle] = useState(() =>
    Object.fromEntries(BUNDLES.map((bundle) => [bundle.id, "5y"]))
  );
  const [showChartDetailsByBundle, setShowChartDetailsByBundle] = useState(() =>
    Object.fromEntries(BUNDLES.map((bundle) => [bundle.id, false]))
  );
  const [assetsCatalog, setAssetsCatalog] = useState({});
  const [bundleGrowthSeries, setBundleGrowthSeries] = useState([]);
  const [chartError, setChartError] = useState("");
  const [depositAmount, setDepositAmount] = useState("0.01");
  const [addresses, setAddresses] = useState({ vault: "", wbtc: "" });
  const [walletAddress, setWalletAddress] = useState("");
  const [walletBalanceRaw, setWalletBalanceRaw] = useState(0n);
  const [wbtcDecimals, setWbtcDecimals] = useState(DEFAULT_WBTC_DECIMALS);
  const [txBusy, setTxBusy] = useState(false);
  const [txPhase, setTxPhase] = useState("idle");
  const [txStatus, setTxStatus] = useState("");
  const [txError, setTxError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadPrices() {
      try {
        setChartError("");
        const data = await fetchAssets();
        if (!alive) return;
        const assets = data?.assets;
        if (!assets || typeof assets !== "object") {
          throw new Error("Missing prices data.");
        }
        setAssetsCatalog(assets);
      } catch (err) {
        if (!alive) return;
        setChartError(err?.message || "Failed to load price data.");
      }
    }

    loadPrices();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadBundleGrowth() {
      try {
        const response = await fetch(
          `/api/core-bundle/snapshots?chainId=${DEFAULT_CHAIN_ID}&limit=1000`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error("No growth snapshots yet.");
        }
        const json = await response.json();
        if (!alive) return;
        const snapshots = Array.isArray(json?.snapshots) ? json.snapshots : [];
        const parsed = snapshots
          .map((row) => ({
            timestamp: new Date(row?.blockTimestamp || 0).getTime(),
            totalAssets: Number.parseFloat(row?.totalAssets),
          }))
          .filter(
            (row) =>
              Number.isFinite(row.timestamp) && Number.isFinite(row.totalAssets)
          )
          .sort((a, b) => a.timestamp - b.timestamp);
        console.log("[core-bundle] snapshots loaded", {
          at: new Date().toISOString(),
          chainId: DEFAULT_CHAIN_ID,
          count: parsed.length,
          latest:
            parsed.length > 0
              ? {
                  timestamp: new Date(parsed[parsed.length - 1].timestamp).toISOString(),
                  totalAssets: parsed[parsed.length - 1].totalAssets,
                }
              : null,
        });
        setBundleGrowthSeries(parsed);
      } catch {
        if (!alive) return;
        // Local env without DB/Prisma should render as empty chart.
        setBundleGrowthSeries([]);
      }
    }

    loadBundleGrowth();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function initializeDepositConfig() {
      try {
        const nextAddresses = getVaultConfig();
        if (!alive) return;
        setAddresses(nextAddresses);
      } catch (error) {
        console.error("failed loading vault config", error);
        if (!alive) return;
        setTxError(error?.message || "Failed to load vault/token config.");
      }
    }

    initializeDepositConfig();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum || !addresses.wbtc) {
      return;
    }

    const eth = window.ethereum;
    let alive = true;

    const refreshConnectedBalance = async () => {
      try {
        const accounts = await eth.request({ method: "eth_accounts" });
        const account = accounts?.[0];
        if (!alive) return;
        if (!account) {
          setWalletAddress("");
          setWalletBalanceRaw(0n);
          return;
        }

        const provider = new BrowserProvider(eth);
        const token = new Contract(addresses.wbtc, ERC20_ABI, provider);
        const [balance, decimalsRaw] = await Promise.all([
          token.balanceOf(account),
          token.decimals().catch(() => DEFAULT_WBTC_DECIMALS),
        ]);
        if (!alive) return;
        const decimals = Number(decimalsRaw);
        setWbtcDecimals(
          Number.isFinite(decimals) ? decimals : DEFAULT_WBTC_DECIMALS
        );
        setWalletAddress(account);
        setWalletBalanceRaw(balance);
      } catch (error) {
        console.error("wallet balance refresh failed", error);
      }
    };

    refreshConnectedBalance();
    eth.on("accountsChanged", refreshConnectedBalance);
    eth.on("chainChanged", refreshConnectedBalance);
    return () => {
      alive = false;
      eth.removeListener("accountsChanged", refreshConnectedBalance);
      eth.removeListener("chainChanged", refreshConnectedBalance);
    };
  }, [addresses.wbtc]);

  async function ensureCorrectChain(provider) {
    const network = await provider.getNetwork();
    if (network.chainId?.toString() === DEFAULT_CHAIN_ID) return true;
    if (!window.ethereum?.request) return false;
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: TARGET_CHAIN_HEX }],
    });
    return true;
  }

  async function handleDeposit() {
    if (txBusy) return;
    if (typeof window === "undefined" || !window.ethereum) {
      setTxError(getMissingMetaMaskMessage({ opening: true }));
      if (isLikelyMobileDevice()) {
        openMetaMaskForCurrentDevice();
      }
      return;
    }
    if (!depositAmount || Number(depositAmount) <= 0) {
      setTxError("Enter a deposit amount greater than zero.");
      return;
    }

    let completed = false;
    try {
      setTxBusy(true);
      setTxPhase("preparing");
      setTxError("");
      setTxStatus("Preparing transaction...");

      const nextAddresses =
        addresses.vault && addresses.wbtc ? addresses : getVaultConfig();
      setAddresses(nextAddresses);

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const account = accounts?.[0];
      if (!account) {
        throw new Error("No wallet account selected.");
      }

      const provider = new BrowserProvider(window.ethereum);
      setTxStatus(`Checking network (chain ${DEFAULT_CHAIN_ID})...`);
      const chainReady = await ensureCorrectChain(provider);
      if (!chainReady) {
        throw new Error(`Switch MetaMask to chain ${DEFAULT_CHAIN_ID}.`);
      }

      const signer = await provider.getSigner();
      const wbtc = new Contract(nextAddresses.wbtc, ERC20_ABI, signer);
      const vault = new Contract(nextAddresses.vault, STAKING_VAULT_ABI, signer);

      const decimalsRaw = await wbtc.decimals();
      const decimals = Number(decimalsRaw);
      const resolvedDecimals = Number.isFinite(decimals)
        ? decimals
        : DEFAULT_WBTC_DECIMALS;
      setWbtcDecimals(resolvedDecimals);

      const value = parseUnits(depositAmount, resolvedDecimals);
      if (value <= 0n) {
        throw new Error("Deposit amount must be greater than zero.");
      }

      setTxStatus("Checking WBTC allowance...");
      const allowance = await wbtc.allowance(account, nextAddresses.vault);
      if (allowance < value) {
        setTxPhase("approval-signing");
        setTxStatus("Confirming approval...");
        const approveTx = await wbtc.approve(nextAddresses.vault, value);
        setTxPhase("approval-pending");
        setTxStatus("Approval pending...");
        await approveTx.wait();
        setTxPhase("approval-complete");
        setTxStatus("Approval completed.");
        await sleep(350);
      }

      setTxPhase("deposit-signing");
      setTxStatus("Confirming deposit...");
      const stakeTx = await vault.stake(value);
      setTxPhase("deposit-pending");
      setTxStatus("Deposit pending...");
      await stakeTx.wait();

      const nextBalance = await wbtc.balanceOf(account);
      setWalletAddress(account);
      setWalletBalanceRaw(nextBalance);
      setTxStatus("Deposit complete.");
      setTxPhase("success");
      await new Promise((resolve) => setTimeout(resolve, 1200));
      completed = true;
      router.push("/my-earnings");
      return;
    } catch (error) {
      console.error("deposit failed", error);
      setTxPhase("idle");
      setTxStatus("");
      setTxError(
        error?.shortMessage ||
          error?.reason ||
          error?.message ||
          "Deposit failed."
      );
    } finally {
      if (!completed) {
        setTxBusy(false);
        setTxPhase("idle");
      }
    }
  }

  const walletBalanceLabel = useMemo(
    () => formatTokenAmount(walletBalanceRaw, wbtcDecimals),
    [walletBalanceRaw, wbtcDecimals]
  );

  const walletBalanceExact = useMemo(() => {
    try {
      return formatUnits(walletBalanceRaw || 0n, wbtcDecimals);
    } catch {
      return "0";
    }
  }, [walletBalanceRaw, wbtcDecimals]);

  const coreBtcSeries = useMemo(() => {
    const btc = assetsCatalog?.asset1?.prices;
    return Array.isArray(btc) ? btc : [];
  }, [assetsCatalog]);

  const bundleViews = useMemo(() => {
    const views = {};

    for (const bundle of BUNDLES) {
      const selectedTimeframe = timeframeByBundle[bundle.id] || "5y";
      const frame = TIMEFRAMES.find((item) => item.id === selectedTimeframe);
      const assetSeries = bundle.assetItems
        .map((item) => assetsCatalog?.[item.key]?.prices)
        .filter((series) => Array.isArray(series) && series.length >= 2);
      const bundlePriceSeries =
        assetSeries.length === bundle.assetItems.length
          ? buildEqualWeightSeries(assetSeries, INITIAL_CAPITAL)
          : [];
      const apys = bundle.assetItems
        .map((item) => Number(assetsCatalog?.[item.key]?.yearlyYield))
        .filter((value) => Number.isFinite(value));
      const apy = Number.isFinite(bundle.fixedApy)
        ? bundle.fixedApy
        : apys.length
          ? apys.reduce((sum, value) => sum + value, 0) / apys.length
          : 0;

      let chartState = { data: [], baseEnd: null, yieldEnd: null, diffLabel: "" };
      if (frame && bundlePriceSeries.length > 0) {
        const monthlyPrices = bundlePriceSeries.slice(-frame.months);
        if (monthlyPrices.length >= 2) {
          const baseMonthly = buildValueSeries(monthlyPrices, INITIAL_CAPITAL);
          const yieldMonthly =
            STILLWATER_EARNINGS_MODE === "monthly"
              ? buildMonthlyEarningsSeries(baseMonthly, INITIAL_CAPITAL, apy)
              : buildCompoundingSeries(baseMonthly, INITIAL_CAPITAL, apy);
          const baseSeries = resampleSeries(baseMonthly, TARGET_POINTS).map(
            (value) => Number((value - INITIAL_CAPITAL).toFixed(2))
          );
          const yieldSeries = resampleSeries(yieldMonthly, TARGET_POINTS).map(
            (value) => Number((value - INITIAL_CAPITAL).toFixed(2))
          );
          chartState = {
            data: baseSeries.map((value, index) => ({
              i: index,
              btc: value,
              stillwater: yieldSeries[index] ?? value,
            })),
            baseEnd: baseSeries[baseSeries.length - 1],
            yieldEnd: yieldSeries[yieldSeries.length - 1],
          };
        }
      }

      let growthState = { data: [], growthPct: null };
      if (frame) {
        if (bundle.growthSource === "onchain") {
          if (bundleGrowthSeries.length >= 2) {
            const monthMs = 30 * 24 * 60 * 60 * 1000;
            const cutoffTs = Date.now() - frame.months * monthMs;
            const scoped = bundleGrowthSeries.filter((row) => row.timestamp >= cutoffTs);
            const source = scoped.length >= 2 ? scoped : bundleGrowthSeries;
            if (source.length >= 2) {
              const startAssets = source[0].totalAssets;
              const endAssets = source[source.length - 1].totalAssets;
              if (
                Number.isFinite(startAssets) &&
                startAssets > 0 &&
                Number.isFinite(endAssets)
              ) {
                const growthRaw = source.map(
                  (row) => ((row.totalAssets - startAssets) / startAssets) * 100
                );
                const growthSeries = resampleSeries(growthRaw, TARGET_POINTS).map((value) =>
                  Number(value.toFixed(4))
                );
                growthState = {
                  data: growthSeries.map((value, index) => ({ i: index, growth: value })),
                  growthPct: ((endAssets - startAssets) / startAssets) * 100,
                };
              }
            }
          }
        } else if (bundlePriceSeries.length >= 2) {
          const scoped = bundlePriceSeries.slice(-frame.months);
          const source = scoped.length >= 2 ? scoped : bundlePriceSeries;
          if (source.length >= 2) {
            const startValue = source[0];
            const endValue = source[source.length - 1];
            if (
              Number.isFinite(startValue) &&
              startValue > 0 &&
              Number.isFinite(endValue)
            ) {
              const growthRaw = source.map(
                (value) => ((value - startValue) / startValue) * 100
              );
              const growthSeries = resampleSeries(growthRaw, TARGET_POINTS).map((value) =>
                Number(value.toFixed(4))
              );
              growthState = {
                data: growthSeries.map((value, index) => ({ i: index, growth: value })),
                growthPct: ((endValue - startValue) / startValue) * 100,
              };
            }
          }
        }
      }

      views[bundle.id] = {
        timeframe: selectedTimeframe,
        apy,
        chartState,
        growthState,
      };
    }

    return views;
  }, [assetsCatalog, bundleGrowthSeries, timeframeByBundle]);

  const latestBtcPrice = coreBtcSeries[coreBtcSeries.length - 1];
  const approxUsd = useMemo(() => {
    const numericAmount = Number(depositAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return "$0.00";
    if (!Number.isFinite(latestBtcPrice) || latestBtcPrice <= 0) return "-";
    return formatCurrency(numericAmount * latestBtcPrice);
  }, [depositAmount, latestBtcPrice]);

  return (
    <div className="min-h-screen flex flex-col text-[#201909]">
      <Header />

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 pt-12 pb-32">
          <div className="mb-8">
            <h1 className="text-[36px] md:text-[44px] font-semibold tracking-[-1.2px] text-[#201909] leading-none">
              Stillwater Bundles
            </h1>
          </div>
          {BUNDLES.map((bundle) => {
            const activeBundle = bundle;
            const bundleView = bundleViews[bundle.id] || {
              timeframe: "5y",
              apy: 0,
              chartState: { data: [], baseEnd: null, yieldEnd: null },
              growthState: { data: [], growthPct: null },
            };
            const activeBundleApy = Number(bundleView.apy) || 0;
            const chartState = bundleView.chartState || {
              data: [],
              baseEnd: null,
              yieldEnd: null,
            };
            const isInactiveBundle = !activeBundle.isLiveOnChain;
            const timeframe = bundleView.timeframe || "5y";
            const timeframeMonths =
              TIMEFRAMES.find((item) => item.id === timeframe)?.months || TARGET_POINTS;
            const showChartDetails = !!showChartDetailsByBundle[bundle.id];
            return (
          <section
            key={bundle.id}
            className={`rounded-[20px] border p-4 md:p-8 shadow-sm mb-8 transition-colors ${
              isInactiveBundle
                ? "bg-[#f6f5f2] border-[#e8e1d1] opacity-90"
                : "bg-[#fdfbf9] border-[#f2ebde]"
            }`}
          >
            <div className="flex flex-col md:flex-row justify-between gap-14 mb-8">
              <div className="flex-1 space-y-10 max-w-[560px]">
                <div className="space-y-2 mb-[24px]">
                  <div className="flex items-start gap-3">
                    <h2 className="text-[40px] font-semibold tracking-[-1.28px] text-[#201909] leading-none">
                      {activeBundle.title}
                    </h2>
                    {isInactiveBundle ? (
                      <span className="inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-full border border-[#d5d0c4] px-3.5 text-[12px] font-medium tracking-[0.04em] text-[#756c57] md:h-7 md:px-3 md:text-[11px] md:font-semibold md:uppercase md:tracking-[0.08em]">
                        Coming Soon
                      </span>
                    ) : null}
                  </div>
                  <p className="text-base text-[#756c57] tracking-[-0.64px]">
                    {activeBundle.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-12 gap-y-6 mb-[24px]">
                  <div className="space-y-2.5">
                    <p className="text-[14px] font-medium text-[#756c57] tracking-[-0.56px] leading-[0.9]">
                      Assets in the bundle
                    </p>
                    <div className="flex items-center gap-1.5 h-[32px]">
                      {activeBundle.assetItems.map((asset) => (
                        <TokenPill key={`${activeBundle.id}-${asset.label}`} label={asset.label} img={asset.img} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <p className="text-[14px] font-medium text-[#756c57] tracking-[-0.56px] leading-[0.9]">
                      Min. lockup
                    </p>
                    <p className="text-[16px] font-normal tracking-[-1%] text-[rgba(117,108,87,0.61)]">
                      None, withdraw anytime
                    </p>
                  </div>
                  <div className="space-y-2.5 min-w-[120px]">
                    <p className="text-[14px] font-medium text-[#756c57] tracking-[-0.56px] leading-[0.9]">
                      Target APY
                    </p>
                    <p className="text-[16px] font-semibold text-[rgb(0,153,102)]">
                      {formatPercent(activeBundleApy * 100)}
                    </p>
                  </div>
                </div>

                <div className="space-y-6 pt-2">
                  {activeBundle.isLiveOnChain ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between items-end">
                          <label className="text-[16px] font-semibold text-[#756c57] tracking-[-0.48px]">
                            Deposit principal wBTC
                          </label>
                          <span className="text-[12px] font-medium text-[#645c4a]">
                            {walletAddress
                              ? `Balance: ${walletBalanceLabel} wBTC`
                              : "Balance: connect wallet"}
                          </span>
                        </div>

                        <div className="relative h-[74px] bg-white border rounded-[12px] flex items-center px-6 transition-colors border-[#f2ebde]">
                          <div className="flex flex-col flex-1 justify-center">
                            <input
                              type="text"
                              value={depositAmount}
                              onChange={(event) =>
                                setDepositAmount(event.target.value)
                              }
                              className="bg-transparent text-[24px] font-semibold text-[#201909] placeholder-[#b1a995] outline-none w-full leading-tight"
                            />
                            <span className="text-[12px] font-medium text-[#b1a995] leading-none mt-0.5">
                              &asymp; {approxUsd}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold text-[#645c4a]">
                              wBTC
                            </span>
                            <button
                              type="button"
                              onClick={() => setDepositAmount(walletBalanceExact)}
                              disabled={walletBalanceRaw === 0n || txBusy}
                              className="bg-[#f4e0b3] h-[23px] px-2.5 rounded-[4px] text-[10px] font-bold text-[#201909] hover:opacity-80 transition-opacity"
                            >
                              MAX
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleDeposit}
                        disabled={txBusy || !addresses.vault || !addresses.wbtc}
                        className="w-full bg-[#201909] h-[64px] rounded-[12px] shadow-[0px_10px_15px_-3px_#f2ebde,0px_4px_6px_-4px_#f2ebde] flex items-center justify-center gap-5 hover:opacity-90 transition-all active:scale-[0.98] group disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-1 font-semibold text-[16px]">
                          <span className="text-white">
                            {txBusy ? "Processing..." : "Deposit wBTC"}
                          </span>
                          <span className="text-[#b1a995]">to start earning</span>
                        </div>
                        <svg className="size-5" fill="none" viewBox="0 0 20 20">
                          <path
                            d="M4.16667 10H15.8333"
                            stroke="white"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.66667"
                          />
                          <path
                            d="M10 4.16667L15.8333 10L10 15.8333"
                            stroke="white"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.66667"
                          />
                        </svg>
                      </button>
                      {txStatus ? (
                        <p className="text-[12px] font-medium text-[#645c4a]">
                          {txStatus}
                        </p>
                      ) : null}
                      {txError ? (
                        <p className="text-[12px] font-medium text-rose-700">
                          {txError}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-[12px] border border-[#f2ebde] bg-white/70 p-5 space-y-2">
                      <p className="text-[15px] font-semibold text-[#201909]">
                        On-chain deposits for this bundle are coming soon.
                      </p>
                      <p className="text-[13px] text-[#756c57]">
                        You can still review historical price behavior and projected outcomes below.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full md:w-[320px] flex flex-col gap-2">
                <InfoCard
                  title="Institutional Protection"
                  className="bg-[#f7f3eb] rounded-[12px] p-5 pt-4 pb-6 space-y-4"
                  titleClassName="text-[16px] font-semibold text-[#201909] leading-[30px]"
                >
                  <InfoRow
                    icon={<ShieldIcon />}
                    text="Assets are secured by battle-tested smart contracts."
                  />
                  <InfoRow
                    icon={<KeyIcon />}
                    text="You retain full control of your private keys via direct on-chain settlement."
                  />
                </InfoCard>
                <InfoCard className="bg-[#f7f3eb] rounded-[12px] p-5 py-5">
                  <InfoRow
                    icon={<YieldIcon />}
                    text="Yield is generated via market-neutral basis trading and protocol-native staking. Rewards are settled in USDC."
                  />
                </InfoCard>
              </div>
            </div>

            <div className="w-full overflow-hidden">
              <div
                className={
                  showChartDetails
                    ? "flex flex-col gap-[24px] items-start px-0 md:px-[24px] py-[20px] relative w-full md:bg-[rgba(255,255,255,0.4)] md:border md:border-[#f2ebde] md:rounded-[12px]"
                    : "flex w-full items-start py-[4px]"
                }
              >
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() =>
                      setShowChartDetailsByBundle((prev) => ({
                        ...prev,
                        [bundle.id]: !prev[bundle.id],
                      }))
                    }
                    className="text-[#CAA34A] text-[14px] font-medium flex items-center gap-1 hover:text-[#b88c35] transition-colors"
                  >
                    <span>Details</span>
                    <svg
                      className={`h-6 w-6 transition-transform ${showChartDetails ? "rotate-180" : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M6 9L12 15L18 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                {showChartDetails ? (
                  <>
                    <div className="relative shrink-0 w-full flex flex-col gap-[2px]">
                      <h2 className="font-semibold text-[#201909] text-[20px] tracking-[-0.5px]">
                        How much would you earn if you invested earlier?
                      </h2>
                      <p className="text-[#756c57] text-[14px]">
                        {activeBundle.chartSourceLabel}
                      </p>
                    </div>

                    <div className="md:absolute top-[20px] right-[24px] bg-[#f7f3eb] rounded-[16px] border border-[#f2ebde] p-[4px] flex gap-[2px]">
                      {TIMEFRAMES.map((frame) => {
                        const isActive = timeframe === frame.id;
                        return (
                          <button
                            key={frame.id}
                            type="button"
                            onClick={() =>
                              setTimeframeByBundle((prev) => ({
                                ...prev,
                                [bundle.id]: frame.id,
                              }))
                            }
                            className={`w-[68px] h-[24px] flex items-center justify-center rounded-[12px] text-[11px] font-semibold transition-all ${
                              isActive
                                ? "bg-white text-[#201909] shadow-sm border border-[#f2ebde]"
                                : "text-[#756c57] hover:text-[#201909]"
                            }`}
                          >
                            {frame.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex gap-[16px] w-full">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="bg-[#b1a995] rounded-full size-[8px]" />
                          <p className="text-[13px] text-[#756c57] font-medium">
                            {activeBundle.id === "core"
                              ? "Missed potential earnings only holding BTC"
                              : "Missed potential earnings only holding this bundle"}
                          </p>
                        </div>
                        <p className="text-[20px] font-semibold text-[#201909] px-4">
                          {chartState.baseEnd != null
                            ? formatEarningsLine(chartState.baseEnd)
                            : "-"}
                        </p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="bg-[#009966] rounded-full size-[8px]" />
                          <p className="text-[13px] text-[#756c57] font-medium">
                            {activeBundle.id === "core"
                              ? "Missed potential earnings with Stillwater"
                              : "Missed potential earnings with bundle APY"}
                          </p>
                        </div>
                        <p className="text-[20px] font-semibold text-[#009966] px-4">
                          {chartState.yieldEnd != null
                            ? formatEarningsLine(chartState.yieldEnd)
                            : "-"}
                        </p>
                      </div>
                    </div>

                    <div className="h-[200px] w-full">
                      {chartState.data.length ? (
                        <EarningsChart
                          data={chartState.data}
                          idPrefix={`earn-${bundle.id}`}
                          timeframeMonths={timeframeMonths}
                        />
                      ) : (
                        <ChartPreview idPrefix={`preview-${bundle.id}`} />
                      )}
                    </div>
                    {chartError ? (
                      <p className="text-xs text-[#b1a995]">{chartError}</p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </section>
            );
          })}

        </div>
      </main>

      <Footer />

      {txBusy && <TxPendingOverlay phase={txPhase} status={txStatus} />}
    </div>
  );
}

function TxPendingOverlay({ phase = "pending", status = "" }) {
  if (phase === "success") {
    return (
      <div className="fixed inset-0 z-[70] bg-[#ececec] flex items-center justify-center px-4">
        <div className="flex w-full max-w-[560px] flex-col items-center justify-center text-center md:-mt-8">
          <div className="h-40 w-40 rounded-full bg-[#bfead7] shadow-[0_22px_40px_rgba(16,185,129,0.22)] flex items-center justify-center">
            <div className="h-16 w-16 rounded-full border-[6px] border-[#0b9b63] flex items-center justify-center">
              <svg
                className="h-9 w-9"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M6.5 12.5L10.3 16.3L17.5 9.1"
                  stroke="#0b9b63"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.8"
                />
              </svg>
            </div>
          </div>
          <p className="mt-12 text-[#17213a] text-[52px] leading-none font-semibold tracking-[-0.03em] text-center">
            Deposit Complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-[#ececec] flex items-center justify-center px-4">
      <div className="flex w-full max-w-[560px] flex-col items-center justify-center text-center md:-mt-8">
        <div className="relative h-44 w-44 flex items-center justify-center">
          <span className="h-44 w-44 rounded-full border-[6px] border-[#d7dbe2]" />
          <span
            className="absolute h-44 w-44 rounded-full border-[6px] border-transparent border-t-[#2563eb] border-l-[#2563eb] animate-spin"
            style={{ animationDuration: "1.4s" }}
          />
          <svg
            className="absolute h-14 w-14 text-[#9fc0f2]"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M21 12a9 9 0 0 0-15.5-6.36L3 8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.9"
            />
            <path
              d="M3 3v5h5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.9"
            />
            <path
              d="M3 12a9 9 0 0 0 15.5 6.36L21 16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.9"
            />
            <path
              d="M16 16h5v5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.9"
            />
          </svg>
        </div>
        <p className="mt-10 text-[#17213a] text-[30px] font-semibold tracking-[-0.02em] text-center">
          {status || "Processing transaction..."}
        </p>
        <div className="mt-8 flex items-center gap-4">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb] animate-bounce [animation-delay:-0.2s]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb] animate-bounce [animation-delay:-0.1s]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb] animate-bounce" />
        </div>
      </div>
    </div>
  );
}

function TokenPill({ label, img }) {
  return (
    <div className="flex gap-[4px] items-center justify-center pl-[6px] pr-[10px] py-[6px] relative rounded-[22px] border border-[#dfd2b9] shrink-0">
      <div className="relative rounded-full shrink-0 size-[20px] overflow-hidden">
        <img
          src={img}
          alt={label}
          className="absolute inset-0 object-cover size-full"
        />
      </div>
      <p className="font-semibold leading-normal text-[#645c4a] text-[12px] text-center uppercase tracking-normal">
        {label}
      </p>
    </div>
  );
}

function InfoCard({ title, children, className = "", titleClassName = "" }) {
  const baseClassName =
    className ||
    "rounded-2xl border border-[#f2ebde] bg-[#f7f3eb] px-5 py-5";
  const headingClassName =
    titleClassName || "text-base font-semibold mb-4 text-[#201909]";
  return (
    <div className={baseClassName}>
      {title ? (
        <h3 className={headingClassName}>{title}</h3>
      ) : null}
      <div className="space-y-4 text-[14px] text-[#645c4a]">{children}</div>
    </div>
  );
}

function InfoRow({ icon, text }) {
  return (
    <div className="flex gap-3 items-start">
      {typeof icon === "string" ? (
        <img src={icon} alt="" className="h-5 w-5 mt-0.5" />
      ) : (
        icon
      )}
      <p className="text-[14px] text-[#645c4a] leading-[1.4]">{text}</p>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      className="size-[20px] shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M21 11.0511V6.12325C21 5.34825 20.4145 4.70502 19.6551 4.57302C16.595 4.04108 14.0546 2.85772 12.8152 2.20154C12.3077 1.93282 11.6923 1.93282 11.1848 2.20154C9.94542 2.85772 7.40502 4.04108 4.34489 4.57302C3.58552 4.70502 3 5.34825 3 6.12325V11.0511C3 17.4795 9.53762 20.9859 11.4689 21.8815C11.8097 22.0395 12.1903 22.0395 12.5311 21.8815C14.4624 20.9859 21 17.4795 21 11.0511Z"
        stroke="#CAA34A"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="M8 11.5087L10.6606 14L16 9"
        stroke="#CAA34A"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg
      className="size-[20px] shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M15.5 14.5C18.8137 14.5 21.5 11.8137 21.5 8.5C21.5 5.18629 18.8137 2.5 15.5 2.5C12.1863 2.5 9.5 5.18629 9.5 8.5C9.5 9.38041 9.68962 10.2165 10.0303 10.9697L3.08579 17.9142C2.71071 18.2893 2.5 18.798 2.5 19.3284V21.5H5.5V19.5H7.5V17.5H9.5L13.0303 13.9697C13.7835 14.3104 14.6196 14.5 15.5 14.5Z"
        stroke="#CAA34A"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M17.5 6.5L16.5 7.5"
        stroke="#CAA34A"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function YieldIcon() {
  return (
    <svg
      className="size-[20px] shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 12V20"
        stroke="#CAA34A"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M12 12V13H15C18.3137 13 21 10.3137 21 7V6H18C14.6863 6 12 8.68629 12 12Z"
        stroke="#CAA34A"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M12 10V11H9C5.68629 11 3 8.31371 3 5V4H6C9.31371 4 12 6.68629 12 10Z"
        stroke="#CAA34A"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ChartPreview({ idPrefix = "preview" }) {
  const fillId = `${idPrefix}-stillwater-fill`;
  return (
    <svg
      viewBox="0 0 600 200"
      className="w-full h-full"
      role="img"
      aria-label="Projection chart"
    >
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="5%" stopColor="#009966" stopOpacity="0.15" />
          <stop offset="95%" stopColor="#009966" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g>
        <line
          x1="0"
          y1="145"
          x2="600"
          y2="145"
          stroke="#F2EBDE"
          strokeDasharray="3 3"
        />
        <line
          x1="0"
          y1="95"
          x2="600"
          y2="95"
          stroke="#F2EBDE"
          strokeDasharray="3 3"
        />
        <line
          x1="0"
          y1="5"
          x2="600"
          y2="5"
          stroke="#F2EBDE"
          strokeDasharray="3 3"
        />
        <line
          x1="0"
          y1="195"
          x2="600"
          y2="195"
          stroke="#F2EBDE"
          strokeDasharray="3 3"
        />
      </g>
      <path
        d="M0 188 L40 187 L80 186 L120 185 L160 182 L200 178 L240 172 L280 165 L320 156 L360 146 L400 134 L440 120 L480 106 L520 92 L560 80 L600 70"
        fill="none"
        stroke="#B1A995"
        strokeWidth="2"
      />
      <path
        d="M0 190 L40 189 L80 188 L120 186 L160 183 L200 178 L240 172 L280 164 L320 152 L360 138 L400 122 L440 106 L480 92 L520 78 L560 60 L600 48"
        fill="none"
        stroke="#009966"
        strokeWidth="2.5"
      />
      <path
        d="M0 190 L40 189 L80 188 L120 186 L160 183 L200 178 L240 172 L280 164 L320 152 L360 138 L400 122 L440 106 L480 92 L520 78 L560 60 L600 48 L600 200 L0 200 Z"
        fill={`url(#${fillId})`}
      />
    </svg>
  );
}

function EarningsChart({
  data,
  idPrefix = "earnings",
  timeframeMonths = TARGET_POINTS,
}) {
  const values = data
    .flatMap((point) => [point.btc, point.stillwater])
    .filter((value) => Number.isFinite(value));
  const minValue = values.length ? Math.min(...values, 0) : 0;
  const maxValue = values.length ? Math.max(...values, 0) : 0;
  const areaId = `${idPrefix}-stillwater-area`;
  const chartWrapRef = useRef(null);
  const [isTouchMode, setIsTouchMode] = useState(false);
  const [pinnedTooltipState, setPinnedTooltipState] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 900px), (hover: none), (pointer: coarse)");
    const updateTouchMode = () => setIsTouchMode(media.matches);
    updateTouchMode();
    if (media.addEventListener) {
      media.addEventListener("change", updateTouchMode);
      return () => media.removeEventListener("change", updateTouchMode);
    }
    media.addListener(updateTouchMode);
    return () => media.removeListener(updateTouchMode);
  }, []);

  useEffect(() => {
    if (!isTouchMode) {
      setPinnedTooltipState(null);
    }
  }, [isTouchMode]);

  useEffect(() => {
    if (!isTouchMode || !pinnedTooltipState) return;
    const handleOutsideTap = (event) => {
      const target = event.target;
      if (
        chartWrapRef.current &&
        target instanceof Node &&
        chartWrapRef.current.contains(target)
      ) {
        return;
      }
      setPinnedTooltipState(null);
    };
    document.addEventListener("pointerdown", handleOutsideTap);
    return () => document.removeEventListener("pointerdown", handleOutsideTap);
  }, [isTouchMode, pinnedTooltipState]);

  const readTooltipState = (chartState) => {
    if (!chartState) return null;
    let payload = Array.isArray(chartState.activePayload)
      ? chartState.activePayload
      : [];
    const indexRaw = Number(
      payload[0]?.payload?.i ?? chartState.activeTooltipIndex ?? chartState.activeLabel
    );
    const index = Number.isFinite(indexRaw) ? indexRaw : null;
    if (!payload.length && index != null && index >= 0 && index < data.length) {
      const point = data[index];
      if (point) {
        payload = [
          {
            dataKey: "stillwater",
            name: "Earned with Stillwater",
            value: point.stillwater,
            color: "#009966",
            payload: point,
          },
          {
            dataKey: "btc",
            name: "Earned only holding",
            value: point.btc,
            color: "#B1A995",
            payload: point,
          },
        ];
      }
    }
    if (!payload.length) return null;
    const coordinateRaw = chartState.activeCoordinate;
    const coordinate =
      coordinateRaw &&
      Number.isFinite(coordinateRaw.x) &&
      Number.isFinite(coordinateRaw.y)
        ? { x: coordinateRaw.x, y: coordinateRaw.y }
        : null;
    return {
      payload,
      label: index ?? chartState.activeLabel ?? 0,
      index,
      coordinate,
    };
  };

  const handleChartClick = (chartState) => {
    if (!isTouchMode) return;
    const nextState = readTooltipState(chartState);
    if (!nextState) {
      setPinnedTooltipState(null);
      return;
    }
    setPinnedTooltipState((current) =>
      current?.index === nextState.index ? null : nextState
    );
  };

  const mobileTooltipStyle = useMemo(() => {
    if (!isTouchMode || !pinnedTooltipState?.payload?.length) return null;
    const container = chartWrapRef.current;
    const width = container?.clientWidth || 0;
    const height = container?.clientHeight || 0;
    const coordinate = pinnedTooltipState.coordinate || {
      x: width / 2,
      y: height / 2,
    };
    const tooltipWidth = width > 0 ? Math.min(310, Math.max(220, width - 16)) : 280;
    const tooltipHeight = 166;

    let left = coordinate.x - tooltipWidth / 2;
    left = Math.max(8, Math.min(left, Math.max(8, width - tooltipWidth - 8)));

    let top = coordinate.y - tooltipHeight - 14;
    if (top < 8) {
      top = Math.min(Math.max(8, height - tooltipHeight - 8), coordinate.y + 14);
    }
    if (!Number.isFinite(top)) top = 8;

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${tooltipWidth}px`,
    };
  }, [isTouchMode, pinnedTooltipState]);

  return (
    <div ref={chartWrapRef} className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
          onClick={handleChartClick}
          accessibilityLayer={!isTouchMode}
        >
          <defs>
            <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#009966" stopOpacity="0.15" />
              <stop offset="95%" stopColor="#009966" stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="#F2EBDE"
          />
          <XAxis dataKey="i" hide />
          <YAxis hide domain={[minValue, maxValue]} tickCount={4} />
          <Tooltip
            isAnimationActive={false}
            cursor={isTouchMode ? false : { stroke: "#D9D0BF", strokeWidth: 1 }}
            content={
              isTouchMode ? (
                () => null
              ) : (
                <EarningsTooltip
                  pointCount={data.length}
                  timeframeMonths={timeframeMonths}
                />
              )
            }
            wrapperStyle={{ outline: "none", zIndex: 40, pointerEvents: "none" }}
          />
          <Area
            type="monotone"
            dataKey="stillwater"
            stroke="#009966"
            strokeWidth={2.5}
            fill={`url(#${areaId})`}
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 6.5, fill: "#FFFFFF", stroke: "#009966", strokeWidth: 3 }}
            baseValue={0}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="btc"
            stroke="#B1A995"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5.5, fill: "#FFFFFF", stroke: "#B1A995", strokeWidth: 2.5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {isTouchMode && pinnedTooltipState?.payload?.length && mobileTooltipStyle ? (
        <div className="pointer-events-none absolute z-40" style={mobileTooltipStyle}>
          <EarningsTooltip
            active
            payload={pinnedTooltipState.payload}
            label={pinnedTooltipState.label}
            pointCount={data.length}
            timeframeMonths={timeframeMonths}
          />
        </div>
      ) : null}
    </div>
  );
}

function EarningsTooltip({
  active,
  payload,
  label,
  pointCount = TARGET_POINTS,
  timeframeMonths = TARGET_POINTS,
}) {
  if (!active || !Array.isArray(payload) || !payload.length) return null;
  const stillwaterEntry = payload.find((entry) => entry?.dataKey === "stillwater");
  const btcEntry = payload.find((entry) => entry?.dataKey === "btc");
  const rowPoint = payload[0]?.payload || {};
  const stillwaterValue = Number(stillwaterEntry?.value ?? rowPoint.stillwater);
  const btcValue = Number(btcEntry?.value ?? rowPoint.btc);
  if (!Number.isFinite(stillwaterValue) || !Number.isFinite(btcValue)) return null;
  const rawIndex = Number(payload[0]?.payload?.i ?? label);
  const pointIndex = Number.isFinite(rawIndex) ? rawIndex : 0;
  const addedValue = stillwaterValue - btcValue;
  const addedValueClass =
    addedValue >= 0 ? "text-[#009966]" : "text-[#b42318]";

  return (
    <div className="rounded-[22px] border border-[#f2ebde] bg-white/95 px-5 py-4 shadow-[0_10px_24px_rgba(32,25,9,0.14)]">
      <p className="text-[18px] leading-none font-semibold text-[#201909]">
        {formatTooltipPeriod(pointIndex, pointCount, timeframeMonths)}
      </p>
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] text-[#645c4a]">Earned with Stillwater:</span>
          <span className="text-[14px] font-semibold text-[#009966]">
            {formatCurrency(stillwaterValue)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] text-[#645c4a]">Earned only holding:</span>
          <span className="text-[14px] font-semibold text-[#B1A995]">
            {formatCurrency(btcValue)}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 border-t border-[#f2ebde] pt-3">
        <span className="text-[14px] font-semibold text-[#201909]">Added value:</span>
        <span className={`text-[14px] font-semibold ${addedValueClass}`}>
          {formatSignedCurrency(addedValue)}
        </span>
      </div>
    </div>
  );
}

function buildValueSeries(prices, initial) {
  const start = prices[0] || 1;
  return prices.map((price) => Number((initial * (price / start)).toFixed(2)));
}

function buildEqualWeightSeries(seriesList, initial) {
  if (!Array.isArray(seriesList) || seriesList.length === 0) return [];
  const minLen = Math.min(...seriesList.map((series) => series?.length || 0));
  if (!Number.isFinite(minLen) || minLen < 2) return [];
  const aligned = seriesList.map((series) => series.slice(-minLen));
  return Array.from({ length: minLen }, (_, index) => {
    let ratioSum = 0;
    let count = 0;
    for (const series of aligned) {
      const start = series[0];
      const point = series[index];
      if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(point)) {
        continue;
      }
      ratioSum += point / start;
      count += 1;
    }
    if (count === 0) return initial;
    return Number((initial * (ratioSum / count)).toFixed(2));
  });
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

function buildMonthlyEarningsSeries(prices, initial, apy) {
  if (prices.length === 0) return [];
  const rMonthly = Math.pow(1 + apy, 1 / 12) - 1;
  const btcQty = initial / prices[0];
  let cashYield = 0;
  const series = [initial];

  for (let i = 1; i < prices.length; i++) {
    const btcValue = btcQty * prices[i];
    cashYield += btcValue * rMonthly;
    series.push(Number((btcValue + cashYield).toFixed(2)));
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

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "-";
  try {
    return new Intl.NumberFormat(undefined, {
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
  if (!Number.isFinite(value)) return "-";
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

function formatTooltipPeriod(index, pointCount, timeframeMonths) {
  const safeIndex = Number.isFinite(index) ? Math.max(0, index) : 0;
  const safePointCount =
    Number.isFinite(pointCount) && pointCount > 1 ? pointCount : TARGET_POINTS;
  const safeMonths =
    Number.isFinite(timeframeMonths) && timeframeMonths > 0
      ? timeframeMonths
      : TARGET_POINTS;
  const monthProgress =
    safePointCount > 1 ? safeIndex / (safePointCount - 1) : 0;
  const absoluteMonth = Math.max(
    1,
    Math.min(safeMonths, Math.round(monthProgress * safeMonths))
  );
  const year = Math.floor((absoluteMonth - 1) / 12) + 1;
  const monthInYear = ((absoluteMonth - 1) % 12) + 1;
  return `Year ${year}, Month ${monthInYear}`;
}

function formatTokenAmount(value, decimals, maximumFractionDigits = 8) {
  try {
    const numeric = Number(formatUnits(value || 0n, decimals));
    if (!Number.isFinite(numeric)) return "0";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }).format(numeric);
  } catch {
    return "0";
  }
}

function shortenAddress(address = "") {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatEarningsLine(earningsValue) {
  if (!Number.isFinite(earningsValue)) return "-";
  const total = INITIAL_CAPITAL + earningsValue;
  const pct = (earningsValue / INITIAL_CAPITAL) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${formatMoney(INITIAL_CAPITAL)} -> ${formatMoney(total)} (${sign}${formatPercent(
    pct
  )})`;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "-";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString()}`;
  }
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}
