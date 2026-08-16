import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../lib/cart'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { imageUrl } from '../lib/data'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/* ==========================================================================
   CartDrawer — slide-in cart panel with quantity controls and a built-in
   checkout step. Checkout requires login: create order → initiate PhonePe
   payment → redirect to the PhonePe hosted checkout page.
   ========================================================================== */
export default function CartDrawer() {
  const { items, count, subtotal, isOpen, closeCart, clear, setQuantity, remove } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState('cart') // 'cart' | 'checkout'
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Coupon state
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState(null) // { code, discount }
  const [couponBusy, setCouponBusy] = useState(false)
  const [couponMsg, setCouponMsg] = useState('')

  // Shipping config (flat fee + free-shipping threshold) — mirrors the server rule
  const [shippingCfg, setShippingCfg] = useState({ fee: 0, free_shipping_min: 0 })
  useEffect(() => {
    let alive = true
    api
      .get('/shipping')
      .then((cfg) => { if (alive) setShippingCfg(cfg) })
      .catch(() => { /* fall back to no shipping — the server still enforces it */ })
    return () => { alive = false }
  }, [])

  const shippingFee =
    shippingCfg.fee > 0 && shippingCfg.free_shipping_min > 0 && subtotal >= shippingCfg.free_shipping_min
      ? 0
      : shippingCfg.fee
  const payable = Math.max(0, subtotal - (coupon?.discount || 0) + shippingFee)

  /* Close the drawer fully (reset the checkout step) once the slide-out ends. */
  useEffect(() => {
    if (isOpen) return undefined
    const t = setTimeout(() => {
      setStep('cart')
      setError('')
      setCoupon(null)
      setCouponInput('')
      setCouponMsg('')
    }, 300)
    return () => clearTimeout(t)
  }, [isOpen])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeCart() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeCart])

  function startCheckout() {
    if (!user) {
      closeCart()
      navigate('/login?next=/shop')
      return
    }
    setError('')
    setStep('checkout')
  }

  async function applyCoupon() {
    const code = couponInput.trim()
    if (!code) return
    setCouponBusy(true)
    setCouponMsg('')
    try {
      const res = await api.post('/coupons/validate', { code, amount: subtotal })
      if (res.valid) {
        setCoupon({ code: code.toUpperCase(), discount: res.discount })
        setCouponMsg(res.message || 'Coupon applied.')
      } else {
        setCoupon(null)
        setCouponMsg(res.message || 'That coupon is not valid for this order.')
      }
    } catch (err) {
      setCoupon(null)
      setCouponMsg(err.message || 'Could not validate coupon.')
    } finally {
      setCouponBusy(false)
    }
  }

  function removeCoupon() {
    setCoupon(null)
    setCouponInput('')
    setCouponMsg('')
  }

  /* Client-side stock guard — the server re-checks at order creation too.
     null stock = unlimited, so only an explicitly-tracked zero blocks. */
  const soldOutItem = items.find((it) => it.product.stock != null && Number(it.product.stock) <= 0)
  const stockIssue = soldOutItem ? `${soldOutItem.product.name} is out of stock.` : ''

  async function confirmPurchase(e) {
    e.preventDefault()
    if (!user || items.length === 0) return
    if (stockIssue) {
      setError(stockIssue)
      return
    }
    setBusy(true)
    setError('')
    try {
      // 1. Create the order — the server snapshots prices, applies the coupon,
      //    and computes the total (the client value is never trusted)
      const order = await api.post(
        '/orders',
        {
          items: items.map((it) => ({ product_id: it.product.id, quantity: it.quantity })),
          address,
          coupon_code: coupon?.code || undefined,
        },
        { customer: true },
      )

      // 2. Initiate the PhonePe standard checkout for the full cart total
      const pay = await api.post('/payments/initiate', {
        amount: order.total,
        customer_name: user.name,
        customer_phone: user.phone || '',
        customer_email: user.email,
        order_id: order.id,
        redirect_url: `${window.location.origin}/payment-status`,
      })

      clear()
      window.location.href =
        pay.redirect_url || `${window.location.origin}/payment-status?orderId=${pay.merchant_order_id}`
    } catch (err) {
      setError(err.message || 'Could not start payment. Please try again.')
      setBusy(false)
    }
  }

  return (
    <>
      <div className={`cart-overlay${isOpen ? ' open' : ''}`} onClick={closeCart} aria-hidden="true" />
      <aside className={`cart-drawer${isOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Shopping cart">
        <div className="cart-head">
          <h3>{step === 'checkout' ? 'Secure checkout' : `Your cart${count ? ` (${count})` : ''}`}</h3>
          <button type="button" className="cart-close" onClick={closeCart} aria-label="Close cart">✕</button>
        </div>

        {step === 'cart' && (
          <>
            {items.length === 0 ? (
              <div className="cart-empty">
                <div className="cart-empty-icon">🛍️</div>
                <p>Your cart is empty.</p>
                <Link to="/shop" className="btn btn-primary btn-sm" onClick={closeCart}>
                  Browse the shop
                </Link>
              </div>
            ) : (
              <>
                <ul className="cart-items">
                  {items.map((it) => {
                    const maxQty = it.product.stock != null ? Number(it.product.stock) : 99
                    const soldOut = it.product.stock != null && Number(it.product.stock) <= 0
                    return (
                      <li className={`cart-item${soldOut ? ' sold-out' : ''}`} key={it.product.id}>
                        <div className="cart-item-icon">
                          {it.product.img ? (
                            <img className="cart-item-photo" src={imageUrl(it.product.img)} alt={it.product.name} loading="lazy" decoding="async" />
                          ) : (
                            <>{it.product.category === 'Gemstones' ? '◈' : it.product.category === 'Vastu Items' ? '☰' : it.product.category === 'Aura Cleansing Salt' ? '❋' : '✦'}</>
                          )}
                        </div>
                        <div className="cart-item-info">
                          <span className="cart-item-name">{it.product.name}</span>
                          <span className="cart-item-price">{fmt(it.product.price)}</span>
                          {soldOut && <span className="stock-badge out" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Out of stock</span>}
                          <div className="qty-control">
                            <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(it.product.id, it.quantity - 1)}>−</button>
                            <span>{it.quantity}</span>
                            <button type="button" aria-label="Increase quantity" onClick={() => setQuantity(it.product.id, it.quantity + 1)} disabled={it.quantity >= maxQty}>+</button>
                          </div>
                        </div>
                      <div className="cart-item-right">
                        <button type="button" className="cart-remove" aria-label={`Remove ${it.product.name}`} onClick={() => remove(it.product.id)}>✕</button>
                        <span className="cart-item-total">{fmt(Number(it.product.price) * it.quantity)}</span>
                      </div>
                    </li>
                    )
                  })}
                </ul>

                <div className="cart-foot">
                  <div className="cart-subtotal">
                    <span>Subtotal</span>
                    <strong>{fmt(subtotal)}</strong>
                  </div>
                  <button type="button" className="btn btn-primary btn-block" onClick={startCheckout} disabled={!!stockIssue}>
                    {stockIssue ? 'Out of stock — remove item' : 'Proceed to checkout'}
                  </button>
                  <p className="checkout-secure">
                    <span aria-hidden="true">🔒</span> Login required · Payment via PhonePe
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {step === 'checkout' && (
          <form className="cart-checkout" onSubmit={confirmPurchase}>
            <Link
              to="#"
              className="cart-back"
              onClick={(e) => { e.preventDefault(); setStep('cart') }}
            >
              ← Back to cart
            </Link>

            <ul className="cart-checkout-items">
              {items.map((it) => (
                <li key={it.product.id}>
                  <span>{it.product.name} <em>× {it.quantity}</em></span>
                  <span>{fmt(Number(it.product.price) * it.quantity)}</span>
                </li>
              ))}
            </ul>

            {/* Coupon */}
            <div className="coupon-box">
              {coupon ? (
                <div className="coupon-applied">
                  <div>
                    <span className="coupon-code">{coupon.code}</span>
                    <span className="coupon-save">You save {fmt(coupon.discount)}</span>
                  </div>
                  <button type="button" className="coupon-remove" onClick={removeCoupon}>Remove</button>
                </div>
              ) : (
                <div className="coupon-input-row">
                  <input
                    type="text"
                    placeholder="Coupon code (e.g. WELCOME10)"
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value); setCouponMsg('') }}
                    aria-label="Coupon code"
                  />
                  <button type="button" className="btn btn-outline btn-sm" onClick={applyCoupon} disabled={couponBusy}>
                    {couponBusy ? '…' : 'Apply'}
                  </button>
                </div>
              )}
              {couponMsg && <p className={`coupon-msg${coupon ? ' ok' : ' err'}`}>{couponMsg}</p>}
            </div>

            <div className="checkout-summary">
              <div className="checkout-row">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {coupon && (
                <div className="checkout-row checkout-discount">
                  <span>Discount ({coupon.code})</span>
                  <span>− {fmt(coupon.discount)}</span>
                </div>
              )}
              <div className="checkout-row">
                <span>Shipping</span>
                {shippingFee > 0 ? (
                  <span>{fmt(shippingFee)}</span>
                ) : (
                  <span className="checkout-free">Free</span>
                )}
              </div>
              {shippingCfg.fee > 0 && shippingCfg.free_shipping_min > 0 && subtotal < shippingCfg.free_shipping_min && (
                <p className="free-ship-hint">
                  Add {fmt(shippingCfg.free_shipping_min - subtotal)} more for free shipping
                </p>
              )}
              <div className="checkout-row checkout-total">
                <span>Total</span>
                <span>{fmt(payable)}</span>
              </div>
            </div>

            <div className="field">
              <label htmlFor="cart-address">Delivery address</label>
              <textarea
                id="cart-address"
                required
                minLength={10}
                rows={3}
                placeholder="Flat / house, street, city, PIN code"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {error && <div className="auth-error" role="alert">{error}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner-ring" aria-hidden="true" />
                  Connecting to PhonePe…
                </>
              ) : (
                <>Pay with PhonePe · {fmt(payable)}</>
              )}
            </button>
            <p className="checkout-secure">
              <span aria-hidden="true">🔒</span> Secured by PhonePe Payment Gateway · UPI, cards & netbanking
            </p>
          </form>
        )}
      </aside>
    </>
  )
}
