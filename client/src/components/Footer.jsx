import config from "../config";
import { imageSrc, lotusSrc } from "../lib/assets";
import Reveal from "./Reveal";

export function Closing() {
  return (
    <section className="closing">
      <img className="closing-bg" data-parallax="0.2" src={imageSrc("diya.webp")} alt="" loading="lazy" />
      <Reveal className="container closing-inner">
        <p className="mantra">
          Hare Krishna Hare Krishna Krishna Krishna Hare Hare
          <br />
          Hare Rama Hare Rama Rama Rama Hare Hare
        </p>
        <a className="btn" href="#seva-form">Become a Nitya Sevak <span className="arrow" aria-hidden="true">→</span></a>
      </Reveal>
    </section>
  );
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <img src={lotusSrc} alt="" width="40" height="40" />
            <div>
              <strong>ISKCON BACE Jiasarai</strong>
              <p>{config.address}</p>
              <a href={config.mapsUrl} target="_blank" rel="noopener">Get directions →</a>
            </div>
          </div>
          <div>
            <h4>Reach us</h4>
            <p>
              <a href={`tel:${config.phoneDisplay.replace(/\s/g, "")}`}>{config.phoneDisplay}</a>
              <br />
              <a href={`mailto:${config.email}`}>{config.email}</a>
            </p>
          </div>
          <div>
            <h4>Explore</h4>
            <p className="footer-links">
              <a href="#purpose">Where seva goes</a>
              <a href="#seva">Seva options</a>
              <a href="#seva-form">Become a Sevak</a>
            </p>
          </div>
        </div>
        <p className="founder">
          International Society for Krishna Consciousness · Founder-Ācārya: His Divine Grace A.C. Bhaktivedanta Swami
          Prabhupāda
        </p>
      </div>
    </footer>
  );
}
