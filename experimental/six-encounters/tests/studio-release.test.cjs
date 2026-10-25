const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const G = require('../generation.js');
const RG = require('../release-gates.js');

// -------------------------------------------------------------
// C2: Issue #25 — Release Gates Evaluation
// -------------------------------------------------------------
test('evaluateReleaseGates passes when all performance, a11y, and replay criteria are met (#25)', () => {
  const metrics = {
    frameTimeMs: 14.5,
    memoryMb: 128,
    reducedMotionSupported: true,
    contrastRatio: 7.2,
    ariaLandmarksComplete: true,
    trajectoryDigestMatch: true
  };
  const res = RG.evaluateReleaseGates(metrics);
  assert.equal(res.passed, true);
  assert.equal(res.gates.frameTime.passed, true);
  assert.equal(res.gates.memoryBudget.passed, true);
  assert.equal(res.gates.reducedMotion.passed, true);
  assert.equal(res.gates.contrastRatio.passed, true);
  assert.equal(res.gates.ariaLandmarks.passed, true);
  assert.equal(res.gates.trajectoryDigestMatch.passed, true);
  assert.ok(res.summary.includes('PASSED'));
  assert.ok(res.summary.includes('6/6'));
});

test('evaluateReleaseGates fails closed when budgets or parity criteria are violated (#25)', () => {
  // Exceed frame time budget
  const slowRes = RG.evaluateReleaseGates({
    frameTimeMs: 24.0,
    memoryMb: 128,
    reducedMotionSupported: true,
    contrastRatio: 5.0,
    ariaLandmarksComplete: true,
    trajectoryDigestMatch: true
  });
  assert.equal(slowRes.passed, false);
  assert.equal(slowRes.gates.frameTime.passed, false);
  assert.ok(slowRes.gates.frameTime.reason.includes('exceeds budget'));

  // Exceed memory budget
  const fatRes = RG.evaluateReleaseGates({
    frameTimeMs: 12.0,
    memoryMb: 300,
    reducedMotionSupported: true,
    contrastRatio: 5.0,
    ariaLandmarksComplete: true,
    trajectoryDigestMatch: true
  });
  assert.equal(fatRes.passed, false);
  assert.equal(fatRes.gates.memoryBudget.passed, false);

  // Contrast failure
  const lowContrastRes = RG.evaluateReleaseGates({
    frameTimeMs: 12.0,
    memoryMb: 100,
    reducedMotionSupported: true,
    contrastRatio: 3.2,
    ariaLandmarksComplete: true,
    trajectoryDigestMatch: true
  });
  assert.equal(lowContrastRes.passed, false);
  assert.equal(lowContrastRes.gates.contrastRatio.passed, false);

  // Replay mismatch failure
  const mismatchRes = RG.evaluateReleaseGates({
    frameTimeMs: 12.0,
    memoryMb: 100,
    reducedMotionSupported: true,
    contrastRatio: 5.0,
    ariaLandmarksComplete: true,
    trajectoryDigestMatch: false
  });
  assert.equal(mismatchRes.passed, false);
  assert.equal(mismatchRes.gates.trajectoryDigestMatch.passed, false);

  // Empty / null metrics fails all gates
  const emptyRes = RG.evaluateReleaseGates(null);
  assert.equal(emptyRes.passed, false);
  assert.ok(emptyRes.summary.includes('0/6'));
});

// -------------------------------------------------------------
// C2: Issue #26 — Release Manifest & Rollback Target Verification
// -------------------------------------------------------------
test('buildReleaseManifest creates deterministic signed manifest and rejects invalid inputs (#26)', () => {
  const input = {
    version: '1.2.0',
    commit: '7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0',
    routeGraphDigest: '1111111111111111111111111111111111111111111111111111111111111111',
    patchGrammarDigest: '2222222222222222222222222222222222222222222222222222222222222222',
    rollbackTarget: '1.1.0'
  };

  const manifestA = RG.buildReleaseManifest(input);
  const manifestB = RG.buildReleaseManifest(input);

  assert.equal(manifestA.version, '1.2.0');
  assert.equal(manifestA.schema, 'six-encounters-release-manifest-v1');
  assert.ok(/^[a-f0-9]{64}$/.test(manifestA.manifestDigest));
  assert.equal(manifestA.manifestDigest, manifestB.manifestDigest);
  assert.ok(Object.isFrozen(manifestA));

  // Required field errors
  assert.throws(() => RG.buildReleaseManifest({ ...input, version: '' }), /version/);
  assert.throws(() => RG.buildReleaseManifest({ ...input, commit: '' }), /commit/);
  assert.throws(() => RG.buildReleaseManifest({ ...input, routeGraphDigest: '' }), /routeGraph/);
});

test('verifyRollbackTarget verifies previous manifest integrity and state restoration path (#26)', () => {
  const prevManifest = RG.buildReleaseManifest({
    version: '1.1.0',
    commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    routeGraphDigest: '3333333333333333333333333333333333333333333333333333333333333333',
    patchGrammarDigest: '4444444444444444444444444444444444444444444444444444444444444444',
    rollbackTarget: '1.0.0'
  });

  const currManifest = RG.buildReleaseManifest({
    version: '1.2.0',
    commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    routeGraphDigest: '5555555555555555555555555555555555555555555555555555555555555555',
    patchGrammarDigest: '6666666666666666666666666666666666666666666666666666666666666666',
    rollbackTarget: prevManifest.manifestDigest
  });

  const check = RG.verifyRollbackTarget(currManifest, prevManifest);
  assert.equal(check.valid, true);
  assert.equal(check.errors.length, 0);
  assert.equal(check.rollbackDigest, prevManifest.manifestDigest);
  assert.equal(check.details.targetVersion, '1.1.0');

  // Tampered previous manifest fails digest check
  const tampered = { ...prevManifest, commit: 'tampered-commit' };
  const tamperedCheck = RG.verifyRollbackTarget(currManifest, tampered);
  assert.equal(tamperedCheck.valid, false);
  assert.ok(tamperedCheck.errors.some(e => e.includes('digest mismatch')));

  // Incompatible target mismatch
  const mismatchedCurr = { ...currManifest, rollbackTarget: 'non-existent-target' };
  const mismatchCheck = RG.verifyRollbackTarget(mismatchedCurr, prevManifest);
  assert.equal(mismatchCheck.valid, false);
  assert.ok(mismatchCheck.errors.some(e => e.includes('does not match')));
});

// -------------------------------------------------------------
// C2: Issue #27 — Operator Runbook Health Verification
// -------------------------------------------------------------
test('verifyDocumentationHealth validates operator runbook completeness (#27)', () => {
  const runbookPath = path.resolve(__dirname, '../../../docs/OPERATOR_RUNBOOK.md');
  const check = RG.verifyDocumentationHealth(runbookPath);

  assert.equal(check.healthy, true);
  assert.equal(check.missingSections.length, 0);
  assert.equal(check.sectionCount, 6);
  assert.deepEqual(check.foundSections, [
    'Overview',
    'Release Gates',
    'Rollback Procedure',
    'Patch Grammar Operations',
    'Studio Review Workflow',
    'Troubleshooting'
  ]);

  // Missing section triggers unhealthy report
  const partialDoc = '# Overview\nSome text.\n## Release Gates\nMore text.';
  const partialCheck = RG.verifyDocumentationHealth(partialDoc);
  assert.equal(partialCheck.healthy, false);
  assert.ok(partialCheck.missingSections.includes('Rollback Procedure'));
  assert.ok(partialCheck.missingSections.includes('Troubleshooting'));
});

// -------------------------------------------------------------
// C3: Issue #29 — Relational Perceptual Field Evaluation
// -------------------------------------------------------------
test('evaluatePerceptualField computes relational contrast, tension, and proximity vectors (#29)', () => {
  const stateA = {
    chamber: '040915',
    background: '#000000',
    colors: ['#00ffff', '#ff00ff', '#ffff00'],
    dwellTime: 2000,
    visit: 1,
    history: [{ chamber: '040915' }],
    links: [
      { word: 'before', target: '041015' },
      { word: 'again', target: '042115' }
    ]
  };

  const fieldA = G.evaluatePerceptualField(stateA, { width: 1200, height: 800 });
  assert.equal(fieldA.chamber, '040915');
  assert.equal(fieldA.colorContrast.compliant, true);
  assert.ok(fieldA.colorContrast.min >= 4.5);
  assert.ok(fieldA.typographicTension > 0 && fieldA.typographicTension <= 1);
  assert.equal(fieldA.nodes.length, 2);
  assert.equal(fieldA.proximityVectors.length, 1);
  assert.ok(fieldA.visualWeight > 0 && fieldA.visualWeight <= 1);

  // Increased dwell time and visit count increases typographic tension and visual weight
  const stateB = {
    ...stateA,
    dwellTime: 4500,
    visit: 3,
    history: [{ chamber: '040915' }, { chamber: '041015' }, { chamber: '040915' }]
  };
  const fieldB = G.evaluatePerceptualField(stateB, { width: 1200, height: 800 });
  assert.ok(fieldB.typographicTension > fieldA.typographicTension);
  assert.ok(fieldB.visualWeight > fieldA.visualWeight);
});

// -------------------------------------------------------------
// C3: Issue #30 — Reversible Spatial Poetry Layer Composition
// -------------------------------------------------------------
test('composeSpatialPoetryLayer preserves legibility, non-overlapping corridor, and linear reversibility (#30)', () => {
  const patchRecord = {
    poeticInstructions: [
      'first line of poetic thought',
      'second line drifting in space',
      'third line returning to center'
    ]
  };

  const layer = G.composeSpatialPoetryLayer([], patchRecord, {
    width: 1000,
    height: 700,
    background: '#000000',
    color: '#00ffff',
    minContrast: 4.5
  });

  assert.equal(layer.nodes.length, 3);
  assert.equal(layer.corridor.nonOverlapping, true);
  assert.equal(layer.legibility.compliant, true);

  // Non-overlapping corridor check: Y coordinates are strictly monotonic
  for (let i = 1; i < layer.nodes.length; i++) {
    assert.ok(layer.nodes[i].y >= layer.nodes[i - 1].y + layer.legibility.corridorClearance);
  }

  // Exact linear reversibility
  const expectedText = 'first line of poetic thought second line drifting in space third line returning to center';
  assert.equal(layer.reversibleToLinearText(), expectedText);
});

// -------------------------------------------------------------
// C3: Issue #31 — Local Composition Studio Review Session
// -------------------------------------------------------------
test('createStudioReviewSession supports annotations, preview patches, and round-trip bundles (#31)', () => {
  const initial = { chamber: '040915', seed: 42, background: '#000000' };
  const session = G.createStudioReviewSession(initial);

  // 1. Annotations
  const annot1 = session.annotateEncounter('040915', 'Relational tension is well balanced');
  assert.equal(annot1.encounterId, '040915');
  assert.equal(annot1.note, 'Relational tension is well balanced');
  assert.equal(session.getAnnotations('040915').length, 1);
  assert.equal(session.getAnnotations().length, 1);

  // 2. Preview patch application
  const patchTuple = {
    source: 'artist-review',
    topology: { defaultChamber: '041015' },
    geometry: { scale: 1.2 },
    typography: { weight: 600 },
    palette: { background: '#00ffff' },
    temporalScore: { exposure: 6000 },
    interactionRules: {
      executableActions: [
        { type: 'set_property', key: 'background', value: '#00ffff' }
      ],
      poeticInstructions: ['pause and consider the field']
    }
  };

  const previewResult = session.applyPreviewPatch(patchTuple);
  assert.equal(previewResult.currentState.background, '#00ffff');
  assert.equal(session.getState().background, '#00ffff');
  assert.equal(session.getPreviewPatches().length, 1);

  // 3. Export review bundle
  const bundle = session.exportReviewBundle();
  assert.equal(bundle.schema, 'six-encounters-studio-review-v1');
  assert.ok(/^[a-f0-9]{64}$/.test(bundle.digest));
  assert.equal(bundle.annotations.length, 1);
  assert.equal(bundle.previewPatches.length, 1);

  // 4. Import review bundle with round-trip restoration
  const newSession = G.createStudioReviewSession();
  const restoreRes = newSession.importReviewBundle(bundle);
  assert.equal(restoreRes.restored, true);
  assert.equal(newSession.getAnnotations('040915')[0].note, 'Relational tension is well balanced');
  assert.equal(newSession.getState().background, '#00ffff');
  assert.equal(newSession.getPreviewPatches().length, 1);

  // 5. Tampered bundle throws on import
  const tamperedBundle = {
    ...bundle,
    sessionState: { ...bundle.sessionState, background: '#ff0000' }
  };
  assert.throws(() => newSession.importReviewBundle(tamperedBundle), /digest mismatch/);

  // 6. Reset preview restores baseline state
  session.resetPreview();
  assert.equal(session.getState().background, '#000000');
  assert.equal(session.getPreviewPatches().length, 0);
});
