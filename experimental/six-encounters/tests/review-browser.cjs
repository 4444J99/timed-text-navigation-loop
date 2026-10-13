/* Reproduce review findings through reader actions against the actual application. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const url='file://'+path.resolve(__dirname,'../index.html');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.HL_CHROMIUM_PATH?{executablePath:process.env.HL_CHROMIUM_PATH}: {})});
  const failures=[];
  async function run(name,check){
    const page=await browser.newPage();page.setDefaultTimeout(5000);
    try{
      await page.clock.install();await page.goto(url);await page.clock.runFor(100);
      await page.evaluate(()=>{
        const native=requestAnimationFrame;window.frameCalls=0;
        window.requestAnimationFrame=fn=>native(t=>{window.frameCalls++;fn(t);});
      });
      await check(page);console.log('PASS',name);
    }catch(error){failures.push(name);console.error('FAIL',name,error.message);}
    finally{await page.close();}
  }
  async function study(page){
    await page.getByRole('button',{name:'Score & studies',exact:true}).click();
    await page.getByRole('button',{name:'Explore four studies'}).click();
    await page.locator('.study-card').first().getByRole('button',{name:'Open study'}).click();
    await page.clock.runFor(100);
  }
  async function timed(page){
    await page.getByRole('button',{name:'Score & studies',exact:true}).click();
    await page.locator('#mode').selectOption('timed');
    await page.getByRole('button',{name:'Begin',exact:true}).click();await page.clock.runFor(100);
  }
  try{
    await run('immediate Return retains first Moment layout',async page=>{
      await page.evaluate(()=>{
        document.querySelector('#score-menu').click();
        [...document.querySelectorAll('button')].find(b=>b.textContent==='Begin').click();
        [...document.querySelectorAll('button')].find(b=>b.textContent==='Return').click();
      });
      const s=await page.evaluate(()=>HLDiagnostics.snapshot());
      assert.equal(s.layouts['040915'].bounds.length,2);assert.equal(s.history.length,1);
    });
    await run('reopening a study preserves its condition records and note',async page=>{
      await study(page);await page.getByRole('button',{name:'Variant · green',exact:true}).click();await page.clock.runFor(100);
      await page.locator('details:has(#observation) summary').click();
      await page.locator('#observation').fill('A retained observation');
      const before=await page.evaluate(()=>HLDiagnostics.studyRecord());
      await page.getByRole('button',{name:'Study index',exact:true}).click();
      await page.locator('.study-card').first().getByRole('button',{name:'Open study'}).click();await page.clock.runFor(100);
      assert.deepEqual(await page.evaluate(()=>HLDiagnostics.studyRecord()),before);
      await page.getByRole('button',{name:'Reset study',exact:true}).click();await page.clock.runFor(100);
      assert.equal((await page.evaluate(()=>HLDiagnostics.studyRecord())).readerObservation,null);
    });
    await run('visible study serialization follows observation input',async page=>{
      await study(page);await page.locator('details:has(#observation) summary').click();await page.locator('#observation').fill('The new note');
      assert.equal(JSON.parse(await page.locator('pre').textContent()).readerObservation,'The new note');
    });
    await run('study diagnostics cannot mutate retained records',async page=>{
      await study(page);const before=await page.evaluate(()=>HLDiagnostics.studyRecord());
      await page.evaluate(()=>{HLDiagnostics.studyRecord().layouts.length=0;});
      assert.deepEqual(await page.evaluate(()=>HLDiagnostics.studyRecord()),before);
    });
    await run('Reading view remount does not create another study trial',async page=>{
      await study(page);const before=await page.evaluate(()=>HLDiagnostics.studyRecord());
      await page.getByRole('button',{name:'Reading view',exact:true}).click();
      await page.getByRole('button',{name:'Back to experience',exact:true}).click();await page.clock.runFor(100);
      assert.deepEqual(await page.evaluate(()=>HLDiagnostics.studyRecord()),before);
    });
    await run('paused timed encounter stops frame scheduling and resumes',async page=>{
      await timed(page);await page.getByRole('button',{name:'Pause',exact:true}).click();await page.clock.runFor(100);
      await page.evaluate(()=>{window.frameCalls=0;});await page.clock.runFor(1000);
      assert.equal(await page.evaluate(()=>window.frameCalls),0);
      await page.getByRole('button',{name:'Resume',exact:true}).click();await page.clock.runFor(100);
      assert.ok(await page.evaluate(()=>window.frameCalls)>0);
    });
    await run('Reading view stops clock frames and resumes exposure',async page=>{
      await timed(page);await page.getByRole('button',{name:'Reading view',exact:true}).click();await page.clock.runFor(100);
      const elapsed=await page.evaluate(()=>HLDiagnostics.clock.elapsed);
      await page.evaluate(()=>{window.frameCalls=0;});await page.clock.runFor(1000);
      assert.equal(await page.evaluate(()=>window.frameCalls),0);
      assert.equal(await page.evaluate(()=>HLDiagnostics.clock.elapsed),elapsed);
      await page.getByRole('button',{name:'Back to experience',exact:true}).click();await page.clock.runFor(100);
      assert.ok(await page.evaluate(()=>HLDiagnostics.clock.elapsed)>elapsed);
    });
    await run('score menu swaps generative traces for score history',async page=>{
      await page.locator('.entrance-route').first().click();await page.clock.runFor(600);
      await page.getByRole('button',{name:'Return',exact:true}).click();await page.clock.runFor(400);
      assert.equal(await page.locator('.trace').count(),1);
      await page.getByRole('button',{name:'Score & studies',exact:true}).click();
      assert.equal(await page.locator('.trace').count(),0);
    });
    await run('time study records its actual single-encounter configuration',async page=>{
      await page.getByRole('button',{name:'Score & studies',exact:true}).click();
      await page.getByRole('button',{name:'Explore four studies',exact:true}).click();
      await page.locator('.study-card').nth(2).getByRole('button',{name:'Open study'}).click();await page.clock.runFor(100);
      const record=await page.evaluate(()=>HLDiagnostics.studyRecord());
      assert.deepEqual(record.configuration.sequence,['042115']);
      assert.equal(record.configuration.cycleLength,null);
      await page.getByRole('button',{name:'Enter condition',exact:true}).click();await page.clock.runFor(100);
      await page.getByRole('button',{name:'Return',exact:true}).click();await page.clock.runFor(100);
      assert.deepEqual((await page.evaluate(()=>HLDiagnostics.studyRecord())).configuration,record.configuration);
    });
    await run('generative return focuses a visible native entrance route',async page=>{
      await page.locator('.entrance-route').first().click();await page.clock.runFor(600);
      await page.getByRole('button',{name:'Return',exact:true}).click();await page.clock.runFor(400);
      assert.ok(await page.evaluate(()=>document.activeElement.matches('.entrance-route') && document.activeElement.getClientRects().length>0 && document.activeElement.tabIndex===0));
    });
  }finally{await browser.close();}
  assert.deepEqual(failures,[]);
})().catch(error=>{console.error(error);process.exitCode=1;});
