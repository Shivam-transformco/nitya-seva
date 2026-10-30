import { QrCode, Smartphone, Globe } from 'lucide-react';
import './Donate.css';

export default function Donate() {
  return (
    <section className="section donate-section" id="donate">
      <div className="container">
        <div className="text-center">
          <p className="section-label">Contribute</p>
          <h2 className="section-title">Support Nitya Seva</h2>
          <p className="section-subtitle">
            Your generous donation keeps our center running and helps us serve
            more students every day. Every contribution, big or small, makes a
            difference.
          </p>
        </div>

        <div className="donate-grid">
          {/* QR Code */}
          <div className="donate-card">
            <div className="donate-icon-wrap">
              <QrCode size={28} />
            </div>
            <h3 className="donate-card-title">Scan QR Code</h3>
            <p className="donate-card-desc">
              Open any UPI app and scan the QR code below to make an instant
              donation.
            </p>
            <div className="qr-placeholder">
              <QrCode size={80} strokeWidth={1} />
              <span>QR Code Coming Soon</span>
            </div>
          </div>

          {/* UPI */}
          <div className="donate-card featured">
            <div className="donate-card-badge">Most Popular</div>
            <div className="donate-icon-wrap">
              <Smartphone size={28} />
            </div>
            <h3 className="donate-card-title">UPI Transfer</h3>
            <p className="donate-card-desc">
              Send your donation directly via UPI to our registered ID.
            </p>
            <div className="upi-id-box">
              <span className="upi-label">UPI ID</span>
              <span className="upi-value">nityaseva@upi</span>
            </div>
            <p className="donate-note">
              Works with Google Pay, PhonePe, Paytm, and all UPI apps.
            </p>
          </div>

          {/* Website / Bank */}
          <div className="donate-card">
            <div className="donate-icon-wrap">
              <Globe size={28} />
            </div>
            <h3 className="donate-card-title">Online / Bank Transfer</h3>
            <p className="donate-card-desc">
              Donate through our online portal or make a direct bank transfer.
            </p>
            <a
              href="https://pages.razorpay.com/iskjs"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary donate-btn"
            >
              Donate Online
            </a>
            <p className="donate-note">
              Secure payment via Razorpay. Cards, net banking & wallets accepted.
            </p>
          </div>
        </div>

        <div className="donate-footer">
          <p>
            All donations are used exclusively for center operations and student
            programs. For any questions, reach out to us at{' '}
            <a href="mailto:contact@nityaseva.org">contact@nityaseva.org</a>
          </p>
        </div>
      </div>
    </section>
  );
}
