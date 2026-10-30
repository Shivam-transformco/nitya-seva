import { imageSrc } from "../lib/assets";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-glow" aria-hidden="true"></div>
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">Hare Krishna · Nitya Seva</p>
          <h1>
            Your offering keeps Krishna's home alive, <em>every single day.</em>
          </h1>
          <p className="lead">
            Every morning the Lord is woken with love. Every evening the hall fills with kirtan.
            Every week a new seeker sits down, hears about Krishna for the first time, and slowly finds their way home.
            Your monthly Nitya Seva makes all of it possible.
          </p>
          <div className="hero-cta">
            <a className="btn" href="#join">Become a Nitya Sevak</a>
            <a className="btn btn-ghost" href="#purpose">See where your seva goes</a>
          </div>
        </div>

        <div className="hero-photo">
          <img src={imageSrc("hero-kirtan.jpg")} alt="Devotees singing kirtan in the temple hall" />
          <div className="hero-badge">
            <strong>Every evening</strong>
            <span>Kirtan fills the hall</span>
          </div>
          <img className="hero-photo-small" src={imageSrc("deity-worship.jpg")} alt="Ghee lamp and flowers offered at the altar" />
        </div>
      </div>

      <figure className="verse">
        <p className="sanskrit" lang="sa">
          पत्रं पुष्पं फलं तोयं यो मे भक्त्या प्रयच्छति ।<br />
          तदहं भक्त्युपहृतमश्नामि प्रयतात्मनः ॥
        </p>
        <blockquote>"If one offers Me with love and devotion a leaf, a flower, fruit or water, I will accept it."</blockquote>
        <figcaption>Bhagavad-gītā 9.26</figcaption>
      </figure>
    </section>
  );
}
