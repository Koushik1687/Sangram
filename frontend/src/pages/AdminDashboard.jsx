/* ==========================================================================
   AdminDashboard — auth-guarded admin panel: overview stats, appointment
   management, and generic CRUD for products / blogs / chambers / gallery,
   horoscope overrides, and enquiries. All data goes through the API.
   ========================================================================== */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, API_BASE } from '../lib/api'
import { getReading, SIGNS } from '../lib/horoscope'
import { withViewTransition } from '../lib/viewTransition'
import BottomNav from '../components/BottomNav'
import './admin/admin.css'

/* The four shop filter categories — keep admin entries aligned with the storefront */
const SHOP_CATEGORIES = ['Crystals', 'Vastu Items', 'Aura Cleansing Salt', 'Gemstones']

function absUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url) || url.startsWith('data:')) return url
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}

/* Thin-stroke icon set for row action buttons (replaces unreliable text glyphs) */
function Icon({ children, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

const IconEdit = () => (
  <Icon><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></Icon>
)

const IconTrash = () => (
  <Icon>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </Icon>
)

const IconX = () => (
  <Icon><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>
)

const IconRefund = () => (
  <Icon>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
)

const IconCheck = () => (
  <Icon size={17}><path d="M20 6 9 17l-5-5" /></Icon>
)

const IconSearch = () => (
  <Icon size={15}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>
)

/* Timetable / Schedule Options for Chambers */
const TIME_OPTIONS = [
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM', '08:30 PM', '09:00 PM',
]

const DAYS_LIST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function parseTiming(val) {
  if (!val) return { from: '11:00 AM', to: '07:00 PM' }
  const parts = val.split(/[–\-—]| to /i).map((s) => s.trim()).filter(Boolean)
  return {
    from: parts[0] || '11:00 AM',
    to: parts[1] || '07:00 PM',
  }
}

function ChamberTimingInput({ name, label, defaultValue, required }) {
  const parsed = parseTiming(defaultValue)
  const [from, setFrom] = useState(parsed.from)
  const [to, setTo] = useState(parsed.to)
  const [timingVal, setTimingVal] = useState(defaultValue || `${parsed.from} – ${parsed.to}`)

  const updateFrom = (newFrom) => {
    setFrom(newFrom)
    setTimingVal(`${newFrom} – ${to}`)
  }

  const updateTo = (newTo) => {
    setTo(newTo)
    setTimingVal(`${from} – ${newTo}`)
  }

  return (
    <div className="field">
      <label>{label || 'Schedule & Time Table'}</label>
      <div className="timetable-picker">
        <div className="timetable-row">
          <div className="timetable-col">
            <span className="timetable-sublabel">From</span>
            <select
              value={from}
              onChange={(e) => updateFrom(e.target.value)}
              className="timetable-select"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="timetable-sep">to</div>
          <div className="timetable-col">
            <span className="timetable-sublabel">To</span>
            <select
              value={to}
              onChange={(e) => updateTo(e.target.value)}
              className="timetable-select"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="timetable-preview-wrap">
          <span className="field-hint">Selected Timing:</span>
          <span className="timetable-preview">⏰ {timingVal || 'Not set'}</span>
        </div>

        <input
          type="hidden"
          name={name}
          value={timingVal}
          required={required}
        />
      </div>
    </div>
  )
}

function ChamberDaysInput({ name, label, defaultValue, required }) {
  const [daysText, setDaysText] = useState(defaultValue || 'Mon – Sat')

  const toggleDay = (day) => {
    const current = daysText.split(/[,–\-]/).map((s) => s.trim()).filter(Boolean)
    let next
    if (current.includes(day)) {
      next = current.filter((d) => d !== day)
    } else {
      next = [...current, day]
    }
    next.sort((a, b) => DAYS_LIST.indexOf(a) - DAYS_LIST.indexOf(b))
    setDaysText(next.join(', ') || '')
  }

  return (
    <div className="field">
      <label>{label || 'Consultation Days'}</label>
      <div className="days-picker">
        <div className="days-chips">
          {DAYS_LIST.map((d) => {
            const active = daysText.toLowerCase().includes(d.toLowerCase())
            return (
              <button
                key={d}
                type="button"
                className={`day-btn${active ? ' active' : ''}`}
                onClick={() => toggleDay(d)}
                title={`Toggle ${d}`}
              >
                {d}
              </button>
            )
          })}
        </div>
        <input
          type="text"
          name={name}
          value={daysText}
          onChange={(e) => setDaysText(e.target.value)}
          placeholder="e.g. Mon – Sat or Tue, Thu, Sat"
          required={required}
        />
      </div>
    </div>
  )
}

const VIEW_TITLES = {
  overview: 'Overview',
  appointments: 'Appointments',
  orders: 'Orders',
  clients: 'Clients',
  products: 'Products Management',
  categories: 'Categories',
  coupons: 'Coupons',
  blogs: 'Blog Management',
  horoscope: 'Daily Horoscope',
  chambers: 'Chamber Management',
  gallery: 'Gallery Management',
  enquiries: 'Customer Enquiries',
}

const NAV = [
  { view: 'overview', ic: '▣', label: 'Overview' },
  { view: 'appointments', ic: '◷', label: 'Appointments' },
  { view: 'orders', ic: '☰', label: 'Orders' },
  { view: 'clients', ic: '👥', label: 'Clients' },
  { view: 'products', ic: '◆', label: 'Products' },
  { view: 'categories', ic: '❖', label: 'Categories' },
  { view: 'coupons', ic: '◈', label: 'Coupons' },
  { view: 'blogs', ic: '✎', label: 'Blog' },
  { view: 'horoscope', ic: '✦', label: 'Daily Horoscope' },
  { view: 'chambers', ic: '📍', label: 'Chambers' },
  { view: 'gallery', ic: '▦', label: 'Gallery' },
  { view: 'enquiries', ic: '✉', label: 'Enquiries' },
]

/* Add/edit form schemas (mirrors the original admin.js) */
const SCHEMAS = {
  products: {
    title: 'Product', endpoint: '/products', fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'select', options: SHOP_CATEGORIES, required: true },
      { name: 'price', label: 'Price (₹)', type: 'number', required: true },
      { name: 'stock', label: 'Stock (units, blank = unlimited)', type: 'number' },
      { name: 'low_stock_threshold', label: 'Low-stock alert threshold (blank = 5, 0 = off)', type: 'number' },
      { name: 'desc', label: 'Description', type: 'textarea' },
      { name: 'image', label: 'Photo', type: 'file' },
    ],
    toPayload: (v) => ({
      name: v.name, category: v.category, price: Number(v.price), description: v.desc,
      stock: v.stock === '' || v.stock == null ? null : Number(v.stock),
      low_stock_threshold: v.low_stock_threshold === '' || v.low_stock_threshold == null
        ? null
        : Number(v.low_stock_threshold),
    }),
  },
  blogs: {
    title: 'Blog Post', endpoint: '/blogs', fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'text', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'desc', label: 'Short Description', type: 'textarea' },
    ],
    toPayload: (v) => ({ title: v.title, category: v.category, excerpt: v.desc, published_at: v.date }),
  },
  chambers: {
    title: 'Chamber', endpoint: '/chambers', fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'address', label: 'Address', type: 'text', required: true },
      { name: 'consultation_days', label: 'Consultation Days', type: 'days', required: true },
      { name: 'timing', label: 'Schedule & Time Table', type: 'timing', required: true },
      { name: 'phone', label: 'Phone', type: 'text', required: true },
    ],
    toPayload: (v) => ({
      name: v.name, address: v.address, consultation_days: v.consultation_days, timing: v.timing, phone: v.phone,
    }),
  },
  gallery: {
    title: 'Gallery Image', endpoint: '/gallery', fields: [
      { name: 'label', label: 'Label / Caption', type: 'text', required: true },
    ],
    toPayload: (v) => ({ label: v.label }),
  },
  coupons: {
    title: 'Coupon', endpoint: '/coupons', fields: [
      { name: 'code', label: 'Code (auto-uppercased)', type: 'text', required: true },
      { name: 'discount_type', label: 'Discount type', type: 'select', options: ['percent', 'flat'], required: true },
      { name: 'discount_value', label: 'Value (e.g. 10 for 10%, or 200 for ₹200 off)', type: 'number', required: true },
      { name: 'min_order_amount', label: 'Minimum order (₹, 0 = none)', type: 'number' },
      { name: 'max_discount', label: 'Max discount cap in ₹ (percent only, optional)', type: 'number' },
      { name: 'valid_until', label: 'Valid until (optional)', type: 'date' },
      { name: 'usage_limit', label: 'Usage limit (0 = unlimited)', type: 'number' },
    ],
    toPayload: (v) => ({
      code: v.code, discount_type: v.discount_type, discount_value: Number(v.discount_value),
      min_order_amount: Number(v.min_order_amount) || 0,
      max_discount: v.max_discount ? Number(v.max_discount) : undefined,
      valid_until: v.valid_until || undefined,
      usage_limit: Number(v.usage_limit) || 0,
    }),
  },
}

/* Friendly labels for ad-hoc delete targets that aren't CRUD schemas */
const ENTITY_NAMES = {
  '/bookings': 'appointment',
  '/users': 'client',
  '/enquiries': 'enquiry',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [view, setView] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [coupons, setCoupons] = useState([])
  const [blogs, setBlogs] = useState([])
  const [chambers, setChambers] = useState([])
  const [gallery, setGallery] = useState([])
  const [bookings, setBookings] = useState([])
  const [orders, setOrders] = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [clients, setClients] = useState([])
  const [clientQuery, setClientQuery] = useState('')
  const [openClients, setOpenClients] = useState({})
  const [overrides, setOverrides] = useState({})
  const [modal, setModal] = useState(null)
  const [modalBusy, setModalBusy] = useState(false)
  /* Synchronous guard against double/triple-taps: React state updates are
     batched, so a ref is the only thing that blocks a second submit in the
     same tick (a plain state check lets rapid taps create duplicate rows). */
  const modalBusyRef = useRef(false)
  const [confirm, setConfirm] = useState(null)
  const [productQuery, setProductQuery] = useState('')
  const [digestMsg, setDigestMsg] = useState('')
  const [digestBusy, setDigestBusy] = useState(false)

  const openModal = (m) => withViewTransition(() => setModal(m))
  const closeModal = () => withViewTransition(() => setModal(null))
  const askConfirm = (c) => withViewTransition(() => setConfirm(c))

  /* Client-side product search (name or category) */
  const productQueryLower = productQuery.trim().toLowerCase()
  const visibleProducts = productQueryLower
    ? products.filter((p) =>
        (p.name || '').toLowerCase().includes(productQueryLower)
        || (p.category || '').toLowerCase().includes(productQueryLower))
    : products

  /* Category options for the product form: top-level categories first,
     then their sub-categories (indented). Always usable even when a
     product's category is not in the managed list (legacy / removed). */
  const categoryOptions = (() => {
    const opts = []
    for (const t of categories.filter((c) => !c.parent_id)) {
      opts.push({ value: t.name, label: t.name })
      for (const s of categories.filter((x) => x.parent_id === t.id)) {
        opts.push({ value: s.name, label: `— ${s.name}` })
      }
    }
    return opts
  })()

  /* ---------- Categories manager (pending changes, committed via Save Changes) ---------- */
  const [catWork, setCatWork] = useState(null)
  const catSourceRef = useRef(null)
  const catNextKey = useRef(1)
  const catAdd = (parentKey) => setCatWork((w) => [...w, {
    key: `n${catNextKey.current++}`, id: null, name: '', parentId: parentKey, isNew: true, removed: false,
  }])
  const catSetName = (key, name) => setCatWork((w) => w.map((r) => (r.key === key ? { ...r, name } : r)))
  const catRemove = (key) => setCatWork((w) => w.map((r) => (r.key === key ? { ...r, removed: true } : r)))
  const catUndo = (key) => setCatWork((w) => w.map((r) => (r.key === key ? { ...r, removed: false } : r)))
  const catDiscard = () => setCatWork(null)
  const catChanged = catWork && (catWork.some((r) => r.isNew && r.name.trim()) || catWork.some((r) => r.removed))
  const catSave = async () => {
    const w = catWork || []
    const toCreate = w.filter((r) => r.isNew && !r.removed && r.name.trim())
    const toRemove = w.filter((r) => !r.isNew && r.removed)
    if (!toCreate.length && !toRemove.length) return
    const idMap = new Map()
    const parentIdOf = (r) => {
      if (r.parentId == null) return null
      if (String(r.parentId).startsWith('e')) return Number(String(r.parentId).slice(1))
      return idMap.get(String(r.parentId)) ?? undefined
    }
    try {
      const pending = [...toCreate]
      while (pending.length) {
        const batch = pending.filter((r) => parentIdOf(r) !== undefined)
        if (!batch.length) throw new Error('A sub-category\'s parent could not be created')
        for (const r of batch) {
          const res = await api.post('/categories', { name: r.name.trim(), parent_id: parentIdOf(r) })
          idMap.set(r.key, res.id)
          pending.splice(pending.indexOf(r), 1)
        }
      }
      for (const r of toRemove) await api.delete(`/categories/${r.id}`)
      /* Rebuild the working list straight from the fresh API response so the
         view reflects the saved state immediately (no stale-list flash). */
      const fresh = await api.get('/categories')
      setCategories(fresh)
      catSourceRef.current = fresh
      setCatWork(fresh.map((c) => ({
        key: `e${c.id}`, id: c.id, name: c.name, parentId: c.parent_id ? `e${c.parent_id}` : null, isNew: false, removed: false,
      })))
      loadAll()
      showToast('Categories saved')
    } catch (err) {
      setLoadError(err.message || 'Could not save categories')
    }
  }

  /* Build the working list when entering the Categories view, and re-sync
     only when the categories source reference actually changes (e.g. after
     an external refresh) — never mid-edit. */
  useEffect(() => {
    if (view !== 'categories') return
    if (catSourceRef.current === categories) return
    catSourceRef.current = categories
    setCatWork(categories.map((c) => ({
      key: `e${c.id}`, id: c.id, name: c.name, parentId: c.parent_id ? `e${c.parent_id}` : null, isNew: false, removed: false,
    })))
  }, [view, categories])

  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const showToast = (msg, type = 'success') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, type, leaving: false })
    toastTimer.current = setTimeout(() => {
      setToast((t) => (t ? { ...t, leaving: true } : t))
      toastTimer.current = setTimeout(() => setToast(null), 320)
    }, 2800)
  }

  const loadAll = useCallback(async () => {
    try {
      const [p, cats, co, b, c, g, bk, o, en, ho, us] = await Promise.all([
        api.get('/products'), api.get('/categories'), api.get('/coupons'), api.get('/blogs'), api.get('/chambers'), api.get('/gallery'),
        api.get('/bookings'), api.get('/orders/all'), api.get('/enquiries'), api.get(`/horoscope?date=${todayStr()}`),
        api.get('/users'),
      ])
      setProducts(p)
      setCategories(cats || [])
      setCoupons(co)
      setBlogs(b)
      setChambers(c)
      setGallery(g)
      setBookings(bk)
      setOrders(o)
      setEnquiries(en)
      setClients(us)
      setOverrides(Object.fromEntries((ho || []).map((r) => [r.zodiac_sign.toLowerCase(), r])))
      setLoadError('')
    } catch {
      setLoadError('Could not load data — please check your connection and try again.')
    }
  }, [])

  useEffect(() => {
    if (api.isLoggedIn()) loadAll()
  }, [loadAll])

  if (!api.isLoggedIn()) return <Navigate to="/admin/login" replace />

  function logout() {
    api.logout()
    navigate('/admin/login')
  }

  /* Send yesterday's sales digest on demand (same email the scheduler sends) */
  function sendDigest() {
    setDigestBusy(true)
    setDigestMsg('')
    api.post('/notifications/digest', {})
      .then((res) => setDigestMsg(res.sent
        ? '✅ Daily sales digest sent to the admin inbox.'
        : '⚠️ Digest skipped — set MAILERSEND_API_KEY and ADMIN_ALERT_EMAIL in backend/.env.'))
      .catch(() => setDigestMsg('Send failed — please try again.'))
      .finally(() => setDigestBusy(false))
  }

  function del(entity, id) {
    const label = entity.title
      ? entity.title.toLowerCase()
      : (ENTITY_NAMES[entity.endpoint] || 'item')
    askConfirm({
      title: `Delete ${label}?`,
      message: `This will permanently remove this ${label}. This can't be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => api
        .delete(`${entity.endpoint}/${id}`)
        .then(() => { loadAll(); showToast(`${label.charAt(0).toUpperCase()}${label.slice(1)} deleted`) })
        .catch((err) => {
          const msg = err?.message || 'Delete failed — please try again.'
          setLoadError(msg)
          showToast(msg, 'error')
        }),
    })
  }

  function saveEntity(e) {
    e.preventDefault()
    if (modalBusyRef.current) return // guard against double-taps creating duplicates
    modalBusyRef.current = true
    setModalBusy(true)
    const fd = new FormData(e.target)
    const values = {}
    modal.schema.fields.forEach((f) => { values[f.name] = fd.get(f.name) })
    const payload = modal.schema.toPayload(values)
    const rawImage = values.image
    const hasImageFile = rawImage instanceof File && rawImage.size > 0 && !!rawImage.name
    const imageFile = hasImageFile ? rawImage : null
    const req = modal.id
      ? api.put(`${modal.schema.endpoint}/${modal.id}`, payload)
      : api.post(modal.schema.endpoint, payload)
    const savedMsg = `${modal.id ? 'Updated' : 'Added'} ${modal.schema.title}`
    const done = () => { closeModal(); loadAll(); showToast(savedMsg) }
    req
      .then((res) => {
        const id = modal.id || res?.id
        if (imageFile && id) {
          const imgFd = new FormData()
          imgFd.append('image', imageFile)
          return api.upload(`/products/${id}/image`, imgFd)
            .then(done)
        }
        done()
      })
      .catch((err) => {
        const msg = err?.message || 'Save failed — please try again.'
        setLoadError(msg)
        showToast(msg, 'error')
      })
      .finally(() => { modalBusyRef.current = false; setModalBusy(false) })
  }

  function saveHoroscope(e) {
    e.preventDefault()
    if (modalBusyRef.current) return // guard against double-taps creating duplicates
    modalBusyRef.current = true
    setModalBusy(true)
    const fd = new FormData(e.target)
    api
      .put(`/horoscope/${modal.sign.key}`, {
        reading_date: todayStr(),
        message: fd.get('text'),
        lucky_color: fd.get('color'),
        lucky_number: fd.get('number'),
        mood: fd.get('mood'),
      })
      .then(() => { closeModal(); loadAll(); showToast('Horoscope updated') })
      .catch(() => setLoadError('Save failed — please try again.'))
      .finally(() => { modalBusyRef.current = false; setModalBusy(false) })
  }

  function setBookingStatus(id, status) {
    api.patch(`/bookings/${id}/status`, { status })
      .then(() => {
        setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, status } : b)))
        showToast(`Appointment marked ${status}`)
      })
      .catch(() => setLoadError('Update failed — please try again.'))
  }

  /* Cancel an order — stock is restored server-side */
  function cancelOrder(o) {
    askConfirm({
      title: `Cancel order ${o.order_number}?`,
      message: 'The order will be marked as cancelled and its items returned to stock.',
      confirmLabel: 'Cancel order',
      onConfirm: () => api.patch(`/orders/${o.id}/status`, { status: 'CANCELLED' })
        .then(() => { loadAll(); showToast(`Order ${o.order_number} cancelled`) })
        .catch(() => setLoadError('Cancel failed — please try again.')),
    })
  }

  /* Refund a paid order via PhonePe — stock is restored after a successful refund */
  function refundOrder(o) {
    if (!o.payment) return setLoadError('No PhonePe payment found for this order')
    askConfirm({
      title: `Refund order ${o.order_number}?`,
      message: `Refund ₹${Number(o.total).toLocaleString('en-IN')} via PhonePe. Items will be returned to stock.`,
      confirmLabel: 'Refund',
      onConfirm: () => api.post('/payments/refund', { merchant_order_id: o.payment.merchant_order_id, amount: o.total })
        .then(() => { loadAll(); showToast(`Refund initiated for ${o.order_number}`) })
        .catch((err) => setLoadError(err.message || 'Refund failed — PhonePe sandbox may need live credentials')),
    })
  }

  const stat = (n) => <div className="stat-card"><span>{n[0]}</span><strong>{n[1]}</strong></div>
  const badge = (s) => <span className={`badge ${(s || 'pending').toLowerCase()}`}>{s || 'Pending'}</span>
  const emptyRow = (colspan, text) => (
    <tr><td colSpan={colspan}><div className="empty-state">{text}</div></td></tr>
  )
  const toggleClient = (id) => setOpenClients((o) => ({ ...o, [id]: !o[id] }))

  return (
    <div className="admin-body">
      <div className="admin-shell">
        <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} id="sidebar">
          <div className="brand">
            <span className="brand-mark">
              <img src="/images/logo/Sree Sangram logo.png" alt="Sree Sangram Logo" decoding="async" />
            </span>
            <span className="brand-text"><span className="en">শ্রী সংগ্রাম</span></span>
          </div>
          <nav className="admin-nav" id="adminNav">
            {NAV.map((n) => (
              <button
                key={n.view}
                data-view={n.view}
                className={view === n.view ? 'active' : ''}
                onClick={() => { setView(n.view); setSidebarOpen(false) }}
              >
                <span className="ic">{n.ic}</span> {n.label}
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-foot">
            <button className="btn btn-outline btn-block" onClick={logout}>Logout</button>
          </div>
        </aside>

        <div className="admin-main">
          <div className="admin-topbar">
            <div className="topbar-title-group">
              <button className="sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)}>☰</button>
              <h1>{VIEW_TITLES[view]}</h1>
            </div>
            <Link to="/" className="btn btn-outline btn-sm" target="_blank">View Website ↗</Link>
          </div>

          <div className="admin-content">
            {loadError && <div className="empty-state" style={{ color: 'var(--danger)' }}>{loadError}</div>}

            {/* ------- Overview ------- */}
            {view === 'overview' && (
              <section id="view-overview" className="view">
                <div className="stat-row">
                  {stat(['Total Appointments', bookings.length])}
                  {stat(['Products', products.length])}
                  {stat(['Active Coupons', coupons.filter((x) => x.is_active === 1).length])}
                  {stat(['New Enquiries', enquiries.length])}
                </div>
                <div className="panel">
                  <div className="panel-head">
                    <h2>Recent Appointments</h2>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {digestMsg && <span style={{ fontSize: '.78rem', color: 'var(--text-dim)' }}>{digestMsg}</span>}
                      <button className="btn btn-outline btn-sm" onClick={sendDigest} disabled={digestBusy}>
                        {digestBusy ? 'Sending…' : 'Send daily sales digest'}
                      </button>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Name</th><th>Service</th><th>Date</th><th>Status</th></tr></thead>
                      <tbody>
                        {bookings.length
                          ? bookings.slice(0, 5).map((b) => (
                            <tr key={b.id}>
                              <td className="strong">{b.client_name}</td>
                              <td>{b.service}</td>
                              <td>{b.booking_date}</td>
                              <td>{badge(b.status)}</td>
                            </tr>
                          ))
                          : emptyRow(4, 'No appointments yet')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* ------- Appointments ------- */}
            {view === 'appointments' && (
              <section id="view-appointments" className="view view-stack">
                <div className="panel">
                  <div className="panel-head"><h2>All Appointments</h2></div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Name</th><th>Phone</th><th>Service</th><th>Chamber</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th></tr></thead>
                      <tbody>
                        {bookings.length ? bookings.map((b) => (
                          <tr key={b.id}>
                            <td className="strong" data-label="Name">{b.client_name}</td>
                            <td data-label="Phone">{b.phone}</td>
                            <td data-label="Service">{b.service}</td>
                            <td data-label="Chamber">{b.chamber_name || b.chamber_id}</td>
                            <td data-label="Date">{b.booking_date}</td>
                            <td data-label="Time">{b.time_slot}</td>
                            <td data-label="Status">
                              <select
                                value={b.status}
                                onChange={(e) => setBookingStatus(b.id, e.target.value)}
                                style={{
                                  background: 'transparent', color: 'var(--text)',
                                  border: '1px solid var(--panel-line)', borderRadius: 6,
                                  padding: '4px 6px', fontSize: '.78rem',
                                }}
                              >
                                {['Pending', 'Confirmed', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
                              </select>
                            </td>
                            <td>
                              <button className="icon-btn danger" title="Delete appointment" onClick={() => del({ endpoint: '/bookings' }, b.id)}><IconTrash /></button>
                            </td>
                          </tr>
                        )) : emptyRow(8, 'No appointments available')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* ------- Orders ------- */}
            {view === 'orders' && (
              <section id="view-orders" className="view view-stack">
                <div className="panel">
                  <div className="panel-head"><h2>All Orders</h2></div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                      <tbody>
                        {orders.length ? orders.map((o) => (
                          <tr key={o.id}>
                            <td className="strong" data-label="Order">{o.order_number}</td>
                            <td data-label="Customer">
                              {o.customer_name || '—'}
                              <div style={{ fontSize: '.72rem', color: 'var(--text-dim)' }}>{o.customer_email || ''}</div>
                            </td>
                            <td className="td-multiline" data-label="Items" style={{ fontSize: '.8rem' }}>
                              {(o.items || []).map((it) => `${it.product_name} ×${it.quantity}`).join(', ')}
                              {Number(o.discount) > 0 && <div style={{ color: 'var(--success)' }}>Coupon {o.coupon_code} −₹{o.discount}</div>}
                              {Number(o.shipping_fee) > 0 && <div style={{ color: 'var(--text-dim)' }}>Shipping +₹{o.shipping_fee}</div>}
                            </td>
                            <td data-label="Total">₹{Number(o.total).toLocaleString('en-IN')}</td>
                            <td data-label="Status">{badge(o.status)}</td>
                            <td data-label="Date" style={{ fontSize: '.8rem' }}>{o.created_at?.slice(0, 10)}</td>
                            <td className="row-actions">
                              {['PENDING', 'PAID'].includes(o.status) && (
                                <button className="icon-btn danger" title="Cancel order" onClick={() => cancelOrder(o)}><IconX /></button>
                              )}
                              {o.status === 'PAID' && o.payment && (
                                <button className="icon-btn" title="Refund via PhonePe" onClick={() => refundOrder(o)}><IconRefund /></button>
                              )}
                            </td>
                          </tr>
                        )) : emptyRow(7, 'No orders yet')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* ------- Clients ------- */}
            {view === 'clients' && (() => {
              const q = clientQuery.trim().toLowerCase()
              const visibleClients = q
                ? clients.filter((c) =>
                    (c.name || '').toLowerCase().includes(q)
                    || (c.phone || '').toLowerCase().includes(q)
                    || (c.email || '').toLowerCase().includes(q))
                : clients
              return (
              <section id="view-clients" className="view view-stack">
                <div className="panel">
                  <div className="panel-head">
                    <h2>Registered Clients</h2>
                    <input
                      type="search"
                      className="client-search"
                      placeholder="Search by name, phone or email…"
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                      aria-label="Search clients"
                    />
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th></th><th>Client</th><th>Contact</th><th>Age</th><th>Zodiac</th><th>Orders</th><th>Bookings</th><th>Joined</th><th>Action</th></tr></thead>
                      <tbody>
                        {visibleClients.length ? visibleClients.map((cl) => {
                          const z = SIGNS.find((s) => s.n === cl.zodiac_sign)
                          const open = !!openClients[cl.id]
                          const statusCls = (s) => {
                            const k = String(s || '').toLowerCase()
                            if (['paid', 'completed', 'confirmed'].includes(k)) return 'confirmed'
                            if (['cancelled', 'refunded'].includes(k)) return 'cancelled'
                            return 'pending'
                          }
                          return (
                            <Fragment key={cl.id}>
                              <tr className={open ? 'client-open' : ''}>
                                <td>
                                  <button
                                    className="icon-btn client-toggle"
                                    onClick={() => toggleClient(cl.id)}
                                    title={open ? 'Hide appointments & orders' : 'Show appointments & orders'}
                                  >
                                    {open ? '▾' : '▸'}
                                  </button>
                                </td>
                                <td data-label="Client">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {cl.photo_url ? (
                                      <img className="client-avatar" src={absUrl(cl.photo_url)} alt={cl.name} loading="lazy" decoding="async" />
                                    ) : (
                                      <span className="client-avatar client-avatar-fallback">{cl.name?.charAt(0)?.toUpperCase() || '?'}</span>
                                    )}
                                    <span className="strong">{cl.name}</span>
                                  </div>
                                </td>
                                <td data-label="Contact">
                                  {cl.email}
                                  <div style={{ fontSize: '.72rem', color: 'var(--text-dim)' }}>{cl.phone || '—'}</div>
                                </td>
                                <td data-label="Age">{cl.age ?? '—'}</td>
                                <td data-label="Zodiac">{z ? `${z.glyph} ${cl.zodiac_sign}` : (cl.zodiac_sign || '—')}</td>
                                <td data-label="Orders">{cl.order_count ?? 0}</td>
                                <td data-label="Bookings">{cl.booking_count ?? 0}</td>
                                <td data-label="Joined" style={{ fontSize: '.8rem' }}>{cl.created_at?.slice(0, 10)}</td>
                                <td className="row-actions">
                                  <button className="icon-btn danger" title="Delete client" onClick={() => del({ endpoint: '/users' }, cl.id)}><IconTrash /></button>
                                </td>
                              </tr>
                              {open && (
                                <tr className="client-detail-row">
                                  <td colSpan={9}>
                                    <div className="client-detail-grid">
                                      <div className="client-detail-col">
                                        <h4>Appointments ({cl.bookings?.length || 0})</h4>
                                        {cl.bookings?.length ? (
                                          <ul className="client-detail-list">
                                            {cl.bookings.map((b) => (
                                              <li key={b.id}>
                                                <div className="client-detail-title">
                                                  {b.service}
                                                  <span className={`badge ${statusCls(b.status)}`}>{b.status || 'Pending'}</span>
                                                </div>
                                                <div className="client-detail-sub">
                                                  {b.booking_date} · {b.time_slot}{b.chamber_name ? ` · ${b.chamber_name}` : ''}
                                                </div>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="client-detail-empty">No appointments</p>
                                        )}
                                      </div>
                                      <div className="client-detail-col">
                                        <h4>Orders ({cl.orders?.length || 0})</h4>
                                        {cl.orders?.length ? (
                                          <ul className="client-detail-list">
                                            {cl.orders.map((o) => (
                                              <li key={o.id}>
                                                <div className="client-detail-title">
                                                  {o.order_number}
                                                  <span className={`badge ${statusCls(o.status)}`}>{o.status}</span>
                                                </div>
                                                <div className="client-detail-sub">
                                                  {o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : ''}
                                                  {` · ₹${Number(o.total).toLocaleString('en-IN')}`}
                                                  {(o.items || []).map((it) => ` · ${it.product_name} ×${it.quantity}`)}
                                                </div>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="client-detail-empty">No orders</p>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        }) : emptyRow(9, clients.length ? 'No clients match your search' : 'No registered clients yet')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
              )
            })()}

            {/* ------- Generic CRUD views ------- */}
            {['products', 'blogs', 'chambers', 'gallery', 'coupons'].includes(view) && (
              <section className="view view-crud">
                <div className="panel">
                  <div className="panel-head">
                    <h2>Manage {SCHEMAS[view].title}s</h2>
                    {view === 'products' && (
                      <div className="table-search">
                        <IconSearch />
                        <input
                          type="search"
                          placeholder="Search products by name or category…"
                          value={productQuery}
                          onChange={(e) => setProductQuery(e.target.value)}
                          aria-label="Search products"
                        />
                      </div>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => openModal({ entity: view, schema: SCHEMAS[view], id: null, values: {} })}>
                      + New {SCHEMAS[view].title}
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table className={view === 'products' ? 'table-products' : ''}>
                      <thead>
                        <tr>
                          {view === 'products' && <><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th></>}
                          {view === 'coupons' && <><th>Code</th><th>Type</th><th>Value</th><th>Used / Limit</th><th>Valid until</th><th>Status</th></>}
                          {view === 'blogs' && <><th>Title</th><th>Category</th><th>Date</th></>}
                          {view === 'chambers' && <><th>Name</th><th>Address</th><th>Days</th><th>Time</th></>}
                          {view === 'gallery' && <th>Label</th>}
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(view === 'products' ? visibleProducts : view === 'coupons' ? coupons : view === 'blogs' ? blogs : view === 'chambers' ? chambers : gallery)
                          .map((item) => (
                            <tr key={item.id}>
                              {view === 'products' && (
                                <>
                                  <td>
                                    {item.image_url ? (
                                      <img className="prod-thumb" src={absUrl(item.image_url)} alt={item.name} loading="lazy" decoding="async" />
                                    ) : (
                                      <span className="prod-thumb prod-thumb-empty">✦</span>
                                    )}
                                  </td>
                                  <td className="strong">{item.name}</td>
                                  <td data-label="Category">{item.category}</td>
                                  <td data-label="Price">₹{Number(item.price).toLocaleString('en-IN')}</td>
                                  <td data-label="Stock">
                                    {item.stock == null
                                      ? <span style={{ color: 'var(--text-dim)' }}>∞</span>
                                      : Number(item.stock) <= 0
                                        ? <span style={{ color: 'var(--danger)' }}>Out of stock</span>
                                        : Number(item.stock) <= (item.low_stock_threshold ?? 5)
                                          ? <span style={{ color: '#e0b64a' }}>{item.stock} left</span>
                                          : item.stock}
                                  </td>
                                </>
                              )}
                              {view === 'blogs' && (
                                <>
                                  <td className="strong" data-label="Title">{item.title}</td>
                                  <td data-label="Category">{item.category}</td>
                                  <td data-label="Date">{item.published_at}</td>
                                </>
                              )}
                              {view === 'chambers' && (
                                <>
                                  <td className="strong" data-label="Name">{item.name}</td>
                                  <td data-label="Address">{item.address}</td>
                                  <td data-label="Days">{item.consultation_days}</td>
                                  <td data-label="Time">{item.timing}</td>
                                </>
                              )}
                              {view === 'coupons' && (
                                <>
                                  <td className="strong" data-label="Code">{item.code}</td>
                                  <td data-label="Type">{item.discount_type === 'percent' ? `${item.discount_value}%` : `₹${item.discount_value}`}</td>
                                  <td data-label="Value">
                                    {item.min_order_amount > 0 ? `min ₹${item.min_order_amount}` : 'no minimum'}
                                    {item.max_discount ? ` · cap ₹${item.max_discount}` : ''}
                                  </td>
                                  <td data-label="Used / Limit">{item.used_count}{Number(item.usage_limit) > 0 ? ` / ${item.usage_limit}` : ' / ∞'}</td>
                                  <td data-label="Valid until">{item.valid_until || 'never'}</td>
                                  <td data-label="Status">{item.is_active === 1 ? 'Active' : 'Disabled'}</td>
                                </>
                              )}
                              {view === 'gallery' && <td className="strong" data-label="Label">{item.label}</td>}
                              <td className="row-actions">
                                <button className="icon-btn" title={`Edit ${SCHEMAS[view].title.toLowerCase()}`} onClick={() => openModal({ entity: view, schema: SCHEMAS[view], id: item.id, values: item })}><IconEdit /></button>
                                <button className="icon-btn danger" title={`Delete ${SCHEMAS[view].title.toLowerCase()}`} onClick={() => del(SCHEMAS[view], item.id)}><IconTrash /></button>
                              </td>
                            </tr>
                          ))}
                        {((view === 'products' && !visibleProducts.length) || (view === 'coupons' && !coupons.length)
                          || (view === 'blogs' && !blogs.length)
                          || (view === 'chambers' && !chambers.length) || (view === 'gallery' && !gallery.length))
                          && emptyRow(7, view === 'products' && visibleProducts.length !== products.length
                            ? 'No products match your search'
                            : 'Nothing here yet')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* ------- Categories ------- */}
            {view === 'categories' && (
              <section id="view-categories" className="view">
                <div className="panel">
                  <div className="panel-head">
                    <h2>Manage Categories</h2>
                    <div className="cat-head-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => catAdd(null)}>+ Category</button>
                      <button className="btn btn-primary btn-sm" onClick={catSave} disabled={!catChanged}>Save Changes</button>
                      {catChanged && <button className="btn btn-outline btn-sm" onClick={catDiscard}>Discard</button>}
                    </div>
                  </div>
                  <p className="field-hint" style={{ marginTop: -6, marginBottom: 18 }}>
                    Create categories and sub-categories, then press <b>Save Changes</b> to apply. Sub-categories appear
                    under their parent in the product form and the shop filters. Removing a category also removes its
                    sub-categories (products keep their current category label).
                  </p>
                  <div className="cat-list">
                    {catWork
                      ? catWork.filter((r) => !r.parentId).map((top) => {
                        const subs = catWork.filter((s) => s.parentId === top.key)
                        return (
                          <div key={top.key} className={`cat-item${top.removed ? ' cat-removed' : ''}`}>
                            <div className="cat-row">
                              <span className="cat-name">
                                {top.isNew ? (
                                  <input className="cat-input" autoFocus placeholder="New category name…" value={top.name} onChange={(e) => catSetName(top.key, e.target.value)} />
                                ) : (
                                  <>{top.name} <span className="cat-count">{products.filter((p) => p.category === top.name).length} products</span></>
                                )}
                              </span>
                              <span className="cat-actions">
                                <button className="btn btn-outline btn-sm" onClick={() => catAdd(top.key)}>+ Sub</button>
                                {top.removed
                                  ? <button className="btn btn-outline btn-sm" onClick={() => catUndo(top.key)}>Undo</button>
                                  : <button className="icon-btn danger" title="Remove category" onClick={() => catRemove(top.key)}><IconTrash /></button>}
                              </span>
                            </div>
                            {subs.length > 0 && (
                              <div className="cat-subs">
                                {subs.map((s) => (
                                  <div key={s.key} className={`cat-row cat-sub${s.removed ? ' cat-removed' : ''}`}>
                                    <span className="cat-name">
                                      {s.isNew ? (
                                        <input className="cat-input" autoFocus placeholder="New sub-category name…" value={s.name} onChange={(e) => catSetName(s.key, e.target.value)} />
                                      ) : (
                                        <>{s.name}</>
                                      )}
                                    </span>
                                    <span className="cat-actions">
                                      {s.removed
                                        ? <button className="btn btn-outline btn-sm" onClick={() => catUndo(s.key)}>Undo</button>
                                        : <button className="icon-btn danger" title="Remove sub-category" onClick={() => catRemove(s.key)}><IconTrash /></button>}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
                      : null}
                  </div>
                </div>
              </section>
            )}

            {/* ------- Horoscope ------- */}
            {view === 'horoscope' && (
              <section id="view-horoscope" className="view view-stack">
                <div className="panel">
                  <div className="panel-head"><h2>Update Daily Horoscope</h2></div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Sign</th><th>Message</th><th>Color</th><th>Number</th><th>Mood</th><th>Action</th></tr></thead>
                      <tbody>
                        {SIGNS.map((s) => {
                          const r = getReading(s.key, 'today')
                          const o = overrides[s.key]
                          return (
                            <tr key={s.key}>
                              <td className="strong" data-label="Sign">{s.glyph} {s.n}</td>
                              <td className="td-multiline" data-label="Message">{o?.message || r.text}</td>
                              <td data-label="Color">{o?.lucky_color || r.color}</td>
                              <td data-label="Number">{o?.lucky_number || r.number}</td>
                              <td data-label="Mood">{o?.mood || r.mood}</td>
                              <td className="row-actions">
                                <button className="icon-btn" title="Edit horoscope" onClick={() => openModal({ entity: 'horoscope', sign: s })}><IconEdit /></button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* ------- Enquiries ------- */}
            {view === 'enquiries' && (
              <section id="view-enquiries" className="view view-stack">
                <div className="panel">
                  <div className="panel-head"><h2>Customer Enquiries</h2></div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Message</th><th>Action</th></tr></thead>
                      <tbody>
                        {enquiries.length ? enquiries.map((en) => (
                          <tr key={en.id}>
                            <td className="strong" data-label="Name">{en.name}</td>
                            <td data-label="Phone">{en.phone || '—'}</td>
                            <td data-label="Email">{en.email || '—'}</td>
                            <td className="td-multiline" data-label="Message" style={{ whiteSpace: 'normal', maxWidth: 280 }}>{en.message}</td>
                            <td className="row-actions">
                              <button className="icon-btn danger" title="Delete enquiry" onClick={() => del({ endpoint: '/enquiries' }, en.id)}><IconTrash /></button>
                            </td>
                          </tr>
                        )) : emptyRow(5, 'No enquiries available')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom navigation (admin tabs) */}
      <BottomNav adminView={view} onAdminView={setView} />

      {/* ------- Modal ------- */}
      {modal && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal">
            <div className="modal-head">
              <h3>
                {modal.entity === 'horoscope'
                  ? `${modal.sign.n} — Edit Horoscope`
                  : `${modal.id ? 'Edit' : 'Add New'} ${modal.schema.title}`}
              </h3>
              <button className="modal-close" onClick={closeModal} aria-label="Close modal">✕</button>
            </div>
            {modal.entity === 'horoscope' ? (
              <form id="modalForm" onSubmit={saveHoroscope}>
                <div className="modal-body">
                  {(() => {
                    const o = overrides[modal.sign.key]
                    const r = getReading(modal.sign.key, 'today')
                    const f = { text: o?.message || r.text, color: o?.lucky_color || r.color, number: o?.lucky_number || r.number, mood: o?.mood || r.mood }
                    return (
                      <>
                        <div className="field"><label>Message</label><textarea name="text" required defaultValue={f.text}></textarea></div>
                        <div className="field"><label>Lucky Color</label><input type="text" name="color" required defaultValue={f.color} /></div>
                        <div className="field"><label>Lucky Number</label><input type="text" name="number" required defaultValue={f.number} /></div>
                        <div className="field"><label>Mood</label><input type="text" name="mood" required defaultValue={f.mood} /></div>
                      </>
                    )
                  })()}
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={closeModal} disabled={modalBusy}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={modalBusy}>{modalBusy ? 'Saving…' : 'Save'}</button>
                </div>
              </form>
            ) : (
              <form id="modalForm" onSubmit={saveEntity}>
                <div className="modal-body">
                  {modal.schema.fields.map((f) => {
                    const val = modal.values[f.name] != null ? modal.values[f.name] : ''
                    if (f.type === 'file') {
                      const current = modal.values.image_url
                      return (
                        <div className="field" key={f.name}>
                          <label>{f.label}</label>
                          {current && <img className="modal-img-preview" src={absUrl(current)} alt="Current product photo" loading="lazy" decoding="async" />}
                          <input type="file" name={f.name} accept="image/*" />
                          <span className="field-hint">JPG / PNG — replaces the photo on save.</span>
                        </div>
                      )
                    }
                    if (f.type === 'timing') {
                      return <ChamberTimingInput key={f.name} name={f.name} label={f.label} defaultValue={val} required={f.required} />
                    }
                    if (f.type === 'days') {
                      return <ChamberDaysInput key={f.name} name={f.name} label={f.label} defaultValue={val} required={f.required} />
                    }
                    return (
                      <div className="field" key={f.name}>
                        <label>{f.label}</label>
                        {f.type === 'textarea'
                          ? <textarea name={f.name} required={f.required} defaultValue={val}></textarea>
                          : f.type === 'select'
                            ? f.name === 'category'
                              ? (
                                <select name={f.name} required={f.required} defaultValue={val || ''}>
                                  {!categoryOptions.length && <option value="">— No categories yet —</option>}
                                  {val && !categoryOptions.some((o) => o.value === val) && <option value={val}>{val}</option>}
                                  {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              )
                              : (
                                <select name={f.name} required={f.required} defaultValue={val || f.options[0]}>
                                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                              )
                            : <input type={f.type} name={f.name} required={f.required} defaultValue={val} />}
                      </div>
                    )
                  })}
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={closeModal} disabled={modalBusy}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={modalBusy}>{modalBusy ? 'Saving…' : 'Save'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ------- Toast ------- */}
      {toast && (
        <div className={`admin-toast ${toast.type}${toast.leaving ? '' : ' show'}`} role="status" aria-live="polite">
          <span className="admin-toast-ic">
            {toast.type === 'success' ? <IconCheck /> : <IconX />}
          </span>
          {toast.msg}
        </div>
      )}

      {/* ------- Confirm dialog ------- */}
      {confirm && (
        <div
          className="modal-overlay open"
          role="dialog"
          aria-modal="true"
          aria-label={confirm.title}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirm(null) }}
        >
          <div className="modal modal-sm confirm-modal">
            <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center', padding: '28px 24px 20px' }}>
              <div className="confirm-icon"><IconTrash /></div>
              <h3>{confirm.title}</h3>
              <p>{confirm.message}</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setConfirm(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => { const run = confirm.onConfirm; setConfirm(null); run() }}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
