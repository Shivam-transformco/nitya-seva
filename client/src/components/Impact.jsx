import useReveal from "../hooks/useReveal";
import useCountUp from "../hooks/useCountUp";
import config from "../config";
import { imageSrc } from "../lib/assets";
import SectionHead from "./SectionHead";

function Stat({ value, label, index }) {
  const [ref, revealClass, visible] = useReveal();
  const shown = useCountUp(value, visible);
  return (
    <div ref={ref} className={`stat ${revealClass}`} style={{ "--d": `${index * 110}ms` }}>
      <strong>{shown}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function Impact() {
  return (
    <section className="impact">
      <img className="impact-bg" data-parallax="0.18" src={imageSrc("ratha-yatra.webp")} alt="" loading="lazy" />
      <div className="container">
        <SectionHead align="split" eyebrow="Impact" title="What your seva has already made possible" />
        <div className="stats">
          {config.stats.map((s, i) => (
            <Stat key={s.label} index={i} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}
