const path = require("path");
const { spawn } = require("child_process");

const IS_WIN = process.platform === "win32";
const prismaBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  IS_WIN ? "prisma.cmd" : "prisma"
);
const nextBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  IS_WIN ? "next.cmd" : "next"
);

function asInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function runOnce(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
      shell: false,
    });
    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });
  });
}

async function main() {
  await runOnce(prismaBin, ["migrate", "deploy"], "prisma migrate deploy");

  const port = process.env.PORT || "3000";
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";
  const ingestBaseUrl =
    process.env.CORE_BUNDLE_INGEST_BASE_URL || `http://127.0.0.1:${port}`;
  const ingestIntervalMs = asInt(
    process.env.CORE_BUNDLE_INGEST_INTERVAL_MS,
    15 * 60 * 1000
  );
  const ingestInitialDelayMs = asInt(
    process.env.CORE_BUNDLE_INGEST_INITIAL_DELAY_MS,
    30 * 1000
  );
  const schedulerEnabled =
    (process.env.CORE_BUNDLE_SELF_SCHEDULER || "true").toLowerCase() !==
    "false";
  const cronSecret =
    process.env.CORE_BUNDLE_INGEST_SECRET || process.env.CRON_SECRET || "";

  const nextProcess = spawn(nextBin, ["start", "-p", port], {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  let initialTimer = null;
  let intervalTimer = null;
  let stopping = false;

  async function runIngestTick() {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const url = `${ingestBaseUrl}/api/core-bundle/snapshots/ingest?chainId=${encodeURIComponent(
      chainId
    )}`;
    const headers = {};
    if (cronSecret) headers["x-cron-secret"] = cronSecret;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      const responseText = await res.text();
      let parsedBody = responseText;
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        // keep raw text when response is not JSON
      }

      console.log("[core-bundle] self-ingest tick", {
        at: new Date().toISOString(),
        ok: res.ok,
        status: res.status,
        durationMs: Date.now() - startedAt,
        response: parsedBody,
      });
    } catch (error) {
      console.error("[core-bundle] self-ingest tick failed", {
        at: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        error: error?.message || String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  if (schedulerEnabled) {
    console.log("[core-bundle] self-scheduler enabled", {
      at: new Date().toISOString(),
      chainId,
      ingestBaseUrl,
      ingestInitialDelayMs,
      ingestIntervalMs,
    });
    initialTimer = setTimeout(() => {
      runIngestTick();
      intervalTimer = setInterval(runIngestTick, ingestIntervalMs);
    }, ingestInitialDelayMs);
  } else {
    console.log("[core-bundle] self-scheduler disabled");
  }

  function stop(signal) {
    if (stopping) return;
    stopping = true;
    if (initialTimer) clearTimeout(initialTimer);
    if (intervalTimer) clearInterval(intervalTimer);
    if (!nextProcess.killed) {
      nextProcess.kill(signal);
    }
  }

  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  nextProcess.on("error", (error) => {
    console.error("[start] next process failed to start", error);
    stop("SIGTERM");
    process.exit(1);
  });

  nextProcess.on("exit", (code, signal) => {
    if (initialTimer) clearTimeout(initialTimer);
    if (intervalTimer) clearInterval(intervalTimer);
    if (signal) {
      process.exit(1);
      return;
    }
    process.exit(code || 0);
  });
}

main().catch((error) => {
  console.error("[start] startup failed", error);
  process.exit(1);
});
