import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import PaymentStatus from './pages/PaymentStatus'
import Shop from './pages/Shop'
import CustomerLogin from './pages/CustomerLogin'
import Account from './pages/Account'

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    /* Cross-page section jump (e.g. /shop → /#services): wait for the home
       page to render, then scroll the section into view. */
    if (hash) {
      requestAnimationFrame(() => {
        const el = document.getElementById(hash.slice(1))
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/login" element={<CustomerLogin />} />
        <Route path="/account" element={<Account />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/payment-status" element={<PaymentStatus />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}
