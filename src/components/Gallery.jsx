import useReveal from "../hooks/useReveal";
import { gallery } from "../content";
import { imageSrc } from "../lib/assets";

function Photo({ image, caption, size }) {
  const [ref, revealClass] = useReveal();
  return (
    <figure ref={ref} className={`gallery-item ${size ? `gallery-${size} ` : ""}${revealClass}`}>
      <img src={imageSrc(image)} alt={caption} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export default function Gallery() {
  return (
    <section className="gallery">
      <div className="container">
        <p className="eyebrow center">Moments from the temple</p>
        <h2 className="center">This is what your seva looks like</h2>
        <p className="sub center">Every kirtan, every plate of prasadam, every festival night is an offering made possible by sevaks.</p>
        <div className="gallery-grid">
          {gallery.map((g) => (
            <Photo key={g.image} {...g} />
          ))}
        </div>
      </div>
    </section>
  );
}
