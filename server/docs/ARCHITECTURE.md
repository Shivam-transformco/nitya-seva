# Nitya Seva backend: architecture

## 1. What the backend does

| Who | What they do |
| --- | --- |
| **Visitors** (public site) | Submit a pledge form; see the live counter. |
| **Follow-up devotees** (`followup` role) | See the pledges assigned to them, call the sevak, log every call, set the next follow-up date, record payments they collect. |
| **Admins** (`admin` role) | Everything a follow-up devotee can do, for all pledges; plus assign pledges, manage staff accounts, see reports and export data. |

Notifications are in-portal only for now. Payments are recorded by hand (no gateway).

## 2. Stack

- **TypeScript** on **Node 20**, **Express 5**.
- **MongoDB Atlas** through the official driver (no ODM). Documents are typed with TypeScript interfaces; request bodies are validated with **zod**.
- **Vercel**: the whole Express app is one Vercel Function (`src/index.ts` default-exports the app). Region `bom1` (Mumbai). A daily **Vercel Cron** drives time-based work.
- Auth: email and password (**bcryptjs**), session as a signed **JWT in an httpOnly cookie**.

## 3. Design principles

1. **Layered modules.** Each feature lives in `src/modules/<feature>/` with the same layers:
   - `*.routes.ts`: HTTP only. Parse and validate input, call the service, shape the response. No database code.
   - `*.service.ts`: business rules (who may do what, status transitions, side effects such as notifications and audit entries).
   - `*.repository.ts`: the only place that talks to MongoDB for that collection.
   - `*.schema.ts`: zod schemas for request bodies and queries; the source of truth for input shapes.
2. **Validate at the edge, trust inside.** Every request body, query and param is parsed by zod before it reaches a service. Services receive typed, clean values.
3. **One error type.** Services throw `AppError` (`badRequest`, `notFound`, `forbidden`, …). A single error middleware turns it into `{ ok: false, error, code, details? }`. Unknown errors are logged and become a generic 500, so internals never leak.
4. **Authorisation in the service, not only the route.** Routes require a logged-in user with a role; services additionally check ownership (a follow-up devotee can only touch pledges assigned to them).
5. **Configuration is validated at startup.** `src/config/env.ts` parses `process.env` with zod and fails fast with a clear message.
6. **Serverless-friendly.** One cached `MongoClient` per function instance; no in-memory state that matters (rate limits are stored in MongoDB); no background timers (cron hits an HTTP route instead).
7. **Backwards compatible public API.** `/api/submit`, `/api/stats` and `/api/health` keep the request and response shapes the current site uses.
8. **Everything a staff member changes is audited** in `auditLogs`.

## 4. Folder layout

```
server/
  src/
    index.ts              Builds the Express app (middleware, routes, errors) and
                          default-exports it as the Vercel function. Vercel's Express
                          preset needs the entry to import express itself, and would
                          pick a src/app.ts over it, so keep both in this one file.
    dev.ts                Local entry: app.listen
    config/env.ts         Validated environment
    db/mongo.ts           Cached client, typed collections
    db/indexes.ts         Index definitions (run by script)
    domain/types.ts       Document interfaces and enums
    lib/                  errors, http helpers, phone, rate limit, passwords, tokens
    middleware/           auth, error handler, not found
    modules/
      public/             submit, stats, health
      auth/               login, logout, me, change password
      users/              staff accounts (admin only)
      pledges/            list, detail, update status, assign
      followups/          call logs per pledge
      payments/           manual payment records, receipt numbers
      notifications/      in-portal notifications
      reports/            summary, monthly collections, volunteer activity, CSV
      bin/                deleting pledges and payments, "Recently deleted", restore
      audit/              audit log writer
      cron/               daily job endpoint
  scripts/
    create-admin.ts       First admin account
    migrate-submissions.ts  Old `submissions` collection to sevaks + pledges
    ensure-indexes.ts
  tests/                  vitest unit tests for pure logic
  vercel.json             region, cron
```

## 5. Data model

Money is stored as **whole rupees in an integer** (all offerings are whole rupees). Dates are UTC `Date`s; months are `"YYYY-MM"` strings in IST.

### `users` (staff)
`name, email (unique, lowercase), passwordHash, role: "admin" | "followup", active, tokenVersion, mustChangePassword, lastLoginAt, createdAt, updatedAt`

`tokenVersion` is embedded in the session token; bumping it (password change, deactivation) logs the user out everywhere.

### `sevaks` (the people who pledge)
`name, phone (E.164, unique), email, createdAt, updatedAt`

One sevak can have several pledges over time. Phone is the identity because it is required and is how devotees reach them.

### `pledges`
`sevakId, seva, amount, frequency: "Monthly", status, assignedTo?, message, consent, source: { submittedFrom, ip?, userAgent? }, nextFollowUpAt?, lastContactAt?, flag?, hiddenFromCounter?, paymentSetup?, lastStatusChange?, legacyId?, createdAt, updatedAt`

`lastStatusChange: { from, to, by, at, followupId?, nextFollowUpAt? }` is the most recent status change, so it can be undone; see "Corrections" below.

`paymentSetup` records how the sevak gives, independent of `status`:

```
{ mode: "ecs" | "upi_autopay" | "manual",
  mandate?: { status: "submitted" | "active" | "rejected" | "cancelled", bank, reference /* UMRN */, debitDay?, startMonth? },
  note, updatedBy, updatedAt }
```

`mandate` is required for the two auto-debit modes and dropped for `manual`. Bank account numbers are never stored. Auto-debits still arrive as manual entries: when the bank statement shows an ECS credit, staff record a payment with method `ecs` (the form suggests it).

Status lifecycle (enforced in `pledges.service.ts`):

```
new ──► contacted ──► confirmed ◄──► paused
 │          │             │            │
 └──────────┴──► lost     └──► cancelled ◄┘
```

- `lost`: never became a sevak (declined, unreachable).
- `cancelled`: was confirmed, has stopped.

**Corrections.** Anyone working on a pledge can undo its last status change (`POST /status/undo`), whether a button or a follow-up made it; one level, and only while the status is still what the change set. Admins can also set any status with `correction: true`. Neither may move a pledge with payments back to `new`, `contacted` or `lost`.

### `followups` (every interaction)
`pledgeId, sevakId, byUserId, channel: "call" | "whatsapp" | "visit" | "note", outcome: "reached" | "no_answer" | "callback" | "confirmed" | "declined", note, nextFollowUpAt?, before?: { lastContactAt?, nextFollowUpAt? }, createdAt`

`before` is the pledge's contact dates just before the follow-up was logged. Deleting the latest follow-up puts them back, and undoes a status change it caused.

Logging a follow-up updates the pledge's `lastContactAt` and `nextFollowUpAt`, and moves `new` to `contacted`. Outcomes `confirmed` and `declined` move the pledge to `confirmed` and `lost`.

### `payments`
`pledgeId, sevakId, amount, month, method: "ecs" | "upi_autopay" | "upi" | "cash" | "bank" | "cheque" | "other", reference, receivedAt, recordedBy, receiptNo (unique, e.g. NS-2026-000123), createdAt`

Receipt numbers come from an atomic counter in `counters`.

### `notifications`
`userId, type, title, body, link, readAt?, createdAt`

Types: `pledge.new` (all admins), `pledge.assigned` (assignee), `followup.due` (assignee, daily cron).

### `auditLogs`
`actorId, action, entity, entityId, data, createdAt`

### `deletedItems` (the "Recently deleted" bin)
`kind: "pledge" | "followup" | "payment", itemId, pledgeId, sevakId, reason, pledge?, followups[], payments[], deletedBy, deletedAt`

Deleting moves the whole document here (a pledge brings its follow-ups and payments), so the live collections, counter and reports never need a "deleted" filter. It's written to the bin before the originals are removed, and restoring upserts by `_id`, so a failure part way loses nothing and a retry is safe. Restored payments keep their receipt numbers, which are never reused.

| Delete | Who |
| --- | --- |
| Pledge | Admin |
| Payment | Admin, or whoever recorded it |
| Follow-up | Admin, or whoever logged it |

Restoring and "delete for good" are admin only (`/portal/#/deleted`). A follow-up or payment whose pledge is in the bin can only be restored after the pledge.

### Support collections
- `counters`: `{ _id: "receipt-2026", seq }`
- `settings`: `{ _id: "counter", target, updatedBy, updatedAt }`, the public counter's monthly goal.
- `rateLimits`: `{ _id: "<bucket>:<key>", count, expiresAt }` with a TTL index.
- `submissions`: the old collection, kept read-only after migration.

### Indexes
See `src/db/indexes.ts`. Main ones: `users.email` unique; `sevaks.phone` unique; `pledges` on `(status)`, `(assignedTo, status)`, `(nextFollowUpAt)`, `legacyId` unique sparse; `followups (pledgeId, createdAt)`; `payments (pledgeId, month)`, `receiptNo` unique; `notifications (userId, readAt, createdAt)`; `rateLimits.expiresAt` TTL.

## 6. API

All responses are JSON. Success: `{ ok: true, data }` (public endpoints keep their existing shapes). Error: `{ ok: false, error: "<human message>", code: "<MACHINE_CODE>", details? }`.

### Public (no login)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | Pings MongoDB. |
| GET | `/api/stats` | `{ ok, totalPledged, totalSewaks }`: active pledges (not `lost` or `cancelled`), each sevak counted once. Cached 60 s at the edge. |
| POST | `/api/submit` | Validated; honeypot `website` rejected silently; 5 per hour per IP. Creates or updates the sevak by phone and creates a `new` pledge; notifies admins. |

### Auth
| Method | Path | |
| --- | --- | --- |
| POST | `/api/auth/login` | Email and password; 10 attempts per 15 min per IP and per email. Sets the session cookie. |
| POST | `/api/auth/logout` | Clears the cookie. |
| GET | `/api/auth/me` | Current user. |
| POST | `/api/auth/password` | Change own password; logs out other sessions. |

### Staff (login required)
| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/pledges?status=&assignedTo=&due=&mode=&mandate=&q=&page=&limit=` | admin: all; followup: own. `mode` is a payment mode or `none` |
| GET | `/api/pledges/:id` | pledge with sevak, follow-ups and payments |
| PATCH | `/api/pledges/:id` | amount, seva, message, next follow-up; audited |
| DELETE | `/api/pledges/:id` | admin; moves it to the bin |
| PATCH | `/api/pledges/:id/sevak` | name, phone, email (shared by the sevak's pledges); a phone already in use is a 409 |
| PATCH | `/api/pledges/:id/status` | transition rules apply; `correction: true` (admin) skips them |
| POST | `/api/pledges/:id/status/undo` | undo the last status change |
| DELETE | `/api/pledges/:id/followups/:followupId`, `/api/pledges/:id/payments/:paymentId` | to the bin |
| GET | `/api/deleted?kind=&page=`, POST `/api/deleted/:id/restore`, DELETE `/api/deleted/:id` | admin |
| PATCH | `/api/pledges/:id/assign` | admin |
| PUT/DELETE | `/api/pledges/:id/payment-setup` | how the sevak pays; audited |
| GET/POST | `/api/pledges/:id/followups` | |
| GET/POST | `/api/pledges/:id/payments` | |
| GET | `/api/notifications` | own |
| POST | `/api/notifications/:id/read`, `/api/notifications/read-all` | own |
| GET/POST | `/api/users`, PATCH `/api/users/:id` | admin |
| GET | `/api/reports/summary`, `/api/reports/collections?from=&to=`, `/api/reports/activity?from=&to=`, `/api/reports/payment-modes?from=&to=`, `/api/reports/pledges.csv` | admin |

### Cron
| GET | `/api/cron/daily` | Requires `Authorization: Bearer $CRON_SECRET`. Creates `followup.due` notifications for pledges whose `nextFollowUpAt` is today or earlier. |

## 7. Security

- **Passwords**: bcrypt cost 10; minimum 10 characters. Admins create staff with a temporary password and `mustChangePassword`.
- **Session cookie**: `httpOnly`, `Secure`, `SameSite=Lax`, 12-hour lifetime. The portal is served from `nityaseva.iskconjiasarai.com/portal/`, the same *site* as the API, so Lax cookies work while still blocking cross-site requests. (Vercel `*.vercel.app` previews are a different site, so signing in from a client preview won't work; use local dev for that.)
- **CORS**: only origins in `ALLOWED_ORIGINS`, with credentials.
- **Rate limits** stored in MongoDB so they hold across serverless instances.
- **Security headers** (`middleware/securityHeaders.ts`): Helmet's defaults, with `default-src 'none'` and no framing since the API never serves pages. JSON body limit 20 KB.
- **PII**: sevak phone numbers are only visible to logged-in staff. Follow-up devotees only see their assigned pledges.
- **Secrets** only in Vercel environment variables. Rotate the MongoDB password that was once committed to git history.

## 8. Scheduled work

Vercel Hobby allows one cron run per day: `30 3 * * *` UTC (9:00 IST) calls `/api/cron/daily`. Anything more frequent (e.g. reminders an hour before a callback) needs Vercel Pro or an external scheduler.

## 9. Migration from the current server

1. Deploy this branch to a **Vercel preview** with the same env vars plus the new ones (`JWT_SECRET`, `ALLOWED_ORIGINS`, `CRON_SECRET`).
2. Run `npm run db:indexes` and `npm run migrate` against production. The migration only reads `submissions` and is idempotent (`legacyId`), so it can be re-run.
3. Check `/api/stats` on the preview matches production.
4. Merge to `main`. Re-run `npm run migrate` once to pick up any submission that arrived in between.
5. `npm run create-admin` to create the first admin.

## 10. The public counter

`/api/stats` (`totalPledged`, `totalSewaks`, `target`) is decided in one place, `modules/counter/`:

```
shown = genuine pledges in progress − hidden ones + active manual adjustments   (never below 0)
```

| Control | Who | Effect |
| --- | --- | --- |
| **Mark as not genuine** (`flag`: spam, test, duplicate, other) | Anyone who can see the pledge | Left out of the counter, pledge lists (except the "Not genuine" tab), due reminders, dashboard numbers. No payments. Reversible. |
| **Hide from counter** (`hiddenFromCounter`) | Admin | A genuine pledge stays in follow-ups and reports but isn't counted publicly. |
| **Manual adjustment** (`counterAdjustments`) | Admin | Labelled `+/-` amount and sevak count, e.g. offline sevaks. Can be paused, edited or deleted. |
| **Monthly goal** (`settings.target`) | Admin | The "Raised of ₹…" figure the progress bar fills towards. ₹1,55,000 until set. |

Sevaks are counted once each across their counted pledges. Every flag, hide, adjustment and goal change is written to `auditLogs` with who did it. The admin **Counter** page shows the breakdown. `/api/stats` is cached for up to 60 seconds, so the site lags changes by about a minute.

API: `PUT/DELETE /api/pledges/:id/flag`, `PATCH /api/pledges/:id/counter`, `GET /api/counter`, `PUT /api/counter/target`, `POST/PATCH/DELETE /api/counter/adjustments[/:id]`. List filters: `?flagged=true`, `?hidden=true`.

## 11. Staff portal and end-to-end tests

The portal is a second page of the client app (`client/portal/index.html`, code in `client/src/portal/`), served at `/portal/` so none of it ships with the public page. It uses hash routes (`#/pledges/<id>`), so static hosting needs no rewrites, and calls this API with `credentials: "include"`.

`e2e/` drives the real client and server in Chrome against a throwaway local MongoDB: public pledge → admin assigns → devotee follows up and records a payment → reports and CSV → deactivation ends the session. It also runs the migration. `server/scripts/seed-e2e.ts` refuses to reset anything except a local `*_e2e` database.

## 12. Deliberately left out (for now)

- Email, SMS or WhatsApp notifications. `notifications.service.ts` is the single place to add a channel later.
- Payment gateway / autopay.
- Sevak self-service login.
