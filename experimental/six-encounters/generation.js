/* Seeded formal rules and a separate, bounded generative route session. No DOM. */
(function(root){
  function freeze(o){Object.values(o).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(o);}
  const config=freeze({version:'1.2.0',characterMotion:{axes:['horizontal','vertical','diagonal'],periods:[2400,3100,3700],tile:[3,3],clip:true},exposure:5000,entry:450,exit:350,historyLimit:32,traceLimit:3,
    backgrounds:Object.freeze(['#000000','#00ffff','#ff00ff','#ffff00']),
    routes:Object.freeze({'040915':Object.freeze([{word:'before',target:'041015'},{word:'again',target:'042115'}]),
      '041015':Object.freeze([{word:'whereiendandubegin',target:'040915'},{word:'whereiendandubegin',target:'042115'}]),
      '042115':Object.freeze([{word:'forced',target:'040915'},{word:'progress',target:'041015'}])})});
  function random(seed){let n=seed>>>0;return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function spaces(word,rng){const groups=[...word],missing=Math.floor(rng()*(groups.length-1));groups.splice(missing,2,groups[missing]+groups[missing+1]);return {missing,groups,text:groups.join(' ')};}
  function entrance(seed,word,colors){const rng=random(seed);return colors.map((background,index)=>({...spaces(word,rng),background,chamber:['040915','041015','042115'][index%3],seed,index}));}
  function luminance(hex){const rgb=hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
  function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  function palette(background,seed){const rng=random(seed),result=[];for(let i=0;i<2000&&result.length<3;i++){
    const color='#'+Math.floor(rng()*0x1000000).toString(16).padStart(6,'0');
    if(contrast(background,color)>=4.5&&!result.includes(color))result.push(color);
  }const fallback=contrast(background,'#ffffff')>=4.5?['#ffffff','#eeeeee','#dddddd']:['#000000','#101010','#202020'];
    for(const c of fallback)if(result.length<3&&!result.includes(c)&&contrast(background,c)>=4.5)result.push(c);return result;
  }
  // Independent seeded streams avoid consuming/changing route and palette randomness.
  function character(seed,index,{axes=config.characterMotion.axes,periods=config.characterMotion.periods}={}){
    if(!axes.length || axes.some(a=>!config.characterMotion.axes.includes(a)) || periods.length!==axes.length || periods.some(p=>!Number.isFinite(p)||p<=0))throw new RangeError('Invalid character motion configuration');
    const rng=random((seed ^ Math.imul(index+1,0x9e3779b1))>>>0),slot=Math.floor(rng()*axes.length);
    return {axis:axes[slot],period:periods[slot],phase:rng(),direction:rng()<.5?-1:1};
  }
  // Normalized torus position: wave and stretch change velocity, never territories.
  function characterPosition(plan,time,family='drift'){
    const t=((time/plan.period+plan.phase)%1+1)%1;
    const wave=v=>v-Math.sin(2*Math.PI*v)/(2*Math.PI),lo=Math.floor(t*8)/8;
    const u=family==='wave'?wave(lo)+(wave(lo+1/8)-wave(lo))*(t-lo)*8:family==='stretch'?(t<.5?t*.5:.25+(t-.5)*1.5):t;
    return {x:plan.axis==='vertical'?0:u*plan.direction,y:plan.axis==='horizontal'?0:u*plan.direction};
  }
  let serial=0;
  class RouteSession {
    constructor(){this.run=++serial;this.count=0;this.active=null;this.visits={};this.history=[];}
    begin(chamber,background,seed){if(this.active||!config.routes[chamber]||!config.backgrounds.includes(background))return null;
      const rng=random(seed),links=config.routes[chamber].map(r=>({...r,background:config.backgrounds[Math.floor(rng()*4)],seed:Math.floor(rng()*0x100000000)}));
      this.active={id:`free:${this.run}:${++this.count}`,chamber,background,seed,colors:palette(background,seed),links,
        motion:['wave','drift','stretch'][Math.floor(rng()*3)],direction:Math.floor(rng()*4),phase:'entering',elapsed:0,
        visit:this.visits[chamber]=(this.visits[chamber]||0)+1,pending:null};return this.active;
    }
    ready(id){if(this.active?.id!==id||this.active.phase!=='entering')return false;this.active.phase='active';this.active.elapsed=0;return true;}
    choose(id,index){if(this.active?.id!==id||this.active.phase!=='active'||!this.active.links[index])return false;
      this.active.pending={...this.active.links[index]};this.active.reason='word';this.active.phase='exiting';return true;}
    depart(id,reason='unselected'){if(this.active?.id!==id||this.active.phase==='exiting')return false;
      this.active.pending=null;this.active.reason=reason;this.active.phase='exiting';return true;}
    finish(id){if(this.active?.id!==id||this.active.phase!=='exiting')return null;
      const event=structuredClone(this.active);this.history.push(event);this.history=this.history.slice(-config.historyLimit);this.active=null;return {event,next:event.pending};}
    exit(){this.active=null;}
    snapshot(){return structuredClone({configVersion:config.version,count:this.count,visits:this.visits,active:this.active,history:this.history,traces:this.history.slice(-config.traceLimit)});}
  }

  // Canonical 7-tuple patch dimensions (Issue #24)
  const CANONICAL_PATCH_DIMENSIONS = Object.freeze([
    'source',
    'topology',
    'geometry',
    'typography',
    'palette',
    'temporalScore',
    'interactionRules'
  ]);

  function validatePatchGrammar(patch) {
    const errors = [];
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return { valid: false, errors: ['Patch must be a non-null object'] };
    }
    for (const dim of CANONICAL_PATCH_DIMENSIONS) {
      if (!(dim in patch) || patch[dim] === undefined || patch[dim] === null) {
        errors.push(`Missing required dimension: ${dim}`);
      }
    }

    const actionsToCheck = [];
    if (patch.interactionRules && typeof patch.interactionRules === 'object') {
      if (Array.isArray(patch.interactionRules.executableActions)) {
        actionsToCheck.push(...patch.interactionRules.executableActions);
      }
    }
    if (Array.isArray(patch.executableActions)) {
      actionsToCheck.push(...patch.executableActions);
    }

    for (const [idx, act] of actionsToCheck.entries()) {
      if (!act || typeof act !== 'object' || Array.isArray(act)) {
        errors.push(`Poetic instruction '${act}' appears in executableActions without an action type`);
      } else if (typeof act.type !== 'string' || !act.type.trim()) {
        errors.push(`Poetic instruction '${act.text || act.instruction || JSON.stringify(act)}' appears in executableActions without an action type`);
      } else if (act.poetic === true && !act.handler && !act.apply) {
        errors.push(`Poetic instruction marked in executableActions without an executable handler or type`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  function compilePatchRecord(patch) {
    const check = validatePatchGrammar(patch);
    if (!check.valid) {
      const err = new Error(`Patch grammar validation failed: ${check.errors.join('; ')}`);
      err.errors = check.errors;
      throw err;
    }
    const ir = patch.interactionRules;
    const rawActions = [];
    const rawPoetics = [];

    if (ir && typeof ir === 'object') {
      if (Array.isArray(ir.executableActions)) rawActions.push(...ir.executableActions);
      if (Array.isArray(ir.poeticInstructions)) rawPoetics.push(...ir.poeticInstructions);
    }
    if (Array.isArray(patch.executableActions)) rawActions.push(...patch.executableActions);
    if (Array.isArray(patch.poeticInstructions)) rawPoetics.push(...patch.poeticInstructions);

    const compiled = {
      source: patch.source,
      topology: patch.topology,
      geometry: structuredClone(patch.geometry),
      typography: structuredClone(patch.typography),
      palette: structuredClone(patch.palette),
      temporalScore: structuredClone(patch.temporalScore),
      interactionRules: structuredClone(patch.interactionRules),
      executableActions: Object.freeze(structuredClone(rawActions)),
      poeticInstructions: Object.freeze(structuredClone(rawPoetics)),
      apply(state) {
        if (!state || typeof state !== 'object') return state;
        const next = structuredClone(state);
        for (const action of this.executableActions) {
          if (typeof action.apply === 'function') {
            action.apply(next);
          } else if (action.type === 'navigate' || action.type === 'transition') {
            if (action.target) next.chamber = action.target;
          } else if (action.type === 'set_property') {
            if (action.key) next[action.key] = action.value;
          } else if (action.type === 'mutate_state' && action.mutation && typeof action.mutation === 'object') {
            Object.assign(next, action.mutation);
          }
        }
        return next;
      }
    };
    return Object.freeze(compiled);
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
    for (i = 0; i < ascii.length; i++) {
      const code = ascii.charCodeAt(i);
      words[i >> 2] |= (code & 0xff) << (24 - (i % 4) * 8);
    }
    words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
    words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

    for (i = 0; i < words.length; i += 16) {
      const w = words.slice(i, i + 16);
      let a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
      for (j = 0; j < 64; j++) {
        if (j >= 16) {
          const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
          const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
          w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
        }
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ch + k[j] + (w[j] | 0)) | 0;
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = ((rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
      hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
    }
    for (i = 0; i < 8; i++) {
      result += (hash[i] >>> 0).toString(16).padStart(8, '0');
    }
    return result;
  }

  // Deterministic Route Graph Builder & Traversal Replay Engine (Issue #28)
  function buildRouteGraph(edition, seed) {
    const editionVer = typeof edition === 'string' ? edition : (edition?.version || config.version);
    const rng = random(seed >>> 0);
    const chambers = ['040915', '041015', '042115'];
    const nodes = {};
    const edges = [];
    const adjacency = {};

    for (const chamber of chambers) {
      const bg = config.backgrounds[Math.floor(rng() * config.backgrounds.length)];
      const nodeSeed = Math.floor(rng() * 0x100000000);
      const nodePalette = palette(bg, nodeSeed);
      const baseRoutes = config.routes[chamber] || [];
      const links = baseRoutes.map((r, linkIdx) => {
        const edgeSeed = Math.floor(rng() * 0x100000000);
        const edgeBg = config.backgrounds[Math.floor(rng() * config.backgrounds.length)];
        const edge = {
          source: chamber,
          target: r.target,
          word: r.word,
          index: linkIdx,
          background: edgeBg,
          seed: edgeSeed
        };
        edges.push(edge);
        return edge;
      });

      nodes[chamber] = Object.freeze({
        id: chamber,
        background: bg,
        seed: nodeSeed,
        palette: nodePalette,
        links: Object.freeze(links)
      });
      adjacency[chamber] = Object.freeze(links.map(l => l.target));
    }

    return freeze({
      edition: editionVer,
      seed: seed >>> 0,
      chambers: Object.freeze([...chambers]),
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
      adjacency: Object.freeze(adjacency)
    });
  }

  function replayRouteHistory(edition, seed, eventHistory, options = {}) {
    const graph = buildRouteGraph(edition, seed);
    const events = Array.isArray(eventHistory) ? [...eventHistory] : [];
    let current = options.startNode || (events[0]?.initialChamber ? events[0].initialChamber : '040915');
    if (events[0]?.initialChamber) {
      events.shift();
    }

    const visitedNodes = [current];
    const stateSnapshots = [{
      step: 0,
      node: current,
      encounterIndex: 0,
      activeChamber: current,
      timestamp: 0
    }];

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      let nextNode = current;
      if (typeof ev === 'string' && graph.nodes[ev]) {
        nextNode = ev;
      } else if (ev && typeof ev === 'object') {
        if (ev.target && graph.nodes[ev.target]) {
          nextNode = ev.target;
        } else if (ev.pending?.target && graph.nodes[ev.pending.target]) {
          nextNode = ev.pending.target;
        } else if (ev.chamber && graph.nodes[ev.chamber]) {
          nextNode = ev.chamber;
        } else if (typeof ev.chooseIndex === 'number') {
          const links = graph.nodes[current]?.links || [];
          if (links.length > 0) {
            nextNode = links[ev.chooseIndex % links.length].target;
          }
        }
      }
      current = nextNode;
      visitedNodes.push(current);
      stateSnapshots.push({
        step: i + 1,
        node: current,
        encounterIndex: visitedNodes.length - 1,
        event: typeof ev === 'object' ? structuredClone(ev) : ev,
        activeChamber: current
      });
    }

    const finalEncounterIndex = visitedNodes.length - 1;
    const digestPayload = JSON.stringify({
      edition: graph.edition,
      seed: graph.seed,
      visitedNodes,
      finalEncounterIndex
    });
    const trajectoryDigest = sha256Hex(digestPayload);

    return freeze({
      edition: graph.edition,
      seed: graph.seed,
      visitedNodes: Object.freeze([...visitedNodes]),
      finalEncounterIndex,
      stateSnapshots: Object.freeze(stateSnapshots),
      trajectoryDigest
    });
  }

  root.HLGeneration={
    config,
    random,
    spaces,
    entrance,
    palette,
    contrast,
    character,
    characterPosition,
    RouteSession,
    CANONICAL_PATCH_DIMENSIONS,
    validatePatchGrammar,
    compilePatchRecord,
    buildRouteGraph,
    replayRouteHistory
  };
  if(typeof module!=='undefined')module.exports=root.HLGeneration;
})(typeof window==='undefined'?globalThis:window);
