import { purposes } from "../content";
import { imageSrc } from "../lib/assets";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

const pad = (n) => String(n).padStart(2, "0");

function PurposeCard({ purpose, index, onChoose }) {
  const wide = index === 0;
  const classes = ["p-card", wide && "wide", purpose.featured && "featured"].filter(Boolean).join(" ");
  return (
    <Reveal as="article" className={classes} delay={(index % 3) * 90}>
      <div className="p-media">
        <img src={imageSrc(purpose.image)} alt="" loading="lazy" />
        <span className="p-num">{pad(index + 1)}</span>
      </div>
      <div className="p-body">
        <h3>{purpose.title}</h3>
        <p className="p-tagline">{purpose.tagline}</p>
        <p className="p-text">{purpose.body}</p>
        <button
          type="button"
          className={purpose.featured ? "btn btn-light btn-small" : "text-link"}
          onClick={() => onChoose(purpose.id)}
        >
          {purpose.cta}
        </button>
      </div>
    </Reveal>
  );
}

export default function Purpose({ onChoose }) {
  return (
    <section className="purpose" id="purpose">
      <div className="container">
        <SectionHead
          align="split"
          eyebrow="Where your seva goes"
          title="Every rupee becomes an offering"
          sub="Each of these is something your seva keeps alive, day after day, at ISKCON BACE Jiasarai."
        />
        <div className="purpose-grid">
          {purposes.map((p, i) => (
            <PurposeCard key={p.id} purpose={p} index={i} onChoose={onChoose} />
          ))}
        </div>
      </div>
    </section>
  );
}
