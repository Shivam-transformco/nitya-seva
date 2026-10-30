import useReveal from "../hooks/useReveal";
import { journeySteps } from "../content";

function Step({ number, title, body }) {
  const [ref, revealClass] = useReveal();
  return (
    <li ref={ref} className={revealClass}>
      <span className="step-num">{number}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </li>
  );
}

export default function Journey() {
  return (
    <section className="journey" id="journey">
      <div className="container">
        <p className="eyebrow center">Lives touched</p>
        <h2 className="center">How a seeker becomes a devotee</h2>
        <p className="sub center">
          Every step of this journey happens at the temple, and every step is sustained by sevaks like you.
        </p>

        <ol className="steps">
          {journeySteps.map((s, i) => (
            <Step key={s.title} number={i + 1} {...s} />
          ))}
        </ol>
      </div>
    </section>
  );
}
