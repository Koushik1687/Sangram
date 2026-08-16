/* ==========================================================================
   BottomNav — mobile app-style bottom navigation bar (mobile only).
   Customer pages get Home / Services / Shop / Settings; admin pages
   (/admin*, when rendered by AdminLogin or AdminDashboard) get an
   admin-specific set: Overview / Orders / Products / View Site. Fixed to
   the bottom with a frosted background, an active-tab indicator, and an
   iOS-style home indicator bar along the bottom edge. Hidden on desktop.
   ========================================================================== */
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../lib/cart'

const ICON = (paths, opts = {}) => (
  <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...opts}>
    {paths}
  </svg>
)

const TABS = [
  {
    key: 'home',
    label: 'Home',
    to: '/',
    match: (path) => path === '/',
    icon: (
      <svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor" aria-hidden="true">
        <path d="M12 3.2 3.5 10.6a1 1 0 0 0-.35.76V20a1 1 0 0 0 1 1h4.6v-5.4a3.25 3.25 0 0 1 6.5 0V21h4.6a1 1 0 0 0 1-1v-8.64a1 1 0 0 0-.35-.76L12 3.2Z" />
      </svg>
    ),
  },
  {
    key: 'services',
    label: 'Services',
    to: '/#services',
    match: (path) => false, // never "active" — it jumps to a section
    icon: (
      <svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor" aria-hidden="true">
        <path d="m12 3 2.35 5.28 5.77.5-4.38 3.8 1.33 5.64L12 15.4l-5.07 2.82 1.33-5.64-4.38-3.8 5.77-.5L12 3Z" />
      </svg>
    ),
  },
  {
    key: 'shop',
    label: 'Shop',
    to: '/shop',
    match: (path) => path.startsWith('/shop'),
    badge: true, // shows a count badge when the cart has items
    icon: (
      <svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor" aria-hidden="true">
        <path d="M5.2 8h13.6l-1.05 11.05a1.6 1.6 0 0 1-1.59 1.45H7.84a1.6 1.6 0 0 1-1.59-1.45L5.2 8Z" />
        <path d="M8.5 8V6.9a3.5 3.5 0 0 1 7 0V8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    to: '/account',
    match: (path) => path.startsWith('/account') || path.startsWith('/login'),
    icon: (
      <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3.1" />
        <path d="M19.4 13.6a7.6 7.6 0 0 0 0-3.2l2.05-1.6-2-3.46-2.42.98a7.6 7.6 0 0 0-2.77-1.6L13.9 2h-4l-.36 2.72a7.6 7.6 0 0 0-2.77 1.6l-2.42-.98-2 3.46 2.05 1.6a7.6 7.6 0 0 0 0 3.2l-2.05 1.6 2 3.46 2.42-.98a7.6 7.6 0 0 0 2.77 1.6l.36 2.72h4l.36-2.72a7.6 7.6 0 0 0 2.77-1.6l2.42.98 2-3.46-2.05-1.6Z" />
      </svg>
    ),
  },
]

/* Admin tabs — switch the dashboard's internal views (via onAdminView) or,
   when rendered outside the dashboard (e.g. the admin login page), jump to
   /admin which defaults to the overview. "View Site" links back to the store. */
const ADMIN_TABS = [
  {
    key: 'overview',
    label: 'Overview',
    view: 'overview',
    icon: ICON(<><path d="M4 4h6.5v6.5H4V4Zm9.5 0H20v6.5h-6.5V4ZM4 13.5h6.5V20H4v-6.5Zm9.5 0H20V20h-6.5v-6.5Z" /></>),
  },
  {
    key: 'orders',
    label: 'Orders',
    view: 'orders',
    icon: ICON(<>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.2V3.4A1.2 1.2 0 0 1 10.2 2.2h3.6A1.2 1.2 0 0 1 15 3.4v.8" />
      <path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4.5" />
    </>),
  },
  {
    key: 'products',
    label: 'Products',
    view: 'products',
    icon: ICON(<>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </>),
  },
  {
    key: 'site',
    label: 'View Site',
    to: '/',
    icon: ICON(<>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5S9.4 5.9 12 3.5Z" />
    </>),
  },
]

export default function BottomNav({ adminView, onAdminView }) {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const { count } = useCart()
  const isAdmin = pathname.startsWith('/admin')

  /* Services is a section on the home page: land on "/" then scroll to it.
     Plain hash navigation already works for in-page anchors, so only handle
     the cross-route jump (e.g. from /shop → /#services). */
  useEffect(() => {
    if (hash === '#services') {
      requestAnimationFrame(() => {
        const el = document.getElementById('services')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [hash])

  /* Highlight the Services tab while the services section is on screen.
     The section is taller than a mobile viewport, so track when it overlaps
     the upper-middle band of the viewport (20%–45% from the top) instead of
     using an intersection threshold. Only meaningful on the home page. */
  const [servicesActive, setServicesActive] = useState(false)
  useEffect(() => {
    if (pathname !== '/') {
      setServicesActive(false)
      return
    }
    const el = document.getElementById('services')
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setServicesActive(entry.isIntersecting),
      { rootMargin: '-20% 0px -55% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [pathname])

  function handleTab(tab) {
    if (tab.key === 'services') {
      if (pathname === '/') {
        const el = document.getElementById('services')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        else navigate('/#services')
      } else {
        navigate('/#services')
      }
    }
  }

  /* Admin view tabs switch the dashboard inline; when BottomNav is rendered
     outside the dashboard (login page), fall back to /admin (overview). */
  function handleAdminTab(tab) {
    if (onAdminView) onAdminView(tab.view)
    else navigate('/admin')
  }

  const tabs = isAdmin ? ADMIN_TABS : TABS

  return (
    <nav className="bottom-nav" aria-label={isAdmin ? 'Admin' : 'Primary'}>
      {tabs.map((tab) => {
        let active
        if (isAdmin) {
          active = tab.key === 'overview'
            ? (adminView == null || adminView === 'overview')
            : tab.key === 'orders' ? adminView === 'orders'
            : tab.key === 'products' ? adminView === 'products'
            : false // "View Site" is never active
        } else {
          /* Single active tab: Services takes over while its section is on
             screen; Home is active otherwise. */
          const inServices = pathname === '/' && servicesActive
          active = tab.key === 'services' ? inServices : tab.match(pathname) && !inServices
        }
        const cls = `bottom-nav-item${active ? ' active' : ''}`
        const content = (
          <>
            <span className="bottom-nav-icon">
              {tab.icon}
              {tab.badge && count > 0 && (
                <span className="bottom-nav-badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>
              )}
            </span>
            <span className="bottom-nav-label">{tab.label}</span>
          </>
        )
        if (isAdmin) {
          return tab.view ? (
            <button key={tab.key} type="button" className={cls} onClick={() => handleAdminTab(tab)} aria-current={active ? 'page' : undefined}>
              {content}
            </button>
          ) : (
            <Link key={tab.key} to={tab.to} className={cls} aria-current={active ? 'page' : undefined}>
              {content}
            </Link>
          )
        }
        return tab.key === 'services' ? (
          <button key={tab.key} type="button" className={cls} onClick={() => handleTab(tab)} aria-current={active ? 'page' : undefined}>
            {content}
          </button>
        ) : (
          <Link key={tab.key} to={tab.to} className={cls} aria-current={active ? 'page' : undefined}>
            {content}
          </Link>
        )
      })}
      <span className="bottom-nav-indicator" aria-hidden="true"></span>
    </nav>
  )
}
