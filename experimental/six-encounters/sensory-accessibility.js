/* Sensory accessibility: Caption track compilation, tactile/sub-bass projection, reduced-motion parity, and cross-modal audit. */
(function(root) {
  function formatVttTimestamp(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const totalMs = Math.round(s * 1000);
    const ms = totalMs % 1000;
    const totalSecs = Math.floor(totalMs / 1000);
    const secs = totalSecs % 60;
    const mins = Math.floor(totalSecs / 60) % 60;
    const hrs = Math.floor(totalSecs / 3600);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  function clampFrequency(hz, min = 20, max = 80) {
    const n = Number(hz);
    if (!Number.isFinite(n) || n <= 0) return 40;
    if (n < min) return min;
    if (n > max) return max;
    return Math.round(n * 10) / 10;
  }

  // -------------------------------------------------------------
  // C4-1: compileCaptionTrack
  // -------------------------------------------------------------
  function compileCaptionTrack(routeHistory, timedTextNodes, options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const maxCps = typeof opts.charsPerSecond === 'number' && opts.charsPerSecond > 0
      ? opts.charsPerSecond
      : 18;
    const minDurationSec = typeof opts.minDurationSec === 'number'
      ? opts.minDurationSec
      : (typeof opts.minDurationMs === 'number' ? opts.minDurationMs / 1000 : 1.2);
    const gapSec = typeof opts.gapSec === 'number'
      ? opts.gapSec
      : (typeof opts.gapMs === 'number' ? opts.gapMs / 1000 : 0.05);

    let rawNodes = [];
    if (Array.isArray(timedTextNodes) && timedTextNodes.length > 0) {
      rawNodes = timedTextNodes;
    } else if (timedTextNodes && typeof timedTextNodes === 'object' && Array.isArray(timedTextNodes.nodes)) {
      rawNodes = timedTextNodes.nodes;
    } else if (Array.isArray(routeHistory) && routeHistory.length > 0) {
      rawNodes = routeHistory.map((h, i) => ({
        id: `route-node-${i}`,
        text: typeof h === 'string' ? h : (h.word || h.chamber || `encounter-${i}`),
        chamber: typeof h === 'object' ? h.chamber : undefined
      }));
    }

    let currentTime = typeof opts.startOffsetSec === 'number'
      ? opts.startOffsetSec
      : (typeof opts.startOffsetMs === 'number' ? opts.startOffsetMs / 1000 : 0.0);

    const cues = [];
    for (let i = 0; i < rawNodes.length; i++) {
      const node = rawNodes[i];
      const text = typeof node === 'string'
        ? node.trim()
        : String(node.text || node.word || node.instruction || node.id || `cue-${i + 1}`).trim();
      
      let reqStart = currentTime;
      if (node && typeof node === 'object') {
        if (typeof node.startTime === 'number' && Number.isFinite(node.startTime)) {
          reqStart = Math.max(currentTime, node.startTime);
        } else if (typeof node.startTimeMs === 'number' && Number.isFinite(node.startTimeMs)) {
          reqStart = Math.max(currentTime, node.startTimeMs / 1000);
        } else if (typeof node.timeMs === 'number' && Number.isFinite(node.timeMs)) {
          reqStart = Math.max(currentTime, node.timeMs / 1000);
        }
      }

      // Reading speed requirement: chars / duration <= maxCps => duration >= chars / maxCps
      const textLen = text.length || 1;
      const readingDuration = textLen / maxCps;
      let duration = Math.max(minDurationSec, readingDuration);

      if (node && typeof node === 'object') {
        let userDuration = 0;
        if (typeof node.duration === 'number' && node.duration > 0) {
          userDuration = node.duration;
        } else if (typeof node.durationMs === 'number' && node.durationMs > 0) {
          userDuration = node.durationMs / 1000;
        } else if (typeof node.endTime === 'number' && node.endTime > reqStart) {
          userDuration = node.endTime - reqStart;
        } else if (typeof node.endTimeMs === 'number' && node.endTimeMs / 1000 > reqStart) {
          userDuration = (node.endTimeMs / 1000) - reqStart;
        }
        if (userDuration > duration) {
          duration = userDuration;
        }
      }

      const startTime = Math.round(reqStart * 1000) / 1000;
      const endTime = Math.round((startTime + duration) * 1000) / 1000;
      const actualDuration = Math.round((endTime - startTime) * 1000) / 1000;
      const charsPerSecond = Math.round((textLen / actualDuration) * 100) / 100;

      const cue = {
        id: (node && typeof node === 'object' && node.id) ? String(node.id) : `cue-${i + 1}`,
        index: i,
        startTime,
        endTime,
        startTimeMs: Math.round(startTime * 1000),
        endTimeMs: Math.round(endTime * 1000),
        duration: actualDuration,
        text,
        charsPerSecond,
        nodeId: (node && typeof node === 'object' && node.id) ? String(node.id) : null,
        chamber: (node && typeof node === 'object' && node.chamber)
          ? node.chamber
          : (Array.isArray(routeHistory) && routeHistory[i]?.chamber ? routeHistory[i].chamber : null)
      };

      cues.push(Object.freeze(cue));
      currentTime = Math.round((endTime + gapSec) * 1000) / 1000;
    }

    let vtt = 'WEBVTT\n\n';
    cues.forEach((c, idx) => {
      vtt += `${idx + 1}\n${formatVttTimestamp(c.startTime)} --> ${formatVttTimestamp(c.endTime)}\n${c.text}\n\n`;
    });

    const nonOverlapping = cues.every((c, i) => i === 0 || c.startTime >= cues[i - 1].endTime);
    const readingSpeedCompliant = cues.every(c => c.charsPerSecond <= maxCps + 0.01);
    const minDurationCompliant = cues.every(c => c.duration >= minDurationSec - 0.001);

    const stats = Object.freeze({
      cueCount: cues.length,
      totalDuration: cues.length ? cues[cues.length - 1].endTime : 0,
      maxCharsPerSecond: cues.length ? Math.max(...cues.map(c => c.charsPerSecond)) : 0,
      minCueDuration: cues.length ? Math.min(...cues.map(c => c.duration)) : 0,
      nonOverlapping,
      readingSpeedCompliant,
      minDurationCompliant
    });

    return Object.freeze({
      schema: 'six-encounters-caption-track-v1',
      cues: Object.freeze(cues),
      vtt: vtt.trim() + '\n',
      stats,
      toWebVTT() {
        return this.vtt;
      }
    });
  }

  // -------------------------------------------------------------
  // C4-2: projectTactileSubBassEnvelope
  // -------------------------------------------------------------
  const CHAMBER_SUB_BASS_MAP = Object.freeze({
    '040915': { fundamentalHz: 32, resonance: 'moment-sub-well' },
    '041015': { fundamentalHz: 48, resonance: 'field-harmonic-grid' },
    '042115': { fundamentalHz: 64, resonance: 'progress-shear-pulse' }
  });

  function projectTactileSubBassEnvelope(encounterState, audioEvents, options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const chamberId = String(encounterState?.chamber || '040915');
    const chamberConfig = CHAMBER_SUB_BASS_MAP[chamberId] || { fundamentalHz: 40, resonance: 'generic-chamber' };

    const peakLimit = typeof opts.peakLimit === 'number' && opts.peakLimit > 0
      ? Math.min(1.0, opts.peakLimit)
      : 0.85;
    const rmsLimit = typeof opts.rmsLimit === 'number' && opts.rmsLimit > 0
      ? Math.min(1.0, opts.rmsLimit)
      : 0.707;
    const freqMin = 20;
    const freqMax = 80;

    let rawEvents = [];
    if (Array.isArray(audioEvents) && audioEvents.length > 0) {
      rawEvents = audioEvents;
    } else {
      // Synthesize cadence events from encounterState dwell and visits
      const dwell = Math.max(1000, Number(encounterState?.dwellTime || encounterState?.elapsed || 3000));
      const visits = Math.max(1, Number(encounterState?.visit || 1));
      const pulseCount = Math.min(6, Math.max(2, visits + 1));
      const interval = Math.floor(dwell / pulseCount);
      for (let i = 0; i < pulseCount; i++) {
        rawEvents.push({
          timeMs: i * interval,
          durationMs: Math.min(300, Math.floor(interval * 0.4)),
          frequency: chamberConfig.fundamentalHz + (i % 2 === 0 ? 0 : 8),
          intensity: 0.6 + (i * 0.05),
          tag: `cadence-${i}`
        });
      }
    }

    // Build raw pulses with clamped frequency [20..80] Hz and peak limiting
    const intermediatePulses = rawEvents.map((ev, idx) => {
      const timeMs = Math.max(0, Math.round(ev.timeMs ?? (idx * 500)));
      const durationMs = Math.max(40, Math.round(ev.durationMs ?? 200));
      const freqInput = ev.frequency ?? ev.frequencyHz ?? chamberConfig.fundamentalHz;
      const frequencyHz = clampFrequency(freqInput, freqMin, freqMax);
      const rawAmp = Number(ev.intensity ?? ev.amplitude ?? 0.7);
      const amplitude = Math.min(peakLimit, Math.max(0.01, rawAmp));

      return {
        id: ev.id || `pulse-${idx + 1}`,
        timeMs,
        durationMs,
        frequencyHz,
        amplitude,
        resonance: ev.resonance || chamberConfig.resonance,
        tag: ev.tag || ev.type || 'tactile'
      };
    });

    intermediatePulses.sort((a, b) => a.timeMs - b.timeMs);

    // Calculate RMS across pulses
    let totalWeightedPower = 0;
    let totalDuration = 0;
    for (const p of intermediatePulses) {
      totalWeightedPower += (p.amplitude * p.amplitude) * p.durationMs;
      totalDuration += p.durationMs;
    }
    const initialRms = totalDuration > 0 ? Math.sqrt(totalWeightedPower / totalDuration) : 0;

    let safetyLimited = false;
    let attenuationRatio = 1.0;
    if (initialRms > rmsLimit && initialRms > 0) {
      safetyLimited = true;
      attenuationRatio = rmsLimit / initialRms;
    }

    const finalPulses = intermediatePulses.map(p => {
      const scaledAmp = safetyLimited
        ? Math.round(Math.min(peakLimit, p.amplitude * attenuationRatio) * 1000) / 1000
        : Math.round(p.amplitude * 1000) / 1000;
      return Object.freeze({
        ...p,
        amplitude: scaledAmp,
        tactileIntensity: scaledAmp
      });
    });

    // Recompute actual final RMS and peak
    let finalPower = 0;
    let finalPeak = 0;
    for (const p of finalPulses) {
      finalPower += (p.amplitude * p.amplitude) * p.durationMs;
      if (p.amplitude > finalPeak) finalPeak = p.amplitude;
    }
    const finalRms = totalDuration > 0 ? Math.sqrt(finalPower / totalDuration) : 0;

    // Vibration pattern for Web Vibration API (navigator.vibrate)
    // Alternating [vibrate, pause, vibrate, pause, ...]
    const vibrationPatternMs = [];
    for (let i = 0; i < finalPulses.length; i++) {
      const curr = finalPulses[i];
      vibrationPatternMs.push(curr.durationMs);
      if (i < finalPulses.length - 1) {
        const next = finalPulses[i + 1];
        const gap = Math.max(10, Math.round(next.timeMs - (curr.timeMs + curr.durationMs)));
        vibrationPatternMs.push(gap);
      }
    }

    return Object.freeze({
      schema: 'six-encounters-tactile-sub-bass-envelope-v1',
      chamber: chamberId,
      frequencyRange: Object.freeze([freqMin, freqMax]),
      peakLimit,
      rmsLimit,
      peakAmplitude: Math.round(finalPeak * 1000) / 1000,
      rms: Math.round(finalRms * 1000) / 1000,
      safetyLimited,
      vibrationPatternMs: Object.freeze(vibrationPatternMs),
      pulses: Object.freeze(finalPulses),
      isSafeForDeafAudiences: true
    });
  }

  // -------------------------------------------------------------
  // C4-3: verifyReducedMotionParity
  // -------------------------------------------------------------
  function verifyReducedMotionParity(spatialLayer, reducedMotionConfig = { prefersReducedMotion: true }) {
    if (!spatialLayer || typeof spatialLayer !== 'object') {
      throw new TypeError('spatialLayer must be a valid spatial poetry layer object');
    }
    const config = (reducedMotionConfig && typeof reducedMotionConfig === 'object')
      ? reducedMotionConfig
      : { prefersReducedMotion: true };
    const prefersReduced = config.prefersReducedMotion !== false;
    const transitionMode = config.transitionMode || 'crossfade';

    const sourceNodes = Array.isArray(spatialLayer.nodes) ? spatialLayer.nodes : [];

    if (!prefersReduced) {
      return Object.freeze({
        reducedMotionApplied: false,
        vestibularSafe: false,
        transitionMode: 'none',
        parity: Object.freeze({
          orderPreserved: true,
          textPreserved: true,
          annotationsPreserved: true,
          linkCountPreserved: true,
          semanticParityRatio: 1.0
        }),
        corridor: spatialLayer.corridor,
        nodes: sourceNodes,
        reversibleToLinearText() {
          return typeof spatialLayer.reversibleToLinearText === 'function'
            ? spatialLayer.reversibleToLinearText()
            : sourceNodes.map(n => n.text).join(' ');
        }
      });
    }

    // Zero-vestibular-trigger transformation
    const transformedNodes = sourceNodes.map(node => {
      const cloned = structuredClone(node);
      cloned.z = 0; // flatten 3D depth to zero
      cloned.vestibularTrigger = false;
      const originalStyle = (cloned.style && typeof cloned.style === 'object') ? cloned.style : {};

      cloned.style = {
        ...originalStyle,
        transform: 'none',
        perspective: 'none',
        animation: 'none',
        transition: transitionMode === 'static' ? 'none' : 'opacity 200ms ease-in-out'
      };

      return Object.freeze(cloned);
    });

    // Verify 100% semantic parity
    const originalTextSeq = sourceNodes.map(n => n.text);
    const transformedTextSeq = transformedNodes.map(n => n.text);
    const textPreserved = originalTextSeq.length === transformedTextSeq.length &&
      originalTextSeq.every((t, i) => t === transformedTextSeq[i]);

    const orderPreserved = transformedNodes.every((n, i) =>
      i === 0 || (n.orderIndex !== undefined ? n.orderIndex >= transformedNodes[i - 1].orderIndex : true)
    );

    const originalAnnotationCount = sourceNodes.reduce((acc, n) => acc + (n.annotations ? n.annotations.length : 0), 0);
    const transformedAnnotationCount = transformedNodes.reduce((acc, n) => acc + (n.annotations ? n.annotations.length : 0), 0);
    const annotationsPreserved = originalAnnotationCount === transformedAnnotationCount;

    const originalLinkCount = sourceNodes.filter(n => n.routeIndex !== undefined || n.target || n.link).length;
    const transformedLinkCount = transformedNodes.filter(n => n.routeIndex !== undefined || n.target || n.link).length;
    const linkCountPreserved = originalLinkCount === transformedLinkCount;

    const allParityChecks = [textPreserved, orderPreserved, annotationsPreserved, linkCountPreserved];
    const semanticParityRatio = allParityChecks.filter(Boolean).length / allParityChecks.length;

    const corridor = spatialLayer.corridor ? {
      ...spatialLayer.corridor,
      vestibularSafe: true,
      motionFree: true
    } : { vestibularSafe: true, motionFree: true };

    return Object.freeze({
      reducedMotionApplied: true,
      vestibularSafe: true,
      transitionMode,
      parity: Object.freeze({
        orderPreserved,
        textPreserved,
        annotationsPreserved,
        linkCountPreserved,
        semanticParityRatio
      }),
      corridor: Object.freeze(corridor),
      nodes: Object.freeze(transformedNodes),
      legibility: spatialLayer.legibility ? Object.freeze(structuredClone(spatialLayer.legibility)) : undefined,
      reversibleToLinearText() {
        return [...this.nodes].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)).map(n => n.text).join(' ');
      }
    });
  }

  // -------------------------------------------------------------
  // C4-4: auditSensoryEquivalence
  // -------------------------------------------------------------
  function auditSensoryEquivalence(captionTrack, tactileEnvelope, reducedMotionLayer, options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const toleranceMs = typeof opts.toleranceMs === 'number' && opts.toleranceMs > 0 ? opts.toleranceMs : 50;

    const cues = Array.isArray(captionTrack?.cues) ? captionTrack.cues : [];
    const pulses = Array.isArray(tactileEnvelope?.pulses) ? tactileEnvelope.pulses : [];
    const visualNodes = Array.isArray(reducedMotionLayer?.nodes) ? reducedMotionLayer.nodes : [];

    const violations = [];
    const deltas = [];

    // 1. Sonic / Tactile to Caption Sync Parity
    let matchedTactileCount = 0;
    for (const pulse of pulses) {
      const pulseTime = pulse.timeMs;
      // Find closest caption cue
      let minDelta = Infinity;
      let closestCue = null;
      for (const cue of cues) {
        const delta = Math.abs(pulseTime - cue.startTimeMs);
        if (delta < minDelta) {
          minDelta = delta;
          closestCue = cue;
        }
      }

      if (closestCue === null) {
        violations.push({
          type: 'missing_caption',
          pulseId: pulse.id,
          pulseTimeMs: pulseTime,
          toleranceMs,
          message: `Tactile pulse ${pulse.id} at ${pulseTime}ms has no matching caption cue`
        });
      } else {
        deltas.push(minDelta);
        if (minDelta <= toleranceMs) {
          matchedTactileCount++;
        } else {
          violations.push({
            type: 'sync_drift',
            pulseId: pulse.id,
            cueId: closestCue.id,
            pulseTimeMs: pulseTime,
            cueStartTimeMs: closestCue.startTimeMs,
            deltaMs: minDelta,
            toleranceMs,
            message: `Tactile pulse ${pulse.id} (${pulseTime}ms) and caption cue ${closestCue.id} (${closestCue.startTimeMs}ms) drift by ${minDelta}ms, exceeding ${toleranceMs}ms tolerance`
          });
        }
      }
    }

    // 2. Caption to Tactile Coverage
    let matchedCaptionCount = 0;
    for (const cue of cues) {
      const cueTime = cue.startTimeMs;
      let minDelta = Infinity;
      let closestPulse = null;
      for (const pulse of pulses) {
        const delta = Math.abs(cueTime - pulse.timeMs);
        if (delta < minDelta) {
          minDelta = delta;
          closestPulse = pulse;
        }
      }
      if (closestPulse === null) {
        violations.push({
          type: 'missing_tactile',
          cueId: cue.id,
          cueStartTimeMs: cueTime,
          toleranceMs,
          message: `Caption cue ${cue.id} at ${cueTime}ms has no matching tactile pulse`
        });
      } else if (minDelta <= toleranceMs) {
        matchedCaptionCount++;
      }
    }

    // 3. Visual Parity (nodes vs caption cues)
    let matchedVisualCount = 0;
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      const matchedNode = visualNodes.find(n => (n.id && n.id === cue.nodeId) || (n.text && n.text === cue.text) || n.orderIndex === cue.index);
      if (matchedNode) {
        matchedVisualCount++;
      } else {
        violations.push({
          type: 'missing_visual',
          cueId: cue.id,
          cueText: cue.text,
          message: `Caption cue ${cue.id} ("${cue.text}") has no corresponding visual indicator in reduced motion layer`
        });
      }
    }

    const sonicToCaptions = pulses.length > 0 ? (matchedTactileCount / pulses.length) : (cues.length === 0 ? 1.0 : 0.0);
    const sonicToTactile = cues.length > 0 ? (matchedCaptionCount / cues.length) : (pulses.length === 0 ? 1.0 : 0.0);
    const visualParity = cues.length > 0 ? (matchedVisualCount / cues.length) : (visualNodes.length === 0 ? 1.0 : 0.0);

    const maxDeltaMs = deltas.length > 0 ? Math.max(...deltas) : 0;
    const equivalent = violations.length === 0 &&
      maxDeltaMs <= toleranceMs &&
      sonicToCaptions === 1.0 &&
      sonicToTactile === 1.0 &&
      visualParity === 1.0;

    const summary = equivalent
      ? `PASSED: 100% cross-modal parity (max delta ${maxDeltaMs}ms <= ${toleranceMs}ms tolerance).`
      : `FAILED: Sensory parity violations detected (${violations.length} issues, max delta ${maxDeltaMs}ms).`;

    return Object.freeze({
      schema: 'six-encounters-sensory-equivalence-audit-v1',
      equivalent,
      toleranceMs,
      maxDeltaMs,
      violations: Object.freeze(violations),
      coverage: Object.freeze({
        sonicToCaptions: Math.round(sonicToCaptions * 1000) / 1000,
        sonicToTactile: Math.round(sonicToTactile * 1000) / 1000,
        visualParity: Math.round(visualParity * 1000) / 1000
      }),
      summary
    });
  }

  const HLSensoryAccessibility = Object.freeze({
    compileCaptionTrack,
    projectTactileSubBassEnvelope,
    verifyReducedMotionParity,
    auditSensoryEquivalence,
    formatVttTimestamp,
    clampFrequency
  });

  root.HLSensoryAccessibility = HLSensoryAccessibility;
  if (root.HLGeneration) {
    Object.assign(root.HLGeneration, HLSensoryAccessibility);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HLSensoryAccessibility;
  }
})(typeof window === 'undefined' ? globalThis : window);
