# GEMMYS Template
This is the base template. Do NOT deploy this directly.
For each new client: duplicate this repo, edit `client/src/config.ts` and `server/src/config.js`, add logo and photos, then deploy.

---

## Quick-start checklist

- [ ] Duplicate this repo (don't fork — start a fresh private repo)
- [ ] Edit `client/src/config.ts` — business name, phone, colors, services, hours display
- [ ] Edit `server/src/config.js` — services list, business contact info, working hours
- [ ] Replace `client/public/images/logo.png` with the client's logo
- [ ] Replace `client/public/images/gallery/1.jpg … 6.jpg` with real photos
- [ ] Update `client/src/gallery.ts` alt text to describe each photo
- [ ] Set `ADMIN_PASSWORD` environment variable on the server host
- [ ] Set `VITE_API_URL` environment variable on the frontend host

---

To set it up for a new client, edit **two files** and follow the deployment steps below. Nothing else needs to change.

---

## 1. Client config — `client/src/config.ts`

Edit this file to customise everything visible on the website.

| Field | Description |
|---|---|
| `business_name` | Displayed in the hero, footer, admin panel, and email subjects |
| `tagline` | Subtitle line in the hero section |
| `hero_badge` | Short label above the business name (not rendered by default — add to Hero.tsx if desired) |
| `phone` | Shown in contact section and email footer |
| `whatsapp_number` | International format without `+`, e.g. `9720547870558` |
| `instagram` | Instagram handle without `@` |
| `address` | Shown in contact section and email footer |
| `maps_url` | Full Google Maps URL for the address link |
| `frontend_url` | The deployed Vercel URL (used for email "book again" links) |
| `hours_display` | Array of strings shown in the hero hours row |
| `max_days_ahead` | How many days ahead bookings are allowed (must match server value) |
| `colors` | Brand color palette applied as CSS variables at runtime |
| `pricing` | Array of `{ name, price }` objects for the pricing section |

### Colors

The seven color keys map to the design system:

| Key | Role |
|---|---|
| `bg` | Page background |
| `surface` | Cards and raised panels |
| `border` | Dividers and input borders |
| `primary` | Accent color (buttons, highlights, stars) |
| `secondary` | Copper/warm accent (pricing, hover states) |
| `text` | Primary text |
| `text_muted` | Secondary/dimmed text |

---

## 2. Server config — `server/src/config.js`

Edit this file to configure business hours and contact details used in emails.

| Field | Description |
|---|---|
| `business_name` | Used in email subjects and body copy |
| `phone` | Shown in email footer |
| `address` | Shown in email footer |
| `frontend_url` | Fallback if `FRONTEND_URL` env var is not set |
| `hours` | Working hours per day-of-week (0 = Sunday … 6 = Saturday) |

### Hours format

```js
hours: {
  0: { open: '10:00', close: '20:00', break: ['14:00', '15:00'] }, // open with a break
  1: null,                                                           // closed
  5: { open: '09:00', close: '12:00', break: null },                // open, no break
}
```

`WORKING_HOURS` and `BREAKS` are derived automatically — do not edit them.

---

## 3. Logo

Drop the client's logo at:

```
client/public/images/logo.png
```

Recommended size: 200×200 px, transparent background.

---

## 4. Gallery images

Replace the six gallery images at:

```
client/public/images/gallery/1.jpg … 6.jpg
```

Recommended aspect ratio: 4:5 (portrait).

---

## 5. Environment variables

### Server (`server/.env` or Render dashboard)

| Variable | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD` | **Yes** | Password for the admin dashboard |
| `RESEND_API_KEY` | No | Enables email confirmations via resend.com |
| `FRONTEND_URL` | No | Frontend URL for email links (overrides config default) |
| `CORS_ORIGIN` | No | Comma-separated allowed origins (defaults to all) |
| `DATA_DIR` | No | Path for the SQLite database file (use Render persistent disk) |
| `PORT` | No | Server port (defaults to 3001) |

### Client (`client/.env` or Vercel dashboard)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | **Yes (prod)** | Full URL of the Render backend, e.g. `https://your-api.onrender.com` |

---

## 6. Deploy to Vercel (frontend)

1. Push the repo to GitHub.
2. Import the repo in [vercel.com](https://vercel.com).
3. Set **Root Directory** to `client`.
4. Add environment variable: `VITE_API_URL=https://your-api.onrender.com`
5. Deploy.

---

## 7. Deploy to Render (backend)

1. Create a new **Web Service** in [render.com](https://render.com).
2. Connect the same GitHub repo.
3. Set **Root Directory** to `server`.
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `node src/index.js`
6. Add a **Persistent Disk** mounted at `/data` and set `DATA_DIR=/data`.
7. Add environment variables: `ADMIN_PASSWORD`, `FRONTEND_URL`, and optionally `RESEND_API_KEY`.
8. Deploy.

---

## 8. Run locally

```bash
# Backend
cd server
cp .env.example .env        # fill in ADMIN_PASSWORD at minimum
npm install
npm start                   # runs on http://localhost:3001

# Frontend (separate terminal)
cd client
npm install
npm run dev                 # runs on http://localhost:5173
```

The Vite dev server proxies `/api` to `localhost:3001` automatically.
