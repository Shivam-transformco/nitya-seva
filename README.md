# Nitya Seva · ISKCON Jiasarai

A purpose-driven website inviting devotees and well-wishers to become regular
(monthly) donors. Visitors fill a short form with their details and intended
offering; a devotee then contacts them personally. No payment is taken online.

Plain HTML/CSS/JS with no build step, so it can be hosted anywhere (GitHub
Pages, Netlify, Cloudflare Pages).

## Files

| File | What to edit it for |
| --- | --- |
| `config.js` | Phone, WhatsApp, email, address, impact numbers, form endpoint |
| `index.html` | Copy, seva purposes, monthly tiers, FAQ |
| `styles.css` | Colours and layout |
| `app.js` | Form behaviour |
| `apps-script/Code.gs` | Google Sheet backend for form submissions |

## Preview locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Where form submissions go

Until `formEndpoint` is set in `config.js`, submitting the form opens WhatsApp
with the details pre-filled to `whatsappNumber`. To collect submissions in a
Google Sheet instead:

1. Create a Google Sheet (e.g. "Nitya Seva Sevaks").
2. In the sheet: **Extensions → Apps Script**, replace the code with
   `apps-script/Code.gs`, and optionally set `NOTIFY_EMAILS`.
3. **Deploy → New deployment → Web app**. Execute as: *Me*. Who has access:
   *Anyone*. Authorize when prompted.
4. Copy the web app URL (ends in `/exec`) into `formEndpoint` in `config.js`.

Each submission becomes a row with a `Status` column (starts as `New`) that
the seva team can update as they call people.

## Deploy on GitHub Pages

Git runs inside the personal-dev container (see `~/Self/.personal-dev`):

```bash
~/Self/.personal-dev/dev.sh
cd nitya-seva/nitya-seva
git add -A && git commit -m "Nitya Seva website"
gh repo create nitya-seva --public --source . --push
gh api -X POST repos/{owner}/nitya-seva/pages -f "source[branch]=main" -f "source[path]=/"
```

## Before launch

- Replace the placeholder phone, WhatsApp number, email and address in `config.js`.
- Replace the placeholder impact numbers in `config.js` with real figures.
- Review the tier names and amounts in `index.html`.
- Consider adding real photos of the Deities, hall, kirtans and festivals.
