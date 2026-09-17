# UrbanCoop Staff Portal

Local, mobile-first staff application. Plain JavaScript ES modules and CSS, a Cloudflare Pages Function, Supabase Auth, and Google Sheets business storage. No framework or runtime npm dependencies, no standalone ChatGPT Site, no duplicate business database.

## Current delivery status

Supabase provisioning update: the dedicated **UrbanCoop** project has now been created and its URL/publishable key saved in local ignored configuration. See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for the verified status, username-only alias scheme, and remaining dashboard/staff-account setup. Business records remain in Google Sheets.

The local application, server integration code, build, tests, and handoff documentation are included. The private Google Sheets connection has passed one live local save/read-back test. **This is not yet a live production deployment.** Supabase staff authentication and Cloudflare still need production configuration and acceptance testing.

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

Open `http://127.0.0.1:4174`. By default, this explicitly labelled local test server accepts any nonempty test username/password and stores fictional records only in process memory. With complete private Google credentials and `LIVE_SHEETS_TEST=1`, it labels itself as live and sends record actions to the dedicated workbook. It still bypasses Supabase authentication. It binds to loopback and is excluded from `dist/` and Pages Functions. **Never deploy this test server.**

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

The secure integration calls the Google Sheets API from server-side code with a dedicated service account. The private key stays in ignored local files or Cloudflare encrypted secrets and is never sent to browser code. The service account should have Editor access only to the UrbanCoop workbook.

1. Create a private Google spreadsheet owned by the appropriate UrbanCoop admin account. Staff should use the portal rather than have direct workbook edit access.
2. Create a Google Cloud service account in a project with the Google Sheets API enabled. Do not grant it project IAM roles.
3. Share only the target workbook with the service-account email as Editor.
4. Store `GOOGLE_SHEET_ID`, the three numeric tab IDs, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` as server-side secrets. Never put them in browser code or commit them.
5. Add the same values to Cloudflare before production deployment. Keep `LIVE_SHEETS_TEST` unset in Cloudflare.

The legacy Apps Script source remains in the repository for historical reference and is not part of the active runtime path.

### Record structure

- **Receipts**: receipt ID, created date/time, staff ID/username, customer/contact, pets JSON, stay dates/nights, priced lines JSON, standard/final totals, pricing version, request ID/hash. Mixed pets have separate dog and cat priced lines. History uses these stored lines and totals; future rate changes do not alter past receipts.
- **Account Days**: one row per date with opening/in/out/expected totals, submitted flag/time, staff identity, request ID/hash.
- **Account Transactions**: one row per transaction with transaction ID, day ID, date, IN/OUT type, description, amount.

The exact headers are enforced by `functions/api/google-sheets.js`. The integration writes explicit string/number/boolean cells, so customer text starting with `=` is never interpreted as a spreadsheet formula. Account days and their transactions are appended in one Sheets batch, and request IDs make unchanged retries idempotent. The current mutation queue serializes writes inside one server instance; distributed concurrent writes must be tested and coordinated before multi-instance production use. Never manually sort partial columns, change headers, delete rows, or write alongside the integration while it is processing records.

Sheets history currently scans the record tabs. This is appropriate for a small staff portal but needs quota/latency monitoring and eventual archival/indexing as records grow. Sheets API quotas still apply. There is no offline submission queue. A save is only shown as successful after Sheets confirms it. After a network failure, retry the unchanged form; do not reload or edit until checking history if the outcome is uncertain.

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
functions/api/portal.js    Supabase session checks and request validation
functions/api/google-sheets.js  Private Sheets API storage adapter
server/sheets.gs           Legacy Apps Script adapter source
google-apps-script/        Generated legacy Apps Script and manifest
scripts/build.mjs          Syntax checks and static/GAS build
scripts/dev.mjs            Local real-backend development server
tests/                     Unit, API, adapter tests and isolated UI test server
```

Drafts live in memory, not localStorage. Internal navigation and browser Back ask before discarding. Browser tab close/reload uses the browser's mandatory native wording; custom wording is not possible there. Mobile operating systems can kill tabs without firing beforeunload, so unsaved drafts are not guaranteed to survive an app kill. Account entry starts with six rows per tab, accepts partial batches, and ignores fully blank rows; partially filled rows fail validation.

## Verification and remaining release work

`npm test` covers rate boundaries, mixed pets, calendar dates/Colombo midnight, cash arithmetic, authorization, cookies, origin checks, server pricing, private Sheets API appends, receipt sequence/retries, formula-safe text, canonical history, account atomic writes/locks, and altered retries. Automated Sheets requests are mocked; the separate live test verifies one real website save and read-back, but not concurrent or quota behavior.

Before live release:

1. Supply the Supabase project, publishable key, username domain, and admin-provisioned staff accounts.
2. Add the verified Google service-account values to Cloudflare encrypted secrets.
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
