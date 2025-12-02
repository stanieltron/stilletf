// app/api/portfolios/[id]/og-image/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function POST(req, { params }) {
  const { id } = params;
  const portfolioId = String(id);

  try {
    const body = await req.json().catch(() => null);
    const image = body?.image;

    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image" }, { status: 400 });
    }

    // data:image/png;base64,AAAA...
    const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!match) {
      return NextResponse.json({ error: "Invalid data URL" }, { status: 400 });
    }

    const mime = match[1]; // e.g. "image/png"
    const base64 = match[2];
    const buffer = Buffer.from(base64, "base64");

    await prisma.portfolio.update({
      where: { id: portfolioId },
      data: {
        ogImage: buffer,
        ogImageMime: mime,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[OG API] error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
