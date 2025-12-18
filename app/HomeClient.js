// app/HomeClient.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SignInModal from "./components/SignInModal";
import HeroSection from "./components/HeroSection";
import BuilderSection from "./components/BuilderSection";
import MissionStatement from "./components/MissionStatement";
import Roadmap from "./components/Roadmap";
import { LiveSection, LoveSection, PaidSection } from "./components/Sections";
import Carousel from "./components/Carousel";

/* --- helpers to detect reload/auth return (for keepAssets logic) --- */
function isReloadNavigation() {
  try {
    const nav =
      performance.getEntriesByType &&
      performance.getEntriesByType("navigation")[0];
    if (nav && nav.type) return nav.type === "reload";
    // eslint-disable-next-line deprecation/deprecation
    return performance.navigation && performance.navigation.type === 1;
  } catch {
    return false;
  }
}

function cameFromSignupOrAuth() {
  try {
    const url = new URL(window.location.href);
    const qp = url.searchParams;
    if (
      qp.get("fromSignup") === "1" ||
      qp.get("postSignup") === "1" ||
      qp.get("authReturn") === "1"
    )
      return true;
    const ref = document.referrer || "";
    return /(auth|signup|signin|login)/i.test(ref);
  } catch {
    return false;
  }
}

export default function HomeClient() {
  const search = useSearchParams();

  const sharedSectionInner =
    "w-[95%] md:w-[80%] mx-auto flex flex-col gap-8 md:gap-10 py-12";

  // default to keeping assets; we may explicitly turn it off on a hard reload
  const [keepAssets, setKeepAssets] = useState(true);

  // === keepAssets logic ===
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!search) return;

    const shareParam = search.get("share") === "1";
    const afterAuth = cameFromSignupOrAuth();
    const reload = isReloadNavigation();

    // If we explicitly came from auth/share, always keep assets.
    if (shareParam || afterAuth) {
      setKeepAssets(true);
      return;
    }

    // Hard reload without an auth/share context: start fresh.
    if (reload) {
      setKeepAssets(false);
      return;
    }

    // Default: keep assets so users don't lose progress.
    setKeepAssets(true);
  }, [search]);

  /* ===== sticky header height for layout ===== */
  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    const measure = () =>
      setHeaderH(headerRef.current ? headerRef.current.offsetHeight || 0 : 0);

    measure();
    let ro = null;
    try {
      if (headerRef.current && typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(measure);
        ro.observe(headerRef.current);
      }
    } catch {
      // ignore
    }
    window.addEventListener("resize", measure, { passive: true });
    const id = setTimeout(measure, 0);

    return () => {
      if (ro && ro.disconnect) ro.disconnect();
      window.removeEventListener("resize", measure);
      clearTimeout(id);
    };
  }, []);

  /* ===== Sections & navigation ===== */

  const sectionRefs = useRef([]);
  const setSectionRef = (el, i) => {
    sectionRefs.current[i] = el;
  };

  const [current, setCurrent] = useState(0); // index of section currently "in view"

  const navSections = useMemo(
    () => [
      { id: "hero", label: "Builder", index: 0 },
      { id: "mission", label: "Mission", index: 1 },
      { id: "roadmap", label: "Roadmap", index: 2 },
      { id: "paid", label: "Benefits", index: 3 },
      { id: "live", label: "Live", index: 4 },
      { id: "love", label: "Love", index: 5 },
    ],
    []
  );

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://sonaetf.com");
  const shareText = "Want more? Check out SONA:";
  const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(`${shareText} ${baseUrl}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(baseUrl)}&text=${encodeURIComponent(
    shareText
  )}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(baseUrl)}`;

  const [compactNav, setCompactNav] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      setCompactNav(window.innerWidth < 1100);
    };
    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const scrollToSection = (index) => {
    const sections = sectionRefs.current.filter(Boolean);
    if (!sections.length) return;

    const idx = Math.max(0, Math.min(sections.length - 1, index));
    const el = sections[idx];
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const absoluteTop = rect.top + window.scrollY;
    const offset = headerH || 0;

    window.scrollTo({
      top: absoluteTop - offset,
      behavior: "smooth",
    });
  };

  // Highlight section that is currently in view (regular scrolling, no snapping)
  useEffect(() => {
    const handleScroll = () => {
      const sections = sectionRefs.current.filter(Boolean);
      if (!sections.length) return;

      const scrollPosition = window.scrollY + (headerH || 0) + 1;

      let activeIndex = 0;
      sections.forEach((section, i) => {
        const top = section.offsetTop;
        const height = section.offsetHeight || 1;
        if (scrollPosition >= top && scrollPosition < top + height) {
          activeIndex = i;
        }
      });

      setCurrent(activeIndex);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // initial sync
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [headerH]);

  // Sections should NOT be full-screen anymore – only as tall as content,
  // but still padded down so they don't hide behind the fixed header.
  const sectionStyleBase = useMemo(
    () => ({
      boxSizing: "border-box",
    }),
    [headerH]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Fixed header */}
      <div
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-[9999] border-b border-slate-200 bg-white/80 backdrop-blur transition-transform duration-300"
      >
        <Header />
      </div>

      {/* Left-side section panel (responsive) */}
      <nav
        className="hidden md:flex fixed left-3 md:left-6 top-1/2 -translate-y-1/2 z-[40] flex-col items-center gap-3 md:gap-4 px-2 py-3"
        aria-label="Page sections"
      >
        {/* UP ARROW */}
        <button
          type="button"
          aria-label="Scroll to previous section"
          onClick={() => {
            const prevIndex = Math.max(0, current - 1);
            if (prevIndex !== current) scrollToSection(prevIndex);
          }}
          className={`w-8 h-8 flex items-center justify-center text-xs font-bold transition-all ${
            current <= 0
              ? "opacity-40 cursor-default"
              : "opacity-80 hover:opacity-100"
          }`}
        >
          ▲
        </button>

        {/* SECTION LABELS */}
        <div className="flex flex-col gap-2">
          {navSections.map((section) => {
            const isActive = current === section.index;
            const label = compactNav ? section.label.slice(0, 1) : section.label;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.index)}
                className={`text-base font-semibold tracking-[0.25em] uppercase text-left transition-colors ${
                  isActive
                    ? "text-[var(--accent)]"
                    : "text-slate-400 hover:text-slate-100"
                }`}
                title={section.label}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* DOWN ARROW */}
        <button
          type="button"
          aria-label="Scroll to next section"
          onClick={() => {
            const maxIndex =
              navSections[navSections.length - 1]?.index ?? current;
            const nextIndex = Math.min(maxIndex, current + 1);
            if (nextIndex !== current) scrollToSection(nextIndex);
          }}
          className={`w-8 h-8 flex items-center justify-center text-xs font-bold transition-all ${
            current >= (navSections[navSections.length - 1]?.index ?? current)
              ? "opacity-40 cursor-default"
              : "opacity-80 hover:opacity-100"
          } animate-bounce`}
        >
          ▼
        </button>
      </nav>

      <main className="flex-1 flex flex-col">
        {/* Section 0: Hero + Builder */}
        <section
          ref={(el) => setSectionRef(el, 0)}
          className="flex w-full justify-center bg-[var(--bg)]"
          style={{
            ...sectionStyleBase,
            paddingTop: `${headerH}px`,
            background:
              "radial-gradient(900px circle at 12% 0%, rgba(202,163,74,0.18), transparent 50%), linear-gradient(180deg, #f2ead8 0%, #f7f3eb 65%, #f7f3eb 100%)",
          }}
        >
          <div
            className="w-[95%] md:w-[80%] mx-auto flex flex-col pt-8 pb-0"
            style={{ gap: "6rem" }}
          >
            <HeroSection />
            <div
              className="mx-auto"
              style={{
                transform: "scale(0.85)",
                transformOrigin: "top center",
              }}
            >
              <BuilderSection keepAssets={keepAssets} />
            </div>
          </div>
        </section>

        {/* Section 1: Mission */}
        <section
          ref={(el) => setSectionRef(el, 1)}
          className="flex w-full justify-center bg-[var(--bg)]"
          style={sectionStyleBase}
        >
          <div className="w-[95%] md:w-[80%] mx-auto flex flex-col gap-4 md:gap-6 pt-0 pb-10 -mt-6 md:-mt-8">
            <Carousel />
            <div className="mt-16 md:mt-20 mb-16 md:mb-20 px-2">
              <MissionStatement />
            </div>
          </div>
        </section>

        {/* Section 2: Roadmap */}
        <section
          ref={(el) => setSectionRef(el, 2)}
          className="flex w-full justify-center bg-[var(--bg)]"
          style={sectionStyleBase}
        >
          <div className="w-[95%] md:w-[75%] mx-auto flex flex-col gap-6 md:gap-8">
            <Roadmap />
          </div>
        </section>

        {/* Section 3: Get paid */}
        <section
          ref={(el) => setSectionRef(el, 3)}
          className="flex w-full justify-center bg-[var(--bg)]"
          style={{
            ...sectionStyleBase,
            minHeight: headerH ? `calc(100vh - ${headerH}px)` : "100vh",
          }}
        >
          <div className={`${sharedSectionInner} justify-center gap-6 md:gap-10 py-8 md:py-12`}>
            <PaidSection />
          </div>
        </section>

        {/* Section 4: Live */}
        <section
          ref={(el) => setSectionRef(el, 4)}
          className="flex w-full justify-center bg-[var(--bg)]"
          style={sectionStyleBase}
        >
          <div className="w-[95%] md:w-[80%] mx-auto flex flex-col justify-center gap-6 md:gap-8 py-8 md:py-8">
            <LiveSection />
          </div>
        </section>

        {/* Section 5: Love */}
        <section
          ref={(el) => setSectionRef(el, 5)}
          className="flex w-full justify-center bg-[var(--bg)]"
          style={{
            ...sectionStyleBase,
            minHeight: headerH ? `calc(100vh - ${headerH}px)` : "100vh",
          }}
        >
          <div className={`${sharedSectionInner} justify-center gap-6 md:gap-10 py-8 md:py-12`}>
            <LoveSection />
          </div>
        </section>

        {/* Share row above footer */}
        <div className="flex w-full justify-center bg-[var(--bg)] pb-10">
          <div className="sona-container flex flex-col items-center gap-3">
            <div className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">Share Sona</div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={xUrl}
                target="_blank"
                rel="noreferrer"
                className="cta-btn cta-white no-underline"
                aria-label="Share on X"
              >
                Share on X
              </a>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noreferrer"
                className="cta-btn cta-white no-underline"
                aria-label="Share on Telegram"
              >
                Telegram
              </a>
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="cta-btn cta-white no-underline"
                aria-label="Share on LinkedIn"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      <SignInModal />
    </div>
  );
}
