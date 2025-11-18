import { prisma } from "../../../../lib/prisma";

export async function GET(_req, { params }) {
  const p = await prisma.portfolio.findUnique({
    where: { id: String(params.id) },
    include: {
      _count: { select: { votes: true } },
      user: { select: { id: true, nickname: true, name: true } },
    },
  });
  if (!p) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  return Response.json({ portfolio: p });
}
