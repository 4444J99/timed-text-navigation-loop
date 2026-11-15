const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const G=require('../generation.js'),R=require('../rendition.js'),{exportRendition,parse}=require('../export-rendition.cjs');

const W=480,H=270;
function hex(rgb){return'#'+[...rgb].map(v=>v.toString(16).padStart(2,'0')).join('');}
function cueCount(run){return run.timeline.length*2;}
function tool(name){return spawnSync(name,['-version']).status===0;}

test('the bitmap font covers every glyph of every route word, 5x7 each',()=>{
  const words=new Set(Object.values(G.config.routes).flat().map(r=>r.word));
  for(const word of words)for(const ch of word){
    const bits=R.FONT[ch];assert.ok(bits,'missing glyph '+ch);assert.equal(bits.length,7);bits.forEach(row=>assert.match(row,/^[.#]{5}$/));
  }
});

test('a simulated run follows the real RouteSession at the configured durations and only legal routes',()=>{
  for(const seed of[1,45,987654321]){
    const run=R.simulateRun(seed,8);assert.equal(run.timeline.length,8);assert.equal(run.configVersion,G.config.version);
    let t=0;
    run.timeline.forEach((e,i)=>{
      assert.equal(e.enterStart,t);assert.equal(e.activeStart-e.enterStart,G.config.entry);assert.equal(e.end-e.exitStart,G.config.exit);
      const exposure=e.exitStart-e.activeStart;assert.ok(exposure>=1000&&exposure<=G.config.exposure,'exposure '+exposure);
      assert.equal(e.reason,'word');
      const legal=G.config.routes[e.chamber].map(r=>r.target);assert.ok(legal.includes(e.links[e.chosen].target));
      if(i+1<run.timeline.length)assert.equal(run.timeline[i+1].chamber,e.links[e.chosen].target);
      t=e.end;
    });
    assert.equal(run.durationMs,t);
  }
  assert.deepEqual(R.simulateRun(45,5),R.simulateRun(45,5));
  assert.notDeepEqual(R.simulateRun(45,5),R.simulateRun(46,5));
  assert.throws(()=>R.simulateRun(1,0),RangeError);assert.throws(()=>R.simulateRun(1,65),RangeError);
});

test('frames are byte-reproducible; entry starts off-screen; active frames use only the seed palette with 4.5:1 contrast',()=>{
  const run=R.simulateRun(45,4);
  for(const e of run.timeline){
    const start=R.renderFrame(run,e.enterStart,W,H),again=R.renderFrame(run,e.enterStart,W,H);
    assert.deepEqual(Buffer.from(start),Buffer.from(again));
    const field=hex(start.slice(0,3));assert.equal(field,e.background);
    for(let i=0;i<start.length;i+=3)if(start[i]!==start[0]||start[i+1]!==start[1]||start[i+2]!==start[2]){assert.fail('entry frame 0 has a pixel on screen');}
    const mid=R.renderFrame(run,Math.floor((e.activeStart+e.exitStart)/2),W,H),seen=new Set();let ink=0;
    for(let i=0;i<mid.length;i+=3){const c=hex(mid.slice(i,i+3));if(c!==e.background){seen.add(c);ink++;}}
    assert.ok(ink>500,'active frame draws the route words ('+ink+' pixels)');
    for(const c of seen){assert.ok(e.colors.includes(c),c+' is not in the encounter palette');assert.ok(G.contrast(e.background,c)>=4.5);}
  }
});

test('the exit slides the encounter out and marks the followed word',()=>{
  const run=R.simulateRun(7,2),e=run.timeline[0];
  const justExit=R.renderFrame(run,e.exitStart,W,H),late=R.renderFrame(run,e.end-1,W,H);
  const ink=b=>{let n=0;for(let i=0;i<b.length;i+=3)if(hex(b.slice(i,i+3))!==e.background)n++;return n;};
  assert.ok(ink(justExit)>0);assert.ok(ink(late)<ink(justExit),'less ink on screen by the end of the exit');
});

test('the cue track is a valid WAV, silent between cues, with one entry and one exit tone per encounter',()=>{
  const run=R.simulateRun(45,3),cue=R.cueTrack(run),bytes=R.wav(cue.pcm,cue.sampleRate);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');assert.equal(bytes.readUInt32LE(24),R.SAMPLE_RATE);
  assert.equal(bytes.readUInt32LE(40),cue.pcm.length*2);assert.equal(bytes.length,44+cue.pcm.length*2);
  assert.equal(cue.pcm.length,Math.ceil(run.durationMs*R.SAMPLE_RATE/1000));
  assert.equal(cue.cues.length,6);assert.deepEqual(cue.cues.map(c=>c.kind),['enter','exit','enter','exit','enter','exit']);
  const covered=new Uint8Array(cue.pcm.length);
  for(const c of cue.cues){const s=Math.floor(c.ms*R.SAMPLE_RATE/1000);for(let i=0;i<c.lengthMs*R.SAMPLE_RATE/1000;i++)covered[s+i]=1;}
  let loud=0;for(let i=0;i<cue.pcm.length;i++){if(!covered[i])assert.equal(cue.pcm[i],0,'sample '+i+' outside a cue');else if(Math.abs(cue.pcm[i])>5000)loud++;}
  assert.ok(loud>1000,'tones reach audible amplitude');
  assert.deepEqual(R.cueTrack(run).pcm,cue.pcm);
});

test('the CLI arguments reject relative output and odd or tiny sizes',()=>{
  assert.throws(()=>parse(['--out','relative/dir']),/absolute/);
  assert.throws(()=>parse(['--out','/tmp/x','--width','481']),/even width/);
  assert.throws(()=>parse(['--out','/tmp/x','--fps','0']),/fps/);
  assert.throws(()=>parse(['--seed']),/usage/);
  assert.throws(()=>parse(['--bogus','1','--out','/tmp/x']),/usage/);
  assert.equal(parse(['--out','/tmp/x','--seed','9']).seed,9);
});

test('end to end: the exported file decodes to the receipt, is reproducible, and matches the field colour',{skip:!process.env.CI&&!(tool('ffmpeg')&&tool('ffprobe'))&&'ffmpeg/ffprobe not installed'},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hl-rendition-')),a=path.join(dir,'a'),b=path.join(dir,'b');
  try{
    const opts={seed:45,encounters:2,fps:10,width:320,height:180};
    const first=await exportRendition({...opts,out:a}),second=await exportRendition({...opts,out:b});
    const r=first.receipt;
    assert.equal(r.schema,'hole-loop.rendition-receipt.v2');assert.equal(r.video.frames,Math.round(r.durationMs*10/1000));
    assert.equal(r.file.videoCodec,'h264');assert.equal(r.file.audioCodec,'aac');assert.equal(r.file.decodedVideoFrames,r.video.frames);
    assert.equal(r.file.width,320);assert.equal(r.file.height,180);
    // The receipt's frame digest is the digest of the frames a second renderer produces from the receipt's own timeline.
    const run=R.simulateRun(45,2),h=crypto.createHash('sha256');
    for(let i=0;i<r.video.frames;i++)h.update(R.renderFrame(run,R.frameTime(i,10),320,180));
    assert.equal(h.digest('hex'),r.video.frameStreamSha256);
    assert.equal(r.cueTrack.wavSha256,crypto.createHash('sha256').update(fs.readFileSync(first.wavPath)).digest('hex'));
    // The silent equivalent: captions.vtt on disk is the replayed captions, vouched for by the receipt, and reproducible.
    const vttBytes=fs.readFileSync(path.join(a,'captions.vtt'));
    assert.equal(vttBytes.toString('utf8'),R.captions(run).vtt);assert.equal(r.captions.sha256,crypto.createHash('sha256').update(vttBytes).digest('hex'));
    assert.deepEqual(r.captions,{file:'captions.vtt',sha256:r.captions.sha256,cues:cueCount(run)});assert.deepEqual(second.receipt.captions,r.captions);
    assert.equal(second.receipt.video.frameStreamSha256,r.video.frameStreamSha256);assert.equal(second.receipt.cueTrack.wavSha256,r.cueTrack.wavSha256);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(a,'receipt.json'),'utf8')),r);
    // Container duration agrees with the timeline.
    const dur=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',first.mp4Path],{encoding:'utf8'});
    assert.ok(Math.abs(Number(dur.stdout)-r.durationMs/1000)<0.25,'duration '+dur.stdout);
    // A decoded frame in the middle of the first active phase is dominated by the encounter's field colour.
    const e=run.timeline[0],ms=Math.floor((e.activeStart+e.exitStart)/2),dec=spawnSync('ffmpeg',['-v','error','-ss',String(ms/1000),'-i',first.mp4Path,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:1<<24});
    assert.equal(dec.status,0);const px=dec.stdout,want=[1,3,5].map(i=>parseInt(e.background.slice(i,i+2),16));let near=0;
    for(let i=0;i<px.length;i+=3)if(Math.abs(px[i]-want[0])<10&&Math.abs(px[i+1]-want[1])<10&&Math.abs(px[i+2]-want[2])<10)near++;
    assert.ok(near/(px.length/3)>0.6,'field colour covers most of the decoded frame ('+near+')');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('an encoder that exits while frames are streaming rejects with its diagnostics instead of crashing Node',{skip:process.platform==='win32'&&'needs a POSIX shell shim'},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hl-fake-encoder-')),shim=path.join(dir,'ffmpeg'),savedPath=process.env.PATH;
  fs.writeFileSync(shim,'#!/bin/sh\nif [ "$1" = "-version" ]; then echo "ffmpeg version fake"; exit 0; fi\necho "fake encoder refused the stream" 1>&2\nexit 3\n',{mode:0o755});
  const out=path.join(dir,'out');fs.mkdirSync(out);fs.writeFileSync(path.join(out,'receipt.json'),'{"from":"an earlier successful export"}');
  process.env.PATH=dir+path.delimiter+savedPath;
  try{
    await assert.rejects(exportRendition({seed:45,encounters:3,fps:12,width:640,height:360,out}),/ffmpeg exited 3[\s\S]*fake encoder refused the stream/);
    assert.equal(fs.existsSync(path.join(out,'receipt.json')),false,'a failed export must not leave an earlier receipt vouching for replaced artifacts');
  }finally{process.env.PATH=savedPath;fs.rmSync(dir,{recursive:true,force:true});}
});

test('every accepted output size lays both route words out inside the frame without overlapping',()=>{
  const sizes=[[160,90],[480,90],[480,270],[640,360],[1920,1080],[320,1000]];
  for(const seed of[3,45,987654321]){
    const run=R.simulateRun(seed,6);
    for(const[w,h]of sizes)for(const e of run.timeline){
      const words=R.layout(e,w,h);assert.equal(words.length,e.links.length);
      words.forEach((a,i)=>{
        assert.ok(a.x0>=0&&a.x0+a.word.length*a.cellW<=w,`${e.chamber} ${w}x${h}: word ${i} leaves the frame horizontally`);
        assert.ok(a.y0>=0&&a.y0+a.cellH+a.scale*2<=h,`${e.chamber} ${w}x${h}: word ${i} (y ${a.y0}, cell ${a.cellH}) leaves the frame vertically`);
        if(i>0){const prev=words[i-1];assert.ok(a.y0>=prev.y0+prev.cellH+prev.scale*2,`${e.chamber} ${w}x${h}: words overlap`);}
      });
      // And the active frame really shows ink from every word.
      const frame=R.renderFrame(run,Math.floor((e.activeStart+e.exitStart)/2),w,h);
      for(const a of words){let ink=0;for(let y=Math.max(0,a.y0);y<Math.min(h,a.y0+a.cellH);y++)for(let x=a.x0;x<a.x0+a.word.length*a.cellW;x++){const o=(y*w+x)*3;if(hex(frame.slice(o,o+3))!==e.background)ink++;}
        assert.ok(ink>0,`${e.chamber} ${w}x${h}: no ink for word ${a.li}`);}
    }
  }
});

test('the cue list is the single source of the cue track: same cues, same bytes',()=>{
  for(const seed of[1,45,987654321]){
    const run=R.simulateRun(seed,5),list=R.cueList(run),track=R.cueTrack(run);
    assert.deepEqual(track.cues,list);
    // Cue windows never overlap and each lies inside the run.
    list.forEach((c,i)=>{assert.equal(c.lengthMs,R.CUE_LENGTH_MS);assert.ok(c.ms+c.lengthMs<=run.durationMs);if(i>0)assert.ok(c.ms>=list[i-1].ms+list[i-1].lengthMs);});
  }
  // Pinned digest of the 2-encounter seed-45 cue track: the refactor that introduced cueList() must not change a sample.
  const run=R.simulateRun(45,2),t=R.cueTrack(run);
  assert.equal(crypto.createHash('sha256').update(R.wav(t.pcm,t.sampleRate)).digest('hex'),'2061c7d4b0036a3bb01bede261b7469bf7ec50cf4771fdf8745cd794ab993a46');
});

test('vttTime formats whole milliseconds as HH:MM:SS.mmm and rejects anything else',()=>{
  assert.equal(R.vttTime(0),'00:00:00.000');assert.equal(R.vttTime(2184),'00:00:02.184');assert.equal(R.vttTime(61001),'00:01:01.001');
  assert.equal(R.vttTime(3600000+23*60000+45678),'01:23:45.678');assert.equal(R.vttTime(360000000),'100:00:00.000');
  for(const bad of[-1,1.5,NaN,'3',undefined])assert.throws(()=>R.vttTime(bad),RangeError);
});

test('captions describe every cue in words, in order, each from its cue for at least the reading minimum, and are reproducible',()=>{
  for(const seed of[1,45,987654321]){
    const run=R.simulateRun(seed,6),cap=R.captions(run),cues=R.cueList(run);
    assert.equal(cap.captions.length,cues.length);assert.deepEqual(R.captions(run),cap);
    cap.captions.forEach((c,i)=>{
      assert.equal(c.id,'cue-'+(i+1));assert.equal(c.startMs,cues[i].ms);assert.equal(c.endMs,Math.min(run.durationMs,Math.max(i+1<cues.length?cues[i+1].ms:run.durationMs,cues[i].ms+R.CAPTION_MIN_MS)));assert.ok(c.endMs>c.startMs);assert.ok(c.endMs-c.startMs>=Math.min(R.CAPTION_MIN_MS,run.durationMs-c.startMs),'readable for the minimum time unless the run ends');
      const e=run.timeline[Math.floor(i/2)];
      assert.ok(c.text.includes(cues[i].hz+' Hz for '+cues[i].lengthMs+' ms'),c.text);
      if(cues[i].kind==='enter'){assert.ok(c.text.startsWith('Entry tone'));assert.ok(c.text.includes('chamber '+e.chamber));assert.ok(c.text.includes('Encounter '+(e.index+1)+' of 6'));for(const l of e.links)assert.ok(c.text.includes(l.word));const dup=e.links.length>1&&e.links[0].word===e.links[1].word;assert.equal(c.text.includes('(on 2 routes)'),dup,c.text);assert.equal((c.text.match(new RegExp(e.links[0].word,'g'))||[]).length,1,'a repeated word is named once');}
      else{assert.ok(c.text.startsWith('Exit tone'));assert.ok(c.text.includes('word '+e.links[e.chosen].word+' is followed toward chamber '+e.links[e.chosen].target));assert.equal(c.text.endsWith('the run ends.'),e.index===5);}
    });
    assert.deepEqual(R.parseCaptions(cap.vtt),cap.captions);
  }
  assert.notEqual(R.captions(R.simulateRun(45,3)).vtt,R.captions(R.simulateRun(46,3)).vtt);
});

test('parseCaptions accepts only the exact subset captions() writes',()=>{
  const good=R.captions(R.simulateRun(45,2)).vtt;
  assert.doesNotThrow(()=>R.parseCaptions(good));
  const[c0,c1]=R.parseCaptions(good),timing1=R.vttTime(c1.startMs)+' --> '+R.vttTime(c1.endMs)+'\n';
  assert.ok(good.includes(c0.text)&&good.includes(timing1),'targets come from the parsed captions');
  const bad={
    'no header':good.replace('WEBVTT\n\n',''),'CRLF':good.replace(/\n/g,'\r\n'),'no trailing newline':good.slice(0,-1),'empty':'','not a string':null,
    'markup':good.replace(c0.text,'<b>'+c0.text),'ampersand':good.replace(c0.text,'x & '+c0.text),
    'arrow in text':good.replace(c0.text,'a --> b'),'bad timestamp':good.replace(R.vttTime(c0.startMs),R.vttTime(c0.startMs).replace('.',',')),'seconds out of range':good.replace(R.vttTime(c1.startMs),'00:00:62.184'),
    'two text lines':good.replace(c0.text,c0.text.replace(', ',',\n')),'bad id':good.replace(c1.id,'two'),'missing timing':good.replace(timing1,'')
  };
  for(const[name,v]of Object.entries(bad))assert.throws(()=>R.parseCaptions(v),Error,name);
});
