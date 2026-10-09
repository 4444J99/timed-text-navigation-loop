/* Real DOM/layout checks. Clock control changes browser time, never application state. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');
const root=path.resolve(__dirname,'..');
const output=path.resolve(process.env.HL_EVIDENCE_DIR || path.join(root,'verification/rerun'));
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/subdirectory/,'');
  const file=path.join(root,name==='/'?'index.html':name);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try {const data=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(404).end();}
});
const reports=[];
function check(name){reports.push(name);console.log('PASS',name);}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({headless:true,...(process.env.HL_CHROMIUM_PATH?{executablePath:process.env.HL_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--single-process','--no-zygote']}: {})});
  const context=await browser.newContext();
  try {
    const info={browser:browser.version(),platform:process.platform,viewports:[],checks:reports};
    for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
      const page=await context.newPage();await page.setViewportSize(viewport);info.viewports.push({name,...viewport});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.clock.install();await page.goto(url);await page.clock.runFor(100);
      assert.equal(await page.locator('.entrance-field>div').count(),11);
      await page.screenshot({path:path.join(output,`${name}-entrance.png`),fullPage:true});
      // Native keyboard activation and visible focus.
      await page.getByRole('button',{name:'Score & studies',exact:true}).click();await page.locator('#mode').focus();await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Begin');
      assert.ok(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle!=='none'));
      await page.keyboard.press('Enter');await page.clock.runFor(100);
      assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).active.chamber,'040915');
      check(`${name}: keyboard Begin and visible focus`);
      const sequence=['040915','041015','042115','040915','041015','042115'];let firstMoment,firstField;
      for(let i=0;i<6;i++){
        if(i){await page.getByRole('button',{name:'Enter next chamber',exact:true}).click();await page.clock.runFor(100);}
        const s=await page.evaluate(()=>HLDiagnostics.snapshot());assert.equal(s.active.chamber,sequence[i]);
        const presentation=await page.locator('.viewport').evaluate(e=>{
          const b=e.getBoundingClientRect(),canvas=e.querySelector('.canvas'),style=getComputedStyle(canvas);
          return {x:b.x,y:b.y,width:b.width,height:b.height,field:style.backgroundColor,color:style.color,uppercase:style.textTransform,font:getComputedStyle(canvas.firstElementChild).fontFamily};
        });
        assert.deepEqual([presentation.x,presentation.y,presentation.width,presentation.height],[0,0,viewport.width,viewport.height]);
        assert.equal(presentation.field,sequence[i]==='040915'?'rgb(0, 255, 255)':sequence[i]==='041015'?'rgb(0, 0, 0)':'rgb(255, 0, 170)');
        assert.equal(presentation.color,'rgb(255, 255, 255)');assert.ok(presentation.font.startsWith('Futura'));
        assert.equal(presentation.uppercase,sequence[i]==='042115'?'none':'uppercase');
        if(i===0){firstMoment=s.layouts['040915'];assert.equal(await page.locator('.memory-layer rect').count(),0);}
        if(i===3){
          const bounds=await page.locator('.memory-layer rect').evaluateAll(es=>es.map(e=>({x:+e.getAttribute('x'),y:+e.getAttribute('y'),width:+e.getAttribute('width'),height:+e.getAttribute('height')})));
          assert.deepEqual(bounds,firstMoment.bounds.map(b=>({x:b.x-8,y:b.y-8,width:b.width+16,height:b.height+16})));
          // Resize changes the shared stage transform, preserving recorded coordinates.
          await page.setViewportSize({width:viewport.width-20,height:viewport.height});await page.clock.runFor(100);
          assert.equal(await page.locator('.memory-layer rect').count(),2);await page.setViewportSize(viewport);
          check(`${name}: recorded Moment geometry and resize transform`);
        }
        if(i===1||i===4){
          const field=await page.locator('.phrase').evaluateAll(es=>es.map(e=>({text:e.textContent,row:+e.dataset.row,col:+e.dataset.column,instance:+e.dataset.instance,x:parseFloat(e.style.left),y:parseFloat(e.style.top)})));
          assert.equal(field.length,378);field.forEach((e,j)=>{assert.equal(e.text,'whereiendandubegin');assert.equal(e.instance,j);assert.equal(e.row,Math.floor(j/9));assert.equal(e.col,j%9);});
          if(i===1)firstField=field;else field.forEach((e,j)=>{assert.ok(Math.abs(e.x-(firstField[j].x+(e.col>=4?s.layouts['041015'].cellWidth:0)))<0.02);assert.equal(e.y,firstField[j].y);});
          await page.getByRole('button',{name:'Scroll detail',exact:true}).click();assert.equal(await page.locator('.canvas').evaluate(e=>getComputedStyle(e).transform),'matrix(1, 0, 0, 1, 0, 0)');
          await page.getByRole('button',{name:'Fit whole field',exact:true}).click();check(`${name}: I/you ${i===1?'continuous':'gap'} exact instances and coordinates`);
        }
        if(i===5)assert.equal(s.completedCycles,1);
        await page.clock.runFor(7000);assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).active.id,s.active.id);
        await page.screenshot({path:path.join(output,`${name}-encounter-${i+1}.png`),fullPage:true});
        await page.getByRole('button',{name:'Return',exact:true}).click();await page.clock.runFor(7000);
        assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).active,null);
      }
      const final=await page.evaluate(()=>HLDiagnostics.snapshot());assert.deepEqual(final.visits,{'040915':2,'041015':2,'042115':2});assert.equal(final.completedCycles,2);assert.equal(final.history.length,6);assert.equal(final.traces.length,3);assert.deepEqual(final.traces.map(e=>e.id),final.entries.slice(3).map(e=>e.id));assert.equal(await page.evaluate(()=>HLDiagnostics.clock),null);
      assert.equal(await page.locator('.trace').count(),3);assert.equal(await page.locator('.marker.complete').count(),2);
      await page.screenshot({path:path.join(output,`${name}-complete.png`),fullPage:true});
      await page.getByRole('button',{name:'Reread',exact:true}).click();await page.clock.runFor(10000);assert.deepEqual(await page.evaluate(()=>HLDiagnostics.snapshot()),final);assert.equal(await page.locator('.reading-rows li').count(),42);
      await page.getByRole('button',{name:'Back to experience',exact:true}).click();
      await page.getByRole('button',{name:'Restart',exact:true}).click();assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).history.length,0);
      check(`${name}: complete score, reader-paced hold, entrance hold, reread, restart`);
      check(`${name}: edge-to-edge source fields, white type and source capitalization on all six encounters`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.getByRole('button',{name:'Explore four studies'}).click();
      await page.locator('.study-card').nth(0).getByRole('button',{name:'Open study'}).click();await page.clock.runFor(100);
      const fixed=()=>page.locator('.art-text').evaluate(e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return {text:e.textContent,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,color:s.color,x:b.x,y:b.y,width:b.width,height:b.height};});
      const baseline=await fixed();const fields=[];
      for(const condition of ['Baseline · pink','Variant · green','Variant · violet']){await page.getByRole('button',{name:condition,exact:true}).click();await page.clock.runFor(100);assert.deepEqual(await fixed(),baseline);fields.push(await page.locator('.canvas').evaluate(e=>getComputedStyle(e).backgroundColor));await page.screenshot({path:path.join(output,`${name}-color-${fields.length}.png`),fullPage:true});}
      assert.equal(new Set(fields).size,3);check(`${name}: color comparison fixes all prescribed properties`);
      await page.getByRole('button',{name:'Reset study'}).click();assert.equal(await page.getByRole('button',{name:'Baseline · pink'}).getAttribute('aria-pressed'),'true');
      await page.getByRole('button',{name:'Study index',exact:true}).click();await page.locator('.study-card').nth(1).getByRole('button',{name:'Open study'}).click();await page.clock.runFor(100);assert.equal(await page.locator('.phrase').count(),378);await page.getByRole('button',{name:'Variant · interval'}).click();await page.clock.runFor(100);assert.equal(await page.locator('.phrase').count(),378);await page.getByRole('button',{name:'Reset study'}).click();
      await page.getByRole('button',{name:'Study index',exact:true}).click();await page.locator('.study-card').nth(3).getByRole('button',{name:'Open study'}).click();await page.clock.runFor(100);await page.getByRole('button',{name:'Second encounter · trace'}).click();await page.clock.runFor(100);assert.equal(await page.locator('.memory-layer rect').count(),2);await page.getByRole('button',{name:'Reset study'}).click();assert.equal(await page.locator('.memory-layer rect').count(),0);
      await page.getByRole('button',{name:'Study index',exact:true}).click();await page.locator('.study-card').nth(2).getByRole('button',{name:'Open study'}).click();await page.getByRole('button',{name:'Enter condition'}).click();await page.clock.runFor(7000);assert.equal(await page.getByRole('button',{name:'Return',exact:true}).count(),1);const timeFixed=await fixed();await page.getByRole('button',{name:'Return',exact:true}).click();await page.getByRole('button',{name:'Timed · five seconds'}).click();await page.getByRole('button',{name:'Enter condition'}).click();await page.clock.runFor(100);assert.deepEqual(await fixed(),timeFixed);await page.clock.runFor(5000);assert.equal(await page.getByRole('button',{name:'Enter condition'}).count(),1);assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).entries.length,0);
      check(`${name}: all study resets, independent sessions and time presentation`);
      assert.deepEqual(errors,[]);await page.close();
    }
    for(const [name,viewport] of [['small-mobile',{width:320,height:568}],['landscape',{width:844,height:390}]]) {
      info.viewports.push({name,...viewport});
      const p=await context.newPage();await p.setViewportSize(viewport);await p.clock.install();await p.goto(url);await p.clock.runFor(100);
      await p.getByRole('button',{name:'Score & studies',exact:true}).click();await p.locator('#mode').selectOption('timed');await p.getByRole('button',{name:'Begin',exact:true}).click();await p.clock.runFor(100);
      for(const label of ['Return','Pause','Reading view','Exit','Fit whole field','Scroll detail']) {
        assert.equal(await p.getByRole('button',{name:label,exact:true}).evaluate(e=>{
          const b=e.getBoundingClientRect(),target=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
          return b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight&&b.height>=44&&target?.closest('button')===e;
        }),true,`${name}: ${label} must be visible, reachable and unoccluded`);
      }
      await p.screenshot({path:path.join(output,`${name}-encounter-1.png`),fullPage:true});
      await p.getByRole('button',{name:'Return',exact:true}).click();await p.getByRole('button',{name:'Enter next chamber',exact:true}).click();await p.clock.runFor(100);
      assert.equal(await p.locator('.phrase').count(),378);
      const box=await p.locator('.viewport').boundingBox();assert.deepEqual(box,{x:0,y:0,...viewport});
      await p.screenshot({path:path.join(output,`${name}-encounter-2.png`),fullPage:true});
      check(`${name}: fullscreen viewport and unobstructed 44px controls including pause`);await p.close();
    }
    const page=await context.newPage();await page.setViewportSize({width:1440,height:1000});await page.clock.install();await page.goto(url);await page.clock.runFor(100);
    await page.getByRole('button',{name:'Score & studies',exact:true}).click();await page.locator('#mode').selectOption('timed');await page.getByRole('button',{name:'Begin',exact:true}).click();await page.clock.runFor(1000);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
    const hiddenTime=await page.evaluate(()=>HLDiagnostics.clock.elapsed);await page.clock.runFor(120000);assert.equal(await page.evaluate(()=>HLDiagnostics.clock.elapsed),hiddenTime);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).history.length,0);
    check('browser visibility listener excludes simulated hidden time and does not navigate on visibility event');
    await page.getByRole('button',{name:'Pause',exact:true}).click();const paused=await page.evaluate(()=>HLDiagnostics.clock.elapsed);await page.clock.runFor(20000);assert.equal(await page.evaluate(()=>HLDiagnostics.clock.elapsed),paused);
    await page.getByRole('button',{name:'Resume',exact:true}).click();assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).history.length,0);
    await page.getByRole('button',{name:'Reading view',exact:true}).click();const readingTime=await page.evaluate(()=>HLDiagnostics.clock.elapsed);await page.clock.runFor(20000);assert.equal(await page.evaluate(()=>HLDiagnostics.clock.elapsed),readingTime);await page.getByRole('button',{name:'Back to experience',exact:true}).click();await page.clock.runFor(100);assert.ok(await page.evaluate(()=>HLDiagnostics.clock.elapsed)>readingTime);
    await page.clock.runFor(4500);assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).history.length,1);await page.clock.runFor(20000);assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).entries.length,1);
    check('browser timed exposure, pause/resume, reading suspension, timer return and entrance hold');
    await page.getByRole('button',{name:'Enter next chamber'}).click();await page.clock.runFor(100);await page.getByRole('button',{name:'Exit',exact:true}).click();const exited=await page.evaluate(()=>HLDiagnostics.snapshot());await page.clock.runFor(20000);assert.deepEqual(await page.evaluate(()=>HLDiagnostics.snapshot()),exited);assert.equal(exited.history.length,1);assert.equal(await page.evaluate(()=>HLDiagnostics.clock),null);
    await page.getByRole('button',{name:'Begin a new composition'}).click();assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).entries.length,0);
    check('browser exit cancels timer and does not fabricate a return');
    await page.locator('#mode').selectOption('timed');await page.getByRole('button',{name:'Begin',exact:true}).click();
    await page.evaluate(()=>document.querySelector('#reading').click());await page.clock.runFor(20000);
    assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).history.length,0);
    await page.getByRole('button',{name:'Back to experience',exact:true}).click();await page.clock.runFor(100);
    for(let i=0;i<6;i++){
      if(i){await page.getByRole('button',{name:'Enter next chamber'}).click();await page.clock.runFor(100);}
      await page.clock.runFor(5100);assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).history.length,i+1);
      await page.clock.runFor(10000);assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).entries.length,i+1);
    }
    assert.equal((await page.evaluate(()=>HLDiagnostics.snapshot())).completedCycles,2);assert.equal(await page.evaluate(()=>HLDiagnostics.clock),null);
    check('full timed six-encounter score and reading before initial readiness');
    await page.goto(url+'subdirectory/');assert.equal(await page.title(),'hole-loop · six encounters');await page.goto('file://'+path.join(root,'index.html'));await page.clock.runFor(100);await page.getByRole('button',{name:'Score & studies',exact:true}).click();await page.getByRole('button',{name:'Begin',exact:true}).click();await page.clock.runFor(100);assert.equal(await page.locator('.art-text').count(),2);check('HTTP subdirectory and file:// run without build');
    await page.close();fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(info,null,2));
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
