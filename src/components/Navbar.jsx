import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import './Navbar.css';

const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Expenses', href: '#expenses' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Donate', href: '#donate' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-inner container">
        <a href="#" className="navbar-brand">
          <span className="brand-icon">🙏</span>
          <span className="brand-text">Nitya Seva</span>
        </a>

        <ul className={`navbar-links ${open ? 'open' : ''}`}>
          {navLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </a>
            </li>
          ))}
          <li className="nav-cta-mobile">
            <a href="#donate" className="btn-donate-nav" onClick={() => setOpen(false)}>
              Donate Now
            </a>
          </li>
        </ul>

        <a href="#donate" className="btn-donate-nav desktop-only">
          Donate Now
        </a>

        <button
          className="navbar-toggle"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </nav>
  );
}
