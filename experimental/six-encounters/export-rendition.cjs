#!/usr/bin/env node
/* Export a seeded word-routed run as an H.264/AAC file, a cue-track WAV and a receipt.
 *
 *   node export-rendition.cjs --seed 45 --encounters 4 --out /absolute/dir [--fps 12] [--width 480] [--height 270]
 *
 * Needs ffmpeg and ffprobe on PATH. The receipt records SHA-256 of the raw frame stream and the cue track (both
 * independent of the encoder) plus what ffprobe reads back from the file. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn,spawnSync}=require('node:child_process');
const R=require('./rendition.js'),G=require('./generation.js');

// Fixed receipt text and size ceiling, shared with verify-rendition.cjs so the verifier can pin them exactly.
const RECEIPT_SCHEMA='hole-loop.rendition-receipt.v2';// v2 adds the captions.vtt sidecar and the receipt's captions block; v1 receipts (no captions) still verify
const RECEIPT_KIND='schematic rendition of the word-routed generative loops; not a capture of the browser artwork, not a composed score';
const RECEIPT_CLAIMS='Mechanical output only. No artist, accessibility, device or audience acceptance is asserted.';
const MAX_WIDTH=7680,MAX_HEIGHT=4320;

function parse(argv){
  const o={seed:45,encounters:4,fps:12,width:480,height:270,out:null};
  for(let i=0;i<argv.length;i+=2){
    const k=argv[i].replace(/^--/,''),v=argv[i+1];
    if(!(k in o)||v===undefined)throw new Error('usage: export-rendition.cjs --seed N --encounters N --out DIR [--fps N --width N --height N]');
    o[k]=k==='out'?v:Number(v);
  }
  if(!o.out||!path.isAbsolute(o.out))throw new Error('--out must be an absolute directory');
  for(const k of['seed','encounters','fps','width','height'])if(!Number.isInteger(o[k])||o[k]<0)throw new Error('--'+k+' must be a non-negative integer');
  if(o.fps<1||o.fps>60||o.width<160||o.height<90||o.width%2||o.height%2||o.width>MAX_WIDTH||o.height>MAX_HEIGHT)throw new Error('fps 1-60, even width 160-'+MAX_WIDTH+', even height 90-'+MAX_HEIGHT);
  return o;
}

function ffmpegVersion(){const r=spawnSync('ffmpeg',['-version'],{encoding:'utf8'});if(r.status!==0)throw new Error('ffmpeg not found');return r.stdout.split('\n')[0];}

async function exportRendition(options){
  const o={...options},run=R.simulateRun(o.seed,o.encounters),frames=R.frameCount(run,o.fps),cue=R.cueTrack(run);
  const caption=R.captions(run),vttBytes=Buffer.from(caption.vtt,'utf8');// before the output directory is touched: text that cannot be written as WebVTT must fail the export up front
  fs.mkdirSync(o.out,{recursive:true});
  // A receipt vouches for the artifacts beside it; remove any earlier one, and the sidecar it vouched for, before the first artifact is replaced.
  fs.rmSync(path.join(o.out,'receipt.json'),{force:true});fs.rmSync(path.join(o.out,'captions.vtt'),{force:true,recursive:true});
  const wavPath=path.join(o.out,'cue-track.wav'),mp4Path=path.join(o.out,'rendition.mp4'),wavBytes=R.wav(cue.pcm,cue.sampleRate);
  fs.writeFileSync(wavPath,wavBytes);
  const version=ffmpegVersion();
  const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',`${o.width}x${o.height}`,'-r',String(o.fps),'-i','-',
    '-i',wavPath,'-c:v','libx264','-preset','ultrafast','-crf','12','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-frames:v',String(frames),mp4Path],{stdio:['pipe','inherit','pipe']});
  let err='';ff.stderr.on('data',d=>{err+=d;});
  // An encoder that exits early closes the pipe; that must surface as a rejection carrying its own diagnostics.
  let exited=null;
  const closed=new Promise((res,rej)=>{
    ff.on('close',code=>{exited=code;code===0?res():rej(new Error('ffmpeg exited '+code+': '+err.slice(-1500)));});
    ff.on('error',rej);
  });
  closed.catch(()=>{});
  ff.stdin.on('error',()=>{});
  const hash=crypto.createHash('sha256'),buf=new Uint8Array(o.width*o.height*3);
  for(let i=0;i<frames&&exited===null;i++){
    R.renderFrame(run,R.frameTime(i,o.fps),o.width,o.height,buf);
    hash.update(buf);
    if(!ff.stdin.write(Buffer.from(buf))&&exited===null)await Promise.race([new Promise(r=>ff.stdin.once('drain',r)),closed.catch(()=>{})]);
  }
  ff.stdin.end();await closed;
  const probe=spawnSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_name,codec_type,width,height,nb_read_frames,duration','-of','json',mp4Path],{encoding:'utf8'});
  if(probe.status!==0)throw new Error('ffprobe failed: '+probe.stderr);
  const streams=JSON.parse(probe.stdout).streams,video=streams.find(s=>s.codec_type==='video'),audio=streams.find(s=>s.codec_type==='audio');
  const receipt={
    schema:RECEIPT_SCHEMA,
    kind:RECEIPT_KIND,
    configVersion:G.config.version,seed:run.seed,encounters:o.encounters,durationMs:run.durationMs,
    timings:{entryMs:G.config.entry,exitMs:G.config.exit,maxExposureMs:G.config.exposure},
    video:{width:o.width,height:o.height,fps:o.fps,frames,frameStreamSha256:hash.digest('hex')},
    cueTrack:{sampleRate:cue.sampleRate,samples:cue.pcm.length,cues:cue.cues,wavSha256:crypto.createHash('sha256').update(wavBytes).digest('hex')},
    captions:{file:'captions.vtt',sha256:crypto.createHash('sha256').update(vttBytes).digest('hex'),cues:caption.captions.length},
    timeline:run.timeline.map(e=>({index:e.index,chamber:e.chamber,background:e.background,seed:e.seed,motion:e.motion,direction:e.direction,colors:e.colors,
      chosenWord:e.links[e.chosen].word,next:run.timeline[e.index+1]?run.timeline[e.index+1].chamber:null,enterStart:e.enterStart,activeStart:e.activeStart,exitStart:e.exitStart,end:e.end})),
    file:{name:'rendition.mp4',ffmpeg:version,videoCodec:video&&video.codec_name,audioCodec:audio&&audio.codec_name,decodedVideoFrames:Number(video&&video.nb_read_frames),
      width:video&&video.width,height:video&&video.height},
    claims:RECEIPT_CLAIMS
  };
  // The silent equivalent of the cue track is written only once the encode has succeeded, immediately before the receipt that vouches for it.
  fs.writeFileSync(path.join(o.out,'captions.vtt'),vttBytes);
  fs.writeFileSync(path.join(o.out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  return{receipt,mp4Path,wavPath};
}

if(require.main===module){
  exportRendition(parse(process.argv.slice(2))).then(r=>{process.stdout.write(JSON.stringify({mp4:r.mp4Path,frames:r.receipt.video.frames,durationMs:r.receipt.durationMs,frameStreamSha256:r.receipt.video.frameStreamSha256})+'\n');})
    .catch(e=>{process.stderr.write(String(e.message||e)+'\n');process.exit(1);});
}
module.exports={exportRendition,parse,RECEIPT_KIND,RECEIPT_CLAIMS,MAX_WIDTH,MAX_HEIGHT};
