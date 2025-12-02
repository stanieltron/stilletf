// app/api/portfolio-og/[id]/route.js
import { prisma } from "../../../../lib/prisma";

export async function GET(_req, { params }) {
  const { id } = params;

  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    select: {
      ogImage: true,
      ogImageMime: true,
    },
  });

  if (!portfolio || !portfolio.ogImage) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(portfolio.ogImage, {
    status: 200,
    headers: {
      "Content-Type": portfolio.ogImageMime || "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
