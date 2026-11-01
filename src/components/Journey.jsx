import { journeySteps } from "../content";
import { imageSrc } from "../lib/assets";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

export default function Journey() {
  return (
    <section className="journey" id="journey">
      <div className="container">
        <SectionHead
          eyebrow="Lives touched"
          title="How a seeker becomes a devotee"
          sub="Every step of this journey happens at the temple, and every step is sustained by sevaks like you."
        />

        <ol className="timeline">
          {journeySteps.map((s, i) => (
            <Reveal as="li" key={s.title} className="t-step" delay={i * 110}>
              <div className="t-marker" aria-hidden="true">
                <span className="t-dot">{i + 1}</span>
                <span className="t-line" />
              </div>
              <div className="t-media">
                <img src={imageSrc(s.image)} alt="" loading="lazy" />
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal className="journey-cta">
          <a className="btn" href="#seva-form">Be part of this <span className="arrow" aria-hidden="true">→</span></a>
        </Reveal>
      </div>
    </section>
  );
}
