# Deploy notes — customer login via Google

Customer login is now **"Continue as Google"** (primary) with email + password
as the fallback. EmailJS/OTP has been removed — no email service is needed.

The backend runs on Vercel as a **serverless function** (Services on Fluid
compute): `server.js` exports the Hono app as its default export, and the DB
is initialised **lazily on first request — never at module load**. Vercel
waits on any I/O started while the module loads, so opening the Neon
connection at boot used to hang every `/api` call (that was the cause of the
old `FUNCTION_INVOCATION_FAILED` / "Failed to fetch" errors). Now a missing or
unreachable DB returns a fast 503 and retries on the next request.

## 1. Env vars in Vercel (project → Settings → Environment Variables)

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon connection string (or any `POSTGRES_*` var from the Neon integration — the backend accepts `DATABASE_URL`, `POSTGRES_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`) |
| `JWT_SECRET` | Secret for signing customer + admin JWTs |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (backend verifies ID tokens against it) |
| `VITE_GOOGLE_CLIENT_ID` | Same Client ID, inlined into the frontend build (Vite `VITE_` prefix). Without it the Google button is hidden |
| `ADMIN_INITIAL_PASSWORD` | Creates/updates the `admin` account on deploy (min 8 chars) |

## 2. Google sign-in setup

1. Google Cloud Console → APIs & Services → Credentials → **Create
   Credentials → OAuth client ID** → Application type **Web application**.
2. Under **Authorized JavaScript origins** add:
   - `https://sangram-nu.vercel.app` (production — or your custom domain)
   - `http://localhost:5173` (local dev)
3. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) and set it as
   both `VITE_GOOGLE_CLIENT_ID` (frontend build) and `GOOGLE_CLIENT_ID`
   (backend), plus in `backend/.env` and `frontend/.env.local` locally.
4. Redeploy. The login page then shows the **"Continue as Google"** button.
   First-time Google users get an account created automatically (no password,
   no OTP — Google already verified the email).

## 3. Admin access

- There is **no default admin password** — `admin/admin123` is gone.
- `ADMIN_INITIAL_PASSWORD` creates/updates the `admin` account on deploy.
- To rotate a password from a terminal, run inside `backend/`:
  `npm run create:admin` (prints a strong random password once).

## 4. What changed

- Customer login page: **"Continue as Google"** button on top + email/password
  sign in / create account below. Both call the API, which reads/writes the
  Neon database — every admin edit shows up on the public site immediately.
- EmailJS/OTP removed: `/users/otp/send`, `/users/otp/verify` and the
  `emailjs.js` service are gone; login/register no longer need an OTP token.
- The backend is serverless-ready: `export default app.fetch`, DB initialised
  lazily (never at module load — Vercel waits on module-load I/O), a 10s
  connection timeout, and non-fatal retryable init, so `/api` stays up even if
  the database env is wrong (requests then return a readable 503 instead of a
  function crash or hang).

## 5. If the live site still shows "Failed to fetch" on signup

That message means the browser could not reach the backend at all, so check in
this order:

1. **Redeploy** — the live site must run the current code. Push the repo to
   trigger the Vercel deploy, then hard-refresh.
2. **Backend health** — visit `https://sangram-nu.vercel.app/api/health`; it
   should return `{"status":"ok",...}`. A `FUNCTION_INVOCATION_FAILED` page
   means the backend function crashed at invocation; a request that hangs with
   no response means something is blocking the function (check Vercel function
   logs, confirm `DATABASE_URL` / `JWT_SECRET` are set, and confirm Neon is
   reachable from Vercel).
3. **Google button missing** — `VITE_GOOGLE_CLIENT_ID` must be set in Vercel
   BEFORE the frontend build runs (Vite inlines it at build time).
