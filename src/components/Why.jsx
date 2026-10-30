import useReveal from "../hooks/useReveal";
import { lotusSrc } from "../lib/assets";

export default function Why() {
  const [ref, revealClass] = useReveal();
  return (
    <section className="why">
      <div ref={ref} className={`container narrow center ${revealClass}`}>
        <img className="divider" src={lotusSrc} alt="" width="44" height="44" />
        <h2>
          Why <span className="accent">"Nitya"</span> Seva?
        </h2>
        <p className="big">
          <em>Nitya</em> means eternal, daily. The Lord's service never takes a day off. The lamps are lit, the
          bhoga is cooked, the doors open to every guest, whether it is Janmashtami or an ordinary Tuesday.
        </p>
        <p>
          A one-time gift is a beautiful offering. A regular offering is a <strong>relationship</strong>:
          it lets the temple plan, care for devotees, and say "yes" to every soul who walks in looking for Krishna.
        </p>
      </div>
    </section>
  );
}
