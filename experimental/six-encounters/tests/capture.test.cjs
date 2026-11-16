const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {captureRendition,parse:parseCapture,CAPTURE_SCHEMA}=require('../capture-rendition.cjs'),{verifyCapture,parse,seededDraws}=require('../verify-capture.cjs');

const tool=n=>spawnSync(n,['-version']).status===0;
const ci=!['','0','false'].includes(String(process.env.CI||'').toLowerCase());
let chromiumPath=process.env.HL_CHROMIUM_PATH||'';
if(!chromiumPath){try{chromiumPath=require('playwright').chromium.executablePath();}catch{chromiumPath='';}}
const have=tool('ffmpeg')&&tool('ffprobe')&&Boolean(chromiumPath)&&fs.existsSync(chromiumPath);
const skip=!ci&&!have&&'ffmpeg, ffprobe or a Chromium (HL_CHROMIUM_PATH) is not installed';
const OPTS={seed:45,encounters:2,fps:10,width:480,height:270};
let root,good,other;

before(async()=>{
  if(!have){if(ci)throw new Error('ffmpeg, ffprobe and Chromium are required when CI is set: the capture tests must run there, not skip');return;}
  root=fs.mkdtempSync(path.join(os.tmpdir(),'hl-capture-'));good=path.join(root,'good');other=path.join(root,'other');
  await captureRendition({...OPTS,out:good});await captureRendition({...OPTS,seed:46,out:other});
});
after(()=>{if(root)fs.rmSync(root,{recursive:true,force:true});});

function copy(name){const d=path.join(root,name);fs.cpSync(good,d,{recursive:true});return d;}
function edit(dir,fn){const p=path.join(dir,'receipt.json'),r=JSON.parse(fs.readFileSync(p,'utf8'));fn(r);fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n');}
const failed=r=>r.checks.filter(c=>!c.ok).map(c=>c.name);
const has=(r,fragment)=>failed(r).some(n=>n.includes(fragment));

test('arguments: absolute directory required, unknown flags rejected, capture bounds enforced',()=>{
  assert.throws(()=>parse([]),/absolute/);assert.throws(()=>parse(['--dir','rel']),/absolute/);assert.throws(()=>parse(['--dir','/x','--bogus']),/usage/);
  assert.deepEqual(parse(['--dir','/x','--recapture','--require-artwork-match']),{dir:'/x',recapture:true,requireArtworkMatch:true});
  assert.throws(()=>parseCapture(['--out','rel']),/absolute/);assert.throws(()=>parseCapture(['out','/x']),/usage/);assert.throws(()=>parseCapture(['--out']),/usage/);assert.throws(()=>parseCapture(['--out','/x','--encounters','0']),/1 to/);
  assert.throws(()=>parseCapture(['--out','/x','--encounters','17']),/1 to/);assert.throws(()=>parseCapture(['--out','/x','--width','321']),/even width/);
  assert.throws(()=>parseCapture(['--out','/x','--fps','31']),/fps 1-30/);assert.throws(()=>parseCapture(['--out','/x','--seed','4294967296']),/32 bits/);assert.throws(()=>parseCapture(['--out','/x','--seed','']),/non-negative/);assert.throws(()=>parseCapture(['--out','/x','--seed','  ']),/non-negative/);
  assert.equal(parseCapture(['--out','/x']).width,960);
});

test('the seeded stream is deterministic and differs by seed',()=>{
  assert.deepEqual(seededDraws(45,3),seededDraws(45,3));assert.notDeepEqual(seededDraws(45,2),seededDraws(46,2));
  assert.ok(seededDraws(1,50).every(n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff));
});

test('a fresh capture verifies clean: route replay, timings, cue track, captions, container, every frame and every audio sample',{skip},async()=>{
  const r=await verifyCapture(good);
  assert.deepEqual(failed(r),[]);assert.equal(r.ok,true);assert.ok(r.checks.length>=24);
  const receipt=JSON.parse(fs.readFileSync(path.join(good,'receipt.json'),'utf8'));
  assert.equal(receipt.schema,CAPTURE_SCHEMA);assert.equal(receipt.timeline.length,2);assert.equal(r.metrics.frames,receipt.video.frames);
  assert.ok(r.metrics.entryMs[0]>=450&&r.metrics.exitMs[0]>=350);
  assert.equal(r.metrics.artworkFilesChangedSinceCapture.length,0);
});

test('capturing the same seed again reproduces the timeline, the frames, the cue track and the captions',{skip},async()=>{
  const r=await verifyCapture(good,{recapture:true});
  assert.deepEqual(failed(r),[]);assert.ok(r.checks.some(c=>c.name.includes('same frames')&&c.ok));
});

test('a different seed gives a different run and its own receipt verifies',{skip},async()=>{
  const a=JSON.parse(fs.readFileSync(path.join(good,'receipt.json'))),b=JSON.parse(fs.readFileSync(path.join(other,'receipt.json')));
  assert.notEqual(a.video.framePngSha256Chain,b.video.framePngSha256Chain);assert.notDeepEqual(a.timeline.map(e=>e.seed),b.timeline.map(e=>e.seed));
  assert.deepEqual(failed(await verifyCapture(other)),[]);
});

test('a receipt whose seed was changed fails the seeded first draw',{skip},async()=>{
  const d=copy('seed');edit(d,r=>{r.seed=46;});
  assert.ok(has(await verifyCapture(d),'seeded first draw'));
});

test('a first encounter that is not the seeded entrance row is refused',{skip},async()=>{
  const d=copy('entrance');edit(d,r=>{const e=r.timeline[0];e.chamber=e.chamber==='040915'?'041015':'040915';});
  assert.ok(has(await verifyCapture(d),'seeded entrance row'));
});

test('a rewritten followed word fails the route replay and the regenerated captions',{skip},async()=>{
  const d=copy('word');edit(d,r=>{r.timeline[0].chosenWord='again';});
  const r=await verifyCapture(d);assert.ok(has(r,'route replays'));
});

test('a changed phase time fails the bounds or the regenerated cue track',{skip},async()=>{
  const d=copy('phase');edit(d,r=>{const e=r.timeline[0];e.exitStart+=40;e.end+=40;r.timeline[1].enterStart+=40;r.timeline[1].activeStart+=40;r.timeline[1].exitStart+=40;r.timeline[1].end+=40;r.durationMs+=40;});
  const r=await verifyCapture(d);assert.ok(has(r,'cue-track.wav equals'));
});

test('an edited timing outside the configured bounds is refused',{skip},async()=>{
  const d=copy('bounds');edit(d,r=>{r.timeline[0].activeStart=r.timeline[0].enterStart+300;});
  assert.ok(has(await verifyCapture(d),'configured entry, dwell and exit bounds'));
});

test('another seed\'s MP4 under this receipt fails the frames',{skip},async()=>{
  const d=copy('swapped');fs.copyFileSync(path.join(other,'capture.mp4'),path.join(d,'capture.mp4'));
  const r=await verifyCapture(d);assert.equal(r.ok,false);
  assert.ok(has(r,'largest configured field')||has(r,'exact frame count')||has(r,'container duration'),failed(r).join(' | '));
});

test('a flipped cue-track byte, an edited caption and a missing sidecar are each caught',{skip},async()=>{
  let d=copy('wav');const wav=fs.readFileSync(path.join(d,'cue-track.wav'));wav[wav.length>>1]^=0x40;fs.writeFileSync(path.join(d,'cue-track.wav'),wav);
  assert.ok(has(await verifyCapture(d),'cue-track.wav equals'));
  d=copy('vtt');fs.writeFileSync(path.join(d,'captions.vtt'),fs.readFileSync(path.join(d,'captions.vtt'),'utf8').replace('Exit','Exot'));
  assert.ok(has(await verifyCapture(d),'captions.vtt equals'));
  d=copy('nocaptions');fs.rmSync(path.join(d,'captions.vtt'));
  assert.ok(has(await verifyCapture(d),'beside the receipt'));
});

test('a truncated MP4 is a failed check, not a tool failure',{skip},async()=>{
  const d=copy('trunc'),p=path.join(d,'capture.mp4'),b=fs.readFileSync(p);fs.writeFileSync(p,b.subarray(0,b.length>>1));
  const r=await verifyCapture(d);assert.equal(r.ok,false);assert.ok(r.checks.some(c=>!c.ok&&/capture\.mp4|frame count|decode/.test(c.name)),failed(r).join(' | '));
});

test('a garbage MP4 and a malformed timeline are failed checks, not crashes',{skip},async()=>{
  let d=copy('garbage');fs.writeFileSync(path.join(d,'capture.mp4'),'not an mp4');
  let r=await verifyCapture(d);assert.equal(r.ok,false);assert.ok(has(r,'ffprobe can read'));
  d=copy('nulltl');edit(d,x=>{x.timeline[0]=null;});
  r=await verifyCapture(d);assert.equal(r.ok,false);assert.ok(has(r,'configured entry, dwell and exit bounds'));
});

test('a followed word or dwell that is not the driver\'s seeded choice, and a changed driver block, are refused',{skip},async()=>{
  let d=copy('pick');edit(d,r=>{const e=r.timeline[1];e.chosen=1-e.chosen;e.chosenWord=e.links[e.chosen].word;e.next=e.links[e.chosen].target;});
  assert.ok(has(await verifyCapture(d),'seeded choices'));
  d=copy('driver');edit(d,r=>{r.driver=null;});assert.ok(has(await verifyCapture(d),'driver is exactly'));
  d=copy('timingkeys');edit(d,r=>{r.timings.extra=1;});assert.ok(has(await verifyCapture(d),'timings state'));
});

test('an unusable launch leaves no frame directory behind',{skip},async()=>{
  const out=path.join(root,'nolaunch'),saved=process.env.HL_CHROMIUM_PATH;
  process.env.HL_CHROMIUM_PATH=path.join(root,'no-such-chromium');
  try{await assert.rejects(()=>captureRendition({...OPTS,out}));}finally{if(saved===undefined)delete process.env.HL_CHROMIUM_PATH;else process.env.HL_CHROMIUM_PATH=saved;}
  assert.deepEqual(fs.readdirSync(out).filter(n=>n.startsWith('.capture-frames-')),[]);
});

test('an audio track that is not the cue track fails the audio checks',{skip},async()=>{
  const d=copy('audio'),p=path.join(d,'capture.mp4'),out=path.join(d,'noisy.mp4');
  const r=spawnSync('ffmpeg',['-v','error','-y','-i',p,'-f','lavfi','-i','sine=frequency=1800:sample_rate=22050','-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-ac','1','-t',String(JSON.parse(fs.readFileSync(path.join(d,'receipt.json'))).durationMs/1000),out]);
  assert.equal(r.status,0,String(r.stderr));fs.renameSync(out,p);
  const v=await verifyCapture(d);assert.ok(has(v,'cue\'s own pitch')||has(v,'silent outside'),failed(v).join(' | '));
});

test('the artwork match is reported, and refused only on request',{skip},async()=>{
  const d=copy('artwork');edit(d,r=>{r.artwork.files['app.js']='0'.repeat(64);});
  const plain=await verifyCapture(d);assert.deepEqual(failed(plain),[]);assert.deepEqual(plain.metrics.artworkFilesChangedSinceCapture,['app.js']);
  assert.ok(has(await verifyCapture(d,{requireArtworkMatch:true}),'artwork in this checkout'));
});

test('a receipt with extra keys, a wrong schema or a wrong claims text is refused',{skip},async()=>{
  for(const [name,fn] of [['extra',r=>{r.extra=1;}],['schema',r=>{r.schema='hole-loop.capture-receipt.v2';}],['claims',r=>{r.claims='Accepted.';}]]){
    const d=copy('r-'+name);edit(d,fn);assert.ok(has(await verifyCapture(d),'exactly the capture schema'),name);
  }
});
