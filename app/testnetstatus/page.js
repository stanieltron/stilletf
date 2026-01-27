"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";

const ENV_ADDR = {
  vault: process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS || "",
  strategy: process.env.NEXT_PUBLIC_YIELD_STRATEGY_ADDRESS || "",
  fluid: process.env.NEXT_PUBLIC_FLUID_VAULT_ADDRESS || "",
  wbtc: process.env.NEXT_PUBLIC_WBTC_ADDRESS || "",
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS || "",
  weth: process.env.NEXT_PUBLIC_WETH_ADDRESS || "",
  steth: process.env.NEXT_PUBLIC_STETH_ADDRESS || "",
  pool: process.env.NEXT_PUBLIC_AAVE_POOL_ADDRESS || "",
  oracle: process.env.NEXT_PUBLIC_AAVE_ORACLE_ADDRESS || "",
  router: process.env.NEXT_PUBLIC_UNISWAP_ROUTER_ADDRESS || "",
};
const DEFAULT_CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";

function normalizeAddresses(src = {}) {
  return {
    vault: src.vault,
    strategy: src.strategy,
    fluid: src.fluid,
    wbtc: src.wbtc,
    usdc: src.usdc,
    weth: src.weth,
    steth: src.steth || src.stEth,
    pool: src.pool,
    oracle: src.oracle,
    router: src.router,
  };
}

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const ORACLE_ABI = [
  "function getAssetPrice(address) view returns (uint256)",
  "function BASE_CURRENCY_UNIT() view returns (uint256)",
];

const POOL_ABI = [
  "function getUserAccountData(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
  "function supplied() view returns (uint256)",
  "function borrowed() view returns (uint256)",
];

const FLUID_ABI = [
  "function totalAssets() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function convertToShares(uint256) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function donateYieldWithETH() payable",
];

const VAULT_ABI = [
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function sharePrice() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

const STRATEGY_ABI = [
  "function totalAssets() view returns (uint256)",
  "function totalCollateral() view returns (uint256)",
  "function totalBorrowed() view returns (uint256)",
  "function totalStakedInFluid() view returns (uint256)",
  "function totalDebt() view returns (uint256)",
  "function getFluidStakedAmount() view returns (uint256)",
  "function harvestYield() returns (uint256)",
  "function vault() view returns (address)",
];

function fmt(v, decimals = 18) {
  try {
    // Use formatUnits directly to avoid rounding for display; show exact token amount.
    return formatUnits(v || 0n, decimals);
  } catch {
    return "0";
  }
}

function baseToUa(baseAmount, price, uaDecimals, baseUnit) {
  try {
    if (!baseAmount || !price || !baseUnit) return null;
    return (baseAmount * 10n ** BigInt(uaDecimals)) / price;
  } catch {
    return null;
  }
}

function SummaryCard({ title, children }) {
  return (
    <div className="sona-card backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--muted)]">
          {title}
        </h3>
        <div className="h-1 w-12 rounded-full bg-[var(--accent)]" aria-hidden />
      </div>
      <div className="space-y-2 text-sm text-[var(--text)]">{children}</div>
    </div>
  );
}

export default function TestnetStatusPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [diagnostics, setDiagnostics] = useState({});
  const [addresses, setAddresses] = useState(ENV_ADDR);
  const [walletAddress, setWalletAddress] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [donationEth, setDonationEth] = useState("");
  const [txMessage, setTxMessage] = useState("");
  const [donating, setDonating] = useState(false);
  const [harvestLoading, setHarvestLoading] = useState(false);
  const [harvestEstimate, setHarvestEstimate] = useState(null);

  const ready = useMemo(
    () =>
      provider &&
      addresses.vault &&
      addresses.strategy &&
      addresses.fluid &&
      addresses.wbtc &&
      addresses.usdc &&
      addresses.weth &&
      addresses.steth &&
      addresses.pool &&
      addresses.oracle,
    [addresses, provider]
  );

  useEffect(() => {
    // Try loading cached deployment addresses; fall back to env on failure.
    const loadConfig = async () => {
      try {
        const res = await fetch(
          `/api/testnetstatus-config?chainId=${DEFAULT_CHAIN_ID}`
        );
        if (res.ok) {
          const json = await res.json();
          // Merge to preserve any env overrides (router etc.)
          setAddresses((prev) => ({
            ...prev,
            ...normalizeAddresses(json.addresses),
          }));
        }
      } catch (e) {
        console.error("config fetch failed", e);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (!ready) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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
        setSigner(null);
        return;
      }
      initializeWallet(accounts[0]);
    };
    eth.on("accountsChanged", onAccountsChanged);
    return () => {
      eth.removeListener("accountsChanged", onAccountsChanged);
    };
  }, []);

  async function refresh() {
    setLoading(true);
    setErr("");
    const diag = {
      rpc: null,
      chainId: null,
      chainMismatch: false,
      addresses: {},
      fetch: {},
      code: {},
    };
    try {
      if (!provider) throw new Error("No provider");
      const [blockNumber, network] = await Promise.all([
        provider.getBlockNumber().then((bn) => {
          diag.rpc = "ok";
          return bn;
        }),
        provider.getNetwork().then((nw) => {
          diag.chainId = nw.chainId?.toString();
          if (DEFAULT_CHAIN_ID && diag.chainId && diag.chainId !== DEFAULT_CHAIN_ID) {
            diag.chainMismatch = true;
          }
          return nw;
        }),
      ]);

      // address sanity
      Object.entries(addresses).forEach(([key, val]) => {
        if (!val || val === "0x0000000000000000000000000000000000000000") {
          diag.addresses[key] = "missing";
        }
      });

      // code presence for key addresses
      const codeTargets = [
        "vault",
        "strategy",
        "fluid",
        "pool",
        "oracle",
        "router",
        "wbtc",
        "usdc",
        "weth",
        "steth",
      ];
      await Promise.all(
        codeTargets.map(async (key) => {
          const addr = addresses[key];
          if (!addr) return;
          try {
            const code = await provider.getCode(addr);
            diag.code[key] = code && code !== "0x" ? "ok" : "missing";
          } catch (e) {
            diag.code[key] = e?.message || "code check failed";
          }
        })
      );

      const [
        oracleRes,
        tokensRes,
        fluidRes,
        vaultRes,
        strategyRes,
        poolRes,
        harvestRes,
      ] = await Promise.allSettled([
        fetchOracle(provider),
        fetchTokens(provider),
        fetchFluid(provider),
        fetchVault(provider),
        fetchStrategy(provider),
        fetchPool(provider),
        estimateHarvest(provider),
      ]);

      const oracleData = oracleRes.status === "fulfilled" ? oracleRes.value : null;
      const tokenData = tokensRes.status === "fulfilled" ? tokensRes.value : null;
      const fluidData = fluidRes.status === "fulfilled" ? fluidRes.value : null;
      const vaultData = vaultRes.status === "fulfilled" ? vaultRes.value : null;
      const strategyData = strategyRes.status === "fulfilled" ? strategyRes.value : null;
      const poolData = poolRes.status === "fulfilled" ? poolRes.value : null;
      const harvestEst = harvestRes.status === "fulfilled" ? harvestRes.value : null;

      if (oracleRes.status === "rejected") diag.fetch.oracle = oracleRes.reason?.message || "oracle fetch failed";
      if (tokensRes.status === "rejected") diag.fetch.tokens = tokensRes.reason?.message || "token fetch failed";
      if (fluidRes.status === "rejected") diag.fetch.fluid = fluidRes.reason?.message || "fluid fetch failed";
      if (vaultRes.status === "rejected") diag.fetch.vault = vaultRes.reason?.message || "vault fetch failed";
      if (strategyRes.status === "rejected") diag.fetch.strategy = strategyRes.reason?.message || "strategy fetch failed";
      if (poolRes.status === "rejected") diag.fetch.pool = poolRes.reason?.message || "pool fetch failed";
      if (harvestRes.status === "rejected") diag.fetch.harvest = harvestRes.reason?.message || "harvest est failed";

      if (strategyRes.status === "rejected") {
        diag.probes = diag.probes || {};
        diag.probes.strategy = await debugStrategyDeps(provider);
      }
      if (vaultRes.status === "rejected") {
        diag.probes = diag.probes || {};
        diag.probes.vault = await debugVaultDeps(provider);
      }

      setData({
        blockNumber,
        chainId: network.chainId?.toString(),
        oracle: oracleData,
        tokens: tokenData,
        fluid: fluidData,
        vault: vaultData,
        strategy: strategyData,
        pool: poolData,
      });
      setHarvestEstimate(harvestEst);
    } catch (e) {
      console.error(e);
      const parts = [];
      if (diag.chainMismatch) parts.push(`Chain mismatch: expected ${DEFAULT_CHAIN_ID}, got ${diag.chainId || "unknown"}`);
      if (Object.keys(diag.fetch || {}).length) parts.push("Fetch errors: " + Object.entries(diag.fetch).map(([k, v]) => `${k}: ${v}`).join("; "));
      if (!parts.length) parts.push(e?.message || "Failed to load status. Connect wallet and check addresses.");
      setErr(parts.join(" | "));
    } finally {
      setDiagnostics(diag);
      setLoading(false);
    }
  }

  async function initializeWallet(address) {
    if (!window.ethereum) {
      setErr("MetaMask not detected.");
      return;
    }
    try {
      setErr("");
      const nextProvider = new BrowserProvider(window.ethereum);
      const nextSigner = await nextProvider.getSigner();
      setProvider(nextProvider);
      setSigner(nextSigner);
      setWalletAddress(address);
    } catch (e) {
      console.error(e);
      setErr("Failed to initialize wallet.");
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

  async function fetchOracle(provider) {
    const oracle = new Contract(addresses.oracle, ORACLE_ABI, provider);
    const base = await oracle.BASE_CURRENCY_UNIT();
    const prices = await Promise.all(
      [addresses.wbtc, addresses.usdc, addresses.weth, addresses.steth].map((a) =>
        oracle.getAssetPrice(a).catch(() => 0n)
      )
    );
    return {
      base,
      prices: {
        wbtc: prices[0],
        usdc: prices[1],
        weth: prices[2],
        steth: prices[3],
      },
    };
  }

  async function fetchTokens(provider) {
    const addrs = [addresses.wbtc, addresses.usdc, addresses.weth, addresses.steth];
    const labels = ["wbtc", "usdc", "weth", "steth"];
    const results = {};
    for (let i = 0; i < addrs.length; i++) {
      const c = new Contract(addrs[i], ERC20_ABI, provider);
      try {
        const [name, symbol, decimals, totalSupply, vaultBal, stratBal] =
          await Promise.all([
            c.name(),
            c.symbol(),
            c.decimals(),
            c.totalSupply(),
            c.balanceOf(addresses.vault),
            c.balanceOf(addresses.strategy),
          ]);
        results[labels[i]] = {
          name,
          symbol,
          decimals,
          totalSupply,
          vaultBalance: vaultBal,
          strategyBalance: stratBal,
        };
      } catch {
        results[labels[i]] = null;
      }
    }
    return results;
  }

  async function fetchFluid(provider) {
    const fluid = new Contract(addresses.fluid, FLUID_ABI, provider);
    try {
      const [decimals, totalAssets, strategyShares] = await Promise.all([
        fluid.decimals(),
        fluid.totalAssets(),
        fluid.balanceOf(addresses.strategy),
      ]);
      const shareToAsset = await fluid.convertToAssets(10n ** BigInt(decimals));
      return { decimals, totalAssets, strategyShares, shareToAsset };
    } catch {
      return null;
    }
  }

  async function fetchVault(provider) {
    const vault = new Contract(addresses.vault, VAULT_ABI, provider);
    try {
      const [decimals, totalAssets, totalSupply, sharePrice, strategyBal, uaInVault, usdcInVault] =
        await Promise.all([
          vault.decimals(),
          vault.totalAssets(),
          vault.totalSupply(),
          vault.sharePrice(),
          vault.balanceOf(addresses.strategy).catch(() => 0n),
          new Contract(addresses.wbtc, ERC20_ABI, provider).balanceOf(addresses.vault),
          new Contract(addresses.usdc, ERC20_ABI, provider).balanceOf(addresses.vault).catch(() => 0n),
        ]);
      return {
        decimals,
        totalAssets,
        totalSupply,
        sharePrice,
        strategyShares: strategyBal,
        uaBalance: uaInVault,
        usdcBalance: usdcInVault,
      };
    } catch (e) {
      console.warn("vault fetch failed", e);
      throw e;
    }
  }

  async function fetchStrategy(provider) {
    const strat = new Contract(addresses.strategy, STRATEGY_ABI, provider);
    try {
      const [
        totalAssets,
        totalCollateral,
        totalBorrowed,
        totalStakedInFluid,
        totalDebt,
        fluidShares,
        wethBal,
        stethBal,
        usdcBal,
      ] = await Promise.all([
        strat.totalAssets(),
        strat.totalCollateral(),
        strat.totalBorrowed(),
        strat.totalStakedInFluid(),
        strat.totalDebt(),
        strat.getFluidStakedAmount(),
        new Contract(addresses.weth, ERC20_ABI, provider).balanceOf(addresses.strategy),
        new Contract(addresses.steth, ERC20_ABI, provider).balanceOf(addresses.strategy),
        new Contract(addresses.usdc, ERC20_ABI, provider).balanceOf(addresses.strategy),
      ]);
      return {
        totalAssets,
        totalCollateral,
        totalBorrowed,
        totalStakedInFluid,
        totalDebt,
        fluidShares,
        wethBal,
        stethBal,
        usdcBal,
      };
    } catch (e) {
      console.warn("strategy fetch failed", e);
      throw e;
    }
  }

  async function debugStrategyDeps(provider) {
    const out = {};
    try {
      const pool = new Contract(addresses.pool, POOL_ABI, provider);
      await pool.getUserAccountData(addresses.strategy);
      out.pool_getUserAccountData = "ok";
    } catch (e) {
      out.pool_getUserAccountData = e?.message || "revert";
    }
    try {
      const oracle = new Contract(addresses.oracle, ORACLE_ABI, provider);
      await oracle.getAssetPrice(addresses.wbtc);
      out.oracle_wbtc = "ok";
    } catch (e) {
      out.oracle_wbtc = e?.message || "revert";
    }
    try {
      const oracle = new Contract(addresses.oracle, ORACLE_ABI, provider);
      await oracle.getAssetPrice(addresses.steth);
      out.oracle_steth = "ok";
    } catch (e) {
      out.oracle_steth = e?.message || "revert";
    }
    try {
      const fluid = new Contract(addresses.fluid, FLUID_ABI, provider);
      await fluid.convertToAssets(10n ** 18n);
      out.fluid_convertToAssets = "ok";
    } catch (e) {
      out.fluid_convertToAssets = e?.message || "revert";
    }
    return out;
  }

  async function debugVaultDeps(provider) {
    const out = {};
    try {
      const vault = new Contract(addresses.vault, VAULT_ABI, provider);
      await vault.totalSupply();
      out.vault_totalSupply = "ok";
    } catch (e) {
      out.vault_totalSupply = e?.message || "revert";
    }
    try {
      const vault = new Contract(addresses.vault, VAULT_ABI, provider);
      await vault.totalAssets();
      out.vault_totalAssets = "ok";
    } catch (e) {
      out.vault_totalAssets = e?.message || "revert";
    }
    return out;
  }

  async function estimateHarvest(provider) {
    if (!provider) return null;
    const strat = new Contract(addresses.strategy, STRATEGY_ABI, provider);
    try {
      // Static call to harvestYield to get the return value without state changes
      const estimate = await strat.harvestYield.staticCall();
      return estimate;
    } catch {
      return null;
    }
  }

  async function fetchPool(provider) {
    const pool = new Contract(addresses.pool, POOL_ABI, provider);
    try {
      const [accountData, supplied, borrowed] = await Promise.all([
        pool.getUserAccountData(addresses.strategy),
        pool.supplied(),
        pool.borrowed(),
      ]);
      return {
        supplied,
        borrowed,
        ltv: accountData[4],
        health: accountData[5],
        collateralBase: accountData[0],
        debtBase: accountData[1],
      };
    } catch {
      return null;
    }
  }

  async function donateYieldWithEth() {
    if (!signer || !walletAddress) {
      setErr("Connect your wallet to donate yield.");
      return;
    }
    if (!addresses.fluid) {
      setErr("Fluid vault address is not configured.");
      return;
    }
    if (!donationEth || Number(donationEth) <= 0) {
      setErr("Enter an ETH amount greater than zero.");
      return;
    }
    try {
      setDonating(true);
      setErr("");
      setTxMessage("Sending ETH donation...");
      const network = await signer.provider.getNetwork();
      if (network.chainId?.toString() !== DEFAULT_CHAIN_ID) {
        throw new Error(`Switch to chain ${DEFAULT_CHAIN_ID} to donate.`);
      }
      const fluid = new Contract(addresses.fluid, FLUID_ABI, signer);
      const tx = await fluid.donateYieldWithETH({
        value: parseUnits(donationEth, 18),
      });
      await tx.wait();
      setTxMessage("Donation confirmed. Refreshing balances...");
      setDonationEth("");
      await refresh();
      setTxMessage("Donation confirmed on-chain.");
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Donation failed.");
    } finally {
      setDonating(false);
    }
  }

  async function triggerHarvest() {
    if (!signer || !walletAddress) {
      setErr("Connect your wallet to harvest.");
      return;
    }
    if (!addresses.strategy) {
      setErr("Strategy address is not configured.");
      return;
    }
    try {
      setHarvestLoading(true);
      setErr("");
      setTxMessage("Harvesting yield...");
      const network = await signer.provider.getNetwork();
      if (network.chainId?.toString() !== DEFAULT_CHAIN_ID) {
        throw new Error(`Switch to chain ${DEFAULT_CHAIN_ID} to harvest.`);
      }
      const strat = new Contract(addresses.strategy, STRATEGY_ABI, signer);
      const tx = await strat.harvestYield();
      await tx.wait();
      setTxMessage("Harvest complete.");
      await refresh();
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Harvest failed.");
    } finally {
      setHarvestLoading(false);
      setTxMessage("");
    }
  }

  return (
    <main className="sona-container max-w-6xl flex min-h-screen flex-col gap-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="sona-chip w-fit">Testnet Monitor</div>
          <h1 className="text-3xl font-extrabold tracking-tight">Sepolia Status</h1>
          <p className="text-body max-w-xl">
            Live telemetry for the BTC vault, strategy, and oracle stack. Connect a wallet to pull chain data.
          </p>
          <div className="sona-divider w-full max-w-lg" aria-hidden />
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-end">
          <div
            className={`sona-pill ${diagnostics.chainMismatch ? "" : "sona-pill-gold"}`}
            title={
              diagnostics.chainMismatch
                ? `Switch to chain ${DEFAULT_CHAIN_ID}`
                : walletAddress
                ? "Wallet connected on expected chain"
                : "Wallet not connected"
            }
          >
            {diagnostics.chainMismatch
              ? `Wrong chain · need ${DEFAULT_CHAIN_ID}`
              : walletAddress
              ? "Connected"
              : "Wallet missing"}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={connectWallet}
              className="sona-btn sona-btn-ghost disabled:opacity-60"
            >
              {walletAddress
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : "Connect Wallet"}
            </button>
            <button
              onClick={refresh}
              disabled={loading || !walletAddress}
              className="sona-btn sona-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <Link
            href="/btcetf"
            className="sona-btn sona-btn-outline whitespace-nowrap"
          >
            View BTC vault →
          </Link>
        </div>
      </div>

      {!walletAddress && (
        <div className="sona-card border border-[rgba(202,163,74,0.35)] bg-[rgba(202,163,74,0.08)] px-4 py-3 text-sm text-[var(--text)]">
          Connect a wallet on Sepolia to fetch status.
        </div>
      )}

      {err && (
        <div className="sona-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {err}
        </div>
      )}
      {diagnostics && Object.keys(diagnostics).length > 0 && (
        <div className="sona-card px-4 py-3 text-sm text-[var(--text)] space-y-2">
          <div className="font-semibold text-[var(--text)]">Diagnostics</div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">RPC</span>
            <span className="font-mono text-[var(--text)]">{diagnostics.rpc || "not reached"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Chain</span>
            <span className="font-mono text-[var(--text)]">
              {diagnostics.chainId || "unknown"}
              {diagnostics.chainMismatch ? ` (expected ${DEFAULT_CHAIN_ID})` : ""}
            </span>
          </div>
          {diagnostics.addresses && Object.keys(diagnostics.addresses).length > 0 && (
            <div>
              <div className="font-semibold text-[var(--text)]">Address issues</div>
              <ul className="list-disc pl-4">
                {Object.entries(diagnostics.addresses).map(([k, v]) => (
                  <li key={k} className="font-mono text-rose-700">
                    {k}: {v}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diagnostics.fetch && Object.keys(diagnostics.fetch).length > 0 && (
            <div>
              <div className="font-semibold text-[var(--text)]">Fetch errors</div>
              <ul className="list-disc pl-4">
                {Object.entries(diagnostics.fetch).map(([k, v]) => (
                  <li key={k} className="font-mono text-rose-700">
                    {k}: {v}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diagnostics.code && Object.keys(diagnostics.code).length > 0 && (
            <div>
              <div className="font-semibold text-[var(--text)]">Contract code</div>
              <ul className="list-disc pl-4">
                {Object.entries(diagnostics.code).map(([k, v]) => (
                  <li key={k} className="font-mono">
                    {k}: {v}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diagnostics.probes && Object.keys(diagnostics.probes).length > 0 && (
            <div>
              <div className="font-semibold text-[var(--text)]">Probe calls</div>
              {Object.entries(diagnostics.probes).map(([section, results]) => (
                <div key={section} className="mt-2">
                  <div className="font-semibold text-[var(--text)]">{section}</div>
                  <ul className="list-disc pl-4">
                    {Object.entries(results || {}).map(([k, v]) => (
                      <li key={k} className="font-mono">
                        {k}: {v}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {txMessage && (
        <div className="sona-card px-4 py-3 text-sm text-[var(--text)]">
          {txMessage}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SummaryCard title="Network">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Wallet</span>
              <span className="text-[var(--text)] font-semibold">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Chain ID</span>
              <span className="font-semibold text-[var(--text)]">{data.chainId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Block</span>
              <span className="font-mono text-[var(--text)]">{data.blockNumber}</span>
            </div>
          </SummaryCard>

          <SummaryCard title="Oracle">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Base Unit</span>
              <span className="font-mono text-[var(--text)]">{data.oracle?.base?.toString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">WBTC price</span>
              <span className="font-mono text-[var(--text)]">{data.oracle ? data.oracle.prices.wbtc.toString() : "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">USDC price</span>
              <span className="font-mono text-[var(--text)]">{data.oracle ? data.oracle.prices.usdc.toString() : "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">WETH price</span>
              <span className="font-mono text-[var(--text)]">{data.oracle ? data.oracle.prices.weth.toString() : "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">stETH price</span>
              <span className="font-mono text-[var(--text)]">{data.oracle ? data.oracle.prices.steth.toString() : "-"}</span>
            </div>
          </SummaryCard>

          <SummaryCard title="Vault (staking)">
            {data.vault ? (
              <>
                <Row label="totalAssets (WBTC)" value={fmt(data.vault.totalAssets, data.tokens?.wbtc?.decimals ?? 8)} />
                <Row label="totalSupply (WBTC shares)" value={fmt(data.vault.totalSupply, data.tokens?.wbtc?.decimals ?? 8)} />
                <Row label="sharePrice (WBTC)" value={fmt(data.vault.sharePrice, data.vault.decimals ?? 18)} />
                <Row label="UA in vault (WBTC)" value={fmt(data.vault.uaBalance, data.tokens?.wbtc?.decimals ?? 8)} />
                <Row label="USDC balance" value={fmt(data.vault.usdcBalance, data.tokens?.usdc?.decimals ?? 6)} />
              </>
            ) : (
              <span className="text-[var(--muted)]">Unavailable</span>
            )}
          </SummaryCard>

          <SummaryCard title="Strategy">
            {data.strategy ? (
              <>
                <Row label="totalAssets (WBTC)" value={fmt(data.strategy.totalAssets, data.tokens?.wbtc?.decimals ?? 8)} />
                <Row label="collateral (WBTC)" value={fmt(data.strategy.totalCollateral, data.tokens?.wbtc?.decimals ?? 8)} />
                <Row label="borrowed (WETH)" value={fmt(data.strategy.totalBorrowed, data.tokens?.weth?.decimals ?? 18)} />
                <Row label="staked in Fluid (shares)" value={fmt(data.strategy.totalStakedInFluid, data.fluid?.decimals ?? 18)} />
                <Row
                  label="totalDebt (WBTC)"
                  value={
                    baseToUa(
                      data.strategy.totalDebt,
                      data.oracle?.prices?.wbtc,
                      data.tokens?.wbtc?.decimals ?? 8,
                      data.oracle?.base
                    )
                      ? fmt(
                          baseToUa(
                            data.strategy.totalDebt,
                            data.oracle?.prices?.wbtc,
                            data.tokens?.wbtc?.decimals ?? 8,
                            data.oracle?.base
                          ),
                          data.tokens?.wbtc?.decimals ?? 8
                        )
                      : "-"
                  }
                />
                <Row label="WETH balance" value={fmt(data.strategy.wethBal, data.tokens?.weth?.decimals ?? 18)} />
                <Row label="stETH balance" value={fmt(data.strategy.stethBal, data.tokens?.steth?.decimals ?? 18)} />
                <Row label="USDC balance" value={fmt(data.strategy.usdcBal, data.tokens?.usdc?.decimals ?? 6)} />
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[rgba(17,19,24,0.08)] bg-[rgba(255,255,255,0.9)] p-3">
                  <div className="text-xs text-[var(--muted)]">
                    <div className="font-semibold text-[var(--text)]">Harvest yield</div>
                    <div>
                      Est. harvestable:{" "}
                      {harvestEstimate != null
                        ? `${fmt(harvestEstimate, data.tokens?.usdc?.decimals ?? 6, 6)} USDC`
                        : "–"}
                    </div>
                  </div>
                  <button
                    onClick={triggerHarvest}
                    disabled={!walletAddress || harvestLoading}
                    className="sona-btn sona-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {harvestLoading ? "Harvesting..." : "Harvest"}
                  </button>
                </div>
              </>
            ) : (
              <span className="text-[var(--muted)]">Unavailable</span>
            )}
          </SummaryCard>

          <SummaryCard title="Fluid Vault (mock)">
            {data.fluid ? (
              <>
                <Row label="totalAssets (stETH)" value={fmt(data.fluid.totalAssets, data.tokens?.steth?.decimals ?? 18)} />
                <Row label="strategy shares (mFLUID)" value={fmt(data.fluid.strategyShares, data.fluid.decimals)} />
                <Row
                  label="1 share → assets"
                  value={fmt(data.fluid.shareToAsset, data.tokens?.steth?.decimals ?? 18)}
                />
                <div className="mt-4 space-y-2 rounded-lg border border-[rgba(17,19,24,0.08)] bg-[rgba(255,255,255,0.9)] p-3">
                  <p className="text-xs font-semibold text-[var(--text)]">Donate yield with ETH</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={donationEth}
                      disabled={donating}
                      onChange={(e) => setDonationEth(e.target.value)}
                      placeholder="0.1"
                      className="w-full rounded-lg border border-[rgba(17,19,24,0.12)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      onClick={donateYieldWithEth}
                      disabled={!walletAddress || donating}
                      className="whitespace-nowrap sona-btn sona-btn-ghost disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {donating ? "Donating..." : "Donate"}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    Sends ETH via donateYieldWithETH; boosts vault assets without minting new shares.
                  </p>
                </div>
              </>
            ) : (
              <span className="text-[var(--muted)]">Unavailable</span>
            )}
          </SummaryCard>

          <SummaryCard title="Aave Pool (mock)">
            {data.pool ? (
              <>
                <Row label="supplied (WBTC)" value={fmt(data.pool.supplied, data.tokens?.wbtc?.decimals ?? 8)} />
                <Row label="borrowed (WETH)" value={fmt(data.pool.borrowed, data.tokens?.weth?.decimals ?? 18)} />
                <Row label="LTV (bps)" value={data.pool.ltv?.toString() ?? "-"} />
                <Row label="health factor" value={fmt(data.pool.health, 18, 4)} />
              </>
            ) : (
              <span className="text-[var(--muted)]">Unavailable</span>
            )}
          </SummaryCard>

          <SummaryCard title="Token balances">
            {data.tokens ? (
              <>
                <TokenRow label="WBTC" t={data.tokens.wbtc} />
                <TokenRow label="USDC" t={data.tokens.usdc} />
                <TokenRow label="WETH" t={data.tokens.weth} />
                <TokenRow label="stETH" t={data.tokens.steth} />
              </>
            ) : (
              <span className="text-[var(--muted)]">Unavailable</span>
            )}
          </SummaryCard>
        </div>
      )}
    </main>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-mono text-[var(--text)]">{value}</span>
    </div>
  );
}

function TokenRow({ label, t }) {
  if (!t) {
    return (
      <div className="flex justify-between">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="text-[var(--muted)]">-</span>
      </div>
    );
  }
  return (
    <div className="space-y-1 rounded-lg border border-[rgba(17,19,24,0.08)] bg-[rgba(255,255,255,0.9)] p-3">
      <div className="flex justify-between">
        <span className="font-semibold text-[var(--text)]">{label}</span>
        <span className="text-xs text-[var(--muted)]">{t.symbol}</span>
      </div>
      <Row label="totalSupply" value={fmt(t.totalSupply, t.decimals)} />
      <Row label="vault balance" value={fmt(t.vaultBalance, t.decimals)} />
      <Row label="strategy balance" value={fmt(t.strategyBalance, t.decimals)} />
    </div>
  );
}
