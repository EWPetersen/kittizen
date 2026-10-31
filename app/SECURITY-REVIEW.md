# Google sign-in privacy review — 2026-10-31

Scope: application source, Google identity flow, SQLite regression tests, deployment packaging, and unauthenticated production HTTP probes. This is a focused review, not a penetration-test certification or a review of provider infrastructure/backups/logging configuration.

## Findings

- Google ID tokens can contain real names, email addresses, and photo URLs. The browser passes the credential once in an HTTPS JSON POST to `/api/google`; it is not put in URLs, local/session storage, application logs, profiles, or report data.
- The official Google verification library validates the token for the configured client. The app additionally checks a cookie-bound, expiring, single-use nonce. Only the validated `sub` is retained in the private `identities` table. Names, emails, photos, and signed credentials are discarded. The subject is a pseudonymous identifier and must still be protected as account data.
- Google-created accounts receive random `Pilot_…` handles. The app never derives a handle from a Google name or email. Users can voluntarily disclose identity in handles or report text; authentication cannot prevent that.
- `/api/me` selects only the internal account ID and handle. Public profiles expose game statistics, a handle, and creation time. Detailed report history and the Google-linked flag are restricted to the owner. Google subjects and session credentials are never returned.
- Sessions use random tokens, SHA-256 token storage, HttpOnly/SameSite=Strict cookies, and Secure cookies in the hosted configuration. API responses use `Cache-Control: no-store`. Google verification failures are replaced with generic errors. Request logging in the application handler is disabled.
- User text is rendered with DOM text nodes rather than HTML. A restrictive CSP limits scripts to this app and Google's sign-in client. Production source/config/database probes returned 404; public API probes returned no Google identity fields and used no-store caching.
- The deployment package uses a file allowlist and excludes local databases, test accounts, credentials, and source-only artifacts from public assets.

## Changes and validation

Added explicit type/length checks on the only retained Google claim, and regression tests using fake email/name/photo/token markers. Tests exercise the real verifier boundary with mocked Google verification, then inspect the database dump and owner/anonymous API responses. A separate test verifies that token-library exceptions cannot echo credentials or email addresses. Existing tests cover nonce mismatch/replay, invalid tokens, linking conflicts, private history, and unauthenticated profile updates.

No existing email/name leak was identified in the reviewed paths. This does not guarantee zero risk: a compromised browser, malicious authorized script, server administrator, or hosting provider can observe transient sign-in tokens. Do not enable request-body logging or analytics capture of authentication payloads. Keep Google auth dependencies current and retain the CSP and private database access controls.
