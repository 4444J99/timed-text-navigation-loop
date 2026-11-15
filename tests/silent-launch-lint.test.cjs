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
const NAMES = 'launch|launchPersistentContext|launchServer|connectOverCDP';
// obj.launch(, obj\n  .launch(, obj['launch'](, and a launch pulled out by destructuring or bound for later.
const CALL = new RegExp(`(?<owner>[\\w$.\\]\\[]*?[\\w$\\]])\\s*\\.\\s*(?:${NAMES})\\b|(?<owner2>[\\w$]+)\\s*\\[\\s*['"](?:${NAMES})['"]\\s*\\]`, 'g');
const DESTRUCTURED = new RegExp(`\\{[^}]*\\b(?:${NAMES})\\b[^}]*\\}\\s*=\\s*[\\w$.\\]\\[]*?(?:chromium|webkit|firefox|browserType|engine)\\b`, 'g');
// A Playwright engine under another name: const runner = chromium; const {chromium: runner} = require('playwright');
const ALIAS_ASSIGN = /([\w$]+)\s*=\s*(?:[\w$.()'"\[\]]*?\.)?(?:chromium|webkit|firefox)\b(?!\s*\.\s*launch)/g;
const ALIAS_DESTRUCTURE = /\b(?:chromium|webkit|firefox)\s*:\s*([\w$]+)/g;
const PUPPETEER = /\bpuppeteer\b\s*\.\s*launch|(?:require\(|from\s+)['"]puppeteer/;

function lineOf(source, index) { return source.slice(0, index).split('\n').length; }

function bareLaunches(source) {
  // Blank out comments, keeping every newline, so a commented launch is ignored and line numbers stay true.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, lead) => lead + ' '.repeat(m.length - lead.length));
  const names = new Set(ENGINES);
  for (const match of code.matchAll(ALIAS_ASSIGN)) names.add(match[1]);
  for (const match of code.matchAll(ALIAS_DESTRUCTURE)) names.add(match[1]);
  const found = new Set();
  for (const match of code.matchAll(CALL)) {
    const owner = match.groups.owner || match.groups.owner2;
    const tail = /([\w$]+)$/.exec(owner);
    if (owner.endsWith(']') || (tail && names.has(tail[1]))) found.add(lineOf(code, match.index + match[0].search(new RegExp(NAMES))));
  }
  for (const match of code.matchAll(DESTRUCTURED)) found.add(lineOf(code, match.index));
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
  assert.deepEqual(bareLaunches("const b = await chromium['launch']();"), [1]);
  assert.deepEqual(bareLaunches("const {launch} = chromium;\nawait launch();"), [1]);
  assert.deepEqual(bareLaunches('const launcher = chromium.launch.bind(chromium);'), [1]);
  assert.deepEqual(bareLaunches('const runner = silentLaunch(chromium, {});\nawait runner.close();'), []);
});

test('the helper itself is the only place that calls the Playwright launch API', () => {
  const helper = fs.readFileSync(path.join(ROOT, 'tests/silent-browser.cjs'), 'utf8');
  assert.equal((helper.match(/engine\.launch(?:PersistentContext)?\(/g) || []).length, 2);
});
