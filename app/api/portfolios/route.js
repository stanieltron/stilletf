// app/api/portfolios/route.js
import { prisma } from "../../../lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";

/**
 * GET /api/portfolios
 *
 * Optional query params:
 *   - ?user=<userId>  → only that user's portfolios (explicit filter)
 *   - ?mine=1         → portfolios for the currently logged-in user (from server session)
 *                       (ignored if ?user=... is provided)
 *
 * Default: return active portfolios (userId != null), sorted by votes desc then createdAt desc.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userParam = searchParams.get("user");
  const mine = searchParams.get("mine");

  // Default leaderboard view should only include "active" portfolios
  // (portfolios currently associated to a user).
  let where = { userId: { not: null } };

  if (userParam) {
    // explicit filter by user id
    where = { userId: String(userParam) };
  } else if (mine) {
    // derive from server session (ID-first)
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session?.user?.id) {
      return Response.json({ portfolios: [] }); // not logged in → nothing for "mine"
    }
    where = { userId: session.user.id };
  }

  const portfolios = await prisma.portfolio.findMany({
    where,
    include: {
      _count: { select: { votes: true } },
      user: { select: { id: true, nickname: true, name: true } },
    },
    orderBy: [
      { votes: { _count: "desc" } }, // by vote count
      { createdAt: "desc" },          // then newest
    ],
  });

  return Response.json({ portfolios });
}

/**
 * POST /api/portfolios
 *
 * Body:
 *   {
 *     // (legacy optional, still accepted but ignored if session is present)
 *     userId?: string,
 *     userEmail?: string,
 *     nickname?: string,
 *     comment?: string,
 *     assets: string[],
 *     weights: number[]
 *   }
 *
 * Behavior:
 *   - Prefer the **server session's** user.id (ID-first).
 *   - If no session, we fall back to legacy userId/userEmail resolution (to preserve old behavior).
 *   - If still no user, we allow userId = null (per your schema) – portfolio will not appear on the leaderboard.
  */
export async function POST(request) {
  // parse & validate body
  const body = await request.json().catch(() => ({}));
  const {
    userId: userIdFromClient = null,   // legacy
    userEmail: userEmailFromClient = null, // legacy
    nickname = "",
    comment = "",
    assets,
    weights,
  } = body || {};

  if (!Array.isArray(assets) || !Array.isArray(weights)) {
    return new Response(JSON.stringify({ error: "assets and weights must be arrays" }), { status: 400 });
  }
  if (assets.length !== weights.length) {
    return new Response(JSON.stringify({ error: "assets and weights length mismatch" }), { status: 400 });
  }

  // ID-first: derive user from server session when available
  const session = await getServerSession(authOptions).catch(() => null);
  let userId = session?.user?.id || null;

  // Back-compat: if no session, try legacy hints from the client
  if (!userId && userIdFromClient) {
    const u = await prisma.user.findUnique({
      where: { id: String(userIdFromClient) },
      select: { id: true },
    });
    if (u) userId = u.id;
  }
  if (!userId && userEmailFromClient) {
    const u = await prisma.user.findUnique({
      where: { email: String(userEmailFromClient) },
      select: { id: true },
    });
    if (u) userId = u.id;
  }
  // If still null, we'll save anonymously (allowed by your schema).

  const normalizedWeights = weights.map((w) =>
    Math.max(0, Math.min(10, Math.round(Number(w) || 0)))
  );

  const created = await prisma.$transaction(async (tx) => {
    let prior = [];
    if (userId) {
      prior = await tx.portfolio.findMany({
        where: { userId },
        select: { id: true },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
    }

    const next = await tx.portfolio.create({
      data: {
        userId,
        nickname,
        comment,
        assets,
        weights: normalizedWeights,
      },
    });

    if (userId && prior.length) {
      const [oldActive, ...others] = prior;

      // Keep votes from the prior active portfolio by moving them onto the new one.
      await tx.vote.updateMany({
        where: { portfolioId: oldActive.id },
        data: { portfolioId: next.id },
      });

      // Archive previous portfolios: detach from user so they don't show in the leaderboard.
      await tx.portfolio.update({
        where: { id: oldActive.id },
        data: { userId: null },
      });

      if (others.length) {
        const otherIds = others.map((p) => p.id);
        await tx.vote.deleteMany({ where: { portfolioId: { in: otherIds } } });
        await tx.portfolio.updateMany({
          where: { id: { in: otherIds } },
          data: { userId: null },
        });
      }
    }

    return tx.portfolio.findUnique({
      where: { id: next.id },
      include: { _count: { select: { votes: true } } },
    });
  });

  return new Response(JSON.stringify({ portfolio: created }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
