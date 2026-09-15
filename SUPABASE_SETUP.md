# UrbanCoop Supabase setup

## Confirmed scope

Supabase handles staff username/password login only. Google Sheets remains the sole receipt and accounts business-record store. No application database tables or receipt copies should be created in Supabase.

## Provisioned on 15 September 2026

- Project: UrbanCoop
- Organization: Dinesh-Priyankara's Org
- Project reference: `ufdegmgaagxtswczdyyf`
- Region: Mumbai (`ap-south-1`)
- Project creation cost reported by Supabase: $0/month at creation. Future plan changes and usage remain subject to Supabase billing.
- Dashboard: https://supabase.com/dashboard/project/ufdegmgaagxtswczdyyf
- API URL: https://ufdegmgaagxtswczdyyf.supabase.co
- Status verified: ACTIVE_HEALTHY.
- Initial security advisors: no findings.
- Live `/auth/v1/settings` read using the publishable key: succeeded.
- Local ignored `.env` contains the actual project URL and enabled publishable key. No service-role key is needed by the app.

## Username-only sign-in

The requested initial username is `deshan`. The user does not want email login fields, emails, verification links or magic links.

Supabase password authentication requires an email- or phone-format identity internally. The app therefore maps the username to a non-deliverable internal alias, `deshan@urbancoopit.invalid`, using `AUTH_EMAIL_DOMAIN=urbancoopit.invalid`. This is not a mailbox and must never be used for invitations, recovery emails or email OTP. Staff see only username and password. Password resets must be performed by an admin until a separate recovery workflow is explicitly requested.

For this deployment, the internal alias namespace supersedes the generic README suggestion to choose a real domain. Do not globally enable auto-confirmed public signup just to support aliases: keep public signup disabled and admin-confirm each provisioned staff identity instead.

## Still pending

1. User completes Supabase dashboard sign-in. Browser approval blocked inspection of the separate Google account sign-in surface; no Google account actions were performed.
2. Disable **Allow new users to sign up**. Last verified value: public signup enabled. Anonymous sign-in was disabled.
3. Admin-create `deshan@urbancoopit.invalid` with a password chosen privately by the user and mark the identity email as confirmed. Do not send an invitation email. Last database check: zero Auth users.
4. Set this user's admin-controlled `app_metadata.staff` to `true`, preserving other metadata. Never use `user_metadata` for permission. The portal rejects users without this flag.
5. Verify real username/password login, session refresh, logout and denied access for non-staff.
6. Add the same Supabase variables to Cloudflare server environment settings when deploying. Google Sheets endpoint/shared secret remain unconfigured.

No successful end-to-end staff login is claimed yet. Do not enter credentials in tracked source or chat. No business-record schema migration is necessary for this confirmed architecture.
