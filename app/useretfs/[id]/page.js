// app/useretfs/[id]/page.js
import PortfolioDetailClient from "./ClientPortfolioDetail";

export async function generateMetadata({ params }) {
  const id = params.id;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://sonaetf.com";

  let title = "Sona ETF portfolio";
  let description =
    "User-created ETF-style crypto portfolio on Sona with custom composition and on-chain metrics.";

  try {
    const res = await fetch(`${baseUrl}/api/portfolios/${id}`, {
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      const p = json?.portfolio;
      if (p?.nickname) {
        title = p.nickname;
      }
      if (p?.comment) {
        description = p.comment.slice(0, 200);
      }
    }
  } catch {
    // ignore and keep defaults
  }

  const canonicalPath = `/useretfs/${id}`;
  const ogImagePath = `/api/portfolio-og/${id}`;

  return {
    title,
    description,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: canonicalPath,
    },
    robots: {
      index: true,
      follow: true,
    },
    keywords: [
      "crypto ETF",
      "onchain ETF",
      "DeFi portfolio",
      "Sona",
      "sonaetf",
      "user portfolio",
      "crypto index",
    ],
    openGraph: {
      type: "website",
      siteName: "Sona ETF",
      title,
      description,
      url: canonicalPath,
      images: [
        {
          url: ogImagePath,
          width: 1200,
          height: 675,
          alt: `${title} - Sona ETF portfolio`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      site: "@sonaetf",
      creator: "@sonaetf",
      images: [
        {
          url: ogImagePath,
          alt: `${title} - Sona ETF portfolio`,
        },
      ],
    },
  };
}

export default function Page({ params }) {
  return <PortfolioDetailClient id={params.id} />;
}
