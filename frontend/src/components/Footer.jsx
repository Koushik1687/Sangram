import { Link } from 'react-router-dom'
import SectionNavLink from './SectionNavLink'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="brand">
              <span className="brand-mark">
                <img src="/images/logo/Sree Sangram logo.png" alt="Sree Sangram Logo" loading="lazy" decoding="async" />
              </span>
              <span className="brand-text"><span className="en">শ্রী সংগ্রাম</span></span>
            </div>
            <p>Guiding lives with trust, experience, and care for more than two decades.</p>
          </div>
          <div className="footer-col">
            <h4>Quick links</h4>
            <ul>
              <li><SectionNavLink href="#about">About</SectionNavLink></li>
              <li><SectionNavLink href="#services">Services</SectionNavLink></li>
              <li><SectionNavLink href="#products">Shop</SectionNavLink></li>
              <li><SectionNavLink href="#blog">Blog</SectionNavLink></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Services</h4>
            <ul>
              <li><SectionNavLink href="#services">Kundali Analysis</SectionNavLink></li>
              <li><SectionNavLink href="#services">Marriage Guidance</SectionNavLink></li>
              <li><SectionNavLink href="#services">Gemstone Guidance</SectionNavLink></li>
              <li><SectionNavLink href="#services">Vastu</SectionNavLink></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <ul>
              <li>+91 82768 42057</li>
              <li>contact@sreesangram.com</li>
              <li>Gariahat Road, Kolkata</li>
              <div className="social-row">
                <a href="#" aria-label="Facebook">f</a>
                <a href="#" aria-label="Instagram">ig</a>
                <a href="#" aria-label="YouTube">yt</a>
                <a href="#" aria-label="WhatsApp">wa</a>
              </div>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {year} Sree Sangram. All rights reserved.</span>
          <span><Link to="/admin/login" className="footer-admin">Admin</Link></span>
        </div>
      </div>
    </footer>
  )
}
