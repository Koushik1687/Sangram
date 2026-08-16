import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import StarField from '../components/StarField'
import BottomNav from '../components/BottomNav'
import './admin/admin.css'

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

export default function AdminLogin() {
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const navigate = useNavigate()

  function submit(e) {
    e.preventDefault()
    setBusy(true)
    const username = e.target.user.value.trim()
    const password = e.target.pass.value
    api.auth
      .login({ username, password })
      .then((res) => {
        api.saveToken(res.token)
        navigate('/admin')
      })
      .catch(() => setError(true))
      .finally(() => setBusy(false))
  }

  return (
    <div className="admin-body">
      <StarField />
      <div className="cosmic-wash"></div>

      <div className="login-wrap">
        <div className="login-card">
          <span className="brand-mark">
            <img src="/images/logo/Sree Sangram logo.png" alt="Sree Sangram Logo" decoding="async" />
          </span>
          <h1>শ্রী সংগ্রাম অ্যাডমিন</h1>
          <p>Sign in to access the dashboard.</p>
          <form id="loginForm" onSubmit={submit}>
            <div className="field">
              <label htmlFor="user">Username</label>
              <input type="text" id="user" name="user" required autoComplete="username" placeholder="admin" />
            </div>
            <div className="field">
              <label htmlFor="pass">Password</label>
              <div className="pass-wrap">
                <input
                  type={showPass ? 'text' : 'password'}
                  id="pass"
                  name="pass"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="pass-toggle"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  aria-pressed={showPass}
                >
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            {error && <p className="login-error show" id="loginError">Incorrect username or password.</p>}
          </form>
          <p className="login-back">
            <Link to="/">← Return to the main website</Link>
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
