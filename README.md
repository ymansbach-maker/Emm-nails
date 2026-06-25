# GEMMYS — Barbershop Booking Platform

Hebrew-first (RTL) booking site for a barbershop: public landing page with a
booking flow, plus a password-protected admin dashboard.

## Stack

| Part | Tech | Deploys to |
|------|------|-----------|
| `client/` | Vite + React + TypeScript, custom CSS (no UI framework) | Vercel |
| `server/` | Node + Express + SQLite (built-in `node:sqlite`, no native deps) | Render |

Requires **Node >= 22.5** (uses the built-in SQLite module).

## Run locally

```powershell
# Terminal 1 — API
cd server
npm install
$env:ADMIN_PASSWORD = 'your-password'   # required
npm run dev                              # http://localhost:3001

# Terminal 2 — site
cd client
npm install
npm run dev                              # http://localhost:5173 (proxies /api)
```

- Public site: `http://localhost:5173/`
- Admin: `http://localhost:5173/admin` (password = `ADMIN_PASSWORD`)

## Business rules (enforced server-side)

- Sun/Tue–Thu 10:00–20:00 (break 14:00–15:00), Fri 09:00–12:00, Mon+Sat closed (edit `server/src/config.js`)
- 30-minute slots, bookable up to 30 days ahead, Israel time (Asia/Jerusalem)
- Double bookings are impossible: `UNIQUE(business_id, date, time)` at the DB level

## Deploy

### Backend — Render

`render.yaml` is included (Blueprint deploy). Set in the dashboard:

- `ADMIN_PASSWORD` — the admin password
- `CORS_ORIGIN` — your Vercel URL (e.g. `https://gemmys.vercel.app`)

**Important:** SQLite needs a persistent disk (`DATA_DIR=/var/data`), which
requires a paid Render instance. On the free tier the database resets on every
deploy/restart — fine for testing, not for a live business.

### Frontend — Vercel

- Root directory: `client`
- Build command: `npm run build`, output: `dist` (auto-detected)
- Env var: `VITE_API_URL=https://<your-render-service>.onrender.com`

## Replacing the gallery placeholders

Drop real photos into `client/public/images/gallery/` as `1.jpg`, `2.jpg`, … `6.jpg`.
The gallery component loads them automatically from those paths — no code changes needed.

## Future multi-business support

The schema and API are already namespaced per business (`businesses` table,
`/api/b/:slug/...` routes). To add `/b/<name>` pages later: insert a row in
`businesses`, add the route in `client/src/main.tsx`, and read the slug from
the URL instead of the `BUSINESS_SLUG` constant in `client/src/api.ts`.
