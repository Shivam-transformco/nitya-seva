import { imageSrc } from "../lib/assets";

const moments = [
  { when: "Every morning", text: "The Lord is woken with love." },
  { when: "Every evening", text: "The hall fills with kirtan." },
  { when: "Every week", text: "A new seeker hears about Krishna and slowly finds their way home." },
];

export default function Hero() {
  return (
    <section className="hero" id="top">
      <img className="hero-bg" data-parallax="-0.15" src={imageSrc("hero-kirtan.jpg")} alt="" fetchPriority="high" />
      <div className="hero-shade" aria-hidden="true" />

      <div className="container">
        <div className="hero-copy">
          <p className="eyebrow rise" style={{ "--d": "0.1s" }}>Hare Krishna · Nitya Seva</p>
          <h1 className="rise" style={{ "--d": "0.25s" }}>
            Your offering keeps Krishna's home alive, <em>every single day.</em>
          </h1>
          <div className="hero-cta rise" style={{ "--d": "0.5s" }}>
            <a className="btn" href="#join">Become a Nitya Sevak <span className="arrow" aria-hidden="true">→</span></a>
            <a className="btn btn-glass" href="#purpose">See where your seva goes</a>
          </div>
        </div>

        <ul className="moments">
          {moments.map((m, i) => (
            <li key={m.when} className="rise" style={{ "--d": `${0.75 + i * 0.12}s` }}>
              <strong>{m.when}</strong>
              {m.text}
            </li>
          ))}
          <li className="moment-lead rise" style={{ "--d": "1.11s" }}>
            Your monthly Nitya Seva makes all of it possible.
          </li>
        </ul>
      </div>
    </section>
  );
}
