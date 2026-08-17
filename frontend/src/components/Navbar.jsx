/* ==========================================================================
   Navbar — fixed header with scroll state, mobile menu panel, and an
   active-section indicator (ported from main.js). The Shop item links to the
   dedicated shop page and a customer account chip is shown when logged in.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { useCart } from '../lib/cart'
import { imageUrl } from '../lib/data'
import { SIGNS } from '../lib/horoscope'
import CartDrawer from './CartDrawer'
import BottomNav from './BottomNav'
import SectionNavLink from './SectionNavLink'

const LINKS = [
  { href: '#about', label: 'About' },
  { href: '#services', label: 'Services' },
  { href: '/shop', label: 'Shop' },
  { href: '#chambers', label: 'Chambers' },
  { href: '#horoscope', label: 'Horoscope' },
  { href: '#blog', label: 'Blog' },
  { href: '#booking', label: 'Contact' },
]

/* Mobile drawer menu — grouped like the AstroTalk reference: prominent
   sign-in on top, then sectioned links, theme control at the bottom. */
const MENU_GROUPS = [
  {
    title: 'Explore',
    items: [
      { label: 'About', href: '#about', icon: 'about' },
      { label: 'Services', href: '#services', icon: 'services' },
      { label: 'Chambers', href: '#chambers', icon: 'chambers' },
      { label: 'Gallery', href: '#gallery', icon: 'gallery' },
    ],
  },
  {
    title: 'Consult',
    items: [
      { label: 'Horoscope', href: '#horoscope', icon: 'horoscope' },
      { label: 'Appointment', href: '#booking', icon: 'booking' },
    ],
  },
  {
    title: 'Shop & more',
    items: [
      { label: 'Shop', href: '/shop', icon: 'shop' },
      { label: 'Blog', href: '#blog', icon: 'blog' },
    ],
  },
]

const MENU_ICONS = {
  about: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-12.5v.5M12 12v5',
  services: 'M12 2.5 13.7 9 20 10.7 13.7 12.4 12 18.9 10.3 12.4 4 10.7 10.3 9 12 2.5Z',
  chambers: 'M12 21.5s-7.2-5.8-7.2-11.3a7.2 7.2 0 0 1 14.4 0c0 5.5-7.2 11.3-7.2 11.3Zm0-8.8a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Z',
  gallery: 'M4 4.5h16v15H4v-15Zm2.5 12 4-5.2 3 3.2 3.2-4.4L19.5 16M9 9.3a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z',
  horoscope: 'M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 6.2a5.8 5.8 0 1 0 0 11.6 5.8 5.8 0 0 0 0-11.6Z',
  booking: 'M8 2.5v4M16 2.5v4M3.5 8.5h17M5 4.5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z',
  shop: 'M6.5 2.5 3 6.5v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-13l-3.5-4h-11ZM3.5 6.5h17M16 10.5a4 4 0 0 1-8 0',
  blog: 'M4.5 19.5A2.5 2.5 0 0 1 7 17H20V4.5a2 2 0 0 0-2-2H7a2.5 2.5 0 0 0-2.5 2.5v14.5ZM4.5 19.5A2.5 2.5 0 0 0 7 22h13v-5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21c0-3.3 3.4-5.5 7.5-5.5s7.5 2.2 7.5 5.5',
  logout: 'M14 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3M9 12h11M17 8l4 4-4 4',
}

function MenuIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={MENU_ICONS[name]} />
    </svg>
  )
}

/* Brand-styled theme toggle: shows the moon in light mode (switch to dark)
   and the sun in dark mode (switch to light). Icons crossfade via CSS. */
function ThemeToggleButton({ theme, onClick, small }) {
  const osDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'auto' && osDark)
  return (
    <button
      type="button"
      className={`theme-toggle${small ? ' theme-toggle-sm' : ''}${dark ? ' is-dark' : ' is-light'}`}
      onClick={onClick}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <svg className="icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
      <svg className="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6 6 18M18 6l1.6-1.6" />
      </svg>
    </button>
  )
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState(() => {
    if (typeof document === 'undefined') return 'auto'
    let saved = null
    try { saved = localStorage.getItem('sree-sangram-theme') } catch (e) { /* ignore */ }
    return saved === 'light' || saved === 'dark' ? saved : 'auto'
  })
  const navRef = useRef(null)
  const { user, logout } = useAuth()
  const { count, openCart } = useCart()
  const navigate = useNavigate()
  const zodiacGlyph = user?.zodiac_sign
    ? (SIGNS.find((s) => s.n === user.zodiac_sign)?.glyph || null)
    : null
  /* Number of orders awaiting payment — shown as a gold badge on the drawer's
     "My orders" row. Refetches whenever the session changes. */
  const [pendingOrders, setPendingOrders] = useState(0)
  useEffect(() => {
    if (!user) {
      setPendingOrders(0)
      return undefined
    }
    let live = true
    api
      .get('/orders', { customer: true })
      .then((orders) => {
        if (!live) return
        const n = (Array.isArray(orders) ? orders : []).filter(
          (o) => String(o.status || '').toUpperCase() === 'PENDING',
        ).length
        setPendingOrders(n)
      })
      .catch(() => { if (live) setPendingOrders(0) })
    return () => { live = false }
  }, [user])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* Active section indicator */
  useEffect(() => {
    const root = navRef.current
    if (!root || !('IntersectionObserver' in window)) return
    const links = root.querySelectorAll('.nav-links a, .mobile-panel a')
    const sections = document.querySelectorAll('main section[id]')
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            links.forEach((a) =>
              a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`),
            )
          }
        })
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    sections.forEach((s) => spy.observe(s))
    return () => spy.disconnect()
  }, [])

  const close = () => setOpen(false)

  function handleLogout() {
    logout()
    setMenuOpen(false)
    navigate('/')
  }

  /* Flip the theme with a smooth View Transition crossfade when supported;
     falls back to an instant switch otherwise. Never persists. */
  const flipTheme = (next) => {
    const update = () => {
      document.documentElement.setAttribute('data-theme', next)
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', next === 'dark' ? '#181009' : '#f6ecd2')
    }
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (document.startViewTransition && !reduce) {
      try {
        document.startViewTransition(update)
        return
      } catch (e) { /* a transition is already running — fall through */ }
    }
    update()
  }

  function applyTheme(next) {
    if (next === 'auto') {
      const osDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
      flipTheme(osDark ? 'dark' : 'light')
    } else {
      flipTheme(next)
    }
    try {
      localStorage.setItem('sree-sangram-theme', next)
    } catch (e) { /* storage unavailable — theme still applies for this session */ }
    setTheme(next)
  }

  function toggleTheme() {
    const cur = theme === 'auto'
      ? (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme
    applyTheme(cur === 'light' ? 'dark' : 'light')
  }

  /* Follow the OS theme until the visitor makes an explicit choice */
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => {
      let saved = null
      try { saved = localStorage.getItem('sree-sangram-theme') } catch (err) { /* ignore */ }
      if (saved === 'light' || saved === 'dark') return
      flipTheme(e.matches ? 'dark' : 'light')
    }
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else if (mq.addListener) mq.addListener(onChange) // legacy Safari
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else if (mq.removeListener) mq.removeListener(onChange)
    }
  }, [])

  return (
    <>
      <header id="navbar" className={scrolled ? 'scrolled' : ''}>
        <div className="container nav-inner">
          <SectionNavLink href="#hero" className="brand">
            <span className="brand-mark">
              <img src="/images/logo/Sree Sangram logo.png" alt="Sree Sangram Logo" decoding="async" />
            </span>
            <span className="brand-text">
              <span className="en">শ্রী সংগ্রাম</span>
            </span>
          </SectionNavLink>
          <nav className="nav-links">
            {LINKS.map((l) =>
              l.href.startsWith('/') ? (
                <Link key={l.href} to={l.href}>{l.label}</Link>
              ) : (
                <SectionNavLink key={l.href} href={l.href}>{l.label}</SectionNavLink>
              ),
            )}
          </nav>

          <button type="button" className="cart-btn" onClick={openCart} aria-label={`Open cart, ${count} items`}>
            <span className="cart-btn-icon" aria-hidden="true">🛍</span>
            {count > 0 && <span className="cart-badge">{count}</span>}
          </button>

          <ThemeToggleButton theme={theme} onClick={toggleTheme} />

          <div className="nav-account">
            {user ? (
              <div className={`account-chip${menuOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="account-chip-btn"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <span className="account-avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                  <span className="account-name">{user.name?.split(' ')[0]}</span>
                  <span className="account-caret" aria-hidden="true">▾</span>
                </button>
                <div className="account-menu">
                  <Link to="/account" onClick={() => setMenuOpen(false)}>My account</Link>
                  <button type="button" onClick={handleLogout}>Log out</button>
                </div>
              </div>
            ) : (
              <Link to="/login" className="nav-cta nav-cta-ghost">✦ Login / Register</Link>
            )}
          </div>

          <SectionNavLink href="#booking" className="nav-cta nav-cta-desktop">✦ Appointment</SectionNavLink>
          <button
            id="hamburger"
            className={`hamburger${open ? ' open' : ''}`}
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
        <div id="mobile-panel" ref={navRef} className={`mobile-panel${open ? ' open' : ''}`}>
          <div className="mobile-panel-head">
            <SectionNavLink href="#hero" className="brand" onClick={close}>
              <span className="brand-mark">
                <img src="/images/logo/Sree Sangram logo.png" alt="Sree Sangram Logo" decoding="async" />
              </span>
              <span className="brand-text"><span className="en">শ্রী সংগ্রাম</span></span>
            </SectionNavLink>
            <button className="mobile-close" aria-label="Close menu" onClick={close}>✕</button>
          </div>

          <div className="mobile-auth">
            {user ? (
              <>
                <div className="mobile-auth-user">
                  <span className="account-avatar">
                    {user.photo_url
                      ? <img src={imageUrl(user.photo_url)} alt="" />
                      : user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                  <span className="mobile-auth-user-meta">
                    <span className="mobile-auth-user-name">{user.name}</span>
                    <span className="mobile-auth-user-sub">
                      {zodiacGlyph ? `${zodiacGlyph} ${user.zodiac_sign}` : user.email}
                    </span>
                  </span>
                </div>
                <nav className="mobile-auth-links">
                  <Link to="/account" onClick={close}>
                    <MenuIcon name="user" />
                    <span>My account</span>
                  </Link>
                  <Link to="/account?tab=orders" onClick={close}>
                    <MenuIcon name="shop" />
                    <span>My orders</span>
                    {pendingOrders > 0 && <span className="mobile-auth-badge">{pendingOrders}</span>}
                  </Link>
                  <button type="button" onClick={handleLogout}>
                    <MenuIcon name="logout" />
                    <span>Log out</span>
                  </button>
                </nav>
              </>
            ) : (
              <Link to="/login" className="mobile-auth-btn" onClick={close}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
                </svg>
                <span>Sign In / Sign up</span>
              </Link>
            )}
          </div>

          <nav className="mobile-panel-nav">
            {MENU_GROUPS.map((g) => (
              <div className="mobile-nav-group" key={g.title}>
                <h3 className="mobile-nav-title">{g.title}</h3>
                {g.items.map((it) => {
                  const inner = (<><MenuIcon name={it.icon} /><span>{it.label}</span></>)
                  return it.href.startsWith('/')
                    ? <Link key={it.label} to={it.href} onClick={close}>{inner}</Link>
                    : <SectionNavLink key={it.label} href={it.href} onClick={close}>{inner}</SectionNavLink>
                })}
              </div>
            ))}
          </nav>

          <div className="mobile-theme">
            <span className="mobile-theme-label">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
              </svg>
              Theme
            </span>
            <div className="mobile-theme-opts" role="group" aria-label="Theme">
              {['auto', 'light', 'dark'].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={theme === t ? 'active' : ''}
                  onClick={() => applyTheme(t)}
                  aria-pressed={theme === t}
                >
                  {t === 'auto' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      <div
        id="mobile-overlay"
        className={`mobile-overlay${open ? ' open' : ''}`}
        onClick={close}
      ></div>
      <CartDrawer />
      <BottomNav />
    </>
  )
}
