'use strict';
// Fail when a test or tool launches a browser without going through the silent helper (tests/silent-browser.cjs).
// The silence rule is absolute (no run may produce audible sound), so there is no allowlist beyond the helper itself.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git']);
const EXEMPT = new Set(['tests/silent-browser.cjs', 'tests/silent-browser.test.cjs', 'tests/silent-launch-lint.test.cjs']);
const ENGINES = ['chromium', 'webkit', 'firefox', '_electron', 'electron', 'browserType', 'browser_type', 'engine'];
const PLAYWRIGHT_ENGINES = ['chromium', 'webkit', 'firefox'];
// Owners that are application objects, not browser types (a driver file may drive an app that has its own launch()).
const SAFE_OWNERS = new Set(['this', 'self', 'lab', 'e', 'live', 'studio', 'player', 'runtime', 'controller', 'deck', 'app', 'window', 'document', 'console']);
const NAMES = 'launch|launchPersistentContext|launchServer|connectOverCDP';
// obj.launch(, obj\n  .launch(, obj['launch'](, and a launch pulled out by destructuring or bound for later.
const CALL = new RegExp(`(?<owner>[\\w$.\\]\\[]*?[\\w$\\]])\\s*\\.\\s*(?:${NAMES})\\b|(?<owner2>[\\w$]+)\\s*\\[\\s*['"](?:${NAMES})['"]\\s*\\]`, 'g');
const COMPUTED = /([\w$]+)\s*\[\s*[^\]'"\s][^\]]*\]\s*\(/g;  // engine[method]()
const DESTRUCTURED = new RegExp(`\\{[^}]*\\b(?:${NAMES})\\b[^}]*\\}\\s*=\\s*[\\w$.\\]\\[]*?(?:chromium|webkit|firefox|browserType|engine)\\b`, 'g');
const ALIAS_DESTRUCTURE = /\b(?:chromium|webkit|firefox)\s*:\s*([\w$]+)/g;
const ALIAS_IMPORT = /\b(?:chromium|webkit|firefox)\s+as\s+([\w$]+)/g;  // import {chromium as chrome} from 'playwright'
// Names such as `engine` are Playwright browser types only in a file that deals with a browser driver; application code
// has its own engine.launch(...).
const DRIVER_FILE = /playwright|puppeteer|chromium|firefox|browserType|browser_type|\bwebkit\s*[.,)]/i;
const PUPPETEER = /\bpuppeteer\b\s*\.\s*launch|(?:require\(|from\s+)['"]puppeteer/;

function lineOf(source, index) { return source.slice(0, index).split('\n').length; }

// String contents that mean something to the lint: a launch method name (chromium['launch']) and a bare module name
// (require('playwright')). Every other string is text, never a call.
const KEPT_STRING = new RegExp(`^(?:${NAMES}|(?:@[\\w.-]+/)?[\\w.-]+)$`);

// Blank out comments and the text of string literals, keeping every newline, so a commented or quoted launch is ignored,
// line numbers stay true and " // " inside a string never hides the code after it. A launch method name or module name
// used as a string stays, and a template literal with ${...} stays whole (its expressions run).
function blankText(source) {
  const blank = text => text.replace(/[^\n]/g, ' ');
  let out = '', i = 0, quote = null, start = 0;
  while (i < source.length) {
    const c = source[i], pair = source.slice(i, i + 2);
    if (quote === null) {
      if (pair === '//') { let j = source.indexOf('\n', i); if (j < 0) j = source.length; out += ' '.repeat(j - i); i = j; continue; }
      if (pair === '/*') { let j = source.indexOf('*/', i + 2); j = j < 0 ? source.length : j + 2; out += blank(source.slice(i, j)); i = j; continue; }
      out += c;
      if (c === '"' || c === "'" || c === '`') { quote = c; start = out.length; }
      i += 1;
      continue;
    }
    if (c === '\\' && i + 1 < source.length) { out += c + source[i + 1]; i += 2; continue; }
    if (c === quote || (c === '\n' && quote !== '`')) {
      const text = out.slice(start);
      if (!(KEPT_STRING.test(text) || (quote === '`' && text.includes('${')))) out = out.slice(0, start) + blank(text);
      quote = null;
    }
    out += c;
    i += 1;
  }
  return out;
}

function bareLaunches(source) {
  const code = blankText(source);
  const driver = DRIVER_FILE.test(code);
  const names = new Set(driver ? ENGINES : PLAYWRIGHT_ENGINES);
  for (let size = -1; size !== names.size;) {   // chained aliases: const bt = playwright.webkit; const runner = bt;
    size = names.size;
    const alias = new RegExp(`([\\w$]+)\\s*=\\s*(?:[\\w$.()'"\\[\\]]*?\\.)?(?:${[...names].map(n => n.replace(/\$/g, '\\$')).join('|')})\\b(?!\\s*\\.\\s*launch)`, 'g');
    for (const match of code.matchAll(alias)) names.add(match[1]);
  }
  for (const match of code.matchAll(ALIAS_DESTRUCTURE)) names.add(match[1]);
  for (const match of code.matchAll(ALIAS_IMPORT)) names.add(match[1]);
  const found = new Set();
  for (const match of code.matchAll(CALL)) {
    const owner = match.groups.owner || match.groups.owner2;
    const tail = (/([\w$]+)$/.exec(owner) || [])[1] || '';
    if ((driver && owner.endsWith(']')) || names.has(tail) || (driver && !SAFE_OWNERS.has(tail))) {
      found.add(lineOf(code, match.index + match[0].search(new RegExp(NAMES))));
    }
  }
  for (const match of code.matchAll(COMPUTED)) if (names.has(match[1])) found.add(lineOf(code, match.index));
  if (driver) for (const match of code.matchAll(DESTRUCTURED)) found.add(lineOf(code, match.index));
  const puppeteer = PUPPETEER.exec(code);
  if (puppeteer) found.add(lineOf(code, puppeteer.index));
  return [...found].sort((x, y) => x - y);
}

function* files(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (/\.(?:cjs|mjs|js|ts)$/.test(entry.name)) yield full;
  }
}

test('no test or tool launches a browser around the silent helper', () => {
  const bare = [];
  for (const file of files(ROOT)) {
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    if (EXEMPT.has(relative)) continue;
    for (const line of bareLaunches(fs.readFileSync(file, 'utf8'))) bare.push(`${relative}:${line}`);
  }
  assert.deepEqual(bare, [], 'launch through tests/silent-browser.cjs silentLaunch so the run is silent');
});

test('the lint sees a bare launch and accepts the helper', () => {
  assert.deepEqual(bareLaunches('const browser = await chromium.launch({headless:true});'), [1]);
  assert.deepEqual(bareLaunches('const b = await playwright.webkit.launch();'), [1]);
  assert.deepEqual(bareLaunches('await browserType.launchPersistentContext(dir, {});'), [1]);
  assert.deepEqual(bareLaunches('const b = await firefox.connectOverCDP(url);'), [1]);
  assert.deepEqual(bareLaunches('const browser = await silentLaunch(chromium, {headless:true});'), []);
  assert.deepEqual(bareLaunches('await lab.launch(id);'), []);
  assert.deepEqual(bareLaunches('// chromium.launch({headless:true})'), []);
  assert.deepEqual(bareLaunches('/* webkit.launch() */ const x = 1;'), []);
  assert.deepEqual(bareLaunches('await chromium\n  .launch({headless:true});'), [2]);
  assert.deepEqual(bareLaunches('const runner = chromium;\nawait runner.launch();'), [2]);
  assert.deepEqual(bareLaunches("const {chromium: runner} = require('playwright');\nawait runner.launch();"), [2]);
  assert.deepEqual(bareLaunches("const b = await playwright[kind].launch();"), [1]);
  assert.deepEqual(bareLaunches("import { chromium as chrome } from 'playwright';\nawait chrome.launch();"), [2]);
  assert.deepEqual(bareLaunches("const b = await chromium['launch']();"), [1]);
  assert.deepEqual(bareLaunches("const {launch} = chromium;\nawait launch();"), [1]);
  assert.deepEqual(bareLaunches('const launcher = chromium.launch.bind(chromium);'), [1]);
  assert.deepEqual(bareLaunches('const runner = silentLaunch(chromium, {});\nawait runner.close();'), []);
  assert.deepEqual(bareLaunches("const bt = playwright.webkit; const runner = bt; await runner.launch();"), [1]);
  assert.deepEqual(bareLaunches("const method = 'launch'; await chromium[method]();"), [1]);
  assert.deepEqual(bareLaunches("const pw = require('playwright'); await thing.launch();"), [1]);
  assert.deepEqual(bareLaunches('await lab.launch(id);'), []);
  assert.deepEqual(bareLaunches('const note = " // "; webkit.launch();'), [1]);
  assert.deepEqual(bareLaunches('const note = "webkit.launch()";'), []);
  assert.deepEqual(bareLaunches("const note = 'chromium.launch()'; // not a call"), []);
  assert.deepEqual(bareLaunches('const note = `see webkit.launch() for the call`;'), []);
  assert.deepEqual(bareLaunches('const note = `${await webkit.launch()}`;'), [1]);
  assert.deepEqual(bareLaunches('const s = "a\\" // b"; await webkit.launch();'), [1]);
  assert.deepEqual(bareLaunches('const url = "http://x"; // chromium.launch()'), []);
});

test('the helper itself is the only place that calls the Playwright launch API', () => {
  const helper = fs.readFileSync(path.join(ROOT, 'tests/silent-browser.cjs'), 'utf8');
  assert.equal((helper.match(/engine\.launch(?:PersistentContext)?\(/g) || []).length, 2);
});
