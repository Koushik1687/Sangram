/* ==========================================================================
   lib/google.js — "Continue as Google" (Sign in with Google / GIS).

   Loads Google's Identity Services script and renders the Google button into
   a host element. The callback receives the ID token (`credential`), which
   the backend verifies at POST /api/users/google.

   Configure:
     VITE_GOOGLE_CLIENT_ID — OAuth 2.0 Client ID (…apps.googleusercontent.com)
                             in frontend/.env.local (dev) and the Vercel env
                             vars (production). The backend needs the SAME
                             value as GOOGLE_CLIENT_ID.
   When the Client ID is missing the button is simply not rendered.
   ========================================================================== */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export function isGoogleConfigured() {
  return !!CLIENT_ID
}

let scriptPromise = null

function loadGsi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.defer = true
      s.onload = () => resolve()
      s.onerror = () => {
        scriptPromise = null
        reject(new Error('Could not load Google Sign-In'))
      }
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

/**
 * Render the Google button into `el`. When the user finishes signing in,
 * `onCredential` is called with the ID token (a JWT string).
 */
export async function renderGoogleButton(el, onCredential) {
  if (!isGoogleConfigured()) throw new Error('VITE_GOOGLE_CLIENT_ID is not set')
  await loadGsi()
  const id = window.google?.accounts?.id
  if (!id) throw new Error('Google Sign-In failed to initialise')

  id.initialize({
    client_id: CLIENT_ID,
    callback: (response) => onCredential(response?.credential),
    auto_select: false,
  })

  /* The width option accepts a pixel number — cap it at Google's default and
     let the container scale it down on narrow screens. */
  id.renderButton(el, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: Math.min(el.clientWidth || 400, 400),
  })
}
