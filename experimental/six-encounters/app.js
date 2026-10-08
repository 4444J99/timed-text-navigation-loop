(function () {
  const { Session, ExposureClock } = HLEngine;
  const app = document.querySelector('#app');
  const session = new Session(HLScore);
  const exploration = new HLGeneration.RouteSession();
  let freeClock=null,freeFrame=null,freePaused=false,menuOpen=false,entranceRecord=null;
  function seed(){return crypto.getRandomValues(new Uint32Array(1))[0];}
  let screen = 'entrance', study = null, studySession = null, studyVariant = 'baseline';
  let studyMemory = null, studyRecords = [], observation = '', art = null, clock = null, frame = null;
  let paused = false, readingBack = null, renderGeneration = 0;
  const studies = {
    color: { title:'Color as a relationship', subtitle:'A stable figure, three fields.', question:'Does a different surrounding field change figure–ground, emphasis, depth, legibility, or your reading?', reference:'Josef Albers', source:'042115' },
    space: { title:'Space as syntax', subtitle:'An interval in an uninterrupted field.', question:'Does one empty phrase cell become a boundary, interruption, separation, or possible passage?', reference:'Concrete poetry', source:'041015' },
    time: { title:'Time as an instruction', subtitle:'Progress leads back to the entrance.', question:'What changes when you control the duration, or when five seconds return you to the entrance?', reference:'Fluxus / instruction scores', source:'042115' },
    memory: { title:'Return as memory', subtitle:'The words remain. Their bounds return.', question:'Does a static trace of the previous position make an unrepeatable moment recur?', reference:'Mira Schendel', source:'040915' }
  };
  function button(label, action, cls = '') {
    const b = document.createElement('button'); b.textContent = label; b.className = cls;
    b.addEventListener('click', action); return b;
  }
  function actions(parent, list) {
    const row = document.createElement('div'); row.className = 'actions';
    list.forEach(([label, action, cls]) => row.append(button(label, action, cls))); parent.append(row); return row;
  }
  function clear() {
    renderGeneration++;art?.destroy();art=null;app.replaceChildren();document.body.dataset.screen=screen;
    document.querySelector('#score-menu').hidden=screen!=='entrance';
    if(screen!=='generative'){delete document.body.dataset.phase;delete document.body.dataset.paused;}
  }
  function focusHeading() { const el = app.querySelector('h1'); if (el) { el.tabIndex=-1; el.focus({preventScroll:true}); } }
  function cancelClock() {
    if (clock) { clock.cancel(); const s = studySession?.active || session.active; if (s) s.elapsed = clock.elapsed; }
    clock = null; cancelAnimationFrame(frame); frame = null; paused = false;
  }
  function cycles(s) {
    return `<div class="cycles" aria-label="${s.completedCycles} completed cycles"><span class="marker ${s.completedCycles >= 1 ? 'complete' : ''}"></span><span class="marker ${s.completedCycles >= 2 ? 'complete' : ''}"></span><span>${s.completedCycles} / 2 cycles completed</span></div>`;
  }
  function traces(s) {
    return `<div class="trace-strip" aria-label="Most recent returned encounters">${s.traces.map(e => `<div class="trace">${HLRender.symbol(e.chamber)}<small>ENCOUNTER ${e.id.split(':')[1]} · ${e.chamber}</small></div>`).join('')}</div>`;
  }
  function entrance(showMenu=session.entries.length>0) {
    stopFreeClock();menuOpen=showMenu;
    cancelClock(); screen = 'entrance'; clear();
    document.body.dataset.menu=menuOpen?'open':'closed';document.querySelector('#score-menu').setAttribute('aria-expanded',String(menuOpen));
    const complete = session.history.length === 6;
    app.innerHTML = `<section class="entrance"><div class="intro"><p class="eyebrow">Six encounters / ${session.mode === 'timed' ? 'timed return' : 'reader-paced'}</p><h1>${complete ? 'again' : session.history.length ? 'return' : 'hole-loop'}</h1><p class="sr-only">The same words acquire another meaning because something has happened between encounters.</p><div id="entrance-controls"></div></div><div><div class="portal" aria-label="${session.history.length} returned encounters"><span class="count">${session.history.length.toString().padStart(2,'0')}</span><span>RETURNS / 06</span></div>${cycles(session)}</div></section>${traces(session)}<p class="trace-caption sr-only">${session.history.length ? 'The three most recent returns, oldest to newest. Earlier positions remain in session memory.' : 'The entrance will retain the consequences of your returns.'}</p>`;
    const controls = app.querySelector('#entrance-controls');
    const field=document.createElement('div');field.className='entrance-field';field.setAttribute('aria-label','Choose a row to enter a generative loop');
    entranceRecord={seed:seed()};entranceRecord.rows=HLGeneration.entrance(entranceRecord.seed,HLContent.entranceLabel,HLScore.entrance.rows);
    entranceRecord.rows.forEach(r=>{
      const row=document.createElement('div');const b=button('',()=>beginFree(r.chamber,r.background,seed()));b.className='entrance-route';b.dataset.missingSpace=r.missing;b.dataset.row=r.index;b.dataset.chamber=r.chamber;b.dataset.background=r.background;
      b.style.color=r.background;b.style.setProperty('--row-color',r.background);b.style.setProperty('--row-ink',HLGeneration.palette(r.background,r.seed)[0]);
      b.setAttribute('aria-label',`Enter ${HLContent.chambers[r.chamber].name} loop · row ${r.index+1} · ${r.background}`);
      r.groups.forEach((group,i)=>{if(i)b.append(' ');const span=document.createElement('span');span.textContent=group;b.append(span);});row.append(b);field.append(row);
    });app.prepend(field);
    const hint=document.createElement('p');hint.className='landing-hint';hint.textContent='Select a row; underlined words continue. No choice: return after 5 visible, unpaused seconds.';app.append(hint);
    const recent=exploration.snapshot().traces;
    if(!showMenu&&recent.length){app.querySelector('.trace-strip').innerHTML=recent.map(e=>`<div class="trace">${HLRender.symbol(e.chamber)}<small>LOOP ${e.id.split(':').at(-1)} · ${e.reason==='word'?'WORD SELECTED':'RETURN'}</small></div>`).join('');}
    document.body.dataset.hasTraces=String(app.querySelector('.trace-strip').childElementCount>0);
    if (!session.entries.length) {
      const label = document.createElement('label'); label.className='mode'; label.textContent='Choose the duration rule';
      const select = document.createElement('select'); select.id='mode'; select.setAttribute('aria-label','Duration rule');
      select.innerHTML='<option value="reader">Reader-paced · return when you choose</option><option value="timed">Timed · return after 5 eligible seconds</option>';
      select.value=session.mode; select.onchange=()=>{session.mode=select.value;}; label.append(select); controls.append(label);
    }
    const list = complete ? [['Reread',openReading,'primary'],['Restart',restart],['Exit',exit]] : [[session.entries.length ? 'Enter next chamber' : 'Begin',enter,'primary']];
    if (session.entries.length && !complete) list.push(['Restart to change mode',restart]);
    if (!session.entries.length) list.push(['Explore four studies',index]);
    actions(controls,list); focusHeading();
    controls.append(button('Download variation record',downloadGeneration));
  }
  function restart() { cancelClock();stopFreeClock();exploration.exit();session.restart();studySession=null;study=null;entrance(true); }
  function enter() { studySession=null; if (session.enter()) chamber(session); }
  function stopFreeClock(){freeClock?.cancel();freeClock=null;cancelAnimationFrame(freeFrame);freeFrame=null;}
  function downloadGeneration(){
    const record={contentVersion:HLContent.version,configuration:HLGeneration.config,entrance:entranceRecord,...exploration.snapshot()};
    const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='hole-loop-variation-record.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function freeStatus(){const status=app.querySelector('.free-status');if(!status||!exploration.active)return;
    const e=exploration.active;status.textContent=freePaused?'Paused':e.phase==='active'?`Select an underlined word · ${(Math.max(0,5000-e.elapsed)/1000).toFixed(1)}s until return`:e.phase==='entering'?'Entering loop':'Leaving loop';
  }
  function freeTime(duration,onExpire,reuse=null){
    const id=exploration.active.id;const c=reuse||new ExposureClock({now:()=>performance.now(),duration,onExpire});
    freeClock=c;c.set({ready:true,visible:document.visibilityState==='visible',paused:freePaused});
    function tick(){if(freeClock!==c||exploration.active?.id!==id)return;
      const elapsed=c.tick();if(freeClock!==c||!exploration.active)return;
      if(exploration.active.phase==='active')exploration.active.elapsed=elapsed;freeStatus();if(c.active)freeFrame=requestAnimationFrame(tick);
    }freeFrame=requestAnimationFrame(tick);
  }
  function beginFree(chamber,background,entrySeed){
    if(exploration.active)return;
    cancelClock();studySession=null;readingBack=null;stopFreeClock();freePaused=false;
    if(exploration.begin(chamber,background,entrySeed))renderFree();
  }
  function freeChoose(index){const id=exploration.active?.id;if(!exploration.choose(id,index))return;
    if(freeClock?.duration===HLGeneration.config.exposure){freeClock.accrue();exploration.active.elapsed=freeClock.elapsed;}
    freeLeave();
  }
  function freeDepart(reason='unselected'){
    const id=exploration.active?.id;
    if(freeClock?.duration===HLGeneration.config.exposure&&exploration.active?.phase==='active'){freeClock.accrue();exploration.active.elapsed=freeClock.elapsed;}
    if(exploration.depart(id,reason))freeLeave();
  }
  function freeLeave(){
    stopFreeClock();freePaused=false;document.body.dataset.paused='false';document.body.dataset.phase='exiting';
    document.querySelectorAll('.route-word,.word-routes button').forEach(b=>b.disabled=true);
    const id=exploration.active.id;freeStatus();
    freeTime(HLGeneration.config.exit,()=>{
      const result=exploration.finish(id);if(!result)return;stopFreeClock();
      if(result.next)beginFree(result.next.target,result.next.background,result.next.seed);else entrance(false);
    });
  }
  function renderFree(reuse=null){
    screen='generative';clear();const e=exploration.active,id=e.id;document.body.dataset.phase=e.phase;document.body.dataset.paused=String(freePaused);
    document.body.style.setProperty('--enter-x',`${[100,-100,0,0][e.direction]}vw`);document.body.style.setProperty('--enter-y',`${[0,0,100,-100][e.direction]}vh`);
    app.innerHTML=`<h1 class="sr-only">${HLContent.chambers[e.chamber].name} · generative loop ${exploration.count}</h1><p class="free-status"></p><div id="free-controls"></div><div id="artwork"></div><details class="word-routes"><summary>Words / routes</summary><div></div></details>`;
    const controls=app.querySelector('#free-controls');controls.append(button('Return',()=>freeDepart('manual'),'primary'));
    const pause=button(freePaused?'Resume':'Pause',()=>{freePaused=!freePaused;freeClock?.set({paused:freePaused});document.body.dataset.paused=String(freePaused);pause.textContent=freePaused?'Resume':'Pause';pause.setAttribute('aria-pressed',String(freePaused));freeStatus();});pause.setAttribute('aria-pressed',String(freePaused));controls.append(pause);
    e.links.forEach((r,i)=>{const b=button(`${r.word} → ${HLContent.chambers[r.target].name}`,()=>freeChoose(i));b.disabled=e.phase!=='active';app.querySelector('.word-routes>div').append(b);});
    app.querySelector('.word-routes>div').append(button('Download variation record',downloadGeneration));
    mountArt(app.querySelector('#artwork'),e.chamber,{immersive:true,color:e.background,colors:e.colors,routes:{links:e.links,choose:freeChoose}},()=>{
      if(exploration.active?.id!==id)return;
      art.canvas.dataset.motion=e.motion;
      if(reuse){freeTime(reuse.duration,reuse.onExpire,reuse);return;}
      freeTime(HLGeneration.config.entry,()=>{
        if(!exploration.ready(id))return;document.body.dataset.phase='active';document.querySelectorAll('.route-word,.word-routes button').forEach(b=>b.disabled=false);
        freeTime(HLGeneration.config.exposure,()=>freeDepart('unselected'));freeStatus();
      });
    });app.querySelectorAll('.route-word').forEach(b=>b.disabled=e.phase!=='active');freeStatus();focusHeading();
  }
  function startClock(s, previous = null) {
    if (s.mode !== 'timed') return;
    const id = s.active.id;
    clock = previous || new ExposureClock({now:()=>performance.now(),duration:HLScore.duration,onExpire:()=>returnFrom(s,id,'timer')});
    clock.set({visible:document.visibilityState === 'visible',ready:true,paused});
    function tick() {
      if (!clock || s.active?.id !== id) return;
      const elapsed=clock.tick(); if (s.active) s.active.elapsed=elapsed;
      updateStatus(s); if (clock?.active) frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);
  }
  function updateStatus(s) {
    const status=app.querySelector('.chamber-status'); if (!status) return;
    status.textContent=s.mode==='reader' ? 'Reader-paced · return when you choose' : `${paused ? 'Paused' : 'Timed return'} · ${(Math.min(5000,clock?.elapsed || s.active?.elapsed || 0)/1000).toFixed(1)} / 5.0 eligible seconds`;
  }
  function togglePause(s, b) {
    paused=!paused; clock?.set({paused}); if(s.active && clock) s.active.elapsed=clock.elapsed;
    b.textContent=paused?'Resume':'Pause'; b.setAttribute('aria-pressed',String(paused)); updateStatus(s);
  }
  function returnFrom(s,id,reason='manual') {
    if (s.active?.id !== id) return;
    cancelClock(); if (!s.returnEncounter(id,reason)) return;
    if (s===session) entrance(); else { studyRecords.push(s.snapshot()); timeEntrance(); }
  }
  function mountArt(parent,id,options,record) {
    art=HLRender.mount(parent,id,options);
    const generation=renderGeneration;
    // Two paint opportunities precede readiness; no hidden-load exposure is accrued.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(generation!==renderGeneration || !art) return;
      record?.(art.measure());
    }));
    const tools=document.createElement('div');tools.className='view-tools';
    tools.innerHTML='<p>Fit preserves the whole field. Scroll detail allows full-size reading and panning.</p>';
    const fit=button('Fit whole field',()=>{art?.detail(false);fit.setAttribute('aria-pressed','true');detail.setAttribute('aria-pressed','false');});
    const detail=button('Scroll detail',()=>{art?.detail(true);fit.setAttribute('aria-pressed','false');detail.setAttribute('aria-pressed','true');});
    fit.setAttribute('aria-pressed','true'); detail.setAttribute('aria-pressed','false'); tools.append(fit,detail);parent.append(tools);
  }
  function chamber(s, previous = null, previousPaused = false) {
    cancelClock();paused=previousPaused;screen=s===session?'chamber':'study-time';clear();
    const e=s.active,c=HLContent.chambers[e.chamber];
    app.innerHTML=`<div class="chamber-top"><div><p class="eyebrow">${s===session ? `Encounter ${s.entries.length} / 6 · visit ${e.visit}` : 'Independent time study'}</p><h1>${c.name}</h1><p class="chamber-status"></p></div><div id="chamber-actions"></div></div>${s===session?cycles(s):''}<div id="artwork"></div>`;
    const controls=app.querySelector('#chamber-actions');
    controls.append(button('Return',()=>returnFrom(s,e.id),'primary'));
    if (s.mode==='timed') { const b=button('Pause',()=>togglePause(s,b));b.textContent=paused?'Resume':'Pause';b.setAttribute('aria-pressed',String(paused));controls.append(b); }
    mountArt(app.querySelector('#artwork'),e.chamber,{variant:e.visit===2,memory:s.layouts[e.chamber],immersive:s===session},layout=>{
      s.recordLayout(e.id,layout); if(s.active?.id===e.id) startClock(s,previous);
    });
    updateStatus(s);focusHeading();
  }
  function exit() {
    stopFreeClock();exploration.exit();
    cancelClock(); session.exit(); studySession?.exit();studySession=null;study=null;readingBack=null;
    screen='index'; index(true);
  }
  function index(ended=false) {
    cancelClock(); screen='index';study=null;clear();
    app.innerHTML=`<p class="eyebrow">Independent formal studies</p><h1>${ended?'Session ended.':'Four ways<br>to encounter again.'}</h1><p class="study-question">${ended?'An early exit is a valid partial session. No return or cycle was added.':'Change one rule. Compare a baseline with its variant. Study visits remain separate from the six-encounter score.'}</p><div class="study-grid"></div>`;
    const grid=app.querySelector('.study-grid');
    Object.entries(studies).forEach(([id,s],i)=>{
      const card=document.createElement('section');card.className='study-card';
      card.innerHTML=`<span class="number">0${i+1}</span><h2>${s.title}</h2><p>${s.subtitle}</p>`;
      card.append(button('Open study',()=>openStudy(id),'primary'));grid.append(card);
    });
    actions(app,[['Begin a new composition',restart]]);focusHeading();
  }
  function openStudy(id) { cancelClock(); study=id;studySession=null;studyVariant='baseline';studyMemory=null;studyRecords=[];observation=''; showStudy(); }
  function configuration() {
    return { contentVersion:HLContent.version, compositionVersion:HLScore.version, study,
      condition:studyVariant, source:studies[study]?.source, configuration:HLScore,
      layouts:studyRecords, memory:studyMemory,
      readerObservation:observation || null, observationStatus:observation?'Reader-entered, unverified':'No reader observations collected' };
  }
  function recordPanel() {
    const d=document.createElement('details');d.innerHTML='<summary>Configuration and session record</summary><pre></pre><label for="observation">Optional reader observation (kept only in this study session)</label><textarea id="observation" placeholder="What changed in your reading?"></textarea>';
    const pre=d.querySelector('pre');pre.textContent=JSON.stringify(configuration(),null,2);
    const ta=d.querySelector('textarea');ta.value=observation;ta.oninput=()=>{observation=ta.value;};
    d.append(button('Download study record',()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify(configuration(),null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download=`hole-loop-${study}-${studyVariant}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }));app.append(d);
  }
  function showStudy() {
    if (study==='time') {timeEntrance();return;}
    cancelClock();screen='study';clear();const s=studies[study];
    app.innerHTML=`<p class="eyebrow">Study · ${s.reference}</p><h1>${s.title}</h1><p class="study-question">${s.question}</p><div class="variants"></div><div id="study-art"></div>`;
    const variants=app.querySelector('.variants');
    const choices=study==='color'?[['baseline','Baseline · pink'],['green','Variant · green'],['violet','Variant · violet']]:study==='space'?[['baseline','Baseline · continuous'],['gap','Variant · interval']]:[['baseline','First encounter'],['trace','Second encounter · trace']];
    choices.forEach(([v,label])=>{
      const b=button(label,()=>{
        if(study==='memory' && v==='trace' && !studyMemory) return;
        studyVariant=v;showStudy();
      });b.setAttribute('aria-pressed',String(v===studyVariant));if(study==='memory'&&v==='trace'&&!studyMemory)b.disabled=true;variants.append(b);
    });
    mountArt(app.querySelector('#study-art'),s.source,{variant:studyVariant!=='baseline',memory:studyMemory,color:study==='color'?HLScore.colors[studyVariant]:null},layout=>{
      if(study==='memory' && studyVariant==='baseline' && !studyMemory) {
        studyMemory=layout;const second=variants.querySelectorAll('button')[1];second.disabled=false;
      }
      studyRecords.push({condition:studyVariant,layout});
      const pre=app.querySelector('pre');if(pre)pre.textContent=JSON.stringify(configuration(),null,2);
    });
    actions(app,[['Reset study',()=>openStudy(study)],['Study index',()=>index()]]);recordPanel();focusHeading();
  }
  function timeEntrance() {
    cancelClock();screen='study';clear();const s=studies.time;
    app.innerHTML=`<p class="eyebrow">Study · ${s.reference}</p><h1>${s.title}</h1><p class="study-question">${s.question}</p><div class="variants"></div><p>${studySession?.history.length?'Returned to this study entrance. The next condition waits for your action.':'Choose a duration rule, then enter the condition.'}</p>`;
    const variants=app.querySelector('.variants');
    [['baseline','Reader-paced'],['timed','Timed · five seconds']].forEach(([v,label])=>{const b=button(label,()=>{studyVariant=v;timeEntrance();});b.setAttribute('aria-pressed',String(v===studyVariant));variants.append(b);});
    actions(app,[['Enter condition',()=>{
      studySession=new Session({...HLScore,sequence:['042115'],cycleLength:null},studyVariant==='timed'?'timed':'reader');
      studySession.enter();chamber(studySession);
    },'primary'],['Reset study',()=>openStudy('time')],['Study index',()=>index()]]);recordPanel();focusHeading();
  }
  function openReading() {
    if(screen==='reading')return;
    readingBack={screen,study};clock?.set({ready:false});freeClock?.set({ready:false});screen='reading';clear();
    app.innerHTML='<section class="reading"><p class="eyebrow">Unscored reading view</p><h1>The selected texts</h1><p>This view leaves visits, traces, and cycles unchanged. Timed exposure is suspended here.</p><h2>040915 · Moment</h2><p class="clause">this moment has never come before<br>this moment will never come again</p><h2>041015 · I/you</h2><p>42 logical rows, nine occurrences per row. Scroll horizontally to read each complete row.</p><div class="reading-rows" tabindex="0" aria-label="42 rows of nine occurrences"><ol></ol></div><h2>042115 · Forced progress</h2><p class="clause">forced progress</p></section>';
    const ol=app.querySelector('ol');for(let i=0;i<42;i++){const li=document.createElement('li');li.textContent=Array(9).fill(HLContent.chambers['041015'].phrase).join(' ');ol.append(li);}
    actions(app.querySelector('section'),[['Back to experience',closeReading,'primary']]);focusHeading();
  }
  function closeReading() {
    const back=readingBack;readingBack=null;
    if(!back){index();return;}
    if(back.screen==='generative') {const saved=freeClock;freeClock=null;cancelAnimationFrame(freeFrame);renderFree(saved);return;}
    if(back.screen==='chamber'||back.screen==='study-time') {
      // Preserve the clock object and its accumulated time while remounting the artwork.
      const savedClock=clock,savedPaused=paused,s=back.screen==='chamber'?session:studySession;
      clock=null;cancelAnimationFrame(frame);chamber(s,savedClock,savedPaused);
    } else if(back.screen==='entrance') entrance();else if(back.study){study=back.study;showStudy();}else index();
  }
  document.querySelector('#reading').onclick=openReading;
  document.querySelector('#score-menu').onclick=()=>{menuOpen=!menuOpen;document.body.dataset.menu=menuOpen?'open':'closed';document.querySelector('#score-menu').setAttribute('aria-expanded',String(menuOpen));};
  document.querySelector('#exit').onclick=exit;
  document.addEventListener('visibilitychange',()=>{const visible=document.visibilityState==='visible';clock?.set({visible});freeClock?.set({visible});document.body.dataset.hidden=String(!visible);});
  // Read-only diagnostics for reproducible evidence; no state mutation API.
  window.HLDiagnostics={snapshot:()=>session.snapshot(),studyRecord:()=>configuration(),generation:()=>({entrance:structuredClone(entranceRecord),...exploration.snapshot(),clock:freeClock?{elapsed:freeClock.elapsed,duration:freeClock.duration,active:freeClock.active,ready:freeClock.ready,paused:freeClock.paused}:null}),get clock(){return clock?{elapsed:clock.elapsed,active:clock.active,paused:clock.paused,ready:clock.ready}:null;}};
  entrance();
})();
