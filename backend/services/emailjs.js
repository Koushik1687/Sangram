/* ==========================================================================
   services/emailjs.js — sends transactional emails through EmailJS's REST API.

   Configure in backend/.env (and in the Vercel dashboard for production):
     EMAILJS_SERVICE_ID   — the EmailJS service (connected email provider) ID
     EMAILJS_TEMPLATE_ID  — the EmailJS template ID (must render {{otp}})
     EMAILJS_PUBLIC_KEY   — the EmailJS account Public Key
     EMAILJS_PRIVATE_KEY  — optional EmailJS Private Key (server auth)

   The EmailJS template should be set up so the recipient comes from the
   {{to_email}} template parameter, e.g. a body like:

     Your Sree Sangram one-time password is {{otp}}.
     It is valid for 10 minutes. Do not share it with anyone.
   ========================================================================== */

const ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send'

export function emailJsConfigured() {
  return !!(
    process.env.EMAILJS_SERVICE_ID
    && process.env.EMAILJS_TEMPLATE_ID
    && process.env.EMAILJS_PUBLIC_KEY
  )
}

/**
 * Send the OTP email via EmailJS.
 * Throws on network/API failure so callers can surface a helpful message.
 */
export async function sendOtpEmail({ toEmail, toName, otp }) {
  if (!emailJsConfigured()) {
    throw new Error(
      'EmailJS is not configured — set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID and EMAILJS_PUBLIC_KEY',
    )
  }

  const body = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    template_params: {
      to_email: toEmail,
      to_name: toName || toEmail,
      otp,
      subject: 'Your Sree Sangram OTP',
    },
  }
  if (process.env.EMAILJS_PRIVATE_KEY) {
    body.accessToken = process.env.EMAILJS_PRIVATE_KEY
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`EmailJS send failed (${res.status}): ${String(text).slice(0, 200)}`)
  }
  return { ok: true }
}
