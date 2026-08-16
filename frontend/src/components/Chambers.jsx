import { useCollection } from '../lib/data'

export default function Chambers() {
  const chambers = useCollection('chambers')

  return (
    <section id="chambers">
      <div className="container">
        <div className="section-head center" data-reveal>
          <div className="eyebrow" style={{ justifyContent: 'center' }}>Chambers</div>
          <h2>Our consultation centers</h2>
          <p>Visit a nearby chamber at a time that suits you.</p>
        </div>
        <div className="grid-3" id="chamberGrid">
          {chambers.map((c) => (
            <div className="chamber-card in" key={c.id}>
              <h3>📍 {c.name}</h3>
              <div className="chamber-meta">
                <div><b>Address</b><span>{c.address}</span></div>
                <div><b>Days</b><span>{c.days}</span></div>
                <div><b>Hours</b><span>{c.hours}</span></div>
                <div><b>Phone</b><span>{c.phone}</span></div>
              </div>
              <a
                className="btn btn-outline btn-sm"
                target="_blank"
                rel="noopener"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
              >
                View on Google Maps
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
