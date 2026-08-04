/* Headless smoke test for the WeCGA prototype.
   Stubs a minimal DOM, loads every script in index.html order, then:
     1. runs App.coverageSelfCheck() and asserts zero gaps
     2. calls render(ctx) for every registered route (incl. :id routes with
        sample params) and asserts it returns a string without throwing
     3. calls mount(root, ctx) with a stub root to catch obvious wiring errors
   Run:  node test/harness.js
   This is the ONE runnable check the prototype leaves behind (per ponytail rule). */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let failures = 0;
const fail = (m) => { failures++; console.error('  FAIL: ' + m); };

// ---- minimal DOM stub ----
function makeEl() {
  const el = {
    style: {}, dataset: {}, _html: '', textContent: '', value: '', href: '', checked: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, hasAttribute() { return false; },
    appendChild(c) { return c; }, removeChild() {}, remove() {}, insertBefore(c) { return c; },
    addEventListener() {}, removeEventListener() {}, click() {}, focus() {}, closest() { return null; },
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    getContext() { return { fillRect() {}, clearRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {} }; },
  };
  Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; } });
  Object.defineProperty(el, 'onclick', { set() {}, get() { return null; } });
  Object.defineProperty(el, 'onchange', { set() {}, get() { return null; } });
  Object.defineProperty(el, 'oninput', { set() {}, get() { return null; } });
  Object.defineProperty(el, 'onsubmit', { set() {}, get() { return null; } });
  return el;
}
const byId = {};
const document = {
  title: '',
  getElementById(id) { return byId[id] || (byId[id] = makeEl()); },
  createElement() { return makeEl(); },
  addEventListener() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
  body: makeEl(),
};
const window = {
  location: { hash: '#/dashboard' }, addEventListener() {}, scrollTo() {}, print() {},
  URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} },
};
const sandbox = {
  window, document, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  Blob: function () {}, URL: window.URL, location: window.location,
  Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Set, Map, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// ---- load scripts in index.html order ----
const scripts = [
  'js/core.js', 'js/seed.js', 'js/coverage.js',
  'js/views/assets.js', 'js/views/intake.js', 'js/views/tagging.js', 'js/views/scan.js',
  'js/views/handover.js', 'js/views/registration.js', 'js/views/movement.js', 'js/views/counts.js',
  'js/views/mycount.js', 'js/views/reconcile.js', 'js/views/writeoff.js', 'js/views/dashboard.js',
  'js/views/reports.js', 'js/views/admin.js', 'js/views/audit.js', 'js/views/coverage.js',
];

console.log('Loading scripts...');
for (const s of scripts) {
  const p = path.join(ROOT, s);
  if (!fs.existsSync(p)) { fail('missing file ' + s); continue; }
  try { vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: s }); }
  catch (e) { fail('load ' + s + ': ' + e.message); }
}
const App = window.App;
if (!App) { console.error('App not defined - aborting'); process.exit(1); }

// ---- 1. coverage self-check ----
console.log('\nCoverage self-check:');
const cov = App.coverageSelfCheck();
console.log(`  ${cov.covered}/${cov.total} requirements mapped to a live route.`);
if (cov.gaps.length) fail('coverage gaps: ' + cov.gaps.join(', '));
else console.log('  no gaps.');

// ---- 2 + 3. render + mount every view ----
console.log('\nRendering every route:');
const sampleIds = ['A-001', 'A-006', 'A-009', 'A-024', 'TK-0001', 'TK-0005', 'TK-0009', 'TK-0011', 'TK-0002', 'TK-0003', 'CP-2026', 'CP-RO-01'];
const registered = App._views.map(v => v.route).sort();
for (const route of registered) {
  const view = App._views.find(v => v.route === route);
  const hasParam = route.includes('/:');
  const paramName = hasParam ? route.split('/:')[1] : null;
  const candidates = hasParam ? sampleIds : [null];
  let ok = false, lastErr = null;
  for (const id of candidates) {
    const ctx = { params: paramName ? { [paramName]: id } : {}, query: {}, store: App.store, S: App.store, session: App.session };
    try {
      const html = view.config.render(ctx);
      if (typeof html !== 'string') { lastErr = 'render did not return a string'; continue; }
      const root = makeEl();
      root._html = html;
      if (view.config.mount) view.config.mount(root, ctx);
      ok = true; break;
    } catch (e) { lastErr = e.message; }
  }
  if (ok) console.log('  ok   ' + route);
  else fail('render ' + route + ' -> ' + lastErr);
}

// ---- summary ----
console.log('\n' + (failures ? `${failures} FAILURE(S)` : 'ALL CHECKS PASSED') + `  (${registered.length} routes)`);
process.exit(failures ? 1 : 0);
