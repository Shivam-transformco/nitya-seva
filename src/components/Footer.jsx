import config from "../config";

export function Closing() {
  return (
    <section className="closing">
      <div className="container narrow center">
        <p className="mantra">
          Hare Krishna Hare Krishna Krishna Krishna Hare Hare<br />
          Hare Rama Hare Rama Rama Rama Hare Hare
        </p>
        <a className="btn" href="#join">Become a Nitya Sevak</a>
      </div>
    </section>
  );
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <strong>ISKCON Jiasarai</strong>
          <p>{config.address}</p>
          <a href={config.mapsUrl} target="_blank" rel="noopener">Get directions</a>
        </div>
        <div>
          <strong>Reach us</strong>
          <p>
            <a href={`tel:${config.phoneDisplay.replace(/\s/g, "")}`}>{config.phoneDisplay}</a>
            <br />
            <a href={`mailto:${config.email}`}>{config.email}</a>
          </p>
        </div>
        <div className="founder">
          <p>
            International Society for Krishna Consciousness<br />
            Founder-Ācārya: His Divine Grace A.C. Bhaktivedanta Swami Prabhupāda
          </p>
        </div>
      </div>
    </footer>
  );
}
