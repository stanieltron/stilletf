// /app/components/Intro.jsx
"use client";

export default function Intro({ onEnter }) {
  return (
    <section className="intro relative min-h-screen w-full bg-[var(--bg-dark)] text-[var(--header-text)] flex items-center justify-center">
      <div className="intro-inner max-w-3xl mx-auto px-6 text-center space-y-6">
        <h1 className="intro-title text-4xl md:text-6xl font-semibold tracking-tight">
          Portfolio Metrics Demo
        </h1>

        <p className="intro-subtitle text-lg md:text-xl text-white/70">
          Build tokenized portfolios, simulate yields, and compare strategies.
        </p>

        <button
          className="btn-step intro-btn inline-flex items-center justify-center rounded-2xl px-6 py-3 bg-[var(--bg)] text-[var(--text)] font-medium hover:bg-white/90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/50 transition"
          onClick={onEnter}
        >
          Get started
        </button>

        <div className="intro-hint pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/60 animate-bounce">
          <span className="text-sm uppercase tracking-wide">scroll to continue</span>
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 16l-6-6h12z" fill="currentColor" />
          </svg>
        </div>
      </div>
    </section>
  );
}
