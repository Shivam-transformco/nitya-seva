import { formatINR, tiers } from "../content";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

function Tier({ tier, index, onChoose }) {
  const price = formatINR(tier.amount);
  return (
    <Reveal as="article" delay={index * 80} className={`tier${tier.popular ? " tier-popular" : ""}`}>
      {tier.popular && <span className="ribbon">Most chosen</span>}
      <h3 className="tier-name">{tier.name}</h3>
      <p className="price">{price}</p>
      <p className="per">per month</p>
      <p className="tier-body">{tier.body}</p>
      <button
        className={tier.popular ? "btn btn-block-sm" : "btn btn-ghost btn-block-sm"}
        type="button"
        onClick={() => onChoose(tier.amount)}
      >
        Choose {price}
      </button>
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
          sub="There is no small offering when it is made with love. Pick what feels right, or offer any amount."
        />
        <div className="tier-grid">
          {tiers.map((t, i) => (
            <Tier key={t.amount} tier={t} index={i} onChoose={onChoose} />
          ))}
        </div>
      </div>
    </section>
  );
}
