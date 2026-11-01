import { useEffect, useState } from "react";
import { lotusSrc } from "../lib/assets";

const links = [
  { id: "purpose", label: "Where seva goes" },
  { id: "journey", label: "Lives touched" },
  { id: "seva", label: "Seva options" },
  { id: "faq", label: "FAQ" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" }
    );
    document.querySelectorAll("main section[id]").forEach((s) => io.observe(s));

    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={`nav${scrolled || open ? " solid" : ""}${open ? " open" : ""}`}>
      <div className="container nav-inner">
        <a className="brand" href="#top" onClick={close}>
          <img src={lotusSrc} alt="" width="34" height="34" />
          <span>
            <strong>ISKCON BACE Jiasarai</strong>
            <small>Nitya Seva</small>
          </span>
        </a>
        <nav className="nav-links" id="nav-links" aria-label="Main">
          {links.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={close} className={active === l.id ? "active" : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
        <a className="btn btn-small nav-cta" href="#seva-form" onClick={close}>Become a Sevak</a>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="nav-links"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
