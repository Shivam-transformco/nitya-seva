import Reveal from "./Reveal";

// align: "center" stacks everything; "split" puts the heading left and the sub-copy right.
export default function SectionHead({ eyebrow, title, sub, align = "center" }) {
  return (
    <Reveal className={`section-head ${align}`}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {sub && <p className="sub">{sub}</p>}
    </Reveal>
  );
}
