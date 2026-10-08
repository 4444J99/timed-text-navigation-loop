/* Immutable language, deliberately separate from rendering. */
(function (root) {
  const freeze = o => { Object.values(o).forEach(v => v && typeof v === 'object' && freeze(v)); return Object.freeze(o); };
  const content = freeze({
    version: '1.0.0',
    sourceRevision: '9fc3c006f2764e1887b79293e32eb9a3a1875344',
    chambers: {
      '040915': { name: 'Moment', clauses: ['this moment has never come before', 'this moment will never come again'] },
      '041015': { name: 'I/you', phrase: 'whereiendandubegin', rows: 42, columns: 9 },
      '042115': { name: 'Forced progress', clauses: ['forced progress'] }
    }
  });
  const score = freeze({
    version: '1.0.0', sequence: ['040915','041015','042115','040915','041015','042115'],
    duration: 5000, traceLimit: 3, cycleLength: 3,
    colors: { baseline: '#ede6d6', green: '#b8d6c4', violet: '#d3bde2', foreground: '#292b29' },
    moment: { width: 1000, height: 640, size: 34, weight: 400, font: 'Georgia, serif', x: 100, y: 244, clauseInterval: 100, field: '#b8d6c4' },
    field: { width: '10 rendered phrase advances', height: 850, cellWidth: 'rendered phrase advance', rowHeight: 19, size: 16, font: 'monospace', gapAfter: 4 },
    progress: { width: 1000, height: 640, size: 52, weight: 700, font: 'Arial, sans-serif', x: 100, y: 285, field: '#efc1ab' }
  });
  root.HLContent = content; root.HLScore = score;
  if (typeof module !== 'undefined') module.exports = { content, score };
})(typeof window === 'undefined' ? globalThis : window);
