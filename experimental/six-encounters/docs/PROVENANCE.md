# Source and configuration provenance

Inspected repository default branch: `ee25e7a50019fd75ef1fae790d1e0f80b6b436e4`, containing README and restoration instructions, no chamber files or AGENTS.md. The existing restoration PR #1 was inspected as separate work, not a dependency. Its branch's AGENTS.md was read and its preservation boundary respected; none of that branch's files were checked out, repaired, imported, or modified.

Read-only creative input is available at repository revision **9fc3c006f2764e1887b79293e32eb9a3a1875344**, branch `restoration-2017`. `docs/source-census.json` records the SHA-256 of each inspected file and its body text nodes. No historical asset is needed at runtime.

| Selected chamber | Actual inspected path at that revision | New runtime source |
| --- | --- | --- |
| 040915 | `provenance/original-2017/labyrinth/040915.html.txt` | `content.js`, two clauses in source order |
| 041015 | `provenance/original-2017/labyrinth/041015.html.txt` | `content.js`, phrase × 42 rows × nine columns |
| 042115 | `provenance/original-2017/labyrinth/042115.html.txt` | `content.js`, forced progress |

Moment's source includes non-breaking spaces inside the clauses. The new edition uses the assignment's exact single-space wording, preserving words and order. This is an explicit new rendering/content-normalization decision, not a claim of byte-identical historical presentation. I/you's inspected source has exactly 378 phrase occurrences in 42 text nodes; the new edition assigns explicit row/column/instance identities. The remaining nine chambers were read only to plan later behavior; their exact text nodes and source identities are in the census.

The attached **Text, Color, Type, and Geometry: A Global Genealogy of Modern and Contemporary Art** report was read from the supplied project file. The edition translates its discussed relational color, concrete poetry, instruction-score, transparent-layer and typographic-address methods into controlled experiments. These are proposed contemporary references. This assignment performs no independent verification of the report's historical citations and makes no new historical influence claim.

Configuration versions: content `1.0.0`; score `1.0.0`. All proposed fields, font families, logical stage dimensions, sizes, weights, clause intervals, timing thresholds and sequence are in `content.js`. Actual browser-derived phrase advance and text bounds are captured at encounter readiness, in logical stage coordinates. The stage transform scales text and remembered geometry together; fit/pan never changes content identity.

Timing readiness follows two animation-frame opportunities after DOM mount. This build uses system fonts only, so it does not wait on external font downloads. `performance.now()` supplies monotonic time. Visibility and pause events accrue only the preceding eligible interval, then change eligibility; they never invoke navigation. Only an eligible animation-frame tick can expire a timer. Return identifies the still-active encounter and cancels the frame loop before appending history. Hidden, paused and reading-view intervals do not count.
