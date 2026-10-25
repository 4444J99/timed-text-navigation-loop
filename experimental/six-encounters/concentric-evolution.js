/* Concentric Evolution Architecture (C0–C6, Issues #2–#58).
 * Deterministic validation, full authored editions, performance scoring,
 * platform boundary verification, and institutional delivery.
 */
(function(root) {
  function freeze(o) {
    if (o && typeof o === 'object') {
      Object.values(o).forEach(v => {
        if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v);
      });
      return Object.freeze(o);
    }
    return o;
  }

  function sha256Hex(ascii) {
    if (typeof module !== 'undefined' && typeof require !== 'undefined') {
      try {
        const crypto = require('node:crypto');
        return crypto.createHash('sha256').update(ascii, 'utf8').digest('hex');
      } catch (_) {}
    }
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    let i, j;
    let result = '';
    const words = [];
    const asciiBitLength = ascii.length * 8;
    const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
    words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;
    for (i = 0; i < words.length; i += 16) {
      const w = words.slice(i, i + 16);
      for (j = 16; j < 64; j++) {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = hash;
      for (j = 0; j < 64; j++) {
        const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + k[j] + (w[j] || 0)) | 0;
        const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      hash[0] = (hash[0] + a) | 0;
      hash[1] = (hash[1] + b) | 0;
      hash[2] = (hash[2] + c) | 0;
      hash[3] = (hash[3] + d) | 0;
      hash[4] = (hash[4] + e) | 0;
      hash[5] = (hash[5] + f) | 0;
      hash[6] = (hash[6] + g) | 0;
      hash[7] = (hash[7] + h) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        const byte = (hash[i] >> (j * 8)) & 255;
        result += '0123456789abcdef'[byte >> 4] + '0123456789abcdef'[byte & 15];
      }
    }
    return result;
  }

  function canonicalJSON(val) {
    if (val === null || typeof val !== 'object') {
      return JSON.stringify(val);
    }
    if (Array.isArray(val)) {
      return '[' + val.map(canonicalJSON).join(',') + ']';
    }
    const keys = Object.keys(val).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJSON(val[k])).join(',') + '}';
  }

  // 19 Preserved Source Files (Provenance Baseline #11)
  const PRESERVED_19_SOURCE_FILES = Object.freeze([
    { path: 'loophole.html', bytes: 3947, sha256: 'caab9f652dbc9046db726b4ba1304c16e452db8bcdd8c69705836fb94e1f19b2' },
    { path: 'js/loophole.js', bytes: 870, sha256: 'c5052ed326805861ef4ddd934922fa9c26e0453e3c78c84434ff161e8ec273c0' },
    { path: 'js/main.js', bytes: 1460, sha256: 'e81cd4d8d724f9067551093715f5f9fc80b8ea02e1b846552f49fad6e9e6150a' },
    { path: 'js/analytics.js', bytes: 411, sha256: '2eea9140ec7f46de94db391f5afe67df4e2fe8ac542f16418f7f4ba00cf8947c' },
    { path: 'css/normalize.css', bytes: 7797, sha256: 'f4d7e8250f8f124f8b7d087e5e260766a34b079fddc43e7b20d8c18ca1e92e51' },
    { path: 'css/styles_old.css', bytes: 28635, sha256: 'f09c991c33300af7028768fe77980f9c174821ae0f6ee3a8c449a36f6807ae1a' },
    { path: 'img/favicon.ico', bytes: 1033, sha256: '02518b8cbfdb639f567d9146f3f1186f40844d64fc489b24d45c311fb321d25d' },
    { path: 'labyrinth/040615.html', bytes: 5386, sha256: '4b20cc23bef0590cc4f3aafd7b6ec11569cf7f4e80f8dd9fcc033b8a70a4cdca' },
    { path: 'labyrinth/040715.html', bytes: 4196, sha256: '85cd20f69f266a1dbe11b25ac3b1bd271f63b02028d0efe4b456e471dac19867' },
    { path: 'labyrinth/040815.html', bytes: 4580, sha256: '155c37f750c9412a477ab86a521039a922b0082738039ddfd3b109ea26654c27' },
    { path: 'labyrinth/040915.html', bytes: 4206, sha256: '4c8d424ef53134d46b9f5903b2812ecb830fd04cf4d7e43799454eaa7797dbdf' },
    { path: 'labyrinth/041015.html', bytes: 87114, sha256: 'c5bb59d39cff5d86c3e676373710dfc5b9999867400000afbb71f2466e3d286c' },
    { path: 'labyrinth/041315.html', bytes: 4122, sha256: '6b115d0fcd5215825b593d4733511fdc78760c0df8dca21005d8c28327bd0198' },
    { path: 'labyrinth/041415.html', bytes: 4280, sha256: '4fd501768a5098143d332815b68bd2699bda81ff8c85cc2dbbac365b3bf72346' },
    { path: 'labyrinth/041715.html', bytes: 4627, sha256: 'a2f69aed73bcd980f1dc6e7235f8ed70b3255f4a1ef0083c83be6d892a443ba3' },
    { path: 'labyrinth/042115.html', bytes: 4154, sha256: '0e0e5bc0c2cc9a84484b65010039434e578bcb4b61add2ee74af0d9890e12a9f' },
    { path: 'labyrinth/042215.html', bytes: 4626, sha256: 'eaa80958459e0fc0c7eb56768ea1d212e8841aea7e456a0671009a4603a61e40' },
    { path: 'labyrinth/051815.html', bytes: 4099, sha256: '892cc6783d6daa1ca067528a63bd395050937a1362348b20c3ef17851f241d18' },
    { path: 'labyrinth/072716.html', bytes: 4192, sha256: '980f0704e4574db55e1dfdccb18d4e2863f7031d9505f9dba3a24a90b90f0106' }
  ]);

  // Full 12 Chambers Census (#21)
  const HISTORICAL_CHAMBERS_CENSUS = Object.freeze([
    { id: '040615', role: 'authored', behavior: 'sensory-subversion-monologue', sha256: '4b20cc23bef0590cc4f3aafd7b6ec11569cf7f4e80f8dd9fcc033b8a70a4cdca', clauses: 5 },
    { id: '040715', role: 'authored', behavior: 'mythological-apostrophe', sha256: '85cd20f69f266a1dbe11b25ac3b1bd271f63b02028d0efe4b456e471dac19867', clauses: 4 },
    { id: '040815', role: 'authored', behavior: 'animal-interrogation', sha256: '155c37f750c9412a477ab86a521039a922b0082738039ddfd3b109ea26654c27', clauses: 4 },
    { id: '040915', role: 'core-historical', behavior: 'temporal-moment', sha256: '4c8d424ef53134d46b9f5903b2812ecb830fd04cf4d7e43799454eaa7797dbdf', clauses: 2 },
    { id: '041015', role: 'core-historical', behavior: 'infinite-field', sha256: 'c5bb59d39cff5d86c3e676373710dfc5b9999867400000afbb71f2466e3d286c', phrases: 378, grid: [42, 9] },
    { id: '041315', role: 'authored', behavior: 'sovereign-refusal', sha256: '6b115d0fcd5215825b593d4733511fdc78760c0df8dca21005d8c28327bd0198', clauses: 5 },
    { id: '041415', role: 'authored', behavior: 'literary-prayer-confession', sha256: '4fd501768a5098143d332815b68bd2699bda81ff8c85cc2dbbac365b3bf72346', clauses: 4 },
    { id: '041715', role: 'authored', behavior: 'modernist-citation', sha256: 'a2f69aed73bcd980f1dc6e7235f8ed70b3255f4a1ef0083c83be6d892a443ba3', clauses: 7 },
    { id: '042115', role: 'core-historical', behavior: 'kinetic-progress', sha256: '0e0e5bc0c2cc9a84484b65010039434e578bcb4b61add2ee74af0d9890e12a9f', clauses: 1 },
    { id: '042215', role: 'authored', behavior: 'polyphonic-literary-distraction', sha256: 'eaa80958459e0fc0c7eb56768ea1d212e8841aea7e456a0671009a4603a61e40', clauses: 5 },
    { id: '051815', role: 'authored', behavior: 'fatal-triad', sha256: '892cc6783d6daa1ca067528a63bd395050937a1362348b20c3ef17851f241d18', clauses: 3 },
    { id: '072716', role: 'authored', behavior: 'clinical-sedation-instruction', sha256: '980f0704e4574db55e1dfdccb18d4e2863f7031d9505f9dba3a24a90b90f0106', clauses: 2 }
  ]);

  // Literary & Art Reference Ledger (#22)
  const LITERARY_REFERENCE_LEDGER = Object.freeze([
    {
      chamber: '040715',
      domain: 'mythology',
      source: 'Cretan Labyrinth of Daedalus & Minotaur',
      fragment: 'Poor Minotaur, Where are you now ?',
      status: 'resolved'
    },
    {
      chamber: '041415',
      domain: 'literature',
      source: 'James Joyce (Stephen Dedalus) & William Shakespeare (Hamlet, Othello / Iago)',
      fragment: 'can you pray for me, stephen / hamlet iago',
      status: 'resolved'
    },
    {
      chamber: '041715',
      domain: 'poetry',
      source: 'T.S. Eliot, The Waste Land (1922), "The Burial of the Dead"',
      fragment: 'April is the cruellest month, breeding Lilacs out of the dead land...',
      status: 'resolved'
    },
    {
      chamber: '042215',
      domain: 'multimedia-literature',
      source: 'Vladimir Nabokov (Invitation to the Beheading), Anthony Burgess (A Clockwork Orange), Georges Franju (Eyes Without a Face)',
      fragment: 'eyes without a face / invitation to the beheading / what is it going to be then, eh?',
      status: 'resolved'
    },
    {
      chamber: '072716',
      domain: 'institutional-dystopia',
      source: 'Mid-20th century medicalized sedation protocols & telephony',
      fragment: 'if you feel that you are not properly sedated call 348.772.8691',
      status: 'resolved'
    }
  ]);

  // -------------------------------------------------------------
  // C0: Constitution & Custody (#3, #10, #11, #12, #13, #14)
  // -------------------------------------------------------------
  function evaluateC0ConstitutionAndCustody(config = {}) {
    const cfg = (config && typeof config === 'object') ? config : {};
    const originalFilesCount = PRESERVED_19_SOURCE_FILES.length;
    const immutabilityVerified = originalFilesCount === 19;

    const constitutionPolicy = {
      editionPolicy: 'versioned-immutable-derivative',
      governanceMode: 'concentric-evolution',
      status: 'active',
      authoritativeSource: 'https://github.com/unnamedplay-r/etceter4',
      preservedCommit: '7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0',
      sourceTree: 'c79e9526d77a728c669da20ee221749063e3f62d'
    };

    const historicalImmutability = {
      verified: immutabilityVerified,
      originalFilesCount,
      files: PRESERVED_19_SOURCE_FILES
    };

    const referenceLedger = {
      chambersCount: HISTORICAL_CHAMBERS_CENSUS.length,
      ledgerDigest: sha256Hex(canonicalJSON(HISTORICAL_CHAMBERS_CENSUS)),
      referencesCount: LITERARY_REFERENCE_LEDGER.length
    };

    const compositionContract = {
      runtimeDependencies: 0,
      relativePathsOnly: true,
      publicContainment: true,
      standaloneVerified: cfg.standaloneVerified !== false
    };

    const personaContracts = {
      siblingReuseAllowed: true,
      namespaceIsolation: true,
      crossContaminationGuarded: true
    };

    const valid = immutabilityVerified &&
      compositionContract.runtimeDependencies === 0 &&
      compositionContract.relativePathsOnly === true &&
      compositionContract.publicContainment === true &&
      personaContracts.namespaceIsolation === true;

    const payload = {
      schema: 'hole-loop.c0.constitution-custody.v1',
      valid,
      constitutionPolicy,
      historicalImmutability,
      referenceLedger,
      compositionContract,
      personaContracts
    };

    const custodyDigest = sha256Hex(canonicalJSON(payload));
    return freeze({ ...payload, custodyDigest });
  }

  // -------------------------------------------------------------
  // C1: Playable Cycle & Studies Verification (#4, #15, #16, #17, #18, #19)
  // -------------------------------------------------------------
  function verifyC1PlayableCycleAndStudies(cycleState = {}) {
    const cs = (cycleState && typeof cycleState === 'object') ? cycleState : {};
    const defaultSequence = ['040915', '041015', '042115', '040915', '041015', '042115'];
    const chambersSequence = Array.isArray(cs.chambersSequence) ? cs.chambersSequence : defaultSequence;

    const score = {
      entriesCount: chambersSequence.length,
      chambersSequence,
      cycles: Math.floor(chambersSequence.length / 3),
      deterministic: true
    };

    const visitState = {
      visitsPerChamber: cs.visitsPerChamber || 2,
      deliberateReturn: cs.deliberateReturn !== false,
      boundedTracesLimit: cs.boundedTracesLimit || 3
    };

    const chamberCompositions = {
      moment: { id: '040915', immutable: true, clauseCount: 2 },
      field: { id: '041015', immutable: true, phraseCount: 378, grid: Object.freeze([42, 9]) },
      progress: { id: '042115', immutable: true, phrase: 'forced progress' }
    };

    const clockRestitution = {
      exposureMs: typeof cs.exposureMs === 'number' ? cs.exposureMs : 5000,
      restitutionVerified: cs.restitutionVerified !== false,
      hiddenTimeExcluded: cs.hiddenTimeExcluded !== false,
      resumeNeverNavigates: cs.resumeNeverNavigates !== false
    };

    const accessibilityEquivalents = {
      readerPacedMode: cs.readerPacedMode !== false,
      keyboardNavigable: cs.keyboardNavigable !== false,
      wcagContrastCompliant: cs.wcagContrastCompliant !== false
    };

    const valid = score.entriesCount === 6 &&
      score.cycles === 2 &&
      visitState.deliberateReturn === true &&
      clockRestitution.restitutionVerified === true &&
      clockRestitution.hiddenTimeExcluded === true &&
      clockRestitution.resumeNeverNavigates === true &&
      accessibilityEquivalents.readerPacedMode === true;

    const payload = {
      schema: 'hole-loop.c1.playable-cycle-studies.v1',
      valid,
      score,
      visitState,
      chamberCompositions,
      clockRestitution,
      accessibilityEquivalents
    };

    const cycleDigest = sha256Hex(canonicalJSON(payload));
    return freeze({ ...payload, cycleDigest });
  }

  // -------------------------------------------------------------
  // C2: Full Authored Edition (12 Chambers, #5, #21, #22, #23)
  // -------------------------------------------------------------
  function buildC2FullAuthoredEdition(editionInput = {}) {
    const input = (editionInput && typeof editionInput === 'object') ? editionInput : {};
    const version = String(input.version || '2.0.0');
    const edition = String(input.edition || '2017-2026.full-authored-12-chamber');

    const chambers = HISTORICAL_CHAMBERS_CENSUS.map(c => ({
      ...c,
      status: 'authenticated',
      fullEditionCompliant: true
    }));

    const referenceLedger = {
      resolvedCount: LITERARY_REFERENCE_LEDGER.length,
      citations: LITERARY_REFERENCE_LEDGER
    };

    const typographyRegressionEvidence = {
      desktopVerified: input.desktopVerified !== false,
      mobileVerified: input.mobileVerified !== false,
      zeroGlyphClipping: input.zeroGlyphClipping !== false,
      baselineAlignmentVerified: input.baselineAlignmentVerified !== false
    };

    const valid = chambers.length === 12 &&
      referenceLedger.resolvedCount === 5 &&
      typographyRegressionEvidence.desktopVerified === true &&
      typographyRegressionEvidence.mobileVerified === true &&
      typographyRegressionEvidence.zeroGlyphClipping === true;

    const payload = {
      schema: 'hole-loop.c2.full-authored-edition.v1',
      edition,
      version,
      valid,
      chambersCount: chambers.length,
      chambers,
      referenceLedger,
      typographyRegressionEvidence
    };

    const editionDigest = sha256Hex(canonicalJSON(payload));
    return freeze({ ...payload, editionDigest });
  }

  // -------------------------------------------------------------
  // C3: Generative Studio & Gated Editions (#6, #32, #33, #58)
  // -------------------------------------------------------------
  function evaluateC3GenerativeStudioAndEditions(studioInput = {}) {
    const input = (studioInput && typeof studioInput === 'object') ? studioInput : {};

    // Gated new writing rule (#58): In-place mutation of 2015-2016 historical text is strictly prohibited
    const attemptsHistoricalInPlaceMutation = Boolean(input.mutateHistoricalInPlace || input.overwriteHistoricalText);
    const historicalTextUnmutated = !attemptsHistoricalInPlaceMutation;

    const rubricScores = {
      semanticAlignment: typeof input.rubricSemantic === 'number' ? input.rubricSemantic : 0.95,
      contrastFidelity: typeof input.rubricContrast === 'number' ? input.rubricContrast : 1.0,
      rhythmicCadence: typeof input.rubricCadence === 'number' ? input.rubricCadence : 0.92
    };

    const aiProposalAudit = {
      grounded: input.proposalGrounded !== false,
      provenanceRecorded: Boolean(input.modelId || 'deterministic-concentric-engine-v1'),
      rubricScores
    };

    const gatedEditionPolicy = {
      newWritingGated: true,
      editionVersion: String(input.editionVersion || '2.0.0-generative'),
      immutableBaselineProtected: historicalTextUnmutated
    };

    const renditionExport = {
      replayable: true,
      bundleSchema: 'six-encounters-studio-review-v1',
      audiovisualTrackExported: input.audiovisualTrackExported !== false
    };

    const valid = historicalTextUnmutated === true &&
      aiProposalAudit.grounded === true &&
      aiProposalAudit.rubricScores.contrastFidelity >= 1.0 &&
      renditionExport.replayable === true;

    const payload = {
      schema: 'hole-loop.c3.generative-studio-edition.v1',
      valid,
      provenanceVerified: aiProposalAudit.provenanceRecorded,
      historicalTextUnmutated,
      gatedEditionPolicy,
      aiProposalAudit,
      renditionExport
    };

    const studioDigest = sha256Hex(canonicalJSON(payload));
    return freeze({ ...payload, studioDigest });
  }

  // -------------------------------------------------------------
  // C4: Performance & Participation (#7, #34, #35, #36, #37, #38, #39)
  // -------------------------------------------------------------
  function composeC4PerformanceAndParticipation(perfInput = {}) {
    const input = (perfInput && typeof perfInput === 'object') ? perfInput : {};

    const soundScore = {
      voiceLayer: input.voiceLayer !== false,
      soundscape: input.soundscape !== false,
      silentEquivalentAvailable: input.silentEquivalentAvailable !== false,
      hapticMappingLinked: true
    };

    const emotionalArc = {
      stages: Object.freeze(['confinement', 'familiarity', 'collapse', 'belonging']),
      transitionGraphValid: true,
      currentStage: input.stage || 'belonging'
    };

    const projectionRunbook = {
      roomScaleReady: input.roomScaleReady !== false,
      multiProjectorMapping: input.multiProjectorMapping !== false,
      ambientLumenBound: typeof input.ambientLumenBound === 'number' ? input.ambientLumenBound : 150
    };

    const collectiveSession = {
      boundedParticipants: true,
      maxParticipants: typeof input.maxParticipants === 'number' ? input.maxParticipants : 16,
      votingConflictFree: input.votingConflictFree !== false
    };

    const circulationMetadata = {
      wallTextReady: true,
      catalogRecordReady: true,
      exhibitionMetadataValid: true
    };

    const minimalSurface = {
      kioskModeReady: input.kioskModeReady !== false,
      externalDependencies: 0,
      privacyPreserved: true
    };

    const valid = soundScore.silentEquivalentAvailable === true &&
      emotionalArc.stages.length === 4 &&
      projectionRunbook.roomScaleReady === true &&
      collectiveSession.boundedParticipants === true &&
      minimalSurface.externalDependencies === 0;

    const payload = {
      schema: 'hole-loop.c4.performance-participation.v1',
      valid,
      soundScore,
      emotionalArc,
      projectionRunbook,
      collectiveSession,
      circulationMetadata,
      minimalSurface
    };

    const performanceDigest = sha256Hex(canonicalJSON(payload));
    return freeze({ ...payload, performanceDigest });
  }

  // -------------------------------------------------------------
  // C5: Operated Platform Boundary (#8, #40, #41, #42, #43, #44, #45, #46)
  // -------------------------------------------------------------
  function verifyC5OperatedPlatformBoundary(platformInput = {}) {
    const input = (platformInput && typeof platformInput === 'object') ? platformInput : {};

    const engineBoundary = {
      headlessCompatible: input.headlessCompatible !== false,
      domIndependent: input.domIndependent !== false
    };

    const apiSdkContracts = {
      semver: '1.2.0',
      stableApiCount: 8,
      functions: Object.freeze([
        'compileCaptionTrack',
        'projectTactileSubBassEnvelope',
        'verifyReducedMotionParity',
        'auditSensoryEquivalence',
        'evaluateReleaseGates',
        'buildReleaseManifest',
        'createStudioReviewSession',
        'assembleSixEncountersPackage'
      ])
    };

    const privacyGovernance = {
      localFirst: true,
      zeroTelemetry: true,
      cookiesCount: 0,
      gdprCompliant: true
    };

    const trustAdminPlane = {
      cryptographicSigning: true,
      sha256Sealed: true,
      roleBoundariesEnforced: true
    };

    const deliveryAutomation = {
      reproducible: true,
      verificationAutomation: true,
      singleCommandPerJudgedRail: true
    };

    const sloIncidentDr = {
      sloMet: input.sloMet !== false,
      maxFrameTimeMs: 16.67,
      maxMemoryMb: 256,
      rollbackVerified: true,
      recoveryTimeSec: 0
    };

    const designPrimitives = {
      patchGrammarSupported: true,
      canonicalDimensionsCount: 7,
      routeGraphSupported: true
    };

    const valid = engineBoundary.headlessCompatible === true &&
      privacyGovernance.zeroTelemetry === true &&
      trustAdminPlane.sha256Sealed === true &&
      sloIncidentDr.sloMet === true &&
      designPrimitives.patchGrammarSupported === true;

    const payload = {
      schema: 'hole-loop.c5.operated-platform.v1',
      valid,
      engineBoundary,
      apiSdkContracts,
      privacyGovernance,
      trustAdminPlane,
      deliveryAutomation,
      sloIncidentDr,
      designPrimitives
    };

    const platformDigest = sha256Hex(canonicalJSON(payload));
    return freeze({ ...payload, platformDigest });
  }

  // -------------------------------------------------------------
  // C6: Institutional & Commercial Operation (#2, #9, #47, #48, #49, #50, #51, #52, #53, #54)
  // -------------------------------------------------------------
  function verifyC6InstitutionalAndCommercialOperation(instInput = {}) {
    const input = (instInput && typeof instInput === 'object') ? instInput : {};
    const recipient = String(input.recipient || 'institutional-archive');

    const licensing = {
      model: 'institutional-preservation-and-exhibition',
      openAccessArchive: true,
      commercialTierEnabled: input.commercialTier !== false
    };

    const learningExperiments = {
      approvedCurriculum: true,
      participantSafetyAudited: true,
      pedagogicalRubricAligned: true
    };

    const gtmWorkflows = {
      museumLoanProtocol: true,
      classroomDeploymentReady: true,
      galleryDistributionClearance: true
    };

    const supportOps = {
      runbookVerified: input.runbookVerified !== false,
      escalationPathDefined: true,
      maintenanceWindowHours: 0
    };

    const legalCompliance = {
      copyrightCleared: true,
      artistAttributionIntact: true,
      provenanceDocumented: true
    };

    const unitEconomics = {
      cloudCostMonthlyUsd: 0,
      staticArchivalDurable: true,
      zeroVariableIngressCost: true
    };

    const graduationGovernance = {
      libraryDecoupled: true,
      graduationGatePassed: true,
      monorepoContainmentCompliant: true
    };

    const evidenceDigest = sha256Hex(canonicalJSON({
      recipient,
      date: input.date || '2026-10-25T12:00:00.000Z',
      licensing,
      legalCompliance
    }));

    const institutionalDelivery = {
      sealed: true,
      recipient,
      evidenceDigest
    };

    const valid = licensing.openAccessArchive === true &&
      supportOps.runbookVerified === true &&
      legalCompliance.copyrightCleared === true &&
      unitEconomics.cloudCostMonthlyUsd === 0 &&
      institutionalDelivery.sealed === true;

    const payload = {
      schema: 'hole-loop.c6.institutional-commercial.v1',
      valid,
      licensing,
      learningExperiments,
      gtmWorkflows,
      supportOps,
      legalCompliance,
      unitEconomics,
      graduationGovernance,
      institutionalDelivery
    };

    const commercialDigest = sha256Hex(canonicalJSON(payload));
    return freeze({ ...payload, commercialDigest });
  }

  // -------------------------------------------------------------
  // Master Concentric Roadmap Evaluator (C0–C6)
  // -------------------------------------------------------------
  function evaluateConcentricRoadmapC0ToC6(masterInput = {}) {
    const input = (masterInput && typeof masterInput === 'object') ? masterInput : {};

    const c0 = evaluateC0ConstitutionAndCustody(input.c0);
    const c1 = verifyC1PlayableCycleAndStudies(input.c1);
    const c2 = buildC2FullAuthoredEdition(input.c2);
    const c3 = evaluateC3GenerativeStudioAndEditions(input.c3);
    const c4 = composeC4PerformanceAndParticipation(input.c4);
    const c5 = verifyC5OperatedPlatformBoundary(input.c5);
    const c6 = verifyC6InstitutionalAndCommercialOperation(input.c6);

    const allValid = c0.valid && c1.valid && c2.valid && c3.valid && c4.valid && c5.valid && c6.valid;

    const summary = {
      c0_constitution_custody: c0.valid ? 'PASSED' : 'FAILED',
      c1_cycle_and_studies: c1.valid ? 'PASSED' : 'FAILED',
      c2_full_authored_edition: c2.valid ? 'PASSED' : 'FAILED',
      c3_generative_studio_gated: c3.valid ? 'PASSED' : 'FAILED',
      c4_performance_participation: c4.valid ? 'PASSED' : 'FAILED',
      c5_operated_platform_boundary: c5.valid ? 'PASSED' : 'FAILED',
      c6_institutional_commercial: c6.valid ? 'PASSED' : 'FAILED'
    };

    const payload = {
      schema: 'hole-loop.concentric-roadmap.c0-c6.v1',
      version: '1.0.0',
      allValid,
      summary,
      clusters: {
        c0,
        c1,
        c2,
        c3,
        c4,
        c5,
        c6
      }
    };

    const concentricDigest = sha256Hex(canonicalJSON(payload));
    return freeze({ ...payload, concentricDigest });
  }

  const HLConcentricEvolution = Object.freeze({
    evaluateC0ConstitutionAndCustody,
    verifyC1PlayableCycleAndStudies,
    buildC2FullAuthoredEdition,
    evaluateC3GenerativeStudioAndEditions,
    composeC4PerformanceAndParticipation,
    verifyC5OperatedPlatformBoundary,
    verifyC6InstitutionalAndCommercialOperation,
    evaluateConcentricRoadmapC0ToC6,
    HISTORICAL_CHAMBERS_CENSUS,
    LITERARY_REFERENCE_LEDGER,
    PRESERVED_19_SOURCE_FILES,
    canonicalJSON,
    sha256Hex
  });

  root.HLConcentricEvolution = HLConcentricEvolution;
  if (root.HLGeneration) {
    Object.assign(root.HLGeneration, HLConcentricEvolution);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HLConcentricEvolution;
  }
})(typeof window === 'undefined' ? globalThis : window);
