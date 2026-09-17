# Local verification — 15 September 2026

## Automated checks

35 automated tests passed on Node.js 22.16.0. Source modules passed syntax checks and the build produced the static `dist/` application and generated legacy Apps Script source.

- 16 single-/multi-pet rate-boundary cases, including all user-requested tiers.
- Mixed-species calculation, forged client totals, invalid pets/customer details.
- Calendar night arithmetic, leap years, invalid dates, Colombo midnight.
- Exact cash arithmetic, invalid amounts, partially completed transactions and future account dates.
- Same-origin enforcement, unauthenticated access, admin-controlled staff claim, HttpOnly/Secure cookies and sanitized errors.
- Server-calculated receipt totals and private Sheets API appends.
- Sequential receipt IDs, unchanged request retries and changed-payload rejection.
- Formula-safe sheet strings, saved-price history reconstruction.
- Atomic account day/transaction batches and duplicate-day lock rejection.
- Expired and unsigned Google adapter requests denied.

Google Sheets API and Supabase HTTP responses are mocked in automated tests. A real concurrent staff race was not exercised against Google Sheets; actual concurrency and quota behavior remain release acceptance checks.

## Interactive browser checks

Used the real built frontend against the explicitly labelled, isolated, in-memory UI test server. These checks created no actual business records.

- Login and Home render; Today at a Glance starts empty and updates after test saves.
- At 390px phone width, created a booking for one dog (Milo) and two cats (Luna/Bella), four nights. Pet name fields appeared dynamically. Preview showed Rs. 10,000 dog charge + Rs. 14,800 cat charge = Rs. 24,800.
- Navigating Home from an unsaved preview opened **Discard unsaved changes?** with **Stay / Discard**. Stay preserved the receipt.
- Save & Finish showed saved ID `UC-20260915-001`; date history listed the pets, customer, ID and total.
- Accounts showed six initial rows. Switching to Cash Out preserved Cash In. Opening Rs. 5,000 + Cash In Rs. 15,000 − Cash Out Rs. 4,500 showed Rs. 15,500.
- Save Day Record displayed the required confirmation. Yes, Submit opened Accounts History with both transaction lists and a read-only Submitted record.
- Re-entering Daily Accounts fetched and locked the submitted date. Selecting the previous date opened an editable form.
- Narrow 320px accounts layout showed no horizontal overflow.
- Desktop Home was checked at 1280px. Profile displayed the username and Logout returned to Login. Account draft discard confirmation also worked.

## Not verified / not provisioned

- Original mockup image fidelity and exact Today at a Glance content.
- Live Supabase credentials, staff provisioning, session refresh/revocation and Cloudflare auth rate limits.
- Cloudflare production secrets/deployment and concurrent submissions.
- Cloudflare production deployment or custom domain.
- Physical iPhone/Safari and Android browser testing.

See README.md for setup and release acceptance steps. Local build/test success must not be described as proof of a fully configured production service.

## Local browser retest — 17 September 2026

Build and all 35 automated tests passed. Browser checks used the isolated loopback test server on port 4174 with fictional in-memory data, not production authentication or Google Sheets.

- Valid receipt preview: Local Test Customer, Test Milo, one dog, 17–21 September, four nights at Rs. 2,500 = Rs. 10,000.
- Save & Finish returned UC-20260917-001 and Receipt saved. Receipt History displayed the same ID and amount.
- Accounts: opening 1,000, cash in 10,000, cash out 250, expected cash 10,750. Confirmation, saved history, and submitted read-only state verified.
- Earlier receipt-preview failure was not reproduced with these inputs. No code fix is claimed; the original failing scenario remains unknown.
- Preview restarted during session recovery; fictional records reset with that process. Test records are not persistent business records.
- Live Supabase login and Cloudflare deployment remain unverified. These checks do not establish production readiness.

## Live Google Sheets integration test — 17 September 2026

The private service-account integration was tested through the local website. The local server displayed its live-test banner, and **Save & Finish** returned `UC-20260917-001`.

- The private Sheets API read-back found the same ID, customer `LIVE TEST - CODEX 2026-09-17`, pet `Sheets Sync Test`, created date `2026-09-17`, and total `3000`.
- Google Sheets visually showed the new record in `Receipts!A2:Q2` with the expected test identity and values.
- The workbook remains private. Its owner is `dineshformobile@gmail.com`, and only the dedicated service account was added as Editor.
- The downloaded key copy was removed after it was stored in ignored local configuration.

This verifies the website-to-Sheets save path. The local preview login bypasses Supabase, so production login/session behavior remains unverified.
