# Deploy notes — OTP login & admin hardening

These changes are **already in the live database** (the `otp_codes` table exists and
the old `admin/admin123` account was removed during verification). Deploying the
code to Vercel turns them on for the website.

## 1. Add env vars in Vercel (backend service)

| Variable | What it is |
|---|---|
| `EMAILJS_SERVICE_ID` | EmailJS service ID (`service_xxx`) |
| `EMAILJS_TEMPLATE_ID` | EmailJS template ID (`template_xxx`) |
| `EMAILJS_PUBLIC_KEY` | EmailJS account Public Key |
| `EMAILJS_PRIVATE_KEY` | Optional — EmailJS Private Key (server auth) |
| `ADMIN_INITIAL_PASSWORD` | Your admin password (min 8 chars). On every deploy this keeps the `admin` account in sync with it. |

`DATABASE_URL` and `JWT_SECRET` should already be set.

## 2. Create the EmailJS template

1. EmailJS dashboard → Email Templates → New Template.
2. "To Email" must use the dynamic field `{{to_email}}` (or leave it empty so the
   code's `to_email` parameter is used).
3. The body must render the OTP, e.g.:

   ```
   Your Sree Sangram one-time password is {{otp}}.
   It is valid for 10 minutes. Do not share it with anyone.
   ```

4. Copy the template ID into `EMAILJS_TEMPLATE_ID`.

The backend sends the email itself (server-to-server via the EmailJS REST API),
so nothing extra is needed in the frontend.

## 3. Admin access

- There is **no default admin password** anymore — `admin/admin123` is gone and
  can never be used.
- `ADMIN_INITIAL_PASSWORD` creates/updates the `admin` account on deploy.
- To rotate a password from a terminal, run inside `backend/`:
  `npm run create:admin` (prints a strong random password once).

## 4. What changed

- Customer **login and signup now require an email OTP** (6-digit code, 10-min
  expiry, single-use, 5 per email per hour). `/users/login` and `/users/register`
  refuse requests without a freshly verified OTP token.
- The frontend no longer calls `http://localhost:3001` — it uses the same origin
  (`/api`), which is what fixes the "Failed to fetch" error on the live site.
- The logged-in state is derived from the database-validated session, never from
  a cached profile in localStorage.
