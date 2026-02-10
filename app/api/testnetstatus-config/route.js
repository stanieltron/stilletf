import { NextResponse } from "next/server";

function getAddressesFromEnv() {
  return {
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
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const chainId =
    searchParams.get("chainId") || process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";

  return NextResponse.json({
    chainId,
    addresses: getAddressesFromEnv(),
  });
}
