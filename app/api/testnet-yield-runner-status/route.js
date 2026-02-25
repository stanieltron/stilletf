import { createRequire } from "module";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const require = createRequire(import.meta.url);
const {
  startTestnetYieldRunner,
  getTestnetYieldRunnerState,
  runTestnetYieldRunnerNow,
} = require("../../../scripts/testnet-yield-runner.cjs");

export async function GET() {
  try {
    startTestnetYieldRunner();
    return NextResponse.json({ runner: getTestnetYieldRunnerState() });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to read runner status",
        runner: null,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await runTestnetYieldRunnerNow();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to run runner",
        triggered: false,
        runner: getTestnetYieldRunnerState(),
      },
      { status: 500 }
    );
  }
}
