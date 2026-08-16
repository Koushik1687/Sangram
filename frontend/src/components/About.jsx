export default function About() {
  return (
    <section id="about">
      <div className="container about-grid">
        <div className="about-photo" data-reveal>
          <img src="/images/Admin/Sree Sangram.webp" alt="Sree Sangram" loading="lazy" decoding="async" />
          <div className="ring"></div>
        </div>
        <div className="about-copy" data-reveal>
          <div className="eyebrow">About</div>
          <h2>Sree Sangram</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            For more than two decades, Sree Sangram has practiced Vedic astrology with devotion
            and precision. After studying astrology at Banaras Hindu University, he has guided
            thousands of people through life decisions involving career, marriage, business, and
            family matters.
          </p>
          <h3>Our mission</h3>
          <ul className="about-list">
            <li>Offer clear, accurate, and evidence-based guidance through detailed horoscope analysis</li>
            <li>Provide personalized consultation while maintaining confidentiality and trust</li>
            <li>Bridge ancient scriptures with practical solutions for modern life</li>
          </ul>
          <div className="about-cred">
            <div><strong>20+</strong><span>years of experience</span></div>
            <div><strong>8</strong><span>specialist domains</span></div>
            <div><strong>15K+</strong><span>clients</span></div>
          </div>
        </div>
      </div>
    </section>
  )
}
