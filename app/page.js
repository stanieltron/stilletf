"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SignInModal from "./components/SignInModal";
import HeroSection from "./components/HeroSection";
import BuilderSection from "./components/BuilderSection";
import Intro from "./components/Intro";
import MissionStatement from "./components/MissionStatement";
import Roadmap from "./components/Roadmap";
import Features from "./components/Features";
import Benefits from "./components/Benefits";

/* ===========================
   SCROLL / INTRO MODES
   1 = intro + section snapping everywhere
   2 = intro + snapping only Intro → Hero, then normal scroll
   3 = no intro, section snapping everywhere
   4 = no intro, normal scroll only
   =========================== */
const SCROLL_MODE = 1; // <<< change this between 1–4

const INTRO_ENABLED = SCROLL_MODE === 1 || SCROLL_MODE === 2;
const SECTION_SNAP_ALWAYS = SCROLL_MODE === 1 || SCROLL_MODE === 3;
const SECTION_SNAP_ONLY_WHILE_INTRO = SCROLL_MODE === 2;

/* --- helpers to detect reload/auth return (kept for keepAssets logic) --- */
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

export default function Page() {
  const search = useSearchParams();

  // default to "fresh" – only later turn true if we detect a returning flow
  const [keepAssets, setKeepAssets] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!search) return;

    const skipIntroParam = search.get("skipIntro") === "1";
    const afterAuth = cameFromSignupOrAuth();
    const reload = isReloadNavigation();

    // Hard reload should *always* be a fresh experience (no assets kept),
    // unless we're explicitly coming back from auth.
    if (reload && !afterAuth) {
      setKeepAssets(false);
      return;
    }

    // Returning flows (internal navigation with skipIntro=1 or auth return)
    // keep assets and skip "first fill" behavior.
    setKeepAssets(skipIntroParam || afterAuth);
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
    } catch {}
    window.addEventListener("resize", measure, { passive: true });
    const id = setTimeout(measure, 0);
    return () => {
      if (ro && ro.disconnect) ro.disconnect();
      window.removeEventListener("resize", measure);
      clearTimeout(id);
    };
  }, []);

  /* ===== Intro visibility & one-time removal per session ===== */
  const [showIntro, setShowIntro] = useState(INTRO_ENABLED);

  useEffect(() => {
    // If intro mode is off, never show Intro
    if (!INTRO_ENABLED) {
      setShowIntro(false);
      return;
    }

    if (!search) return;

    const skip = search.get("skipIntro") === "1";
    let afterAuth = false;
    let reload = false;

    if (typeof window !== "undefined") {
      afterAuth = cameFromSignupOrAuth();
      reload = isReloadNavigation();
    }

    // Cases where intro should be gone:
    // - explicit skipIntro=1 (from in-app navigation), but *not* on hard reload
    // - came back from auth / signin
    if ((skip && !reload) || afterAuth) {
      setShowIntro(false);
    } else {
      // Fresh visit / hard reload → intro visible again
      setShowIntro(true);
    }
  }, [search]);

  /* ===== Jump-scroll state & animation controller ===== */
  const sectionRefs = useRef([]);
  const setSectionRef = (el, i) => (sectionRefs.current[i] = el);

  const [current, setCurrent] = useState(0); // last committed index
  const targetIndexRef = useRef(null);
  const duration = 2000; // ms

  const anim = useRef({
    raf: null,
    start: 0,
    from: 0,
    to: 0,
    dur: duration,
    cancelFlag: false,
  });
  const active = () => anim.current.raf !== null;
  const elapsed = () => performance.now() - anim.current.start;
  const secondHalf = () => active() && elapsed() >= anim.current.dur / 2;
  const cancelAnim = () => (anim.current.cancelFlag = true);

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const getSections = () => sectionRefs.current.filter(Boolean);
  const getIndexClamp = (idx) =>
    Math.max(0, Math.min(getSections().length - 1, idx));
  const getTop = (idx) => {
    const els = getSections();
    const el = els[idx];
    if (!el) return 0;
    return Math.max(0, el.offsetTop);
  };

  const syncFromScroll = () => {
    const y = window.scrollY;
    const els = getSections();
    let nearest = 0,
      best = Infinity;
    els.forEach((s, i) => {
      const d = Math.abs((s?.offsetTop || 0) - y);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setCurrent(nearest);
  };

  const startAnim = (toY, onDone) => {
    const a = anim.current;
    a.start = performance.now();
    a.from = window.scrollY || document.documentElement.scrollTop;
    a.to = toY;
    a.dur = duration;
    a.cancelFlag = false;
    const delta = a.to - a.from;
    const tick = (now) => {
      if (a.cancelFlag) {
        cancelAnimationFrame(a.raf);
        a.raf = null;
        onDone?.("cancelled");
        return;
      }
      const t = Math.min(1, (now - a.start) / a.dur);
      const eased = easeOutCubic(t);
      window.scrollTo(0, a.from + delta * eased);
      if (t < 1) {
        a.raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(a.raf);
        a.raf = null;
        onDone?.("finished");
      }
    };
    a.raf = requestAnimationFrame(tick);
  };

  const removeIntroIfNeeded = (reachedIdx) => {
    // Intro is at index 0 when shown; remove once we land on index >= 1
    if (showIntro && reachedIdx >= 1) {
      setShowIntro(false);
      // After render, indices shift down by one; align scroll to the same logical page
      requestAnimationFrame(() => {
        const newIndex = Math.max(0, reachedIdx - 1);
        setCurrent(newIndex);
        const top = getTop(newIndex);
        window.scrollTo(0, top);
      });
    }
  };

  const goTo = (index) => {
    const idx = getIndexClamp(index);
    if (idx === current && !active()) return;
    targetIndexRef.current = idx;
    const top = getTop(idx);
    startAnim(top, (state) => {
      if (state === "finished" || secondHalf()) {
        setCurrent(targetIndexRef.current);
        removeIntroIfNeeded(targetIndexRef.current);
      }
    });
  };

  const maybeInterruptAndGo = (dir /* +1 or -1 */) => {
    // Determine if we should do snapping based on mode
    const snappingActive =
      SECTION_SNAP_ALWAYS || (SECTION_SNAP_ONLY_WHILE_INTRO && showIntro);

    if (!snappingActive) return;

    if (!active()) {
      goTo(current + dir);
      return;
    }
    if (!secondHalf()) return; // ignore in the first half to avoid jitter

    // Snap to in-flight target and then start the next movement
    cancelAnim();
    const idx = targetIndexRef.current ?? current;
    const snapTop = getTop(idx);
    window.scrollTo(0, snapTop);
    setCurrent(idx);
    removeIntroIfNeeded(idx);
    goTo(idx + dir);
  };

  // Global listeners for wheel/keys/touch
  useEffect(() => {
    const snappingActive =
      SECTION_SNAP_ALWAYS || (SECTION_SNAP_ONLY_WHILE_INTRO && showIntro);

const onWheel = (e) => {
  // Allow native scrolling inside locally scrollable panes (e.g. Builder left pane)
  if (e.target && e.target.closest?.(".local-scroll-container")) {
    // Do nothing: no preventDefault, let the inner div handle scroll
    return;
  }

  if (!snappingActive) return; // normal page scroll for everything else
  const dy = e.deltaY || e.wheelDelta || 0;
  if (!dy) return;
  e.preventDefault();
  if (dy > 0) maybeInterruptAndGo(+1);
  else if (dy < 0) maybeInterruptAndGo(-1);
};


    const onKey = (e) => {
      if (!snappingActive) return; // let keys behave normally
      const next = ["ArrowDown", "PageDown", "Space"];
      const prev = ["ArrowUp", "PageUp"];
      if (next.includes(e.code)) {
        e.preventDefault();
        maybeInterruptAndGo(+1);
      } else if (prev.includes(e.code)) {
        e.preventDefault();
        maybeInterruptAndGo(-1);
      } else if (e.code === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.code === "End") {
        e.preventDefault();
        goTo(getSections().length - 1);
      }
    };

    let touchStartY = null;
    let touchInLocal = false; // NEW
    const THRESHOLD = 50;

const onTouchStart = (e) => {
  if (e.touches && e.touches.length) touchStartY = e.touches[0].clientY;
  const target = e.target;
  touchInLocal = !!target?.closest?.(".local-scroll-container"); // NEW
};

const onTouchMove = (e) => {
  // Allow normal touch scroll inside local scroll areas
  if (touchInLocal) return;

  if (!snappingActive) return; // allow normal touch scroll
  e.preventDefault();
};

const onTouchEnd = (e) => {
  // If in local scroll area, don't do snapping
  if (touchInLocal) {
    touchInLocal = false;
    touchStartY = null;
    return;
  }

  if (!snappingActive) return;
  if (touchStartY == null) return;
  const endY =
    e.changedTouches && e.changedTouches[0]
      ? e.changedTouches[0].clientY
      : touchStartY;
  const delta = endY - touchStartY;
  if (Math.abs(delta) > THRESHOLD) {
    if (delta < 0) maybeInterruptAndGo(+1);
    else maybeInterruptAndGo(-1);
  } else {
    syncFromScroll();
  }
  touchStartY = null;
};


    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [current, showIntro]);

  // Keep current in sync on resize and on mount
  useEffect(() => {
    // Only enforce “section positioning” when snapping is globally on
    if (!(SCROLL_MODE === 1 || SCROLL_MODE === 3)) {
      // For modes 2 & 4 (normal scroll), we only sync current on mount
      requestAnimationFrame(syncFromScroll);
      return;
    }

    const onResize = () => {
      const top = getTop(current);
      window.scrollTo({ top });
    };
    window.addEventListener("resize", onResize, { passive: true });
    requestAnimationFrame(syncFromScroll);
    return () => window.removeEventListener("resize", onResize);
  }, [current, showIntro]);

  /* ===== header visibility =====
     - Hidden while Intro is visible
     - Visible from Hero onwards (or when Intro is disabled)
  */
  const showHeader = useMemo(() => !showIntro, [showIntro]);

  const navSections = useMemo(
    () => [
      { id: "hero", label: "Builder", index: showIntro ? 1 : 0 },
      { id: "mission", label: "Mission", index: showIntro ? 2 : 1 },
      { id: "roadmap", label: "Roadmap", index: showIntro ? 3 : 2 },
      { id: "features", label: "Features", index: showIntro ? 4 : 3 },
      { id: "benefits", label: "Benefits", index: showIntro ? 5 : 4 },
    ],
    [showIntro]
  );

  // Section styles:
  // - Intro is a full viewport, no header padding.
  // - Other pages: 100vh with top padding equal to header height.
  const sectionStyleIntro = useMemo(() => ({ height: `100vh` }), []);

  const sectionStylePage = useMemo(
    () => ({
      height: `100vh`,
      paddingTop: `${headerH}px`,
      boxSizing: "border-box",
    }),
    [headerH]
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed header that appears starting with page 1 */}
      <div
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-[9999] border-b...er]:bg-white/60 bg-white/80 transition-transform duration-300 ${
          showHeader ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <Header />
      </div>

      {/* Left-side section panel (appears only after Intro, same as header) */}
{showHeader && (
  <nav
    className="hidden md:flex fixed left-6 top-1/2 -translate-y-1/2 z-[9998] flex-col items-center gap-4"
    aria-label="Page sections"
  >
    {/* UP ARROW */}
    <button
      type="button"
      aria-label="Scroll to previous section"
      onClick={() => {
        const minIndex = navSections[0]?.index ?? 0;
        const prevIndex = Math.max(minIndex, current - 1);
        if (prevIndex !== current) goTo(prevIndex);
      }}
      className={`w-8 h-8 flex items-center justify-center text-xs font-bold transition-all ${
        current <= (navSections[0]?.index ?? 0)
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
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => goTo(section.index)}
            className={`text-base font-semibold tracking-[0.25em] uppercase text-left transition-colors ${
              isActive
                ? "text-blue-600"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            {section.label}
          </button>
        );
      })}
    </div>

    {/* DOWN ARROW */}
    <button
      type="button"
      aria-label="Scroll to next section"
      onClick={() => {
        const maxIndex = navSections[navSections.length - 1]?.index ?? current;
        const nextIndex = Math.min(maxIndex, current + 1);
        if (nextIndex !== current) goTo(nextIndex);
      }}
      className={`w-8 h-8 flex items-center justify-center  text-xs font-bold transition-all ${
        current >= (navSections[navSections.length - 1]?.index ?? current)
          ? "opacity-40 cursor-default"
          : "opacity-80 hover:opacity-100"
      } animate-bounce`}
    >
      ▼
    </button>
  </nav>
)}


      <main className="flex-1 flex flex-col">

        {/* Intro (first page). Clicking enter hides it (will also be auto-removed once you reach next page). */}
        {showIntro && (
          <section
            ref={(el) => setSectionRef(el, 0)}
            className="flex w-full items-center justify-center"
            style={{ ...sectionStyleIntro, background: "#0b0b0b" }}
          >
            <Intro
              onEnter={() => {
                // Manual “Intro → Hero” jump: hide intro, then scroll to first page (Hero)
                setShowIntro(false);
                requestAnimationFrame(() => {
                  const top = getTop(0); // Hero becomes index 0 after intro removal
                  window.scrollTo(0, top);
                  setCurrent(0);
                });
              }}
            />
          </section>
        )}

        {/* Page 1 (Hero + Builder stacked in 80% container) */}
        <section
          ref={(el) => setSectionRef(el, showIntro ? 1 : 0)}
          className="flex w-full justify-center"
          style={{
            ...sectionStylePage,
            height: "auto", // override the 100vh here
            minHeight: "100vh",
           
          }}
        >
          <div className="w-[80%] mx-auto flex flex-col gap-10 py-10">
            <HeroSection />
            <BuilderSection keepAssets={keepAssets} />
          </div>
        </section>

        {/* Page 2 (Mission) */}
        <section
          ref={(el) => setSectionRef(el, showIntro ? 2 : 1)}
          className="flex w-full justify-center"
          style={{
            ...sectionStylePage,
            height: "auto",
            minHeight: "100vh",
            background: "#eef2ff",
          }}
        >
          <div className="w-[80%] mx-auto flex flex-col gap-10 py-10">
            <MissionStatement />
          </div>
        </section>

        {/* Page 3 (Roadmap) */}
        <section
          ref={(el) => setSectionRef(el, showIntro ? 3 : 2)}
          className="flex w-full justify-center"
          style={{
            ...sectionStylePage,
            height: "auto",
            minHeight: "100vh",
            background: "#fff7ed",
          }}
        >
          <div className="w-[80%] mx-auto flex flex-col gap-10 py-10">
            <Roadmap />
          </div>
        </section>

        {/* Page 4 (Features) */}
        <section
          ref={(el) => setSectionRef(el, showIntro ? 4 : 3)}
          className="flex w-full justifycenter"
          style={{
            ...sectionStylePage,
            height: "auto",
            minHeight: "100vh",
            background: "#fff7ed",
          }}
        >
          <div className="w-[80%] mx-auto flex flex-col gap-10 py-10">
            <Features />
          </div>
        </section>

        {/* Page 5 (Benefits) */}
        <section
          ref={(el) => setSectionRef(el, showIntro ? 5 : 4)}
          className="flex w-full justify-center"
          style={{
            ...sectionStylePage,
            height: "auto",
            minHeight: "100vh",
            background: "#fff7ed",
          }}
        >
          <div className="w-[80%] mx-auto flex flex-col gap-10 py-10">
            <Benefits />
            <Footer />
          </div>
        </section>
      </main>

      <SignInModal />
    </div>
  );
}
