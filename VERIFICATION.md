# Local verification — 15 September 2026

## Automated checks

35 automated tests passed on Node.js 22.16.0. Source modules passed syntax checks and the build produced the static `dist/` application and generated Apps Script source.

- 16 single-/multi-pet rate-boundary cases, including all user-requested tiers.
- Mixed-species calculation, forged client totals, invalid pets/customer details.
- Calendar night arithmetic, leap years, invalid dates, Colombo midnight.
- Exact cash arithmetic, invalid amounts, partially completed transactions and future account dates.
- Same-origin enforcement, unauthenticated access, admin-controlled staff claim, HttpOnly/Secure cookies and sanitized errors.
- Server-calculated receipt totals and signed Sheets requests.
- Sequential receipt IDs, unchanged request retries and changed-payload rejection.
- Formula-safe sheet strings, saved-price history reconstruction.
- Atomic account day/transaction batches and duplicate-day lock rejection.
- Expired and unsigned Google adapter requests denied.

Google Apps Script services and Supabase HTTP responses are mocked in these tests. A real concurrent staff race was not exercised against Google Sheets; actual concurrency and quota behavior remain release acceptance checks.

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
- Live Google workbook, permissions, Apps Script deployment, shared secret and concurrent submissions.
- Cloudflare production deployment or custom domain.
- Physical iPhone/Safari and Android browser testing.

See README.md for setup and release acceptance steps. Local build/test success must not be described as proof of a fully configured production service.
