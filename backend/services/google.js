/* ==========================================================================
   services/google.js — verifies Google ID tokens from "Continue as Google"
   (Google Identity Services).

   The frontend receives a JWT credential from Google's Sign-In flow and this
   service validates it against Google's published signing keys (JWKS), then
   returns the verified profile (email, name, picture, sub).

   Configure:
     GOOGLE_CLIENT_ID — OAuth 2.0 Client ID (…apps.googleusercontent.com)
                        from Google Cloud Console → APIs & Services →
                        Credentials. Must be the SAME value the frontend uses
                        as VITE_GOOGLE_CLIENT_ID.
   ========================================================================== */
import jwt from 'jsonwebtoken'

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const CERTS_CACHE_MS = 60 * 60 * 1000 // refetch Google's signing keys hourly

let cachedKeys = null
let cachedAt = 0

async function getSigningKeys() {
  if (cachedKeys && Date.now() - cachedAt < CERTS_CACHE_MS) return cachedKeys
  const res = await fetch(CERTS_URL)
  if (!res.ok) throw new Error('Could not fetch Google signing keys')
  const jwks = await res.json()
  cachedKeys = jwks.keys || []
  cachedAt = Date.now()
  return cachedKeys
}

export function googleConfigured() {
  return !!process.env.GOOGLE_CLIENT_ID
}

/**
 * Verify a Google ID token (the `credential` field from the GIS callback).
 * Throws with a readable message when the token is invalid; otherwise returns
 * the verified payload ({ sub, email, email_verified, name, picture, ... }).
 */
export async function verifyGoogleToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured')

  let header
  try {
    const [headerB64] = String(idToken).split('.')
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Malformed Google token')
  }

  const keys = await getSigningKeys()
  const key = keys.find((k) => k.kid === header.kid)
  if (!key || !key.x5c || !key.x5c.length) {
    throw new Error('Google token signed by an unknown key')
  }

  /* x5c[0] is the signing certificate — jsonwebtoken accepts it as a PEM. */
  const cert = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`
  const payload = jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: clientId,
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    clockTolerance: 60,
  })

  if (!payload.email || !payload.email_verified) {
    throw new Error('Google account has no verified email')
  }
  return payload
}
