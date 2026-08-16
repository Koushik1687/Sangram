import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import StarField from '../components/StarField'
import { imageUrl, useCollection } from '../lib/data'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { withViewTransition } from '../lib/viewTransition'

/* ==========================================================================
   Shop — catalogue with category filters (Crystals, Vastu Items,
   Aura Cleansing Salt, Gemstones). Items are added to the cart; checkout
   (login + PhonePe) happens in the cart drawer.
   ========================================================================== */

const CATEGORIES = ['Crystals', 'Vastu Items', 'Aura Cleansing Salt', 'Gemstones']

const CATEGORY_META = {
  Crystals: { icon: '✦', blurb: 'Healing stones & sacred beads' },
  'Vastu Items': { icon: '☰', blurb: 'Alignment & prosperity objects' },
  'Aura Cleansing Salt': { icon: '❋', blurb: 'Purify your space & energy' },
  Gemstones: { icon: '◈', blurb: 'Certified planetary gemstones' },
}

function categoryIcon(cat) {
  return CATEGORY_META[cat]?.icon || '✦'
}

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/* Stock display helper: null = unlimited. */
function StockBadge({ stock }) {
  if (stock == null) return null
  if (stock <= 0) return <span className="stock-badge out">Out of stock</span>
  if (stock <= 5) return <span className="stock-badge low">Only {stock} left</span>
  return <span className="stock-badge ok">In stock</span>
}

/* True only when stock is explicitly tracked and zero (null = unlimited). */
const isSoldOut = (stock) => stock != null && Number(stock) <= 0

export default function Shop() {
  const { user } = useAuth()
  const { items, add, openCart } = useCart()
  const [params] = useSearchParams()

  const products = useCollection('products')
  const categories = useCollection('categories')
  const [active, setActive] = useState('All')
  const [selected, setSelected] = useState(null) // quick-view product
  const handledLoginRedirect = useRef(false)

  const openModal = (p) => withViewTransition(() => setSelected(p))
  const closeModal = () => withViewTransition(() => setSelected(null))

  /* Map each top-level category to its sub-category names so the filter tabs
     also include products assigned to a sub-category. */
  const subNames = useMemo(() => {
    const map = {}
    for (const c of categories) {
      if (c.parent_id) {
        const parent = categories.find((x) => x.id === c.parent_id)
        if (parent) (map[parent.name] = map[parent.name] || []).push(c.name)
      }
    }
    return map
  }, [categories])

  const counts = useMemo(() => {
    const c = { All: products.length }
    for (const cat of CATEGORIES) {
      const subs = subNames[cat] || []
      c[cat] = products.filter((p) => (p.category || '') === cat || subs.includes(p.category)).length
    }
    return c
  }, [products, subNames])

  const filtered = useMemo(() => {
    if (active === 'All') return products
    const subs = subNames[active] || []
    return products.filter((p) => (p.category || '') === active || subs.includes(p.category))
  }, [products, active, subNames])

  /* Resume the interrupted purchase: /shop?product=<id> was set by the login
     page redirect, so add that item to the cart (or open the drawer). */
  useEffect(() => {
    const pid = Number(params.get('product'))
    if (!pid || !user || handledLoginRedirect.current) return
    const p = products.find((x) => Number(x.id) === pid)
    if (!p) return
    handledLoginRedirect.current = true
    if (items.some((it) => Number(it.product.id) === pid)) openCart()
    else add(p)
  }, [params, user, products, items, add, openCart])

  return (
    <div className="page-shell">
      <StarField />
      <div className="cosmic-wash"></div>
      <Navbar />

      <main className="page-main">
        <div className="container">
          {/* Header */}
          <div className="section-head center" style={{ marginBottom: 40 }}>
            <div className="eyebrow" style={{ justifyContent: 'center' }}>Sacred Store</div>
            <h2 style={{ fontSize: 'clamp(2rem,4vw,3rem)' }}>The Sree Sangram Shop</h2>
            <p>
              Certified gemstones, healing crystals, vastu remedies and aura cleansing salts —
              authenticated, sanctified and shipped with care.
            </p>
          </div>

          {/* Filters */}
          <div className="filter-bar" role="group" aria-label="Filter products by category">
            <button
              type="button"
              className={`filter-pill${active === 'All' ? ' active' : ''}`}
              onClick={() => setActive('All')}
            >
              <span>All items</span>
              <em>{counts.All}</em>
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`filter-pill${active === cat ? ' active' : ''}`}
                onClick={() => setActive(cat)}
              >
                <span>{cat}</span>
                <em>{counts[cat]}</em>
              </button>
            ))}
          </div>

          <p className="filter-note">
            {active === 'All'
              ? 'Showing every item in the store.'
              : `${CATEGORY_META[active]?.blurb || ''} — showing ${counts[active]} item${counts[active] === 1 ? '' : 's'}.`}
          </p>

          {/* Product grid */}
          {filtered.length === 0 ? (
            <div className="shop-empty">
              <div className="shop-empty-icon">✦</div>
              <h3>Nothing here yet</h3>
              <p>Products in this category will appear here soon.</p>
            </div>
          ) : (
            <div className="grid-4" id="shopGrid">
              {filtered.map((p) => (
                <article className="product-card in" key={p.id}>
                  <button
                    type="button"
                    className="product-img"
                    style={{ border: 'none', width: '100%', cursor: 'pointer', padding: 0 }}
                    onClick={() => openModal(p)}
                    aria-label={`View details for ${p.name}`}
                  >
                    {p.img ? (
                      <img className="product-img-photo" src={imageUrl(p.img)} alt={p.name} loading="lazy" decoding="async" />
                    ) : (
                      <span className="product-img-glyph">{categoryIcon(p.category)}</span>
                    )}
                  </button>
                  <div className="product-body">
                    <span className="product-tag">{p.category || 'General'}</span>
                    <h3>{p.name}</h3>
                    <p>{p.desc || 'A sacred item curated by Sree Sangram.'}</p>
                    <div className="product-price">{fmt(p.price)}</div>
                    <StockBadge stock={p.stock} />
                    <div className="product-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => openModal(p)}>
                        Details
                      </button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => add(p)} disabled={isSoldOut(p.stock)}>
                        {isSoldOut(p.stock) ? 'Out of stock' : 'Add to cart'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Quick view modal */}
      {selected && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">✕</button>
            <div className="modal-product-img">
              {selected.img ? (
                <img className="product-img-photo" src={imageUrl(selected.img)} alt={selected.name} loading="lazy" decoding="async" />
              ) : (
                <span className="product-img-glyph">{categoryIcon(selected.category)}</span>
              )}
            </div>
            <span className="product-tag">{selected.category || 'General'}</span>
            <h3>{selected.name}</h3>
            <p className="modal-desc">{selected.desc || 'A sacred item curated by Sree Sangram.'}</p>
            <div className="modal-price">{fmt(selected.price)}</div>
            <StockBadge stock={selected.stock} />
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: 16 }}
              disabled={isSoldOut(selected.stock)}
              onClick={() => { setSelected(null); add(selected) }}
            >
              {isSoldOut(selected.stock) ? 'Out of stock' : `Add to cart · ${fmt(selected.price)}`}
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
