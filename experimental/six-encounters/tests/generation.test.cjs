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
