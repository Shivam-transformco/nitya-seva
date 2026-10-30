import { useState } from 'react';
import { galleryCategories, galleryItems } from '../data/gallery';
import './Gallery.css';

export default function Gallery() {
  const [active, setActive] = useState('All');

  const filtered =
    active === 'All'
      ? galleryItems
      : galleryItems.filter((item) => item.category === active);

  return (
    <section className="section" id="gallery">
      <div className="container">
        <div className="text-center">
          <p className="section-label">Moments</p>
          <h2 className="section-title">Life at Nitya Seva</h2>
          <p className="section-subtitle">
            Glimpses from our events, study sessions, spiritual camps, and
            inspiring talks.
          </p>
        </div>

        <div className="gallery-filters">
          {galleryCategories.map((cat) => (
            <button
              key={cat}
              className={`filter-btn ${active === cat ? 'active' : ''}`}
              onClick={() => setActive(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="gallery-grid">
          {filtered.map((item) => (
            <div className="gallery-card" key={item.id}>
              <img src={item.image} alt={item.title} loading="lazy" />
              <div className="gallery-overlay">
                <span className="gallery-cat">{item.category}</span>
                <h4 className="gallery-title">{item.title}</h4>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
