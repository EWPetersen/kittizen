# Four-build workspace — first implementation

Open `/v3.html#catalog`. V3's ship database and workshop now share a four-draft Compare/Fit/Acquire workspace. V2 remains available.

Implemented: independent local drafts scoped to the current pilot/browser; same-hull duplication; clearing and one-step undo; grouped baseline comparison with deltas; selected-component shield/weapon aggregates with explicit modeled-mount coverage; selected quantum-drive statistics; searchable candidate replacement previews; save-to-existing private configuration storage; deduplicated changed-equipment quantities across drafts; phone-width tabs and contained comparison scrolling. Item reference remains separately available, including global search.

Player-facing catalogue browsing now filters common uninitialized/placeholder display names, hides oversized ship-size badges, and uses readable vehicle labels. Raw records remain in generated data for audit.

Not complete: the acquisition checklist does not yet identify verified shops, missions or loot locations; it explicitly displays unverified sources. Candidate fitting still checks stock type/size rather than full port/tag/resource compatibility. Performance is a supported, possibly partial base model, not full sustained/power/heat/armor simulation. Drafts are local; explicit Save build uses the existing private cloud workspace when signed in. Persisted draft state retains references after refresh, not automatic multi-device synchronization. Comparison presently uses horizontal scrolling on phones; a focused baseline-versus-peer mode remains planned.

Next: trace item acquisition relationships with provenance, strengthen port compatibility, and expand supported calculations. Do not claim acquisition or simulation parity with SPViewer/Erkul from this first increment.
