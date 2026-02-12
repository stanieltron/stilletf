import { prisma } from "../../../../lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";

export async function GET(_req, { params }) {
  const session = await getServerSession(authOptions).catch(() => null);
  const viewerId = session?.user?.id ? String(session.user.id) : null;

  const p = await prisma.portfolio.findUnique({
    where: { id: String(params.id) },
    include: {
      _count: { select: { votes: true } },
      user: { select: { id: true, nickname: true, name: true } },
    },
  });
  if (!p) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });

  const ownerId = p.userId ? String(p.userId) : null;
  const isOwner = Boolean(viewerId && ownerId && viewerId === ownerId);

  return Response.json({
    portfolio: {
      ...p,
      isOwner,
    },
  });
}
