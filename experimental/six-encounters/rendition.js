/* Deterministic audiovisual rendition of a seeded word-routed run. No DOM, no clock, no randomness beyond seeds.
 *
 * This is a schematic rendition, not a capture of the browser artwork: it draws only the route words of the
 * generative loops, in the field and foreground colours, motion family, entry direction and glyph-cell wraparound
 * that generation.js derives from the encounter seed, at the entry/exposure/exit durations in G.config. The cue track
 * marks phase boundaries with plain tones; it is not a composed score. */
(function(root){
  const G=typeof require==='function'?require('./generation.js'):root.HLGeneration;

  // 5x7 bitmaps for exactly the letters of the five route words (before again whereiendandubegin forced progress).
  const FONT=Object.freeze({
    a:['.###.','#...#','#...#','#####','#...#','#...#','#...#'],
    b:['####.','#...#','#...#','####.','#...#','#...#','####.'],
    c:['.####','#....','#....','#....','#....','#....','.####'],
    d:['####.','#...#','#...#','#...#','#...#','#...#','####.'],
    e:['#####','#....','#....','####.','#....','#....','#####'],
    f:['#####','#....','#....','####.','#....','#....','#....'],
    g:['.####','#....','#....','#.###','#...#','#...#','.###.'],
    h:['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
    i:['.###.','..#..','..#..','..#..','..#..','..#..','.###.'],
    n:['#...#','##..#','##..#','#.#.#','#..##','#..##','#...#'],
    o:['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
    p:['####.','#...#','#...#','####.','#....','#....','#....'],
    r:['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
    s:['.####','#....','#....','.###.','....#','....#','####.'],
    u:['#...#','#...#','#...#','#...#','#...#','#...#','.###.'],
    w:['#...#','#...#','#...#','#.#.#','#.#.#','##.##','#...#']
  });
  const CHAMBER_HZ=Object.freeze({'040915':220,'041015':330,'042115':440});
  const SAMPLE_RATE=22050;

  function mulberry(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  function hexRgb(hex){return[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];}

  /** A reader who always follows a word, driving the real RouteSession at the exact configured durations.
   *  Returns the encounters in order with absolute millisecond boundaries. */
  function simulateRun(seed,encounters){
    if(!Number.isInteger(encounters)||encounters<1||encounters>64)throw new RangeError('encounters must be an integer from 1 to 64');
    const cfg=G.config,rng=mulberry((seed^0x5eed1234)>>>0),session=new G.RouteSession();
    const chambers=Object.keys(cfg.routes);
    let chamber=chambers[Math.floor(rng()*chambers.length)],background=cfg.backgrounds[Math.floor(rng()*cfg.backgrounds.length)],next={target:chamber,background,seed:seed>>>0};
    const timeline=[];let t=0;
    for(let i=0;i<encounters;i++){
      const e=session.begin(next.target,next.background,next.seed);
      if(!e)throw new Error('RouteSession refused to begin encounter '+i);
      // The reader follows a word between 1 s and 4.5 s into the eligible exposure, never after it ends.
      const dwell=1000+Math.floor(rng()*3500),index=Math.floor(rng()*e.links.length);
      session.ready(e.id);
      if(!session.choose(e.id,index))throw new Error('RouteSession refused word choice');
      const done=session.finish(e.id);
      timeline.push({index:i,chamber:e.chamber,background:e.background,seed:e.seed,colors:[...e.colors],motion:e.motion,direction:e.direction,
        links:e.links.map(l=>({word:l.word,target:l.target})),chosen:index,
        enterStart:t,activeStart:t+cfg.entry,exitStart:t+cfg.entry+dwell,end:t+cfg.entry+dwell+cfg.exit,reason:done.event.reason});
      t+=cfg.entry+dwell+cfg.exit;next=done.next;
    }
    return{configVersion:cfg.version,seed:seed>>>0,durationMs:t,timeline};
  }

  function phaseAt(enc,ms){
    if(ms<enc.activeStart)return{phase:'entering',progress:(ms-enc.enterStart)/(enc.activeStart-enc.enterStart)};
    if(ms<enc.exitStart)return{phase:'active',progress:(ms-enc.activeStart)/(enc.exitStart-enc.activeStart)};
    return{phase:'exiting',progress:(ms-enc.exitStart)/(enc.end-enc.exitStart)};
  }
  const ease=p=>p*p*(3-2*p);

  /** Layout of one encounter: where each link's word sits and which glyph cells it owns. Pure of time. */
  function layout(enc,width,height){
    const n=enc.links.length,longest=G.config.routes[enc.chamber].reduce((m,r)=>Math.max(m,r.word.length),0);
    // Bounded by width (the longest word plus a margin) and by height (n rows, each at most one slot tall including its underline), so words never overlap or leave the frame.
    const scale=Math.max(1,Math.min(Math.floor(width/(longest*6+8)),Math.floor(height/((n+1)*10)))),cellW=6*scale,cellH=8*scale;
    return enc.links.map((link,li)=>{
      const x0=Math.floor((width-link.word.length*cellW)/2),y0=Math.floor(height*(li+1)/(n+1)-cellH/2);
      return{li,word:link.word,x0,y0,cellW,cellH,scale,
        cells:[...link.word].map((ch,gi)=>({ch,gi,plan:G.character((enc.seed+li*7919)>>>0,gi)}))};
    });
  }

  function lerpOffset(enc,phase,progress,width,height){
    if(phase==='active')return[0,0];
    const[dx,dy]=[[1,0],[-1,0],[0,1],[0,-1]][enc.direction],remaining=phase==='entering'?1-ease(progress):-ease(progress);
    // Entering slides in from the entry side; exiting slides out toward the opposite side.
    return[Math.round(dx*width*remaining),Math.round(dy*height*remaining)];
  }

  /** Render the frame at absolute time ms into rgb24 (Uint8Array width*height*3). */
  function renderFrame(run,ms,width,height,out){
    const enc=run.timeline.find(e=>ms>=e.enterStart&&ms<e.end)||run.timeline[run.timeline.length-1];
    const buf=out||new Uint8Array(width*height*3),[fr,fg,fb]=hexRgb(enc.background);
    for(let i=0;i<buf.length;i+=3){buf[i]=fr;buf[i+1]=fg;buf[i+2]=fb;}
    const{phase,progress}=phaseAt(enc,Math.min(ms,enc.end-1)),[ox,oy]=lerpOffset(enc,phase,progress,width,height);
    const local=Math.min(ms,enc.end-1)-enc.enterStart;
    for(const w of layout(enc,width,height)){
      const chosenExit=phase==='exiting'&&w.li!==enc.chosen; // the unselected word leaves with the encounter; chosen stays marked
      if(chosenExit&&progress>0.5)continue;
      for(const cell of w.cells){
        const[r,g,b]=hexRgb(enc.colors[(w.li+cell.gi)%3]);
        const pos=G.characterPosition(cell.plan,local,enc.motion);
        const shiftX=Math.floor((pos.x%1+1)%1*w.cellW),shiftY=Math.floor((pos.y%1+1)%1*w.cellH);
        const bits=FONT[cell.ch];
        if(!bits)throw new Error('no bitmap for glyph '+cell.ch);
        const cx=w.x0+cell.gi*w.cellW+ox,cy=w.y0+oy;
        for(let py=0;py<w.cellH;py++)for(let px=0;px<w.cellW;px++){
          // Torus tile: the pixel at (px,py) shows the glyph pixel that has wrapped there.
          const sx=((px-shiftX)%w.cellW+w.cellW)%w.cellW,sy=((py-shiftY)%w.cellH+w.cellH)%w.cellH;
          const gx=Math.floor(sx/w.scale),gy=Math.floor(sy/w.scale);
          if(gx>=5||gy>=7||bits[gy][gx]!=='#')continue;
          const X=cx+px,Y=cy+py;
          if(X<0||Y<0||X>=width||Y>=height)continue;
          const o=(Y*width+X)*3;buf[o]=r;buf[o+1]=g;buf[o+2]=b;
        }
      }
      // The followed word is underlined from the moment it is chosen, in its first palette colour.
      if(w.li===enc.chosen&&phase==='exiting'){
        const[r,g,b]=hexRgb(enc.colors[0]),y=w.y0+w.cellH+w.scale+oy;
        for(let X=Math.max(0,w.x0+ox);X<Math.min(width,w.x0+w.word.length*w.cellW+ox);X++)for(let k=0;k<w.scale;k++){
          const Y=y+k;if(Y<0||Y>=height)continue;const o=(Y*width+X)*3;buf[o]=r;buf[o+1]=g;buf[o+2]=b;
        }
      }
    }
    return buf;
  }

  function frameCount(run,fps){return Math.round(run.durationMs*fps/1000);}
  function frameTime(index,fps){return Math.floor(index*1000/fps);}

  const CUE_LENGTH_MS=120;
  /** The cue list alone (no samples): a short tone at each phase boundary. Chamber pitch at entry start, the octave below at exit start. */
  function cueList(run){
    const cues=[];
    for(const e of run.timeline){
      cues.push({ms:e.enterStart,kind:'enter',hz:CHAMBER_HZ[e.chamber],lengthMs:CUE_LENGTH_MS});
      cues.push({ms:e.exitStart,kind:'exit',hz:CHAMBER_HZ[e.chamber]/2,lengthMs:CUE_LENGTH_MS});
    }
    return cues;
  }

  /** Cue track: the tones of cueList(run) rendered to 16-bit mono PCM. */
  function cueTrack(run){
    const total=Math.ceil(run.durationMs*SAMPLE_RATE/1000),pcm=new Int16Array(total),cues=cueList(run);
    for(const c of cues){
      const s0=Math.floor(c.ms*SAMPLE_RATE/1000),len=Math.floor(c.lengthMs*SAMPLE_RATE/1000),fade=Math.floor(.01*SAMPLE_RATE);
      for(let i=0;i<len&&s0+i<total;i++){
        const env=Math.min(1,i/fade,(len-i)/fade);
        pcm[s0+i]=Math.round(Math.sin(2*Math.PI*c.hz*i/SAMPLE_RATE)*env*0.3*32767);
      }
    }
    return{pcm,cues,sampleRate:SAMPLE_RATE};
  }

  /** WebVTT time, HH:MM:SS.mmm, from whole milliseconds. */
  function vttTime(ms){
    if(!Number.isInteger(ms)||ms<0)throw new RangeError('milliseconds must be a non-negative integer');
    const p=(n,w)=>String(n).padStart(w,'0');
    return p(Math.floor(ms/3600000),2)+':'+p(Math.floor(ms/60000)%60,2)+':'+p(Math.floor(ms/1000)%60,2)+'.'+p(ms%1000,3);
  }

  const CAPTION_MIN_MS=2500;
  const offered=links=>{const n=new Map();for(const l of links)n.set(l.word,(n.get(l.word)||0)+1);return[...n].map(([w,c])=>c>1?w+' (on '+c+' routes)':w).join(', ');};

  /** End time of caption i. An entry caption lasts until the next cue (the exit). An exit caption lasts until the next cue but never less than
   *  CAPTION_MIN_MS, so the 350 ms exit phase does not flash its sentence, and never past the cue after next, so the longest dwell-free spacing
   *  (1800 ms between exits) cannot pile up a third caption: at most two captions are ever shown together. Capped at the end of the run,
   *  so the very last exit sentence can only be shown for what is left of the run. */
  function captionEnd(run,cues,i){
    const next=i+1<cues.length?cues[i+1].ms:run.durationMs;
    if(cues[i].kind==='enter')return next;
    const room=i+2<cues.length?cues[i+2].ms:Infinity;
    return Math.min(run.durationMs,Math.max(next,Math.min(cues[i].ms+CAPTION_MIN_MS,room)));
  }

  /** The silent equivalent of the cue track: one caption per cue, in words, starting with that cue. Derived only from the run, so it is exactly as
   *  reproducible as the sound it describes. Mechanical description, not a composed text; chamber ids are the work's own route identifiers. */
  function captions(run){
    const cues=cueList(run),n=run.timeline.length,out=[];
    cues.forEach((c,i)=>{
      const e=run.timeline[i>>1],word=e.links[e.chosen];
      const tone=(c.kind==='enter'?'Entry tone, ':'Exit tone, ')+c.hz+' Hz for '+c.lengthMs+' ms.';
      const text=c.kind==='enter'
        ?tone+' Encounter '+(i/2+1)+' of '+n+' begins in chamber '+e.chamber+'. Words offered: '+offered(e.links)+'.'
        :tone+' The word '+word.word+' is followed toward chamber '+word.target+((i>>1)+1===n?'; the run ends.':'.');
      if(/[<>&]|-->/.test(text))throw new RangeError('caption text would need WebVTT escaping: '+text);
      out.push({id:'cue-'+(i+1),startMs:c.ms,endMs:captionEnd(run,cues,i),text});
    });
    const vtt='WEBVTT\n\n'+out.map(c=>c.id+'\n'+vttTime(c.startMs)+' --> '+vttTime(c.endMs)+'\n'+c.text+'\n').join('\n');
    return{captions:out,vtt};
  }

  /** Strict reader for exactly the WebVTT subset captions() writes. Returns the caption list or throws with the offending line. */
  function parseCaptions(vtt){
    if(typeof vtt!=='string'||!vtt.startsWith('WEBVTT\n\n')||!vtt.endsWith('\n')||vtt.includes('\r'))throw new Error('not the expected WEBVTT header, line endings or trailing newline');
    const time=/^(\d{2,}):([0-5]\d):([0-5]\d)\.(\d{3})$/,ms=t=>{const m=time.exec(t);if(!m)throw new Error('bad timestamp '+t);return((+m[1]*60+ +m[2])*60+ +m[3])*1000+ +m[4];};
    return vtt.slice(8,-1).split('\n\n').map(block=>{
      const lines=block.split('\n');if(lines.length!==3)throw new Error('cue block must be id, timing, one text line: '+JSON.stringify(block));
      const[id,timing,text]=lines,m=/^(\S+) --> (\S+)$/.exec(timing);
      if(!/^cue-\d+$/.test(id)||!m)throw new Error('bad cue id or timing line: '+JSON.stringify(block));
      if(text===''||text.includes('-->')||/[<>&]/.test(text))throw new Error('caption text is empty or holds markup: '+JSON.stringify(text));
      return{id,startMs:ms(m[1]),endMs:ms(m[2]),text};
    });
  }

  function wav(pcm,sampleRate){
    const data=pcm.length*2,out=Buffer.alloc(44+data);
    out.write('RIFF',0);out.writeUInt32LE(36+data,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);
    out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(data,40);
    for(let i=0;i<pcm.length;i++)out.writeInt16LE(pcm[i],44+i*2);
    return out;
  }

  const api={FONT,CHAMBER_HZ,SAMPLE_RATE,CUE_LENGTH_MS,CAPTION_MIN_MS,captionEnd,simulateRun,phaseAt,layout,renderFrame,frameCount,frameTime,cueList,cueTrack,vttTime,captions,parseCaptions,wav};
  root.HLRendition=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
