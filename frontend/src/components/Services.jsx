const SERVICES = [
  { icon: '✦', name: 'Horoscope Reading' },
  { icon: '☾', name: 'Kundali Analysis' },
  { icon: '♥', name: 'Marriage Guidance' },
  { icon: '◆', name: 'Career Guidance' },
  { icon: '⬢', name: 'Business Astrology' },
  { icon: '◈', name: 'Gemstone Guidance' },
  { icon: '▲', name: 'Vastu Guidance' },
  { icon: '✧', name: 'Numerology' },
]

export default function Services() {
  return (
    <section id="services" className="section-alt">
      <div className="container">
        <div className="services-header" data-reveal>
          <div className="eyebrow">Astrology services</div>
          <h2>Our specialized <span>services</span></h2>
          <p>Select a service to begin your personalised consultation.</p>
        </div>
        <div className="services-grid">
          {SERVICES.map((s) => (
            <div className="service-card" key={s.name} data-reveal>
              <div className="card-icon">{s.icon}</div>
              <h3>{s.name}</h3>
              <a href="#booking" className="card-link">Book now</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
