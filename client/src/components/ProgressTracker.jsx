import { useEffect, useState, useRef } from "react";
import { useInView } from "../hooks/useReveal";
import { formatINR } from "../content";

const API_BASE = import.meta.env.VITE_API_URL || "https://nityasevaserver.iskconjiasarai.com";

const TARGET_AMOUNT = 155000;

function AnimatedNumber({ value, visible, format, duration = 1400 }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    let frame;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, value, duration]);

  return <>{format ? format(display) : display}</>;
}

export default function ProgressTracker() {
  const [stats, setStats] = useState({ totalPledged: 0, totalSewaks: 0 });
  const [loaded, setLoaded] = useState(false);
  const [ref, inView] = useInView({ threshold: 0.2 });
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetch(`${API_BASE}/api/stats`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStats({ totalPledged: d.totalPledged, totalSewaks: d.totalSewaks });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const visible = loaded && inView;

  const pct = stats.totalPledged
    ? Math.min((stats.totalPledged / TARGET_AMOUNT) * 100, 100)
    : 0;

  return (
    <section className="tracker-section" ref={ref}>
      <div className="container">
        <div className={`tracker-card${visible ? " visible" : ""}`}>
          <div className="tracker-top">
            <p className="eyebrow">Live progress</p>
            <h2>{formatINR(TARGET_AMOUNT)} a month keeps the Lord's Sankirtan Movement going</h2>
          </div>

          <div className="tracker-body">
            <div className="tracker-bars">
              <div className="tracker-amounts">
                <span className="tracker-raised">
                  <AnimatedNumber value={stats.totalPledged} visible={visible} format={formatINR} />
                </span>
                <span className="tracker-target">of {formatINR(TARGET_AMOUNT)}</span>
              </div>
              <div className="tracker-bar-bg">
                <div
                  className={`tracker-bar-fill${visible ? " animate" : ""}`}
                  style={{ "--pct": `${pct}%` }}
                />
              </div>
              <span className="tracker-pct">
                <AnimatedNumber value={Math.round(pct)} visible={visible} />% reached
              </span>
            </div>

            <div className="tracker-sevaks">
              <span className="tracker-sevak-count">
                <AnimatedNumber value={stats.totalSewaks} visible={visible} />
              </span>
              <span className="tracker-sevak-label">Nitya Sevaks</span>
            </div>
          </div>

          <a className="tracker-cta" href="#seva-form">
            Join them <span className="arrow" aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
