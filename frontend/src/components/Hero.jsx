/* ==========================================================================
   Hero — headline copy, stats, the Vedic kundali chart, and the rotating
   zodiac wheel (with parallax orbit planets driven by StarField).
   ========================================================================== */
import { useRef } from 'react'
import ZodiacWheel from './ZodiacWheel'
import { usePauseAnimWhenHidden } from '../hooks/usePauseAnimWhenHidden'

function VedicChart() {
  return (
    <div className="vedic-chart-bg">
      <svg viewBox="0 0 500 500" className="kundali-svg">
        <defs>
          <linearGradient id="kundaliLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop className="kundali-stop-a" offset="0%" stopColor="#f6c75c" stopOpacity="0.85" />
            <stop className="kundali-stop-b" offset="50%" stopColor="#bc8317" stopOpacity="0.6" />
            <stop className="kundali-stop-c" offset="100%" stopColor="#7c5205" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <rect x="15" y="15" width="470" height="470" fill="none" stroke="url(#kundaliLineGrad)" strokeWidth="1.8" />
        <rect x="25" y="25" width="450" height="450" fill="none" stroke="rgba(212,175,55,0.35)" strokeWidth="1" strokeDasharray="6 4" />
        <line x1="15" y1="15" x2="485" y2="485" stroke="url(#kundaliLineGrad)" strokeWidth="1.5" />
        <line x1="485" y1="15" x2="15" y2="485" stroke="url(#kundaliLineGrad)" strokeWidth="1.5" />
        <polygon points="250,15 485,250 250,485 15,250" fill="none" stroke="url(#kundaliLineGrad)" strokeWidth="1.8" />
        <circle cx="250" cy="250" r="232" fill="none" stroke="rgba(212,175,55,0.32)" strokeDasharray="3 6" />
        <circle cx="250" cy="250" r="166" fill="none" stroke="rgba(212,175,55,0.24)" strokeWidth="1" />
        <circle cx="250" cy="15" r="4" fill="#bc8317" opacity="0.8" />
        <circle cx="485" cy="250" r="4" fill="#bc8317" opacity="0.8" />
        <circle cx="250" cy="485" r="4" fill="#bc8317" opacity="0.8" />
        <circle cx="15" cy="250" r="4" fill="#bc8317" opacity="0.8" />
        <g fontFamily="'Cinzel', serif" fontWeight="600" textAnchor="middle" fill="rgba(154,101,4,0.55)">
          <text x="250" y="105" fontSize="11" letterSpacing="1">1 · LAGNA</text>
          <text x="145" y="70" fontSize="10">2</text>
          <text x="70" y="145" fontSize="10">3</text>
          <text x="110" y="254" fontSize="10">4</text>
          <text x="70" y="360" fontSize="10">5</text>
          <text x="145" y="435" fontSize="10">6</text>
          <text x="250" y="400" fontSize="10">7</text>
          <text x="355" y="435" fontSize="10">8</text>
          <text x="430" y="360" fontSize="10">9</text>
          <text x="390" y="254" fontSize="10">10</text>
          <text x="430" y="145" fontSize="10">11</text>
          <text x="355" y="70" fontSize="10">12</text>
        </g>
      </svg>
    </div>
  )
}

export default function Hero() {
  const heroRef = useRef(null)

  /* Pause the hero's decorative CSS animations (wheel, chart pulse) while
     the hero is off-screen — invisible at that point, but their per-frame
     style recalc is the dominant scroll-jank source. */
  usePauseAnimWhenHidden(heroRef)

  return (
    <section id="hero" ref={heroRef}>
      <div className="container hero-grid">
        <div className="hero-copy" data-reveal>
          <div className="eyebrow">Vedic astrologer · 20+ years of experience</div>
          <h1>
            Find your path through the light of the planets
            <span className="bn-accent">with Sree Sangram</span>
          </h1>
          <p>
            From kundali analysis to marriage, career, and business guidance — discover clarity
            for life&rsquo;s key decisions through precise Vedic astrology with Sree Sangram.
          </p>
          <div className="hero-actions">
            <a href="#booking" className="btn btn-primary">Book an appointment</a>
            <a href="#services" className="btn btn-outline">View services</a>
          </div>
          <div className="hero-stats">
            <div><strong>20+</strong><span>years of experience</span></div>
            <div><strong>15,000+</strong><span>satisfied clients</span></div>
            <div><strong>3</strong><span>chamber locations</span></div>
          </div>
        </div>
        <div className="hero-visual" data-reveal>
          <VedicChart />
          <ZodiacWheel />
          <div className="orbit-planet" style={{ width: 16, height: 16, top: '8%', left: '14%' }}></div>
          <div className="orbit-planet" style={{ width: 10, height: 10, top: '70%', left: '8%' }}></div>
          <div className="orbit-planet" style={{ width: 13, height: 13, top: '16%', left: '82%' }}></div>
          <div className="orbit-planet" style={{ width: 8, height: 8, top: '78%', left: '85%' }}></div>
        </div>
      </div>
    </section>
  )
}
