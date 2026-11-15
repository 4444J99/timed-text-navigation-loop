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

const REGEX_AFTER = new Set('(,=:[!&|?{};+-*%<>~^');
const REGEX_AFTER_WORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await']);
const isWord = c => /[A-Za-z0-9_$]/.test(c);

// Index just past the regex literal that opens at i (a slash), or i + 1 when it does not close on its line.
function regexEnd(source, i) {
  let j = i + 1, inClass = false;
  while (j < source.length && source[j] !== '\n') {
    const c = source[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) { j += 1; while (j < source.length && isWord(source[j])) j += 1; return j; }
    j += 1;
  }
  return i + 1;
}

// Blank out comments, keeping every newline, so a commented launch is ignored and line numbers stay true. A small lexer,
// so the comment markers it blanks are real ones: string literals are walked (" // " inside a string never hides the code
// after it), regex literals are skipped whole (/\// and /"/ are not comments or strings), and template literals nest
// (${ ok ? `a` : `b` }) with their expressions lexed as code. Text inside strings, regexes and templates stays in place on
// purpose: the scan reports a launch that is only named in text (reword it) rather than risk hiding a real one. Where the
// lexer misreads a slash, the misread span is still scanned, so the error is an extra report, not a hidden launch.
function blankComments(source) {
  const n = source.length, blank = text => text.replace(/[^\n]/g, ' ');
  const frames = [{kind: 'code', depth: 0}];
  let out = '', i = 0, prev = '', prevWord = '';
  while (i < n) {
    const top = frames[frames.length - 1], c = source[i], pair = source.slice(i, i + 2);
    if (top.kind === 'tmpl') {
      if (c === '\\' && i + 1 < n) { out += pair; i += 2; }
      else if (c === '`') { frames.pop(); out += c; i += 1; prev = '`'; }
      else if (pair === '${') { frames.push({kind: 'code', depth: 0}); out += pair; i += 2; prev = '{'; }
      else { out += c; i += 1; }
      continue;
    }
    if (pair === '//') { let j = source.indexOf('\n', i); if (j < 0) j = n; out += ' '.repeat(j - i); i = j; continue; }
    if (pair === '/*') { let j = source.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; out += blank(source.slice(i, j)); i = j; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && source[j] !== c && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1;
      j = Math.min(j + 1, n);
      out += source.slice(i, j); i = j; prev = c;
      continue;
    }
    if (c === '`') { frames.push({kind: 'tmpl', depth: 0}); out += c; i += 1; continue; }
    if (c === '/' && (prev === '' || REGEX_AFTER.has(prev) || REGEX_AFTER_WORDS.has(prevWord))) {
      const j = regexEnd(source, i);
      out += source.slice(i, j); i = j; prev = ')'; prevWord = '';
      continue;
    }
    if (c === '{') top.depth += 1;
    else if (c === '}') {
      if (top.depth === 0 && frames.length > 1) { frames.pop(); out += c; i += 1; continue; }
      top.depth -= 1;
    }
    out += c; i += 1;
    if (!/\s/.test(c)) {
      prevWord = isWord(c) ? (isWord(prev) ? prevWord + c : c) : '';
      prev = c;
    }
  }
  return out;
}

function bareLaunches(source) {
  const code = blankComments(source);
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
  // Text that only names a launch is reported (reword it): string text is never blanked, so a lexer slip cannot hide a launch.
  assert.deepEqual(bareLaunches('const note = "webkit.launch()";'), [1]);
  // Regex literals are lexed whole: a quote, a slash pair or a block-comment opener inside one is not code structure.
  assert.deepEqual(bareLaunches('s.replace(/"/g, ""); await webkit.launch();'), [1]);
  assert.deepEqual(bareLaunches('if (/"/.test(a)) f("x // y"); await webkit.launch();'), [1]);
  assert.deepEqual(bareLaunches('s.replace(/"/g, ""); u = "a // b"; webkit.launch();'), [1]);
  assert.deepEqual(bareLaunches('const parts = p.split(/\\//); await chromium.launch();'), [1]);
  assert.deepEqual(bareLaunches('const g = /a\\/*/; await webkit.launch(); /* real comment */'), [1]);
  assert.deepEqual(bareLaunches("s.replace(/`/g, '');\nawait webkit.launch();\nconst t = `x`;"), [2]);
  assert.deepEqual(bareLaunches('return /x/.test(y); // webkit.launch()'), []);
  assert.deepEqual(bareLaunches('const r = a / b; // webkit.launch()'), []);
  // Template literals nest and their expressions are code.
  assert.deepEqual(bareLaunches('const s = `${ok ? `a` : `b`}`;\nfetch("http://x"); webkit.launch();'), [2]);
  assert.deepEqual(bareLaunches('x = `a ${ {b: 1}.b } c`; // webkit.launch()\nwebkit.launch();'), [2]);
  assert.deepEqual(bareLaunches('const note = `${await webkit.launch()}`;'), [1]);
  assert.deepEqual(bareLaunches('const s = "a\\" // b"; await webkit.launch();'), [1]);
  assert.deepEqual(bareLaunches('const url = "http://x"; // chromium.launch()'), []);
});

test('the helper itself is the only place that calls the Playwright launch API', () => {
  const helper = fs.readFileSync(path.join(ROOT, 'tests/silent-browser.cjs'), 'utf8');
  assert.equal((helper.match(/engine\.launch(?:PersistentContext)?\(/g) || []).length, 2);
});
