import { useEffect, useState, useRef } from "react";
import { useInView } from "../hooks/useReveal";
import { formatINR } from "../content";

const API_BASE = import.meta.env.VITE_API_URL || "https://nityasevaserver.iskconjiasarai.com";

// Used until /api/stats answers; admins set the real goal in the staff portal.
const DEFAULT_TARGET = 155000;

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
  const [stats, setStats] = useState({ totalPledged: 0, totalSewaks: 0, target: DEFAULT_TARGET });
  const [loaded, setLoaded] = useState(false);
  const [ref, inView] = useInView({ threshold: 0.2 });
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetch(`${API_BASE}/api/stats`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStats({ totalPledged: d.totalPledged, totalSewaks: d.totalSewaks, target: d.target || DEFAULT_TARGET });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const visible = loaded && inView;

  const pct = stats.totalPledged
    ? Math.min((stats.totalPledged / stats.target) * 100, 100)
    : 0;

  const remaining = Math.max(stats.target - stats.totalPledged, 0);

  return (
    <section className="tracker-section" ref={ref}>
      <div className="container">
        <div className={`tracker-card${visible ? " visible" : ""}`}>
          <span className="tracker-badge">Live progress</span>

          <h2 className="tracker-title">
            Keep the Sankirtan Movement Growing.
          </h2>

          <p className="tracker-raised">
            <AnimatedNumber value={stats.totalPledged} visible={visible} format={formatINR} />
          </p>
          <p className="tracker-sub">
            Raised of {formatINR(stats.target)}
          </p>

          <div className="tracker-bar-bg">
            <div
              className={`tracker-bar-fill${visible ? " animate" : ""}`}
              style={{ "--pct": `${pct}%` }}
            />
          </div>

          <div className="tracker-stats">
            <span className="tracker-stat-left">
              <AnimatedNumber value={Math.round(pct)} visible={visible} />% achieved
            </span>
            <span className="tracker-stat-right">
              {formatINR(remaining)} to go
            </span>
          </div>

          <div className="tracker-sevaks">
            <span className="tracker-sevak-count">
              <AnimatedNumber value={stats.totalSewaks} visible={visible} />
            </span>
            <span className="tracker-sevak-label">Nitya Sevaks</span>
          </div>

          <a className="btn tracker-cta" href="#seva-form">
            Become a Nitya Sevak <span className="arrow" aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
