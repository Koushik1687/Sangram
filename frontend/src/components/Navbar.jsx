/* ==========================================================================
   Navbar — fixed header with scroll state, mobile menu panel, and an
   active-section indicator (ported from main.js). The Shop item links to the
   dedicated shop page and a customer account chip is shown when logged in.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
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

/* Brand-styled theme toggle: shows the moon in light mode (switch to dark)
   and the sun in dark mode (switch to light). Icons crossfade via CSS. */
function ThemeToggleButton({ theme, onClick, small }) {
  const dark = theme === 'dark'
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
  const [theme, setTheme] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') || 'light'
      : 'light',
  )
  const navRef = useRef(null)
  const { user, logout } = useAuth()
  const { count, openCart } = useCart()
  const navigate = useNavigate()

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
    flipTheme(next)
    try {
      localStorage.setItem('sree-sangram-theme', next)
    } catch (e) { /* storage unavailable — theme still applies for this session */ }
    setTheme(next)
  }

  function toggleTheme() {
    applyTheme(theme === 'light' ? 'dark' : 'light')
  }

  /* Follow the OS theme until the visitor makes an explicit choice */
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => {
      let saved = null
      try { saved = localStorage.getItem('sree-sangram-theme') } catch (err) { /* ignore */ }
      if (saved) return
      flipTheme(e.matches ? 'dark' : 'light')
      setTheme(e.matches ? 'dark' : 'light')
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
            <ThemeToggleButton theme={theme} onClick={toggleTheme} small />
            <button className="mobile-close" aria-label="Close menu" onClick={close}>✕</button>
          </div>
          <nav className="mobile-panel-nav">
            {LINKS.map((l) =>
              l.href.startsWith('/') ? (
                <Link key={l.href} to={l.href} onClick={close}>{l.label}</Link>
              ) : (
                <SectionNavLink key={l.href} href={l.href} onClick={close}>{l.label}</SectionNavLink>
              ),
            )}
            <SectionNavLink href="#gallery" onClick={close}>Gallery</SectionNavLink>
          </nav>
          <div className="mobile-panel-cta">
            {user ? (
              <>
                <Link to="/account" onClick={close}>👤 &nbsp;{user.name} — My orders</Link>
                <button type="button" onClick={handleLogout}>Log out</button>
              </>
            ) : (
              <Link to="/login" onClick={close}>✦ &nbsp;Login / Register</Link>
            )}
            <SectionNavLink href="#booking" onClick={close}>✦ &nbsp;Appointment</SectionNavLink>
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
