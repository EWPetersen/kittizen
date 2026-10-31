# Kittizen

Community shard intelligence for Star Citizen: report pirate/interdiction activity, verify sightings, and plan routes across Stanton, Pyro and Nyx.

The maintained implementation is in **[app/](app/README.md)**. The older Vite/React scaffold remains at the repository root for reference; the current app does not use that frontend build.

## Run locally

From the repository root in PowerShell:

```powershell
.\app\start.ps1
```

Open http://127.0.0.1:8077. Python is required; `start.ps1` also recognizes the bundled Codex runtime on this development computer. Local accounts and reports use an ignored SQLite database.

Generated navigation data, game textures and raw game files are excluded from this public source repository. Before running a fresh clone, follow [the game extraction setup](app/README.md) against your installed Star Citizen files to generate `app/public/catalog.json` and its textures. The local working copy and locally prepared deployment package already contain them. Creating a hosted upload package requires these generated files.

## Hosting and testing

- [Current features, limitations and Google sign-in setup](app/README.md)
- [Vercel + Supabase deployment instructions](app/deployment/README.md)
- [Verification notes](app/VERIFICATION.md)

Run `.\app\test.ps1` for the local suite. The complete suite's deployment-package check requires the generated textures. Hosted Postgres and Google sign-in are optional; neither is enabled by cloning this repository. Keep database credentials in environment settings, outside Git.

This is a community prototype and is not affiliated with Cloud Imperium Games or Roberts Space Industries.
