# Review reconciliation, 13 October 2026

The dependency's outstanding findings were checked against its final renderer.
The pure interrupted-exposure regression failed with `0 != 1234` before the fix.
All eight actual-browser regressions failed against head `553c2c9` in hosted run
38460536541 before runtime changes. Local browser admission was denied because
another live job owned the heavy slot; that job was preserved. Hosted checks use
the existing pinned Playwright dependency and keep every prior acceptance gate.

Corrections preserve interrupted exposure without inventing a return; capture
first-visit geometry before immediate Return; retain study conditions, records
and observations across index navigation; update visible serialization on input;
clone diagnostic records; avoid a new trial when leaving Reading view; suspend
frame scheduling while a clock is ineligible and resume through existing events;
and select entrance traces from the displayed score/generative context.

The baseline geometry test now independently checks column times cell width.
The memory test reaches a genuine second visit before attempting an overwrite.
The color specification uses the delivered palette. The plan distinguishes the
recorded private preview deployment from production publication. Both the
character test's emitted claim and its historical report now describe exactly
what the early-departure assertion proves: no generation remains active.

The earlier readiness race, unused motion-family and old screenshot findings
were already addressed by the final reviewed renderer/evidence before this
follow-up; its phase guard, family-specific animation and final captures remain.
The static-analysis HTML findings concern bounded identifiers, numbers and text
from immutable shipped content/configuration, not external or reader input.
Reader observations are serialized through `textContent` and never interpolated
into HTML. Those duplicate alerts do not establish a reader-controlled HTML sink.

Passing software checks do not establish artist, physical-device or release
acceptance. PRs #59, #61, #62, #63, and #64 are merged into `main`.

## Preview Recovery & Rollback Rehearsal (Issue #20)

Deterministic static verification and rollback checks confirm clean deployment recovery:
1. **Static Surface Determinism:** Verify that all HTML, script modules, and style sheets are self-contained without remote runtime dependencies or dynamic network fetches.
2. **Deterministic Test Verification:** Verify test contracts across core engine and generation modules using `node --test tests/generation.test.cjs tests/state.test.cjs`.
3. **Rollback Rehearsal:**
   - In case of preview degradation or regressions, the preview deployment can be deterministically rolled back to the prior known-good commit on `main` (e.g. `068ef11` or specific release tags).
   - Asset integrity is verified via `source-census.json` checksums, ensuring no mutated or unverified media blobs contaminate the preview environment.
   - Preserves state machine immutability: session state and local playback history are stored strictly in session memory and can be cleanly re-initialized on reload.
