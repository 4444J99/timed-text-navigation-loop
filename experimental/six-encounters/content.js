/* Immutable language, deliberately separate from rendering. */
(function (root) {
  const freeze = o => { Object.values(o).forEach(v => v && typeof v === 'object' && freeze(v)); return Object.freeze(o); };
  const content = freeze({
    version: '1.1.0',
    sourceRevision: '9fc3c006f2764e1887b79293e32eb9a3a1875344',
    entranceLabel: 'LOOPHOLE',
    chambers: {
      '040915': { name: 'Moment', clauses: ['this moment has never come before', 'this moment will never come again'] },
      '041015': { name: 'I/you', phrase: 'whereiendandubegin', rows: 42, columns: 9 },
      '042115': { name: 'Forced progress', clauses: ['forced progress'] }
    }
  });
  const score = freeze({
    version: '1.1.0', sequence: ['040915','041015','042115','040915','041015','042115'],
    duration: 5000, traceLimit: 3, cycleLength: 3,
    entrance: { field: '#ffffff', rows: ['#000000','#00ffff','#ff00ff','#ffff00','#000000','#00ffff','#ff00ff','#ffff00','#00ffff','#ff00ff','#ffff00'] },
    colors: { baseline: '#ff00aa', green: '#006c53', violet: '#492475', foreground: '#ffffff' },
    type: { font: 'Futura, "Century Gothic", "Trebuchet MS", Arial, sans-serif', foreground: '#ffffff' },
    moment: { width: 1000, height: 1200, size: 44, weight: 400, font: 'Futura, "Century Gothic", "Trebuchet MS", Arial, sans-serif', x: 0, y: 110, clauseInterval: 800, field: '#00ffff', foreground: '#ffffff', uppercase: true },
    field: { width: '10 rendered phrase advances', height: 850, cellWidth: 'rendered phrase advance', rowHeight: 19, size: 16.8, font: 'Futura, "Century Gothic", "Trebuchet MS", Arial, sans-serif', gapAfter: 4, field: '#000000', foreground: '#ffffff', uppercase: true },
    progress: { width: 1000, height: 640, size: 56, weight: 400, font: 'Futura, "Century Gothic", "Trebuchet MS", Arial, sans-serif', x: 50, y: 320, field: '#ff00aa', foreground: '#ffffff' }
  });
  root.HLContent = content; root.HLScore = score;
  if (typeof module !== 'undefined') module.exports = { content, score };
})(typeof window === 'undefined' ? globalThis : window);
