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
import Features from "./components/Features";
import Benefits from "./components/Benefits";
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

  // default to "fresh" – only later turn true if we detect a returning flow
  const [keepAssets, setKeepAssets] = useState(false);

  // === keepAssets logic, unchanged ===
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!search) return;

    const shareParam = search.get("share") === "1";
    const afterAuth = cameFromSignupOrAuth();
    const reload = isReloadNavigation();

    // Hard reload should *always* be a fresh experience (no assets kept),
    // unless we're explicitly coming back from auth or a share flow.
    if (reload && !afterAuth) {
      if (!shareParam) {
        setKeepAssets(false);
        return;
      }
    }

    // Returning flows (auth return or share return)
    // keep assets and skip "first fill" behavior.
    setKeepAssets(afterAuth || shareParam);
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
      { id: "features", label: "Features", index: 3 },
      { id: "benefits", label: "Benefits", index: 4 },
    ],
    []
  );

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
    <div className="min-h-screen flex flex-col">
      {/* Fixed header */}
      <div
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-[9999] border-b border-slate-200 bg-white/80 backdrop-blur transition-transform duration-300"
      >
        <Header />
      </div>

      {/* Left-side section panel (responsive) */}
      <nav
        className="hidden md:flex fixed left-3 md:left-6 top-1/2 -translate-y-1/2 z-[9998] flex-col items-center gap-3 md:gap-4 bg-white/80 backdrop-blur-md rounded-md px-2 py-3 shadow-sm border-0"
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
                    ? "text-blue-600"
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
          className="flex w-full justify-center"
          style={{
            ...sectionStyleBase,
            paddingTop: `${headerH}px`,
          }}
        >
          <div className="w-[95%] md:w-[80%] mx-auto flex flex-col gap-10 py-10">
            <HeroSection />
            <BuilderSection keepAssets={keepAssets} />
          </div>
        </section>

        {/* Section 1: Mission */}
        <section
          ref={(el) => setSectionRef(el, 1)}
          className="flex w-full justify-center"
          style={{
            ...sectionStyleBase,
            background: "#ffffffff",
          }}
        >
          <div className="w-[95%] md:w-[80%] mx-auto flex flex-col gap-10 py-10">
            <Carousel />
            <MissionStatement />
          </div>
        </section>

        {/* Section 2: Roadmap */}
        <section
          ref={(el) => setSectionRef(el, 2)}
          className="flex w-full justify-center"
          style={{
            ...sectionStyleBase,
            background: "#ffffffff",
          }}
        >
          <div className="w-[95%] md:w-[80%] mx-auto flex flex-col gap-10 py-10">
            <Roadmap />
          </div>
        </section>

        {/* Section 3: Features */}
        <section
          ref={(el) => setSectionRef(el, 3)}
          className="flex w-full justify-center"
          style={{
            ...sectionStyleBase,
            background: "#000000ff",
          }}
        >
          <div className="w-[95%] md:w-[80%] mx-auto flex flex-col gap-10 py-10">
            <Features />
          </div>
        </section>

        {/* Section 4: Benefits */}
        <section
          ref={(el) => setSectionRef(el, 4)}
          className="flex w-full justify-center"
          style={{
            ...sectionStyleBase,
            background: "#ffffffff",
          }}
        >
          <div className="w-[95%] md:w-[80%] mx-auto flex flex-col gap-10 py-10">
            <Benefits />
            <Footer />
          </div>
        </section>
      </main>

      <SignInModal />
    </div>
  );
}
