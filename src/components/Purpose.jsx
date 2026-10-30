import useReveal from "../hooks/useReveal";
import { purposes } from "../content";
import { imageSrc } from "../lib/assets";

function PurposeCard({ purpose, onChoose }) {
  const [ref, revealClass] = useReveal();
  return (
    <article ref={ref} className={`card ${purpose.featured ? "card-feature " : ""}${revealClass}`}>
      <div className="card-photo">
        <img src={imageSrc(purpose.image)} alt="" loading="lazy" />
        <div className="card-icon" aria-hidden="true">{purpose.icon}</div>
      </div>
      <h3>{purpose.title}</h3>
      <p className="tagline">{purpose.tagline}</p>
      <p>{purpose.body}</p>
      <button className="link-btn" type="button" onClick={() => onChoose(purpose.id)}>
        {purpose.cta}
      </button>
    </article>
  );
}

export default function Purpose({ onChoose }) {
  return (
    <section className="purpose" id="purpose">
      <div className="container">
        <p className="eyebrow center">Where your seva goes</p>
        <h2 className="center">Every rupee becomes an offering</h2>
        <p className="sub center">Choose what moves your heart. You can support one, or all of them.</p>

        <div className="cards">
          {purposes.map((p) => (
            <PurposeCard key={p.id} purpose={p} onChoose={onChoose} />
          ))}
        </div>
      </div>
    </section>
  );
}
