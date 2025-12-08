// app/useretfs/[id]/page.js
import PortfolioDetailClient from "./ClientPortfolioDetail";
import { Metadata } from "next";

export async function generateMetadata({ params }) {
  const id = params.id;

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://stilletf.com";

  let title = "Still ETF portfolio";
  let description =
    "User-created ETF-style crypto portfolio on STILL with custom composition and on-chain metrics.";

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
        // comment as main description, with a small fallback suffix
        description = p.comment.slice(0, 200);
      }
    }
  } catch {
    // ignore and keep defaults
  }

  const canonicalPath = `/useretfs/${id}`;
  const ogImagePath = `/api/portfolio-og/${id}`;

  return {
    // page <title>
    title,
    description,

    // base for relative urls in metadata (Next.js app router feature)
    metadataBase: new URL(baseUrl),

    // canonical URL
    alternates: {
      canonical: canonicalPath,
    },

    // good for indexing
    robots: {
      index: true,
      follow: true,
    },

    // keyword hinting (not magic, but harmless)
    keywords: [
      "crypto ETF",
      "onchain ETF",
      "DeFi portfolio",
      "STILL",
      "stilletf",
      "user portfolio",
      "crypto index",
    ],

    openGraph: {
      type: "website",
      siteName: "STILL ETF",
      title,
      description,
      url: canonicalPath,
      images: [
        {
          url: ogImagePath,
          width: 1200,
          height: 675,
          alt: `${title} – STILL ETF portfolio`,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      // set these if/when you have the actual handle
      site: "@stilletf",
      creator: "@stilletf",
      images: [
        {
          url: ogImagePath,
          alt: `${title} – STILL ETF portfolio`,
        },
      ],
    },
  };
}

export default function Page({ params }) {
  return <PortfolioDetailClient id={params.id} />;
}
