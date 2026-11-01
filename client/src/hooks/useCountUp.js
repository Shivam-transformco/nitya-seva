import { useEffect, useState } from "react";

// Animates the numeric part of a label like "1,000+" from 0 once `start` is true.
export default function useCountUp(label, start, duration = 1600) {
  const match = String(label).match(/^(\D*)([\d,]+)(.*)$/);
  const target = match ? Number(match[2].replace(/,/g, "")) : 0;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start || !match) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, target, duration]);

  if (!match) return label;
  return `${match[1]}${value.toLocaleString("en-IN")}${match[3]}`;
}
