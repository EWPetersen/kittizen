# Verification record

**Current version:** 43 Python tests and 30 JavaScript tests pass for the expanded three-system implementation. See [README.md](README.md) for current coverage and checks. The record below documents the earlier 27-test first pass.

Current real-browser checks additionally confirmed: three separate universe discs; system selection at 390 × 844 without page overflow; gate double-click from Nyx to Pyro; terrain/pins moving under ordinary drag rotation; wheel zoom from 0.003 to 0.001 M km view; New Babbage → Lorville through actual departure/arrival POIs with a Hurston OM detour; and double-right-click resetting Pyro from 69.4 to its default 177.6 M km view while retaining the route. The live patch watcher reached `ready` against the installed archive. A 72-route common-location sweep completed without failures. Exact CIG OM numbering, live rotation phase and ship-specific quantum behavior remain approximations.

Verified on this Windows workspace on October 31, 2026. No existing prototype files or installed game files were modified. The local preview is on port 8077; automated HTTP tests use port 18077 and a temporary database.

## Automated checks: 27 passing

19 Python tests exercise actual HTTP requests / SQLite and the extraction pipeline:

- Anonymous read access and blocked anonymous mutations; registration, case-insensitive handles, duplicate handles, invalid passwords, login and logout.
- Normalized shard isolation, invalid shard input and text containing HTML retained as text.
- Own-report verification blocked; one vote per report; independent account counts; repeated-verifier deduplication across reports; dispute and age reduce reputation.
- Two-hour report expiry hides reports and blocks new votes.
- Server-side 3D jump interpolation at 0%, 12.3% and 100%; out-of-range, NaN, infinity, string and boolean fractions rejected.
- Saved routes, recall data, deletion ownership and identical endpoints rejected.
- Malformed bodies, unhashable IDs, cross-origin writes, oversized bodies, missing endpoints and static directory traversal.
- Quaternion rotation and relative child distances; unique catalogue entries and numeric metre coordinates.
- Four simultaneous votes from one account produce one recorded vote.
- Database and signed-in session survive server restart; expired sessions become anonymous.
- Three-report-per-minute limit; notes and shard length bounds; 50-route library bound; report response limited to newest 200.
- Targeted nested XML extraction without unpacking unrelated files; missing containers, missing XML and unsupported binary XML fail explicitly.
- Invalid catalogue input leaves the previous output unchanged; deterministic catalogue generation; manifest changes alter the update fingerprint.

8 Node tests cover the actual map module using a mocked canvas:

- Device pixel ratio cap, coalesced draws and no idle animation loop.
- Metre-scale position differences retained around a far-away camera origin.
- Minimum/maximum zoom bounds; location hit testing and focus.
- Fitting a route and tapping its midpoint yields 50% placement.
- Pan does not accidentally select; two-pointer pinch zoom; pointer cancellation; orbit pitch limits.
- Selected objects and report markers render without errors.

The development formatters (Black / jsbeautifier) are ignored under `.devtools/` and are not app dependencies. Source syntax was checked with Node as well as through browser loading.

## Real local-game extraction

- Opened the installed LIVE P4K read-only; inspected its 1,379,308-entry index.
- Extracted the nested system XML, build 12157308; generated 58 catalogue locations.
- Ran again and verified the unchanged-game fast path.
- Catalogue size: 11,707 bytes. Earlier retained build 9605532 remains untouched in the original project folders.

## Browser workflows checked

- Initial load, empty-shard guidance and mobile panel navigation.
- Entered `QA-SHARD`, searched for `microtech`, selected/focused microTech, plotted Crusader → Hurston.
- Signed-out report action opened the sign-in form.
- Created disposable local `qa_pilot` and `qa_verifier` test accounts through the UI.
- Published a report at 123,456.789 km from departure; checked it appeared on that shard and the author's vote controls were disabled.
- Filtered to Pirates and saw the empty state; restored All activity.
- Saved the jump, reset the active route, recalled the saved jump and checked endpoints/distance.
- Confirmed from the other account; card changed to 1 confirmed, last confirmation just now, 1 independent verifier and 20% author trust. Vote controls disabled after recording.
- Opened the trust explanation.
- Inspected the full desktop interface and 390 × 844 phone viewport. At 390 px, page scroll width equals viewport width and the map stays above the 62 px bottom navigation.
- No browser console warnings/errors during those workflows.
- Checked 320 px navigation with no horizontal overflow, distance validation and switching from an invalid jump distance back to a mapped location. Published a second QA report and verified through the HTTP API that its stored fraction reconstructs exactly 123,456.789 km from departure (within 0.000001 km).
- Ran the actual `start.ps1` entry point: unchanged-game detection and service startup both succeeded. `preview.jpg` shows the final desktop result with explicitly labelled QA activity.

QA accounts/report are visibly marked as test data on `QA-SHARD`; they are not real community activity. They remain only in this local preview's database. Reports expire automatically.

## What these checks do not establish

No finite test suite proves all possible behavior. This has not been tested on physical phones, with thousands of concurrent users, behind a public HTTPS deployment, against future P4K format changes, or visually compared frame-for-frame with a running current mobiGlas. The renderer is a schematic companion; the README lists missing map content and routing limitations. Local accounts prevent casual duplicate votes but do not prove distinct human identities.





Hosting preparation: the core HTTP suite also passed on isolated PostgreSQL 17.9; the Vercel handler passed two-account report/profile/Google-linking checks with mocked Google token verification and persistence across fresh handler instances. Actual Vercel + Supabase deployment checks are pending account setup. See deployment/README.md.
