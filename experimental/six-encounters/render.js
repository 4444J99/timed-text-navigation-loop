(function (root) {
  const { chambers } = root.HLContent, config = root.HLScore;
  const ns = 'http://www.w3.org/2000/svg';
  function rects(layer, bounds, pad = 0) {
    bounds.forEach(b => {
      const r = document.createElementNS(ns, 'rect');
      Object.entries({x:b.x-pad,y:b.y-pad,width:b.width+pad*2,height:b.height+pad*2}).forEach(([k,v]) => r.setAttribute(k,v));
      layer.append(r);
    });
  }
  function mount(container, id, { variant = false, memory = null, color = null } = {}) {
    const c = { ...(id === '040915' ? config.moment : id === '041015' ? config.field : config.progress) };
    if(id === '041015') c.width = 1800; // Provisional width, resolved from real glyph advance below.
    const viewport = document.createElement('div'); viewport.className = 'viewport'; viewport.tabIndex = 0;
    viewport.setAttribute('aria-label', id === '041015' ? '42 rows of nine phrases. Use reading view for full size text, or scroll detail to pan.' : `${chambers[id].name} artwork`);
    const holder = document.createElement('div'); holder.className = 'canvas-holder';
    const canvas = document.createElement('div'); canvas.className = `canvas ${id === '040915' ? 'moment' : id === '041015' ? 'field' : 'progress'}`;
    canvas.style.width = `${c.width}px`; canvas.style.height = `${c.height}px`;
    canvas.style.backgroundColor = color || c.field || config.colors.baseline;
    if (id === '041015') {
      for (let row = 0; row < chambers[id].rows; row++) for (let col = 0; col < chambers[id].columns; col++) {
        const el = document.createElement('span'); el.className = 'phrase';
        el.textContent = chambers[id].phrase; el.dataset.instance = row * chambers[id].columns + col;
        el.style.font = `400 ${c.size}px/${c.rowHeight}px ${c.font}`; el.style.width='max-content';
        el.dataset.row = row; el.dataset.column = col;
        el.style.top = `${26 + row * c.rowHeight}px`; canvas.append(el);
      }
    } else chambers[id].clauses.forEach((text, i) => {
      const el = document.createElement('p'); el.className = 'art-text'; el.textContent = text;
      el.style.font = `${c.weight} ${c.size}px/1.2 ${c.font}`; el.style.left=`${c.x}px`; el.style.top=`${c.y + i * (c.clauseInterval || 0)}px`; canvas.append(el);
    });
    if (variant && memory && id === '040915') {
      const svg = document.createElementNS(ns, 'svg'); svg.classList.add('memory-layer');
      svg.setAttribute('viewBox',`0 0 ${c.width} ${c.height}`); svg.setAttribute('aria-hidden','true');
      rects(svg, memory.bounds, 8); canvas.append(svg);
    }
    holder.append(canvas); viewport.append(holder); container.append(viewport);
    const cellWidth = id === '041015' ? canvas.querySelector('.phrase').getBoundingClientRect().width : null;
    if (cellWidth) {
      c.width = cellWidth * (chambers[id].columns + 1);
      canvas.style.width = `${c.width}px`;
      canvas.querySelectorAll('.phrase').forEach(el => {
      const col=+el.dataset.column; el.style.width=`${cellWidth}px`;
      el.style.left=`${(col + (variant && col >= c.gapAfter ? 1 : 0)) * cellWidth}px`;
      });
    }
    let scale = 1, detail = false;
    function resize() {
      scale = detail ? 1 : Math.min(1, viewport.clientWidth / c.width);
      holder.style.width = `${c.width * scale}px`; holder.style.height = `${c.height * scale}px`;
      canvas.style.transform = `scale(${scale})`; viewport.style.maxHeight = detail ? '65vh' : 'none';
    }
    const observer = new ResizeObserver(resize); observer.observe(viewport); resize();
    return {
      viewport, canvas,
      detail(value) { detail = value; resize(); },
      measure() {
        const origin = canvas.getBoundingClientRect();
        return { chamber:id, width:c.width, height:c.height, ...(cellWidth ? {cellWidth} : {}), bounds:[...canvas.querySelectorAll('.art-text,.phrase')].map(el => {
          const b = el.getBoundingClientRect();
          return { x:(b.x-origin.x)/scale, y:(b.y-origin.y)/scale, width:b.width/scale, height:b.height/scale };
        }) };
      },
      destroy() { observer.disconnect(); }
    };
  }
  function symbol(id) {
    if (id === '040915') return '<svg viewBox="0 0 120 44" aria-hidden="true"><g fill="none" stroke="currentColor"><rect x="15" y="10" width="90" height="7"/><rect x="15" y="27" width="90" height="7"/></g></svg>';
    if (id === '041015') return '<svg viewBox="0 0 120 44" aria-hidden="true"><g stroke="currentColor"><path d="M15 10h35m20 0h35M15 18h35m20 0h35M15 26h35m20 0h35M15 34h35m20 0h35"/></g></svg>';
    return '<svg viewBox="0 0 120 44" aria-hidden="true"><path d="M20 22h78m-12-9 13 9-13 9" fill="none" stroke="currentColor"/></svg>';
  }
  root.HLRender = { mount, symbol };
})(window);
