import Reveal from "./Reveal";

const daily = ["The lamps are lit", "The bhoga is cooked", "The doors open to every guest"];

export default function Why() {
  return (
    <section className="why">
      <div className="container">
        <div className="why-grid">
          <Reveal>
            <p className="eyebrow">Why Nitya Seva</p>
            <h2>
              Why <em className="accent">"Nitya"</em> Seva?
            </h2>
            <p className="why-statement">
              <em>Nitya</em> means eternal, daily. The Lord's service never takes a day off.
            </p>
          </Reveal>

          <Reveal delay={150}>
            <ol className="daily">
              {daily.map((text, i) => (
                <li key={text}>
                  <span>0{i + 1}</span>
                  {text}
                </li>
              ))}
            </ol>
            <p className="daily-note">whether it is Janmashtami or an ordinary Tuesday.</p>
          </Reveal>
        </div>

        <Reveal className="compare" delay={100}>
          <div className="compare-card">
            <span className="compare-label">A one-time gift</span>
            <p>is a beautiful offering.</p>
          </div>
          <div className="compare-card compare-strong">
            <span className="compare-label">A regular offering</span>
            <p>
              is a <strong>relationship</strong>. It lets the temple plan, care for devotees, and say "yes" to every
              soul who walks in looking for Krishna.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
