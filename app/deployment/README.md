# Vercel + Supabase beta

The local app still uses SQLite. Hosting uses the same Python handler with a small Postgres adapter, a private `kittizen` schema and Supabase's transaction pooler. This is a separate beta database; no local accounts, reports, sessions or passwords are uploaded.

## 1. Prepare the upload

From `C:\kittizen`, run:

```powershell
python app/scripts/prepare_deploy.py
```

Use the same Python executable as `app/start.ps1` if `python` is unavailable. This builds `app/deploy/` from an explicit allowlist. It includes the three systems, current catalogue and referenced textures. It excludes all SQLite files, raw game archives, extracted audits, tests and development dependencies. A hash manifest and build check detect missing or changed files. Re-run this command after code changes or a successful game extraction; edit source files, not the generated deploy folder.

## 2. Create a Supabase project for beta testing

Create a **new** project, save the database password in your password manager, and select a region near your testers. In **SQL Editor**, execute the contents of `app/deployment/schema.sql`. It is additive and repeatable, and uses a transaction when run through the initializer below. It creates only the private `kittizen` schema. Keep that schema out of the project's exposed Data API schemas. Tables have RLS enabled, no browser policies, and no PUBLIC table access. The server accesses them through the database owner's connection; do not put that connection string in browser code.

Alternatively initialize from this computer using `python app/scripts/init_postgres.py` after installing `app/deployment/requirements.txt` and setting `KITTIZEN_DATABASE_URL` privately. The initializer uses a transaction and an advisory lock and never copies the local SQLite database. Its errors do not print the connection string.

From the project's **Connect** panel, obtain the **Transaction pooler** Postgres URI (normally port 6543). Use the exact host and project-qualified username from the panel. Replace the password placeholder with a URL-encoded password and use `sslmode=require`. Do not use the anon API key or service-role API key as a database URI. The adapter disables prepared statements for transaction-pooler compatibility and closes connections per request.

## 3. Create a Vercel project

Deploy the contents of `app/deploy/` as the **project root**, using either the Vercel CLI from that folder or a dedicated Git repository containing those generated files. Do not upload `C:\kittizen` or the original `app/` directory. The package already has `vercel.json`, Python requirements and the serverless entry point; choose **Other** if asked for a framework and leave its supplied build/output settings intact.

Before deploying, set these in Vercel's project environment settings:

| Name | Value |
|---|---|
| `KITTIZEN_DATABASE_URL` | Private Supabase transaction-pooler URI |
| `KITTIZEN_SECURE_COOKIE` | `1` |
| `KITTIZEN_GAME_WATCH` | `0` |
| `KITTIZEN_GOOGLE_CLIENT_ID` | Optional Google Web client ID, after setup |

Do not set `KITTIZEN_PG_TEST` on Vercel. Set secrets in the dashboard, not `vercel.json`, Git, or chat. Use the beta database for the environments you intentionally enable. Future production deployments should use their own database; don't let arbitrary preview branches share production credentials.

The build runs `verify_deploy.py`. Static files come from `public/`; `/api/*` rewrites to one Python function. The game archive watcher does not run in hosted mode. Missing database configuration fails with a generic 503 instead of silently creating a temporary SQLite database.

## 4. Verify the actual deployment before inviting testers

1. Load the Vercel HTTPS address; check Universe, Stanton, Pyro and Nyx, textures, mobile layout, rotation, panning and routing.
2. Create two test pilots. Join the same region + three-digit shard. Publish from one and confirm/dispute from the other. Check that own and duplicate votes are blocked, stats refresh and other shards remain isolated.
3. Save a jump, sign out/in and check its ownership. Check public versus owner-only profile history.
4. Redeploy the identical package. Confirm that accounts, reports, votes and saved jumps still exist and sessions remain valid.
5. For Google login, configure the final HTTPS origin as an authorized JavaScript origin, set its client ID, redeploy, and test both a new Google pilot and linking an existing local account. The localhost tests mock Google responses; they do not prove the live Google popup works.
6. Keep deployment protection enabled until these checks pass. Share the resulting URL with your invited testers using Vercel's available access controls.

Google setup is described in `app/README.md`. A `vercel.app` address works for the beta; a purchased domain is optional. Free-tier quotas and inactivity pausing still apply.

## Verification completed locally

- The normal SQLite and JavaScript suite passes with deployment tests added.
- The core account/report/reputation/route/persistence HTTP suite passed on isolated PostgreSQL 17.9.
- `scripts/test_hosted.py` passed through the Vercel handler against real local Postgres: two pilots, confirmation, own/duplicate vote rejection, profile privacy, case-insensitive handle collisions, mocked Google linking and nonce replay, and persistence after replacing the handler instance.
- The generated upload was checked for completeness and absence of local data.

The beta is deployed at https://kittizen-sand.vercel.app using the Vercel `kittizen` project and Supabase `kittizen-beta`. The schema is initialized with RLS enabled. Live HTTPS tests passed on 2026-10-31: two pilots, reporting, own/duplicate vote rejection, confirmation and profile stats, shard isolation, profile privacy, saved-route ownership, POI routing, invalid input and logout. A fresh deployment preserved the data and an existing session. The mobile navigation/system selection was checked at 390 x 844. Google SSO remains unconfigured and was not tested live.

The connected GitHub repository contains source only; generated game data stays outside the public repository. Publish the prepared package with the CLI. Git-triggered builds are set to **Don't build anything** because the repository root contains the older prototype. CLI publishing remains enabled and tested. The production alias is publicly reachable; unique preview/deployment URLs retain Vercel's existing protection.

To repeat the beta smoke test, run `python app/scripts/test_live_beta.py --base https://kittizen-sand.vercel.app`. This creates two QA accounts and one clearly marked report on US-999 that expires after two hours. It deletes nothing. Test credentials stay in ignored `.host-tests/`. Run again with `--resume` after redeploying to check existing data and sessions.

For repeatable database testing, use a fresh disposable Postgres database, apply `schema.sql`, set `KITTIZEN_DATABASE_URL` and `KITTIZEN_TEST_POSTGRES` to that same database URI, install the optional Postgres driver, then run:

```powershell
python -m unittest discover -s app/tests -p test_app.py -v
python app/scripts/test_hosted.py
```

Only for a local loopback cluster without TLS, set `KITTIZEN_PG_TEST=1`. Test scripts create test accounts/reports; they are not for a production database. They never delete existing rows.

## Updates and rollback

Keep using the local extraction watcher after game patches. Once the catalogue updates successfully, regenerate `app/deploy/` and redeploy it. Local extraction audit data and `Data.p4k` stay on this PC.

For a code rollback, redeploy a previous verified package against the same beta database. The first schema is additive. The SQLite version at port 8077 remains a separate fallback. Do not restore an old database just to roll back application code. Before any future schema migration, take a database backup and verify forward/backward compatibility.

References: [Vercel Python handlers](https://vercel.com/docs/functions/runtimes/python/api-directory), [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [Supabase connections and poolers](https://supabase.com/docs/guides/database/connecting-to-postgres).
