// app/api/register/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

function sanitizeNickname(str) {
  const base = String(str || "").trim();
  const normalized = base.normalize("NFKD").replace(/[^\w\s-]/g, "");
  return normalized.replace(/\s+/g, "_").toLowerCase().slice(0, 32);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = session.user.email;
  const seed = session.user.name || email.split("@")[0];
  const requested = sanitizeNickname(body.nickname || seed);

  if (!requested) {
    return NextResponse.json({ error: "Nickname required" }, { status: 400 });
  }

  try {
    // If user exists and already has a nickname, keep it; else set requested
    const existing = await prisma.user.findUnique({ where: { email } });

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: session.user.name ?? undefined,
        nickname:
          existing?.nickname && existing.nickname.length > 0
            ? undefined
            : requested,
        provider: session.provider ?? undefined,
        providerAccountId: session.providerAccountId ?? undefined,
      },
      create: {
        email,
        name: session.user.name ?? null,
        nickname: requested,
        provider: session.provider ?? null,
        providerAccountId: session.providerAccountId ?? null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        provider: true,
        providerAccountId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    // Prisma unique constraint on nickname
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Nickname already taken" }, { status: 409 });
    }
    console.error("Registration error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
