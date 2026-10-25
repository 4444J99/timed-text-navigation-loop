const { test } = require('node:test');
const assert = require('node:assert/strict');

const G = require('../generation.js');
const SA = require('../sensory-accessibility.js');

// -------------------------------------------------------------
// Cluster 4: Module Export & Re-Export Verification
// -------------------------------------------------------------
test('HLSensoryAccessibility functions are re-exported on HLGeneration', () => {
  assert.equal(typeof SA.compileCaptionTrack, 'function');
  assert.equal(typeof SA.projectTactileSubBassEnvelope, 'function');
  assert.equal(typeof SA.verifyReducedMotionParity, 'function');
  assert.equal(typeof SA.auditSensoryEquivalence, 'function');

  assert.equal(G.compileCaptionTrack, SA.compileCaptionTrack);
  assert.equal(G.projectTactileSubBassEnvelope, SA.projectTactileSubBassEnvelope);
  assert.equal(G.verifyReducedMotionParity, SA.verifyReducedMotionParity);
  assert.equal(G.auditSensoryEquivalence, SA.auditSensoryEquivalence);
});

// -------------------------------------------------------------
// C4-1: Issue C4-1 — Timed Caption Track Compilation & Reading Speed Bounds
// -------------------------------------------------------------
test('compileCaptionTrack enforces reading-speed bounds (<= 18 cps) and minimum cue duration (>= 1.2s)', () => {
  const timedTextNodes = [
    { id: 'c-1', text: 'hi', startTime: 0 }, // Very short text: 2 chars
    { id: 'c-2', text: 'where i end and u begin across the field of light', startTime: 0.5 }, // 48 chars
    { id: 'c-3', text: 'loop', startTime: 1.0 } // 4 chars
  ];

  const track = SA.compileCaptionTrack([], timedTextNodes, {
    charsPerSecond: 18,
    minDurationSec: 1.2,
    gapSec: 0.05
  });

  assert.equal(track.cues.length, 3);
  assert.equal(track.stats.nonOverlapping, true);
  assert.equal(track.stats.readingSpeedCompliant, true);
  assert.equal(track.stats.minDurationCompliant, true);

  // Cue 1: 'hi' (2 chars) -> bounded by minDurationSec >= 1.2s
  assert.ok(track.cues[0].duration >= 1.2);
  assert.ok(track.cues[0].charsPerSecond <= 18);
  assert.equal(track.cues[0].startTime, 0);
  assert.equal(track.cues[0].endTime, track.cues[0].startTime + track.cues[0].duration);

  // Cue 2: 'where i end and u begin across the field of light' (49 chars)
  // At 18 cps, requires at least 49 / 18 = 2.72s
  assert.ok(track.cues[1].duration >= 2.7);
  assert.ok(track.cues[1].charsPerSecond <= 18.01);
  assert.ok(track.cues[1].startTime >= track.cues[0].endTime);

  // Cue 3: non-overlapping and bounded
  assert.ok(track.cues[2].startTime >= track.cues[1].endTime);
  assert.ok(track.cues[2].duration >= 1.2);
  assert.ok(track.cues[2].charsPerSecond <= 18);

  // Non-overlapping check across entire track
  for (let i = 1; i < track.cues.length; i++) {
    assert.ok(track.cues[i].startTime >= track.cues[i - 1].endTime);
  }
});

test('compileCaptionTrack compiles deterministic WebVTT output', () => {
  const nodes = [
    { text: 'where i end', startTime: 0 },
    { text: 'and u begin', startTime: 1.5 }
  ];

  const trackA = SA.compileCaptionTrack([], nodes);
  const trackB = SA.compileCaptionTrack([], nodes);

  assert.equal(trackA.vtt, trackB.vtt);
  assert.ok(trackA.vtt.startsWith('WEBVTT\n\n'));
  assert.ok(trackA.vtt.includes('00:00:00.000 --> 00:00:01.200'));
  assert.ok(trackA.vtt.includes('where i end'));
  assert.ok(trackA.vtt.includes('and u begin'));
  assert.equal(trackA.toWebVTT(), trackA.vtt);
});

// -------------------------------------------------------------
// C4-2: Issue C4-2 — Tactile Sub-Bass Envelope & Safety Limiter
// -------------------------------------------------------------
test('projectTactileSubBassEnvelope clamps frequencies to 20-80 Hz and enforces peak and RMS safety limits', () => {
  const encounterState = {
    chamber: '040915',
    dwellTime: 4000,
    visit: 2
  };

  // Provide extreme input audio events: out-of-range frequencies (10Hz and 140Hz) and high amplitude
  const audioEvents = [
    { id: 'snd-1', timeMs: 0, durationMs: 150, frequency: 10, intensity: 1.5 },   // Sub-audible < 20Hz, overdriven
    { id: 'snd-2', timeMs: 400, durationMs: 200, frequency: 140, intensity: 1.8 }  // Higher freq > 80Hz, overdriven
  ];

  const env = SA.projectTactileSubBassEnvelope(encounterState, audioEvents, {
    peakLimit: 0.85,
    rmsLimit: 0.707
  });

  assert.equal(env.chamber, '040915');
  assert.deepEqual(env.frequencyRange, [20, 80]);
  assert.equal(env.isSafeForDeafAudiences, true);

  // Frequency clamping check: 10Hz -> 20Hz, 140Hz -> 80Hz
  assert.equal(env.pulses[0].frequencyHz, 20);
  assert.equal(env.pulses[1].frequencyHz, 80);

  // Peak limit check: no pulse amplitude exceeds peakLimit
  for (const pulse of env.pulses) {
    assert.ok(pulse.amplitude <= 0.85);
  }
  assert.ok(env.peakAmplitude <= 0.85);

  // RMS safety limit check
  assert.ok(env.rms <= 0.707);
  assert.equal(env.safetyLimited, true);

  // Vibration pattern check: alternating vibration and pause durations
  assert.ok(Array.isArray(env.vibrationPatternMs));
  assert.equal(env.vibrationPatternMs.length, 3); // pulse1 (150ms), gap (250ms), pulse2 (200ms)
  assert.equal(env.vibrationPatternMs[0], 150);
  assert.equal(env.vibrationPatternMs[1], 250);
  assert.equal(env.vibrationPatternMs[2], 200);
});

test('projectTactileSubBassEnvelope maps chamber resonance when audioEvents omitted', () => {
  const envMoment = SA.projectTactileSubBassEnvelope({ chamber: '040915', dwellTime: 3000, visit: 1 });
  const envField = SA.projectTactileSubBassEnvelope({ chamber: '041015', dwellTime: 3000, visit: 1 });
  const envProgress = SA.projectTactileSubBassEnvelope({ chamber: '042115', dwellTime: 3000, visit: 1 });

  assert.ok(envMoment.pulses[0].frequencyHz >= 20 && envMoment.pulses[0].frequencyHz <= 40);
  assert.ok(envField.pulses[0].frequencyHz >= 40 && envField.pulses[0].frequencyHz <= 60);
  assert.ok(envProgress.pulses[0].frequencyHz >= 60 && envProgress.pulses[0].frequencyHz <= 80);

  assert.ok(envMoment.pulses.length >= 2);
  assert.ok(envMoment.vibrationPatternMs.length >= 3);
});

// -------------------------------------------------------------
// C4-3: Issue C4-3 — Reduced Motion Parity & Zero Vestibular Triggers
// -------------------------------------------------------------
test('verifyReducedMotionParity transforms 3D spatial layer into zero-vestibular static/crossfade layout', () => {
  const sourceSpatialLayer = G.composeSpatialPoetryLayer([], {
    poeticInstructions: [
      'first poetic horizon',
      'second spatial inflection',
      'third tactile resolution'
    ]
  }, {
    width: 1200,
    height: 800,
    background: '#000000',
    color: '#00ffff'
  });

  // Source spatial layer has non-zero 3D z-depth
  assert.ok(sourceSpatialLayer.nodes[1].z > 0);
  const originalLinearText = sourceSpatialLayer.reversibleToLinearText();

  // Apply reduced motion parity verification
  const reducedLayer = SA.verifyReducedMotionParity(sourceSpatialLayer, {
    prefersReducedMotion: true,
    transitionMode: 'crossfade'
  });

  assert.equal(reducedLayer.reducedMotionApplied, true);
  assert.equal(reducedLayer.vestibularSafe, true);
  assert.equal(reducedLayer.corridor.vestibularSafe, true);
  assert.equal(reducedLayer.corridor.motionFree, true);

  // Parity checks
  assert.equal(reducedLayer.parity.orderPreserved, true);
  assert.equal(reducedLayer.parity.textPreserved, true);
  assert.equal(reducedLayer.parity.annotationsPreserved, true);
  assert.equal(reducedLayer.parity.linkCountPreserved, true);
  assert.equal(reducedLayer.parity.semanticParityRatio, 1.0);

  // All 3D coordinates flattened to 0 and transforms neutral
  for (const node of reducedLayer.nodes) {
    assert.equal(node.z, 0);
    assert.equal(node.vestibularTrigger, false);
    assert.equal(node.style.transform, 'none');
    assert.equal(node.style.perspective, 'none');
    assert.equal(node.style.animation, 'none');
    assert.ok(node.style.transition.includes('opacity'));
  }

  // Exact linear reading order preservation
  assert.equal(reducedLayer.reversibleToLinearText(), originalLinearText);
});

// -------------------------------------------------------------
// C4-4: Issue C4-4 — Sensory Equivalence Audit (Cross-Modal Parity)
// -------------------------------------------------------------
test('auditSensoryEquivalence passes when captions, tactile pulses, and visual nodes are synchronized <= 50ms', () => {
  const textNodes = [
    { id: 'node-1', text: 'where i end', startTime: 0 },
    { id: 'node-2', text: 'and u begin', startTime: 1.5 }
  ];

  const captions = SA.compileCaptionTrack([], textNodes);

  // Synchronized tactile pulses matching caption start times exactly
  const tactile = SA.projectTactileSubBassEnvelope({ chamber: '040915' }, [
    { id: 'p-1', timeMs: 0, durationMs: 150, frequency: 32, intensity: 0.7 },
    { id: 'p-2', timeMs: 1520, durationMs: 150, frequency: 32, intensity: 0.7 } // 20ms delta <= 50ms tolerance
  ]);

  const spatialLayer = G.composeSpatialPoetryLayer([], {
    poeticInstructions: ['where i end', 'and u begin']
  });
  const visual = SA.verifyReducedMotionParity(spatialLayer, { prefersReducedMotion: true });

  const audit = SA.auditSensoryEquivalence(captions, tactile, visual, { toleranceMs: 50 });

  assert.equal(audit.equivalent, true);
  assert.equal(audit.violations.length, 0);
  assert.ok(audit.maxDeltaMs <= 50);
  assert.equal(audit.coverage.sonicToCaptions, 1.0);
  assert.equal(audit.coverage.sonicToTactile, 1.0);
  assert.equal(audit.coverage.visualParity, 1.0);
  assert.ok(audit.summary.includes('PASSED'));
});

test('auditSensoryEquivalence detects sync drift, missing captions, and missing tactile events', () => {
  const textNodes = [
    { id: 'node-1', text: 'where i end', startTime: 0 }
  ];
  const captions = SA.compileCaptionTrack([], textNodes);

  // Tactile pulse with 90ms delta (exceeds 50ms tolerance)
  const driftingTactile = SA.projectTactileSubBassEnvelope({ chamber: '040915' }, [
    { id: 'p-drift', timeMs: 90, durationMs: 150, frequency: 32, intensity: 0.7 }
  ]);

  const spatialLayer = G.composeSpatialPoetryLayer([], { poeticInstructions: ['where i end'] });
  const visual = SA.verifyReducedMotionParity(spatialLayer, { prefersReducedMotion: true });

  const driftAudit = SA.auditSensoryEquivalence(captions, driftingTactile, visual, { toleranceMs: 50 });
  assert.equal(driftAudit.equivalent, false);
  assert.ok(driftAudit.violations.some(v => v.type === 'sync_drift'));
  assert.equal(driftAudit.maxDeltaMs, 90);

  // Missing tactile event
  const emptyTactile = { pulses: [] };
  const missingTactileAudit = SA.auditSensoryEquivalence(captions, emptyTactile, visual, { toleranceMs: 50 });
  assert.equal(missingTactileAudit.equivalent, false);
  assert.ok(missingTactileAudit.violations.some(v => v.type === 'missing_tactile'));

  // Missing visual node
  const emptyVisual = { nodes: [] };
  const alignedTactile = SA.projectTactileSubBassEnvelope({ chamber: '040915' }, [
    { id: 'p-1', timeMs: 0, durationMs: 150, frequency: 32, intensity: 0.7 }
  ]);
  const missingVisualAudit = SA.auditSensoryEquivalence(captions, alignedTactile, emptyVisual, { toleranceMs: 50 });
  assert.equal(missingVisualAudit.equivalent, false);
  assert.ok(missingVisualAudit.violations.some(v => v.type === 'missing_visual'));
});
