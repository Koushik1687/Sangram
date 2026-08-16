import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import StarField from '../components/StarField'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { openInvoice } from '../lib/invoice'
import { imageUrl } from '../lib/data'
import { SIGNS } from '../lib/horoscope'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

const STATUS_META = {
  PENDING: { label: 'Payment pending', cls: 'status-pending' },
  PAID: { label: 'Paid', cls: 'status-paid' },
  COMPLETED: { label: 'Completed', cls: 'status-paid' },
  CANCELLED: { label: 'Cancelled', cls: 'status-cancelled' },
  REFUNDED: { label: 'Refunded', cls: 'status-cancelled' },
}

const BOOKING_STATUS = {
  PENDING: { label: 'Pending', cls: 'status-pending' },
  CONFIRMED: { label: 'Confirmed', cls: 'status-paid' },
  CANCELLED: { label: 'Cancelled', cls: 'status-cancelled' },
}

function statusInfo(status) {
  return STATUS_META[String(status || '').toUpperCase()] || { label: status || 'Unknown', cls: 'status-pending' }
}

function bookingInfo(status) {
  return BOOKING_STATUS[String(status || '').toUpperCase()] || { label: status || 'Pending', cls: 'status-pending' }
}

const TABS = [
  { key: 'profile', label: 'My Profile', icon: '👤' },
  { key: 'appointments', label: 'Appointments', icon: '🕐' },
  { key: 'orders', label: 'My Orders', icon: '🛍️' },
  { key: 'password', label: 'Change Password', icon: '🔒' },
]

export default function Account() {
  const { user, ready, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('profile')

  const [orders, setOrders] = useState(null)
  const [bookings, setBookings] = useState(null)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(null)

  /* Profile form */
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')
  const [zodiac, setZodiac] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  /* Password form */
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passBusy, setPassBusy] = useState(false)
  const [passMsg, setPassMsg] = useState('')

  useEffect(() => {
    if (!user) return
    setName(user.name || '')
    setPhone(user.phone || '')
    setAge(user.age ? String(user.age) : '')
    setZodiac(user.zodiac_sign || '')
  }, [user])

  useEffect(() => {
    if (!ready || !user) return
    api
      .get('/orders', { customer: true })
      .then(setOrders)
      .catch((err) => setError(err.message || 'Could not load your orders.'))
    api
      .get('/users/me/bookings', { customer: true })
      .then(setBookings)
      .catch(() => { /* appointments are optional — don't block the page */ })
  }, [ready, user])

  if (!ready) {
    return (
      <div className="page-shell page-main center">
        <div className="page-spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login?next=/account" replace />

  function handleLogout() {
    logout()
    navigate('/')
  }

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setProfileMsg('')
    setError('')
    try {
      const updated = await api.put(
        '/users/me',
        {
          name: name.trim(),
          phone: phone.trim(),
          age: age === '' ? null : Number(age),
          zodiac_sign: zodiac || null,
        },
        { customer: true },
      )
      updateUser(updated)
      setProfileMsg('Profile saved ✓')
    } catch (err) {
      setError(err.message || 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  async function onPhotoPick(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    setPhotoBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('photo', file)
      const updated = await api.uploadCustomer('/users/me/photo', fd)
      updateUser(updated)
      setProfileMsg('Photo updated ✓')
    } catch (err) {
      setError(err.message || 'Photo upload failed.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    setPassBusy(true)
    setPassMsg('')
    setError('')
    if (newPass.length < 6) {
      setPassMsg('New password must be at least 6 characters.')
      setPassBusy(false)
      return
    }
    if (newPass !== confirmPass) {
      setPassMsg('New passwords do not match.')
      setPassBusy(false)
      return
    }
    try {
      await api.post(
        '/users/me/password',
        { current_password: curPass, new_password: newPass },
        { customer: true },
      )
      setPassMsg('Password changed ✓')
      setCurPass('')
      setNewPass('')
      setConfirmPass('')
    } catch (err) {
      setPassMsg(err.message || 'Could not change password.')
    } finally {
      setPassBusy(false)
    }
  }

  async function payNow(order) {
    setPaying(order.id)
    setError('')
    try {
      const pay = await api.post(
        '/payments/initiate',
        {
          amount: order.total,
          customer_name: user.name,
          customer_phone: user.phone || '',
          customer_email: user.email,
          order_id: order.id,
          redirect_url: `${window.location.origin}/payment-status`,
        },
        { customer: false },
      )
      window.location.href =
        pay.redirect_url || `${window.location.origin}/payment-status?orderId=${pay.merchant_order_id}`
    } catch (err) {
      setError(err.message || 'Could not start payment.')
      setPaying(null)
    }
  }

  const avatarSrc = photoPreview || imageUrl(user.photo_url)
  const zodiacLabel = SIGNS.find((s) => s.n === zodiac)?.glyph

  return (
    <div className="page-shell">
      <StarField />
      <div className="cosmic-wash"></div>
      <Navbar />

      <main className="page-main">
        <div className="container" style={{ maxWidth: 980 }}>
          <div className="account-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>My Account</div>
              <h2 style={{ fontSize: 'clamp(1.8rem,3.4vw,2.6rem)', margin: 0 }}>Hello, {user.name} ✦</h2>
              <p className="account-sub">{user.email}{user.phone ? ` · ${user.phone}` : ''}</p>
            </div>
            <div className="account-head-actions">
              <Link to="/shop" className="btn btn-outline btn-sm">Continue shopping</Link>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout}>Log out</button>
            </div>
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <div className="account-layout">
            <nav className="account-tabs" aria-label="Account sections">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={tab === t.key ? 'active' : ''}
                  onClick={() => setTab(t.key)}
                >
                  <span className="account-tab-icon" aria-hidden="true">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="account-panel">
              {/* ---------- Profile ---------- */}
              {tab === 'profile' && (
                <section>
                  <h3 className="account-section-title">Client details</h3>
                  <div className="profile-card">
                    <div className="profile-avatar">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={`${user.name} photo`} />
                      ) : (
                        <span>{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                      )}
                      <label className={`profile-photo-btn${photoBusy ? ' busy' : ''}`}>
                        {photoBusy ? 'Uploading…' : 'Change photo'}
                        <input type="file" accept="image/*" onChange={onPhotoPick} disabled={photoBusy} />
                      </label>
                    </div>

                    <form className="profile-form" onSubmit={saveProfile}>
                      <div className="form-grid">
                        <div className="field">
                          <label htmlFor="pfName">Name</label>
                          <input id="pfName" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
                        </div>
                        <div className="field">
                          <label htmlFor="pfPhone">Phone</label>
                          <input id="pfPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                        </div>
                        <div className="field">
                          <label htmlFor="pfAge">Age</label>
                          <input id="pfAge" type="number" min={1} max={120} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 32" />
                        </div>
                        <div className="field">
                          <label htmlFor="pfZodiac">Zodiac sign</label>
                          <select id="pfZodiac" value={zodiac} onChange={(e) => setZodiac(e.target.value)}>
                            <option value="">Select your sign…</option>
                            {SIGNS.map((s) => (
                              <option key={s.key} value={s.n}>{s.glyph} {s.n} ({s.bn})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {profileMsg && <div className="account-msg ok" role="status">{profileMsg}</div>}

                      <div className="profile-form-foot">
                        <span className="field-static"><strong>Email</strong> {user.email}</span>
                        {zodiacLabel && zodiac && (
                          <span className="field-static"><strong>Zodiac</strong> {zodiacLabel} {zodiac}</span>
                        )}
                        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                          {saving ? 'Saving…' : 'Save profile'}
                        </button>
                      </div>
                    </form>
                  </div>
                </section>
              )}

              {/* ---------- Appointments ---------- */}
              {tab === 'appointments' && (
                <section>
                  <h3 className="account-section-title">My appointments</h3>
                  {bookings === null ? (
                    <div className="account-loading">
                      <div className="page-spinner sm" />
                      <p>Loading your appointments…</p>
                    </div>
                  ) : bookings.length === 0 ? (
                    <div className="shop-empty">
                      <div className="shop-empty-icon">🕐</div>
                      <h3>No appointments yet</h3>
                      <p>Book a consultation and it will show up here.</p>
                      <Link to="/#contact" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                        Book an appointment
                      </Link>
                    </div>
                  ) : (
                    <div className="order-list">
                      {bookings.map((b) => {
                        const st = bookingInfo(b.status)
                        return (
                          <article className="order-card" key={b.id}>
                            <div className="order-head">
                              <div>
                                <div className="order-number">{b.service}</div>
                                <div className="order-date">
                                  {new Date(`${b.booking_date}T00:00:00`).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · {b.time_slot}
                                  {b.chamber_name ? ` · ${b.chamber_name}` : ''}
                                </div>
                              </div>
                              <span className={`status-badge ${st.cls}`}>{st.label}</span>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* ---------- Orders ---------- */}
              {tab === 'orders' && (
                <section>
                  <h3 className="account-section-title">Order history</h3>
                  {orders === null ? (
                    <div className="account-loading">
                      <div className="page-spinner sm" />
                      <p>Loading your orders…</p>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="shop-empty">
                      <div className="shop-empty-icon">🛍️</div>
                      <h3>No orders yet</h3>
                      <p>Your purchased items and their payment status will appear here.</p>
                      <Link to="/shop" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                        Visit the shop
                      </Link>
                    </div>
                  ) : (
                    <div className="order-list">
                      {orders.map((o) => {
                        const st = statusInfo(o.status)
                        const canPay = o.status === 'PENDING'
                        return (
                          <article className="order-card" key={o.id}>
                            <div className="order-head">
                              <div>
                                <div className="order-number">{o.order_number}</div>
                                <div className="order-date">{new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                              </div>
                              <span className={`status-badge ${st.cls}`}>{st.label}</span>
                            </div>

                            <ul className="order-items">
                              {(o.items || []).map((it) => (
                                <li key={it.id}>
                                  <span className="order-item-name">
                                    {it.product_name} <em>× {it.quantity}</em>
                                  </span>
                                  <span className="order-item-price">{fmt(it.price * it.quantity)}</span>
                                </li>
                              ))}
                            </ul>

                            {o.address && <div className="order-address">📍 {o.address}</div>}

                            {Number(o.discount) > 0 && (
                              <div className="order-discount-line">
                                <span>Coupon {o.coupon_code} applied</span>
                                <span>− {fmt(o.discount)}</span>
                              </div>
                            )}

                            {Number(o.shipping_fee) > 0 && (
                              <div className="order-discount-line">
                                <span>Shipping</span>
                                <span>{fmt(o.shipping_fee)}</span>
                              </div>
                            )}

                            <div className="order-foot">
                              <div className="order-total">
                                Total <strong>{fmt(o.total)}</strong>
                              </div>
                              {canPay && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={paying === o.id}
                                  onClick={() => payNow(o)}
                                >
                                  {paying === o.id ? 'Connecting…' : 'Pay now with PhonePe'}
                                </button>
                              )}
                              {['PAID', 'COMPLETED'].includes(o.status) && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => openInvoice(o, {
                                    customer_name: user?.name,
                                    customer_email: user?.email,
                                    customer_phone: user?.phone,
                                  })}
                                >
                                  ⬇ Invoice
                                </button>
                              )}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* ---------- Change password ---------- */}
              {tab === 'password' && (
                <section>
                  <h3 className="account-section-title">Change password</h3>
                  <form className="password-form" onSubmit={changePassword}>
                    <div className="field">
                      <label htmlFor="curPass">Current password</label>
                      <input
                        id="curPass"
                        type="password"
                        value={curPass}
                        onChange={(e) => setCurPass(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="newPass">New password</label>
                      <input
                        id="newPass"
                        type="password"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="confirmPass">Confirm new password</label>
                      <input
                        id="confirmPass"
                        type="password"
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                      />
                    </div>

                    {passMsg && (
                      <div className={`account-msg ${passMsg.includes('✓') ? 'ok' : 'err'}`} role="status">{passMsg}</div>
                    )}

                    <button type="submit" className="btn btn-primary btn-sm" disabled={passBusy}>
                      {passBusy ? 'Saving…' : 'Update password'}
                    </button>
                  </form>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
