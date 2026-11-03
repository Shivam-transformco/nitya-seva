import { useState } from "react";
import { faqs } from "../content";
import { whatsappLink } from "../lib/submit";
import Reveal from "./Reveal";

function FaqItem({ id, q, a, open, onToggle }) {
  return (
    <div className={`faq-item${open ? " open" : ""}`}>
      <button type="button" className="faq-q" id={`${id}-q`} aria-expanded={open} aria-controls={`${id}-a`}
        onClick={onToggle}>
        {q}
        <span className="faq-icon" aria-hidden="true" />
      </button>
      <div className="collapse" id={`${id}-a`} role="region" aria-labelledby={`${id}-q`} aria-hidden={!open}>
        <div>
          <p>{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <section className="faq" id="faq">
      <div className="container faq-grid">
        <Reveal className="faq-head">
          <p className="eyebrow">FAQ</p>
          <h2>Questions sevaks often ask</h2>
          <a className="text-link" href={whatsappLink("Hare Krishna! I have a question about Nitya Seva.")} target="_blank" rel="noopener">
            Ask us on WhatsApp →
          </a>
        </Reveal>
        <Reveal className="faq-list" delay={120}>
          {faqs.map((f, i) => (
            <FaqItem
              key={f.q}
              id={`faq-${i}`}
              {...f}
              open={openIndex === i}
              onToggle={() => setOpenIndex((o) => (o === i ? -1 : i))}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
