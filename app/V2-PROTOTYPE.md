# Kittizen V2

Open `/v2.html`. V1 remains at `/`. V2's intelligence navigation opens the full-screen map, with a workspace return link in its header. This preserves the map's full phone viewport and original anti-framing policy.

V2 adds an extracted catalogue, reference pages, up to four-way comparison, stock equipment inspection and size/type candidate swaps, saved configurations, a private hangar, per-currency recorded cost/melt tracking, manual offer comparisons, and JSON backup import/export. Guests save on their browser; signed-in pilots save in a private database workspace. Guest data is not silently uploaded when signing in. Browser and cloud workspaces are separate; export/import is the explicit transfer path. Cloud saves replace the pilot's workspace; simultaneous editing on multiple devices is last-save-wins in this prototype.

The public catalogue includes localized record variants, not a verified list of obtainable/flyable items. It does not include user identity, ownership, purchase history, or cash store prices. Workshop candidate matching uses stock type and size, not full port/resource-network validation. There is no sustained DPS/power/heat simulation, live store ingestion, or CCU-chain optimizer in V2. Unknown fields remain unknown. All game-derived assets remain excluded from public Git source.

## Extraction

Run `scripts/setup_v2_extractor.ps1` once. It downloads the official StarBreaker v0.3.2 CLI and verifies the GitHub release SHA-256. See https://github.com/diogotr7/StarBreaker (MIT). Run `python scripts/build_v2_catalog.py --force` with the same Python/extractor environment used by the existing map pipeline. The CLI reads the installed `Data.p4k`, exports DataCore records, and converts targeted vehicle XML and game UI images. The normal patch-update command also refreshes V2 when its catalogue is enabled.

The normalizer writes a versioned index, 256 possible detail bundles, and compressed WebP thumbnails under `public/game-assets/v2/`. It publishes `public/v2-catalog.json` only after validation. Source record paths and build timestamps are retained on each reference page. The browser loads summaries once, renders 24 catalogue cards per page, and lazy-loads detail bundles and images.

## V3 direction (requested separately)

Make Kittizen a collection of independent first-class tools, with PvP intelligence as one feature. Aim to improve the workflows served by Erkul, SPViewer, and CCU Game without copying their interface. Planned work includes validated weapon/ship performance calculations, actual port/tag/resource compatibility, power/cooling/capacitor simulation, robust trade and route economics, live official store data with provenance, constraint-aware CCU-chain optimization, and richer fleet planning. These are a distinct V3 scope, not silently labeled as completed in V2.
