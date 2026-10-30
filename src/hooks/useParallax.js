import { useEffect } from "react";

// Moves every [data-parallax] element relative to its section's distance from the viewport centre.
// Uses the `translate` property so it composes with transform-based animations and hovers.
export default function useParallax() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let items = [];
    const collect = () => {
      items = Array.from(document.querySelectorAll("[data-parallax]")).map((el) => ({
        el,
        factor: Number(el.dataset.parallax) || 0,
        anchor: el.closest("section") || el.parentElement,
      }));
    };

    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight;
      for (const { el, factor, anchor } of items) {
        const r = anchor.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const offset = r.top + r.height / 2 - vh / 2;
        el.style.translate = `0 ${(-offset * factor).toFixed(1)}px`;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      collect();
      schedule();
    };

    collect();
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
