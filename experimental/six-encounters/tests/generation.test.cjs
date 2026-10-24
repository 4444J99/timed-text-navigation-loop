const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../generation.js');const {score}=require('../content.js');const {ExposureClock,Session}=require('../engine.js');
test('each row removes exactly one of seven spaces, keeps eight letters and seven justified groups',()=>{
  const gaps=new Set();for(let seed=0;seed<100;seed++){const rows=G.entrance(seed,'LOOPHOLE',score.entrance.rows);
    assert.equal(rows.length,11);for(const [i,r]of rows.entries()){assert.equal(r.groups.length,7);assert.equal(r.text.split(' ').length,7);assert.equal(r.groups.filter(g=>g.length===2).length,1);assert.equal(r.text.replaceAll(' ',''),'LOOPHOLE');assert.equal(r.background,score.entrance.rows[i]);assert.ok(r.missing>=0&&r.missing<7);gaps.add(r.missing);}
  }assert.equal(gaps.size,7);
});
test('seeded entrance, palette, motion and routes replay, while fresh seeds vary',()=>{
  assert.deepEqual(G.entrance(45,'LOOPHOLE',score.entrance.rows),G.entrance(45,'LOOPHOLE',score.entrance.rows));
  assert.notDeepEqual(G.entrance(45,'LOOPHOLE',score.entrance.rows),G.entrance(46,'LOOPHOLE',score.entrance.rows));
  const a=new G.RouteSession(),b=new G.RouteSession();const x=a.begin('040915','#00ffff',123),y=b.begin('040915','#00ffff',123);
  assert.deepEqual(x.colors,y.colors);assert.deepEqual(x.links,y.links);assert.equal(x.motion,y.motion);
});
test('three different foregrounds contrast at least 4.5:1 with each entrance background',()=>{
  for(const bg of G.config.backgrounds)for(let seed=0;seed<100;seed++){const colors=G.palette(bg,seed);assert.equal(new Set(colors).size,3);colors.forEach(c=>assert.ok(G.contrast(bg,c)>=4.5));}
});
test('word selection wins once, performs exit, and exposes a palette-constrained next loop',()=>{
  const s=new G.RouteSession(),e=s.begin('042115','#ff00ff',20);assert.equal(s.choose(e.id,0),false);s.ready(e.id);
  assert.ok(s.choose(e.id,0));assert.equal(s.choose(e.id,1),false);assert.equal(s.depart(e.id),false);
  const result=s.finish(e.id);assert.equal(result.event.reason,'word');assert.equal(result.next.target,'040915');assert.ok(G.config.backgrounds.includes(result.next.background));assert.equal(s.finish(e.id),null);
  assert.ok(s.begin(result.next.target,result.next.background,result.next.seed));assert.equal(s.count,2);
});
test('timeout wins once, returns to the entrance rather than arming a next loop',()=>{
  const s=new G.RouteSession(),e=s.begin('040915','#000000',2);s.ready(e.id);assert.ok(s.depart(e.id));assert.equal(s.choose(e.id,1),false);
  const result=s.finish(e.id);assert.equal(result.next,null);assert.equal(result.event.reason,'unselected');assert.equal(s.active,null);
});
test('cancel/early exit invalidates transition and preserves independent scored state',()=>{
  const scoreSession=new Session(score),before=scoreSession.snapshot(),s=new G.RouteSession(),e=s.begin('041015','#ffff00',21);s.ready(e.id);s.choose(e.id,1);s.exit();assert.equal(s.finish(e.id),null);assert.equal(s.history.length,0);assert.deepEqual(scoreSession.snapshot(),before);
});
test('generative history is bounded, visits remain separate and configurations cannot be mutated',()=>{
  const s=new G.RouteSession();for(let i=0;i<80;i++){const e=s.begin('040915','#000000',i);s.ready(e.id);s.depart(e.id);s.finish(e.id);}
  assert.equal(s.count,80);assert.equal(s.visits['040915'],80);assert.equal(s.history.length,32);assert.equal(s.snapshot().traces.length,3);assert.ok(Object.isFrozen(G.config.routes['040915'][0]));
  const copy=s.snapshot();copy.history.pop();assert.equal(s.history.length,32);
});
test('entry and exit clocks exclude hidden/paused/not-ready time; event setters never navigate',()=>{
  let now=0,finished=0;const c=new ExposureClock({now:()=>now,duration:350,onExpire:()=>finished++});c.set({ready:true,visible:true});now=200;c.tick();c.set({visible:false});now+=100000;c.set({visible:true});assert.equal(finished,0);now+=149;c.tick();assert.equal(finished,0);c.set({paused:true});now+=10000;c.set({paused:false});assert.equal(finished,0);now++;c.tick();assert.equal(finished,1);c.tick();assert.equal(finished,1);
});

test('character plans replay independently from routes, vary with seed, and accept axis/period configuration',()=>{
  const plans=seed=>Array.from({length:100},(_,i)=>G.character(seed,i));
  assert.deepEqual(plans(12),plans(12));assert.notDeepEqual(plans(12),plans(13));
  assert.equal(new Set(plans(12).map(p=>p.axis)).size,3);assert.equal(new Set(plans(12).map(p=>p.direction)).size,2);
  assert.equal(G.character(12,0,{axes:['vertical'],periods:[1000]}).axis,'vertical');
  assert.throws(()=>G.character(1,0,{axes:['bogus'],periods:[1000]}),RangeError);
});
test('all axes and families repeat on the torus continuously at positive/negative and corner boundaries',()=>{
  for(const axis of G.config.characterMotion.axes)for(const direction of [-1,1])for(const family of ['drift','wave','stretch']){
    const plan={axis,direction,period:2400,phase:0},start=G.characterPosition(plan,0,family),end=G.characterPosition(plan,2400,family);
    assert.deepEqual(start,end);
    for(const time of [0,100,1200,2399]){const a=G.characterPosition(plan,time,family),b=G.characterPosition(plan,time+2400,family);assert.ok(Math.abs(a.x-b.x)<1e-12&&Math.abs(a.y-b.y)<1e-12);}
    const before=G.characterPosition(plan,2399.999,family),after=G.characterPosition(plan,2400.001,family);
    for(const key of ['x','y']){const delta=Math.abs(before[key]-after[key]);assert.ok(Math.min(delta,Math.abs(delta-1))<.00001);}
    assert.ok(start.x===0 && start.y===0);
  }
  const plan={axis:'diagonal',period:2400,phase:0,direction:1};
  assert.notDeepEqual(G.characterPosition(plan,600,'drift'),G.characterPosition(plan,600,'wave'));
  assert.notDeepEqual(G.characterPosition(plan,600,'drift'),G.characterPosition(plan,600,'stretch'));
});

test('validatePatchGrammar checks canonical 7-tuple and fails closed on missing dimensions (Issue #24)', () => {
  const validPatch = {
    source: '040915',
    topology: 'torus',
    geometry: { columns: 42, rows: 9 },
    typography: { family: 'monospace', size: 14 },
    palette: ['#000000', '#00ffff', '#ff00ff'],
    temporalScore: { duration: 5000, entry: 450, exit: 350 },
    interactionRules: {
      executableActions: [{ type: 'navigate', target: '041015' }],
      poeticInstructions: ['pause and observe']
    }
  };
  const res = G.validatePatchGrammar(validPatch);
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);

  // Missing dimension
  const missing = { ...validPatch };
  delete missing.temporalScore;
  const resMissing = G.validatePatchGrammar(missing);
  assert.equal(resMissing.valid, false);
  assert.ok(resMissing.errors.some(e => e.includes('temporalScore')));

  // Non-object
  assert.equal(G.validatePatchGrammar(null).valid, false);
  assert.equal(G.validatePatchGrammar('invalid').valid, false);
});

test('validatePatchGrammar fails closed when poetic instructions appear in executableActions without action type (Issue #24)', () => {
  const base = {
    source: '040915',
    topology: 'torus',
    geometry: { columns: 42, rows: 9 },
    typography: { family: 'monospace' },
    palette: ['#000000'],
    temporalScore: { duration: 5000 },
    interactionRules: {
      executableActions: [
        'linger in the doorway' // poetic string without action type
      ],
      poeticInstructions: []
    }
  };
  const r1 = G.validatePatchGrammar(base);
  assert.equal(r1.valid, false);
  assert.ok(r1.errors.some(e => e.includes('without an action type')));

  const objectPoetic = {
    ...base,
    interactionRules: {
      executableActions: [
        { instruction: 'breathe slowly' } // object missing type
      ]
    }
  };
  const r2 = G.validatePatchGrammar(objectPoetic);
  assert.equal(r2.valid, false);
  assert.ok(r2.errors.some(e => e.includes('without an action type')));
});

test('compilePatchRecord separates executableActions from poeticInstructions and applies only machine actions (Issue #24)', () => {
  const patch = {
    source: '040915',
    topology: 'plane',
    geometry: { columns: 42, rows: 9 },
    typography: { family: 'monospace' },
    palette: ['#000000', '#ffffff'],
    temporalScore: { duration: 5000 },
    interactionRules: {
      executableActions: [
        { type: 'navigate', target: '042115' },
        { type: 'set_property', key: 'visitedOnce', value: true }
      ],
      poeticInstructions: [
        'a breath before leaving',
        'the letters will not return'
      ]
    }
  };

  const compiled = G.compilePatchRecord(patch);
  assert.ok(Object.isFrozen(compiled));
  assert.equal(compiled.source, '040915');
  assert.equal(compiled.executableActions.length, 2);
  assert.equal(compiled.poeticInstructions.length, 2);
  assert.equal(compiled.executableActions[0].type, 'navigate');
  assert.equal(compiled.poeticInstructions[0], 'a breath before leaving');

  // .apply(state) updates machine state from executableActions only
  const state = { chamber: '040915' };
  const updated = compiled.apply(state);
  assert.equal(updated.chamber, '042115');
  assert.equal(updated.visitedOnce, true);
  // original state unmutated
  assert.equal(state.chamber, '040915');

  // Invalid patch throws on compile
  assert.throws(() => G.compilePatchRecord({}), /Patch grammar validation failed/);
});

test('buildRouteGraph produces deterministic seeded graphs and distinct seeds vary (Issue #28)', () => {
  const g1 = G.buildRouteGraph('1.2.0', 777);
  const g2 = G.buildRouteGraph('1.2.0', 777);
  const g3 = G.buildRouteGraph('1.2.0', 778);

  assert.deepEqual(g1, g2);
  assert.notDeepEqual(g1, g3);

  assert.equal(g1.edition, '1.2.0');
  assert.equal(g1.seed, 777);
  assert.ok(g1.nodes['040915']);
  assert.ok(g1.nodes['041015']);
  assert.ok(g1.nodes['042115']);
  assert.ok(g1.edges.length > 0);
  assert.deepEqual(Object.keys(g1.adjacency), ['040915', '041015', '042115']);
  assert.ok(Object.isFrozen(g1));
});

test('replayRouteHistory returns visitedNodes, finalEncounterIndex, stateSnapshots, and deterministic SHA-256 trajectoryDigest (Issue #28)', () => {
  const history = [
    { target: '041015' },
    { target: '042115' },
    { target: '040915' }
  ];

  const r1 = G.replayRouteHistory('1.2.0', 101, history);
  const r2 = G.replayRouteHistory('1.2.0', 101, history);
  const r3 = G.replayRouteHistory('1.2.0', 102, history);

  assert.deepEqual(r1.visitedNodes, ['040915', '041015', '042115', '040915']);
  assert.equal(r1.finalEncounterIndex, 3);
  assert.equal(r1.stateSnapshots.length, 4);
  assert.match(r1.trajectoryDigest, /^[a-f0-9]{64}$/);

  // Determinism
  assert.equal(r1.trajectoryDigest, r2.trajectoryDigest);
  assert.notEqual(r1.trajectoryDigest, r3.trajectoryDigest);

  // chooseIndex selection
  const choiceReplay = G.replayRouteHistory('1.2.0', 101, [{ chooseIndex: 0 }, { chooseIndex: 1 }]);
  assert.equal(choiceReplay.visitedNodes.length, 3);
  assert.equal(choiceReplay.finalEncounterIndex, 2);
  assert.equal(choiceReplay.stateSnapshots.length, 3);
  assert.match(choiceReplay.trajectoryDigest, /^[a-f0-9]{64}$/);
});
