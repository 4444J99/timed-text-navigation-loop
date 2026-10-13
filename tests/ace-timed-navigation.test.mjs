import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const enginePath = resolve(root, 'experimental/six-encounters/engine.js');
const require = createRequire(import.meta.url);

test('browser and CommonJS APIs share the implementation and keep the legacy alias', () => {
  const context = { window: {}, structuredClone };
  vm.runInNewContext(readFileSync(enginePath, 'utf8'), context);
  assert.strictEqual(context.window.ACETimedNavigation, context.window.HLEngine);
  const exported = require(enginePath);
  assert.strictEqual(exported, globalThis.ACETimedNavigation);
  assert.strictEqual(exported, globalThis.HLEngine);
  assert.equal(typeof exported.Session, 'function');
  assert.equal(typeof exported.ExposureClock, 'function');
});

test('another score controls encounter identities, duration and return without artwork globals', () => {
  const context = { window: {}, structuredClone };
  vm.runInNewContext(readFileSync(enginePath, 'utf8'), context);
  const { Session, ExposureClock } = context.window.ACETimedNavigation;
  const sequence = ['spoken-fragment', 'silence', 'spoken-fragment'];
  const session = new Session({ sequence, cycleLength: 3, traceLimit: 2 }, 'timed');
  let now = 0;
  for (const expected of sequence) {
    const encounter = session.enter();
    assert.equal(encounter.chamber, expected);
    const timer = new ExposureClock({ now: () => now, duration: 250,
      onExpire: () => session.returnEncounter(encounter.id, 'timer') });
    timer.set({ ready: true, visible: true });
    now += 125; timer.set({ paused: true });
    now += 10000; timer.tick();
    assert.equal(session.active.id, encounter.id);
    timer.set({ paused: false });
    now += 125; timer.tick(); timer.tick();
    assert.equal(session.active, null);
  }
  assert.equal(session.history.length, 3);
  assert.equal(session.completedCycles, 1);
  assert.equal(session.traces.length, 2);
  assert.equal(session.enter(), null);
  assert.equal(context.window.HLContent, undefined);
  assert.equal(context.window.HLScore, undefined);
});
