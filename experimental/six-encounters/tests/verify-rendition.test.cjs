const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {exportRendition}=require('../export-rendition.cjs'),{verifyRendition,parse,psnr,DEFAULT_MIN_PSNR}=require('../verify-rendition.cjs');

const tool=n=>spawnSync(n,['-version']).status===0,have=tool('ffmpeg')&&tool('ffprobe'),skip=!have&&'ffmpeg/ffprobe not installed';
const OPTS={seed:45,encounters:2,fps:10,width:320,height:180};
let root,good,other;

before(async()=>{
  if(!have)return;
  root=fs.mkdtempSync(path.join(os.tmpdir(),'hl-verify-'));good=path.join(root,'good');other=path.join(root,'other');
  await exportRendition({...OPTS,out:good});await exportRendition({...OPTS,seed:46,out:other});
});
after(()=>{if(root)fs.rmSync(root,{recursive:true,force:true});});

function copy(name){const d=path.join(root,name);fs.cpSync(good,d,{recursive:true});return d;}
function edit(dir,fn){const p=path.join(dir,'receipt.json'),r=JSON.parse(fs.readFileSync(p,'utf8'));fn(r);fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n');}
const failed=r=>r.checks.filter(c=>!c.ok).map(c=>c.name);

test('arguments: absolute directory required, unknown flags and bad thresholds rejected',()=>{
  assert.throws(()=>parse([]),/absolute/);assert.throws(()=>parse(['--dir','rel']),/absolute/);
  assert.throws(()=>parse(['--dir','/x','--bogus','1']),/usage/);assert.throws(()=>parse(['--dir']),/usage/);
  assert.throws(()=>parse(['--dir','/x','--min-psnr','0']),/positive/);
  assert.deepEqual(parse(['--dir','/x']),{dir:'/x',minPsnr:DEFAULT_MIN_PSNR});
  assert.equal(parse(['--dir','/x','--min-psnr','25']).minPsnr,25);
});

test('psnr: identical buffers are infinite, a known error gives the expected decibels',()=>{
  assert.equal(psnr(new Float64Array([1,2,3]),new Float64Array([1,2,3])),Infinity);
  const db=psnr(new Float64Array([0,0,0,0]),new Float64Array([255,255,0,0]));assert.ok(Math.abs(db-10*Math.log10(255*255*4/(2*255*255)))<1e-9);
});

test('a fresh export replays clean: timeline, frame hash, cue track, container, decoded frames and audio',{skip},async()=>{
  const r=await verifyRendition(good);
  assert.deepEqual(failed(r),[]);assert.equal(r.ok,true);
  assert.ok(r.checks.length>=25);assert.equal(r.metrics.frames,JSON.parse(fs.readFileSync(path.join(good,'receipt.json'))).video.frames);
  assert.ok(r.metrics.minPsnrDb>=DEFAULT_MIN_PSNR);
});

test('a receipt whose seed was changed is caught by the timeline and the frame digest',{skip},async()=>{
  const d=copy('seed');edit(d,r=>{r.seed=46;});
  const f=failed(await verifyRendition(d));
  assert.ok(f.includes('route timeline re-derives from the seed'),f.join('|'));
  assert.ok(f.includes('raw frame stream SHA-256 re-derives from the seed'));assert.ok(f.some(n=>/luma PSNR/.test(n)));
});

test('an edited followed word, a forged frame digest, and a forged cue digest are each caught alone',{skip},async()=>{
  const a=copy('word');edit(a,r=>{r.timeline[0].chosenWord='forged';});
  assert.deepEqual(failed(await verifyRendition(a)),['route timeline re-derives from the seed']);
  const b=copy('framehash');edit(b,r=>{r.video.frameStreamSha256='0'.repeat(64);});
  assert.deepEqual(failed(await verifyRendition(b)),['raw frame stream SHA-256 re-derives from the seed']);
  const c=copy('cuehash');edit(c,r=>{r.cueTrack.wavSha256='f'.repeat(64);});
  assert.deepEqual(failed(await verifyRendition(c)),['cue track SHA-256 re-derives from the seed']);
});

test('a changed WAV on disk is caught even though the receipt still matches the seed',{skip},async()=>{
  const d=copy('wav'),p=path.join(d,'cue-track.wav'),b=fs.readFileSync(p);b[b.length-3]^=0x55;fs.writeFileSync(p,b);
  assert.deepEqual(failed(await verifyRendition(d)),['cue-track.wav on disk is byte-identical to the replay']);
});

test('swapping in the MP4 of a different seed fails only the decoded-frame comparison',{skip},async()=>{
  const d=copy('swap');fs.copyFileSync(path.join(other,'rendition.mp4'),path.join(d,'rendition.mp4'));
  const r=await verifyRendition(d),f=failed(r);
  assert.ok(f.some(n=>/luma PSNR/.test(n)),f.join('|'));assert.ok(r.metrics.minPsnrDb<DEFAULT_MIN_PSNR-10,'different seed is far below the threshold, not marginally');
});

test('a truncated MP4 is rejected without throwing; missing files and bad JSON are named',{skip},async()=>{
  const t=copy('trunc'),p=path.join(t,'rendition.mp4'),b=fs.readFileSync(p);fs.writeFileSync(p,b.subarray(0,Math.floor(b.length/3)));
  let r;try{r=await verifyRendition(t);}catch(e){r={ok:false,checks:[],threw:e.message};}
  assert.equal(r.ok,false);
  const m=copy('missing');fs.rmSync(path.join(m,'cue-track.wav'));
  assert.deepEqual(failed(await verifyRendition(m)),['present: cue-track.wav']);
  const j=copy('json');fs.writeFileSync(path.join(j,'receipt.json'),'{not json');
  assert.deepEqual(failed(await verifyRendition(j)),['receipt.json parses']);
  const s=copy('schema');edit(s,r=>{r.schema='other';});
  assert.deepEqual(failed(await verifyRendition(s)),['receipt schema']);
  const x=copy('range');edit(x,r=>{r.encounters=65;});
  assert.deepEqual(failed(await verifyRendition(x)),['receipt parameters are within the exporter limits']);
});

test('the command line exits 0 on a good directory and 1 on a tampered one, printing a JSON verdict',{skip},()=>{
  const cli=path.join(__dirname,'..','verify-rendition.cjs');
  const ok=spawnSync('node',[cli,'--dir',good],{encoding:'utf8'});assert.equal(ok.status,0);assert.equal(JSON.parse(ok.stdout).ok,true);
  const d=copy('cli');edit(d,r=>{r.seed=99;});
  const bad=spawnSync('node',[cli,'--dir',d],{encoding:'utf8'});assert.equal(bad.status,1);
  const v=JSON.parse(bad.stdout);assert.equal(v.ok,false);assert.ok(v.failed.length>=2);assert.match(bad.stderr,/FAIL route timeline/);
  const usage=spawnSync('node',[cli,'--dir','relative'],{encoding:'utf8'});assert.equal(usage.status,2);
});
