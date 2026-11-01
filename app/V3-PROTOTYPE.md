# Kittizen V3 — first working slice

Open `/v3.html`. V2 and the activity map remain available. V3 reuses V2's catalogue, authentication, private hangar, saved configurations and comparison code; it lazy-loads its extra tool module and a versioned performance dataset. No second account system or duplicate backend was introduced.

Working additions:

- A toolkit home with independent entry points for performance, fitting, upgrades, trade, hangar, and activity intelligence.
- Performance metrics derived from installed DataCore flight controllers, shield generators, supported weapon sequences and ammunition records. Source paths are attached to every metric. V3's four-way comparison includes these values.
- Explicit calculation coverage: supported stock gun mounts versus total resolved stock gun mounts. Unsupported spinning, burst, beam, or complex firing patterns are not guessed. Current supported weapon DPS is unmodified theoretical burst output, not sustained damage.
- A shortest-path upgrade quote planner with same-currency filtering, a spending ceiling, fresh-cash filtering, zero-price owned upgrades and cycle handling. Quotes are entered by the user and saved on this browser, not imported from RSI or claimed to be current store offers. Currency conversion and automatic eligibility validation are not provided.
- A trade-margin calculator including cargo quantity, purchase capital, sale revenue, expenses, round-trip time, hourly return and negative-profit outcomes. Prices and trip duration are manual assumptions, not live market values.

`scripts/build_v3_data.py` consumes the same game exports used by V2. The normal V2 patch pipeline refreshes V3 when V3 is enabled. V3's release pointer retains the exact matching catalogue asset base, so a newer V2 catalogue does not silently change an older V3 calculation dataset.

Next increments: validate more firing patterns and port/tag/resource constraints; calculate custom loadout performance; model capacitor/power/heat behavior; integrate independently sourced, timestamped store offers and commodity prices. Cash store data, user ownership and personal purchase values cannot be recovered from the installed game archive. Existing private cloud workspace saves are last-save-wins; upgrade quotes remain local to a device in this first slice.
