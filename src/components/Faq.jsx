import useReveal from "../hooks/useReveal";
import { faqs } from "../content";

function FaqItem({ q, a }) {
  const [ref, revealClass] = useReveal();
  return (
    <details ref={ref} className={revealClass}>
      <summary>{q}</summary>
      <p>{a}</p>
    </details>
  );
}

export default function Faq() {
  return (
    <section className="faq" id="faq">
      <div className="container narrow">
        <h2 className="center">Questions sevaks often ask</h2>
        {faqs.map((f) => (
          <FaqItem key={f.q} {...f} />
        ))}
      </div>
    </section>
  );
}
