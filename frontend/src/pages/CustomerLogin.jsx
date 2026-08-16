import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import StarField from '../components/StarField'

/* ==========================================================================
   CustomerLogin — sign in / create account for the shop.
   Every login AND signup now requires a one-time password (OTP) sent by
   email via EmailJS. Flow:
     1. Credentials form  → POST /users/otp/send   (email + purpose)
     2. OTP step          → POST /users/otp/verify (returns a one-time token)
     3. login/register    → POST /users/login | /users/register (consumes the
                            token — the server refuses to log in / create an
                            account without a freshly verified OTP)
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

const RESEND_WAIT = 30 // seconds before another code can be requested

export default function CustomerLogin() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/shop'
  const productHint = params.get('product')

  const [mode, setMode] = useState('login')
  const [step, setStep] = useState('form') // 'form' | 'otp'
  const [draft, setDraft] = useState(null) // credentials awaiting OTP
  const [busy, setBusy] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [otpCode, setOtpCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [devOtp, setDevOtp] = useState('')

  /* Countdown for the "Resend code" button */
  useEffect(() => {
    if (step !== 'otp' || resendIn <= 0) return undefined
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [step, resendIn])

  function switchMode(m) {
    setMode(m)
    setStep('form')
    setDraft(null)
    setOtpCode('')
    setDevOtp('')
    setError('')
  }

  function backToForm() {
    setStep('form')
    setOtpCode('')
    setDevOtp('')
    setError('')
  }

  /* Step 1 — request an OTP for this email (login also validates the password). */
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
    const purpose = mode === 'login' ? 'login' : 'register'

    setBusy(true)
    try {
      const res = await api.post('/users/otp/send', {
        email,
        purpose,
        ...(purpose === 'login' ? { password } : {}),
      }, { customer: true })

      setDraft({
        purpose,
        email,
        password,
        name: f.get('name')?.trim(),
        phone: f.get('phone')?.trim() || undefined,
      })
      setDevOtp(res.dev_otp || '')
      setOtpCode('')
      setResendIn(RESEND_WAIT)
      setStep('otp')
    } catch (err) {
      setError(err.message || 'Could not send the OTP. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  /* Step 2 — verify the OTP, then complete login / signup with the one-time token. */
  async function verifyOtp(code) {
    if (!draft || verifying) return
    setVerifying(true)
    setError('')
    try {
      const res = await api.post('/users/otp/verify', {
        email: draft.email,
        code,
        purpose: draft.purpose,
      }, { customer: true })

      if (draft.purpose === 'login') {
        await login(draft.email, draft.password, res.token)
      } else {
        await register({
          name: draft.name,
          email: draft.email,
          phone: draft.phone,
          password: draft.password,
          otp_token: res.token,
        })
      }
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP. Please try again.')
      setOtpCode('')
    } finally {
      setVerifying(false)
    }
  }

  /* Auto-verify as soon as all 6 digits are entered (single-shot via onChange). */
  function onOtpChange(value) {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setOtpCode(digits)
    if (digits.length === 6) verifyOtp(digits)
  }

  async function resend() {
    if (resendIn > 0 || !draft) return
    setError('')
    setBusy(true)
    try {
      const res = await api.post('/users/otp/send', {
        email: draft.email,
        purpose: draft.purpose,
        ...(draft.purpose === 'login' ? { password: draft.password } : {}),
      }, { customer: true })
      setDevOtp(res.dev_otp || '')
      setOtpCode('')
      setResendIn(RESEND_WAIT)
    } catch (err) {
      setError(err.message || 'Could not resend the OTP. Please try again.')
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
            <h1>
              {step === 'otp'
                ? 'Enter your OTP'
                : mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p>
              {step === 'otp'
                ? 'A one-time password was sent to your email. Enter it below to continue.'
                : mode === 'login'
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

          {step === 'otp' ? (
            <div className="auth-form">
              <p className="otp-meta">
                We sent a 6-digit code to
                <br />
                <strong>{draft?.email}</strong>
              </p>

              <div className="field">
                <label htmlFor="otp">One-time password</label>
                <input
                  id="otp"
                  className="otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="••••••"
                  value={otpCode}
                  onChange={(e) => onOtpChange(e.target.value)}
                  disabled={verifying}
                  autoFocus
                />
              </div>

              {devOtp && (
                <div className="otp-dev" role="status">
                  Dev mode — your OTP is <strong>{devOtp}</strong>
                </div>
              )}

              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => verifyOtp(otpCode)}
                disabled={verifying || otpCode.length !== 6}
              >
                {verifying ? 'Verifying…' : 'Verify & continue'}
              </button>

              <div className="otp-actions">
                <button type="button" className="btn btn-outline btn-block" onClick={resend} disabled={resendIn > 0 || busy}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </button>
                <button type="button" className="otp-back" onClick={backToForm}>
                  ← Use a different email
                </button>
              </div>
            </div>
          ) : (
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
                  ? 'Sending code…'
                  : mode === 'login' ? 'Send me a code' : 'Create account & send code'}
              </button>
            </form>
          )}

          {productHint && mode === 'login' && step === 'form' && (
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
