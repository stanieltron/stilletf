const { Contract, JsonRpcProvider, formatUnits } = require("ethers");
const { PrismaClient } = require("@prisma/client");

const POLLER_STATE_KEY = "__coreBundleSnapshotPollerState";
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;

const VAULT_ABI = [
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function sharePrice() view returns (uint256)",
  "function decimals() view returns (uint8)",
];

function parseBool(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function shouldEnablePoller() {
  const explicitDisable = parseBool(
    process.env.DISABLE_CORE_BUNDLE_POLLER || process.env.CORE_BUNDLE_POLLER_DISABLED
  );
  if (explicitDisable === true) return false;

  const explicitEnable = parseBool(process.env.ENABLE_CORE_BUNDLE_POLLER);
  if (explicitEnable != null) return explicitEnable;

  return true;
}

function getIntervalMs() {
  const parsed = Number.parseInt(process.env.CORE_BUNDLE_SNAPSHOT_INTERVAL_MS || "", 10);
  if (!Number.isFinite(parsed) || parsed < MIN_INTERVAL_MS) {
    return DEFAULT_INTERVAL_MS;
  }
  return parsed;
}

function getRpcUrl() {
  return (
    process.env.SEPOLIA_RPC_URL ||
    process.env.MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    ""
  );
}

function getVaultAddress() {
  return process.env.STAKING_VAULT_ADDRESS || process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS || "";
}

function getChainId() {
  return process.env.CORE_BUNDLE_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";
}

function asDecimalString(value, fractionDigits = 8) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(fractionDigits);
}

function deriveSharePriceRaw(totalAssetsRaw, totalSupplyRaw, decimals) {
  const scale = 10n ** BigInt(decimals);
  if (totalSupplyRaw === 0n) return scale;
  return (totalAssetsRaw * scale) / totalSupplyRaw;
}

async function collectOnChainSnapshot({ chainId, rpcUrl, vaultAddress }) {
  const provider = new JsonRpcProvider(rpcUrl);
  const vault = new Contract(vaultAddress, VAULT_ABI, provider);

  const [network, blockNumberNow, decimalsRaw, totalAssetsRaw, totalSupplyRaw, sharePriceMaybeRaw] =
    await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
      vault.decimals(),
      vault.totalAssets(),
      vault.totalSupply(),
      vault.sharePrice().catch(() => null),
    ]);

  const block = await provider.getBlock(blockNumberNow);
  const blockTimestamp = new Date((block?.timestamp || Math.floor(Date.now() / 1000)) * 1000);
  const parsedDecimals = Number(decimalsRaw);
  const vaultDecimals = Number.isFinite(parsedDecimals) ? parsedDecimals : 18;
  const sharePriceRaw =
    sharePriceMaybeRaw ?? deriveSharePriceRaw(totalAssetsRaw, totalSupplyRaw, vaultDecimals);

  return {
    chainId,
    rpcChainId: network.chainId?.toString?.() || String(network.chainId || ""),
    vaultAddress,
    blockNumberNow,
    blockTimestamp,
    vaultDecimals,
    totalAssetsRaw,
    totalSupplyRaw,
    sharePriceRaw,
    totalAssets: formatUnits(totalAssetsRaw, vaultDecimals),
    totalSupply: formatUnits(totalSupplyRaw, vaultDecimals),
    sharePrice: formatUnits(sharePriceRaw, vaultDecimals),
  };
}

async function persistSnapshot(prisma, snapshot) {
  const first = await prisma.coreBundleSnapshot.findFirst({
    where: { chainId: snapshot.chainId, vaultAddress: snapshot.vaultAddress },
    orderBy: { blockNumber: "asc" },
    select: { totalAssets: true },
  });

  const baselineTotalAssets = first
    ? Number.parseFloat(first.totalAssets)
    : Number.parseFloat(snapshot.totalAssets);
  const currentTotalAssets = Number.parseFloat(snapshot.totalAssets);
  const growthPctNumber =
    baselineTotalAssets > 0
      ? ((currentTotalAssets - baselineTotalAssets) / baselineTotalAssets) * 100
      : 0;
  const growthPct = asDecimalString(growthPctNumber, 8);

  return prisma.coreBundleSnapshot.upsert({
    where: {
      chainId_vaultAddress_blockNumber: {
        chainId: snapshot.chainId,
        vaultAddress: snapshot.vaultAddress,
        blockNumber: BigInt(snapshot.blockNumberNow),
      },
    },
    create: {
      chainId: snapshot.chainId,
      vaultAddress: snapshot.vaultAddress,
      blockNumber: BigInt(snapshot.blockNumberNow),
      blockTimestamp: snapshot.blockTimestamp,
      vaultDecimals: snapshot.vaultDecimals,
      totalAssetsRaw: snapshot.totalAssetsRaw.toString(),
      totalSupplyRaw: snapshot.totalSupplyRaw.toString(),
      sharePriceRaw: snapshot.sharePriceRaw.toString(),
      totalAssets: snapshot.totalAssets,
      totalSupply: snapshot.totalSupply,
      sharePrice: snapshot.sharePrice,
      growthPct,
    },
    update: {
      blockTimestamp: snapshot.blockTimestamp,
      vaultDecimals: snapshot.vaultDecimals,
      totalAssetsRaw: snapshot.totalAssetsRaw.toString(),
      totalSupplyRaw: snapshot.totalSupplyRaw.toString(),
      sharePriceRaw: snapshot.sharePriceRaw.toString(),
      totalAssets: snapshot.totalAssets,
      totalSupply: snapshot.totalSupply,
      sharePrice: snapshot.sharePrice,
      growthPct,
    },
  });
}

async function runOnce(state) {
  if (state.inFlight) {
    console.log("[core-bundle-poller] previous run still active, skipping tick");
    return;
  }

  state.inFlight = true;
  try {
    const onChainSnapshot = await collectOnChainSnapshot({
      chainId: state.chainId,
      rpcUrl: state.rpcUrl,
      vaultAddress: state.vaultAddress,
    });
    const saved = await persistSnapshot(state.prisma, onChainSnapshot);

    console.log("[core-bundle-poller] snapshot stored", {
      at: new Date().toISOString(),
      chainId: onChainSnapshot.chainId,
      rpcChainId: onChainSnapshot.rpcChainId,
      vaultAddress: onChainSnapshot.vaultAddress,
      blockNumber: onChainSnapshot.blockNumberNow.toString(),
      snapshotId: saved.id,
      totalAssets: onChainSnapshot.totalAssets,
      growthPct: saved.growthPct,
    });
  } catch (error) {
    console.error("[core-bundle-poller] run failed", {
      at: new Date().toISOString(),
      message: error?.message || String(error),
    });
  } finally {
    state.inFlight = false;
  }
}

function registerShutdown(state) {
  const shutdown = async (signal) => {
    if (state.stopping) return;
    state.stopping = true;

    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }

    try {
      await state.prisma.$disconnect();
    } catch (error) {
      console.error("[core-bundle-poller] prisma disconnect failed", {
        signal,
        message: error?.message || String(error),
      });
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

function startCoreBundleSnapshotPoller() {
  if (global[POLLER_STATE_KEY]) return global[POLLER_STATE_KEY];

  const state = {
    enabled: false,
    inFlight: false,
    stopping: false,
    timer: null,
    prisma: null,
    chainId: getChainId(),
    rpcUrl: getRpcUrl(),
    vaultAddress: getVaultAddress(),
    intervalMs: getIntervalMs(),
  };
  global[POLLER_STATE_KEY] = state;

  if (!shouldEnablePoller()) {
    console.log("[core-bundle-poller] disabled");
    return state;
  }

  if (!state.rpcUrl || !state.vaultAddress) {
    console.warn("[core-bundle-poller] missing config, not starting", {
      hasRpcUrl: Boolean(state.rpcUrl),
      hasVaultAddress: Boolean(state.vaultAddress),
    });
    return state;
  }

  state.prisma = new PrismaClient();
  state.enabled = true;

  console.log("[core-bundle-poller] started", {
    at: new Date().toISOString(),
    chainId: state.chainId,
    vaultAddress: state.vaultAddress,
    intervalMs: state.intervalMs,
  });

  void runOnce(state);
  state.timer = setInterval(() => {
    void runOnce(state);
  }, state.intervalMs);

  registerShutdown(state);
  return state;
}

startCoreBundleSnapshotPoller();

module.exports = {
  startCoreBundleSnapshotPoller,
};
