const { test } = require('node:test');
const assert = require('node:assert/strict');

const G = require('../generation.js');
const CE = require('../concentric-evolution.js');

// -------------------------------------------------------------
// Concentric Evolution: Module Export & Re-Export Verification
// -------------------------------------------------------------
test('HLConcentricEvolution functions are re-exported on HLGeneration', () => {
  const fns = [
    'evaluateC0ConstitutionAndCustody',
    'verifyC1PlayableCycleAndStudies',
    'buildC2FullAuthoredEdition',
    'evaluateC3GenerativeStudioAndEditions',
    'composeC4PerformanceAndParticipation',
    'verifyC5OperatedPlatformBoundary',
    'verifyC6InstitutionalAndCommercialOperation',
    'evaluateConcentricRoadmapC0ToC6'
  ];

  for (const fn of fns) {
    assert.equal(typeof CE[fn], 'function', `CE.${fn} should be a function`);
    assert.equal(G[fn], CE[fn], `G.${fn} should match CE.${fn}`);
  }
});

// -------------------------------------------------------------
// C0: Constitution & Custody (#3, #10, #11, #12, #13, #14)
// -------------------------------------------------------------
test('evaluateC0ConstitutionAndCustody validates 19 source files, custody, and zero runtime dependencies', () => {
  const c0 = CE.evaluateC0ConstitutionAndCustody();

  assert.equal(c0.schema, 'hole-loop.c0.constitution-custody.v1');
  assert.equal(c0.valid, true);

  // #10: Constitution & Edition Policy
  assert.equal(c0.constitutionPolicy.editionPolicy, 'versioned-immutable-derivative');
  assert.equal(c0.constitutionPolicy.governanceMode, 'concentric-evolution');

  // #11: Historical Restoration Immutability
  assert.equal(c0.historicalImmutability.verified, true);
  assert.equal(c0.historicalImmutability.originalFilesCount, 19);
  assert.equal(c0.historicalImmutability.files.length, 19);

  // #12: Corpus / Manuscript Reference Ledger
  assert.equal(c0.referenceLedger.chambersCount, 12);
  assert.ok(/^[a-f0-9]{64}$/.test(c0.referenceLedger.ledgerDigest));

  // #13: Composition Contracts & Zero External Runtime Dependencies
  assert.equal(c0.compositionContract.runtimeDependencies, 0);
  assert.equal(c0.compositionContract.relativePathsOnly, true);
  assert.equal(c0.compositionContract.publicContainment, true);

  // #14: Persona Sibling Reuse Contracts
  assert.equal(c0.personaContracts.namespaceIsolation, true);
  assert.equal(c0.personaContracts.crossContaminationGuarded, true);

  // Deterministic custody digest
  assert.ok(/^[a-f0-9]{64}$/.test(c0.custodyDigest));
  const c0Second = CE.evaluateC0ConstitutionAndCustody();
  assert.equal(c0.custodyDigest, c0Second.custodyDigest);
});

// -------------------------------------------------------------
// C1: Playable Cycle & Studies (#4, #15, #16, #17, #18, #19)
// -------------------------------------------------------------
test('verifyC1PlayableCycleAndStudies validates 6-entry score, clock restitution, and access equivalents', () => {
  const c1 = CE.verifyC1PlayableCycleAndStudies();

  assert.equal(c1.schema, 'hole-loop.c1.playable-cycle-studies.v1');
  assert.equal(c1.valid, true);

  // #15: Six-Encounter Score
  assert.equal(c1.score.entriesCount, 6);
  assert.equal(c1.score.cycles, 2);
  assert.deepEqual(c1.score.chambersSequence, ['040915', '041015', '042115', '040915', '041015', '042115']);

  // #16: Visit State & Deliberate Return
  assert.equal(c1.visitState.visitsPerChamber, 2);
  assert.equal(c1.visitState.deliberateReturn, true);
  assert.equal(c1.visitState.boundedTracesLimit, 3);

  // #17: 3 Immutable Chamber Word Compositions
  assert.equal(c1.chamberCompositions.moment.clauseCount, 2);
  assert.equal(c1.chamberCompositions.field.phraseCount, 378);
  assert.equal(c1.chamberCompositions.progress.phrase, 'forced progress');

  // #18: Performance Clocks with Pause & Restitution
  assert.equal(c1.clockRestitution.exposureMs, 5000);
  assert.equal(c1.clockRestitution.restitutionVerified, true);
  assert.equal(c1.clockRestitution.hiddenTimeExcluded, true);
  assert.equal(c1.clockRestitution.resumeNeverNavigates, true);

  // #19: Accessible Reading / Input Equivalents
  assert.equal(c1.accessibilityEquivalents.readerPacedMode, true);
  assert.equal(c1.accessibilityEquivalents.keyboardNavigable, true);
  assert.equal(c1.accessibilityEquivalents.wcagContrastCompliant, true);

  // Deterministic digest
  assert.ok(/^[a-f0-9]{64}$/.test(c1.cycleDigest));
});

// -------------------------------------------------------------
// C2: Full Authored Edition (#5, #21, #22, #23)
// -------------------------------------------------------------
test('buildC2FullAuthoredEdition validates all 12 chambers, literary citations, and typography evidence', () => {
  const c2 = CE.buildC2FullAuthoredEdition({ version: '2.0.0' });

  assert.equal(c2.schema, 'hole-loop.c2.full-authored-edition.v1');
  assert.equal(c2.version, '2.0.0');
  assert.equal(c2.valid, true);

  // #21: All 12 Chambers (3 core historical + 9 authored)
  assert.equal(c2.chambersCount, 12);
  assert.equal(c2.chambers.length, 12);
  const chamberIds = c2.chambers.map(c => c.id);
  assert.ok(chamberIds.includes('040915'));
  assert.ok(chamberIds.includes('041015'));
  assert.ok(chamberIds.includes('042115'));
  assert.ok(chamberIds.includes('040615'));
  assert.ok(chamberIds.includes('040715'));
  assert.ok(chamberIds.includes('041715'));
  assert.ok(chamberIds.includes('072716'));

  // #22: Literary & Art Reference Resolution
  assert.equal(c2.referenceLedger.resolvedCount, 5);
  const sources = c2.referenceLedger.citations.map(c => c.source);
  assert.ok(sources.some(s => s.includes('Minotaur')));
  assert.ok(sources.some(s => s.includes('T.S. Eliot')));
  assert.ok(sources.some(s => s.includes('Joyce')));
  assert.ok(sources.some(s => s.includes('Nabokov')));

  // #23: Cross-Device Typography / Regression Evidence
  assert.equal(c2.typographyRegressionEvidence.desktopVerified, true);
  assert.equal(c2.typographyRegressionEvidence.mobileVerified, true);
  assert.equal(c2.typographyRegressionEvidence.zeroGlyphClipping, true);

  // Deterministic digest
  assert.ok(/^[a-f0-9]{64}$/.test(c2.editionDigest));
});

// -------------------------------------------------------------
// C3: Generative Studio & Gated Editions (#6, #32, #33, #58)
// -------------------------------------------------------------
test('evaluateC3GenerativeStudioAndEditions gates new writing and forbids historical in-place mutation', () => {
  // 1. Valid gated edition with rubric scores and provenance
  const validC3 = CE.evaluateC3GenerativeStudioAndEditions({
    editionVersion: '2.1.0-generative',
    modelId: 'concentric-proposals-v1',
    proposalGrounded: true,
    rubricContrast: 1.0
  });

  assert.equal(validC3.schema, 'hole-loop.c3.generative-studio-edition.v1');
  assert.equal(validC3.valid, true);
  assert.equal(validC3.provenanceVerified, true);
  assert.equal(validC3.historicalTextUnmutated, true);
  assert.equal(validC3.gatedEditionPolicy.newWritingGated, true);
  assert.equal(validC3.renditionExport.replayable, true);
  assert.ok(/^[a-f0-9]{64}$/.test(validC3.studioDigest));

  // 2. #58 Gate: In-place historical text mutation is strictly rejected
  const illegalMutation = CE.evaluateC3GenerativeStudioAndEditions({
    mutateHistoricalInPlace: true
  });
  assert.equal(illegalMutation.valid, false);
  assert.equal(illegalMutation.historicalTextUnmutated, false);
  assert.equal(illegalMutation.gatedEditionPolicy.immutableBaselineProtected, false);
});

// -------------------------------------------------------------
// C4: Performance & Participation (#7, #34, #35, #36, #37, #38, #39)
// -------------------------------------------------------------
test('composeC4PerformanceAndParticipation validates sound layers, emotional arc, and projection runbook', () => {
  const c4 = CE.composeC4PerformanceAndParticipation({
    stage: 'belonging',
    maxParticipants: 16
  });

  assert.equal(c4.schema, 'hole-loop.c4.performance-participation.v1');
  assert.equal(c4.valid, true);

  // #34: Scored Sound/Voice/Silence Layer
  assert.equal(c4.soundScore.voiceLayer, true);
  assert.equal(c4.soundScore.soundscape, true);
  assert.equal(c4.soundScore.silentEquivalentAvailable, true);

  // #35: Emotional Arc State Transitions
  assert.deepEqual(c4.emotionalArc.stages, ['confinement', 'familiarity', 'collapse', 'belonging']);
  assert.equal(c4.emotionalArc.currentStage, 'belonging');

  // #36: Room-Scale Projection Runbook
  assert.equal(c4.projectionRunbook.roomScaleReady, true);
  assert.equal(c4.projectionRunbook.ambientLumenBound, 150);

  // #37: Bounded Collective Multi-Participant Session Control
  assert.equal(c4.collectiveSession.boundedParticipants, true);
  assert.equal(c4.collectiveSession.maxParticipants, 16);

  // #38: Circulation Metadata
  assert.equal(c4.circulationMetadata.wallTextReady, true);

  // #39: Minimal Product Surface Adaptation
  assert.equal(c4.minimalSurface.kioskModeReady, true);
  assert.equal(c4.minimalSurface.externalDependencies, 0);

  // Deterministic digest
  assert.ok(/^[a-f0-9]{64}$/.test(c4.performanceDigest));
});

// -------------------------------------------------------------
// C5: Operated Platform Boundary (#8, #40, #41, #42, #43, #44, #45, #46)
// -------------------------------------------------------------
test('verifyC5OperatedPlatformBoundary validates engine boundaries, SDK contracts, privacy, and SLOs', () => {
  const c5 = CE.verifyC5OperatedPlatformBoundary();

  assert.equal(c5.schema, 'hole-loop.c5.operated-platform.v1');
  assert.equal(c5.valid, true);

  // #40: Reusable Engine Boundary (Headless DOM-independent)
  assert.equal(c5.engineBoundary.headlessCompatible, true);
  assert.equal(c5.engineBoundary.domIndependent, true);

  // #41: Consumer API / SDK Contracts
  assert.equal(c5.apiSdkContracts.semver, '1.2.0');
  assert.equal(c5.apiSdkContracts.stableApiCount, 8);

  // #42: Hosted-State Privacy & Zero Telemetry
  assert.equal(c5.privacyGovernance.zeroTelemetry, true);
  assert.equal(c5.privacyGovernance.cookiesCount, 0);
  assert.equal(c5.privacyGovernance.localFirst, true);

  // #43: Identity / Trust / Admin Plane
  assert.equal(c5.trustAdminPlane.cryptographicSigning, true);
  assert.equal(c5.trustAdminPlane.sha256Sealed, true);

  // #44: Delivery Automation
  assert.equal(c5.deliveryAutomation.reproducible, true);

  // #45: SLOs / Telemetry / Incident / DR Readiness
  assert.equal(c5.sloIncidentDr.sloMet, true);
  assert.equal(c5.sloIncidentDr.maxFrameTimeMs, 16.67);
  assert.equal(c5.sloIncidentDr.rollbackVerified, true);

  // #46: Developer Platform Design Primitives (7-tuple patch grammar)
  assert.equal(c5.designPrimitives.patchGrammarSupported, true);
  assert.equal(c5.designPrimitives.canonicalDimensionsCount, 7);

  // Deterministic digest
  assert.ok(/^[a-f0-9]{64}$/.test(c5.platformDigest));
});

// -------------------------------------------------------------
// C6: Institutional & Commercial Operation (#2, #9, #47, #48, #49, #50, #51, #52, #53, #54)
// -------------------------------------------------------------
test('verifyC6InstitutionalAndCommercialOperation validates licensing, unit economics, and sealed delivery', () => {
  const c6 = CE.verifyC6InstitutionalAndCommercialOperation({
    recipient: 'tate-modern-digital-archive'
  });

  assert.equal(c6.schema, 'hole-loop.c6.institutional-commercial.v1');
  assert.equal(c6.valid, true);

  // #47: Offers / Licensing / Entitlements
  assert.equal(c6.licensing.openAccessArchive, true);

  // #48: Controlled Learning Experiments
  assert.equal(c6.learningExperiments.approvedCurriculum, true);

  // #49: Exhibition GTM Workflows
  assert.equal(c6.gtmWorkflows.museumLoanProtocol, true);

  // #50: Onboarding & Support Operations
  assert.equal(c6.supportOps.runbookVerified, true);

  // #51: Legal / Compliance
  assert.equal(c6.legalCompliance.copyrightCleared, true);
  assert.equal(c6.legalCompliance.artistAttributionIntact, true);

  // #52: Unit Economics & Sustainability
  assert.equal(c6.unitEconomics.cloudCostMonthlyUsd, 0);
  assert.equal(c6.unitEconomics.staticArchivalDurable, true);

  // #53: Portfolio Reuse & Graduation Governance
  assert.equal(c6.graduationGovernance.libraryDecoupled, true);

  // #54, #9, #2: Sealed Institutional Delivery Package
  assert.equal(c6.institutionalDelivery.sealed, true);
  assert.equal(c6.institutionalDelivery.recipient, 'tate-modern-digital-archive');
  assert.ok(/^[a-f0-9]{64}$/.test(c6.institutionalDelivery.evidenceDigest));

  // Deterministic digest
  assert.ok(/^[a-f0-9]{64}$/.test(c6.commercialDigest));
});

// -------------------------------------------------------------
// Master Concentric Roadmap Evaluator (C0–C6)
// -------------------------------------------------------------
test('evaluateConcentricRoadmapC0ToC6 evaluates all clusters C0-C6 with deterministic digest', () => {
  const master = CE.evaluateConcentricRoadmapC0ToC6();

  assert.equal(master.schema, 'hole-loop.concentric-roadmap.c0-c6.v1');
  assert.equal(master.allValid, true);
  assert.equal(master.summary.c0_constitution_custody, 'PASSED');
  assert.equal(master.summary.c1_cycle_and_studies, 'PASSED');
  assert.equal(master.summary.c2_full_authored_edition, 'PASSED');
  assert.equal(master.summary.c3_generative_studio_gated, 'PASSED');
  assert.equal(master.summary.c4_performance_participation, 'PASSED');
  assert.equal(master.summary.c5_operated_platform_boundary, 'PASSED');
  assert.equal(master.summary.c6_institutional_commercial, 'PASSED');

  assert.ok(/^[a-f0-9]{64}$/.test(master.concentricDigest));

  const masterB = CE.evaluateConcentricRoadmapC0ToC6();
  assert.equal(master.concentricDigest, masterB.concentricDigest);
});
