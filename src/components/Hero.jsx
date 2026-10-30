import { Heart } from 'lucide-react';
import './Hero.css';

export default function Hero() {
  return (
    <section className="hero" id="about">
      <div className="hero-bg" />
      <div className="container hero-content">
        <span className="hero-badge">
          <Heart size={14} /> Student-Run Spiritual Center
        </span>
        <h1 className="hero-title">
          Nurturing Souls,<br />
          Serving with <span className="highlight">Devotion</span>
        </h1>
        <p className="hero-desc">
          We are a small independent student center dedicated to cultural and
          spiritual practices for college students. Through daily seva, classes,
          and community, we create a space for growth and connection.
        </p>
        <div className="hero-actions">
          <a href="#donate" className="btn btn-primary">
            Support Our Mission
          </a>
          <a href="#expenses" className="btn btn-outline">
            See Where Funds Go
          </a>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <span className="stat-value">₹1.41L</span>
            <span className="stat-label">Monthly Expenses</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">100+</span>
            <span className="stat-label">Students Served</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">Daily</span>
            <span className="stat-label">Seva & Programs</span>
          </div>
        </div>
      </div>
    </section>
  );
}
