import { prisma } from "../../../../../lib/prisma";

// POST /api/portfolios/:id/vote
// body: { userId? , userEmail? }
export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const portfolioId = String(params.id);

  // Resolve the portfolio first
  const exists = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: { id: true },
  });
  if (!exists) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  }

  // Resolve user server-side
  const userIdFromClient = body?.userId || null;
  const userEmailFromClient = body?.userEmail || null;

  let userId = null;
  if (userIdFromClient) {
    const u = await prisma.user.findUnique({ where: { id: String(userIdFromClient) }, select: { id: true } });
    if (u) userId = u.id;
  }
  if (!userId && userEmailFromClient) {
    const u = await prisma.user.findUnique({ where: { email: String(userEmailFromClient) }, select: { id: true } });
    if (u) userId = u.id;
  }
  if (!userId) {
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
