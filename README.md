# Nitya Seva · ISKCON Jiasarai

A purpose-driven website inviting devotees and well-wishers to become regular
(monthly) donors. Visitors fill a short form with their details and intended
offering; a devotee then contacts them personally. No payment is taken online.

## Project structure

```
nitya-seva/
├── client/          # React + Vite frontend
│   ├── src/           # public site; src/portal/ is the staff portal
│   ├── portal/        # entry page for the staff portal (/portal/)
│   ├── public/
│   ├── apps-script/
│   ├── package.json
│   └── vite.config.js
├── server/          # Express + MongoDB API (TypeScript)
│   ├── src/
│   ├── scripts/
│   ├── docs/ARCHITECTURE.md
│   └── package.json
├── e2e/             # Playwright tests that drive client + server together
├── package.json     # Root convenience scripts
└── README.md
```

The client and server are **fully independent** — each has its own `package.json`
and can be deployed separately.

## Files

| File | What to edit it for |
| --- | --- |
| `client/src/config.js` | Phone, WhatsApp, email, address, impact numbers |
| `client/src/content.js` | Seva purposes, monthly tiers, journey steps, FAQ |
| `client/src/components/` | One component per page section |
| `client/public/images/` | Photos used across the page |
| `client/src/styles.css` | Colours and layout |
| `client/src/lib/submit.js` | Where form submissions are sent |
| `client/src/portal/` | Staff portal: login, dashboard, pledges, follow-ups, payments, staff, reports |
| `server/docs/ARCHITECTURE.md` | How the API is designed: modules, data model, endpoints, security |
| `server/src/modules/` | One folder per feature (public form, auth, pledges, follow-ups, payments, reports…) |

## Develop

Requires Node 20+.

### Quick start (from the root)

```bash
npm run install:all       # install deps for both client and server
npm run dev:server        # start the API server on http://localhost:3001
npm run dev:client        # (separate terminal) start Vite on http://localhost:5173
```

### Or individually

```bash
# Server
cd server
npm install
npm run dev               # starts on http://localhost:3001 with --watch
npm run typecheck && npm test

# Client
cd client
npm install
npm run dev               # starts on http://localhost:5173
npm run build             # production build in client/dist/
npm run preview           # serve the production build locally
```

The staff portal is at http://localhost:5173/portal/ (production:
https://nityaseva.iskconjiasarai.com/portal/). Create the first admin with
`npm run create-admin` in `server/`.

### End-to-end tests

They run the real site, portal and API in Chrome against a throwaway local
MongoDB (never the production database):

```bash
docker run -d --name nitya-e2e-mongo -p 27018:27017 mongo:7   # once
npm run install:e2e
npm run test:e2e                                               # add -- --headed to watch
```

### Environment variables

**Client** (`client/.env`):
```
VITE_API_URL=https://nityasevaserver.iskconjiasarai.com
```
Defaults to `https://nityasevaserver.iskconjiasarai.com`. For local
development, override with `VITE_API_URL=http://localhost:3001`.

**Server** (`server/.env`): see `server/.env.example` for the full list
(`MONGO_URI`, `MONGO_DB`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `CRON_SECRET`, `PORT`).

Server scripts: `npm run db:indexes`, `npm run migrate` (old submissions into
pledges; add `-- --dry` to preview) and
`npm run create-admin -- --name "Name" --email you@example.com`.

## Deploy

The client and server are deployed separately:

- **Client**: Deploy `client/` as a static site (Vercel, Netlify, etc.).
  Set the `VITE_API_URL` environment variable to your production server URL.
  Framework preset: Vite, output directory: `dist`.

- **Server**: Deployed on Vercel with `server/` as the project root;
  `src/index.ts` is picked up automatically and `vercel.json` sets the Mumbai
  region and the daily cron. Set the variables from `server/.env.example`.
  Follow the migration steps in `server/docs/ARCHITECTURE.md` before
  switching production over.

## Before launch

- Replace the placeholder phone, WhatsApp number, email and address in `client/src/config.js`.
- Replace the placeholder impact numbers in `client/src/config.js` with real figures.
- Review the tier names and amounts in `client/src/content.js`.
- Replace the AI-generated placeholder photos in `client/public/images/` with real
  photos from the temple, keeping the same file names (or update the names in
  `client/src/content.js`). Roughly 1000px wide, 4:3 JPEGs work best.
