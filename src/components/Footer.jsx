import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="brand-icon">🙏</span>
          <span className="brand-text">Nitya Seva</span>
        </div>
        <p className="footer-tagline">
          A student-run center for cultural & spiritual practices.
        </p>
        <div className="footer-divider" />
        <p className="footer-copy">
          &copy; {new Date().getFullYear()} Nitya Seva. Made with devotion.
        </p>
      </div>
    </footer>
  );
}
