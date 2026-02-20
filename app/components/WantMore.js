"use client";

import Link from "next/link";

export default function WantMore() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://stilletf.com");

  const shareText = "Want more? Check out Stillwater:";

  const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(
    `${shareText} ${baseUrl}`
  )}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
    baseUrl
  )}&text=${encodeURIComponent(shareText)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    baseUrl
  )}`;

  return (
    <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3">
      <Link
        href="/?auth=1"
        className="cta-btn cta-black no-underline w-full gap-2"
        aria-label="Want more?"
        title="Want more?"
      >
        <span>Want more?</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
          <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm1 5a1 1 0 1 0-2 0v4H7a1 1 0 1 0 0 2h4v4a1 1 0 1 0 2 0v-4h4a1 1 0 1 0 0-2h-4V7Z" />
        </svg>
      </Link>

      <a
        href={xUrl}
        target="_blank"
        rel="noreferrer"
        className="cta-btn cta-white no-underline w-full"
        aria-label="Share on X"
        title="Share on X"
      >
        <span className="sr-only">X</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
          <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.7l-5.2-6.6L5.5 22H2.4l7.3-8.4L1 2h6.9l4.7 6.1L18.9 2Zm-1.2 18h1.7L6.2 3.9H4.4L17.7 20Z" />
        </svg>
      </a>

      <a
        href={telegramUrl}
        target="_blank"
        rel="noreferrer"
        className="cta-btn cta-white no-underline w-full"
        aria-label="Share on Telegram"
        title="Share on Telegram"
      >
        <span className="sr-only">Telegram</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
          <path d="M21.8 4.6c.2-.8-.5-1.4-1.2-1.1L2.6 10.6c-.9.4-.9 1.7.1 2l4.6 1.5 1.7 5.4c.3.9 1.5 1.1 2.1.4l2.6-3.1 4.7 3.5c.7.5 1.7.1 1.9-.8l2.4-14.9ZM9.3 13.4l9.3-6.1-7.9 7.4-.3 3.2-1.6-5.1c-.1-.4 0-.8.5-1.1Z" />
        </svg>
      </a>

      <a
        href={linkedinUrl}
        target="_blank"
        rel="noreferrer"
        className="cta-btn cta-white no-underline w-full"
        aria-label="Share on LinkedIn"
        title="Share on LinkedIn"
      >
        <span className="sr-only">LinkedIn</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.1c.5-1 1.9-2 3.9-2 4.2 0 5 2.7 5 6.3V21h-4v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9V9Z" />
        </svg>
      </a>
    </div>
  );
}
