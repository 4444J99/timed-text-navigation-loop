const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {exportRendition}=require('../export-rendition.cjs'),{verifyRendition,parse,psnr,chroma,DEFAULT_MIN_PSNR,MIN_CHROMA_PSNR}=require('../verify-rendition.cjs');

const tool=n=>spawnSync(n,['-version']).status===0,have=tool('ffmpeg')&&tool('ffprobe'),ci=!['','0','false'].includes(String(process.env.CI||'').toLowerCase()),skip=!ci&&!have&&'ffmpeg/ffprobe not installed';// on CI a missing ffmpeg must fail the run, never skip it silently
const OPTS={seed:45,encounters:2,fps:10,width:320,height:180};
let root,good,other;

before(async()=>{
  if(!have){if(ci)throw new Error('ffmpeg and ffprobe are required when CI is set: the rendition tests must run there, not skip');return;}
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
  const r=await verifyRendition(d);assert.deepEqual(failed(r),['decoded audio carries the tone inside every cue window',"decoded audio in every cue window is the cue's own pitch"]);
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

// Cold-review findings (PR 75): each probe below passed the original verifier.
const R=require('../rendition.js'),{parse:exportParse}=require('../export-rendition.cjs');
function remuxAudio(name,makePcm){
  const d=copy(name),receipt=JSON.parse(fs.readFileSync(path.join(d,'receipt.json'))),run=R.simulateRun(receipt.seed,receipt.encounters),cue=R.cueTrack(run);
  fs.writeFileSync(path.join(d,'alt.wav'),R.wav(makePcm(cue),cue.sampleRate));
  const r=spawnSync('ffmpeg',['-v','error','-y','-i',path.join(d,'rendition.mp4'),'-i',path.join(d,'alt.wav'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','96k',path.join(d,'t.mp4')],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);fs.renameSync(path.join(d,'t.mp4'),path.join(d,'rendition.mp4'));fs.rmSync(path.join(d,'alt.wav'));return d;
}
function inWindows(cue,fn){const pcm=new Int16Array(cue.pcm.length);for(const c of cue.cues){const s0=Math.floor(c.ms*cue.sampleRate/1000),len=Math.floor(c.lengthMs*cue.sampleRate/1000);
  for(let i=0;i<len&&s0+i<pcm.length;i++)pcm[s0+i]=Math.round(fn(i,cue.sampleRate)*Math.min(1,i/220,(len-i)/220)*0.3*32767);}return pcm;}

test('loud sound of the wrong pitch inside every cue window is rejected, not just silence',{skip},async()=>{
  const d=remuxAudio('wrongpitch',cue=>inWindows(cue,(i,sr)=>Math.sin(2*Math.PI*3000*i/sr)));
  assert.deepEqual(failed(await verifyRendition(d)),["decoded audio in every cue window is the cue's own pitch"]);
  const n=remuxAudio('noise',cue=>inWindows(cue,(i)=>{let h=Math.imul(i+1,2654435761)>>>0;h^=h>>>15;h=Math.imul(h,2246822519)>>>0;h^=h>>>13;return (h/4294967295)*2-1;}));// white noise from an integer hash, not a gated square wave
  assert.deepEqual(failed(await verifyRendition(n)),["decoded audio in every cue window is the cue's own pitch"]);
});

test('a quiet tone mixed under the whole track (below the old 1500 floor) is caught outside the cue windows',{skip},async()=>{
  const d=remuxAudio('hidden',cue=>Int16Array.from(cue.pcm,(v,i)=>Math.round(v+800*Math.sin(2*Math.PI*1000*i/cue.sampleRate))));
  assert.deepEqual(failed(await verifyRendition(d)),['decoded audio is silent outside the cue windows']);
});

test('extra audio, subtitle or data streams smuggled into the container are rejected',{skip},async()=>{
  const a=copy('extra-a'),pa=path.join(a,'rendition.mp4');
  let r=spawnSync('ffmpeg',['-v','error','-y','-i',pa,'-f','lavfi','-t','1','-i','sine=frequency=800:sample_rate=22050','-map','0','-map','1:a','-c','copy','-c:a:1','aac',path.join(a,'t.mp4')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  fs.renameSync(path.join(a,'t.mp4'),pa);assert.deepEqual(failed(await verifyRendition(a)),['the file holds exactly one video and one audio stream and nothing else']);
  const s=copy('extra-s'),ps=path.join(s,'rendition.mp4');fs.writeFileSync(path.join(s,'s.srt'),'1\n00:00:00,000 --> 00:00:01,000\nHIDDEN\n');
  r=spawnSync('ffmpeg',['-v','error','-y','-i',ps,'-i',path.join(s,'s.srt'),'-map','0','-map','1','-c','copy','-c:s','mov_text',path.join(s,'t.mp4')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  fs.renameSync(path.join(s,'t.mp4'),ps);assert.deepEqual(failed(await verifyRendition(s)),['the file holds exactly one video and one audio stream and nothing else']);
});

test('a small localised edit that keeps whole-frame PSNR above 30 dB is caught by the per-block check',{skip},async()=>{
  const d=remux('patch',['-vf','drawbox=x=100:y=60:w=4:h=4:color=white:t=fill','-c:v','libx264','-crf','12','-pix_fmt','yuv420p','-c:a','copy']);
  const r=await verifyRendition(d),f=failed(r);
  assert.ok(r.metrics.minPsnrDb>=DEFAULT_MIN_PSNR,'whole-frame PSNR alone would pass: '+r.metrics.minPsnrDb);
  assert.deepEqual(f,[f.find(n=>/16x16 luma block/.test(n))]);
});

test('receipt free text and extra fields are pinned, so a receipt cannot be edited to claim more',{skip},async()=>{
  const names=['receipt carries exactly the exporter\'s fields and its fixed kind and claims text'];
  const a=copy('claims');edit(a,r=>{r.claims='Approved by the artist';});assert.deepEqual(failed(await verifyRendition(a)),names);
  const b=copy('kind');edit(b,r=>{r.kind='captured from the browser artwork';});assert.deepEqual(failed(await verifyRendition(b)),names);
  const c=copy('extra');edit(c,r=>{r.extra={approved:true};});assert.deepEqual(failed(await verifyRendition(c)),names);
  const e=copy('filename');edit(e,r=>{r.file.name='other.mp4';});assert.deepEqual(failed(await verifyRendition(e)),names);
});

test('absurd frame sizes in a receipt fail a named check instead of throwing; the exporter shares the ceiling',{skip},async()=>{
  const d=copy('huge');edit(d,r=>{r.video.width=40000;r.video.height=40000;});
  assert.deepEqual(failed(await verifyRendition(d)),['receipt parameters are within the exporter limits']);
  assert.throws(()=>exportParse(['--out','/x','--width','8000']),/even width/);
});

test('the per-block check also covers the partial tiles along the bottom and right edges',{skip},async()=>{
  // 320x180: 180 is not a multiple of 16, so rows 176-179 only exist in a partial tile.
  const d=remux('edge-bottom',['-vf','drawbox=x=100:y=176:w=4:h=4:color=white:t=fill','-c:v','libx264','-crf','12','-pix_fmt','yuv420p','-c:a','copy']);
  const f=failed(await verifyRendition(d));assert.ok(f.some(n=>/16x16 luma block/.test(n)),f.join('|'));
  const {worstBlockPsnr}=require('../verify-rendition.cjs'),w=170,h=90,a=new Float64Array(w*h),b=new Float64Array(w*h);
  for(let y=86;y<90;y++)for(let x=166;x<170;x++)b[y*w+x]=255;// corner pixels beyond the last full 16x16 tile in both axes
  assert.ok(worstBlockPsnr(a,b,w,h)<20,'a 4x4 edit in the bottom-right partial tile must score below the floor');
  assert.equal(worstBlockPsnr(a,a,w,h),Infinity);
});

// Fresh cold review of PR 80 (issues 91, 92, 93, 96, 97, 98, 101): each probe below passed the hardened verifier.
function wavBytes(channels,rate,interleaved){
  const data=Buffer.alloc(interleaved.length*2);interleaved.forEach((v,i)=>data.writeInt16LE(v,i*2));
  const h=Buffer.alloc(44);h.write('RIFF',0);h.writeUInt32LE(36+data.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(channels,22);
  h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*channels*2,28);h.writeUInt16LE(channels*2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
  return Buffer.concat([h,data]);
}
function remuxWav(name,makeWav,codecArgs=[]){
  const d=copy(name);fs.writeFileSync(path.join(d,'alt.wav'),makeWav(R.cueTrack(R.simulateRun(JSON.parse(fs.readFileSync(path.join(d,'receipt.json'))).seed,JSON.parse(fs.readFileSync(path.join(d,'receipt.json'))).encounters))));
  const r=spawnSync('ffmpeg',['-v','error','-y','-i',path.join(d,'rendition.mp4'),'-i',path.join(d,'alt.wav'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','96k',...codecArgs,path.join(d,'t.mp4')],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);fs.renameSync(path.join(d,'t.mp4'),path.join(d,'rendition.mp4'));fs.rmSync(path.join(d,'alt.wav'));return d;
}
const MONO='audio stream is mono at the cue track\'s sample rate';

test('a second voice carried only in the stereo side channel is rejected, not cancelled by a mono downmix',{skip},async()=>{
  const d=remuxWav('stereo-side',cue=>{
    const n=cue.pcm.length,out=new Array(n*2);
    for(let i=0;i<n;i++){const s=Math.round(6000*Math.sin(2*Math.PI*1000*i/cue.sampleRate));out[2*i]=Math.max(-32768,Math.min(32767,cue.pcm[i]+s));out[2*i+1]=Math.max(-32768,Math.min(32767,cue.pcm[i]-s));}
    return wavBytes(2,cue.sampleRate,out);
  });
  assert.ok(failed(await verifyRendition(d)).includes(MONO));
});

test('a tone above the old 22.05 kHz-resampled band is rejected because the source sample rate must be the cue track\'s',{skip},async()=>{
  const d=remuxWav('hf',cue=>{
    const rate=48000,n=Math.round(cue.pcm.length*rate/cue.sampleRate),out=new Array(n),fade=Math.round(rate*0.1);
    for(let i=0;i<n;i++){const env=Math.min(1,i/fade,(n-i)/fade);out[i]=Math.round(2000*env*Math.sin(2*Math.PI*14000*i/rate));}
    return wavBytes(1,rate,out);
  });
  assert.ok(failed(await verifyRendition(d)).includes(MONO));
});

test('a second tone at 0.7 of the cue amplitude inside every window fails the pitch check',{skip},async()=>{
  const d=remuxAudio('second-tone',cue=>{const pcm=new Int16Array(cue.pcm.length);
    for(const c of cue.cues){const s0=Math.floor(c.ms*cue.sampleRate/1000),len=Math.floor(c.lengthMs*cue.sampleRate/1000);
      for(let i=0;i<len&&s0+i<pcm.length;i++)pcm[s0+i]=Math.round((Math.sin(2*Math.PI*c.hz*i/cue.sampleRate)+0.7*Math.sin(2*Math.PI*2500*i/cue.sampleRate))/1.7*0.3*32767*Math.min(1,i/220,(len-i)/220));}
    return pcm;});
  assert.ok(failed(await verifyRendition(d)).includes("decoded audio in every cue window is the cue's own pitch"));
});

test('duplicate keys in receipt.json are rejected: the file must be the exporter\'s canonical serialisation',{skip},async()=>{
  const d=copy('dupkeys'),p=path.join(d,'receipt.json'),text=fs.readFileSync(p,'utf8');
  fs.writeFileSync(p,text.replace('{\n','{\n  "claims": "APPROVED by the artist; accessibility reviewed",\n  "seed": 99,\n'));
  assert.ok(failed(await verifyRendition(d)).includes('receipt.json is the exporter\'s canonical serialisation of its own content (duplicate keys, extra whitespace and escapes fail; key order is the file\'s own)'));
  const w=copy('whitespace');fs.writeFileSync(path.join(w,'receipt.json'),JSON.stringify(JSON.parse(fs.readFileSync(path.join(good,'receipt.json'),'utf8'))));
  assert.ok(failed(await verifyRendition(w)).includes('receipt.json is the exporter\'s canonical serialisation of its own content (duplicate keys, extra whitespace and escapes fail; key order is the file\'s own)'));
});

test('receipt file.ffmpeg must be an ffmpeg version line, not free text',{skip},async()=>{
  const d=copy('ffmpeg-text');edit(d,r=>{r.file.ffmpeg='ffmpeg 9.0.2 -- APPROVED BY THE ARTIST, accessibility reviewed';});
  assert.deepEqual(failed(await verifyRendition(d)),['receipt carries exactly the exporter\'s fields and its fixed kind and claims text']);
});

test('a seed the exporter would never write (outside 0..2^32-1) is rejected even though the run normalises it',{skip},async()=>{
  for(const [name,seed] of [['seed-high',OPTS.seed+2**32],['seed-neg',OPTS.seed-2**32]]){
    const d=copy(name);edit(d,r=>{r.seed=seed;});
    assert.ok(failed(await verifyRendition(d)).includes('receipt parameters are within the exporter limits'),name);
  }
});

test('cue-track.wav that is a directory fails a named check instead of throwing',{skip},async()=>{
  const d=copy('wavdir');fs.rmSync(path.join(d,'cue-track.wav'));fs.mkdirSync(path.join(d,'cue-track.wav'));
  assert.deepEqual(failed(await verifyRendition(d)),['present: cue-track.wav']);
  const cli=spawnSync('node',[path.join(__dirname,'..','verify-rendition.cjs'),'--dir',d],{encoding:'utf8'});assert.equal(cli.status,1);
});

test('the ffmpeg version line pattern accepts distro, static (with a URL) and git builds and still refuses free text',{skip},async()=>{
  for(const [name,line,ok] of [
    ['distro','ffmpeg version 6.1.1-3ubuntu5 Copyright (c) 2000-2023 the FFmpeg developers',true],
    ['static','ffmpeg version 7.0.2-static https://johnvansickle.com/ffmpeg/  Copyright (c) 2000-2024 the FFmpeg developers',true],
    ['git','ffmpeg version N-117000-gabcdef0123-20240901 Copyright (c) 2000-2024 the FFmpeg developers',true],
    ['text','ffmpeg version 9.0.2 APPROVED BY THE ARTIST Copyright (c) 2000-2026 the FFmpeg developers',false],
    ['trailing','ffmpeg version 9.0.2 Copyright (c) 2000-2026 the FFmpeg developers; accessibility reviewed',false]]){
    const d=copy('ffline-'+name);edit(d,r=>{r.file.ffmpeg=line;});
    assert.equal(failed(await verifyRendition(d)).length===0,ok,name);
  }
});

// Second independent review of PR 103 (head 28fdfa5).
// A build URL with words in its host or path still passes: the field is recorded, not verifiable (README).
test('the ffmpeg version line refuses hyphenated free text and odd characters, not only text with spaces',{skip},async()=>{
  for(const [name,line] of [
    ['hyphens','ffmpeg version APPROVED-BY-THE-ARTIST,accessibility-reviewed Copyright (c) 2000-2026 the FFmpeg developers'],
    ['rlo','ffmpeg version 9.0.2‮ Copyright (c) 2000-2026 the FFmpeg developers'],
    ['year','ffmpeg version 9.0.2 Copyright (c) - the FFmpeg developers']]){
    const d=copy('ffline2-'+name);edit(d,r=>{r.file.ffmpeg=line;});
    assert.ok(failed(await verifyRendition(d)).length>0,name);
  }
});

test('a receipt with bytes the exporter would never write (invalid UTF-8) fails the canonical check',{skip},async()=>{
  const d=copy('badutf8'),p=path.join(d,'receipt.json'),raw=fs.readFileSync(p);
  const at=raw.indexOf(Buffer.from('ffmpeg version'));assert.ok(at>0);
  fs.writeFileSync(p,Buffer.concat([raw.subarray(0,at),Buffer.from([0xff]),raw.subarray(at)]));
  assert.ok(failed(await verifyRendition(d)).some(n=>/canonical serialisation/.test(n)));
});

test('the tone-ratio floor sits between a second tone at 0.35 and at 0.55 of the cue amplitude',{skip},async()=>{
  for(const [name,amp,passes] of [['tone-35',0.35,true],['tone-55',0.55,false]]){
    const d=remuxAudio(name,cue=>{const pcm=new Int16Array(cue.pcm.length);
      for(const c of cue.cues){const s0=Math.floor(c.ms*cue.sampleRate/1000),len=Math.floor(c.lengthMs*cue.sampleRate/1000);
        for(let i=0;i<len&&s0+i<pcm.length;i++)pcm[s0+i]=Math.round((Math.sin(2*Math.PI*c.hz*i/cue.sampleRate)+amp*Math.sin(2*Math.PI*2500*i/cue.sampleRate))/(1+amp)*0.3*32767*Math.min(1,i/220,(len-i)/220));}
      return pcm;});
    const f=failed(await verifyRendition(d));
    assert.equal(f.includes("decoded audio in every cue window is the cue's own pitch"),!passes,name+' '+f.join('|'));
  }
});

const sha=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
function editVtt(dir,fn){const p=path.join(dir,'captions.vtt'),t=fn(fs.readFileSync(p,'utf8'));fs.writeFileSync(p,t);return sha(Buffer.from(t));}

test('captions: a fresh v2 export verifies its captions.vtt byte for byte and by receipt digest',{skip},async()=>{
  const r=await verifyRendition(good),names=r.checks.map(c=>c.name);
  for(const n of['present: captions.vtt','captions.vtt on disk is byte-identical to the replayed captions','captions SHA-256 and cue count in the receipt re-derive','captions.vtt is strict WebVTT, one caption per cue, starting on the cue and ending by the shared caption rule'])assert.ok(names.includes(n),n);
  assert.deepEqual(failed(r),[]);assert.equal(JSON.parse(fs.readFileSync(path.join(good,'receipt.json'))).schema,'hole-loop.rendition-receipt.v2');
});

test('captions: reworded text with a re-forged receipt digest is still caught against the replay; so is a forged digest alone',{skip},async()=>{
  const a=copy('capword'),h=editVtt(a,t=>t.replace('Chamber ','Room '));edit(a,r=>{r.captions.sha256=h;});
  assert.deepEqual(failed(await verifyRendition(a)),['captions.vtt on disk is byte-identical to the replayed captions','captions SHA-256 and cue count in the receipt re-derive']);
  const b=copy('capdigest');edit(b,r=>{r.captions.sha256='0'.repeat(64);});
  assert.deepEqual(failed(await verifyRendition(b)),['captions SHA-256 and cue count in the receipt re-derive']);
  const c=copy('capcount');edit(c,r=>{r.captions.cues+=1;});
  assert.deepEqual(failed(await verifyRendition(c)),['captions SHA-256 and cue count in the receipt re-derive']);
});

test('captions: retimed, markup-bearing or truncated files fail the strict WebVTT check as well as the byte comparison (the receipt still matches the replay)',{skip},async()=>{
  const want=['captions.vtt on disk is byte-identical to the replayed captions'];
  const a=copy('capretime');editVtt(a,t=>t.replace('00:00:02.184 --> ','00:00:02.000 --> '));
  assert.deepEqual(failed(await verifyRendition(a)),[want[0],'captions.vtt is strict WebVTT, one caption per cue, starting on the cue and ending by the shared caption rule']);
  const b=copy('capmarkup');editVtt(b,t=>t.replace('Chamber ','<script>x</script>Chamber '));
  assert.deepEqual(failed(await verifyRendition(b)),[want[0],'captions.vtt is strict WebVTT, one caption per cue, starting on the cue and ending by the shared caption rule']);
  const c=copy('captrunc');editVtt(c,t=>t.slice(0,t.lastIndexOf('cue-3')));
  const fc=failed(await verifyRendition(c));assert.ok(fc.includes(want[0])&&fc.includes('captions.vtt is strict WebVTT, one caption per cue, starting on the cue and ending by the shared caption rule')&&!fc.includes('captions SHA-256 and cue count in the receipt re-derive'),fc.join('|'));
});

test('captions: a missing captions.vtt is named, and a v2 receipt may not drop or rename its captions block',{skip},async()=>{
  const a=copy('capmissing');fs.rmSync(path.join(a,'captions.vtt'));
  assert.deepEqual(failed(await verifyRendition(a)),['present: captions.vtt']);
  const b=copy('capdrop');edit(b,r=>{delete r.captions;});
  assert.ok(failed(await verifyRendition(b)).includes("receipt carries exactly the exporter's fields and its fixed kind and claims text"));
  const c=copy('caprename');edit(c,r=>{r.captions.file='../elsewhere.vtt';});
  assert.ok(failed(await verifyRendition(c)).includes("receipt carries exactly the exporter's fields and its fixed kind and claims text"));
});

test('captions: a v1 receipt (no captions) from before the sidecar still verifies, and cannot smuggle a captions block',{skip},async()=>{
  const a=copy('v1');edit(a,r=>{r.schema='hole-loop.rendition-receipt.v1';delete r.captions;});fs.rmSync(path.join(a,'captions.vtt'));
  const r=await verifyRendition(a);assert.deepEqual(failed(r),[]);assert.ok(r.checks.some(c=>/v1 receipt predates the captions sidecar/.test(c.name)&&c.ok));
  const b=copy('v1captions');edit(b,r=>{r.schema='hole-loop.rendition-receipt.v1';});
  const fb=failed(await verifyRendition(b));assert.ok(fb.includes("receipt carries exactly the exporter's fields and its fixed kind and claims text"),fb.join('|'));
});

test('captions: a v1 receipt cannot hide a sidecar, and a captions.vtt that is a directory is a named failure, not a crash',{skip},async()=>{
  const a=copy('v1downgrade');edit(a,r=>{r.schema='hole-loop.rendition-receipt.v1';delete r.captions;});
  assert.deepEqual(failed(await verifyRendition(a)),['captions: a v1 receipt predates the captions sidecar, so none is claimed or left beside it']);
  const b=copy('capdir');fs.rmSync(path.join(b,'captions.vtt'));fs.mkdirSync(path.join(b,'captions.vtt'));
  assert.deepEqual(failed(await verifyRendition(b)),['present: captions.vtt']);
});

// Final independent review of PR 103 (head abfbb52).
test('a receipt written on a CRLF host (version line ending in a carriage return) still verifies, and the digit lookahead is pinned',{skip},async()=>{
  const d=copy('crlf');edit(d,r=>{r.file.ffmpeg+='\r';});
  assert.deepEqual(failed(await verifyRendition(d)),[]);
  const t=copy('nodigit');edit(t,r=>{r.file.ffmpeg='ffmpeg version APPROVED-BY-THE-ARTIST Copyright (c) 2000-2026 the FFmpeg developers';});
  assert.ok(failed(await verifyRendition(t)).length>0);
});

test('receipt.json, rendition.mp4 and cue-track.wav must be regular files, not symlinks',{skip},async()=>{
  for(const f of['receipt.json','rendition.mp4','cue-track.wav']){
    const d=copy('link-'+f),p=path.join(d,f),real=path.join(root,'real-'+f);
    fs.copyFileSync(p,real);fs.rmSync(p);fs.symlinkSync(real,p);
    assert.deepEqual(failed(await verifyRendition(d)),['present: '+f],f);
  }
});

// Issue 95: chroma was never compared, so a colour change that keeps luma passed.
test('a fully greyscale re-encode (hue=s=0) fails the named chroma check and nothing else',{skip},async()=>{
  const d=remux('grey',['-vf','hue=s=0','-c:v','libx264','-crf','12','-pix_fmt','yuv420p','-c:a','copy']);
  const r=await verifyRendition(d),f=failed(r);
  assert.ok(r.metrics.minPsnrDb>=DEFAULT_MIN_PSNR,'luma PSNR alone would pass: '+r.metrics.minPsnrDb);
  assert.deepEqual(f,[f.find(n=>/U\/V chroma PSNR/.test(n))]);
  assert.ok(r.metrics.minChromaPsnrDb<MIN_CHROMA_PSNR-10,'greyscale is far below the floor, not marginally: '+r.metrics.minChromaPsnrDb);
});

test('honest exports keep the chroma check well above its floor across seeds and sizes',{skip},async()=>{
  for(const [name,o] of [['c-seed7',{seed:7,encounters:2,fps:10,width:320,height:180}],['c-small',{seed:0,encounters:1,fps:10,width:160,height:90}]]){
    const d=path.join(root,name);await exportRendition({...o,out:d});
    const r=await verifyRendition(d);assert.deepEqual(failed(r),[],name);
    assert.ok(r.metrics.minChromaPsnrDb>=MIN_CHROMA_PSNR+5,name+' '+r.metrics.minChromaPsnrDb);
  }
});

test('chroma: identical frames are infinite and a grey frame against a coloured one is far below the floor',()=>{
  const w=4,h=2,rgb=Uint8Array.from({length:w*h*3},(_,i)=>i%3===0?200:20),grey=new Uint8Array(w*h*3).fill(90),a=new Float64Array(w*h/2),b=new Float64Array(w*h/2);
  assert.equal(psnr(chroma(rgb,w,h,a),chroma(rgb,w,h,b)),Infinity);
  assert.ok(psnr(chroma(rgb,w,h,a),chroma(grey,w,h,b))<MIN_CHROMA_PSNR-10);
  assert.ok(chroma(grey,w,h,b).every(v=>Math.abs(v)<1e-9),'a grey pixel has zero chroma');
});
