import { lotusSrc } from "../lib/assets";
import Reveal from "./Reveal";

export default function Verse() {
  return (
    <section className="verse-section">
      <Reveal as="figure" className="container verse">
        <div className="ornament" aria-hidden="true">
          <img src={lotusSrc} alt="" width="40" height="40" />
        </div>
        <p className="sanskrit" lang="sa">
          पत्रं पुष्पं फलं तोयं यो मे भक्त्या प्रयच्छति ।<br />
          तदहं भक्त्युपहृतमश्नामि प्रयतात्मनः ॥
        </p>
        <blockquote>"If one offers Me with love and devotion a leaf, a flower, fruit or water, I will accept it."</blockquote>
        <figcaption>Bhagavad-gītā 9.26</figcaption>
      </Reveal>
    </section>
  );
}
