#!/usr/bin/env node
/* Check a capture directory written by capture-rendition.cjs against its own receipt, without trusting any digest the receipt carries.
 *
 *   node verify-capture.cjs --dir /absolute/dir [--recapture] [--require-artwork-match]
 *
 * It replays every encounter through the real RouteSession (links, palette, motion, direction, and that each next loop is the followed word's
 * route), pins the phase timings to the configuration, regenerates the cue track and the captions from the receipt's timeline and compares them
 * byte for byte with the files, probes the MP4 and decodes every frame (the receipt's background colour must be the dominant configured one
 * while its loop is active, and the picture must move) and every audio sample (the cue's own pitch inside each cue window, silence outside).
 * `--recapture` also captures the same seed again in a fresh browser and requires the same timeline and the same frame digest: the
 * run is deterministic on one machine and Chromium build, which is the only reproduction claimed. Nothing is played; audio and video are
 * decoded to memory. Exit 0: every check passed. 1: a check failed (each is named on stderr, JSON verdict on stdout). 2: bad arguments or a tool failure.
 * Mechanical evidence only; the receipt is unsigned, so anyone holding the directory can rewrite it and its sidecars together. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn,spawnSync}=require('node:child_process');
const R=require('./rendition.js'),G=require('./generation.js'),C=require('./capture-rendition.cjs'),V=require('./verify-rendition.cjs');

const TOP_KEYS=['schema','kind','configVersion','seed','encounters','durationMs','timings','driver','video','cueTrack','captions','timeline','artwork','environment','file','claims'];
const ENTRY_SLACK_MS=150,EXIT_SLACK_MS=150;// measured: the artwork mounts, then starts its 450 ms entry clock, and ends its 350 ms exit on the next timer tick (README, capture); slack well above the measured 46 and 11 ms
const DURATION_SLACK_SEC=0.05;
const BG_TOLERANCE=40,MIN_BG_SHARE=0.05;// L-infinity distance in an 8-bit channel; the dense-text loops still keep their own colour as the largest of the four configured fields
const MIN_MOVING_PAIRS=0.5;// share of adjacent frame pairs that differ; the artwork animates continuously, a frozen or looped still does not
const sameKeys=(o,keys)=>o!==null&&typeof o==='object'&&JSON.stringify(Object.keys(o).sort())===JSON.stringify([...keys].sort());
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const hexRgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const lexists=f=>{try{fs.lstatSync(f);return true;}catch{return false;}};

function parse(argv){
  const o={dir:null,recapture:false,requireArtworkMatch:false};
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--dir'&&argv[i+1]!==undefined){o.dir=argv[++i];}
    else if(a==='--recapture')o.recapture=true;
    else if(a==='--require-artwork-match')o.requireArtworkMatch=true;
    else throw new Error('usage: verify-capture.cjs --dir ABSOLUTE_DIR [--recapture] [--require-artwork-match]');
  }
  if(!o.dir||!path.isAbsolute(o.dir))throw new Error('--dir must be an absolute directory');
  return o;
}

/** The stream the capture substitutes for crypto.getRandomValues, as capture-rendition.cjs's pageInit builds it. */
function seededDraws(seed,count){
  let n=(seed^0x5eed1234)>>>0;const out=[];
  for(let i=0;i<count;i++){n=(n+0x6D2B79F5)>>>0;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);out.push((t^t>>>14)>>>0);}
  return out;
}

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

async function verifyCapture(dir,options={}){
  const checks=[],metrics={};
  const check=(name,ok,detail)=>{checks.push({name,ok:Boolean(ok),detail:detail===undefined?'':String(detail)});return Boolean(ok);};
  const rpath=path.join(dir,'receipt.json');
  if(!lexists(rpath)){check('receipt.json exists',false,rpath);return{ok:false,checks,metrics};}
  let receipt;
  try{receipt=JSON.parse(fs.readFileSync(rpath,'utf8'));}catch(e){check('receipt.json is JSON',false,e.message);return{ok:false,checks,metrics};}
  if(!check('receipt has exactly the capture schema, kind and claims text',receipt&&sameKeys(receipt,TOP_KEYS)&&receipt.schema===C.CAPTURE_SCHEMA&&receipt.kind===C.CAPTURE_KIND&&receipt.claims===C.CAPTURE_CLAIMS,receipt&&receipt.schema))return{ok:false,checks,metrics};
  const v=receipt.video,tl=receipt.timeline;
  const integerOk=Number.isInteger(receipt.seed)&&receipt.seed>=0&&receipt.seed<=0xffffffff&&Number.isInteger(receipt.encounters)&&receipt.encounters>=1&&receipt.encounters<=C.MAX_ENCOUNTERS
    &&v&&sameKeys(v,['width','height','fps','frames','framePngSha256Chain'])&&[v.width,v.height,v.fps,v.frames].every(Number.isInteger)&&v.fps>=1&&v.fps<=30&&v.width>=320&&v.height>=180&&v.width%2===0&&v.height%2===0&&v.width<=1920&&v.height<=1080
    &&Number.isInteger(receipt.durationMs)&&receipt.durationMs>0&&Array.isArray(tl)&&tl.length===receipt.encounters;
  if(!check('receipt numbers are in range and the timeline has one entry per encounter',integerOk,JSON.stringify({seed:receipt.seed,encounters:receipt.encounters,video:v})))return{ok:false,checks,metrics};
  check('receipt configuration version is the artwork\'s current one',receipt.configVersion===G.config.version,receipt.configVersion+' vs '+G.config.version);
  check('receipt timings state the configured entry, exit and exposure',receipt.timings&&receipt.timings.configuredEntryMs===G.config.entry&&receipt.timings.configuredExitMs===G.config.exit&&receipt.timings.maxExposureMs===G.config.exposure,JSON.stringify(receipt.timings));

  // Which artwork was captured. A later edit to the artwork makes the capture a record of an earlier revision, which is not a failure unless asked for.
  const mismatched=Object.entries(receipt.artwork&&receipt.artwork.files||{}).filter(([f,h])=>!C.ARTWORK_FILES.includes(f)||!fs.existsSync(path.join(__dirname,f))||sha256(fs.readFileSync(path.join(__dirname,f)))!==h).map(([f])=>f);
  metrics.artworkFilesChangedSinceCapture=mismatched;
  check('receipt names exactly the artwork files',receipt.artwork&&sameKeys(receipt.artwork,['files'])&&sameKeys(receipt.artwork.files,C.ARTWORK_FILES)&&Object.values(receipt.artwork.files).every(h=>/^[0-9a-f]{64}$/.test(h)),'');
  if(options.requireArtworkMatch)check('the artwork in this checkout is the one that was captured',mismatched.length===0,mismatched.join(', '));

  // Timeline against the configuration.
  const eMs=[],xMs=[],dwell=[];
  let timelineOk=true;const bad=[];
  tl.forEach((e,i)=>{
    const ok=sameKeys(e,['index','chamber','background','seed','motion','direction','colors','links','chosen','chosenWord','next','enterStart','activeStart','exitStart','end'])
      &&e.index===i&&[e.enterStart,e.activeStart,e.exitStart,e.end].every(Number.isInteger)&&e.enterStart<e.activeStart&&e.activeStart<e.exitStart&&e.exitStart<e.end;
    if(!ok){timelineOk=false;bad.push(i+': shape or order');return;}
    const entry=e.activeStart-e.enterStart,exit=e.end-e.exitStart,dw=e.exitStart-e.activeStart;eMs.push(entry);xMs.push(exit);dwell.push(dw);
    if(entry<G.config.entry||entry>G.config.entry+ENTRY_SLACK_MS)bad.push(i+': entry '+entry+' ms');
    if(exit<G.config.exit||exit>G.config.exit+EXIT_SLACK_MS)bad.push(i+': exit '+exit+' ms');
    if(dw<1000||dw>G.config.exposure)bad.push(i+': dwell '+dw+' ms');
    if(i===0&&e.enterStart!==0)bad.push('0: does not start at 0');
    if(i>0&&e.enterStart!==tl[i-1].end)bad.push(i+': does not start where the previous encounter ended');
  });
  check('every encounter is ordered, contiguous from 0 and inside the configured entry, dwell and exit bounds',timelineOk&&bad.length===0,bad.join('; ')||'entry '+Math.min(...eMs)+'-'+Math.max(...eMs)+' ms, dwell '+Math.min(...dwell)+'-'+Math.max(...dwell)+' ms, exit '+Math.min(...xMs)+'-'+Math.max(...xMs)+' ms');
  if(!timelineOk)return{ok:false,checks,metrics};
  metrics.entryMs=[Math.min(...eMs),Math.max(...eMs)];metrics.exitMs=[Math.min(...xMs),Math.max(...xMs)];metrics.dwellMs=[Math.min(...dwell),Math.max(...dwell)];
  check('the run ends where its last encounter ends',tl[tl.length-1].end===receipt.durationMs,tl[tl.length-1].end+' vs '+receipt.durationMs);

  // Route replay through the real RouteSession.
  const replayBad=[],draws=seededDraws(receipt.seed,2);
  tl.forEach((e,i)=>{
    const s=new G.RouteSession(),a=s.begin(e.chamber,e.background,e.seed);
    if(!a){replayBad.push(i+': RouteSession refused '+e.chamber+' '+e.background);return;}
    const links=a.links.map(l=>({word:l.word,target:l.target}));
    if(JSON.stringify(links)!==JSON.stringify(e.links))replayBad.push(i+': links differ');
    if(JSON.stringify(a.colors)!==JSON.stringify(e.colors)||a.motion!==e.motion||a.direction!==e.direction)replayBad.push(i+': palette, motion or direction differ');
    if(!Number.isInteger(e.chosen)||!a.links[e.chosen]||e.chosenWord!==a.links[e.chosen].word||e.next!==a.links[e.chosen].target)replayBad.push(i+': followed word or its target differ');
    else if(i+1<tl.length){const n=tl[i+1],f=a.links[e.chosen];if(n.chamber!==f.target||n.background!==f.background||n.seed!==f.seed)replayBad.push(i+': next encounter is not the followed word\'s route');}
    if(!Number.isInteger(e.seed)||e.seed<0||e.seed>0xffffffff)replayBad.push(i+': seed');
  });
  if(tl[0].seed!==draws[1])replayBad.push('0: first encounter seed is not the second draw of the seeded stream ('+tl[0].seed+' vs '+draws[1]+')');
  check('the route replays through RouteSession: links, palette, motion, direction, followed words, next encounters and the seeded first draw',replayBad.length===0,replayBad.join('; '));

  // Cue track and captions regenerated from the timeline.
  const run={configVersion:receipt.configVersion,seed:receipt.seed,durationMs:receipt.durationMs,timeline:tl.map(e=>({...e,links:e.links}))};
  let cue,caption;
  try{cue=R.cueTrack(run);caption=R.captions(run);}catch(e){check('cue track and captions can be regenerated from the timeline',false,e.message);return{ok:false,checks,metrics};}
  const wavPath=path.join(dir,'cue-track.wav'),vttPath=path.join(dir,'captions.vtt'),mp4Path=path.join(dir,'capture.mp4');
  const present=[wavPath,vttPath,mp4Path].every(f=>lexists(f)&&fs.lstatSync(f).isFile());
  if(!check('cue-track.wav, captions.vtt and capture.mp4 are beside the receipt as regular files',present,''))return{ok:false,checks,metrics};
  const wavBytes=fs.readFileSync(wavPath),vttBytes=fs.readFileSync(vttPath),expectWav=R.wav(cue.pcm,cue.sampleRate);
  check('cue-track.wav equals the cue track regenerated from the timeline, byte for byte',Buffer.compare(wavBytes,expectWav)===0,'');
  check('captions.vtt equals the captions regenerated from the timeline, byte for byte',vttBytes.toString('utf8')===caption.vtt,'');
  check('receipt cue track and caption blocks match the files and the regeneration',receipt.cueTrack&&sameKeys(receipt.cueTrack,['sampleRate','samples','cues','wavSha256'])&&receipt.cueTrack.sampleRate===cue.sampleRate&&receipt.cueTrack.samples===cue.pcm.length
    &&JSON.stringify(receipt.cueTrack.cues)===JSON.stringify(cue.cues)&&receipt.cueTrack.wavSha256===sha256(wavBytes)
    &&receipt.captions&&sameKeys(receipt.captions,['file','sha256','cues'])&&receipt.captions.file==='captions.vtt'&&receipt.captions.sha256===sha256(vttBytes)&&receipt.captions.cues===caption.captions.length,'');

  // Container.
  const frames=Math.round(receipt.durationMs*v.fps/1000);
  check('the receipt frame count is the run length at the frame rate',v.frames===frames&&/^[0-9a-f]{64}$/.test(v.framePngSha256Chain),v.frames+' vs '+frames);
  const probe=spawnSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_name,codec_type,width,height,nb_read_frames,r_frame_rate,pix_fmt,channels,sample_rate:format=duration','-of','json',mp4Path],{encoding:'utf8'});
  if(probe.status!==0)throw new Error('ffprobe failed: '+probe.stderr);
  const info=JSON.parse(probe.stdout),vs=info.streams.find(s=>s.codec_type==='video'),as=info.streams.find(s=>s.codec_type==='audio');
  check('the file holds exactly one video and one audio stream and nothing else',info.streams.length===2&&Boolean(vs)&&Boolean(as),info.streams.map(s=>s.codec_type).join(','));
  if(!vs||!as||info.streams.length!==2)return{ok:false,checks,metrics};
  check('video is H.264 yuv420p at the receipt size and frame rate',vs.codec_name==='h264'&&vs.pix_fmt==='yuv420p'&&vs.width===v.width&&vs.height===v.height&&vs.r_frame_rate===v.fps+'/1',JSON.stringify({c:vs.codec_name,p:vs.pix_fmt,w:vs.width,h:vs.height,r:vs.r_frame_rate}));
  check('the file has exactly the receipt frame count',Number(vs.nb_read_frames)===v.frames,vs.nb_read_frames+' vs '+v.frames);
  check('audio is AAC, mono, at the cue track sample rate',as.codec_name==='aac'&&as.channels===1&&Number(as.sample_rate)===cue.sampleRate,as.codec_name+' '+as.channels+' ch '+as.sample_rate+' Hz');
  check('container duration is within a frame and half of the run',Math.abs(Number(info.format.duration)-receipt.durationMs/1000)<=1.5/v.fps+DURATION_SLACK_SEC,info.format.duration+' s vs '+receipt.durationMs/1000+' s');
  check('receipt file facts match ffprobe',receipt.file&&sameKeys(receipt.file,['name','videoCodec','audioCodec','decodedVideoFrames','width','height'])&&receipt.file.name==='capture.mp4'&&receipt.file.videoCodec==='h264'&&receipt.file.audioCodec==='aac'&&receipt.file.decodedVideoFrames===v.frames&&receipt.file.width===v.width&&receipt.file.height===v.height,JSON.stringify(receipt.file));
  check('receipt environment names a Chromium and an ffmpeg',receipt.environment&&sameKeys(receipt.environment,['chromium','ffmpeg'])&&typeof receipt.environment.chromium==='string'&&receipt.environment.chromium.length>0&&/^ffmpeg version /.test(receipt.environment.ffmpeg),JSON.stringify(receipt.environment));

  // Every decoded frame.
  const bgs=G.config.backgrounds.map(hexRgb),share=new Array(tl.length).fill(null).map(()=>({n:0,own:0,beaten:0,worst:1}));
  const phaseOf=ms=>{const i=tl.findIndex(e=>ms>=e.enterStart&&ms<e.end);return i<0?-1:i;};
  let prev=null,differing=0,pairs=0;
  const decoded=await decodeFrames(mp4Path,v.width,v.height,(index,buf)=>{
    if(prev){pairs++;if(Buffer.compare(prev,buf)!==0)differing++;}
    prev=Buffer.from(buf);
    const ms=Math.floor(index*1000/v.fps),i=phaseOf(ms);
    if(i<0||ms<tl[i].activeStart||ms>=tl[i].exitStart)return;// judged while the loop is active, when its field fills the frame
    const counts=bgs.map(()=>0);
    for(let p=0;p<buf.length;p+=3)for(let b=0;b<bgs.length;b++){
      if(Math.abs(buf[p]-bgs[b][0])<=BG_TOLERANCE&&Math.abs(buf[p+1]-bgs[b][1])<=BG_TOLERANCE&&Math.abs(buf[p+2]-bgs[b][2])<=BG_TOLERANCE){counts[b]++;break;}
    }
    const own=G.config.backgrounds.indexOf(tl[i].background),total=buf.length/3,s=share[i];
    s.n++;s.worst=Math.min(s.worst,counts[own]/total);
    if(counts[own]/total>=MIN_BG_SHARE&&counts.every((c,b)=>b===own||c<counts[own]))s.own++;
  });
  check('the decoded frame count and size are exact',decoded.frames===v.frames&&decoded.trailingBytes===0,decoded.frames+' frames, '+decoded.trailingBytes+' trailing bytes');
  const wrong=share.map((s,i)=>({s,i})).filter(({s})=>s.n===0||s.own!==s.n).map(({s,i})=>i+': '+s.own+'/'+s.n+' active frames show the receipt background as the largest configured field');
  check('while each loop is active its receipt background is the largest configured field in every decoded frame',wrong.length===0,wrong.join('; ')||share.map(s=>s.n+' frames, smallest share '+s.worst.toFixed(2)).join('; '));
  metrics.movingPairShare=pairs?Number((differing/pairs).toFixed(3)):0;
  check('the picture moves: most adjacent frame pairs differ',pairs>0&&differing/pairs>=MIN_MOVING_PAIRS,differing+'/'+pairs);

  // Audio.
  const pcm=decodeAudio(mp4Path,cue.sampleRate);
  check('decoded audio length is within 0.25 s of the cue track',Math.abs(pcm.length-cue.pcm.length)<cue.sampleRate*0.25,pcm.length+' vs '+cue.pcm.length);
  const win=cue.cues.map(c=>[Math.floor(c.ms*cue.sampleRate/1000),Math.floor((c.ms+c.lengthMs)*cue.sampleRate/1000)]);
  const guard=Math.floor(cue.sampleRate*V.GUARD_BAND_SEC),zone=new Uint8Array(pcm.length).fill(2);
  for(const[a,b]of win){for(let i=Math.max(0,a-guard);i<Math.min(pcm.length,b+guard);i++)if(zone[i]===2)zone[i]=1;for(let i=Math.max(0,a);i<Math.min(pcm.length,b);i++)zone[i]=0;}
  let loudOut=0,peakOut=0,loudGuard=0,peakGuard=0;
  for(let i=0;i<pcm.length;i++){const a=Math.abs(pcm[i]);if(zone[i]===2){peakOut=Math.max(peakOut,a);if(a>V.MAX_QUIET_PEAK)loudOut++;}else if(zone[i]===1){peakGuard=Math.max(peakGuard,a);if(a>V.GUARD_BAND_PEAK)loudGuard++;}}
  metrics.audioPeakOutsideCues=peakOut;metrics.audioPeakGuardBand=peakGuard;
  const offPitch=[];let minRatio=Infinity;
  win.forEach(([a,b],ci)=>{const r=V.toneRatio(pcm,a,b,cue.cues[ci].hz,cue.sampleRate);minRatio=Math.min(minRatio,r);if(r<V.MIN_TONE_RATIO)offPitch.push(ci+':'+cue.cues[ci].hz+'Hz ratio '+r.toFixed(2));});
  metrics.minToneRatio=Number.isFinite(minRatio)?Number(minRatio.toFixed(3)):0;
  check('decoded audio in every cue window is the cue\'s own pitch',offPitch.length===0,offPitch.join(', ')||'min ratio '+metrics.minToneRatio);
  check('decoded audio is silent outside the cue windows',loudOut===0&&loudGuard===0,'peak '+peakOut+' ('+loudOut+' above '+V.MAX_QUIET_PEAK+'); guard band peak '+peakGuard+' ('+loudGuard+' above '+V.GUARD_BAND_PEAK+')');
  metrics.frames=decoded.frames;

  if(options.recapture){
    const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hl-recapture-'));
    try{
      const again=await C.captureRendition({seed:receipt.seed,encounters:receipt.encounters,fps:v.fps,width:v.width,height:v.height,out:tmp});
      const a=again.receipt;
      check('capturing the same seed again gives the same timeline',JSON.stringify(a.timeline)===JSON.stringify(tl)&&a.durationMs===receipt.durationMs,'');
      check('capturing the same seed again gives the same frames (PNG digest chain)',a.video.framePngSha256Chain===v.framePngSha256Chain,a.video.framePngSha256Chain+' vs '+v.framePngSha256Chain);
      check('capturing the same seed again gives the same cue track and captions',a.cueTrack.wavSha256===receipt.cueTrack.wavSha256&&a.captions.sha256===receipt.captions.sha256,'');
    }finally{fs.rmSync(tmp,{recursive:true,force:true});}
  }
  return{ok:checks.every(c=>c.ok),checks,metrics};
}

if(require.main===module){
  (async()=>{
    const o=parse(process.argv.slice(2)),report=await verifyCapture(o.dir,{recapture:o.recapture,requireArtworkMatch:o.requireArtworkMatch});
    for(const c of report.checks)process.stderr.write((c.ok?'ok   ':'FAIL ')+c.name+(c.detail?' ('+c.detail+')':'')+'\n');
    process.stdout.write(JSON.stringify({ok:report.ok,failed:report.checks.filter(c=>!c.ok).map(c=>c.name),metrics:report.metrics})+'\n');
    process.exit(report.ok?0:1);
  })().catch(e=>{process.stderr.write(String(e.message||e)+'\n');process.exit(2);});
}
module.exports={verifyCapture,parse,seededDraws};
