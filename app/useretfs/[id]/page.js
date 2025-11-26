// app/useretfs/[id]/page.js

import PortfolioDetailClient from "./ClientPortfolioDetail";

export async function generateMetadata({ params }) {
  const id = params.id;
  let title = "Skill-ETF portfolio";
  let description = "User-created portfolio on Stillwater Skill-ETFs.";

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/portfolios/${id}`, {
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      const p = json?.portfolio;
      if (p?.nickname) title = p.nickname;
      if (p?.comment) description = p.comment;
    }
  } catch {
    // fall back to defaults
  }

  // Per-portfolio OG image, generated similarly to ShareModal capture
  const ogImageUrl = `${baseUrl}/api/og/useretfs/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/useretfs/${id}`,
      images: [ogImageUrl],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function Page({ params }) {
  return <PortfolioDetailClient id={params.id} />;
}
