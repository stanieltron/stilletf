import fs from "fs";
import path from "path";
import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import { prisma } from "../../../../lib/prisma";

const VAULT_ABI = [
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function sharePrice() view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const DEFAULT_CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";

function asDecimalString(value, fractionDigits = 8) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(fractionDigits);
}

function getRpcUrl() {
  return (
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    ""
  );
}

function getConfiguredAddresses(chainId) {
  const filePath = path.join(process.cwd(), "cache", "deployments", `${chainId}.json`);
  let fileAddresses = {};
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    fileAddresses = JSON.parse(raw);
  } catch {
    // ignore and rely on env fallback
  }

  return {
    vault: process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS || fileAddresses.vault || "",
    wbtc: process.env.NEXT_PUBLIC_WBTC_ADDRESS || fileAddresses.wbtc || "",
  };
}

function mapSnapshot(row) {
  return {
    id: row.id,
    chainId: row.chainId,
    vaultAddress: row.vaultAddress,
    blockNumber: row.blockNumber?.toString?.() || String(row.blockNumber),
    blockTimestamp: row.blockTimestamp,
    vaultDecimals: row.vaultDecimals,
    totalAssetsRaw: row.totalAssetsRaw,
    totalSupplyRaw: row.totalSupplyRaw,
    sharePriceRaw: row.sharePriceRaw,
    totalAssets: row.totalAssets,
    totalSupply: row.totalSupply,
    sharePrice: row.sharePrice,
    growthPct: row.growthPct,
    createdAt: row.createdAt,
  };
}

function parseGrowthPct(value) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : 0;
}

function isAuthorized(req) {
  const secret = process.env.CORE_BUNDLE_INGEST_SECRET || process.env.CRON_SECRET;
  if (!secret) return true;

  const auth = req.headers.get("authorization") || "";
  const tokenFromAuth = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const tokenFromHeader = (req.headers.get("x-cron-secret") || "").trim();

  return tokenFromAuth === secret || tokenFromHeader === secret;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId") || DEFAULT_CHAIN_ID;
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "120", 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 2000)
      : 120;

    const configured = getConfiguredAddresses(chainId);
    const vaultAddress = configured.vault;
    if (!vaultAddress) {
      return Response.json(
        { error: "Vault address missing in deployment config." },
        { status: 400 }
      );
    }

    const rowsDesc = await prisma.coreBundleSnapshot.findMany({
      where: { chainId, vaultAddress },
      orderBy: { blockTimestamp: "desc" },
      take: limit,
    });

    const rows = rowsDesc.reverse();
    const snapshots = rows.map(mapSnapshot);
    const first = snapshots[0] || null;
    const last = snapshots[snapshots.length - 1] || null;

    return Response.json({
      chainId,
      vaultAddress,
      count: snapshots.length,
      summary: {
        growthPct: last ? parseGrowthPct(last.growthPct) : 0,
        firstBlockNumber: first?.blockNumber || null,
        lastBlockNumber: last?.blockNumber || null,
      },
      snapshots,
    });
  } catch (error) {
    console.error("core-bundle snapshots GET failed", error);
    return Response.json(
      { error: "Failed to load core bundle snapshots." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    if (!isAuthorized(req)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId") || DEFAULT_CHAIN_ID;
    const rpcUrl = getRpcUrl();
    if (!rpcUrl) {
      return Response.json({ error: "RPC URL missing." }, { status: 500 });
    }

    const configured = getConfiguredAddresses(chainId);
    const vaultAddress = configured.vault;
    if (!vaultAddress) {
      return Response.json(
        { error: "Vault address missing in deployment config." },
        { status: 400 }
      );
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const vault = new Contract(vaultAddress, VAULT_ABI, provider);

    const [network, blockNumberNow, decimalsRaw, totalAssetsRaw, totalSupplyRaw, sharePriceRaw] =
      await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber(),
        vault.decimals(),
        vault.totalAssets(),
        vault.totalSupply(),
        vault.sharePrice(),
      ]);

    const block = await provider.getBlock(blockNumberNow);
    const vaultDecimals = Number(decimalsRaw);
    const totalAssets = formatUnits(totalAssetsRaw, vaultDecimals);
    const totalSupply = formatUnits(totalSupplyRaw, vaultDecimals);
    const sharePrice = formatUnits(sharePriceRaw, vaultDecimals);

    const first = await prisma.coreBundleSnapshot.findFirst({
      where: { chainId, vaultAddress },
      orderBy: { blockNumber: "asc" },
      select: { totalAssets: true },
    });
    const baselineTotalAssets = first
      ? Number.parseFloat(first.totalAssets)
      : Number.parseFloat(totalAssets);
    const currentTotalAssets = Number.parseFloat(totalAssets);
    // Current vault implementation keeps sharePrice fixed at 1, so growth is tracked via totalAssets.
    const growthPctNumber =
      baselineTotalAssets > 0
        ? ((currentTotalAssets - baselineTotalAssets) / baselineTotalAssets) * 100
        : 0;
    const growthPct = asDecimalString(growthPctNumber, 8);

    const snapshot = await prisma.coreBundleSnapshot.upsert({
      where: {
        chainId_vaultAddress_blockNumber: {
          chainId,
          vaultAddress,
          blockNumber: BigInt(blockNumberNow),
        },
      },
      create: {
        chainId,
        vaultAddress,
        blockNumber: BigInt(blockNumberNow),
        blockTimestamp: new Date((block?.timestamp || Math.floor(Date.now() / 1000)) * 1000),
        vaultDecimals,
        totalAssetsRaw: totalAssetsRaw.toString(),
        totalSupplyRaw: totalSupplyRaw.toString(),
        sharePriceRaw: sharePriceRaw.toString(),
        totalAssets,
        totalSupply,
        sharePrice,
        growthPct,
      },
      update: {
        blockTimestamp: new Date((block?.timestamp || Math.floor(Date.now() / 1000)) * 1000),
        vaultDecimals,
        totalAssetsRaw: totalAssetsRaw.toString(),
        totalSupplyRaw: totalSupplyRaw.toString(),
        sharePriceRaw: sharePriceRaw.toString(),
        totalAssets,
        totalSupply,
        sharePrice,
        growthPct,
      },
    });

    return Response.json({
      ok: true,
      chainId,
      rpcChainId: network.chainId?.toString?.() || String(network.chainId || ""),
      snapshot: mapSnapshot(snapshot),
    });
  } catch (error) {
    console.error("core-bundle snapshot ingest failed", error);
    return Response.json(
      { error: "Failed to ingest core bundle snapshot." },
      { status: 500 }
    );
  }
}
