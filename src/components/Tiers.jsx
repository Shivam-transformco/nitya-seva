import useReveal from "../hooks/useReveal";
import { formatINR, tiers } from "../content";

function Tier({ tier, onChoose }) {
  const [ref, revealClass] = useReveal();
  const price = formatINR(tier.amount);
  return (
    <article ref={ref} className={`tier ${tier.popular ? "tier-popular " : ""}${revealClass}`}>
      {tier.popular && <span className="ribbon">Most chosen</span>}
      <h3>{tier.name}</h3>
      <p className="price">
        {price}
        <span>/month</span>
      </p>
      <p>{tier.body}</p>
      <button
        className={tier.popular ? "btn" : "btn btn-outline"}
        type="button"
        onClick={() => onChoose(tier.amount)}
      >
        Choose {price}
      </button>
    </article>
  );
}

export default function Tiers({ onChoose }) {
  return (
    <section className="tiers" id="seva">
      <div className="container">
        <p className="eyebrow center">Seva options</p>
        <h2 className="center">Choose your monthly offering</h2>
        <p className="sub center">
          There is no small offering when it is made with love. Pick what feels right, or offer any amount.
        </p>

        <div className="tier-grid">
          {tiers.map((t) => (
            <Tier key={t.amount} tier={t} onChoose={onChoose} />
          ))}
        </div>
      </div>
    </section>
  );
}
