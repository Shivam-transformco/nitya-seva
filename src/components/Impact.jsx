import useReveal from "../hooks/useReveal";
import config from "../config";

function Stat({ value, label }) {
  const [ref, revealClass] = useReveal();
  return (
    <div ref={ref} className={`stat ${revealClass}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function Impact() {
  return (
    <section className="impact">
      <div className="container">
        <h2 className="center light">What your seva has already made possible</h2>
        <div className="stats">
          {config.stats.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}
