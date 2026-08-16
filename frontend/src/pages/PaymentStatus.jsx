import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import StarField from '../components/StarField'
import { API_BASE, api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { openInvoice } from '../lib/invoice'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const PAID_STATES = ['PAYMENT_SUCCESS', 'COMPLETED', 'PAID', 'SUCCESS', 'AUTHORIZED']
const MAX_POLLS = 6 // ~24s of polling before showing the pending state

export default function PaymentStatus() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const isMock = searchParams.get('mock') === 'true'

  const [phase, setPhase] = useState('loading') // loading | paid | pending | failed
  const [payment, setPayment] = useState(null)
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const fetchedOrder = useRef(false)

  useEffect(() => {
    if (!orderId) {
      setPhase('failed')
      setError('No Order ID found in the payment callback URL.')
      return undefined
    }

    let stopped = false
    let attempts = 0

    const tick = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/payments/status/${orderId}`)
        if (!res.ok) throw new Error('Payment record not found')
        const data = await res.json()
        if (stopped) return

        setPayment(data)
        // Load the customer's order once the payment links to one
        if (data.order_id && user && !fetchedOrder.current) {
          fetchedOrder.current = true
          api
            .get(`/orders/${data.order_id}`, { customer: true })
            .then(setOrder)
            .catch(() => { /* session may have expired — payment info still shows */ })
        }

        // Settled? Show success. Otherwise show "being processed" right away
        // and keep polling in the background for a late gateway callback.
        if (PAID_STATES.includes(String(data.status).toUpperCase())) {
          setPhase('paid')
          return
        }
        setPhase('pending')
        attempts += 1
        if (attempts < MAX_POLLS) setTimeout(tick, 4000)
      } catch (err) {
        if (stopped) return
        setError(err.message || 'Error checking payment status')
        setPhase('failed')
      }
    }

    tick()
    return () => { stopped = true }
  }, [orderId, user])

  const paid = phase === 'paid'

  return (
    <div className="page-shell">
      <StarField />
      <div className="cosmic-wash"></div>
      <Navbar />

      <main className="page-main center top">
        <div className="auth-card wide" style={{ marginTop: 20 }}>
          {/* Status header */}
          <div className="status-head">
            {phase === 'loading' && (
              <>
                <div className="spinner-ring status-spinner" aria-hidden="true" />
                <h2>Verifying payment…</h2>
                <p>Checking the status with PhonePe — this takes a few seconds.</p>
              </>
            )}
            {phase === 'paid' && (
              <>
                <div className="status-icon ok" aria-hidden="true">✓</div>
                <h2>Payment successful — thank you! ✦</h2>
                <p>Your order is confirmed and being prepared for dispatch.</p>
              </>
            )}
            {phase === 'pending' && (
              <>
                <div className="status-icon pending" aria-hidden="true">◷</div>
                <h2>Payment is being processed</h2>
                <p>
                  Your order was placed. If you paid, the confirmation will appear in
                  {' '}<Link to="/account" className="status-link">My orders</Link> shortly.
                </p>
              </>
            )}
            {phase === 'failed' && (
              <>
                <div className="status-icon fail" aria-hidden="true">✕</div>
                <h2>Payment verification failed</h2>
                <p>{error}</p>
              </>
            )}
          </div>

          {isMock && (
            <div className="mock-banner">
              ⚡ Sandbox Mode — transaction initiated and recorded via the PhonePe Node SDK. No real money moved.
            </div>
          )}

          {/* Order receipt */}
          {order && (
            <div className="receipt">
              <div className="receipt-head">
                <div>
                  <div className="receipt-label">Order</div>
                  <div className="receipt-order-number">{order.order_number}</div>
                </div>
                <span className={`status-badge ${paid ? 'status-paid' : 'status-pending'}`}>
                  {paid ? 'Paid' : order.status}
                </span>
              </div>

              <ul className="order-items">
                {(order.items || []).map((it) => (
                  <li key={it.id}>
                    <span className="order-item-name">{it.product_name} <em>× {it.quantity}</em></span>
                    <span className="order-item-price">{fmt(Number(it.price) * it.quantity)}</span>
                  </li>
                ))}
              </ul>

              {Number(order.discount) > 0 && (
                <div className="order-discount-line" style={{ marginBottom: 10 }}>
                  <span>Coupon {order.coupon_code} applied</span>
                  <span>− {fmt(order.discount)}</span>
                </div>
              )}

              {Number(order.shipping_fee) > 0 && (
                <div className="order-discount-line" style={{ marginBottom: 10 }}>
                  <span>Shipping</span>
                  <span>{fmt(order.shipping_fee)}</span>
                </div>
              )}

              <div className="receipt-total">
                <span>Total paid</span>
                <strong>{fmt(order.total)}</strong>
              </div>

              {order.address && (
                <div className="order-address">📍 {order.address}</div>
              )}
            </div>
          )}

          {/* Payment info */}
          {payment && (
            <div className="checkout-summary" style={{ marginTop: 18 }}>
              <div className="checkout-row">
                <span>Gateway reference</span>
                <span className="mono">{payment.merchant_order_id}</span>
              </div>
              <div className="checkout-row">
                <span>Amount</span>
                <span>{fmt(payment.amount)}</span>
              </div>
              <div className="checkout-row">
                <span>Gateway status</span>
                <span className="mono">{payment.status || '—'}</span>
              </div>
              {payment.phonepe_transaction_id && (
                <div className="checkout-row">
                  <span>PhonePe transaction</span>
                  <span className="mono">{payment.phonepe_transaction_id}</span>
                </div>
              )}
              {payment.customer_name && (
                <div className="checkout-row">
                  <span>Customer</span>
                  <span>{payment.customer_name}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="status-actions">
            {paid && (
              <Link to="/account" className="btn btn-primary">View my orders</Link>
            )}
            {order && ['PAID', 'COMPLETED'].includes(order.status) && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => openInvoice(order, {
                  customer_name: user?.name || payment?.customer_name,
                  customer_email: user?.email,
                  customer_phone: user?.phone,
                })}
              >
                ⬇ Download invoice
              </button>
            )}
            <Link to="/shop" className="btn btn-outline">Continue shopping</Link>
            <Link to="/" className="btn btn-outline">Back to home</Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
