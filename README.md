# Nitya Seva · ISKCON Jiasarai

A purpose-driven website inviting devotees and well-wishers to become regular
(monthly) donors. Visitors fill a short form with their details and intended
offering; a devotee then contacts them personally. No payment is taken online.

Built with React 19 + Vite.

## Files

| File | What to edit it for |
| --- | --- |
| `src/config.js` | Phone, WhatsApp, email, address, impact numbers, form endpoint |
| `src/content.js` | Seva purposes, monthly tiers, journey steps, FAQ, form options |
| `src/components/` | One component per page section |
| `public/images/` | Photos used across the page |
| `src/styles.css` | Colours and layout |
| `src/lib/submit.js` | Where form submissions are sent |
| `apps-script/Code.gs` | Google Sheet backend for form submissions |

## Develop

Requires Node 20+.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the production build
```

## Where form submissions go

Until `formEndpoint` is set in `src/config.js`, submitting the form opens
WhatsApp with the details pre-filled to `whatsappNumber`. To collect
submissions in a Google Sheet instead:

1. Create a Google Sheet (e.g. "Nitya Seva Sevaks").
2. In the sheet: **Extensions → Apps Script**, replace the code with
   `apps-script/Code.gs`, and optionally set `NOTIFY_EMAILS`.
3. **Deploy → New deployment → Web app**. Execute as: *Me*. Who has access:
   *Anyone*. Authorize when prompted.
4. Copy the web app URL (ends in `/exec`) into `formEndpoint` in `src/config.js`.

Each submission becomes a row with a `Status` column (starts as `New`) that
the seva team can update as they call people.

## Deploy on GitHub Pages

`.github/workflows/deploy.yml` builds and publishes the site on every push to
`main`. Enable it once in the repo: **Settings → Pages → Source: GitHub Actions**.

Git runs inside the personal-dev container (see `~/Self/.personal-dev`):

```bash
~/Self/.personal-dev/dev.sh
cd nitya-seva/nitya-seva
git add -A && git commit -m "..." && git push
```

## Before launch

- Replace the placeholder phone, WhatsApp number, email and address in `src/config.js`.
- Replace the placeholder impact numbers in `src/config.js` with real figures.
- Review the tier names and amounts in `src/content.js`.
- Replace the AI-generated placeholder photos in `public/images/` with real
  photos from the temple, keeping the same file names (or update the names in
  `src/content.js`). Roughly 1000px wide, 4:3 JPEGs work best.
