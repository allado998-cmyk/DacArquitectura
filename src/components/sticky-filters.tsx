"use client";

import { useEffect, useRef, useState } from "react";

// The filter bar of a long table: it stays at the top of the screen while the
// page scrolls (from tablet width up; on a phone it would cover half the screen)
// and tells the table's sticky header (.table-sticky) how far down to stick,
// right below it. Used by «Base de Dades» (Clients, Contactes) and «Càlculs».
export function StickyFilters({ children, className = "items-end" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const panel = el?.parentElement;
    if (!el || !panel) return;
    const update = () => {
      const pinned = getComputedStyle(el).position === "sticky";
      panel.style.setProperty("--sticky-top", pinned ? `${el.offsetHeight}px` : "0px");
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return <div ref={ref} className={`sticky-filters flex flex-wrap gap-3 ${className}`}>{children}</div>;
}

// Appears once the page has scrolled past the first rows.
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      className="fixed bottom-6 right-6 z-40 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-lg hover:opacity-90"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      ↑ Tornar a dalt
    </button>
  );
}
