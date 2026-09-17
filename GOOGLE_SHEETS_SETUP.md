# Google Sheets connection status

Updated 2026-09-17. The portal now uses a private server-to-Google-Sheets service account. The publicly reachable Apps Script endpoint remains undeployed. A purchased domain is not required for local testing.

## Active dedicated-account setup

- Owner: `dineshformobile@gmail.com`.
- Private workbook: https://docs.google.com/spreadsheets/d/195SJWEOY0GRcqZFaajW_A7bmQt0rex220GvhieXb1EY/edit
- Folder: ChatGPT (`19cZup3SiI6HODh1jQSWIGVa1gIyKZG-3`).
- Tabs and exact headers: Receipts, Account Days, Account Transactions.
- Google Cloud project: `urbancoop-sheets-connector`.
- Google Sheets API: enabled.
- Service account: `urbancoop-sheets-writer@urbancoop-sheets-connector.iam.gserviceaccount.com`.
- Workbook access: the dedicated account is Owner; the service account is Editor; the primary account is not shared.
- The JSON key and parsed environment variables are in ignored local files. The extra Downloads copy was removed.
- Cloudflare production secrets and deployment remain pending.

## Live website-to-Sheets test

The local preview was intentionally started with `LIVE_SHEETS_TEST=1` on 2026-09-17. Saving from the website created receipt `UC-20260917-001`.

- Customer: `LIVE TEST - CODEX 2026-09-17`
- Pet: `Sheets Sync Test`
- Stay: 2026-09-17 to 2026-09-18
- Total: Rs. 3,000
- Read-back: verified through the private Sheets API.
- Visual check: verified in `Receipts!A2:Q2` in Google Sheets.

This proves the website save path reaches the live workbook. The local preview login bypasses Supabase, so production authentication is a separate acceptance check.

## Security and production notes

- The service account has no Google Cloud project role; workbook sharing grants access only to the UrbanCoop spreadsheet.
- Never commit `.env`, `.tools/urbancoop-service-account.json`, or the private key.
- Keep `LIVE_SHEETS_TEST` unset in Cloudflare.
- The current in-process mutation queue serializes one server instance. Add distributed coordination and run concurrent-write acceptance tests before multi-instance staff use.
- Rotate the service-account key if it is exposed or copied outside approved secret storage.

## Historical Apps Script setup

The dedicated Apps Script project is retained as historical work only and must not be deployed: https://script.google.com/home/projects/1AXNdqIjOq72tdO9AoaOhGUXfAiUpAIaaiv8PfTdadqhq1S85_WviKrt_/edit

The old primary-account setup was never deployed. Cleanup remains pending:

- Primary account: `dinash.priyankara97@gmail.com`.
- Old workbook: `1dQgK3pehoyFRw9fpxwCRe71t5osSjwFqv0XduDBRCGA`.
- Old configured script: `1DZUmE6jTJbqxuIgqYXWYVlgqV1u6RgOigGwcHpBVJBCgId1FfKNJ557o`.
- Old unused blank bound script: `1rARbS4GPEqz3bpOeEciyuRxQ-xHXMPiVKdRuFJwJLefELJoYZ5553vZH`.

Revoke only the old UrbanCoop authorization and remove only these verified old files. Do not change unrelated authorizations or Drive content.
