"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Contract, JsonRpcProvider, formatUnits } from "ethers";

const RPC_URL =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "";

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
];

function fmt(v, decimals = 18, fraction = 4) {
  try {
    return Number(formatUnits(v || 0n, decimals)).toLocaleString("en-US", {
      maximumFractionDigits: fraction,
    });
  } catch {
    return "0";
  }
}

function SummaryCard({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/60 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="space-y-2 text-sm text-slate-700">{children}</div>
    </div>
  );
}

export default function TestnetStatusPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [addresses, setAddresses] = useState(ENV_ADDR);

  const ready = useMemo(
    () =>
      RPC_URL &&
      addresses.vault &&
      addresses.strategy &&
      addresses.fluid &&
      addresses.wbtc &&
      addresses.usdc &&
      addresses.weth &&
      addresses.steth &&
      addresses.pool &&
      addresses.oracle,
    [addresses]
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

  async function refresh() {
    setLoading(true);
    setErr("");
    try {
      const provider = new JsonRpcProvider(RPC_URL);
      const [blockNumber, network] = await Promise.all([
        provider.getBlockNumber(),
        provider.getNetwork(),
      ]);

      const [oracleData, tokenData, fluidData, vaultData, strategyData, poolData] =
        await Promise.all([
          fetchOracle(provider),
          fetchTokens(provider),
          fetchFluid(provider),
          fetchVault(provider),
          fetchStrategy(provider),
          fetchPool(provider),
        ]);

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
    } catch (e) {
      console.error(e);
      setErr("Failed to load status. Check RPC URL and addresses.");
    } finally {
      setLoading(false);
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
      const [decimals, totalAssets, totalSupply, sharePrice, strategyBal, uaInVault] =
        await Promise.all([
          vault.decimals(),
          vault.totalAssets(),
          vault.totalSupply(),
          vault.sharePrice(),
          vault.balanceOf(addresses.strategy).catch(() => 0n),
          new Contract(addresses.wbtc, ERC20_ABI, provider).balanceOf(addresses.vault),
        ]);
      return {
        decimals,
        totalAssets,
        totalSupply,
        sharePrice,
        strategyShares: strategyBal,
        uaBalance: uaInVault,
      };
    } catch {
      return null;
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
      ] = await Promise.all([
        strat.totalAssets(),
        strat.totalCollateral(),
        strat.totalBorrowed(),
        strat.totalStakedInFluid(),
        strat.totalDebt(),
        strat.getFluidStakedAmount(),
        new Contract(addresses.weth, ERC20_ABI, provider).balanceOf(addresses.strategy),
        new Contract(addresses.steth, ERC20_ABI, provider).balanceOf(addresses.strategy),
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
      };
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

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Testnet Monitor
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Sepolia Status</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={loading || !ready}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link
            href="/btcetf"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Vault UI →
          </Link>
        </div>
      </div>

      {!RPC_URL && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Set NEXT_PUBLIC_SEPOLIA_RPC_URL (or NEXT_PUBLIC_RPC_URL) to enable on-chain reads.
        </div>
      )}

      {!ready && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Missing addresses. Populate NEXT_PUBLIC_* env vars for vault, strategy, fluid, tokens, pool, and oracle.
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {err}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SummaryCard title="Network">
            <div className="flex justify-between">
              <span>RPC</span>
              <span className="text-slate-900">{RPC_URL ? "Configured" : "Missing"}</span>
            </div>
            <div className="flex justify-between">
              <span>Chain ID</span>
              <span className="font-semibold text-slate-900">{data.chainId}</span>
            </div>
            <div className="flex justify-between">
              <span>Block</span>
              <span className="font-mono text-slate-900">{data.blockNumber}</span>
            </div>
          </SummaryCard>

          <SummaryCard title="Oracle">
            <div className="flex justify-between">
              <span>Base Unit</span>
              <span className="font-mono text-slate-900">{data.oracle?.base?.toString()}</span>
            </div>
            <div className="flex justify-between">
              <span>WBTC price</span>
              <span className="font-mono text-slate-900">{data.oracle ? data.oracle.prices.wbtc.toString() : "-"}</span>
            </div>
            <div className="flex justify-between">
              <span>USDC price</span>
              <span className="font-mono text-slate-900">{data.oracle ? data.oracle.prices.usdc.toString() : "-"}</span>
            </div>
            <div className="flex justify-between">
              <span>WETH price</span>
              <span className="font-mono text-slate-900">{data.oracle ? data.oracle.prices.weth.toString() : "-"}</span>
            </div>
            <div className="flex justify-between">
              <span>stETH price</span>
              <span className="font-mono text-slate-900">{data.oracle ? data.oracle.prices.steth.toString() : "-"}</span>
            </div>
          </SummaryCard>

          <SummaryCard title="Vault (staking)">
            {data.vault ? (
              <>
                <Row label="totalAssets" value={fmt(data.vault.totalAssets, data.tokens?.wbtc?.decimals ?? 8)} />
                <Row label="totalSupply" value={fmt(data.vault.totalSupply, data.tokens?.wbtc?.decimals ?? 8)} />
                <Row label="sharePrice" value={fmt(data.vault.sharePrice, data.vault.decimals ?? 18)} />
                <Row label="UA in vault" value={fmt(data.vault.uaBalance, data.tokens?.wbtc?.decimals ?? 8)} />
              </>
            ) : (
              <span className="text-slate-500">Unavailable</span>
            )}
          </SummaryCard>

          <SummaryCard title="Strategy">
            {data.strategy ? (
              <>
                <Row label="totalAssets" value={fmt(data.strategy.totalAssets, data.tokens?.wbtc?.decimals ?? 8)} />
                <Row label="collateral" value={fmt(data.strategy.totalCollateral, data.tokens?.wbtc?.decimals ?? 8)} />
                <Row label="borrowed (WETH)" value={fmt(data.strategy.totalBorrowed, data.tokens?.weth?.decimals ?? 18)} />
                <Row label="staked in Fluid (shares)" value={fmt(data.strategy.totalStakedInFluid, data.fluid?.decimals ?? 18)} />
                <Row label="totalDebt (base)" value={fmt(data.strategy.totalDebt, 8)} />
                <Row label="WETH balance" value={fmt(data.strategy.wethBal, data.tokens?.weth?.decimals ?? 18)} />
                <Row label="stETH balance" value={fmt(data.strategy.stethBal, data.tokens?.steth?.decimals ?? 18)} />
              </>
            ) : (
              <span className="text-slate-500">Unavailable</span>
            )}
          </SummaryCard>

          <SummaryCard title="Fluid Vault (mock)">
            {data.fluid ? (
              <>
                <Row label="totalAssets" value={fmt(data.fluid.totalAssets, data.tokens?.steth?.decimals ?? 18)} />
                <Row label="strategy shares" value={fmt(data.fluid.strategyShares, data.fluid.decimals)} />
                <Row
                  label="1 share → assets"
                  value={fmt(data.fluid.shareToAsset, data.tokens?.steth?.decimals ?? 18)}
                />
              </>
            ) : (
              <span className="text-slate-500">Unavailable</span>
            )}
          </SummaryCard>

          <SummaryCard title="Aave Pool (mock)">
            {data.pool ? (
              <>
                <Row label="supplied (UA)" value={fmt(data.pool.supplied, data.tokens?.wbtc?.decimals ?? 8)} />
                <Row label="borrowed (WETH)" value={fmt(data.pool.borrowed, data.tokens?.weth?.decimals ?? 18)} />
                <Row label="LTV (bps)" value={data.pool.ltv?.toString() ?? "-"} />
                <Row label="health factor" value={fmt(data.pool.health, 18, 4)} />
              </>
            ) : (
              <span className="text-slate-500">Unavailable</span>
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
              <span className="text-slate-500">Unavailable</span>
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
      <span className="text-slate-600">{label}</span>
      <span className="font-mono text-slate-900">{value}</span>
    </div>
  );
}

function TokenRow({ label, t }) {
  if (!t) {
    return (
      <div className="flex justify-between">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-500">-</span>
      </div>
    );
  }
  return (
    <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
      <div className="flex justify-between">
        <span className="font-semibold text-slate-800">{label}</span>
        <span className="text-xs text-slate-600">{t.symbol}</span>
      </div>
      <Row label="totalSupply" value={fmt(t.totalSupply, t.decimals)} />
      <Row label="vault balance" value={fmt(t.vaultBalance, t.decimals)} />
      <Row label="strategy balance" value={fmt(t.strategyBalance, t.decimals)} />
    </div>
  );
}
