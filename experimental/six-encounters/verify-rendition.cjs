#!/usr/bin/env node
/* Replay verifier for an exported rendition directory.
 *
 *   node verify-rendition.cjs --dir /absolute/dir [--min-psnr 30]
 *
 * Reads receipt.json, rendition.mp4 and cue-track.wav from --dir and re-derives everything the receipt claims from
 * nothing but the receipt's own seed, encounter count, fps and frame size: the route timeline, the SHA-256 of the raw
 * frame stream, the cue list, the cue-track WAV bytes. It then decodes the MP4 with ffmpeg and compares every decoded
 * frame to the frame re-rendered from the seed (PSNR), and decodes the AAC track to check that sound sits inside the
 * cue windows and silence outside them. Exit status is 0 only when every check passes.
 *
 * Needs ffmpeg and ffprobe on PATH. Mechanical evidence only: it asserts nothing about artistic, accessibility, device
 * or audience acceptance. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn,spawnSync}=require('node:child_process');
const R=require('./rendition.js'),G=require('./generation.js');

const SCHEMA='hole-loop.rendition-receipt.v1';
const DEFAULT_MIN_PSNR=30;// measured: replayed seed 36.7 dB worst frame, a different seed 5.5 dB

function parse(argv){
  const o={dir:null,'min-psnr':DEFAULT_MIN_PSNR};
  for(let i=0;i<argv.length;i+=2){
    const k=argv[i].replace(/^--/,''),v=argv[i+1];
    if(!(k in o)||v===undefined)throw new Error('usage: verify-rendition.cjs --dir ABSOLUTE_DIR [--min-psnr N]');
    o[k]=k==='dir'?v:Number(v);
  }
  if(!o.dir||!path.isAbsolute(o.dir))throw new Error('--dir must be an absolute directory');
  if(!Number.isFinite(o['min-psnr'])||o['min-psnr']<=0)throw new Error('--min-psnr must be a positive number');
  return{dir:o.dir,minPsnr:o['min-psnr']};
}

const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');

/** Stream decoded rgb24 frames out of the file, calling visit(frameIndex, Buffer) for each complete frame. */
function decodeFrames(mp4Path,width,height,visit){
  return new Promise((resolve,reject)=>{
    const size=width*height*3,ff=spawn('ffmpeg',['-v','error','-i',mp4Path,'-an','-f','rawvideo','-pix_fmt','rgb24','-'],{stdio:['ignore','pipe','pipe']});
    let pending=Buffer.alloc(0),index=0,err='';
    ff.stderr.on('data',d=>{err+=d;});
    ff.stdout.on('data',chunk=>{
      pending=pending.length?Buffer.concat([pending,chunk]):chunk;
      while(pending.length>=size){visit(index++,pending.subarray(0,size));pending=pending.subarray(size);}
    });
    ff.on('error',reject);
    ff.on('close',code=>code===0?resolve({frames:index,trailingBytes:pending.length}):reject(new Error('ffmpeg decode exited '+code+': '+err.slice(-800))));
  });
}

function decodeAudio(mp4Path,sampleRate){
  const r=spawnSync('ffmpeg',['-v','error','-i',mp4Path,'-vn','-ac','1','-ar',String(sampleRate),'-f','s16le','-'],{maxBuffer:1<<28});
  if(r.status!==0)throw new Error('ffmpeg audio decode failed: '+String(r.stderr).slice(-800));
  const b=r.stdout;return new Int16Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.length-(b.length%2)));
}

/** BT.601 luma of an rgb24 frame. Compared in luma because 4:2:0 chroma subsampling smears one-pixel coloured edges
 *  on every conforming encoder, while the glyph shapes and positions the replay must reproduce live in luma. */
function luma(rgb,out){for(let i=0,j=0;i<rgb.length;i+=3,j++)out[j]=.299*rgb[i]+.587*rgb[i+1]+.114*rgb[i+2];return out;}
function psnr(a,b){
  let se=0;for(let i=0;i<a.length;i++){const d=a[i]-b[i];se+=d*d;}
  return se===0?Infinity:10*Math.log10(255*255*a.length/se);
}

/** Verify one exported directory. Resolves to {ok, checks:[{name,ok,detail}], metrics}; rejects only on tool failure. */
async function verifyRendition(dir,options={}){
  const minPsnr=options.minPsnr===undefined?DEFAULT_MIN_PSNR:options.minPsnr;
  const checks=[],metrics={};
  const check=(name,ok,detail)=>{checks.push({name,ok:Boolean(ok),detail:detail===undefined?'':String(detail)});return Boolean(ok);};
  const receiptPath=path.join(dir,'receipt.json'),mp4Path=path.join(dir,'rendition.mp4'),wavPath=path.join(dir,'cue-track.wav');
  for(const f of[receiptPath,mp4Path,wavPath])if(!check('present: '+path.basename(f),fs.existsSync(f),f))return{ok:false,checks,metrics};
  let receipt;
  try{receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));}catch(e){check('receipt.json parses',false,e.message);return{ok:false,checks,metrics};}
  if(!check('receipt schema',receipt.schema===SCHEMA,receipt.schema))return{ok:false,checks,metrics};
  const v=receipt.video||{},fps=v.fps,width=v.width,height=v.height;
  const shape=Number.isInteger(receipt.seed)&&Number.isInteger(receipt.encounters)&&[fps,width,height].every(Number.isInteger);
  if(!check('receipt carries seed, encounters, fps and frame size',shape,JSON.stringify({seed:receipt.seed,encounters:receipt.encounters,fps,width,height})))return{ok:false,checks,metrics};
  if(!check('receipt parameters are within the exporter limits',receipt.encounters>=1&&receipt.encounters<=64&&fps>=1&&fps<=60&&width>=160&&height>=90&&width%2===0&&height%2===0,'')) return{ok:false,checks,metrics};

  // 1. Route timeline, re-derived from the seed through the real RouteSession.
  const run=R.simulateRun(receipt.seed,receipt.encounters);
  check('config version matches',receipt.configVersion===run.configVersion,receipt.configVersion+' vs '+run.configVersion);
  check('duration matches the re-derived run',receipt.durationMs===run.durationMs,receipt.durationMs+' vs '+run.durationMs);
  check('timings match the configuration',receipt.timings&&receipt.timings.entryMs===G.config.entry&&receipt.timings.exitMs===G.config.exit&&receipt.timings.maxExposureMs===G.config.exposure,JSON.stringify(receipt.timings));
  const derivedTimeline=run.timeline.map(e=>({index:e.index,chamber:e.chamber,background:e.background,seed:e.seed,motion:e.motion,direction:e.direction,colors:e.colors,
    chosenWord:e.links[e.chosen].word,next:run.timeline[e.index+1]?run.timeline[e.index+1].chamber:null,enterStart:e.enterStart,activeStart:e.activeStart,exitStart:e.exitStart,end:e.end}));
  const timelineOk=JSON.stringify(derivedTimeline)===JSON.stringify(receipt.timeline);
  check('route timeline re-derives from the seed',timelineOk,timelineOk?derivedTimeline.map(e=>e.chamber).join(' > '):'receipt timeline differs from the replay');
  if(Array.isArray(receipt.timeline)&&receipt.timeline.length===run.timeline.length){
    const bad=run.timeline.filter((e,i)=>{const w=e.links[e.chosen];return!G.config.routes[e.chamber].some(r=>r.word===w.word&&r.target===w.target)||(i+1<run.timeline.length&&run.timeline[i+1].chamber!==w.target);});
    check('every followed word is a legal route to the next chamber',bad.length===0,bad.length+' illegal');
  }
  const frames=R.frameCount(run,fps);
  check('frame count matches duration and fps',v.frames===frames,v.frames+' vs '+frames);

  // 2. Raw frame stream hash, re-derived.
  const hash=crypto.createHash('sha256'),size=width*height*3,buf=new Uint8Array(size);
  for(let i=0;i<frames;i++){R.renderFrame(run,R.frameTime(i,fps),width,height,buf);hash.update(buf);}
  const frameHash=hash.digest('hex');
  check('raw frame stream SHA-256 re-derives from the seed',frameHash===v.frameStreamSha256,frameHash===v.frameStreamSha256?frameHash:'receipt '+v.frameStreamSha256+' replay '+frameHash);

  // 3. Cue track, re-derived and compared to the receipt and to the file on disk.
  const cue=R.cueTrack(run),wavBytes=R.wav(cue.pcm,cue.sampleRate),cueClaim=receipt.cueTrack||{};
  check('cue list re-derives from the seed',JSON.stringify(cue.cues)===JSON.stringify(cueClaim.cues),cue.cues.length+' cues');
  check('cue sample rate and length match',cueClaim.sampleRate===cue.sampleRate&&cueClaim.samples===cue.pcm.length,cueClaim.samples+' vs '+cue.pcm.length);
  check('cue track SHA-256 re-derives from the seed',sha256(wavBytes)===cueClaim.wavSha256,sha256(wavBytes));
  const fileWav=fs.readFileSync(wavPath);
  check('cue-track.wav on disk is byte-identical to the replay',fileWav.equals(wavBytes),fileWav.length+' bytes on disk, '+wavBytes.length+' replayed');

  // 4. The container, as ffprobe reads it.
  const probe=spawnSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_name,codec_type,width,height,nb_read_frames:format=duration','-of','json',mp4Path],{encoding:'utf8'});
  if(!check('ffprobe reads the file',probe.status===0,probe.stderr))return{ok:false,checks,metrics};
  const info=JSON.parse(probe.stdout),vs=info.streams.find(s=>s.codec_type==='video'),as=info.streams.find(s=>s.codec_type==='audio');
  check('video stream is H.264 at the receipt size',vs&&vs.codec_name==='h264'&&vs.width===width&&vs.height===height,vs&&vs.codec_name+' '+vs.width+'x'+vs.height);
  check('decodable video frames equal the receipt',vs&&Number(vs.nb_read_frames)===frames,vs&&vs.nb_read_frames);
  check('audio stream is AAC',as&&as.codec_name==='aac',as&&as.codec_name);
  const dur=Number(info.format.duration);metrics.containerDurationSec=dur;
  check('container duration is within 0.25 s of the timeline',Math.abs(dur-run.durationMs/1000)<0.25,dur+' vs '+run.durationMs/1000);
  check('file facts in the receipt match ffprobe',receipt.file&&receipt.file.videoCodec==='h264'&&receipt.file.audioCodec==='aac'&&receipt.file.decodedVideoFrames===frames&&receipt.file.width===width&&receipt.file.height===height,JSON.stringify(receipt.file));

  // 5. Decode every video frame and compare to the frame re-rendered from the seed.
  const psnrs=[],lumaA=new Float64Array(width*height),lumaB=new Float64Array(width*height);
  const decoded=await decodeFrames(mp4Path,width,height,(i,frame)=>{
    if(i>=frames)return;
    R.renderFrame(run,R.frameTime(i,fps),width,height,buf);
    psnrs.push(psnr(luma(buf,lumaA),luma(frame,lumaB)));
  });
  check('decoded frame count equals the receipt',decoded.frames===frames&&decoded.trailingBytes===0,decoded.frames+' frames, '+decoded.trailingBytes+' stray bytes');
  const finite=psnrs.filter(Number.isFinite),worst=psnrs.length?Math.min(...psnrs):0;
  metrics.frames=psnrs.length;metrics.minPsnrDb=Number.isFinite(worst)?Number(worst.toFixed(2)):'lossless';
  metrics.meanPsnrDb=finite.length?Number((finite.reduce((a,b)=>a+b,0)/finite.length).toFixed(2)):'lossless';
  const weakest=psnrs.indexOf(worst);
  check('every decoded frame is within '+minPsnr+' dB luma PSNR of the replayed frame',psnrs.length===frames&&worst>=minPsnr,'min '+metrics.minPsnrDb+' dB at frame '+weakest+', mean '+metrics.meanPsnrDb+' dB');

  // 6. Decode the AAC track: tones inside the cue windows, near silence outside.
  const pcm=decodeAudio(mp4Path,cue.sampleRate);metrics.decodedAudioSamples=pcm.length;
  check('decoded audio length is within 0.25 s of the cue track',Math.abs(pcm.length-cue.pcm.length)<cue.sampleRate*0.25,pcm.length+' vs '+cue.pcm.length);
  const win=cue.cues.map(c=>[Math.floor(c.ms*cue.sampleRate/1000),Math.floor((c.ms+c.lengthMs)*cue.sampleRate/1000)]);
  const inside=new Uint8Array(Math.min(pcm.length,cue.pcm.length));
  for(const[a,b]of win)for(let i=a;i<b&&i<inside.length;i++)inside[i]=1;
  const guard=Math.floor(cue.sampleRate*0.06);// AAC priming and ringing spread a tone slightly past its window
  let loudIn=0,nearIn=0,loudOut=0,peakOut=0;
  for(let i=0;i<inside.length;i++){
    const a=Math.abs(pcm[i]);
    if(inside[i]){nearIn++;if(a>5000)loudIn++;}
    else{
      let near=false;for(const[s,e]of win)if(i>=s-guard&&i<e+guard){near=true;break;}
      if(!near){peakOut=Math.max(peakOut,a);if(a>1500)loudOut++;}
    }
  }
  metrics.audioPeakOutsideCues=peakOut;
  check('decoded audio carries the tones inside the cue windows',nearIn>0&&loudIn/nearIn>0.3,loudIn+' of '+nearIn+' window samples above 5000');
  check('decoded audio is silent outside the cue windows',loudOut===0,'peak '+peakOut+', '+loudOut+' samples above 1500');

  return{ok:checks.every(c=>c.ok),checks,metrics};
}

if(require.main===module){
  (async()=>{
    const o=parse(process.argv.slice(2)),report=await verifyRendition(o.dir,{minPsnr:o.minPsnr});
    for(const c of report.checks)process.stderr.write((c.ok?'ok   ':'FAIL ')+c.name+(c.detail?' ('+c.detail+')':'')+'\n');
    process.stdout.write(JSON.stringify({ok:report.ok,failed:report.checks.filter(c=>!c.ok).map(c=>c.name),metrics:report.metrics})+'\n');
    process.exit(report.ok?0:1);
  })().catch(e=>{process.stderr.write(String(e.message||e)+'\n');process.exit(2);});
}
module.exports={verifyRendition,parse,psnr,DEFAULT_MIN_PSNR};
