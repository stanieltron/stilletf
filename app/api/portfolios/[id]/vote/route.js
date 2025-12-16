import { prisma } from "../../../../../lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";

// POST /api/portfolios/:id/vote
export async function POST(req, { params }) {
  const portfolioId = String(params.id);
  const session = await getServerSession(authOptions).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : null;

  // Resolve the portfolio first
  const exists = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: { id: true, userId: true },
  });
  if (!exists || !exists.userId) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "not_authed" }), { status: 401 });
  }

  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!userExists) {
    return new Response(JSON.stringify({ error: "not_authed" }), { status: 401 });
  }

  try {
    await prisma.vote.create({
      data: { portfolioId, userId },
    });
  } catch (e) {
    // Unique constraint → already voted
    if (e?.code === "P2002") {
      return new Response(JSON.stringify({ error: "already_voted" }), { status: 409 });
    }
    throw e;
  }

  const updated = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { _count: { select: { votes: true } } },
  });

  return Response.json({ portfolio: updated });
}
