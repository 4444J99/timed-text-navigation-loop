const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.HL_GENERATION_EVIDENCE_DIR||path.join(root,'verification/generative-rerun'));
fs.mkdirSync(out,{recursive:true});const checks=[];
function pass(name){checks.push(name);console.log('PASS',name);}
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.HL_CHROMIUM_PATH?{executablePath:process.env.HL_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--single-process','--no-zygote']}: {})});const context=await browser.newContext();
  const report={browser:browser.version(),platform:process.platform,viewports:[],checks};
  try{
    for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
      const p=await context.newPage();await p.setViewportSize(viewport);await p.clock.install();await p.clock.pauseAt(new Date());const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('file://'+path.join(root,'index.html'));await p.clock.runFor(100);report.viewports.push({name,...viewport});
      const scored=await p.evaluate(()=>HLDiagnostics.snapshot());const first=await p.evaluate(()=>HLDiagnostics.generation().entrance);
      const rows=await p.locator('.entrance-route').evaluateAll(es=>es.map(e=>({text:e.textContent,groups:[...e.children].map(s=>s.textContent),missing:+e.dataset.missingSpace,color:e.dataset.background,chamber:e.dataset.chamber})));
      assert.equal(rows.length,11);rows.forEach((r,i)=>{assert.equal(r.groups.length,7);assert.equal(r.groups.filter(g=>g.length===2).length,1);assert.equal(r.text.replaceAll(' ',''),'LOOPHOLE');assert.equal(r.text.split(' ').length,7);assert.equal(r.missing,first.rows[i].missing);});
      await p.screenshot({path:path.join(out,`${name}-entrance-generation-1.png`),fullPage:true});
      await p.locator('.entrance-route').nth(2).click();await p.clock.runFor(100);
      assert.equal(await p.locator('.canvas-holder').evaluate(e=>getComputedStyle(e).animationName),'loop-enter');await p.screenshot({path:path.join(out,`${name}-progress-entering.png`),fullPage:true});
      await p.clock.runFor(500);let e=(await p.evaluate(()=>HLDiagnostics.generation())).active;
      assert.equal(e.phase,'active');assert.equal(e.chamber,'042115');assert.equal(e.background,rows[2].color);
      const box=await p.locator('.viewport').boundingBox();assert.deepEqual(box,{x:0,y:0,...viewport});
      const current=await p.locator('.canvas').evaluate(e=>({background:getComputedStyle(e).backgroundColor,motion:e.dataset.motion,text:e.querySelector('.art-text').textContent,colors:[...e.querySelectorAll('.loop-word')].map(w=>getComputedStyle(w).color),animation:getComputedStyle(e.querySelector('.character-plane')).animationName}));
      assert.equal(current.background,'rgb(255, 0, 255)');assert.equal(current.text,'forced progress');assert.notEqual(current.animation,'none');assert.equal(new Set(current.colors).size,2);
      assert.equal(await p.locator('.character-cell').count(),14);
      const tile=await p.locator('.character-cell').first().evaluate(cell=>({overflow:getComputedStyle(cell).overflow,source:cell.textContent,shadow:getComputedStyle(cell.querySelector('.character-plane'),'::before').textShadow}));
      assert.equal(tile.overflow,'hidden');assert.equal(tile.source,'f');assert.equal((tile.shadow.match(/rgb\(/g)||[]).length,1);
      const endpoints=await p.locator('.character-plane').first().evaluate(el=>{const a=el.getAnimations()[0];a.pause();const values=[0,1200,2400].map(t=>{a.currentTime=t;return new DOMMatrix(getComputedStyle(el).transform).m41;});const width=parseFloat(getComputedStyle(el).width);a.play();return {values,width};});
      assert.ok(Math.abs(endpoints.values[1]-endpoints.width/2)<.1);assert.ok(Math.abs(endpoints.values[2]-endpoints.values[0])<.1);

      await p.screenshot({path:path.join(out,`${name}-progress-active.png`),fullPage:true});
      await p.locator('.word-routes summary').click();const downloaded=p.waitForEvent('download');await p.getByRole('button',{name:'Download variation record',exact:true}).click();
      const file=await downloaded,record=JSON.parse(fs.readFileSync(await file.path(),'utf8'));assert.equal(record.active.seed,e.seed);assert.deepEqual(record.active.colors,e.colors);assert.equal(record.configuration.version,'1.1.0');await p.locator('.word-routes summary').click();
      const oldId=e.id,link=e.links[0];await p.locator('.route-word[data-route="0"]').click();assert.equal((await p.evaluate(()=>HLDiagnostics.generation())).active.phase,'exiting');assert.equal(await p.locator('.canvas-holder').evaluate(e=>getComputedStyle(e).animationName),'loop-exit');await p.screenshot({path:path.join(out,`${name}-progress-exiting.png`),fullPage:true});
      await p.clock.runFor(1000);e=(await p.evaluate(()=>HLDiagnostics.generation())).active;assert.notEqual(e.id,oldId);assert.equal(e.chamber,link.target);assert.equal(e.background,link.background);assert.equal(e.phase,'active');
      assert.deepEqual(await p.evaluate(()=>HLDiagnostics.snapshot()),scored);await p.screenshot({path:path.join(out,`${name}-moment-after-word.png`),fullPage:true});pass(`${name}: one gap per row, row-color entry, animated text, direct word route, score isolation`);
      // Pause and reading suspend the no-selection clock; resuming alone never changes the encounter.
      await p.getByRole('button',{name:'Pause',exact:true}).click();const paused=await p.evaluate(()=>HLDiagnostics.generation().clock.elapsed);await p.clock.fastForward(60000);assert.equal(await p.evaluate(()=>HLDiagnostics.generation().clock.elapsed),paused);
      await p.getByRole('button',{name:'Resume',exact:true}).click();assert.equal((await p.evaluate(()=>HLDiagnostics.generation())).active.id,e.id);
      await p.getByRole('button',{name:'Reading view',exact:true}).click();const reading=await p.evaluate(()=>HLDiagnostics.generation().clock.elapsed);await p.clock.fastForward(60000);assert.equal(await p.evaluate(()=>HLDiagnostics.generation().clock.elapsed),reading);await p.getByRole('button',{name:'Back to experience',exact:true}).click();await p.clock.runFor(100);
      await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await p.evaluate(()=>HLDiagnostics.generation().clock.elapsed);await p.clock.fastForward(120000);assert.equal(await p.evaluate(()=>HLDiagnostics.generation().clock.elapsed),hidden);
      await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});assert.equal((await p.evaluate(()=>HLDiagnostics.generation())).active.id,e.id);
      await p.clock.runFor(5300);const returned=await p.evaluate(()=>HLDiagnostics.generation());assert.equal(returned.active,null);assert.equal(returned.history.length,2);assert.equal(returned.history[1].reason,'unselected');assert.ok(returned.history[1].elapsed>=5000);assert.notEqual(returned.entrance.seed,first.seed);assert.equal(returned.clock,null);
      await p.clock.fastForward(60000);assert.equal((await p.evaluate(()=>HLDiagnostics.generation())).count,2);assert.deepEqual(await p.evaluate(()=>HLDiagnostics.snapshot()),scored);await p.screenshot({path:path.join(out,`${name}-entrance-generation-2.png`),fullPage:true});pass(`${name}: pause/reading/hidden exclusion, foreground expiry, animated return, new generation and entrance hold`);
      await p.locator('.entrance-route').nth(1).click();await p.clock.runFor(600);assert.equal(await p.locator('.phrase').count(),378);await p.getByRole('button',{name:'Pause',exact:true}).click();await p.screenshot({path:path.join(out,`${name}-iyou-active.png`),fullPage:true});
      await p.locator('.word-routes summary').click();const route=await p.evaluate(()=>HLDiagnostics.generation().active.links[1]);await p.locator('.word-routes button').nth(1).click();await p.clock.runFor(100);assert.equal((await p.evaluate(()=>HLDiagnostics.generation())).active.phase,'exiting');
      await p.getByRole('button',{name:'Exit',exact:true}).click();const exited=await p.evaluate(()=>HLDiagnostics.generation());await p.clock.fastForward(60000);assert.deepEqual(await p.evaluate(()=>HLDiagnostics.generation()),exited);assert.equal(exited.active,null);assert.equal(exited.history.length,2);assert.equal(exited.clock,null);assert.equal(route.target,'042115');pass(`${name}: all 378 phrases and 44px route equivalents; Exit cancels pending next loop`);
      assert.deepEqual(errors,[]);await p.close();
    }
    const p=await context.newPage();report.viewports.push({name:'small-mobile-reduced-motion',width:320,height:568});await p.emulateMedia({reducedMotion:'reduce'});await p.setViewportSize({width:320,height:568});await p.clock.install();await p.clock.pauseAt(new Date());await p.goto('file://'+path.join(root,'index.html'));await p.clock.runFor(100);
    await p.locator('.entrance-route').nth(0).focus();await p.keyboard.press('Enter');await p.clock.runFor(600);assert.equal((await p.evaluate(()=>HLDiagnostics.generation())).active.phase,'active');assert.equal(await p.locator('.character-plane').first().evaluate(e=>getComputedStyle(e).animationName),'none');
    for(const label of ['Return','Pause','Reading view','Exit','Fit whole field','Scroll detail'])assert.equal(await p.getByRole('button',{name:label,exact:true}).evaluate(e=>{const b=e.getBoundingClientRect();return b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight&&b.height>=44&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('button')===e;}),true,label);
    await p.locator('.word-routes summary').focus();await p.keyboard.press('Enter');await p.locator('.word-routes button').first().focus();await p.keyboard.press('Enter');await p.clock.runFor(1000);assert.equal((await p.evaluate(()=>HLDiagnostics.generation())).count,2);await p.screenshot({path:path.join(out,'small-mobile-reduced-motion.png'),fullPage:true});pass('small mobile: keyboard row/word routes, unobstructed 44px controls and reduced-motion equivalent');await p.close();
    fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
