import { formatINR, sevas } from "../content";
import { imageSrc } from "../lib/assets";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

function SevaCard({ seva, index, onChoose }) {
  return (
    <Reveal as="article" delay={index * 120} className="seva-card">
      <div className="seva-photo">
        <img src={imageSrc(seva.image)} alt="" loading="lazy" />
      </div>
      <div className="seva-body">
        <h3>{seva.name}</h3>
        <p>{seva.body}</p>
        <p className="seva-per">Choose a monthly amount</p>
        <div className="seva-amounts" role="group" aria-label={`${seva.name} monthly amount`}>
          {seva.amounts.map((a) => (
            <button key={a} type="button" className="seva-amount" onClick={() => onChoose(seva.id, a)}>
              {formatINR(a)}
            </button>
          ))}
        </div>
        <button type="button" className="seva-other" onClick={() => onChoose(seva.id, "custom")}>
          Offer another amount <span aria-hidden="true">→</span>
        </button>
      </div>
    </Reveal>
  );
}

export default function Tiers({ onChoose }) {
  return (
    <section className="tiers" id="seva">
      <div className="container">
        <SectionHead
          eyebrow="Seva options"
          title="Choose your monthly offering"
          sub="There is no small offering when it is made with love. Pick the seva that moves you, and an amount that feels right."
        />
        <div className="seva-grid">
          {sevas.map((s, i) => (
            <SevaCard key={s.id} seva={s} index={i} onChoose={onChoose} />
          ))}
        </div>
      </div>
    </section>
  );
}
