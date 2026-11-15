'use strict';
// The silent launch helper mutes at the source: flags, media elements and the AudioContext destination.
// Every fixture is silent content (a zero-sample WAV), so a helper regression fails an assertion and never
// makes a sound. Browsers launch only through silentLaunch.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {silentLaunch, silentLaunchPersistentContext, silentArgs, silenceContext, INIT_SCRIPT_PATH, initScript} = require('./silent-browser.cjs');

function dependency(name) {
  try { return require(name); }
  catch (error) {
    if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw error;
    return require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, name));
  }
}

function silentWav() {
  const samples = 4000, header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + samples * 2, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24); header.writeUInt32LE(16000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(samples * 2, 40);
  return 'data:audio/wav;base64,' + Buffer.concat([header, Buffer.alloc(samples * 2)]).toString('base64');
}
const wav = silentWav();
const page = 'data:text/html;base64,' + Buffer.from(`<!doctype html><meta charset="utf-8"><body>
<audio id="parsed" autoplay loop src="${wav}"></audio><video id="parsed_video" loop src="${wav}"></video>
<div id="later"></div><iframe srcdoc="<audio id='inner' loop src='${wav}'></audio>"></iframe></body>`).toString('base64');

function fakeEngine(name) {
  const scripts = [];
  const contexts = [];
  const context = () => { const c = {addInitScript: async options => { scripts.push(options.path); }, closed: false, close: async () => { c.closed = true; }, newPage: async () => ({close: async () => {}})}; contexts.push(c); return c; };
  return {scripts, contexts, launched: null, name: () => name,
    async launch(options) { this.launched = options; return {newContext: async () => context(), newPage: async () => { throw new Error('original newPage must not run'); }}; },
    async launchPersistentContext(dir, options) { this.launched = {dir, ...options}; return context(); }};
}

test('chromium gets --mute-audio merged with the caller arguments, once', async () => {
  const engine = fakeEngine('chromium');
  await silentLaunch(engine, {headless: true, args: ['--no-sandbox', '--no-zygote']});
  assert.deepEqual(engine.launched, {headless: true, args: ['--no-sandbox', '--no-zygote', '--mute-audio']});
  assert.deepEqual(silentArgs('chromium', ['--mute-audio']), ['--mute-audio']);
  assert.deepEqual(silentArgs('chromium'), ['--mute-audio']);
});

test('webkit and firefox have no flag and rely on the init script', async () => {
  assert.deepEqual(silentArgs('webkit', ['--x']), ['--x']);
  assert.deepEqual(silentArgs('firefox'), []);
});

test('every context, page and persistent context gets the init script', async () => {
  const engine = fakeEngine('webkit');
  const browser = await silentLaunch(engine, {});
  await browser.newContext();
  const page = await browser.newPage();
  await silentLaunchPersistentContext(engine, '/profile', {});
  assert.deepEqual(engine.scripts, [INIT_SCRIPT_PATH, INIT_SCRIPT_PATH, INIT_SCRIPT_PATH]);
  await page.close();
  assert.equal(engine.contexts[1].closed, true, 'the page owns its silenced context and closes it');
  assert.ok(initScript().includes('__SILENT_BROWSER__'));
});

function chromePath() {
  const configured = process.env.PORTVS_BROWSER_EXECUTABLE || process.env.SYSTEM_CHROME || process.env.HL_CHROMIUM_PATH;
  if (configured) return configured;
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return fs.existsSync(mac) ? mac : undefined;
}

async function launchOrSkip(t, name, raw = false) {
  const playwright = dependency('playwright');
  const executablePath = name === 'chromium' ? chromePath() : undefined;
  try {
    const options = {headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'], ...(executablePath ? {executablePath} : {})};
    // raw: a browser whose contexts the test silences itself, so it can install a spy underneath the init script.
    if (raw) return await playwright[name].launch({...options, args: silentArgs(name, options.args)});
    return await silentLaunch(playwright[name], options);
  } catch (error) {
    const missing = /Executable doesn't exist|browser.*(?:is not|isn't) installed/i.test(String(error.message));
    if (name === 'chromium' || process.env.SILENT_BROWSER_REQUIRE_ALL === '1' || !missing) throw error;  // only a confirmed missing executable skips
    t.skip(`${name} is not installed here: ${String(error.message).split('\n')[0]}`);
    return null;
  }
}

for (const engineName of ['chromium', 'webkit']) {
  test(`${engineName}: media elements stay natively muted at volume 0 and the audio graph has a gain-0 sink`, async t => {
    const browser = await launchOrSkip(t, engineName);
    if (!browser) return;
    try {
      const blank = await browser.newPage();
      await blank.setContent('<audio id="a"></audio>');
      assert.equal(await blank.evaluate(() => window.__SILENT_BROWSER__.native(document.querySelector('#a')).muted), true,
        'a document written into the blank page is silenced too');
      await blank.close();
      const tab = await browser.newPage();
      await tab.goto(page);
      assert.equal(await tab.evaluate(() => typeof window.__SILENT_BROWSER__), 'object');
      const frame = tab.frames().find(f => f !== tab.mainFrame());
      assert.equal(await frame.evaluate(() => typeof window.__SILENT_BROWSER__), 'object');
      const media = await tab.evaluate(async () => {
        const source = document.querySelector('#parsed').src;
        const made = document.createElement('audio'); made.src = source;
        const constructed = new Audio(source);
        document.querySelector('#later').innerHTML = `<video id="injected" src="${source}"></video>`;
        const all = {parsed: document.querySelector('#parsed'), parsedVideo: document.querySelector('#parsed_video'), made, constructed,
          injected: document.querySelector('#injected')};
        const out = {};
        for (const [name, el] of Object.entries(all)) {
          const before = window.__SILENT_BROWSER__.native(el);
          el.muted = false; el.volume = 0.5;
          await el.play().catch(() => {});
          out[name] = {before, native: window.__SILENT_BROWSER__.native(el), asked: {muted: el.muted, volume: el.volume}};
        }
        return out;
      });
      for (const [name, state] of Object.entries(media)) {
        assert.deepEqual(state.before, {muted: true, volume: 0}, `${name} is pinned before the app touches it`);
        assert.deepEqual(state.native, {muted: true, volume: 0}, `${name} stays pinned after the app unmutes and plays`);
        assert.deepEqual(state.asked, {muted: false, volume: 0.5}, `${name}: the app reads back what it set`);
      }
      const audio = await tab.evaluate(() => {
        const Context = window.AudioContext || window.webkitAudioContext;
        const ctx = new Context(), level = ctx.createGain(); level.gain.value = 0;
        const returned = level.connect(ctx.destination), sink = window.__SILENT_BROWSER__.sink(ctx);
        const out = {chained: returned === ctx.destination, sinkGain: sink.gain.value, sinkIsGain: sink instanceof GainNode};
        ctx.close();
        return out;
      });
      assert.deepEqual(audio, {chained: true, sinkGain: 0, sinkIsGain: true});
      const offline = await tab.evaluate(async () => {
        const context = new OfflineAudioContext(1, 4000, 8000), osc = context.createOscillator();
        osc.connect(context.destination); osc.start();
        const data = (await context.startRendering()).getChannelData(0);
        let peak = 0; for (const value of data) peak = Math.max(peak, Math.abs(value));
        return {sink: window.__SILENT_BROWSER__.sink(context), peak};
      });
      assert.equal(offline.sink, null);
      assert.ok(offline.peak > 0.1, 'offline rendering renders to a buffer and keeps its signal');
    } finally { await browser.close(); }
  });
}

const SPY = `(() => { const calls = []; window.__connectCalls = calls; const native = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) {
    calls.push({from: this.constructor.name, to: target && target.constructor && target.constructor.name});
    return native.call(this, target, ...rest);
  }; })();`;

for (const engineName of ['chromium', 'webkit']) {
  test(`${engineName}: a connection to the realtime destination reaches the native connect only through the gain-0 sink`, async t => {
    const browser = await launchOrSkip(t, engineName, true);
    if (!browser) return;
    try {
      const context = await browser.newContext();
      await context.addInitScript(SPY);          // installed first, so it sits underneath the silent init script
      await silenceContext(context);
      const tab = await context.newPage();
      await tab.goto('data:text/html,<title>x</title>');
      const seen = await tab.evaluate(() => {
        const Context = window.AudioContext || window.webkitAudioContext;
        const ctx = new Context(), osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        const calls = window.__connectCalls.slice(), sink = window.__SILENT_BROWSER__.sink(ctx);
        ctx.close();
        return {calls, sinkGain: sink.gain.value};
      });
      const toDestination = seen.calls.filter(call => call.to === 'AudioDestinationNode');
      assert.deepEqual(toDestination, [{from: 'GainNode', to: 'AudioDestinationNode'}], 'only the sink itself reaches the device node');
      assert.equal(seen.sinkGain, 0);
      assert.ok(seen.calls.some(call => call.from === 'GainNode' && call.to === 'GainNode'), 'the app node was routed into the sink');
    } finally { await browser.close(); }
  });

  test(`${engineName}: pinned elements announce volume changes, keep the range check, and shadow roots are covered`, async t => {
    const browser = await launchOrSkip(t, engineName);
    if (!browser) return;
    try {
      const tab = await browser.newPage();
      await tab.goto(page);
      const result = await tab.evaluate(async () => {
        const el = document.querySelector('#parsed');
        const events = []; el.addEventListener('volumechange', () => events.push([el.muted, el.volume]));
        el.volume = 0.5; el.volume = 0.5; el.muted = true; el.muted = true;
        let thrown = null; try { el.volume = 3; } catch (error) { thrown = error.name; }
        const afterThrow = {asked: el.volume, native: window.__SILENT_BROWSER__.native(el)};
        const host = document.createElement('div'); document.body.append(host);
        const open = host.attachShadow({mode: 'open'});
        open.innerHTML = `<audio id="in_shadow" loop src="${el.src}"></audio>`;
        await new Promise(resolve => setTimeout(resolve, 0));
        const inner = open.querySelector('#in_shadow');
        const closedHost = document.createElement('div'); document.body.append(closedHost);
        const closed = closedHost.attachShadow({mode: 'closed'});
        closed.innerHTML = `<video id="in_closed" loop src="${el.src}"></video>`;
        await new Promise(resolve => setTimeout(resolve, 0));
        const closedInner = closed.querySelector('#in_closed');
        return {events, thrown, afterThrow, shadowNative: window.__SILENT_BROWSER__.native(inner),
          closedNative: window.__SILENT_BROWSER__.native(closedInner)};
      });
      assert.deepEqual(result.events, [[false, 0.5], [true, 0.5]], 'one event per change the app made, none for a repeated value');
      assert.equal(result.thrown, 'IndexSizeError');
      assert.deepEqual(result.afterThrow, {asked: 0.5, native: {muted: true, volume: 0}});
      assert.deepEqual(result.shadowNative, {muted: true, volume: 0});
      assert.deepEqual(result.closedNative, {muted: true, volume: 0});
    } finally { await browser.close(); }
  });
}
