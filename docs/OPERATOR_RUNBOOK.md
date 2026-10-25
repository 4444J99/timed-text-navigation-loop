# Six Encounters Operator Runbook

## Overview

The **Six Encounters** system is a deterministic, time-moment navigation artwork and spatial poetry engine within the `timed-text-navigation-loop` repository. It models interactive textual journeys through historical chambers (`040915`, `041015`, `042115`), seeded entrance variations, timed text exposures, and relational perceptual fields without external runtime dependencies.

This runbook establishes operational procedures for deployment qualification, release gate evaluation, automated rollback verification, patch grammar operations, and studio review workflows.

---

## Release Gates

Every proposed release candidate must pass all automated release gates before distribution or deployment to exhibition endpoints. Release gates are programmatic checks evaluated via `evaluateReleaseGates(metrics)`.

### Gate Criteria & Budgets

| Gate Name | Metric Key | Enforcement Threshold | Description & Rationale |
|---|---|---|---|
| **Frame Time Budget** | `frameTimeMs` | $\le 16.67\text{ ms}$ | Enforces stable 60 FPS animation loop without stutter or jank. |
| **Memory Budget** | `memoryMb` | $\le 256\text{ MB}$ | Bounds heap and GPU texture memory for resource-constrained kiosks and mobile devices. |
| **Reduced Motion** | `reducedMotionSupported` | `true` | Honors `prefers-reduced-motion` media queries by disabling excessive continuous displacement. |
| **Color Contrast** | `contrastRatio` | $\ge 4.5:1$ | Meets WCAG AA legibility requirements across all background/foreground combinations. |
| **ARIA Landmarks** | `ariaLandmarksComplete` | `true` | Ensures complete screen-reader navigable hierarchy and accessible semantic roles. |
| **Replay Parity** | `trajectoryDigestMatch` | `true` | Verifies bit-exact SHA-256 trajectory digests between reference and replayed journeys. |

### Evaluation CLI / Node Invocation

```javascript
const { evaluateReleaseGates } = require('./experimental/six-encounters/release-gates.js');

const result = evaluateReleaseGates({
  frameTimeMs: 14.2,
  memoryMb: 184,
  reducedMotionSupported: true,
  contrastRatio: 5.2,
  ariaLandmarksComplete: true,
  trajectoryDigestMatch: true
});

if (!result.passed) {
  console.error('Release gates failed:', result.summary);
  process.exit(1);
}
```

---

## Rollback Procedure

When an active release exhibits regressions or fails post-deployment verification, the operator must execute a clean rollback using the cryptographic release manifest chain.

### Manifest Invariant & Verification

Every release is sealed by `buildReleaseManifest(input)`, producing a deterministic SHA-256 digest over:
1. `version` (SemVer release tag)
2. `commit` (Git commit reference)
3. `routeGraphDigest` (Canonical SHA-256 digest of route graph topology)
4. `patchGrammarDigest` (Canonical SHA-256 digest of canonical patch dimensions)
5. `rollbackTarget` (Explicit pointer to the previous valid manifest)

### Rollback Execution Steps

1. **Verify Target Integrity**: Validate that the previous manifest has not been tampered with:
   ```javascript
   const { verifyRollbackTarget } = require('./experimental/six-encounters/release-gates.js');
   const verification = verifyRollbackTarget(currentManifest, previousManifest);
   if (!verification.valid) {
     throw new Error(`Cannot rollback: ${verification.errors.join(', ')}`);
   }
   ```
2. **Re-engage Previous Route Graph**: Re-anchor the active route session to `previousManifest.routeGraphDigest`.
3. **Re-evaluate State Snapshots**: Confirm that existing user trajectories can be replayed against the previous graph without state drift.
4. **Log Incident & Audit Record**: Record the rollback timestamp, root cause, and operator signature in the operational log.

---

## Patch Grammar Operations

The 7-tuple patch grammar provides formal, structured modifications to encounter chambers while maintaining the boundary between machine execution and poetic directives.

### Canonical 7-Tuple Dimensions

1. `source`: Provenance identifier and author attribution.
2. `topology`: Structural Chamber adjacency and edge transitions.
3. `geometry`: Spatial layout, aspect ratio, and viewport bounds.
4. `typography`: Font family, font weight, line height, and tracking specifications.
5. `palette`: Background color, foreground palette array, and contrast bounds.
6. `temporalScore`: Exposure durations, transition intervals, and animation delays.
7. `interactionRules`: Interaction event mappings, separating executable actions from poetic instructions.

### Separation Invariant

Poetic instructions (e.g. ambient reflections, interpretive prompts) must **never** be placed inside `executableActions` without an explicit machine action type. They must be placed in `poeticInstructions`. `validatePatchGrammar(patch)` enforces this rule at compile time and fails closed on violations.

---

## Studio Review Workflow

The Local Composition Studio Review session enables curators, artists, and operators to review generated journeys, apply non-destructive preview patches, record annotations, and export portable review bundles.

### Review Workflow Steps

1. **Initialize Session**:
   ```javascript
   const { createStudioReviewSession } = require('./experimental/six-encounters/generation.js');
   const session = createStudioReviewSession({ chamber: '040915', seed: 42 });
   ```
2. **Add Operator Annotations**:
   ```javascript
   session.annotateEncounter('040915', 'Relational tension creates high focal contrast in third clause.');
   ```
3. **Stage Preview Patches**:
   Apply non-destructive candidate patches to test alternative palettes or typographies without altering master state:
   ```javascript
   session.applyPreviewPatch(candidatePatch);
   ```
4. **Export Review Bundle**:
   Export a deterministic, SHA-256 digested bundle for collaborative review:
   ```javascript
   const bundle = session.exportReviewBundle();
   fs.writeFileSync('studio-review-bundle.json', JSON.stringify(bundle, null, 2));
   ```
5. **Import & Verification**:
   When re-opening a bundle, `session.importReviewBundle(bundle)` cryptographically verifies the digest and restores the exact session state.

---

## Troubleshooting

### Gate Failure: Frame Time Exceeded (> 16.67 ms)
- **Symptom**: `evaluateReleaseGates` reports `frameTimeMs exceeds budget 16.67 ms`.
- **Diagnosis**: Check for DOM thrashing or unbatched style reads in `render.js`.
- **Resolution**: Ensure unique character cell advances are cached in the `advances` Map and that CSS transforms rather than layout properties drive character movement.

### Gate Failure: Contrast Ratio Below 4.5:1
- **Symptom**: `evaluateReleaseGates` reports `contrastRatio below minimum 4.5:1`.
- **Diagnosis**: The palette generator selected colors close to the chamber background.
- **Resolution**: Verify that `HLGeneration.palette(background, seed)` loops until all colors achieve WCAG relative luminance contrast $\ge 4.5:1$.

### Replay Trajectory Mismatch
- **Symptom**: `trajectoryDigestMatch` is false.
- **Diagnosis**: Non-deterministic PRNG invocation order or unseeded random calls.
- **Resolution**: Confirm that all route events and character plans use independent seeded streams with explicit PRNG instances (`random(seed)`).
