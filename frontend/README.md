# Sree Sangram — Frontend (Vite + React)

The public website and admin panel, migrated from the static HTML/JS site in
`../srisangram V1.0/` to a Vite + React SPA.

## Stack

- **Vite 8 + React 19** (JSX)
- **react-router-dom** for routing (`/`, `/admin/login`, `/admin`)
- **Hono API** at `http://localhost:3001` (see `../backend`) — the frontend
  falls back to bundled local data when the API is unreachable

## Run

Terminal 1 — API server:

```bash
cd ../backend
npm start
```

Terminal 2 — dev server:

```bash
npm run dev
```

Open http://localhost:5173. Admin panel: http://localhost:5173/admin/login
(demo credentials `admin` / `admin123`).

## Layout

```
src/
  components/   Public site sections (Hero, BookingForm, HoroscopeSection, …)
  hooks/        useScrollReveal
  lib/          api.js (API client) · data.js (local defaults + fetch) · horoscope.js (reading engine)
  pages/        Home · AdminLogin · AdminDashboard (+ admin/admin.css)
  index.css     Ported from the original assets/css/style.css
public/images/  Copied from the original assets/images
```

## Notes

- Slot availability and bookings hit `/api/bookings`; the admin dashboard does
  full CRUD through `/api/*` with a bearer token.
- Admin-set horoscope overrides (`PUT /api/horoscope/:sign`) are shown on the
  public horoscope section for today.
