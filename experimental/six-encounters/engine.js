/* Pure session transitions and an injected monotonic exposure clock. No DOM. */
(function (root) {
  let sessionSerial = 0;
  class Session {
    constructor(config, mode = 'reader') { this.config = config; this.restart(mode); }
    restart(mode = 'reader') {
      if (!['reader','timed'].includes(mode)) throw new Error('Unknown mode');
      this.generation = ++sessionSerial; this.mode = mode; this.visits = {};
      this.active = null; this.history = []; this.traces = []; this.layouts = {};
      this.completedCycles = 0; this.exited = false; this.entries = [];
    }
    enter() {
      if (this.active || this.exited || this.entries.length >= this.config.sequence.length) return null;
      const chamber = this.config.sequence[this.entries.length];
      const visit = this.visits[chamber] = (this.visits[chamber] || 0) + 1;
      this.active = { id: `${this.generation}:${this.entries.length + 1}`, chamber, visit, elapsed: 0 };
      this.entries.push({ ...this.active }); return this.active;
    }
    recordLayout(id, layout) {
      if (this.active?.id !== id || this.active.visit !== 1 || this.layouts[this.active.chamber]) return;
      this.layouts[this.active.chamber] = structuredClone(layout);
    }
    returnEncounter(id, reason = 'manual') {
      if (!this.active || this.active.id !== id || this.exited) return false;
      const event = { ...this.active, reason };
      this.history.push(event); this.traces.push(event);
      this.traces = this.traces.slice(-this.config.traceLimit);
      this.completedCycles = this.config.cycleLength ? Math.floor(this.history.length / this.config.cycleLength) : 0;
      this.active = null; return true;
    }
    exit() { this.active = null; this.exited = true; }
    snapshot() {
      return structuredClone({ mode: this.mode, active: this.active, visits: this.visits,
        layouts: this.layouts, entries: this.entries, history: this.history, traces: this.traces,
        completedCycles: this.completedCycles, exited: this.exited });
    }
  }
  class ExposureClock {
    constructor({ now, duration, onExpire }) {
      this.now = now; this.duration = duration; this.onExpire = onExpire;
      this.elapsed = 0; this.last = now(); this.visible = false; this.ready = false;
      this.paused = false; this.active = true; this.fired = false;
    }
    get eligible() { return this.active && this.ready && this.visible && !this.paused; }
    accrue() {
      const t = this.now();
      if (this.eligible) this.elapsed += Math.max(0, t - this.last);
      this.last = t;
    }
    set(flags) { this.accrue(); Object.assign(this, flags); this.last = this.now(); }
    tick() {
      this.accrue();
      if (this.eligible && !this.fired && this.elapsed >= this.duration) {
        this.fired = true; this.active = false; this.onExpire();
      }
      return this.elapsed;
    }
    cancel() { this.accrue(); this.active = false; }
  }
  root.HLEngine = { Session, ExposureClock };
  if (typeof module !== 'undefined') module.exports = root.HLEngine;
})(typeof window === 'undefined' ? globalThis : window);
