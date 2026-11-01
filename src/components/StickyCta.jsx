import { useEffect, useState } from "react";

// Mobile-only floating CTA, hidden at the top of the page and while the form is on screen.
export default function StickyCta() {
  const [pastHero, setPastHero] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const join = document.getElementById("join");
    const io = join && new IntersectionObserver(([e]) => setFormVisible(e.isIntersecting), { threshold: 0.1 });
    io?.observe(join);

    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, []);

  const show = pastHero && !formVisible;
  return (
    <a href="#seva-form" className={`sticky-cta${show ? " show" : ""}`} aria-hidden={!show} tabIndex={show ? 0 : -1}>
      Become a Nitya Sevak <span aria-hidden="true">→</span>
    </a>
  );
}
