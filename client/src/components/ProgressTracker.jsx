import { useEffect, useState, useRef } from "react";
import { useInView } from "../hooks/useReveal";
import { formatINR } from "../content";

const API_BASE = import.meta.env.VITE_API_URL || "https://nityasevaserver.iskconjiasarai.com";

const TARGET_AMOUNT = 145000;

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

function TrackerBar({ label, current, target, format, visible, delay = 0 }) {
  const pct = Math.min((current / target) * 100, 100);

  return (
    <div className="tracker-item" style={{ "--delay": `${delay}ms` }}>
      <div className="tracker-header">
        <span className="tracker-label">{label}</span>
        <span className="tracker-value">
          <AnimatedNumber value={current} visible={visible} format={format} />{" "}
          <span className="tracker-of">of {format ? format(target) : target}</span>
        </span>
      </div>
      <div className="tracker-bar-bg">
        <div
          className={`tracker-bar-fill${visible ? " animate" : ""}`}
          style={{ "--pct": `${pct}%` }}
        />
      </div>
      <div className="tracker-foot">
        <span>
          <AnimatedNumber value={Math.round(pct)} visible={visible} />% of the monthly need
        </span>
        {current < target && <span>{format ? format(target - current) : target - current} still needed</span>}
      </div>
    </div>
  );
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

  return (
    <section className="tracker-section" ref={ref}>
      <div className="container">
        <div className={`tracker-card${visible ? " visible" : ""}`}>
          <div className="tracker-heading">
            <p className="eyebrow">Live · This month's seva</p>
            <h2>{formatINR(TARGET_AMOUNT)} a month keeps the Lord's home running</h2>
            <p className="tracker-sub">
              Deity worship, the hall, kirtans, prasadam and preaching. Every pledge brings us closer.
            </p>
          </div>
          <div className="tracker-bars">
            <TrackerBar
              label="Pledged so far"
              current={stats.totalPledged}
              target={TARGET_AMOUNT}
              format={formatINR}
              visible={visible}
            />
          </div>
          <div className="tracker-sevaks">
            <span className="tracker-sevak-count">
              <AnimatedNumber value={stats.totalSewaks} visible={visible} />
            </span>
            <span className="tracker-sevak-label">
              {stats.totalSewaks === 1 ? "Nitya Sevak has pledged" : "Nitya Sevaks have pledged"}
            </span>
            <a className="tracker-join" href="#seva-form">Be the next <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </div>
    </section>
  );
}
