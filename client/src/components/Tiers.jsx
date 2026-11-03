import { formatINR, sevas } from "../content";
import { imageSrc } from "../lib/assets";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

export default function Tiers({ onChoose }) {
  const seva = sevas[0];

  return (
    <section className="tiers" id="seva">
      <div className="container">
        <SectionHead
          eyebrow="Monthly seva"
          title="Choose your monthly offering"
          sub="There is no small offering when it is made with love. Pick an amount that feels right and become a Nitya Sevak."
        />
        <Reveal className="seva-hero">
          <div className="seva-hero-photo">
            <img src={imageSrc(seva.image)} alt="" loading="lazy" />
          </div>
          <div className="seva-hero-body">
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
      </div>
    </section>
  );
}
