import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isGoogleConfigured, renderGoogleButton } from '../lib/google'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import StarField from '../components/StarField'

/* ==========================================================================
   CustomerLogin — sign in / create account for the shop.

   · "Continue as Google" is the primary option — the backend verifies the
     Google ID token (POST /api/users/google) and logs the customer in,
     creating the account automatically on first use.
   · Email + password is the fallback: POST /users/login (sign in) or
     POST /users/register (create account).

   After success the user is sent back to ?next= (default /shop) so the
   buy-now → login → checkout flow never loses the customer.
   ========================================================================== */
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

export default function CustomerLogin() {
  const { login, register, googleLogin } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/shop'
  const productHint = params.get('product')

  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const googleBtnRef = useRef(null)

  /* "Continue as Google" — the backend verifies the ID token and either logs
     the customer in or creates the account (Google has verified the email). */
  const handleGoogleCredential = useCallback(async (credential) => {
    setBusy(true)
    setError('')
    try {
      await googleLogin(credential)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [googleLogin, navigate, next])

  /* Render the Google button on mount. */
  useEffect(() => {
    if (!isGoogleConfigured() || !googleBtnRef.current) return undefined
    let cancelled = false
    renderGoogleButton(googleBtnRef.current, async (credential) => {
      if (cancelled || !credential) return
      await handleGoogleCredential(credential)
    }).catch((err) => {
      if (!cancelled) setError(err.message || 'Google sign-in could not be loaded.')
    })
    return () => { cancelled = true }
  }, [handleGoogleCredential])

  function switchMode(m) {
    setMode(m)
    setError('')
  }

  /* Sign in or create the account directly (no OTP). */
  async function submit(e) {
    e.preventDefault()
    setError('')
    const f = new FormData(e.target)

    if (mode === 'register' && f.get('password') !== f.get('confirm')) {
      setError('Passwords do not match.')
      return
    }

    const email = f.get('email').trim().toLowerCase()
    const password = f.get('password')

    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register({
          name: f.get('name')?.trim(),
          email,
          phone: f.get('phone')?.trim() || undefined,
          password,
        })
      }
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message || 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-shell">
      <StarField />
      <div className="cosmic-wash"></div>
      <Navbar />

      <main className="page-main center">
        <div className="auth-card">
          <div className="auth-card-head">
            <span className="brand-mark">
              <img src="/images/logo/Sree Sangram logo.png" alt="শ্রী সংগ্রাম লোগো" decoding="async" />
            </span>
            <div className="eyebrow" style={{ justifyContent: 'center' }}>গ্রাহক অ্যাকাউন্ট</div>
            <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p>
              {mode === 'login'
                ? 'Sign in to buy gemstones, crystals, vastu items & aura salts with PhonePe.'
                : 'Register once, then checkout in a single tap with PhonePe.'}
            </p>
          </div>

          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => switchMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'active' : ''}
              onClick={() => switchMode('register')}
            >
              Create account
            </button>
          </div>

          {isGoogleConfigured() && (
            <div className="auth-google">
              <div ref={googleBtnRef} className="google-btn-host" aria-label="Continue with Google"></div>
              <div className="auth-divider"><span>or continue with email</span></div>
            </div>
          )}

          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && (
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input id="name" name="name" type="text" required minLength={2} autoComplete="name" placeholder="Rahul Sharma" />
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
            </div>

            {mode === 'register' && (
              <div className="field">
                <label htmlFor="phone">Phone <span className="opt">(optional)</span></label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" />
              </div>
            )}

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="pass-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'login' ? 'Your password' : 'At least 6 characters'}
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

            {mode === 'register' && (
              <div className="field">
                <label htmlFor="confirm">Confirm password</label>
                <div className="pass-wrap">
                  <input
                    id="confirm"
                    name="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                  />
                  <button
                    type="button"
                    className="pass-toggle"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    aria-pressed={showConfirm}
                  >
                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy
                ? 'Please wait…'
                : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {productHint && mode === 'login' && (
            <p className="auth-hint">
              You were about to buy a product — sign in to continue with the checkout.
            </p>
          )}

          <p className="auth-back">
            <Link to="/shop">← Back to the shop</Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
