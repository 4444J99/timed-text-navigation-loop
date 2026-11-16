#!/usr/bin/env node
/* Capture the real browser artwork (index.html) as an H.264/AAC file, a cue-track WAV, a WebVTT sidecar and a receipt.
 *
 *   node capture-rendition.cjs --seed 45 --encounters 4 --out /absolute/dir [--fps 12] [--width 960] [--height 540]
 *
 * A reader who always follows a word is driven through the actual application in headless Chromium: the entrance row
 * is clicked, each encounter is read for a seeded 1.0 to 4.5 s, then a seeded word is followed. Time is not the wall
 * clock: Playwright's fake clock moves the application's timers and animation frames, and every CSS animation is
 * paused and set to the same virtual time before each screenshot, so a frame shows the artwork at an exact moment
 * and the run takes a few seconds whatever its length. The application's one source of randomness
 * (crypto.getRandomValues, used for entrance and encounter seeds) is replaced by a stream seeded from --seed.
 * The phase boundaries are read from the application's own route session, so the cue track and captions follow what
 * the artwork actually did (its entry phase is a little longer than the configured 450 ms because the artwork
 * mounts before its clock starts), not what the schematic exporter assumes.
 *
 * Needs ffmpeg and ffprobe on PATH and Playwright with a Chromium (HL_CHROMIUM_PATH selects the executable).
 * Nothing is played: the browser is launched through tests/silent-browser.cjs (--mute-audio, media pinned to
 * volume 0) and the output is only written to files. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn,spawnSync}=require('node:child_process');
const R=require('./rendition.js'),G=require('./generation.js');

// Fixed receipt text, shared with verify-capture.cjs so the verifier can pin it exactly.
const CAPTURE_SCHEMA='hole-loop.capture-receipt.v1';
const CAPTURE_KIND='capture of the real browser artwork (index.html) in headless Chromium under a controlled clock, driven by a reader who always follows a word; not a composed score';
const CAPTURE_CLAIMS='Mechanical output only. No artist, accessibility, device or audience acceptance is asserted.';
const ARTWORK_FILES=['index.html','style.css','content.js','engine.js','generation.js','render.js','app.js'];
const MAX_ENCOUNTERS=16,MIN_WIDTH=320,MIN_HEIGHT=180,MAX_WIDTH=1920,MAX_HEIGHT=1080;
// Frames must come out the same on every run. Animations on the compositor thread and parallel rasterisation made two runs of one seed differ in whole
// frames (two stable outcomes, PSNR 22 dB apart); main-thread animations and one raster thread did not in six of six runs. Disabling threaded compositing
// altogether makes Page.captureScreenshot fail.
const CHROMIUM_ARGS=['--disable-threaded-animation','--num-raster-threads=1'];
const SETTLE_MS=200;// the entrance builds itself on load; give its first animation frames a moment before the run starts

function parse(argv){
  const o={seed:45,encounters:4,fps:12,width:960,height:540,out:null};
  for(let i=0;i<argv.length;i+=2){
    const k=argv[i].startsWith('--')?argv[i].slice(2):null,v=argv[i+1];
    if(k===null||!(k in o)||v===undefined)throw new Error('usage: capture-rendition.cjs --seed N --encounters N --out DIR [--fps N --width N --height N]');
    o[k]=k==='out'?v:Number(v);
  }
  if(!o.out||!path.isAbsolute(o.out))throw new Error('--out must be an absolute directory');
  for(const k of['seed','encounters','fps','width','height'])if(!Number.isInteger(o[k])||o[k]<0)throw new Error('--'+k+' must be a non-negative integer');
  if(o.seed>0xffffffff)throw new Error('--seed must fit in 32 bits');
  if(o.encounters<1||o.encounters>MAX_ENCOUNTERS)throw new Error('--encounters must be 1 to '+MAX_ENCOUNTERS);
  if(o.fps<1||o.fps>30||o.width<MIN_WIDTH||o.height<MIN_HEIGHT||o.width%2||o.height%2||o.width>MAX_WIDTH||o.height>MAX_HEIGHT)
    throw new Error('fps 1-30, even width '+MIN_WIDTH+'-'+MAX_WIDTH+', even height '+MIN_HEIGHT+'-'+MAX_HEIGHT);
  return o;
}

function mulberry(seed){let n=seed>>>0;return()=>{n=(n+0x6D2B79F5)>>>0;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function ffmpegVersion(){const r=spawnSync('ffmpeg',['-version'],{encoding:'utf8'});if(r.status!==0)throw new Error('ffmpeg not found');return r.stdout.split(/\r?\n/)[0];}

/** Runs in the page before any script: the seeded replacement for crypto.getRandomValues and the route recorder. */
function pageInit({seed}){
  let n=(seed^0x5eed1234)>>>0;
  const next=()=>{n=(n+0x6D2B79F5)>>>0;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0);};
  const original=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=a=>{if(a instanceof Uint32Array){for(let i=0;i<a.length;i++)a[i]=next();return a;}return original(a);};
  window.__hlEvents=[];
  document.addEventListener('DOMContentLoaded',()=>{
    let last='';
    const note=()=>{
      const g=window.HLDiagnostics&&window.HLDiagnostics.generation(),a=g&&g.active;
      const key=a?a.id+'|'+a.phase:'none';
      if(key===last)return;last=key;
      window.__hlEvents.push({ms:performance.now(),id:a?a.id:null,phase:a?a.phase:null,
        active:a?{chamber:a.chamber,background:a.background,seed:a.seed,colors:a.colors,motion:a.motion,direction:a.direction,
          links:a.links.map(l=>({word:l.word,target:l.target})),pending:a.pending?{word:a.pending.word,target:a.pending.target}:null}:null});
    };
    new MutationObserver(note).observe(document.querySelector('#app'),{childList:true});
    new MutationObserver(note).observe(document.body,{attributes:true,attributeFilter:['data-phase']});
  });
}

/** Pin every CSS animation and transition on the page to one virtual time: an animation seen for the first time was
 *  born at `born`, and shows the artwork `T-born` ms into itself. */
async function pageSyncAnimations({T,born}){
  const fresh=[];
  for(const a of document.getAnimations()){
    if(a.__hlBorn===undefined){a.__hlBorn=born;a.pause();fresh.push(a);}
    a.currentTime=T-a.__hlBorn;
  }
  // A paused animation is only really paused once the browser has committed the pause; set the time again after that.
  if(fresh.length){await Promise.all(fresh.map(a=>a.ready.catch(()=>{})));for(const a of fresh)a.currentTime=T-a.__hlBorn;}
  const e=window.__hlEvents,last=e[e.length-1];
  return{count:e.length,last:last?{id:last.id,phase:last.phase,ms:last.ms}:null};
}

/** The route the page recorded, as the timeline rendition.js and the receipt use. */
function buildTimeline(events,base){
  const loops=[];
  for(const e of events){
    if(e.id===null)continue;
    let l=loops.find(x=>x.id===e.id);
    if(!l){l={id:e.id,info:e.active};loops.push(l);}
    l[e.phase]=Math.round(e.ms-base);
    if(e.phase==='exiting')l.pending=e.active.pending;
  }
  return loops.map((l,i)=>{
    const chosen=l.info.links.findIndex(k=>l.pending&&k.word===l.pending.word&&k.target===l.pending.target);
    return{index:i,chamber:l.info.chamber,background:l.info.background,seed:l.info.seed,motion:l.info.motion,direction:l.info.direction,colors:[...l.info.colors],
      links:l.info.links,chosen,enterStart:l.entering,activeStart:l.active,exitStart:l.exiting,end:i+1<loops.length?loops[i+1].entering:null};
  });
}

async function captureRendition(options){
  const o={...options},{chromium}=require('playwright'),{silentLaunch}=require('../../tests/silent-browser.cjs');
  const url='file://'+path.resolve(__dirname,'index.html');
  const version=ffmpegVersion();
  fs.mkdirSync(o.out,{recursive:true});
  // A receipt vouches for the artifacts beside it; remove any earlier one, and the sidecar it vouched for, before the first artifact is replaced.
  fs.rmSync(path.join(o.out,'captions.vtt'),{force:true});fs.rmSync(path.join(o.out,'receipt.json'),{force:true});
  const framesDir=fs.mkdtempSync(path.join(o.out,'.capture-frames-'));
  const browser=await silentLaunch(chromium,{headless:true,args:CHROMIUM_ARGS,...(process.env.HL_CHROMIUM_PATH?{executablePath:process.env.HL_CHROMIUM_PATH}:{})});
  let events,base,frameHashes=[],chromiumVersion;
  try{
    chromiumVersion=browser.version();
    const page=await browser.newPage({viewport:{width:o.width,height:o.height},deviceScaleFactor:1});
    page.setDefaultTimeout(10000);
    await page.addInitScript(pageInit,{seed:o.seed});
    await page.clock.install({time:0});
    await page.goto(url);
    await page.clock.pauseAt(1000);// from here time moves only when runFor says so
    await page.clock.runFor(SETTLE_MS);
    base=await page.evaluate(()=>performance.now());
    const rng=mulberry((o.seed^0xc0de)>>>0),rows=await page.locator('.entrance-route').count();
    await page.evaluate(i=>document.querySelectorAll('.entrance-route')[i].click(),Math.floor(rng()*rows));
    // Per encounter: how long the reader dwells once the loop is active, and which word is followed.
    const plans=[];
    const planFor=i=>{while(plans.length<=i)plans.push({dwell:1000+Math.floor(rng()*3500),pick:rng()});return plans[i];};
    await page.evaluate(pageSyncAnimations,{T:0,born:0});
    let clicked=-1,end=null;
    for(let k=0;;k++){
      const T=Math.floor(k*1000/o.fps),prev=k?Math.floor((k-1)*1000/o.fps):0;
      if(k)await page.clock.runFor(T-prev);
      await page.evaluate(pageSyncAnimations,{T,born:prev});
      events=await page.evaluate(()=>window.__hlEvents);
      // The encounter count is the number of distinct loops seen; the one after the last wanted is only the end marker.
      const ids=[...new Set(events.filter(e=>e.id!==null).map(e=>e.id))];
      if(ids.length>o.encounters){end=Math.round(events.find(e=>e.id===ids[o.encounters]&&e.phase==='entering').ms-base);break;}
      const cur=ids.length-1,last=events[events.length-1];
      if(last.phase==='active'&&clicked<cur){
        const plan=planFor(cur);
        if(T-Math.round(last.ms-base)>=plan.dwell){
          clicked=cur;
          const n=last.active.links.length;
          await page.evaluate(i=>document.querySelectorAll('.route-word')[i].click(),Math.floor(plan.pick*n));
          await page.evaluate(pageSyncAnimations,{T,born:T});
        }
      }
      const png=await page.screenshot({type:'png'}),hash=sha256(png);
      fs.writeFileSync(path.join(framesDir,String(k).padStart(6,'0')+'.png'),png);frameHashes.push(hash);
      if(k>o.encounters*7000/(1000/o.fps)+o.fps*30)throw new Error('capture did not reach encounter '+(o.encounters+1)+' in a plausible time');
    }
    await page.close();
    const timeline=buildTimeline(events,base);
    const frames=Math.round(end*o.fps/1000);
    if(frames<1||frames>frameHashes.length)throw new Error('captured '+frameHashes.length+' frames for a run of '+frames);// the loop stops at the first frame at or after the end, so this cannot happen; it is checked, not assumed
    for(const e of timeline.slice(0,o.encounters))if(e.chosen<0||[e.enterStart,e.activeStart,e.exitStart,e.end].some(v=>!Number.isInteger(v)))throw new Error('route recorder missed a phase of encounter '+e.index);
    const used=timeline.slice(0,o.encounters),run={configVersion:G.config.version,seed:o.seed,durationMs:end,timeline:used};
    const cue=R.cueTrack(run),caption=R.captions(run),vttBytes=Buffer.from(caption.vtt,'utf8'),wavBytes=R.wav(cue.pcm,cue.sampleRate);
    const wavPath=path.join(o.out,'cue-track.wav'),mp4Path=path.join(o.out,'capture.mp4');
    fs.writeFileSync(wavPath,wavBytes);
    const enc=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(o.fps),'-i',path.join(framesDir,'%06d.png'),'-i',wavPath,
      '-vf','scale=out_color_matrix=bt709:out_range=tv,format=yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:v','libx264','-preset','slow','-crf','14','-threads','1',
      '-c:a','aac','-b:a','96k','-frames:v',String(frames),'-movflags','+faststart',mp4Path],{encoding:'utf8',maxBuffer:1<<26});
    if(enc.status!==0)throw new Error('ffmpeg exited '+enc.status+': '+String(enc.stderr).slice(-1500));
    const probe=spawnSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_name,codec_type,width,height,nb_read_frames','-of','json',mp4Path],{encoding:'utf8'});
    if(probe.status!==0)throw new Error('ffprobe failed: '+probe.stderr);
    const streams=JSON.parse(probe.stdout).streams,video=streams.find(s=>s.codec_type==='video'),audio=streams.find(s=>s.codec_type==='audio');
    const artwork={};for(const f of ARTWORK_FILES)artwork[f]=sha256(fs.readFileSync(path.join(__dirname,f)));
    const receipt={
      schema:CAPTURE_SCHEMA,kind:CAPTURE_KIND,configVersion:G.config.version,seed:o.seed,encounters:o.encounters,durationMs:end,
      timings:{configuredEntryMs:G.config.entry,configuredExitMs:G.config.exit,maxExposureMs:G.config.exposure},
      driver:{dwellMs:[1000,4500],entranceRow:'seeded',follows:'a seeded link of every active loop',clock:'Playwright fake clock, every CSS animation paused and set to the frame time',randomness:'crypto.getRandomValues replaced by a stream seeded from seed'},
      video:{width:o.width,height:o.height,fps:o.fps,frames,framePngSha256Chain:sha256(frameHashes.slice(0,frames).join('\n'))},
      cueTrack:{sampleRate:cue.sampleRate,samples:cue.pcm.length,cues:cue.cues,wavSha256:sha256(wavBytes)},
      captions:{file:'captions.vtt',sha256:sha256(vttBytes),cues:caption.captions.length},
      timeline:used.map(e=>({index:e.index,chamber:e.chamber,background:e.background,seed:e.seed,motion:e.motion,direction:e.direction,colors:e.colors,
        links:e.links,chosen:e.chosen,chosenWord:e.links[e.chosen].word,next:e.links[e.chosen].target,enterStart:e.enterStart,activeStart:e.activeStart,exitStart:e.exitStart,end:e.end})),
      artwork:{files:artwork},
      environment:{chromium:chromiumVersion,ffmpeg:version},
      file:{name:'capture.mp4',videoCodec:video&&video.codec_name,audioCodec:audio&&audio.codec_name,decodedVideoFrames:Number(video&&video.nb_read_frames),width:video&&video.width,height:video&&video.height},
      claims:CAPTURE_CLAIMS
    };
    fs.writeFileSync(path.join(o.out,'captions.vtt'),vttBytes);
    fs.writeFileSync(path.join(o.out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
    return{receipt,mp4Path,wavPath};
  }finally{
    await browser.close().catch(()=>{});
    fs.rmSync(framesDir,{recursive:true,force:true});
  }
}

if(require.main===module){
  captureRendition(parse(process.argv.slice(2))).then(r=>{process.stdout.write(JSON.stringify({mp4:r.mp4Path,frames:r.receipt.video.frames,durationMs:r.receipt.durationMs,framePngSha256Chain:r.receipt.video.framePngSha256Chain})+'\n');})
    .catch(e=>{process.stderr.write(String(e.message||e)+'\n');process.exit(1);});
}
module.exports={captureRendition,parse,buildTimeline,mulberry,CAPTURE_SCHEMA,CAPTURE_KIND,CAPTURE_CLAIMS,ARTWORK_FILES,MAX_ENCOUNTERS};
