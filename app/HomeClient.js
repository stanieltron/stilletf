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

  // === keepAssets logic ===
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!search) return;

    const authParam = search.get("auth") === "1";
    const shareParam = search.get("share") === "1";
    const afterAuth = cameFromSignupOrAuth();
    const reload = isReloadNavigation();

    // Hard reload should *always* be a fresh experience (no assets kept),
    // unless we're explicitly coming back from auth or a share flow.
    if (reload && !afterAuth) {
      if (!(shareParam || authParam)) {
        setKeepAssets(false);
        return;
      }
    }

    // Returning flows (auth return or share return) keep assets and skip "first fill" behavior.
    setKeepAssets(afterAuth || shareParam || authParam);
  }, [search]);

  /* ===== sticky header height for layout ===== */
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(".site-header");
      setHeaderH(el ? el.offsetHeight || 0 : 0);
    };

    measure();
    window.addEventListener("resize", measure, { passive: true });
    const id = setTimeout(measure, 0);

    return () => {
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

  // Highlight section that is currently in view
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

  // Sections padded so they don't hide behind the fixed header
  const sectionStyleBase = useMemo(
    () => ({
      paddingTop: `${headerH}px`,
      boxSizing: "border-box",
    }),
    [headerH]
  );

  return (
    <div className="page-shell">
      <Header />

      
      {/* Left-side section panel */}
      <nav className="side-rail" aria-label="Page sections">
        <button
          type="button"
          aria-label="Scroll to previous section"
          onClick={() => {
            const prevIndex = Math.max(0, current - 1);
            if (prevIndex !== current) scrollToSection(prevIndex);
          }}
          className="rail-arrow"
          disabled={current <= 0}
        >
          ↑
        </button>

        <div className="rail-nav">
          {navSections.map((section) => {
            const isActive = current === section.index;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.index)}
                className={`rail-button${isActive ? " is-active" : ""}`}
              >
                {section.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Scroll to next section"
          onClick={() => {
            const maxIndex =
              navSections[navSections.length - 1]?.index ?? current;
            const nextIndex = Math.min(maxIndex, current + 1);
            if (nextIndex !== current) scrollToSection(nextIndex);
          }}
          className="rail-arrow"
          disabled={
            current >= (navSections[navSections.length - 1]?.index ?? current)
          }
        >
          ↓
        </button>
      </nav>

      <main className="page-main">
        <section ref={(el) => setSectionRef(el, 0)} style={sectionStyleBase}>
          <HeroSection />
          <BuilderSection keepAssets={keepAssets} />
        </section>

        <section
          ref={(el) => setSectionRef(el, 1)}
          style={{
            ...sectionStyleBase,
            background: "#eef2ff",
          }}
        >
          <div
            className="container-main"
            style={{ display: "grid", gap: 32, padding: "64px 0" }}
          >
            <Carousel />
            <MissionStatement />
          </div>
        </section>

        <section
          ref={(el) => setSectionRef(el, 2)}
          style={{
            ...sectionStyleBase,
            background: "#fff7ed",
          }}
        >
          <div
            className="container-main"
            style={{ display: "grid", gap: 32, padding: "64px 0" }}
          >
            <Roadmap />
          </div>
        </section>

        <section
          ref={(el) => setSectionRef(el, 3)}
          style={{
            ...sectionStyleBase,
            background: "#fff7ed",
          }}
        >
          <div
            className="container-main"
            style={{ display: "grid", gap: 32, padding: "64px 0" }}
          >
            <Features />
          </div>
        </section>

        <section
          ref={(el) => setSectionRef(el, 4)}
          style={{
            ...sectionStyleBase,
            background: "#fff7ed",
          }}
        >
          <div
            className="container-main"
            style={{ display: "grid", gap: 32, padding: "64px 0" }}
          >
            <Benefits />
            <Footer />
          </div>
        </section>
      </main>

      <SignInModal />
    </div>
  );
}


