# Ledgerline

A manual portfolio tracker: sign up, log in, add holdings by hand, and see
total value, allocation by asset type, and a value-over-time chart.

## Important limitation

Accounts and holdings are saved with `localStorage`, in the visitor's own
browser. There is no server and no database. This means:

- Data does not sync across devices or browsers.
- Clearing site data / cache erases everything.
- Two different visitors to your deployed site do NOT share data or see
  each other's accounts — each browser is its own island.
- This is fine for a demo or personal single-device use, but is not a real
  multi-user backend. If you want real accounts that work across devices,
  the next step is swapping `src/lib/storage.js` for calls to a real
  backend (e.g. Supabase, which handles auth + a Postgres database and
  works well with Vercel).

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

**Option A — via GitHub (recommended)**
1. Push this folder to a new GitHub repository.
2. Go to https://vercel.com/new and import that repository.
3. Vercel auto-detects Vite. Framework preset: "Vite". Build command:
   `npm run build`. Output directory: `dist`. Click Deploy.

**Option B — via Vercel CLI**
```bash
npm install -g vercel
cd ledgerline
vercel
```
Follow the prompts; accept the defaults (Vite is auto-detected).

No environment variables or extra config are needed — it's fully
self-contained.
