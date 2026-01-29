import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const chainId = searchParams.get("chainId") || process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";
  const basePath = path.join(process.cwd(), "cache", "deployments");
  const filePathJson = path.join(basePath, `${chainId}.json`);
  const broadcastPath = path.join(
    process.cwd(),
    "broadcast",
    "DeployStakingVault.s.sol",
    `${chainId}`,
    "run-latest.json"
  );

  try {
    const addresses = {};

    // Primary source: cache/deployments/<chainId>.json (written by the script)
    try {
      const rawJson = fs.readFileSync(filePathJson, "utf8");
      Object.assign(addresses, JSON.parse(rawJson));
    } catch (err) {
      console.warn("deployments cache read failed, will try broadcast", err);
    }

    // Fallback: pull addresses from the latest broadcast run if cache missing keys
    if (!addresses.vault || !addresses.strategy) {
      try {
        const rawBroadcast = fs.readFileSync(broadcastPath, "utf8");
        const parsedBroadcast = JSON.parse(rawBroadcast);
        const extracted = extractAddressesFromBroadcast(parsedBroadcast?.transactions || []);
        Object.assign(addresses, extracted);
      } catch (e) {
        console.warn("broadcast fallback read failed", e);
      }
    }

    return NextResponse.json({ chainId, addresses });
  } catch (e) {
    console.error("testnetstatus-config read failed", e);
    return NextResponse.json({ chainId, addresses: {} }, { status: 200 });
  }
}

// Best-effort parser for forge broadcast output
function extractAddressesFromBroadcast(txs = []) {
  const out = {};
  for (const tx of txs) {
    if (tx.transactionType !== "CREATE" || !tx.contractAddress) continue;
    const name = tx.contractName;
    switch (name) {
      case "MockWETH":
        out.weth = tx.contractAddress;
        break;
      case "MockWstETH":
        out.wstEth = tx.contractAddress;
        break;
      case "MockStETH":
        out.stEth = tx.contractAddress;
        break;
      case "MockOracle":
        out.oracle = tx.contractAddress;
        break;
      case "MockRouter":
        out.router = tx.contractAddress;
        break;
      case "MockPool":
        out.pool = tx.contractAddress;
        break;
      case "MockFluidVault":
        out.fluid = tx.contractAddress;
        break;
      case "YieldStrategy":
        out.strategy = tx.contractAddress;
        break;
      case "StakingVault":
        out.vault = tx.contractAddress;
        break;
      case "MockERC20": {
        // Symbol sits in arguments[1]
        const symbol = Array.isArray(tx.arguments) ? tx.arguments[1] : null;
        if (symbol === "WBTC") out.wbtc = tx.contractAddress;
        if (symbol === "USDC") out.usdc = tx.contractAddress;
        break;
      }
      default:
        break;
    }
  }
  return out;
}
