import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";

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

const WSTETH_ABI = ["function stEthPerToken() view returns (uint256)"];

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

function normalizeAddresses(src = {}) {
  return {
    vault: src.vault,
    strategy: src.strategy,
    fluid: src.fluid,
    wbtc: src.wbtc,
    usdc: src.usdc,
    weth: src.weth,
    steth: src.steth || src.stEth,
    wsteth: src.wsteth || src.wstEth,
    pool: src.pool,
    oracle: src.oracle,
    router: src.router,
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const chainId =
    searchParams.get("chainId") || process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";

  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL;

  if (!rpcUrl) {
    return NextResponse.json(
      { error: "RPC URL missing" },
      { status: 500 }
    );
  }

  const addresses = normalizeAddresses({
    vault: process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS || "",
    strategy: process.env.NEXT_PUBLIC_YIELD_STRATEGY_ADDRESS || "",
    fluid: process.env.NEXT_PUBLIC_FLUID_VAULT_ADDRESS || "",
    wbtc: process.env.NEXT_PUBLIC_WBTC_ADDRESS || "",
    usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS || "",
    weth: process.env.NEXT_PUBLIC_WETH_ADDRESS || "",
    steth: process.env.NEXT_PUBLIC_STETH_ADDRESS || "",
    wsteth: process.env.NEXT_PUBLIC_WSTETH_ADDRESS || "",
    pool: process.env.NEXT_PUBLIC_AAVE_POOL_ADDRESS || "",
    oracle: process.env.NEXT_PUBLIC_AAVE_ORACLE_ADDRESS || "",
    router: process.env.NEXT_PUBLIC_UNISWAP_ROUTER_ADDRESS || "",
  });

  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const [blockNumber, network] = await Promise.all([
      provider.getBlockNumber(),
      provider.getNetwork(),
    ]);

    const [oracleData, tokenData, fluidData, vaultData, strategyData, poolData] =
      await Promise.all([
        fetchOracle(provider, addresses),
        fetchTokens(provider, addresses),
        fetchFluid(provider, addresses),
        fetchVault(provider, addresses),
        fetchStrategy(provider, addresses),
        fetchPool(provider, addresses),
      ]);

    return NextResponse.json({
      addresses,
      data: {
        blockNumber,
        chainId: network.chainId?.toString(),
        oracle: oracleData,
        tokens: tokenData,
        fluid: fluidData,
        vault: vaultData,
        strategy: strategyData,
        pool: poolData,
      },
    });
  } catch (e) {
    console.error("status-read failed", e);
    return NextResponse.json({ error: "Failed to read status", addresses }, { status: 500 });
  }
}

async function fetchOracle(provider, addresses) {
  const oracle = new Contract(addresses.oracle, ORACLE_ABI, provider);
  const base = await oracle.BASE_CURRENCY_UNIT();
  const [wbtc, usdc, weth] = await Promise.all([
    oracle.getAssetPrice(addresses.wbtc).catch(() => 0n),
    oracle.getAssetPrice(addresses.usdc).catch(() => 0n),
    oracle.getAssetPrice(addresses.weth).catch(() => 0n),
  ]);
  let steth = await oracle.getAssetPrice(addresses.steth).catch(() => 0n);
  if (steth === 0n && addresses.wsteth) {
    const wstethPrice = await oracle.getAssetPrice(addresses.wsteth).catch(() => 0n);
    if (wstethPrice > 0n) {
      try {
        const wst = new Contract(addresses.wsteth, WSTETH_ABI, provider);
        const rate = await wst.stEthPerToken();
        if (rate > 0n) {
          steth = (wstethPrice * 10n ** 18n) / rate;
        }
      } catch {}
    }
  }
  return {
    base,
    prices: { wbtc, usdc, weth, steth },
  };
}

async function fetchTokens(provider, addresses) {
  const addrs = [addresses.wbtc, addresses.usdc, addresses.weth, addresses.steth];
  const labels = ["wbtc", "usdc", "weth", "steth"];
  const results = {};
  for (let i = 0; i < addrs.length; i++) {
    const c = new Contract(addrs[i], ERC20_ABI, provider);
    try {
      const [name, symbol, decimals, totalSupply, vaultBal, stratBal] = await Promise.all([
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

async function fetchFluid(provider, addresses) {
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

async function fetchVault(provider, addresses) {
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

async function fetchStrategy(provider, addresses) {
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

async function fetchPool(provider, addresses) {
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
