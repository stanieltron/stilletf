import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const chainId = searchParams.get("chainId") || process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";
  const filePath = path.join(process.cwd(), "cache", "deployments", `${chainId}.json`);

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return NextResponse.json({ chainId, addresses: parsed });
  } catch (e) {
    console.error("testnetstatus-config read failed", e);
    return NextResponse.json({ chainId, addresses: {} }, { status: 200 });
  }
}
