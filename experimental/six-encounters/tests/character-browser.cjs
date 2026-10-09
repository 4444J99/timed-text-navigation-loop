const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'verification/character-cells');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.HL_CHROMIUM_PATH?{executablePath:process.env.HL_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--single-process','--no-zygote']}: {})});
 const checks=[],context=await browser.newContext();
 try{
  const p=await context.newPage();await p.goto('file://'+path.join(root,'index.html'));
  // Mount a frozen-clock test surface through the actual renderer, with no whole-canvas transitions.
  await p.evaluate(()=>{document.querySelector('#app').replaceChildren();document.body.dataset.screen='generative';document.body.dataset.phase='active';window.fixture=document.createElement('div');document.querySelector('#app').append(fixture);});
  for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
   await p.setViewportSize(viewport);
   for(const axis of ['horizontal','vertical','diagonal'])for(const family of ['drift','wave','stretch']){
    const data=await p.evaluate(({axis,family})=>{
     window.fixtureArt?.destroy();fixture.replaceChildren();
     fixtureArt=HLRender.mount(fixture,'042115',{immersive:true,seed:31415,motion:family,routes:{links:HLGeneration.config.routes['042115'],choose:()=>{}},characterMotion:{axes:[axis],periods:[2400]}});
     const cells=[...fixture.querySelectorAll('.character-cell')],planes=cells.map(c=>c.querySelector('.character-plane'));
     planes.forEach(el=>{el.style.setProperty('--character-delay','0ms');el.getAnimations().forEach(a=>{a.pause();a.currentTime=0;});});
     const before=cells.map(c=>{const b=c.getBoundingClientRect();return [b.x,b.y,b.width,b.height];});
     const samples=[0,600,1200,2399.999,2400.001,4800].map(time=>{
      planes.forEach(el=>el.getAnimations().forEach(a=>a.currentTime=time));
      return planes.map((el,i)=>{const m=new DOMMatrix(getComputedStyle(el).transform),s=getComputedStyle(el);return {x:m.m41/parseFloat(s.width),y:m.m42/parseFloat(s.height),expected:HLGeneration.characterPosition({...HLGeneration.character(31415,i,{axes:[axis],periods:[2400]}),phase:0},time,family)};});
     });
     const after=cells.map(c=>{const b=c.getBoundingClientRect();return [b.x,b.y,b.width,b.height];});
     return {before,after,samples,animation:getComputedStyle(planes[0]).animationName,axes:cells.map(c=>c.dataset.axis),viewport:fixtureArt.viewport.getBoundingClientRect().toJSON()};
    },{axis,family});
    assert.deepEqual(data.before,data.after);assert.ok(data.axes.every(a=>a===axis));assert.equal(data.animation,`character-${family}`);
    assert.equal(data.viewport.width,viewport.width);assert.equal(data.viewport.height,viewport.height);
    for(const sample of data.samples)for(const v of sample){assert.ok(Math.abs(v.x-v.expected.x)<.002,JSON.stringify(v));assert.ok(Math.abs(v.y-v.expected.y)<.002,JSON.stringify(v));}
    // Exact wrap frame is pixel-identical, including the simultaneous corner wrap.
    const shots=[];
    for(const time of [0,2400]){
     await p.evaluate(time=>fixture.querySelectorAll('.character-plane').forEach(el=>el.getAnimations().forEach(a=>a.currentTime=time)),time);
     shots.push(await p.locator('.loop-word').first().screenshot({animations:'allow'}));
    }
    assert.deepEqual(shots[0],shots[1],`${axis}/${family}: opposite-edge tiles must match at wrap`);
    checks.push(`${viewport.width}x${viewport.height} ${axis}/${family}: fixed bounds, applied family, signed position, seamless pixel wrap`);
   }
   await p.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}.png`)});
  }
  // Identical configuration regenerates identical DOM motion parameters and rendered pixels.
  const replay=[];for(let i=0;i<2;i++){
   replay.push(await p.evaluate(()=>{fixtureArt.destroy();fixture.replaceChildren();fixtureArt=HLRender.mount(fixture,'040915',{immersive:true,seed:42,motion:'wave',routes:{links:HLGeneration.config.routes['040915'],choose:()=>{}}});return [...fixture.querySelectorAll('.character-cell')].map(c=>({axis:c.dataset.axis,style:c.getAttribute('style')}));}));
  }assert.deepEqual(replay[0],replay[1]);checks.push('same seed/configuration replays every glyph axis, sign, period and phase');
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.character-plane').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.equal(await p.locator('.character-source').first().evaluate(e=>getComputedStyle(e).visibility),'visible');checks.push('reduced motion stays static and source text remains accessible');
  await p.close();
  const race=await context.newPage();await race.clock.install();await race.clock.pauseAt(new Date());await race.goto('file://'+path.join(root,'index.html'));await race.clock.runFor(100);
  await race.evaluate(()=>{document.querySelector('.entrance-route').click();[...document.querySelectorAll('button')].find(b=>b.textContent==='Return').click();});
  await race.clock.runFor(1000);assert.equal(await race.evaluate(()=>HLDiagnostics.generation().active),null);checks.push('Return before mount readiness completes exits once without entry-clock replacement');await race.close();
  fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({browser:browser.version(),checks},null,2));checks.forEach(c=>console.log('PASS',c));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
