import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { address } = await req.json().catch(() => ({}));
  if (!address || typeof address !== "string") {
    return new Response(JSON.stringify({ error: "Invalid address" }), { status: 400 });
  }

  // normalize to checksum/lowercase if you like; here we store lowercase
  const addr = address.toLowerCase();

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { walletAddress: addr },
      select: { id: true, walletAddress: true },
    });
    return Response.json({ ok: true, user });
  } catch (e) {
    // unique constraint or other error
    return new Response(JSON.stringify({ error: "Could not save wallet" }), { status: 409 });
  }
}
