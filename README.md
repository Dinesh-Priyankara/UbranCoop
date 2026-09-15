# UrbanCoop Staff Portal

Local, mobile-first staff application. Plain JavaScript ES modules and CSS, a Cloudflare Pages Function, Supabase Auth, and Google Sheets business storage. No framework or runtime npm dependencies, no standalone ChatGPT Site, no duplicate business database.

## Current delivery status

The local application, server integration code, build, tests, and handoff documentation are included. **This is not yet a live production deployment.** Supabase, Google Apps Script/Sheets, and Cloudflare must be configured and tested against real services before staff use.

Open issue: after the initial browser checks, the user reported that **Preview Receipt is not working**. Investigation started but was interrupted; no fix has been verified. Reproduce and resolve this before release. The earlier verification results describe the tested scenarios, not resolution of this later report.

The project conversations **Design UrbanCoop Website** and **Build UrbanCoop Portal** were reviewed. Textual approvals were retrievable; the original approved mockup images were not. The cream/green UI follows those written rules. Exact mockup matching and the precise Today at a Glance contents remain unverified. Current glance fields (receipt count and submission status) are provisional, not newly locked product requirements. Place approved images in `design/` for final comparison. Nothing under `sources/` was modified.

## Run locally

Install a supported Node.js LTS release (22 or newer), then open this directory:

```sh
npm test
npm run build
cp .env.example .env
# Fill .env with the real server configuration described below.
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Open `http://127.0.0.1:4173`. The development server calls the same handler as Pages. Without configuration, login fails safely; it never silently switches to a demo.

There are no npm dependencies to install. A project-local Node runtime was downloaded into ignored `.tools/` for this build because Node was absent from PATH. It is a temporary development tool, not application source. On this computer you can substitute `& '.\.tools\node-v22.16.0-win-x64\node.exe' scripts/build.mjs` for `npm run build`, and use the same executable for `scripts/dev.mjs` or `--test tests/*.test.mjs`.

For isolated visual testing only:

```sh
npm run build
node tests/preview-server.mjs
```

Open `http://127.0.0.1:4174`. This explicitly labelled local test server accepts any nonempty test username/password and stores fictional records only in process memory. It binds to loopback. **Never deploy this test server.** It is excluded from `dist/` and the Pages Functions directory. Stop it when done. This is not evidence that live authentication or Google Sheets has been configured.

## 1. Supabase configuration

Use a dedicated Supabase project with email/password authentication. The browser shows only username and password. The server maps a lowercase username to `username@AUTH_EMAIL_DOMAIN` and signs in via Supabase Auth.

1. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `AUTH_EMAIL_DOMAIN` in local `.env` and Cloudflare Pages server environment variables. Choose a domain you control for the staff identities.
2. Disable public signup and anonymous sign-ins. No signup endpoint is exposed by the portal.
3. Admin-create each staff Auth user using the email convention above and a strong password. Confirm the email through the admin provisioning process.
4. Set **app_metadata** to include `{"staff": true}` through a trusted Supabase administrative tool. Do not put this permission in `user_metadata`; users can edit that field. No SQL tables or RLS policies are needed by this implementation because Supabase stores only Auth identities.
5. Configure appropriate password policy and Supabase auth limits. Set a Cloudflare rate-limit rule for `/api/portal` before launch, with a limit suitable for your staff, to protect login and backend quotas. All calls use POST, so allow normal staff activity when choosing limits.
6. To revoke portal access, remove the admin-controlled `staff` flag and revoke the user's sessions. The server calls Supabase's user endpoint on each request, rather than trusting browser state. Password resets and staff management remain an admin responsibility; no Settings module is added.

Access and refresh tokens are sent only as HttpOnly, SameSite=Strict cookies, Secure under HTTPS. Server requests use the Supabase publishable key; no service-role key is required at runtime. Authentication never relies on a client-editable role. Same-origin checks protect cookie-authenticated requests. The frontend serializes API calls to avoid refresh races within one page. Cross-tab session refresh behavior must also be checked during live acceptance testing.

## 2. Google Sheets configuration

The secure integration uses a Google Apps Script web app running as the workbook owner. This avoids distributing Google service-account credentials. Cloudflare sends HMAC-SHA256-signed requests to it. Unsigned requests are denied, and signed requests expire after two minutes.

1. Create a private Google spreadsheet owned by the appropriate UrbanCoop admin account. Staff should use the portal rather than have direct workbook edit access.
2. Create **one** Apps Script project for this workbook. Paste the generated `google-apps-script/Code.gs` into it and use `google-apps-script/appsscript.json` as its manifest. Enable the **Google Sheets API advanced service**. If using a standard Google Cloud project, enable the Sheets API there too.
3. In Apps Script Project Settings → Script Properties, set `SPREADSHEET_ID` and `SHARED_SECRET`. Use a cryptographically random secret of at least 32 characters. Supply that same secret as `SHEETS_SHARED_SECRET` to Cloudflare. Never put it in browser code or commit it.
4. Run `setup()` once as the owner and authorize the Sheets scope. This creates the three tabs and exact headers, sets the timezone, and freezes headers. Existing nonmatching headers fail rather than overwrite records.
5. Deploy as a **web app**, **execute as the owner**, with access permitting server-side calls (the `Anyone` deployment setting). The endpoint accepts only valid signed requests; the workbook itself remains private. Some Workspace organizations disallow this deployment setting; an admin must enable an approved integration path before launch.
6. Put the resulting `/exec` URL in `SHEETS_SCRIPT_URL` on Cloudflare and in `.env`.
7. After source changes, run `npm run build`, replace Apps Script with the newly generated Code.gs, and update its deployed version. Edit `server/sheets.gs` and `src/core.js`, not the generated file.

The `setup()` function is the workbook creation/setup mechanism; no live workbook has been created in your account during this task.

### Record structure

- **Receipts**: receipt ID, created date/time, staff ID/username, customer/contact, pets JSON, stay dates/nights, priced lines JSON, standard/final totals, pricing version, request ID/hash. Mixed pets have separate dog and cat priced lines. History uses these stored lines and totals; future rate changes do not alter past receipts.
- **Account Days**: one row per date with opening/in/out/expected totals, submitted flag/time, staff identity, request ID/hash.
- **Account Transactions**: one row per transaction with transaction ID, day ID, date, IN/OUT type, description, amount.

The exact headers are in `server/sheets.gs`. Apps Script writes explicit string/number/boolean cells; customer text starting with `=` is never interpreted as a spreadsheet formula. It uses one script lock across reads and writes, computes receipt sequences under the lock, rejects duplicate dates, and stores each account day and its transactions in one atomic Sheets batch. Request IDs make unchanged retries idempotent. Do not deploy two separate Apps Script projects against the same workbook, because their script locks would be independent. Never manually sort partial columns, change headers, delete rows, or write alongside the integration while it is processing records.

Sheets history currently scans the record tabs. This is appropriate for a small staff portal but needs quota/latency monitoring and eventual archival/indexing as records grow. Apps Script quotas and execution limits still apply. There is no offline submission queue. A save is only shown as successful after Sheets confirms it. After a network failure, retry the unchanged form; do not reload or edit until checking history if the outcome is uncertain.

## 3. Cloudflare Pages deployment

Use a standard Git-connected Pages project with this directory as repository root:

- Framework preset: None.
- Build command: `npm run build`.
- Build output directory: `dist`.
- Node version: a supported Node 22+ release, configured in the Pages build settings.
- Configure all server environment variables from `.env.example` for Production and separately for Preview if needed.
- Keep `functions/api/portal.js` at the repository root's `functions/` path. Pages builds it into `/api/portal` automatically. Uploading only static `dist` files through a static drag-and-drop deployment will omit the backend; use the Git integration or the Pages CLI that builds Functions.
- Attach your Namecheap-managed domain through Pages custom domains, and follow the DNS values Cloudflare supplies. No domain or deployment was changed in this task.

Static content security headers live in `public/_headers`. API responses separately set no-store and security headers. Only static UI source is copied into `dist`; `.env`, server code, tests, and Apps Script secrets are never copied. Inspect environment configuration carefully if adding frontend tooling later: no secret may receive a public/browser prefix.

## Architecture and development map

```text
src/app.js                 Screen state, mobile forms, navigation, history
src/components.js          Shared accessible buttons, icons, labels, dialogs
src/styles.css             Cream/green visual tokens and responsive styling
src/api.js                 Same-origin API client; no tokens in JS storage
src/core.js                Pricing, dates, accounts, validation (shared)
functions/api/portal.js    Supabase session checks, validation, signed Sheets calls
server/sheets.gs           Locking, idempotency, canonical record storage
google-apps-script/        Generated deployable Apps Script and manifest
scripts/build.mjs          Syntax checks and static/GAS build
scripts/dev.mjs            Local real-backend development server
tests/                     Unit, API, adapter tests and isolated UI test server
```

Drafts live in memory, not localStorage. Internal navigation and browser Back ask before discarding. Browser tab close/reload uses the browser's mandatory native wording; custom wording is not possible there. Mobile operating systems can kill tabs without firing beforeunload, so unsaved drafts are not guaranteed to survive an app kill. Account entry starts with six rows per tab, accepts partial batches, and ignores fully blank rows; partially filled rows fail validation.

## Verification and remaining release work

`npm test` covers rate boundaries, mixed pets, calendar dates/Colombo midnight, cash arithmetic, authorization, cookies, origin checks, server pricing, Google request signing, receipt sequence/retries, formula-safe text, canonical history, account atomic writes/locks, altered retries, and expired/unsigned requests. The Sheets adapter tests use a mocked spreadsheet and lock; they do not prove real Google deployment permissions or quota behavior.

Before live release:

1. Supply the Supabase project, publishable key, username domain, and admin-provisioned staff accounts.
2. Create/configure the workbook and Apps Script deployment, and set the shared secret in both server environments.
3. Deploy the Pages app and configure rate limits and the custom domain.
4. Verify real login/logout/session refresh, staff revocation, live receipt save/history, and live daily submission/history. Test two simultaneous staff submissions and a lost-response retry against the real workbook.
5. Compare all screens with the missing approved mockups, including the exact Home glance design. Confirm the provisional mixed-pet controls and numeric limits (25 pets per species in UI, 50 total in backend; 3,650-night stay; 200 transactions/day).
6. Verify actual Android Chrome and iPhone Safari behavior, date pickers, keyboards, screenshot legibility, browser back/refresh warnings, and focus behavior.

## Primary implementation references

- [Supabase password authentication](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Apps Script locks](https://developers.google.com/apps-script/reference/lock/lock-service)
- [Sheets atomic batch updates](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate)
