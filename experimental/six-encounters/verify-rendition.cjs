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
const R=require('./rendition.js'),G=require('./generation.js'),X=require('./export-rendition.cjs');

const SCHEMA_V1='hole-loop.rendition-receipt.v1',SCHEMA_V2='hole-loop.rendition-receipt.v2';// pinned, not imported: a future exporter schema must not silently redefine what this verifier accepts
const DEFAULT_MIN_PSNR=30;// measured over 40 honest exports (README, Calibration): worst frame 33.15 dB, so 3.1 dB of margin; a different seed scores 5.5 dB. Raising it much would leave under 1.2 dB to the honest minimum on encoders not measured
const DURATION_SLACK_SEC=0.05;// container timestamps are rounded to the stream time base on top of the half-frame rounding of the frame count
const BLOCK=16,MIN_BLOCK_PSNR=20;// measured over 40 honest exports (README, Calibration): worst 16x16 luma block 23.78 dB (seed 1, 320x180), so 3.8 dB of margin; a 4x4 edit scores below 20 dB. Edits that score 22.7 to 25.5 dB (README, Known residual) overlap the honest range and pass
const MIN_CHROMA_PSNR=25;// measured over 40 honest exports (README, Calibration): worst frame 34.64 dB (seed 1234, 160x90), a greyscale re-encode (hue=s=0) 8.5 to 8.9 dB
const MIN_TONE_RATIO=0.8,MAX_QUIET_PEAK=100;// see the audio checks; an honest AAC encode measures 0.94, a second tone at 0.7 of the cue amplitude 0.63
const GUARD_BAND_SEC=0.01,GUARD_BAND_PEAK=1000;// measured over 40 honest exports (README): the AAC ringing within 10 ms of a window peaks at 189 and beyond 10 ms at 14, so the band is 10 ms wide with a cap 5x the honest peak (was 60 ms, unchecked)
const FFMPEG_LINE=/^ffmpeg version (?=[A-Za-z0-9._+~:-]*\d)[A-Za-z0-9._+~:-]+(?: +https?:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._~\/-]*)?)? +Copyright \(c\) [0-9]{4}(?:-[0-9]{4})? the FFmpeg developers\r?$/;// the first line of `ffmpeg -version`, as the exporter records it: a version token with a digit, an optional build URL; recorded, not verifiable
const TOP_KEYS_V1=['schema','kind','configVersion','seed','encounters','durationMs','timings','video','cueTrack','timeline','file','claims'],TOP_KEYS_V2=[...TOP_KEYS_V1,'captions'];
const sameKeys=(o,keys)=>o!==null&&typeof o==='object'&&JSON.stringify(Object.keys(o).sort())===JSON.stringify([...keys].sort());

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

const lexists=f=>{try{fs.lstatSync(f);return true;}catch{return false;}};// a dangling symlink counts as something left beside the receipt
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
/** BT.601 chroma (U then V, offset-free) of an rgb24 frame, averaged over 2x2 tiles the way 4:2:0 stores it, into out (length width*height/2). Width and height are even. */
function chroma(rgb,width,height,out){
  const cw=width>>1,ch=height>>1,plane=cw*ch;
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
    let u=0,v=0;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const i=((2*y+dy)*width+2*x+dx)*3,r=rgb[i],g=rgb[i+1],b=rgb[i+2];u+=-.168736*r-.331264*g+.5*b;v+=.5*r-.418688*g-.081312*b;}
    out[y*cw+x]=u/4;out[plane+y*cw+x]=v/4;
  }
  return out;
}
function psnr(a,b){
  let se=0;for(let i=0;i<a.length;i++){const d=a[i]-b[i];se+=d*d;}
  return se===0?Infinity:10*Math.log10(255*255*a.length/se);
}

/** Worst PSNR over the non-overlapping BLOCKxBLOCK tiles (edge tiles smaller) of two luma planes: a localised edit that the whole-frame
 *  PSNR averages away still shows up in the tile it touches. */
function worstBlockPsnr(a,b,width,height){
  let worst=Infinity;
  // Tiles at the right and bottom edge are clamped to the frame, so no pixel escapes the check.
  for(let by=0;by<height;by+=BLOCK)for(let bx=0;bx<width;bx+=BLOCK){
    const bh=Math.min(BLOCK,height-by),bw=Math.min(BLOCK,width-bx);
    let se=0;for(let y=0;y<bh;y++){const o=(by+y)*width+bx;for(let x=0;x<bw;x++){const d=a[o+x]-b[o+x];se+=d*d;}}
    const p=se===0?Infinity:10*Math.log10(255*255*bw*bh/se);if(p<worst)worst=p;
  }
  return worst;
}

/** Share of a window's energy that sits at one frequency (Goertzel): about 1 for a pure tone, near 0 for any other sound. */
function toneRatio(pcm,a,b,hz,sampleRate){
  const end=Math.min(b,pcm.length),n=end-a;if(n<=0)return 0;
  const w=2*Math.PI*hz/sampleRate,k=2*Math.cos(w);let s1=0,s2=0,energy=0;
  for(let i=a;i<end;i++){const x=pcm[i],s0=x+k*s1-s2;s2=s1;s1=s0;energy+=x*x;}
  if(energy===0)return 0;
  const power=s1*s1+s2*s2-k*s1*s2;
  return 2*power/(n*energy);
}

/** Verify one exported directory. Resolves to {ok, checks:[{name,ok,detail}], metrics}; rejects only on tool failure. */
async function verifyRendition(dir,options={}){
  const minPsnr=options.minPsnr===undefined?DEFAULT_MIN_PSNR:options.minPsnr;
  const checks=[],metrics={};
  const check=(name,ok,detail)=>{checks.push({name,ok:Boolean(ok),detail:detail===undefined?'':String(detail)});return Boolean(ok);};
  const receiptPath=path.join(dir,'receipt.json'),mp4Path=path.join(dir,'rendition.mp4'),wavPath=path.join(dir,'cue-track.wav');
  for(const f of[receiptPath,mp4Path,wavPath]){let isFile=false;try{isFile=fs.lstatSync(f).isFile();}catch(e){isFile=false;}if(!check('present: '+path.basename(f),isFile,f))return{ok:false,checks,metrics};}
  let receipt,receiptBytes;
  try{receiptBytes=fs.readFileSync(receiptPath);receipt=JSON.parse(receiptBytes.toString('utf8'));}catch(e){check('receipt.json parses',false,e.message);return{ok:false,checks,metrics};}
  if(!check('receipt schema',receipt!==null&&typeof receipt==='object'&&!Array.isArray(receipt)&&(receipt.schema===SCHEMA_V1||receipt.schema===SCHEMA_V2),receipt&&receipt.schema))return{ok:false,checks,metrics};
  // JSON.parse keeps the last of any duplicate keys, so the pinned fields above are pinned only in the parsed object: the file a person reads must be the canonical serialisation of it.
  check('receipt.json is the exporter\'s canonical serialisation of its own content (duplicate keys, extra whitespace and escapes fail; key order is the file\'s own)',receiptBytes.equals(Buffer.from(JSON.stringify(receipt,null,2)+'\n','utf8')),'');
  check('receipt carries exactly the exporter\'s fields and its fixed kind and claims text',
    sameKeys(receipt,receipt.schema===SCHEMA_V2?TOP_KEYS_V2:TOP_KEYS_V1)&&receipt.kind===X.RECEIPT_KIND&&receipt.claims===X.RECEIPT_CLAIMS&&sameKeys(receipt.video,['width','height','fps','frames','frameStreamSha256'])
    &&(receipt.schema!==SCHEMA_V2||sameKeys(receipt.captions,['file','sha256','cues'])&&receipt.captions.file==='captions.vtt')&&sameKeys(receipt.timings,['entryMs','exitMs','maxExposureMs'])&&sameKeys(receipt.cueTrack,['sampleRate','samples','cues','wavSha256'])
    &&sameKeys(receipt.file,['name','ffmpeg','videoCodec','audioCodec','decodedVideoFrames','width','height'])&&receipt.file.name==='rendition.mp4'&&typeof receipt.file.ffmpeg==='string'&&FFMPEG_LINE.test(receipt.file.ffmpeg),
    Object.keys(receipt).join(','));
  const v=receipt.video||{},fps=v.fps,width=v.width,height=v.height;
  const shape=Number.isInteger(receipt.seed)&&Number.isInteger(receipt.encounters)&&[fps,width,height].every(Number.isInteger);
  if(!check('receipt carries seed, encounters, fps and frame size',shape,JSON.stringify({seed:receipt.seed,encounters:receipt.encounters,fps,width,height})))return{ok:false,checks,metrics};
  if(!check('receipt parameters are within the exporter limits',receipt.seed>=0&&receipt.seed<=0xFFFFFFFF&&receipt.encounters>=1&&receipt.encounters<=64&&fps>=1&&fps<=60&&width>=160&&height>=90&&width<=X.MAX_WIDTH&&height<=X.MAX_HEIGHT&&width%2===0&&height%2===0,'')) return{ok:false,checks,metrics};

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

  // 3. Cue track, re-derived and compared to the receipt and to the file on disk.
  const cue=R.cueTrack(run),wavBytes=R.wav(cue.pcm,cue.sampleRate),cueClaim=receipt.cueTrack||{};
  check('cue list re-derives from the seed',JSON.stringify(cue.cues)===JSON.stringify(cueClaim.cues),cue.cues.length+' cues');
  check('cue sample rate and length match',cueClaim.sampleRate===cue.sampleRate&&cueClaim.samples===cue.pcm.length,cueClaim.samples+' vs '+cue.pcm.length);
  check('cue track SHA-256 re-derives from the seed',sha256(wavBytes)===cueClaim.wavSha256,sha256(wavBytes));
  let fileWav;try{fileWav=fs.readFileSync(wavPath);}catch(e){fileWav=Buffer.alloc(0);}
  check('cue-track.wav on disk is byte-identical to the replay',fileWav.equals(wavBytes),fileWav.length+' bytes on disk, '+wavBytes.length+' replayed');

  // 3b. The silent equivalent of the cue track (v2 receipts), re-derived from the same run.
  if(receipt.schema===SCHEMA_V2){
    const vttPath=path.join(dir,'captions.vtt'),claim=receipt.captions||{};
    let fileVtt=null,readErr=vttPath;try{if(fs.lstatSync(vttPath).isFile())fileVtt=fs.readFileSync(vttPath);else readErr=vttPath+' is not a regular file (a symlink or directory does not count)';}catch(e){readErr=vttPath+': '+e.message;}
    if(check('present: captions.vtt',fileVtt!==null,readErr)){
      let derived;try{derived=R.captions(run);}catch(e){check('captions can be written as WebVTT for this run',false,e.message);derived=null;}
      if(derived){const derivedBytes=Buffer.from(derived.vtt,'utf8');
      check('captions.vtt on disk is byte-identical to the replayed captions',fileVtt.equals(derivedBytes),fileVtt.length+' bytes on disk, '+derivedBytes.length+' replayed');
      check('captions SHA-256 and cue count in the receipt re-derive',sha256(derivedBytes)===claim.sha256&&claim.cues===derived.captions.length,sha256(derivedBytes)+', '+derived.captions.length+' captions');
      let parsed=null,why='';
      try{parsed=R.parseCaptions(fileVtt.toString('utf8'));}catch(e){why=e.message;}
      const ends=cue.cues.map((c,k)=>R.captionEnd(run,cue.cues,k));
      const aligned=parsed&&parsed.length===cue.cues.length&&parsed.every((c,k)=>c.startMs===cue.cues[k].ms&&c.endMs===ends[k]&&c.endMs>c.startMs);
      check('captions.vtt is strict WebVTT, one caption per cue, starting on the cue and ending by the shared caption rule',aligned,why||(parsed?parsed.length+' captions':'unparsed'));
      }
    }
  } else check('captions: a v1 receipt predates the captions sidecar, so none is claimed or left beside it',receipt.captions===undefined&&!lexists(path.join(dir,'captions.vtt')),receipt.schema);

  // 4a. The container header, as ffprobe reads it: no frame is decoded. These facts bound the cost of everything below, so they come before the replay render (a receipt at the limits beside a tiny MP4 must not cost a whole-stream render).
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','stream=index,codec_name,codec_type,width,height,avg_frame_rate,r_frame_rate,sample_rate,channels:format=duration','-of','json',mp4Path],{encoding:'utf8',maxBuffer:1<<24});
  if(!check('ffprobe reads the file',probe.status===0,probe.stderr))return{ok:false,checks,metrics};
  let info;try{info=JSON.parse(probe.stdout);}catch(e){check('ffprobe output parses',false,e.message);return{ok:false,checks,metrics};}
  const vs=info.streams.find(s=>s.codec_type==='video'),as=info.streams.find(s=>s.codec_type==='audio');
  const layoutOk=[
    check('the file holds exactly one video and one audio stream and nothing else',info.streams.length===2&&info.streams.filter(s=>s.codec_type==='video').length===1&&info.streams.filter(s=>s.codec_type==='audio').length===1,info.streams.map(s=>s.codec_type+':'+s.codec_name).join(', ')),
    check('video stream is H.264 at the receipt size',vs&&vs.codec_name==='h264'&&vs.width===width&&vs.height===height,vs&&vs.codec_name+' '+vs.width+'x'+vs.height)];
  const[rn,rd]=String(vs&&vs.avg_frame_rate).split('/').map(Number);
  layoutOk.push(check('video frame rate equals the receipt fps',vs&&rd>0&&Math.abs(rn/rd-fps)<1e-3&&String(vs.r_frame_rate)===String(vs.avg_frame_rate),vs&&vs.avg_frame_rate+' / '+vs.r_frame_rate+' vs '+fps));
  const dur=Number(info.format.duration);metrics.containerDurationSec=dur;
  // Header-only, so it is reported even when the layout gate below ends the run. frameCount rounds, so the video may over- or undershoot the timeline by up to half a frame: 0.5/fps s, which exceeds 0.25 s below 2 fps.
  const durTol=Math.max(0.25,0.5/fps+DURATION_SLACK_SEC);
  check('container duration is within '+durTol.toFixed(3)+' s of the timeline (the larger of 0.25 s and half a frame)',Math.abs(dur-run.durationMs/1000)<durTol,dur+' vs '+run.durationMs/1000);
  if(!layoutOk.every(Boolean))return{ok:false,checks,metrics};// the replay below would render and decode a stream the file does not hold

  // 2. Raw frame stream hash, re-derived.
  const hash=crypto.createHash('sha256'),size=width*height*3,buf=new Uint8Array(size);
  for(let i=0;i<frames;i++){R.renderFrame(run,R.frameTime(i,fps),width,height,buf);hash.update(buf);}
  const frameHash=hash.digest('hex');
  check('raw frame stream SHA-256 re-derives from the seed',frameHash===v.frameStreamSha256,frameHash===v.frameStreamSha256?frameHash:'receipt '+v.frameStreamSha256+' replay '+frameHash);

  // 4b. What needs a decode of the file.
  const counted=spawnSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','json',mp4Path],{encoding:'utf8'});
  let nbRead;try{nbRead=JSON.parse(counted.stdout).streams[0].nb_read_frames;}catch(e){nbRead=undefined;}
  check('decodable video frames equal the receipt',counted.status===0&&Number(nbRead)===frames,nbRead);
  const pts=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','frame=pts_time','-of','csv=p=0',mp4Path],{encoding:'utf8',maxBuffer:1<<26});
  const times=pts.status===0?pts.stdout.split('\n').map(x=>x.replace(/,$/,'').trim()).filter(Boolean).map(Number):[];
  const driftIdx=times.findIndex((t,i)=>!(Math.abs(t-i/fps)<1e-3));
  check('every video frame sits at index/fps on the timeline',times.length===frames&&driftIdx===-1,driftIdx===-1?times.length+' timestamps':'frame '+driftIdx+' at '+times[driftIdx]+' s');
  check('audio stream is AAC',as&&as.codec_name==='aac',as&&as.codec_name);
  // The decoder below folds to mono at the cue rate; anything it would fold away (a side channel, a band above half that rate) must be refused here, by what the stream is.
  check('audio stream is mono at the cue track\'s sample rate',as&&as.channels===1&&Number(as.sample_rate)===cue.sampleRate,as&&as.channels+' channel(s) at '+as.sample_rate+' Hz vs 1 at '+cue.sampleRate);
  check('file facts in the receipt match ffprobe',receipt.file&&receipt.file.videoCodec==='h264'&&receipt.file.audioCodec==='aac'&&receipt.file.decodedVideoFrames===frames&&receipt.file.width===width&&receipt.file.height===height,JSON.stringify(receipt.file));

  // 5. Decode every video frame and compare to the frame re-rendered from the seed.
  const psnrs=[],blockWorst=[],chromaPsnrs=[],lumaA=new Float64Array(width*height),lumaB=new Float64Array(width*height),chromaA=new Float64Array(width*height/2),chromaB=new Float64Array(width*height/2);
  const decoded=await decodeFrames(mp4Path,width,height,(i,frame)=>{
    if(i>=frames)return;
    R.renderFrame(run,R.frameTime(i,fps),width,height,buf);
    luma(buf,lumaA);luma(frame,lumaB);psnrs.push(psnr(lumaA,lumaB));blockWorst.push(worstBlockPsnr(lumaA,lumaB,width,height));
    chroma(buf,width,height,chromaA);chroma(frame,width,height,chromaB);chromaPsnrs.push(psnr(chromaA,chromaB));
  });
  check('decoded frame count equals the receipt',decoded.frames===frames&&decoded.trailingBytes===0,decoded.frames+' frames, '+decoded.trailingBytes+' stray bytes');
  const finite=psnrs.filter(Number.isFinite),worst=psnrs.length?Math.min(...psnrs):0;
  metrics.frames=psnrs.length;metrics.minPsnrDb=Number.isFinite(worst)?Number(worst.toFixed(2)):'lossless';
  metrics.meanPsnrDb=finite.length?Number((finite.reduce((a,b)=>a+b,0)/finite.length).toFixed(2)):'lossless';
  const weakest=psnrs.indexOf(worst);
  check('every decoded frame is within '+minPsnr+' dB luma PSNR of the replayed frame',psnrs.length===frames&&worst>=minPsnr,'min '+metrics.minPsnrDb+' dB at frame '+weakest+', mean '+metrics.meanPsnrDb+' dB');

  const worstBlock=blockWorst.length?Math.min(...blockWorst):0;metrics.minBlockPsnrDb=Number.isFinite(worstBlock)?Number(worstBlock.toFixed(2)):'lossless';
  check('every '+BLOCK+'x'+BLOCK+' luma block of every decoded frame is within '+MIN_BLOCK_PSNR+' dB PSNR of the replay (localised edits)',blockWorst.length===frames&&worstBlock>=MIN_BLOCK_PSNR,'min '+metrics.minBlockPsnrDb+' dB at frame '+blockWorst.indexOf(worstBlock));

  const worstChroma=chromaPsnrs.length?Math.min(...chromaPsnrs):0;metrics.minChromaPsnrDb=Number.isFinite(worstChroma)?Number(worstChroma.toFixed(2)):'lossless';
  check('every decoded frame is within '+MIN_CHROMA_PSNR+' dB U/V chroma PSNR of the replayed frame (a greyscale or hue-shifted re-encode keeps luma)',chromaPsnrs.length===frames&&worstChroma>=MIN_CHROMA_PSNR,'min '+metrics.minChromaPsnrDb+' dB at frame '+chromaPsnrs.indexOf(worstChroma));

  // 6. Decode the AAC track: tones inside the cue windows, near silence outside.
  const pcm=decodeAudio(mp4Path,cue.sampleRate);metrics.decodedAudioSamples=pcm.length;
  check('decoded audio length is within 0.25 s of the cue track',Math.abs(pcm.length-cue.pcm.length)<cue.sampleRate*0.25,pcm.length+' vs '+cue.pcm.length);
  const win=cue.cues.map(c=>[Math.floor(c.ms*cue.sampleRate/1000),Math.floor((c.ms+c.lengthMs)*cue.sampleRate/1000)]);
  const guard=Math.floor(cue.sampleRate*GUARD_BAND_SEC);// AAC priming and ringing spread a tone slightly past its window, but only just: the guard band is trusted up to GUARD_BAND_PEAK, not blind
  // Silence is judged over every decoded sample, including any tail beyond the replayed cue track. zone: 0 inside a window (the tone checks below own it), 1 within the guard band of one, 2 elsewhere.
  const zone=new Uint8Array(pcm.length).fill(2);
  for(const[a,b]of win){
    for(let i=Math.max(0,a-guard);i<Math.min(pcm.length,b+guard);i++)if(zone[i]===2)zone[i]=1;
    for(let i=Math.max(0,a);i<Math.min(pcm.length,b);i++)zone[i]=0;
  }
  let loudOut=0,peakOut=0,loudGuard=0,peakGuard=0;
  for(let i=0;i<pcm.length;i++){
    const a=Math.abs(pcm[i]);
    if(zone[i]===2){peakOut=Math.max(peakOut,a);if(a>MAX_QUIET_PEAK)loudOut++;}
    else if(zone[i]===1){peakGuard=Math.max(peakGuard,a);if(a>GUARD_BAND_PEAK)loudGuard++;}
  }
  metrics.audioPeakOutsideCues=peakOut;metrics.audioPeakGuardBand=peakGuard;
  // Every cue must carry its own tone; one silent window cannot hide behind the others.
  const silentCues=[];
  win.forEach(([a,b],ci)=>{let n=0,loud=0;for(let i=a;i<Math.min(b,pcm.length);i++){n++;if(Math.abs(pcm[i])>5000)loud++;}if(!(n>0&&loud/n>0.3))silentCues.push(ci+':'+cue.cues[ci].kind+'@'+cue.cues[ci].ms+'ms '+loud+'/'+n);});
  check('decoded audio carries the tone inside every cue window',silentCues.length===0,silentCues.length?'no tone in '+silentCues.join(', '):win.length+' windows each above 30% loud samples');
  // The tone must be the cue's own pitch, not merely loud: any other sound in the window (a different frequency, noise, speech) fails.
  const offPitch=[];let minRatio=Infinity;
  win.forEach(([a,b],ci)=>{const r=toneRatio(pcm,a,b,cue.cues[ci].hz,cue.sampleRate);minRatio=Math.min(minRatio,r);if(r<MIN_TONE_RATIO)offPitch.push(ci+':'+cue.cues[ci].hz+'Hz ratio '+r.toFixed(2));});
  metrics.minToneRatio=Number.isFinite(minRatio)?Number(minRatio.toFixed(3)):0;
  check('decoded audio in every cue window is the cue\'s own pitch',offPitch.length===0,offPitch.length?'off pitch in '+offPitch.join(', '):'min ratio '+metrics.minToneRatio);
  check('decoded audio is silent outside the cue windows',loudOut===0&&loudGuard===0,'peak '+peakOut+', '+loudOut+' samples above '+MAX_QUIET_PEAK+'; within '+GUARD_BAND_SEC*1000+' ms of a window peak '+peakGuard+', '+loudGuard+' samples above '+GUARD_BAND_PEAK);

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
module.exports={verifyRendition,parse,psnr,chroma,MIN_CHROMA_PSNR,worstBlockPsnr,toneRatio,DEFAULT_MIN_PSNR,MIN_BLOCK_PSNR,MIN_TONE_RATIO,MAX_QUIET_PEAK,GUARD_BAND_SEC,GUARD_BAND_PEAK};
