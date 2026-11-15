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
const LAUNCH = /(?<![\w$])(?<owner>[\w$.]*?)\b(?:launch|launchPersistentContext|launchServer|connectOverCDP)\s*\(/g;
const OWNER = /(?:^|\.)(?:chromium|webkit|firefox|_electron|electron|browserType|engine)$/;

function* files(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (/\.(?:cjs|mjs|js|ts)$/.test(entry.name)) yield full;
  }
}

function bareLaunches(source) {
  const found = [];
  source.split('\n').forEach((line, index) => {
    if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) return;
    for (const match of line.matchAll(LAUNCH)) {
      const owner = match.groups.owner.replace(/\.$/, '');
      if (owner && OWNER.test(owner)) found.push(index + 1);
    }
    if (/\b(?:chromium|webkit|firefox)\s*\.\s*launch\b/.test(line) && !found.includes(index + 1)) found.push(index + 1);
    if (/\bpuppeteer\b\s*\.\s*launch|require\(\s*['"]puppeteer/.test(line) && !found.includes(index + 1)) found.push(index + 1);
  });
  return found;
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
});

test('the helper itself is the only place that calls the Playwright launch API', () => {
  const helper = fs.readFileSync(path.join(ROOT, 'tests/silent-browser.cjs'), 'utf8');
  assert.equal((helper.match(/engine\.launch(?:PersistentContext)?\(/g) || []).length, 2);
});
