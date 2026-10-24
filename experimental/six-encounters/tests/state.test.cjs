const {test} = require('node:test');
const assert = require('node:assert/strict');
const {score,content} = require('../content.js');
const {Session,ExposureClock} = require('../engine.js');

test('six entries, two visits per chamber, two cycles, bounded traces and retained layout memory',()=>{
  const s=new Session(score);const layouts={bounds:[{x:10,y:20,width:100,height:40}]};
  score.sequence.forEach((chamber,i)=>{
    const e=s.enter();assert.equal(e.chamber,chamber);assert.equal(s.enter(),null);
    s.recordLayout(e.id,layouts);assert.equal(s.returnEncounter(e.id),true);
    assert.equal(s.returnEncounter(e.id),false);assert.equal(s.completedCycles,Math.floor((i+1)/3));
  });
  assert.deepEqual(s.visits,{'040915':2,'041015':2,'042115':2});
  assert.equal(s.entries.length,6);assert.equal(s.history.length,6);assert.equal(s.completedCycles,2);
  assert.deepEqual(s.traces.map(e=>e.id),s.entries.slice(3).map(e=>e.id));
  assert.equal(Object.keys(s.layouts).length,3);assert.equal(s.active,null);assert.equal(s.enter(),null);
});
test('exit is partial, cancels the active encounter without inventing a return',()=>{
  const s=new Session(score);const e=s.enter();s.exit();
  assert.equal(s.returnEncounter(e.id),false);assert.equal(s.history.length,0);assert.equal(s.completedCycles,0);assert.equal(s.enter(),null);
});
test('early exit retains interrupted exposure without adding a return',()=>{
  const s=new Session(score,'timed');const e=s.enter();e.elapsed=1234;s.exit();
  assert.equal(s.snapshot().entries[0].elapsed,1234);
  assert.equal(s.snapshot().active,null);assert.equal(s.history.length,0);
  assert.equal(s.traces.length,0);assert.equal(s.completedCycles,0);
});
test('restart clears every session consequence and invalidates stale return identities',()=>{
  const s=new Session(score,'timed');const old=s.enter();s.recordLayout(old.id,{bounds:[]});s.returnEncounter(old.id);s.restart();
  assert.deepEqual(s.snapshot(),{mode:'reader',active:null,visits:{},layouts:{},entries:[],history:[],traces:[],completedCycles:0,exited:false});
  const next=s.enter();assert.notEqual(next.id,old.id);assert.equal(s.returnEncounter(old.id),false);
});
test('layout capture is bounded to first visit and snapshots cannot mutate state',()=>{
  const s=new Session(score);const e=s.enter();s.recordLayout(e.id,{bounds:[{x:1}]});s.recordLayout(e.id,{bounds:[{x:2}]});
  const snapshot=s.snapshot();snapshot.layouts['040915'].bounds[0].x=999;assert.equal(s.layouts['040915'].bounds[0].x,1);
  s.returnEncounter(e.id);s.enter();s.returnEncounter(s.active.id);s.enter();s.returnEncounter(s.active.id);
  const revisit=s.enter();assert.equal(revisit.visit,2);s.recordLayout(revisit.id,{bounds:[{x:3}]});
  assert.equal(s.snapshot().layouts['040915'].bounds[0].x,1);
});
test('studies are independent sessions; immutable content defines 378 phrase instances',()=>{
  const composed=new Session(score),study=new Session({...score,sequence:['042115'],cycleLength:null});
  study.enter();study.returnEncounter(study.active.id);assert.equal(study.completedCycles,0);assert.equal(composed.entries.length,0);
  const c=content.chambers['041015'];assert.equal(c.rows*c.columns,378);assert.equal(Object.isFrozen(content.chambers),true);
});
function rig(){let t=0,calls=0;const clock=new ExposureClock({now:()=>t,duration:5000,onExpire:()=>calls++});
  return {clock,advance:n=>t+=n,get calls(){return calls;}};}
test('3000 + hidden interval + 1999 stays active; eligible tick at 5000 returns once',()=>{
  const r=rig(),c=r.clock;c.set({visible:true,ready:true});r.advance(3000);c.tick();
  c.set({visible:false});r.advance(900000);c.tick();assert.equal(c.elapsed,3000);
  c.set({visible:true});assert.equal(r.calls,0);r.advance(1999);c.tick();assert.equal(c.elapsed,4999);assert.equal(r.calls,0);
  r.advance(1);c.tick();c.tick();assert.equal(r.calls,1);assert.equal(c.active,false);
});
test('paused and not-ready intervals do not count; resume never navigates',()=>{
  const r=rig(),c=r.clock;c.set({visible:true});r.advance(20000);c.tick();assert.equal(c.elapsed,0);
  c.set({ready:true});r.advance(3000);c.set({paused:true});r.advance(20000);c.tick();assert.equal(c.elapsed,3000);
  c.set({paused:false});assert.equal(r.calls,0);r.advance(2000);c.tick();assert.equal(r.calls,1);
});
test('visibility changes at the threshold do not themselves navigate',()=>{
  const r=rig(),c=r.clock;c.set({visible:true,ready:true});r.advance(5000);c.set({visible:false});
  r.advance(60000);c.set({visible:true});assert.equal(r.calls,0);c.tick();assert.equal(r.calls,1);
});
test('reading view readiness suspends exposure without resetting accumulation',()=>{
  const r=rig(),c=r.clock;c.set({visible:true,ready:true});r.advance(1500);c.set({ready:false});
  r.advance(90000);c.tick();assert.equal(c.elapsed,1500);c.set({ready:true});r.advance(3499);c.tick();assert.equal(r.calls,0);
  r.advance(1);c.tick();assert.equal(r.calls,1);
});
test('manual return competing with timer expiry appends only once in either order',()=>{
  for(const manualFirst of [true,false]){
    const s=new Session(score,'timed');const e=s.enter();let now=0;
    const c=new ExposureClock({now:()=>now,duration:5000,onExpire:()=>s.returnEncounter(e.id,'timer')});c.set({ready:true,visible:true});now=5000;
    if(manualFirst){s.returnEncounter(e.id);c.cancel();c.tick();}else{c.tick();s.returnEncounter(e.id);}
    assert.equal(s.history.length,1);assert.equal(s.traces.length,1);assert.equal(s.active,null);assert.equal(s.entries.length,1);
  }
});
test('canceled clocks stay canceled after exit and restart despite later ticks',()=>{
  const r=rig();r.clock.set({ready:true,visible:true});r.advance(2000);r.clock.cancel();r.advance(99999);r.clock.tick();assert.equal(r.calls,0);
});

test('session state integrates with compiled patch records without poetic side-effects (Issue #24)', () => {
  const G = require('../generation.js');
  const s = new Session(score);
  const entry = s.enter();
  assert.equal(entry.chamber, '040915');

  const patch = {
    source: entry.chamber,
    topology: 'torus',
    geometry: { bounds: [{ x: 10, y: 20 }] },
    typography: { font: 'monospace' },
    palette: ['#000000', '#ffffff'],
    temporalScore: { duration: 5000 },
    interactionRules: {
      executableActions: [
        { type: 'set_property', key: 'customField', value: 'applied' }
      ],
      poeticInstructions: [
        'remain still within the margin'
      ]
    }
  };

  const compiled = G.compilePatchRecord(patch);
  const stateSnapshot = s.snapshot();
  const modified = compiled.apply(stateSnapshot);

  assert.equal(modified.customField, 'applied');
  // poetic instructions are isolated on the compiled record
  assert.equal(compiled.poeticInstructions.length, 1);
  assert.equal(compiled.poeticInstructions[0], 'remain still within the margin');
  // session remains clean
  assert.equal(s.snapshot().customField, undefined);
});

test('session sequence can be mirrored and digested via deterministic route replay (Issue #28)', () => {
  const G = require('../generation.js');
  const s = new Session(score);
  const sequenceChambers = [];
  while (true) {
    const e = s.enter();
    if (!e) break;
    sequenceChambers.push(e.chamber);
    s.returnEncounter(e.id);
  }
  assert.equal(sequenceChambers.length, 6);

  // Replay the sequence of transitions
  const historyEvents = sequenceChambers.slice(1).map(target => ({ target }));
  const replay = G.replayRouteHistory('1.2.0', 42, historyEvents, { startNode: sequenceChambers[0] });

  assert.deepEqual(replay.visitedNodes, sequenceChambers);
  assert.equal(replay.finalEncounterIndex, 5);
  assert.equal(replay.stateSnapshots.length, 6);
  assert.match(replay.trajectoryDigest, /^[a-f0-9]{64}$/);
});
