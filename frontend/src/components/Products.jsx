import { Link } from 'react-router-dom'
import { imageUrl, useCollection } from '../lib/data'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Products() {
  const products = useCollection('products').slice(0, 4)

  return (
    <section id="products">
      <div className="container">
        <div className="section-head center" data-reveal>
          <div className="eyebrow" style={{ justifyContent: 'center' }}>Shop</div>
          <h2>Gemstones & spiritual products</h2>
          <p>Certified gemstones, crystals, vastu items and aura cleansing salts — available directly from our store.</p>
        </div>
        <div className="grid-4" id="productGrid">
          {products.map((p) => (
            <div className="product-card in" key={p.id}>
              <div className="product-img">
                {p.img ? (
                  <img className="product-img-photo" src={imageUrl(p.img)} alt={p.name} loading="lazy" decoding="async" />
                ) : (
                  <span className="product-img-glyph">✦</span>
                )}
              </div>
              <div className="product-body">
                <span className="product-tag">{p.category || 'General'}</span>
                <h3>{p.name}</h3>
                <p>{p.desc}</p>
                <div className="product-price">{fmt(p.price)}</div>
                <div className="product-actions">
                  <Link to={`/shop`} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                    Details
                  </Link>
                  <Link to="/shop" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                    Buy now
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 44 }}>
          <Link to="/shop" className="btn btn-outline">
            Browse the full shop <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
