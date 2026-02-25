const { Contract, JsonRpcProvider, Wallet, formatUnits } = require("ethers");
const { inspect } = require("util");

const RUNNER_STATE_KEY = "__testnetYieldRunnerState";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MIN_INTERVAL_MS = 60 * 1000;
const HOURS_PER_YEAR = 365n * 24n;

const DEFAULT_APY_BPS = 300n; // 3%
const DEFAULT_WBTC_USD = 60000n;
const DEFAULT_ETH_USD = 3000n;
const DEFAULT_RPC_TIMEOUT_MS = 20 * 1000;
const DEFAULT_TX_WAIT_TIMEOUT_MS = 3 * 60 * 1000;
const ANSI_YELLOW = "\x1b[33m";
const ANSI_RESET = "\x1b[0m";

const ERC20_METADATA_ABI = ["function decimals() view returns (uint8)"];
const FLUID_ABI = ["function donateYieldWithETH() payable"];
const VAULT_ABI = [
  "function totalAssets() view returns (uint256)",
];
const STRATEGY_ABI = [
  "function harvestYield() returns (uint256)",
  "event YieldHarvested(uint256 amountUSDC)",
];

function parseBool(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function shortError(error) {
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.message ||
    String(error)
  );
}

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timeout after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function toDetailString(details) {
  if (details === undefined) return "";
  return `\n${inspect(details, {
    depth: null,
    compact: false,
    breakLength: 140,
    sorted: true,
  })}`;
}

function runnerLog(message, details) {
  const text = `[testnet-yield-runner] ${message}${toDetailString(details)}`;
  console.log(`${ANSI_YELLOW}${text}${ANSI_RESET}`);
}

function runnerError(message, details) {
  const text = `[testnet-yield-runner] ${message}${toDetailString(details)}`;
  console.error(`${ANSI_YELLOW}${text}${ANSI_RESET}`);
}

function getIntervalMs() {
  const parsed = Number.parseInt(
    process.env.TESTNET_YIELD_RUNNER_INTERVAL_MS || "",
    10
  );
  if (!Number.isFinite(parsed) || parsed < MIN_INTERVAL_MS) {
    return DEFAULT_INTERVAL_MS;
  }
  return parsed;
}

function getRpcTimeoutMs() {
  return parseIntEnv(
    "TESTNET_YIELD_RUNNER_RPC_TIMEOUT_MS",
    DEFAULT_RPC_TIMEOUT_MS,
    1000
  );
}

function getTxWaitTimeoutMs() {
  return parseIntEnv(
    "TESTNET_YIELD_RUNNER_TX_WAIT_TIMEOUT_MS",
    DEFAULT_TX_WAIT_TIMEOUT_MS,
    1000
  );
}

function getRpcUrl() {
  return (
    process.env.TESTNET_YIELD_RUNNER_RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    ""
  );
}

function getChainId() {
  return process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";
}

function getPrivateKey() {
  return process.env.TESTNET_YIELD_RUNNER_PRIVATE_KEY || "";
}

function getVaultAddress() {
  return (
    process.env.STAKING_VAULT_ADDRESS ||
    process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS ||
    ""
  );
}

function getFluidVaultAddress() {
  return (
    process.env.FLUID_VAULT_ADDRESS ||
    process.env.NEXT_PUBLIC_FLUID_VAULT_ADDRESS ||
    ""
  );
}

function getStrategyAddress() {
  return (
    process.env.YIELD_STRATEGY_ADDRESS ||
    process.env.NEXT_PUBLIC_YIELD_STRATEGY_ADDRESS ||
    ""
  );
}

function getWbtcAddress() {
  return process.env.WBTC_ADDRESS || process.env.NEXT_PUBLIC_WBTC_ADDRESS || "";
}

function parseBigIntEnv(name, fallbackValue) {
  const raw = process.env[name];
  if (!raw || !String(raw).trim()) return fallbackValue;
  try {
    return BigInt(String(raw).trim());
  } catch {
    return fallbackValue;
  }
}

function parseIntEnv(name, fallbackValue, minValue = 1) {
  const raw = process.env[name];
  if (!raw || !String(raw).trim()) return fallbackValue;
  const parsed = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < minValue) return fallbackValue;
  return parsed;
}

function shouldEnableRunner() {
  const explicitDisable = parseBool(
    process.env.DISABLE_TESTNET_YIELD_RUNNER ||
      process.env.TESTNET_YIELD_RUNNER_DISABLED
  );
  if (explicitDisable === true) return false;

  const explicitEnable = parseBool(process.env.ENABLE_TESTNET_YIELD_RUNNER);
  if (explicitEnable != null) return explicitEnable;

  return Boolean(getPrivateKey());
}

function computeDonationWei({
  vaultTotalAssetsRaw,
  wbtcDecimals,
  wbtcUsd,
  ethUsd,
  apyBps,
}) {
  if (
    !vaultTotalAssetsRaw ||
    vaultTotalAssetsRaw <= 0n ||
    wbtcDecimals < 0 ||
    wbtcUsd <= 0n ||
    ethUsd <= 0n ||
    apyBps <= 0n
  ) {
    return 0n;
  }

  const numerator = vaultTotalAssetsRaw * wbtcUsd * apyBps * 10n ** 18n;
  const denominator =
    10n ** BigInt(wbtcDecimals) * 10000n * HOURS_PER_YEAR * ethUsd;

  if (denominator <= 0n) return 0n;
  return numerator / denominator;
}

function extractHarvestedUSDC(receipt, contractInterface) {
  if (!receipt || !Array.isArray(receipt.logs)) return null;
  for (const log of receipt.logs) {
    try {
      const parsed = contractInterface.parseLog(log);
      if (parsed?.name !== "YieldHarvested") continue;
      const value = parsed?.args?.amountUSDC ?? parsed?.args?.[0];
      if (value == null) return null;
      return value.toString();
    } catch {
      // ignore unrelated logs
    }
  }
  return null;
}

function sanitizeState(state) {
  if (!state) return null;
  return {
    enabled: Boolean(state.enabled),
    configReady: Boolean(state.configReady),
    inFlight: Boolean(state.inFlight),
    chainId: state.chainId,
    intervalMs: state.intervalMs,
    nextScheduledAt: state.nextScheduledAt || null,
    startedAt: state.startedAt || null,
    walletAddress: state.walletAddress || "",
    vaultAddress: state.vaultAddress,
    fluidVaultAddress: state.fluidVaultAddress,
    strategyAddress: state.strategyAddress,
    wbtcAddress: state.wbtcAddress,
    assumptions: {
      wbtcUsd: state.wbtcUsd.toString(),
      ethUsd: state.ethUsd.toString(),
      apyBps: state.apyBps.toString(),
    },
    lastRun: state.lastRun || null,
    lastError: state.lastError || null,
  };
}

function setNextScheduledAt(state, fromMs = Date.now()) {
  if (!state?.intervalMs || state.intervalMs <= 0) {
    state.nextScheduledAt = null;
    return;
  }
  state.nextScheduledAt = new Date(fromMs + state.intervalMs).toISOString();
}

async function runOnce(state) {
  if (state.inFlight) {
    runnerLog("previous run still active, skipping tick");
    return;
  }

  state.inFlight = true;
  const startedAtMs = Date.now();
  const run = {
    startedAt: new Date(startedAtMs).toISOString(),
    status: "running",
    chainIdExpected: state.chainId,
    assumptions: {
      wbtcUsd: state.wbtcUsd.toString(),
      ethUsd: state.ethUsd.toString(),
      apyBps: state.apyBps.toString(),
    },
  };
  runnerLog("run started", {
    at: run.startedAt,
    chainIdExpected: run.chainIdExpected,
    walletAddress: state.walletAddress,
    vaultAddress: state.vaultAddress,
    fluidVaultAddress: state.fluidVaultAddress,
    strategyAddress: state.strategyAddress,
    nextScheduledAt: state.nextScheduledAt || null,
  });

  try {
    runnerLog(
      "step 1/18: reading on-chain state (network, block, WBTC decimals, vault totalAssets)",
      { rpcTimeoutMs: state.rpcTimeoutMs }
    );
    const [network, blockNumber, wbtcDecimalsRaw, vaultTotalAssetsRaw] =
      await Promise.all([
        withTimeout(
          state.provider.getNetwork(),
          state.rpcTimeoutMs,
          "provider.getNetwork"
        ),
        withTimeout(
          state.provider.getBlockNumber(),
          state.rpcTimeoutMs,
          "provider.getBlockNumber"
        ),
        withTimeout(
          state.wbtc.decimals(),
          state.rpcTimeoutMs,
          "wbtc.decimals"
        ),
        withTimeout(
          state.vault.totalAssets(),
          state.rpcTimeoutMs,
          "vault.totalAssets"
        ),
      ]);

    const rpcChainId =
      network.chainId?.toString?.() || String(network.chainId || "");
    const parsedChainId = Number.parseInt(
      String(rpcChainId || state.chainId || "0"),
      10
    );
    const signingChainId =
      Number.isFinite(parsedChainId) && parsedChainId > 0
        ? parsedChainId
        : null;
    const parsedWbtcDecimals = Number(wbtcDecimalsRaw);
    const wbtcDecimals = Number.isFinite(parsedWbtcDecimals)
      ? parsedWbtcDecimals
      : 8;

    const donationWei = computeDonationWei({
      vaultTotalAssetsRaw,
      wbtcDecimals,
      wbtcUsd: state.wbtcUsd,
      ethUsd: state.ethUsd,
      apyBps: state.apyBps,
    });

    run.rpcChainId = rpcChainId;
    run.signingChainId = signingChainId == null ? null : String(signingChainId);
    run.blockNumber = String(blockNumber);
    run.wbtcDecimals = String(wbtcDecimals);
    run.vaultTotalAssetsRaw = vaultTotalAssetsRaw.toString();
    run.vaultTotalAssetsWbtc = formatUnits(vaultTotalAssetsRaw, wbtcDecimals);
    run.donationWei = donationWei.toString();
    run.donationEth = formatUnits(donationWei, 18);

    runnerLog("step 2/18: computed donation", {
      rpcChainId: run.rpcChainId,
      blockNumber: run.blockNumber,
      wbtcDecimals: run.wbtcDecimals,
      vaultTotalAssetsWbtc: run.vaultTotalAssetsWbtc,
      donationWei: run.donationWei,
      donationEth: run.donationEth,
      assumptions: run.assumptions,
    });

    if (state.chainId && rpcChainId && rpcChainId !== state.chainId) {
      run.status = "error";
      run.error = `Chain mismatch: expected ${state.chainId}, got ${rpcChainId}.`;
      runnerError("step failed: chain mismatch", {
        expected: state.chainId,
        got: rpcChainId,
      });
      return;
    }

    if (donationWei <= 0n) {
      run.status = "skipped";
      run.reason = "Calculated donation is zero.";
      runnerLog("step 3/18: donation is zero, skipping tx flow", {
        donationWei: run.donationWei,
      });
      return;
    }

    runnerLog("step 3/18: checking runner wallet ETH balance");
    const balanceBefore = await withTimeout(
      state.provider.getBalance(state.walletAddress),
      state.rpcTimeoutMs,
      "provider.getBalance.before"
    );
    run.walletEthBalanceBefore = formatUnits(balanceBefore, 18);
    runnerLog("runner wallet balance loaded", {
      walletAddress: state.walletAddress,
      walletEthBalanceBefore: run.walletEthBalanceBefore,
      requiredDonationEth: run.donationEth,
    });

    if (balanceBefore < donationWei) {
      run.status = "error";
      run.error = "Insufficient ETH on runner wallet for donation.";
      runnerError("step failed: insufficient ETH for donation", {
        walletEthBalanceBefore: run.walletEthBalanceBefore,
        requiredDonationEth: run.donationEth,
      });
      return;
    }

    runnerLog("step 4/18: building donateYieldWithETH tx request", {
      fluidVaultAddress: state.fluidVaultAddress,
      donationWei: run.donationWei,
      donationEth: run.donationEth,
    });
    const donateTxRequestBase = await withTimeout(
      state.fluid.donateYieldWithETH.populateTransaction({ value: donationWei }),
      state.rpcTimeoutMs,
      "donate.populateTransaction"
    );
    run.donateMethod = "donateYieldWithETH()";
    run.donateTxTo = donateTxRequestBase?.to || state.fluidVaultAddress;
    run.donateTxValueWei = (donateTxRequestBase?.value || donationWei).toString();
    run.donateTxDataPrefix =
      typeof donateTxRequestBase?.data === "string"
        ? donateTxRequestBase.data.slice(0, 10)
        : null;
    runnerLog("donation tx request populated", {
      to: run.donateTxTo,
      valueWei: run.donateTxValueWei,
      dataPrefix: run.donateTxDataPrefix,
    });

    runnerLog("step 5/18: estimating donation gas");
    const donateGasEstimate = await withTimeout(
      state.provider.estimateGas({
        ...donateTxRequestBase,
        from: state.walletAddress,
      }),
      state.rpcTimeoutMs,
      "donate.estimateGas"
    );
    const donateGasLimit = (donateGasEstimate * 12n) / 10n + 10000n;
    run.donateGasEstimate = donateGasEstimate.toString();
    run.donateGasLimit = donateGasLimit.toString();
    runnerLog("donation gas estimated", {
      gasEstimate: run.donateGasEstimate,
      gasLimit: run.donateGasLimit,
    });

    runnerLog("step 6/18: loading donation nonce and fee data");
    const [donateNonce, donateFeeData] = await Promise.all([
      withTimeout(
        state.provider.getTransactionCount(state.walletAddress, "pending"),
        state.rpcTimeoutMs,
        "donate.getNonce"
      ),
      withTimeout(
        state.provider.getFeeData(),
        state.rpcTimeoutMs,
        "donate.getFeeData"
      ),
    ]);
    run.donateNonce = String(donateNonce);
    run.donateFee = {
      maxFeePerGas: donateFeeData?.maxFeePerGas?.toString?.() || null,
      maxPriorityFeePerGas:
        donateFeeData?.maxPriorityFeePerGas?.toString?.() || null,
      gasPrice: donateFeeData?.gasPrice?.toString?.() || null,
    };
    const donateTxRequest = {
      ...donateTxRequestBase,
      nonce: donateNonce,
      gasLimit: donateGasLimit,
    };
    if (signingChainId != null) donateTxRequest.chainId = signingChainId;
    if (
      donateFeeData?.maxFeePerGas != null &&
      donateFeeData?.maxPriorityFeePerGas != null
    ) {
      donateTxRequest.maxFeePerGas = donateFeeData.maxFeePerGas;
      donateTxRequest.maxPriorityFeePerGas = donateFeeData.maxPriorityFeePerGas;
      donateTxRequest.type = 2;
    } else if (donateFeeData?.gasPrice != null) {
      donateTxRequest.gasPrice = donateFeeData.gasPrice;
    }
    runnerLog("donation tx request finalized", {
      nonce: run.donateNonce,
      gasLimit: run.donateGasLimit,
      fee: run.donateFee,
    });

    runnerLog("step 7/18: signing donation tx");
    const donateSignedTx = await withTimeout(
      state.signer.signTransaction(donateTxRequest),
      state.rpcTimeoutMs,
      "donate.signTransaction"
    );
    run.donateSignedTxPrefix =
      typeof donateSignedTx === "string" ? donateSignedTx.slice(0, 20) : null;
    runnerLog("donation tx signed", {
      signedTxPrefix: run.donateSignedTxPrefix,
    });

    runnerLog(
      "step 8/18: broadcasting donation raw tx via eth_sendRawTransaction"
    );
    run.donateSendRpcMethod = "eth_sendRawTransaction";
    const donateTxHash = await withTimeout(
      state.provider.send("eth_sendRawTransaction", [donateSignedTx]),
      state.rpcTimeoutMs,
      "donate.eth_sendRawTransaction"
    );
    run.donateTxHash = donateTxHash;
    runnerLog("donation tx submitted", { txHash: run.donateTxHash });

    runnerLog("step 9/18: waiting for donation tx confirmation", {
      txWaitTimeoutMs: state.txWaitTimeoutMs,
    });
    const donateReceipt = await withTimeout(
      state.provider.waitForTransaction(run.donateTxHash),
      state.txWaitTimeoutMs,
      "donate.waitForTransaction"
    );
    if (!donateReceipt) {
      throw new Error(
        `donate.waitForTransaction returned no receipt for ${run.donateTxHash}`
      );
    }
    run.donateTxStatus =
      donateReceipt?.status === undefined ? null : String(donateReceipt.status);
    run.donateTxBlockNumber =
      donateReceipt?.blockNumber === undefined
        ? null
        : String(donateReceipt.blockNumber);
    run.donateTxGasUsed = donateReceipt?.gasUsed?.toString?.() || null;
    runnerLog("donation tx confirmed", {
      txHash: run.donateTxHash,
      status: run.donateTxStatus,
      blockNumber: run.donateTxBlockNumber,
      gasUsed: run.donateTxGasUsed,
    });

    runnerLog("step 10/18: preflight harvest staticCall");
    try {
      const estimate = await withTimeout(
        state.strategy.harvestYield.staticCall(),
        state.rpcTimeoutMs,
        "harvest.staticCall"
      );
      run.harvestEstimatedUsdcRaw = estimate.toString();
      runnerLog("harvest preflight estimate loaded", {
        harvestEstimatedUsdcRaw: run.harvestEstimatedUsdcRaw,
      });
    } catch (error) {
      run.harvestEstimateError = shortError(error);
      runnerLog("harvest preflight failed, continuing to tx", {
        error: run.harvestEstimateError,
      });
    }

    runnerLog("step 11/18: building harvest tx request", {
      strategyAddress: state.strategyAddress,
    });
    const harvestTxRequestBase = await withTimeout(
      state.strategy.harvestYield.populateTransaction(),
      state.rpcTimeoutMs,
      "harvest.populateTransaction"
    );
    run.harvestMethod = "harvestYield()";
    run.harvestTxTo = harvestTxRequestBase?.to || state.strategyAddress;
    run.harvestTxDataPrefix =
      typeof harvestTxRequestBase?.data === "string"
        ? harvestTxRequestBase.data.slice(0, 10)
        : null;
    runnerLog("harvest tx request populated", {
      to: run.harvestTxTo,
      dataPrefix: run.harvestTxDataPrefix,
    });

    runnerLog("step 12/18: estimating harvest gas");
    const harvestGasEstimate = await withTimeout(
      state.provider.estimateGas({
        ...harvestTxRequestBase,
        from: state.walletAddress,
      }),
      state.rpcTimeoutMs,
      "harvest.estimateGas"
    );
    const harvestGasLimit = (harvestGasEstimate * 12n) / 10n + 10000n;
    run.harvestGasEstimate = harvestGasEstimate.toString();
    run.harvestGasLimit = harvestGasLimit.toString();
    runnerLog("harvest gas estimated", {
      gasEstimate: run.harvestGasEstimate,
      gasLimit: run.harvestGasLimit,
    });

    runnerLog("step 13/18: loading harvest nonce and fee data");
    const [harvestNonce, harvestFeeData] = await Promise.all([
      withTimeout(
        state.provider.getTransactionCount(state.walletAddress, "pending"),
        state.rpcTimeoutMs,
        "harvest.getNonce"
      ),
      withTimeout(
        state.provider.getFeeData(),
        state.rpcTimeoutMs,
        "harvest.getFeeData"
      ),
    ]);
    run.harvestNonce = String(harvestNonce);
    run.harvestFee = {
      maxFeePerGas: harvestFeeData?.maxFeePerGas?.toString?.() || null,
      maxPriorityFeePerGas:
        harvestFeeData?.maxPriorityFeePerGas?.toString?.() || null,
      gasPrice: harvestFeeData?.gasPrice?.toString?.() || null,
    };
    const harvestTxRequest = {
      ...harvestTxRequestBase,
      nonce: harvestNonce,
      gasLimit: harvestGasLimit,
    };
    if (signingChainId != null) harvestTxRequest.chainId = signingChainId;
    if (
      harvestFeeData?.maxFeePerGas != null &&
      harvestFeeData?.maxPriorityFeePerGas != null
    ) {
      harvestTxRequest.maxFeePerGas = harvestFeeData.maxFeePerGas;
      harvestTxRequest.maxPriorityFeePerGas =
        harvestFeeData.maxPriorityFeePerGas;
      harvestTxRequest.type = 2;
    } else if (harvestFeeData?.gasPrice != null) {
      harvestTxRequest.gasPrice = harvestFeeData.gasPrice;
    }
    runnerLog("harvest tx request finalized", {
      nonce: run.harvestNonce,
      gasLimit: run.harvestGasLimit,
      fee: run.harvestFee,
    });

    runnerLog("step 14/18: signing harvest tx", {
      strategyAddress: state.strategyAddress,
    });
    const harvestSignedTx = await withTimeout(
      state.signer.signTransaction(harvestTxRequest),
      state.rpcTimeoutMs,
      "harvest.signTransaction"
    );
    run.harvestSignedTxPrefix =
      typeof harvestSignedTx === "string" ? harvestSignedTx.slice(0, 20) : null;
    runnerLog("harvest tx signed", {
      signedTxPrefix: run.harvestSignedTxPrefix,
    });

    runnerLog(
      "step 15/18: broadcasting harvest raw tx via eth_sendRawTransaction"
    );
    run.harvestSendRpcMethod = "eth_sendRawTransaction";
    const harvestTxHash = await withTimeout(
      state.provider.send("eth_sendRawTransaction", [harvestSignedTx]),
      state.rpcTimeoutMs,
      "harvest.eth_sendRawTransaction"
    );
    run.harvestTxHash = harvestTxHash;
    runnerLog("harvest tx submitted", { txHash: run.harvestTxHash });

    runnerLog("step 16/18: waiting for harvest tx confirmation", {
      txWaitTimeoutMs: state.txWaitTimeoutMs,
    });
    const harvestReceipt = await withTimeout(
      state.provider.waitForTransaction(run.harvestTxHash),
      state.txWaitTimeoutMs,
      "harvest.waitForTransaction"
    );
    if (!harvestReceipt) {
      throw new Error(
        `harvest.waitForTransaction returned no receipt for ${run.harvestTxHash}`
      );
    }
    run.harvestTxStatus =
      harvestReceipt?.status === undefined ? null : String(harvestReceipt.status);
    run.harvestTxBlockNumber =
      harvestReceipt?.blockNumber === undefined
        ? null
        : String(harvestReceipt.blockNumber);
    run.harvestTxGasUsed = harvestReceipt?.gasUsed?.toString?.() || null;
    runnerLog("harvest tx confirmed", {
      txHash: run.harvestTxHash,
      status: run.harvestTxStatus,
      blockNumber: run.harvestTxBlockNumber,
      gasUsed: run.harvestTxGasUsed,
    });

    const harvestedUsdcRaw = extractHarvestedUSDC(
      harvestReceipt,
      state.strategy.interface
    );
    if (harvestedUsdcRaw != null) {
      run.harvestedUsdcRaw = harvestedUsdcRaw;
      runnerLog("step 17/18: harvest event parsed", {
        harvestedUsdcRaw: run.harvestedUsdcRaw,
      });
    } else {
      runnerLog("step 17/18: harvest event not found in receipt logs");
    }

    runnerLog("step 18/18: reading post-run wallet balance");
    const balanceAfter = await withTimeout(
      state.provider.getBalance(state.walletAddress),
      state.rpcTimeoutMs,
      "provider.getBalance.after"
    );
    run.walletEthBalanceAfter = formatUnits(balanceAfter, 18);
    runnerLog("post-run wallet balance loaded", {
      walletEthBalanceAfter: run.walletEthBalanceAfter,
    });
    run.status = "success";
  } catch (error) {
    run.status = "error";
    run.error = shortError(error);
    run.errorStack =
      typeof error?.stack === "string"
        ? error.stack.split("\n").slice(0, 6).join("\n")
        : null;
  } finally {
    run.finishedAt = new Date().toISOString();
    run.durationMs = String(Date.now() - startedAtMs);
    state.lastRun = run;
    state.lastError = run.status === "error" ? run.error : null;
    state.inFlight = false;

    if (run.status === "error") {
      runnerError("run failed", run);
    } else {
      runnerLog("run completed", run);
    }
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
    state.nextScheduledAt = null;

    runnerLog("stopped", {
      signal,
      at: new Date().toISOString(),
    });
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

function startTestnetYieldRunner() {
  if (global[RUNNER_STATE_KEY]) return global[RUNNER_STATE_KEY];

  const state = {
    enabled: false,
    configReady: false,
    inFlight: false,
    stopping: false,
    timer: null,
    provider: null,
    signer: null,
    vault: null,
    fluid: null,
    strategy: null,
    wbtc: null,
    walletAddress: "",
    chainId: getChainId(),
    rpcUrl: getRpcUrl(),
    vaultAddress: getVaultAddress(),
    fluidVaultAddress: getFluidVaultAddress(),
    strategyAddress: getStrategyAddress(),
    wbtcAddress: getWbtcAddress(),
    intervalMs: getIntervalMs(),
    rpcTimeoutMs: getRpcTimeoutMs(),
    txWaitTimeoutMs: getTxWaitTimeoutMs(),
    nextScheduledAt: null,
    wbtcUsd: parseBigIntEnv("TESTNET_YIELD_RUNNER_WBTC_USD", DEFAULT_WBTC_USD),
    ethUsd: parseBigIntEnv("TESTNET_YIELD_RUNNER_ETH_USD", DEFAULT_ETH_USD),
    apyBps: parseBigIntEnv("TESTNET_YIELD_RUNNER_APY_BPS", DEFAULT_APY_BPS),
    startedAt: null,
    lastRun: null,
    lastError: null,
  };
  global[RUNNER_STATE_KEY] = state;

  if (!shouldEnableRunner()) {
    runnerLog("disabled");
    return state;
  }

  const privateKey = getPrivateKey();
  if (
    !privateKey ||
    !state.rpcUrl ||
    !state.vaultAddress ||
    !state.fluidVaultAddress ||
    !state.strategyAddress ||
    !state.wbtcAddress
  ) {
    runnerLog("missing config, not starting", {
      hasPrivateKey: Boolean(privateKey),
      hasRpcUrl: Boolean(state.rpcUrl),
      hasVaultAddress: Boolean(state.vaultAddress),
      hasFluidVaultAddress: Boolean(state.fluidVaultAddress),
      hasStrategyAddress: Boolean(state.strategyAddress),
      hasWbtcAddress: Boolean(state.wbtcAddress),
    });
    return state;
  }

  try {
    state.provider = new JsonRpcProvider(state.rpcUrl);
    state.signer = new Wallet(privateKey, state.provider);
    state.walletAddress = state.signer.address;
    state.vault = new Contract(state.vaultAddress, VAULT_ABI, state.signer);
    state.fluid = new Contract(state.fluidVaultAddress, FLUID_ABI, state.signer);
    state.strategy = new Contract(
      state.strategyAddress,
      STRATEGY_ABI,
      state.signer
    );
    state.wbtc = new Contract(state.wbtcAddress, ERC20_METADATA_ABI, state.signer);
    state.enabled = true;
    state.configReady = true;
    state.startedAt = new Date().toISOString();
  } catch (error) {
    state.lastError = shortError(error);
    runnerError("failed to initialize", {
      at: new Date().toISOString(),
      message: state.lastError,
    });
    return state;
  }

  runnerLog("started", {
    at: state.startedAt,
    chainId: state.chainId,
    intervalMs: state.intervalMs,
    rpcTimeoutMs: state.rpcTimeoutMs,
    txWaitTimeoutMs: state.txWaitTimeoutMs,
    walletAddress: state.walletAddress,
    vaultAddress: state.vaultAddress,
    fluidVaultAddress: state.fluidVaultAddress,
    strategyAddress: state.strategyAddress,
    rpcUrl: state.rpcUrl,
    assumptions: {
      wbtcUsd: state.wbtcUsd.toString(),
      ethUsd: state.ethUsd.toString(),
      apyBps: state.apyBps.toString(),
    },
  });

  setNextScheduledAt(state);
  void runOnce(state);
  state.timer = setInterval(() => {
    setNextScheduledAt(state);
    void runOnce(state);
  }, state.intervalMs);

  registerShutdown(state);
  return state;
}

function getTestnetYieldRunnerState() {
  return sanitizeState(global[RUNNER_STATE_KEY] || null);
}

async function runTestnetYieldRunnerNow() {
  const state = startTestnetYieldRunner();
  if (!state?.enabled || !state?.configReady) {
    return {
      triggered: false,
      reason: state?.lastError || "Runner is disabled or not configured.",
      runner: getTestnetYieldRunnerState(),
    };
  }

  if (state.inFlight) {
    return {
      triggered: false,
      reason: "Runner is already in progress.",
      runner: getTestnetYieldRunnerState(),
    };
  }

  runnerLog("manual run requested", {
    at: new Date().toISOString(),
  });
  await runOnce(state);

  return {
    triggered: true,
    reason: null,
    runner: getTestnetYieldRunnerState(),
  };
}

startTestnetYieldRunner();

module.exports = {
  startTestnetYieldRunner,
  getTestnetYieldRunnerState,
  runTestnetYieldRunnerNow,
};
