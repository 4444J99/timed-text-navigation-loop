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
  const r=await verifyRendition(t);
  assert.equal(r.ok,false);assert.ok(failed(r).length>0);
  const m=copy('missing');fs.rmSync(path.join(m,'cue-track.wav'));
  assert.deepEqual(failed(await verifyRendition(m)),['present: cue-track.wav']);
  const j=copy('json');fs.writeFileSync(path.join(j,'receipt.json'),'{not json');
  assert.deepEqual(failed(await verifyRendition(j)),['receipt.json parses']);
  const n=copy('null');fs.writeFileSync(path.join(n,'receipt.json'),'null');
  assert.deepEqual(failed(await verifyRendition(n)),['receipt schema']);
  const s=copy('schema');edit(s,r=>{r.schema='other';});
  assert.deepEqual(failed(await verifyRendition(s)),['receipt schema']);
  const x=copy('range');edit(x,r=>{r.encounters=65;});
  assert.deepEqual(failed(await verifyRendition(x)),['receipt parameters are within the exporter limits']);
});

function remux(name,args){
  const d=copy(name),src=path.join(d,'rendition.mp4'),out=path.join(d,'tampered.mp4');
  const r=spawnSync('ffmpeg',['-v','error','-y','-i',src,...args,out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  fs.renameSync(out,src);return d;
}

test('a silent cue window is caught even when the other windows still carry enough tone overall',{skip},async()=>{
  const d=remux('mute',['-c:v','copy','-af',"volume=0:enable='between(t,0,0.2)'",'-c:a','aac','-b:a','96k']);
  const r=await verifyRendition(d);assert.deepEqual(failed(r),['decoded audio carries the tone inside every cue window']);
});

test('sound appended after the cue track ends is caught as sound outside the cue windows',{skip},async()=>{
  const d=remux('tail',['-f','lavfi','-t','0.12','-i','sine=frequency=500:sample_rate=22050','-filter_complex','[0:a]aresample=22050,aformat=channel_layouts=mono[a0];[1:a]aformat=channel_layouts=mono[a1];[a0][a1]concat=n=2:v=0:a=1[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','96k']);
  const r=await verifyRendition(d);assert.ok(failed(r).includes('decoded audio is silent outside the cue windows'),failed(r).join('|'));
});

test('video timestamps that do not sit at index/fps are caught even when every frame decodes',{skip},async()=>{
  const d=remux('retime',['-c','copy','-bsf:v','setts=ts=TS*3/2']);
  const f=failed(await verifyRendition(d));
  assert.ok(f.includes('every video frame sits at index/fps on the timeline')||f.includes('video frame rate equals the receipt fps'),f.join('|'));
});

test('the command line exits 0 on a good directory and 1 on a tampered one, printing a JSON verdict',{skip},()=>{
  const cli=path.join(__dirname,'..','verify-rendition.cjs');
  const ok=spawnSync('node',[cli,'--dir',good],{encoding:'utf8'});assert.equal(ok.status,0);assert.equal(JSON.parse(ok.stdout).ok,true);
  const d=copy('cli');edit(d,r=>{r.seed=99;});
  const bad=spawnSync('node',[cli,'--dir',d],{encoding:'utf8'});assert.equal(bad.status,1);
  const v=JSON.parse(bad.stdout);assert.equal(v.ok,false);assert.ok(v.failed.length>=2);assert.match(bad.stderr,/FAIL route timeline/);
  const usage=spawnSync('node',[cli,'--dir','relative'],{encoding:'utf8'});assert.equal(usage.status,2);
});
