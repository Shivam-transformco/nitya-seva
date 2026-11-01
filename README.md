# Nitya Seva · ISKCON Jiasarai

A purpose-driven website inviting devotees and well-wishers to become regular
(monthly) donors. Visitors fill a short form with their details and intended
offering; a devotee then contacts them personally. No payment is taken online.

## Project structure

```
nitya-seva/
├── client/          # React + Vite frontend
│   ├── src/
│   ├── public/
│   ├── apps-script/
│   ├── package.json
│   └── vite.config.js
├── server/          # Express + MongoDB API
│   ├── server.js
│   └── package.json
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
| `server/server.js` | API endpoint and MongoDB connection |

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

# Client
cd client
npm install
npm run dev               # starts on http://localhost:5173
npm run build             # production build in client/dist/
npm run preview           # serve the production build locally
```

### Environment variables

**Client** (`client/.env`):
```
VITE_API_URL=http://localhost:3001
```
Defaults to `http://localhost:3001` if not set. In production, set this to
your deployed server URL.

**Server** (`server/.env`):
```
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.nztt4or.mongodb.net/
PORT=3001
```

## Deploy

The client and server are deployed separately:

- **Client**: Deploy `client/` as a static site (Vercel, Netlify, etc.).
  Set the `VITE_API_URL` environment variable to your production server URL.
  Framework preset: Vite, output directory: `dist`.

- **Server**: Deploy `server/` as a Node.js app (Railway, Render, Fly.io, etc.).
  Set `MONGO_URI` and `PORT` as environment variables.

## Before launch

- Replace the placeholder phone, WhatsApp number, email and address in `client/src/config.js`.
- Replace the placeholder impact numbers in `client/src/config.js` with real figures.
- Review the tier names and amounts in `client/src/content.js`.
- Replace the AI-generated placeholder photos in `client/public/images/` with real
  photos from the temple, keeping the same file names (or update the names in
  `client/src/content.js`). Roughly 1000px wide, 4:3 JPEGs work best.
