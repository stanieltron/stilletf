"use client";

export default function Footer() {
  return (
    <footer className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-[100vw] bg-[var(--bg-dark)] text-[var(--footer-text)] border-t border-[var(--chrome)] mt-auto">
      <div className="mx-auto py-[14px] [width:80%]">
        <span>© {new Date().getFullYear()} Stillwater ETF</span>
      </div>
    </footer>
  );
}
