#!/usr/bin/env node
'use strict';

// Render the untouched historical source and the extraction in the same browser.
// Only the two historical Bootstrap CSS URLs are fulfilled from the local vendor
// directory. Missing historical paths remain 404s; no missing CSS is invented.
// Run: node verify-browser.cjs --original PATH --public PATH --vendor PATH
// Optional: --output PATH --executable PATH
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

function dependency(name) {
  try { return require(name); }
  catch (error) {
    if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw error;
    return require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, name));
  }
}
const { chromium } = dependency('playwright');
const { PNG } = dependency('pngjs');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert(process.argv[i].startsWith('--') && process.argv[i + 1], 'Arguments need --name value pairs');
  args[process.argv[i].slice(2)] = process.argv[i + 1];
}
const originalDir = path.resolve(args.original || path.join(__dirname, '../provenance/original-2017'));
const publicDir = path.resolve(args.public || path.join(__dirname, '../public'));
const vendorDir = path.resolve(args.vendor || path.join(publicDir, 'vendor/bootstrap-3.3.5'));
const outputDir = path.resolve(args.output || path.join(__dirname, '../verification/browser'));
const chamberIds = ['040615','040715','040815','040915','041015','041315','041415','041715','042115','042215','051815','072716'];
const routes = ['loophole.html', ...chamberIds.map(id => `labyrinth/${id}.html`)];
const devices = [
  { name: 'desktop', viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
];
const report = {
  schema: 'hole-loop-browser-verification-v1',
  historicalCommit: '7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0',
  startedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, devices, dependencies: {
    playwright: dependency('playwright/package.json').version,
    pngjs: dependency('pngjs/package.json').version
  } },
  methodology: [
    'Untouched historical HTML is rendered beside the extracted HTML in the same browser, font environment and viewport.',
    'Only the two Bootstrap 3.3.5 CDN CSS URLs are fulfilled with the bundled CSS. Missing original local assets return 404. Other external requests are blocked.',
    'JavaScript is disabled for static fidelity captures to prevent historical timers and inactive services interrupting comparison. Behavior is tested separately with JavaScript enabled.',
    'Screenshots compare exact decoded RGBA pixels. DOM comparisons retain empty elements, attributes, and exact text-node content, including whitespace inside text elements. Formatting-only whitespace between block elements, comments and inactive scripts are omitted.',
    'Computed styles, element rectangles and scroll dimensions are compared for every artwork element, including pseudo-elements.',
    'Timer tests use the browser clock to check the original delay boundary: chamber remains before the deadline and returns at the deadline.'
  ],
  limits: [
    'These are comparisons of the preserved source and extraction rendered now, not comparisons against a recovered 2017 screenshot or a 2017 browser.',
    'System font availability affects the historical Futura request. Both sides use the same installed fonts; no replacement font is added.',
    'The mobile viewport is a Chromium emulation, not a physical iPhone or Safari test.',
    'Known missing original resources are intentionally not reconstructed.'
  ],
  visual: [], behavior: [], failures: [],
  originalBlockedExternal: [], originalMissingLocal: [],
  restoredExternalRequests: [], restoredRequestFailures: [], restoredHttpErrors: [],
  restoredJavaScriptErrors: [], restoredConsoleErrors: [], browserFaviconProbes: []
};
fs.mkdirSync(outputDir, { recursive: true });
function writeJSON(name, value) { fs.writeFileSync(path.join(outputDir, name), JSON.stringify(value, null, 2) + '\n'); }
function sha(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function compare(name, actual, expected) {
  try { assert.deepStrictEqual(actual, expected); return true; }
  catch (error) { report.failures.push({ name, error: error.message.slice(0, 5000) }); return false; }
}
function unique(array) { return [...new Set(array)].sort(); }
function cleanURL(url) { return url.replace(/#[^#]*$/, ''); }
function historicalFile(candidate) {
  // The distributed archive appends .txt to executable text sources. Its HTTP
  // test mount restores only the original filenames, keeping original bytes.
  return fs.existsSync(candidate) ? candidate : fs.existsSync(candidate + '.txt') ? candidate + '.txt' : candidate;
}
const mime = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json',
  '.ico':'image/x-icon', '.png':'image/png', '.jpg':'image/jpeg',
  '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf', '.svg':'image/svg+xml'
};
const server = http.createServer((request, response) => {
  let requestPath;
  try { requestPath = decodeURIComponent(new URL(request.url, 'http://local').pathname); }
  catch { response.writeHead(400).end(); return; }
  let root = publicDir;
  let relative = requestPath;
  if (requestPath.startsWith('/__historical__/')) {
    root = originalDir; relative = requestPath.slice('/__historical__'.length);
  } else if (requestPath.startsWith('/nested/project/')) {
    relative = requestPath.slice('/nested/project'.length);
  }
  if (relative.endsWith('/')) relative += 'index.html';
  const candidate = path.resolve(root, '.' + relative);
  if (!candidate.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(root === originalDir ? historicalFile(candidate) : candidate, (error, content) => {
    if (error) { response.writeHead(404, { 'content-type':'text/plain', 'cache-control':'no-store' }).end('Not found'); return; }
    response.writeHead(200, { 'content-type': mime[path.extname(candidate)] || 'application/octet-stream', 'cache-control':'no-store' });
    response.end(content);
  });
});

// This runs in the page, including pages with authored JavaScript disabled.
function renderedState() {
  const skipped = new Set(['SCRIPT','STYLE','LINK']);
  const textParents = new Set(['P','A','SPAN','EM','STRONG','PRE','CODE','H1','H2','H3','H4','H5','H6','LI']);
  function nodeState(node, inText = false) {
    if (node.nodeType === 3) return /\S/.test(node.data) || inText ? ['text', node.data] : null;
    if (node.nodeType !== 1 || skipped.has(node.tagName)) return null;
    const attributes = [...node.attributes].map(a => [a.name, a.value]).sort((a,b)=>a[0].localeCompare(b[0]));
    const children = [...node.childNodes].map(child => nodeState(child, inText || textParents.has(node.tagName))).filter(x=>x !== null);
    return [node.tagName, attributes, children];
  }
  const selected = ['display','visibility','opacity','position','box-sizing','width','height','min-width','min-height','max-width','max-height','top','right','bottom','left','margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left','border-top-width','border-right-width','border-bottom-width','border-left-width','color','background-color','background-image','background-repeat','font-family','font-size','font-weight','font-style','line-height','letter-spacing','word-spacing','text-align','text-transform','text-decoration-line','white-space','overflow-x','overflow-y','vertical-align','float','clear','content'];
  const elements = [document.documentElement, document.body, ...document.body.querySelectorAll('*')].filter(e => !skipped.has(e.tagName));
  function styles(e, pseudo) {
    const s = getComputedStyle(e, pseudo);
    return Object.fromEntries(selected.map(k => [k, s.getPropertyValue(k)]));
  }
  return {
    title: document.title,
    bodyAttributes: [...document.body.attributes].map(a => [a.name, a.value]).sort((a,b)=>a[0].localeCompare(b[0])),
    artwork: [...document.body.childNodes].map(n=>nodeState(n)).filter(x=>x!==null),
    paragraphs: [...document.querySelectorAll('p')].map(p => ({ text: p.textContent, html: p.innerHTML })),
    elements: elements.map(e => {
      const rect = e.getBoundingClientRect();
      return {
        tag: e.tagName, id: e.id, className: e.className,
        rect: [rect.x,rect.y,rect.width,rect.height],
        scroll: [e.scrollWidth,e.scrollHeight,e.clientWidth,e.clientHeight,e.scrollLeft,e.scrollTop],
        style: styles(e), before: styles(e, '::before'), after: styles(e, '::after')
      };
    }),
    dimensions: [innerWidth,innerHeight,document.documentElement.scrollWidth,document.documentElement.scrollHeight]
  };
}
async function pageObservation(page, mode) {
  page.on('pageerror', error => report.restoredJavaScriptErrors.push({mode,message:error.message}));
  page.on('console', message => { if (message.type() === 'error') report.restoredConsoleErrors.push({mode,message:message.text()}); });
  page.on('requestfailed', request => {
    const item = {mode,url:request.url(),error:request.failure()?.errorText};
    if (!item.error?.includes('ERR_ABORTED')) report.restoredRequestFailures.push(item);
  });
  page.on('response', response => {
    if (response.status() < 400) return;
    const item = {mode,url:response.url(),status:response.status()};
    if (new URL(item.url).pathname === '/favicon.ico') report.browserFaviconProbes.push(item);
    else report.restoredHttpErrors.push(item);
  });
}
async function blockExternal(context, historical, origin) {
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || url.startsWith('file:') || url.startsWith('data:')) { await route.continue(); return; }
    if (historical && /^https:\/\/maxcdn\.bootstrapcdn\.com\/bootstrap\/3\.3\.5\/css\/(bootstrap|bootstrap-theme)\.min\.css$/.test(url)) {
      await route.fulfill({status:200,contentType:'text/css',path:path.join(vendorDir,'css',new URL(url).pathname.split('/').pop())});
      return;
    }
    (historical ? report.originalBlockedExternal : report.restoredExternalRequests).push(url);
    await route.abort('blockedbyclient');
  });
}
function pixelDifference(aBuffer, bBuffer, filename) {
  const a = PNG.sync.read(aBuffer), b = PNG.sync.read(bBuffer);
  if (a.width !== b.width || a.height !== b.height) return { equal:false, differentPixels:null, dimensionsA:[a.width,a.height],dimensionsB:[b.width,b.height] };
  let differentPixels = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i+1] !== b.data[i+1] || a.data[i+2] !== b.data[i+2] || a.data[i+3] !== b.data[i+3]) differentPixels++;
  }
  if (differentPixels) {
    const diff = new PNG({width:a.width,height:a.height});
    for (let i = 0; i < a.data.length; i += 4) {
      const changed = a.data[i] !== b.data[i] || a.data[i+1] !== b.data[i+1] || a.data[i+2] !== b.data[i+2] || a.data[i+3] !== b.data[i+3];
      diff.data[i] = changed ? 255 : 240; diff.data[i+1] = changed ? 0 : 240; diff.data[i+2] = changed ? 80 : 240; diff.data[i+3] = 255;
    }
    fs.writeFileSync(path.join(outputDir,filename),PNG.sync.write(diff));
  }
  return {equal:differentPixels===0,differentPixels,totalPixels:a.width*a.height};
}

async function capturePair(source, restored, id) {
  const [sourceState,restoredState] = await Promise.all([source.evaluate(renderedState),restored.evaluate(renderedState)]);
  const [sourcePNG,restoredPNG] = await Promise.all([
    source.screenshot({path:path.join(outputDir,`${id}.original.png`),animations:'disabled'}),
    restored.screenshot({path:path.join(outputDir,`${id}.restored.png`),animations:'disabled'})
  ]);
  const pixels = pixelDifference(sourcePNG,restoredPNG,`${id}.difference.png`);
  const domEqual = compare(`${id}: rendered DOM, text, styles and geometry`,restoredState,sourceState);
  if (!pixels.equal) report.failures.push({name:`${id}: screenshot pixels`,...pixels});
  writeJSON(`${id}.dom.json`,{historical:sourceState,restored:restoredState});
  report.visual.push({id,domEqual,pixels,originalSHA256:sha(sourcePNG),restoredSHA256:sha(restoredPNG),paragraphCount:sourceState.paragraphs.length,emptyParagraphs:sourceState.paragraphs.filter(p=>!p.text.trim()).length});
  console.log(`visual ${id}: DOM ${domEqual?'PASS':'FAIL'}, pixels ${pixels.differentPixels}`);
}

async function main() {
  for (const route of routes) for (const root of [originalDir,publicDir]) {
    const candidate = path.join(root,route);
    assert(fs.existsSync(root === originalDir ? historicalFile(candidate) : candidate), `Missing input ${candidate}`);
  }
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless:true, ...(args.executable ? {executablePath:path.resolve(args.executable)} : {}),args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote']});
  report.environment.browser = await browser.version();
  try {
    for (const device of devices) {
      const options = {viewport:device.viewport,isMobile:device.isMobile,hasTouch:device.hasTouch,deviceScaleFactor:1,javaScriptEnabled:false};
      const sourceContext = await browser.newContext(options);
      const restoredContext = await browser.newContext(options);
      await blockExternal(sourceContext,true,origin);
      await blockExternal(restoredContext,false,origin);
      const source = await sourceContext.newPage(), restored = await restoredContext.newPage();
      source.on('response', response => { if (response.status() >= 400) report.originalMissingLocal.push(response.url()); });
      await pageObservation(restored,`visual-${device.name}`);
      for (const route of routes) {
        await Promise.all([
          source.goto(`${origin}/__historical__/${route}`,{waitUntil:'load'}),
          restored.goto(`${origin}/${route}`,{waitUntil:'load'})
        ]);
        await capturePair(source,restored,`${device.name}-${route.replace(/\//g,'-').replace(/\.html$/,'')}`);
      }
      await Promise.all([source.goto(`${origin}/__historical__/loophole.html`),restored.goto(`${origin}/loophole.html`)]);
      for (const className of ['class1b','class2a','class3a','class4a']) {
        await Promise.all([source.locator(`a.${className}`).first().hover(),restored.locator(`a.${className}`).first().hover()]);
        await capturePair(source,restored,`${device.name}-loophole-hover-${className}`);
      }
      await Promise.all([sourceContext.close(),restoredContext.close()]);
    }
    const bases = [
      {name:'http-root',url:origin+'/'},
      {name:'http-subdirectory',url:origin+'/nested/project/'},
      {name:'file',url:pathToFileURL(publicDir+path.sep).href}
    ];
    for (const base of bases) {
      const context = await browser.newContext({viewport:devices[0].viewport});
      await blockExternal(context,false,origin);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      await pageObservation(page,base.name);
      await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
      await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
      for (const entry of (base.name === 'file' ? ['index.html','loophole.html'] : ['','index.html','loophole.html'])) {
        await page.goto(new URL(entry,base.url).href,{waitUntil:'load'});
        assert.equal(await page.title(),'FELL INTO A wHOLE');
        assert.equal(await page.locator('#loop a').count(),11);
        assert.equal(await page.locator('#loop p').count(),22,'Empty paragraphs from original closing tags must remain');
        report.behavior.push({name:`${base.name}: entrance ${entry||'directory root'}`,passed:true});
      }
      // Twelve deterministic browser activations cover all destinations and all
      // eleven authored links; explicit random extrema cover the old defect.
      const randomValues = [...chamberIds.map((_,i)=>(i+0.5)/12),0,1-Number.EPSILON];
      for (let i = 0; i < randomValues.length; i++) {
        const value = randomValues[i];
        const expectedIndex = Math.floor(value*12);
        await page.goto(new URL('loophole.html',base.url).href,{waitUntil:'load'});
        await page.evaluate(value=>{Math.random=()=>value;},value);
        const expected = new URL(`labyrinth/${chamberIds[expectedIndex]}.html`,base.url).href;
        await Promise.all([
          page.waitForURL(url=>cleanURL(url.href)===expected,{waitUntil:'load'}),
          page.locator('#loop a').nth(i%11).click()
        ]);
        assert.equal(cleanURL(page.url()),expected);
        report.behavior.push({name:`${base.name}: link ${i%11+1} random ${value}`,destination:chamberIds[expectedIndex],passed:true});
      }
      for (const id of chamberIds) {
        const expectedDuration = id==='040615'?10000:id==='072716'?2000:5000;
        const chamberURL = new URL(`labyrinth/${id}.html`,base.url).href;
        const returnURL = new URL('loophole.html',base.url).href;
        await page.goto(chamberURL,{waitUntil:'load'});
        assert.equal(await page.evaluate(()=>typeof document.body.onload),'function','Duplicate source body tags must retain the onload handler');
        await page.clock.fastForward(expectedDuration-1);
        assert.equal(cleanURL(page.url()),chamberURL,'No return before source duration');
        await Promise.all([page.waitForURL(returnURL,{waitUntil:'load'}),page.clock.fastForward(1)]);
        assert.equal(cleanURL(page.url()),returnURL);
        report.behavior.push({name:`${base.name}: ${id} timer`,duration:expectedDuration,passed:true});
      }
      // Return, select the same chamber, and demonstrate that the timer runs
      // again on the new document, rather than retaining an expired state.
      for (let visit=1;visit<=2;visit++) {
        await page.goto(new URL('loophole.html',base.url).href,{waitUntil:'load'});
        await page.evaluate(()=>{Math.random=()=>1-Number.EPSILON;});
        const chamberURL=new URL('labyrinth/072716.html',base.url).href;
        await Promise.all([page.waitForURL(chamberURL,{waitUntil:'load'}),page.locator('#loop a').first().click()]);
        await page.clock.fastForward(1999);
        assert.equal(cleanURL(page.url()),chamberURL);
        await Promise.all([page.waitForURL(new URL('loophole.html',base.url).href,{waitUntil:'load'}),page.clock.fastForward(1)]);
        report.behavior.push({name:`${base.name}: same chamber repeat ${visit}`,passed:true});
      }
      await context.close();
      console.log(`behavior ${base.name}: PASS`);
    }
    compare('restored pages attempted no external requests',report.restoredExternalRequests,[]);
    compare('restored pages had no failed resource requests',report.restoredRequestFailures,[]);
    compare('restored pages had no HTTP asset failures',report.restoredHttpErrors,[]);
    compare('restored pages had no JavaScript errors',report.restoredJavaScriptErrors,[]);
    compare('restored pages had no console errors',report.restoredConsoleErrors,[]);
  } finally { await browser.close(); }
}

main().catch(error=>{
  report.failures.push({name:'test execution',error:error.stack||String(error)});
  console.error(error);
}).finally(()=>{
  server.close();
  compare('expected two viewport configurations',devices.length,2);
  compare('expected thirteen historical routes',routes.length,13);
  compare('expected thirty-four completed visual cases',report.visual.length,34);
  compare('expected ninety-two completed behavior checks',report.behavior.length,92);
  for (const device of devices) compare(`expected seventeen ${device.name} visual cases`,report.visual.filter(v=>v.id.startsWith(device.name+'-')).length,17);
  for (const [mode,expected] of [['http-root',31],['http-subdirectory',31],['file',30]]) compare(`expected ${expected} ${mode} behavior checks`,report.behavior.filter(v=>v.name.startsWith(mode+':')).length,expected);
  for (const key of ['originalBlockedExternal','originalMissingLocal','restoredExternalRequests']) report[key]=unique(report[key]);
  report.finishedAt=new Date().toISOString();
  report.passed=report.failures.length===0;
  report.summary={visualCases:report.visual.length,visualPasses:report.visual.filter(v=>v.domEqual&&v.pixels.equal).length,behaviorChecks:report.behavior.length,failures:report.failures.length};
  writeJSON('report.json',report);
  console.log(JSON.stringify({passed:report.passed,...report.summary,report:path.join(outputDir,'report.json')}));
  process.exitCode=report.passed?0:1;
});
