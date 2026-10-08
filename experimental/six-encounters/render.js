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
  function mount(container, id, { variant = false, memory = null, color = null, immersive = false, routes = null, colors = null } = {}) {
    const c = { ...(id === '040915' ? config.moment : id === '041015' ? config.field : config.progress) };
    if(id === '041015') c.width = 1800; // Provisional width, resolved from real glyph advance below.
    const viewport = document.createElement('div'); viewport.className = 'viewport'; viewport.tabIndex = 0;
    viewport.setAttribute('aria-label', id === '041015' ? '42 rows of nine phrases. Use reading view for full size text, or scroll detail to pan.' : `${chambers[id].name} artwork`);
    const holder = document.createElement('div'); holder.className = 'canvas-holder';
    const canvas = document.createElement('div'); canvas.className = `canvas ${id === '040915' ? 'moment' : id === '041015' ? 'field' : 'progress'}`;
    canvas.style.width = `${c.width}px`; canvas.style.height = `${c.height}px`;
    canvas.style.backgroundColor = color || c.field || config.colors.baseline;
    canvas.style.color = c.foreground || config.colors.foreground;
    canvas.style.textTransform = c.uppercase ? 'uppercase' : 'none';
    if (immersive) { viewport.classList.add('immersive-viewport'); viewport.style.backgroundColor=canvas.style.backgroundColor; }
    let wordIndex=0;
    function word(text,routeIndex=null,focusable=true){
      const span=document.createElement('span');span.className='loop-word';
      [...text].forEach((char,index)=>{
        const cell=document.createElement('span');cell.className='character-cell';cell.dataset.axis=['horizontal','vertical','diagonal'][index%3];
        cell.style.setProperty('--character-delay',`${-(wordIndex*text.length+index)*.137}s`);
        const original=document.createElement('span');original.className='character-source';original.textContent=char;
        const plane=document.createElement('span');plane.className='character-plane';plane.setAttribute('aria-hidden','true');
        for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
          const copy=document.createElement('span');copy.className='character-copy';copy.dataset.character=char;copy.style.left=`${x*100}%`;copy.style.top=`${y*100}%`;plane.append(copy);
        }
        cell.append(original,plane);span.append(cell);
      });
      if(colors){span.style.color=colors[wordIndex%colors.length];span.style.setProperty('--word-delay',`${-wordIndex*.09}s`);wordIndex++;}
      if(routeIndex===null)return span;
      const b=document.createElement('button');b.className='route-word';b.append(span);b.dataset.route=routeIndex;
      if(colors)b.style.color=span.style.color;
      b.setAttribute('aria-label',`${text} → ${chambers[routes.links[routeIndex].target].name}`);
      b.tabIndex=focusable?0:-1;b.onclick=()=>routes.choose(routeIndex);return b;
    }
    if (id === '041015') {
      for (let row = 0; row < chambers[id].rows; row++) for (let col = 0; col < chambers[id].columns; col++) {
        const el = document.createElement('span'); el.className = 'phrase';
        if(routes)el.append(word(chambers[id].phrase,col%2,row===0&&col<2));else el.textContent=chambers[id].phrase;
        el.dataset.instance = row * chambers[id].columns + col;
        el.style.font = `400 ${c.size}px/${c.rowHeight}px ${c.font}`; el.style.width='max-content';
        el.dataset.row = row; el.dataset.column = col;
        el.style.top = `${26 + row * c.rowHeight}px`; canvas.append(el);
      }
    } else chambers[id].clauses.forEach((text, i) => {
      const el = document.createElement('p'); el.className = 'art-text';
      if(routes)text.split(' ').forEach((part,i)=>{if(i)el.append(' ');const ri=routes.links.findIndex(r=>r.word===part);el.append(word(part,ri<0?null:ri));});else el.textContent=text;
      el.style.font = `${c.weight} ${c.size}px/1.2 ${c.font}`; el.style.left=`${c.x}px`; el.style.top=`${c.y + i * (c.clauseInterval || 0)}px`;
      if(id==='040915') {el.style.left='50%';el.style.transform='translateX(-50%)';el.style.textAlign='center';}
      canvas.append(el);
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
      scale = detail ? 1 : immersive ? id === '041015' ? viewport.clientWidth / c.width : Math.min(viewport.clientWidth / c.width, viewport.clientHeight / c.height) : Math.min(1, viewport.clientWidth / c.width);
      if (immersive && id === '041015') {
        // Fit keeps every logical row and column. Distribute row intervals over the screen;
        // detail restores the unscaled, closely set source field for reading and panning.
        const logicalHeight = detail ? 850 : viewport.clientHeight / scale;
        c.height=logicalHeight;canvas.style.height=`${logicalHeight}px`;
        canvas.querySelectorAll('.phrase').forEach(el=>{el.style.top=`${detail ? 26 + +el.dataset.row * c.rowHeight : 60 + +el.dataset.row * (logicalHeight-120)/42}px`;});
      }
      holder.style.width = `${c.width * scale}px`; holder.style.height = `${c.height * scale}px`;
      canvas.style.transform = `scale(${scale})`; viewport.style.maxHeight = immersive ? 'none' : detail ? '65vh' : 'none';
      if (immersive) {holder.style.margin=detail?'0': 'auto';viewport.classList.toggle('detail',detail);}
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
      destroy() { observer.disconnect(); canvas.getAnimations({subtree:true}).forEach(a=>a.cancel()); }
    };
  }
  function symbol(id) {
    if (id === '040915') return '<svg viewBox="0 0 120 44" aria-hidden="true"><g fill="none" stroke="currentColor"><rect x="15" y="10" width="90" height="7"/><rect x="15" y="27" width="90" height="7"/></g></svg>';
    if (id === '041015') return '<svg viewBox="0 0 120 44" aria-hidden="true"><g stroke="currentColor"><path d="M15 10h35m20 0h35M15 18h35m20 0h35M15 26h35m20 0h35M15 34h35m20 0h35"/></g></svg>';
    return '<svg viewBox="0 0 120 44" aria-hidden="true"><path d="M20 22h78m-12-9 13 9-13 9" fill="none" stroke="currentColor"/></svg>';
  }
  root.HLRender = { mount, symbol };
})(window);
