import { useState } from 'react'
import { imageUrl, useCollection } from '../lib/data'

export default function Gallery() {
  const list = useCollection('gallery')
  const [failed, setFailed] = useState({})

  return (
    <section id="gallery">
      <div className="container">
        <div className="section-head center" data-reveal>
          <div className="eyebrow" style={{ justifyContent: 'center' }}>Gallery</div>
          <h2>Moments</h2>
          <p>Highlights from seminars, temple visits, and meaningful events.</p>
        </div>
        <div className="gallery-grid" id="galleryGrid">
          {list.map((g) => (
            <div className="g-item in" key={g.id}>
              {g.image_url && !failed[g.id]
                ? <img src={imageUrl(g.image_url)} alt={g.label} loading="lazy" decoding="async" onError={() => setFailed((f) => ({ ...f, [g.id]: true }))} />
                : g.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
