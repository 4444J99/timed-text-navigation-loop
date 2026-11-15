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

  /** Cue track: a short tone at each phase boundary. Chamber pitch at entry start, the octave below at exit start. */
  function cueTrack(run){
    const total=Math.ceil(run.durationMs*SAMPLE_RATE/1000),pcm=new Int16Array(total);
    const tone=(startMs,hz,lenMs)=>{
      const s0=Math.floor(startMs*SAMPLE_RATE/1000),len=Math.floor(lenMs*SAMPLE_RATE/1000),fade=Math.floor(.01*SAMPLE_RATE);
      for(let i=0;i<len&&s0+i<total;i++){
        const env=Math.min(1,i/fade,(len-i)/fade);
        pcm[s0+i]=Math.round(Math.sin(2*Math.PI*hz*i/SAMPLE_RATE)*env*0.3*32767);
      }
    };
    const cues=[];
    for(const e of run.timeline){
      tone(e.enterStart,CHAMBER_HZ[e.chamber],120);cues.push({ms:e.enterStart,kind:'enter',hz:CHAMBER_HZ[e.chamber],lengthMs:120});
      tone(e.exitStart,CHAMBER_HZ[e.chamber]/2,120);cues.push({ms:e.exitStart,kind:'exit',hz:CHAMBER_HZ[e.chamber]/2,lengthMs:120});
    }
    return{pcm,cues,sampleRate:SAMPLE_RATE};
  }

  function wav(pcm,sampleRate){
    const data=pcm.length*2,out=Buffer.alloc(44+data);
    out.write('RIFF',0);out.writeUInt32LE(36+data,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);
    out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(data,40);
    for(let i=0;i<pcm.length;i++)out.writeInt16LE(pcm[i],44+i*2);
    return out;
  }

  const api={FONT,CHAMBER_HZ,SAMPLE_RATE,simulateRun,phaseAt,layout,renderFrame,frameCount,frameTime,cueTrack,wav};
  root.HLRendition=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
