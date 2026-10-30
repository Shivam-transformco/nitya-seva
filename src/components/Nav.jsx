import { lotusSrc } from "../lib/assets";

export default function Nav() {
  return (
    <header className="nav" id="top">
      <a className="brand" href="#top">
        <img src={lotusSrc} alt="" width="34" height="34" />
        <span>
          <strong>ISKCON Jiasarai</strong>
          <small>Nitya Seva</small>
        </span>
      </a>
      <nav className="nav-links" aria-label="Main">
        <a href="#purpose">Where seva goes</a>
        <a href="#journey">Lives touched</a>
        <a href="#seva">Seva options</a>
        <a href="#faq">FAQ</a>
      </nav>
      <a className="btn btn-small" href="#join">Become a Sevak</a>
    </header>
  );
}
