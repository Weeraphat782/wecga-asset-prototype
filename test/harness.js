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
  'js/core.js', 'js/seed.js', 'js/coverage.js', 'js/help.js',
  'js/views/assets.js', 'js/views/intake.js', 'js/views/tagging.js', 'js/views/scan.js',
  'js/views/handover.js', 'js/views/registration.js', 'js/views/movement.js', 'js/count-scan.js',
  'js/views/counts.js', 'js/views/mycount.js', 'js/views/reconcile.js', 'js/views/writeoff.js', 'js/views/dashboard.js',
  'js/views/reports.js', 'js/views/admin.js', 'js/views/audit.js', 'js/views/coverage.js', 'js/views/help.js',
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

// ---- 1c. PDF gap closures ----
console.log('\nPDF gap assertions:');
const sapKeys = App.SAP_FIELDS.map(f => f.key);
if (!sapKeys.includes('po')) fail('SAP_FIELDS missing po');
if (!sapKeys.includes('locationBasis')) fail('SAP_FIELDS missing locationBasis');
else console.log('  SAP_FIELDS has po + locationBasis.');

const a = App.asset('A-001');
if (!a) fail('seed asset A-001 missing');
else if (!App.recordCount) fail('App.recordCount not exported');
else {
  const nBefore = App.store.tickets.length;
  const spawned = App.recordCount(a, 'moved', { note: 'Returned to store', dest: 'Store', evidence: 'photo' });
  const ret = spawned && spawned.type === 'Return' && spawned.confirmDept === 'Store' && spawned.evidenceKind === 'photo';
  if (!ret) fail('moved+evidence should spawn Return ticket with confirmDept Store');
  else console.log('  CO6 moved+evidence -> Return ticket ' + spawned.id + '.');
}

// ---- 1d. wizard routes (/new before /:id) + draft persistence ----
console.log('\nWizard route order:');
App._views.filter(v => v.route.endsWith('/new')).forEach(v => {
  const base = v.route.slice(0, -4);
  const iNew = App._views.indexOf(v);
  const iId = App._views.findIndex(x => x.route === base + '/:id');
  if (iId !== -1 && iNew > iId) fail(v.route + ' must be registered before ' + base + '/:id');
  else if (iId !== -1) console.log('  ok   ' + v.route + ' before ' + base + '/:id');
});

console.log('\nRegistration wizard draft:');
if (App._regWizard) {
  App._regWizard.draft.desc1 = 'WizardDraftProbe';
  App._regWizard.step = 1;
  App._regWizard.mode = 'single';
  const wizView = App._views.find(v => v.route === '#/registration/new');
  if (!wizView) fail('registration wizard view missing');
  else {
    const wizHtml = wizView.config.render({ params: {}, query: {} });
    if (!wizHtml.includes('WizardDraftProbe')) fail('registration wizard step 2 should render the captured draft value');
    else console.log('  draft persists across registration wizard steps.');
  }
  App._regWizard.step = 0;
  App._regWizard.draft = {};
} else fail('App._regWizard not exported');

const HQ_IT = { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: '9F', unit: '9F-IT' };

console.log('\nTagging wizard draft:');
if (App.ticketAssetIds) {
  const legacy = App.ticketAssetIds(App.ticket('TK-0001'));
  if (!legacy.length || legacy[0] !== 'A-006') fail('ticketAssetIds back-compat for TK-0001');
  else console.log('  ticketAssetIds back-compat ok.');
} else fail('App.ticketAssetIds not exported');

if (App._tagWizard) {
  App._tagWizard.loc = Object.assign({}, HQ_IT);
  App._tagWizard.assetIds = ['A-006', 'A-019'];
  App._tagWizard.step = 3;
  App._tagWizard.qrDone = true;
  const tagView = App._views.find(v => v.route === '#/tagging/new');
  if (!tagView) fail('#/tagging/new not registered');
  else {
    const codes = ['A-006', 'A-019'].map(id => { const a = App.asset(id); return a ? App.assetCode(a) : id; });
    const tagHtml = tagView.config.render({ params: {}, query: {} });
    if (!codes.every(c => tagHtml.includes(c))) fail('tagging wizard review should show all selected asset codes');
    else console.log('  multi-asset draft persists across tagging wizard steps.');
  }
  App._tagWizard.step = 0;
  App._tagWizard.loc = App.emptyLoc();
  App._tagWizard.assetIds = [];
  App._tagWizard.qrDone = false;
} else fail('App._tagWizard not exported');

console.log('\nstartTagging entry:');
if (App.startTagging) {
  const savedHash = window.location.hash;
  App.startTagging('A-006');
  if (window.location.hash !== '#/tagging/TK-0001') fail('startTagging(A-006) should open existing ticket TK-0001');
  else console.log('  open ticket ok (A-006 -> TK-0001).');
  window.location.hash = savedHash;
  App.startTagging('A-026');
  if (window.location.hash !== '#/tagging/new') fail('startTagging(A-026) should open wizard');
  else if (!App._tagWizard.assetIds.includes('A-026')) fail('startTagging should preselect A-026');
  else if (!App.locMatch(App.asset('A-026'), App._tagWizard.loc)) fail('startTagging should preselect asset location');
  else console.log('  wizard preselect ok (A-026).');
  const tagDetail = App._views.find(v => v.route === '#/tagging/:id');
  if (!tagDetail) fail('#/tagging/:id not registered');
  else {
    const detailHtml = tagDetail.config.render({ params: { id: 'TK-0001' }, query: {} });
    if (!detailHtml.includes('Print QR code') || !detailHtml.includes('Scan &amp; record')) fail('tagging detail should show Print QR near Scan & record');
    else console.log('  tagging detail Print QR button ok.');
  }
  window.location.hash = savedHash;
  App._tagWizard.step = 0;
  App._tagWizard.loc = App.emptyLoc();
  App._tagWizard.assetIds = [];
} else fail('App.startTagging not exported');

console.log('\nProcurement appointment -> tagging:');
if (!App.createTaggingFromAppointment) fail('App.createTaggingFromAppointment not exported');
else {
  const savedHash = window.location.hash;
  const n0 = App.store.tickets.length;
  App.createTaggingFromAppointment({
    po: 'PO-4500091190', expectedDate: '2026-02-15', window: 'Morning (09:00-12:00)', notes: 'dock 3',
    poRecord: { po: 'PO-4500091190', item: 'Firewall Fortinet FG-100F', company: 'AIS' },
  });
  const t = App.store.tickets[0];
  if (App.store.tickets.length !== n0 + 1) fail('appointment should create one Tagging ticket');
  else if (t.type !== 'Tagging' || t.po !== 'PO-4500091190') fail('appointment ticket should be Tagging with po ref');
  else if (window.location.hash !== '#/tagging/' + t.id) fail('appointment should navigate to new tagging ticket');
  else {
    const tagList = App._views.find(v => v.route === '#/tagging');
    const listHtml = tagList.config.render({ params: {}, query: {} });
    if (!listHtml.includes('PO no.')) fail('tagging list should show PO no. column');
    else if (!listHtml.includes('PO-4500091190')) fail('tagging list should show PO from appointment ticket');
    else console.log('  appointment -> tagging ticket ok (' + t.id + ').');
  }
  window.location.hash = savedHash;
}

console.log('\nProcurement mock PO + assets:');
{
  const pos = App.store.purchaseOrders || [];
  const withAssets = pos.filter(p => (p.createdAssets || []).length || p.createdAsset);
  if (withAssets.length < 4) fail('expected at least 4 PO rows with linked assets');
  const batch = pos.find(p => p.po === 'PO-4500091255');
  if (!batch || batch.createdAssets.length !== 5) fail('PO-4500091255 should link 5 demo assets');
  else if (!App.asset('A-078') || App.asset('A-078').po !== 'PO-4500091190') fail('A-078 should exist with PO ref');
  else {
    const intakeView = App._views.find(v => v.route === '#/intake');
    const html = intakeView.config.render({ params: {}, query: {} });
    if (!html.includes('Asset(s)') || !html.includes('715000020331')) fail('intake PR/PO table should show linked assets');
    else console.log('  mock PO + asset links ok (' + withAssets.length + ' POs with assets).');
  }
  const grPo = (App.store.purchaseOrders || []).find(p => p.po === 'PO-4500091190');
  if (!grPo) fail('demo PO PO-4500091190 missing');
  else {
    grPo.grPosted = true;
    const intakeView = App._views.find(v => v.route === '#/intake');
    const html = intakeView.config.render({ params: {}, query: {} });
    if (html.includes('data-act="gr" data-po="PO-4500091190"')) fail('posted PO should not show Post GR button');
    else if (!html.includes('GR posted')) fail('posted PO should show GR posted chip');
    else console.log('  Post GR -> posted state ok.');
    grPo.grPosted = false;
    delete grPo.grPostedAt;
  }
}

if (!App.printAssetQr) fail('App.printAssetQr not exported');
else console.log('  printAssetQr helper ok.');

console.log('\nHandover wizard draft:');
if (App._handoverWizard) {
  App._handoverWizard.assetIds = ['A-001', 'A-015'];
  App._handoverWizard.step = 2;
  App._handoverWizard.mode = 'list';
  App._handoverWizard.channel = 'email';
  const hoView = App._views.find(v => v.route === '#/handover/new');
  if (!hoView) fail('#/handover/new not registered');
  else {
    const codes = ['A-001', 'A-015'].map(id => { const a = App.asset(id); return a ? App.assetCode(a) : id; });
    const hoHtml = hoView.config.render({ params: {}, query: {} });
    if (!codes.every(c => hoHtml.includes(c))) fail('handover wizard review should show all selected asset codes');
    else console.log('  multi-asset draft persists across handover wizard steps.');
  }
  App._handoverWizard.step = 0;
  App._handoverWizard.loc = App.emptyLoc();
  App._handoverWizard.assetIds = [];
  App._handoverWizard.mode = 'owner';
  App._handoverWizard.channel = 'email';
  App._handoverWizard.taggingTicketId = null;
} else fail('App._handoverWizard not exported');

console.log('\nTagging -> handover link:');
if (!App.startHandoverFromTagging || !App.handoverForTagging) fail('startHandoverFromTagging / handoverForTagging not exported');
else {
  const tagList = App._views.find(v => v.route === '#/tagging');
  const listHtml = tagList.config.render({ params: {}, query: {} });
  if (!listHtml.includes('data-act="handover"') || !listHtml.includes('TK-0022')) fail('tagging list should show Handover action for completed TK-0022');
  else console.log('  tagging list Handover action ok.');
  const savedHash = window.location.hash;
  App.startHandoverFromTagging('TK-0022');
  if (window.location.hash !== '#/handover/new') fail('startHandoverFromTagging should open handover wizard');
  else if (App._handoverWizard.step !== 1 || !App._handoverWizard.taggingTicketId) fail('should skip to send options with taggingTicketId');
  else if (!App._handoverWizard.assetIds.includes('A-097')) fail('should preselect tagging assets');
  App._handoverWizard.step = 0;
  App._handoverWizard.taggingTicketId = null;
  App._handoverWizard.assetIds = [];
  window.location.hash = savedHash;
  const hoView = App._views.find(v => v.route === '#/handover/new');
  App._handoverWizard.taggingTicketId = 'TK-0022';
  App._handoverWizard.assetIds = ['A-097', 'A-098'];
  App._handoverWizard.step = 2;
  const hoHtml = hoView.config.render({ params: {}, query: {} });
  if (!hoHtml.includes('TK-0022')) fail('handover wizard should reference source tagging TK');
  else console.log('  tagging -> handover prefill ok.');
  App._handoverWizard.taggingTicketId = null;
  App._handoverWizard.assetIds = [];
  App._handoverWizard.step = 0;
}

console.log('\nHandover demo assets:');
{
  const staging = App.store.assets.filter(a => a.companyCode === 'AIS' && a.unit === 'G-Loading' && a.tagStatus === 'Tagged');
  const orgStaging = staging.filter(a => a.owner && a.owner.type === 'org');
  const indStaging = staging.filter(a => a.owner && a.owner.type === 'person');
  const hoTickets = App.store.tickets.filter(t => t.type === 'Handover' && t.company === 'AIS');
  if (staging.length < 6) fail('expected 6+ tagged assets at G-Loading for handover demo');
  else if (orgStaging.length < 3 || indStaging.length < 2) fail('G-Loading needs both org and individual tagged assets');
  else if (hoTickets.length < 3) fail('expected 3+ AIS handover tickets for demo');
  else {
    const ga = App.store.assets.find(a => a.id === 'A-103');
    const cloud = App.store.assets.find(a => a.id === 'A-104');
    const it = App.store.assets.find(a => a.id === 'A-105');
    const field = App.store.assets.find(a => a.id === 'A-106');
    if (!ga || ga.unit !== '5F-MR1' || ga.owner.type !== 'org') fail('A-103 should be General Admin org at 5F-MR1');
    else if (!cloud || cloud.unit !== 'BF001' || cloud.owner.name !== 'Cloud Implementation') fail('A-104 should be Cloud org at BF001');
    else if (!it || it.unit !== '9F-IT' || it.owner.name !== 'IT Infrastructure') fail('A-105 should be IT Infrastructure org at 9F-IT');
    else if (!field || field.unit !== 'Yard' || field.owner.name !== 'Field Operations') fail('A-106 should be Field Operations org at CNX Yard');
    else console.log('  G-Loading: ' + staging.length + ' assets (' + orgStaging.length + ' org, ' + indStaging.length + ' individual), ' + hoTickets.length + ' tickets.');
  }
}

console.log('\nHandover accept:');
if (App.acceptHandover && App.handoverAcceptedIds) {
  const ht = App.addTicket({
    type: 'Handover', flow: 'handover', title: 'Harness multi-accept',
    assetIds: ['A-001', 'A-006', 'A-016'], assetId: 'A-001',
    channel: 'email', sendMode: 'owner', acceptedIds: [],
    status: 'Awaiting acceptance', stepIndex: 1,
  });
  App.acceptHandover(ht, ['A-001']);
  if (ht.status !== 'In progress' || App.handoverAcceptedIds(ht).length !== 1) fail('acceptHandover partial should leave In progress with 1 accepted');
  else console.log('  partial accept ok.');
  App.acceptHandover(ht, ['A-006', 'A-016']);
  if (ht.status !== 'Completed' || ht.stepIndex !== 2 || App.handoverAcceptedIds(ht).length !== 3) fail('acceptHandover full should Complete with stepIndex 2');
  else console.log('  full accept ok.');
  const hoDetail = App._views.find(v => v.route === '#/handover/:id');
  const multi = App.addTicket({
    type: 'Handover', flow: 'handover', title: 'Harness 2 owners',
    assetIds: ['A-001', 'A-006'], assetId: 'A-001',
    channel: 'email', sendMode: 'owner', acceptedIds: [],
    status: 'Awaiting acceptance', stepIndex: 1,
  });
  const detailHtml = hoDetail.config.render({ params: { id: multi.id }, query: {} });
  if (!detailHtml.includes('headof.cloud@wecga.co.th') || !detailHtml.includes('wanida.e@wecga.co.th')) fail('handover detail should render cards for each owner email');
  else console.log('  multi-owner detail cards ok.');
} else fail('App.acceptHandover not exported');

console.log('\nHandover owner filter:');
if (App.handoverIsMine) {
  const savedRole = App.session.role;
  const savedUser = App.session.userId;
  App.session.role = 'employee';
  App.session.userId = 'U-004';
  if (!App.handoverIsMine({ kind: 'Individual', email: 'wanida.e@wecga.co.th', label: 'Wanida Employee' })) fail('handoverIsMine should match individual email');
  else if (App.handoverIsMine({ kind: 'Individual', email: 'kittipong.it@wecga.co.th', label: 'Kittipong IT' })) fail('handoverIsMine should not match other individual');
  else if (!App.handoverIsMine({ kind: 'Organization (Head-of)', label: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' })) fail('handoverIsMine should match org by user.org');
  else console.log('  handoverIsMine ok.');
  const hoDetail = App._views.find(v => v.route === '#/handover/:id');
  const empTicket = App.addTicket({
    type: 'Handover', flow: 'handover', title: 'Harness employee view',
    assetIds: ['A-006', 'A-002'], assetId: 'A-006',
    channel: 'email', sendMode: 'owner', acceptedIds: [],
    status: 'Awaiting acceptance', stepIndex: 1,
  });
  const empHtml = hoDetail.config.render({ params: { id: empTicket.id }, query: {} });
  if (!empHtml.includes('Awaiting owner')) fail('employee should see Awaiting owner on other recipient card');
  else if (!empHtml.includes('data-accept')) fail('employee should see Accept on own items');
  else console.log('  employee detail filter/accept ok.');
  App.session.role = 'asset_hq';
  App.session.userId = 'U-001';
  const hqHtml = hoDetail.config.render({ params: { id: empTicket.id }, query: {} });
  if (hqHtml.includes('Awaiting owner')) fail('asset_hq should not see Awaiting owner (can accept on behalf)');
  else console.log('  asset_hq can accept all groups ok.');
  App.session.role = savedRole;
  App.session.userId = savedUser;
} else fail('App.handoverIsMine not exported');

console.log('\nMovement wizard draft:');
if (App._movementWizard) {
  App._movementWizard.assetIds = ['A-023', 'A-024'];
  App._movementWizard.step = 2;
  App._movementWizard.type = 'Transfer';
  App._movementWizard.toOwner = 'Cloud Implementation';
  const mvView = App._views.find(v => v.route === '#/movement/new');
  if (!mvView) fail('#/movement/new not registered');
  else {
    const codes = ['A-023', 'A-024'].map(id => { const a = App.asset(id); return a ? App.assetCode(a) : id; });
    const mvHtml = mvView.config.render({ params: {}, query: {} });
    if (!codes.every(c => mvHtml.includes(c))) fail('movement wizard review should show all selected asset codes');
    else console.log('  multi-asset draft persists across movement wizard steps.');
  }
  App._movementWizard.step = 0;
  App._movementWizard.loc = App.emptyLoc();
  App._movementWizard.assetIds = [];
  App._movementWizard.q = '';
  App._movementWizard.type = 'Transfer';
  App._movementWizard.toOwner = '';
} else fail('App._movementWizard not exported');

console.log('\nMovement scan session:');
{
  const mvNew = App._views.find(v => v.route === '#/movement/new');
  const mvList = App._views.find(v => v.route === '#/movement');
  if (!mvNew) fail('#/movement/new for scan test');
  else {
    App._movementWizard.step = 0;
    App._movementWizard.assetIds = ['A-023', 'A-024'];
    const scanHtml = mvNew.config.render({ params: {}, query: { scan: '1' } });
    if (!scanHtml.includes('movementScanSession') || !scanHtml.includes('Simulate scan')) fail('movement scan session UI missing');
    else if (!scanHtml.includes('2 selected')) fail('movement scan counter should show selected count');
    else console.log('  scan session UI ok.');
    App._movementWizard.assetIds = [];
  }
  if (mvList) {
    const listHtml = mvList.config.render({ params: {}, query: {} });
    if (!listHtml.includes('Scan assets') || !listHtml.includes('>Movement<')) fail('movement list should show Scan assets and Movement title');
    else console.log('  movement list scan button ok.');
  }
}

console.log('\nAsset picker search:');
{
  const a23 = App.asset('A-023');
  const a24 = App.asset('A-024');
  if (!App.assetMatches) fail('App.assetMatches not exported');
  else if (!App.assetMatches(a23, App.assetCode(a23))) fail('assetMatches should match asset code');
  else if (!App.assetMatches(a23, 'DLLXPS15')) fail('assetMatches should match serial');
  else if (App.assetMatches(a23, 'zzz-no-match-xyz')) fail('assetMatches should not match nonsense');
  else console.log('  assetMatches ok.');
  if (App._movementWizard) {
    App._movementWizard.step = 0;
    App._movementWizard.loc = Object.assign({}, HQ_IT);
    App._movementWizard.assetIds = [];
    App._movementWizard.q = App.assetCode(a23);
    const mvView = App._views.find(v => v.route === '#/movement/new');
    if (!mvView) fail('#/movement/new not registered for search test');
    else {
      const html = mvView.config.render({ params: {}, query: {} });
      const code23 = App.assetCode(a23);
      const code24 = App.assetCode(a24);
      if (!html.includes(code23)) fail('movement picker search should show A-023');
      else if (html.includes(code24)) fail('movement picker search should hide A-024');
      else if (!html.includes('Select all (1)')) fail('Select all count should reflect search filter (expected 1)');
      else console.log('  movement picker search + Select all count ok.');
    }
    App._movementWizard.q = '';
  }
}

console.log('\nMovement accept:');
if (App.acceptMovement && App.movementAcceptedIds) {
  const mt = App.addTicket({
    type: 'Transfer', flow: 'movement', title: 'Harness multi-accept',
    assetIds: ['A-023', 'A-024', 'A-025'], assetId: 'A-023',
    fromOwner: 'Wanida Employee', toOwner: 'Kittipong IT',
    acceptedIds: [], status: 'In progress', stepIndex: 4,
  });
  App.acceptMovement(mt, ['A-023']);
  if (mt.stepIndex !== 4 || App.movementAcceptedIds(mt).length !== 1) fail('acceptMovement partial should stay at step 4 with 1 accepted');
  else console.log('  partial accept ok.');
  App.acceptMovement(mt, ['A-024', 'A-025']);
  if (mt.stepIndex !== 5 || App.movementAcceptedIds(mt).length !== 3) fail('acceptMovement full should advance to step 5 with 3 accepted');
  else console.log('  full accept ok.');
} else fail('App.acceptMovement not exported');

console.log('\nMovement owner filter:');
if (App.movementIsMine) {
  const savedRole = App.session.role;
  const savedUser = App.session.userId;
  App.session.role = 'it';
  App.session.userId = 'U-005';
  const recvTicket = { type: 'Transfer', fromOwner: 'Wanida Employee', toOwner: 'Kittipong IT' };
  const sendTicket = { type: 'Transfer', fromOwner: 'Kittipong IT', toOwner: 'Cloud Implementation' };
  if (!App.movementIsMine(recvTicket)) fail('movementIsMine should match receiver by name');
  else if (!App.movementIsMine(sendTicket)) fail('movementIsMine should match sender by name');
  else if (App.movementIsMine({ type: 'Transfer', fromOwner: 'General Admin', toOwner: 'Wanida Employee' })) fail('movementIsMine should not match unrelated ticket');
  else console.log('  movementIsMine individual ok.');
  App.session.role = 'employee';
  App.session.userId = 'U-004';
  if (!App.movementIsMine({ type: 'Transfer', fromOwner: 'Kittipong IT', toOwner: 'Cloud Implementation' })) fail('movementIsMine should match org receiver');
  else console.log('  movementIsMine org ok.');
  App.session.role = savedRole;
  App.session.userId = savedUser;
} else fail('App.movementIsMine not exported');

console.log('\nMovement GA verify:');
if (App.verifyMovement && App.movementVerifiedIds) {
  const vt = App.addTicket({
    type: 'Transfer', flow: 'movement', title: 'Harness GA verify',
    assetIds: ['A-023', 'A-024'], assetId: 'A-023',
    fromOwner: 'Wanida Employee', toOwner: 'Kittipong IT',
    verifiedIds: [], acceptedIds: ['A-023', 'A-024'],
    area: 'HQ Bangkok', status: 'In progress', stepIndex: 6,
  });
  App.verifyMovement(vt, ['A-023']);
  if (vt.stepIndex !== 6 || App.movementVerifiedIds(vt).length !== 1) fail('verifyMovement partial should stay at step 6 with 1 verified');
  else console.log('  partial verify ok.');
  App.verifyMovement(vt, ['A-024']);
  if (vt.stepIndex !== 7 || App.movementVerifiedIds(vt).length !== 2) fail('verifyMovement full should advance to step 7');
  else console.log('  full verify ok.');
  const early = App.addTicket({
    type: 'Transfer', flow: 'movement', title: 'Harness verify guard',
    assetIds: ['A-025'], assetId: 'A-025', verifiedIds: [],
    area: 'HQ Bangkok', status: 'In progress', stepIndex: 4,
  });
  App.verifyMovement(early, ['A-025']);
  if ((early.verifiedIds || []).length) fail('verifyMovement should no-op outside step 6');
  else console.log('  step guard ok.');
  const mvDetail = App._views.find(v => v.route === '#/movement/:id');
  const savedRole = App.session.role;
  const savedUser = App.session.userId;
  App.session.role = 'employee';
  App.session.userId = 'U-004';
  const empTicket = App.addTicket({
    type: 'Transfer', flow: 'movement', title: 'Harness employee verify view',
    assetIds: ['A-001'], assetId: 'A-001',
    fromOwner: 'Wanida Employee', toOwner: 'Kittipong IT',
    verifiedIds: [], area: 'HQ Bangkok', status: 'In progress', stepIndex: 6,
  });
  const empHtml = mvDetail.config.render({ params: { id: empTicket.id }, query: {} });
  if (!empHtml.includes('Awaiting GA verify')) fail('employee should see Awaiting GA verify');
  else console.log('  employee verify view ok.');
  App.session.role = 'ga';
  App.session.userId = 'U-002';
  const gaTicket = App.addTicket({
    type: 'Transfer', flow: 'movement', title: 'Harness GA buttons',
    assetIds: ['A-026'], assetId: 'A-026',
    fromOwner: 'Wanida Employee', toOwner: 'Kittipong IT',
    verifiedIds: [], area: 'HQ Bangkok', status: 'In progress', stepIndex: 6,
  });
  const gaHtml = mvDetail.config.render({ params: { id: gaTicket.id }, query: {} });
  if (!gaHtml.includes('Scan &amp; verify') && !gaHtml.includes('Scan & verify')) fail('ga should see Scan & verify button');
  else console.log('  ga verify buttons ok.');
  App.session.role = savedRole;
  App.session.userId = savedUser;
} else fail('App.verifyMovement not exported');

console.log('\nWrite-off wizard:');
if (App._writeoffWizard && App._writeoffCreate && App.startWriteoff) {
  const woView = App._views.find(v => v.route === '#/writeoff/new');
  if (!woView) fail('#/writeoff/new not registered');
  else {
    App._writeoffWizard.assetIds = ['A-001', 'A-006'];
    App._writeoffWizard.step = 2;
    App._writeoffWizard.track = 'Lost';
    App._writeoffWizard.lossType = 'theft';
    const woHtml = woView.config.render({ params: {}, query: {} });
    if (!woHtml.includes('Theft')) fail('writeoff wizard review should show track details');
    else console.log('  wizard draft ok.');
  }
  const woBefore = App.store.tickets.filter(t => (t.type || '').startsWith('Write-off')).length;
  App._writeoffWizard.assetIds = ['A-015', 'A-016', 'A-017'];
  App._writeoffWizard.track = 'Sale';
  App._writeoffWizard.cause = 'Harness damage';
  App._writeoffWizard.insuranceClaim = true;
  App._writeoffCreate();
  const created = App.store.tickets.filter(t => (t.type || '').startsWith('Write-off')).slice(0, App.store.tickets.filter(t => (t.type || '').startsWith('Write-off')).length - woBefore);
  if (created.length !== 3) fail('writeoff wizard should create 3 tickets for 3 assets (got ' + created.length + ')');
  else if (!created.every(t => t.type === 'Write-off Sale' && t.insuranceClaim && t.verify && t.verify.cause === 'Harness damage')) fail('writeoff Sale track fields missing on created tickets');
  else console.log('  3-asset Sale create ok.');
  App.startWriteoff('A-009');
  if (window.location.hash !== '#/writeoff/new') fail('startWriteoff should navigate to wizard');
  else if (!App._writeoffWizard.assetIds.includes('A-009')) fail('startWriteoff should preset asset A-009');
  else console.log('  startWriteoff preset ok.');
  App._writeoffWizard.step = 0;
  App._writeoffWizard.assetIds = [];
} else fail('App._writeoffWizard / _writeoffCreate not exported');

console.log('\nWrite-off scan session:');
{
  const woNew = App._views.find(v => v.route === '#/writeoff/new');
  const woList = App._views.find(v => v.route === '#/writeoff');
  if (!woNew) fail('#/writeoff/new for scan test');
  else {
    App._writeoffWizard.step = 0;
    App._writeoffWizard.assetIds = ['A-015', 'A-016'];
    const scanHtml = woNew.config.render({ params: {}, query: { scan: '1' } });
    if (!scanHtml.includes('writeoffScanSession') || !scanHtml.includes('Simulate scan')) fail('writeoff scan session UI missing');
    else if (!scanHtml.includes('2 selected')) fail('writeoff scan counter should show selected count');
    else console.log('  scan session UI ok.');
    App._writeoffWizard.assetIds = [];
  }
  if (woList) {
    const listHtml = woList.config.render({ params: {}, query: {} });
    if (!listHtml.includes('Scan assets')) fail('writeoff list should show Scan assets button');
    else console.log('  writeoff list scan button ok.');
  }
  App._writeoffWizard.assetIds = ['A-019'];
  App._writeoffWizard.track = 'Dispose';
  App._writeoffWizard.disposeReason = 'Harness obsolete';
  App._writeoffWizard.disposeMethod = 'E-waste recycler';
  const woBeforeDisp = App.store.tickets.filter(t => t.type === 'Write-off Dispose').length;
  App._writeoffCreate();
  const dispCreated = App.store.tickets.filter(t => t.type === 'Write-off Dispose').length - woBeforeDisp;
  if (dispCreated !== 1) fail('Dispose track should create 1 ticket (got ' + dispCreated + ')');
  else {
    const dt = App.store.tickets.find(t => t.type === 'Write-off Dispose' && t.disposeReason === 'Harness obsolete');
    if (!dt || dt.flow !== 'writeoffDispose' || dt.disposeMethod !== 'E-waste recycler') fail('Dispose track fields missing on created ticket');
    else console.log('  Dispose track create ok.');
  }
  App._writeoffWizard.step = 0;
  App._writeoffWizard.assetIds = [];
}

console.log('\nCount plan wizard:');
if (App._countsWizard && App._countsCreate && App.computeAssigned && App.locFilterMatch && App.countPackages) {
  const cpView = App._views.find(v => v.route === '#/counts/new');
  if (!cpView) fail('#/counts/new not registered');
  else {
    const HQ_FILTER = { companies: ['AIS'], projects: ['HQ Bangkok'], buildings: [], floors: [], units: [] };
    App._countsWizard.name = 'Harness Location';
    App._countsWizard.type = 'location';
    App._countsWizard.locFilter = Object.assign({}, HQ_FILTER);
    App._countsWizard.assignLevel = 'building';
    App._countsWizard.start = '2026-01-01';
    App._countsWizard.end = '2026-12-31';
    App._countsWizard.step = 3;
    const preview = App.computeAssigned('location', HQ_FILTER, []);
    const previewAssets = preview.map(App.asset).filter(Boolean);
    const pkgs = App.countPackages(previewAssets, 'building');
    if (!preview.length) fail('computeAssigned locFilter should match assets');
    else if (!App.locFilterMatch(previewAssets[0], HQ_FILTER)) fail('locFilterMatch should accept scoped asset');
    else if (pkgs.length < 2) fail('countPackages building should split HQ Bangkok into multiple packages');
    else console.log('  locFilter + countPackages ok (' + preview.length + ' assets, ' + pkgs.length + ' packages).');
    const cpHtml = cpView.config.render({ params: {}, query: {} });
    if (!cpHtml.includes(String(preview.length))) fail('counts wizard review should show preview asset count');
    else console.log('  preview count ok (' + preview.length + ' assets).');
    const scopedClass = App.computeAssigned('location', Object.assign({}, HQ_FILTER, { assetClasses: ['7200'] }), []);
    if (!scopedClass.length || scopedClass.length >= preview.length) fail('asset category filter should narrow location scope');
    else console.log('  asset category filter ok (' + scopedClass.length + ' of ' + preview.length + ' assets).');
    App._countsWizard.step = 1;
    App._countsWizard.assetClasses = ['7200'];
    const scopeHtml = cpView.config.render({ params: {}, query: {} });
    if (!scopeHtml.includes('Asset category') || !scopeHtml.includes('7200')) fail('counts wizard scope should show asset category filter');
    else console.log('  asset category UI ok.');
    App._countsWizard.assetClasses = [];
    App._countsWizard.step = 3;
    const personal = App.computeAssigned('personal', null, ['Wanida Employee']);
    if (!personal.length || !personal.every(id => {
      const a = App.asset(id);
      return a && a.owner && a.owner.name === 'Wanida Employee';
    })) fail('computeAssigned personal should filter by holder');
    else console.log('  personal scope ok (' + personal.length + ' assets).');
    const nPlans = App.store.countPlans.length;
    App._countsCreate();
    const plan = App.store.countPlans[App.store.countPlans.length - 1];
    if (App.store.countPlans.length !== nPlans + 1) fail('counts wizard should create one plan');
    else if (plan.assignedAssets.length !== preview.length) fail('plan assignedAssets should match preview');
    else if (!plan.workPackages || !plan.workPackages.length) fail('plan should persist workPackages');
    else if (plan.assignLevel !== 'building') fail('plan should persist assignLevel');
    else console.log('  plan create matches preview ok (' + plan.workPackages.length + ' packages).');
  }
  App._countsWizard.step = 0;
  App._countsWizard.name = '';
  App._countsWizard.locFilter = App.emptyLocFilter();
  App._countsWizard.assetClasses = [];
} else fail('App._countsWizard / computeAssigned / locFilter not exported');

console.log('\nTable pagination:');
const ui = App.ui;
const mkRows = (n) => Array.from({ length: n }, (_, i) => ({ id: 'R' + i, name: 'Row ' + i }));
const big = ui.table({ columns: [{ key: 'name', label: 'Name' }], rows: mkRows(12) });
const small = ui.table({ columns: [{ key: 'name', label: 'Name' }], rows: mkRows(3) });
const hideCount = (big.match(/pg-hide/g) || []).length;
if (!big.includes('data-pgnext')) fail('ui.table 12 rows should include pager next button');
else if (hideCount !== 2) fail('ui.table 12 rows should hide 2 rows on page 1 (got ' + hideCount + ')');
else if (small.includes('data-pgnext') || small.includes('pg-hide')) fail('ui.table 3 rows should not paginate');
else console.log('  pager on 12 rows, no pager on 3 rows.');

// ---- 1b. nav renders every route link ----
console.log('\nNav render check:');
App.renderNav();
const navHtml = byId.nav._html || '';
for (const g of App.NAV) {
  for (const item of g.items) {
    if (!navHtml.includes(`data-nav="${item.hash}"`)) fail('nav missing link ' + item.hash);
  }
}
for (const item of App.NAV_AFTER || []) {
  if (!navHtml.includes(`data-nav="${item.hash}"`)) fail('nav missing after link ' + item.hash);
}
if (!navHtml.includes('nav-group open')) fail('nav should open group containing current route');
else console.log('  all nav links present, active group open.');
if (navHtml.includes('My Count Tasks')) fail('nav should not include My Count Tasks link');
else console.log('  my-count removed from nav ok.');

console.log('\nCount list + team assign:');
if (App.flattenCountRows && App.canAccessCount) {
  const countsView = App._views.find(v => v.route === '#/counts');
  const mcView = App._views.find(v => v.route === '#/my-count');
  const savedRole = App.session.role;
  const savedUser = App.session.userId;
  App.session.role = 'it';
  App.session.userId = 'U-005';
  const countsHtml = countsView.config.render({ params: {}, query: {} });
  if (!countsHtml.includes('HQ Bangkok · HQ Tower · 9F · 9F-IT')) fail('counts list should show package location label');
  else if (!countsHtml.includes('My tasks')) fail('counts list should show My tasks for IT-assigned package');
  else console.log('  flattened location rows ok.');
  const accessOk = App.canAccessCount({ query: { plan: 'CP-2026', pkg: 'PKG-1' } });
  if (!accessOk.ok) fail('IT should access CP-2026 PKG-1');
  else {
    const mcHtml = mcView.config.render({ params: {}, query: { plan: 'CP-2026', pkg: 'PKG-1', scan: '1' } });
    if (mcHtml.includes('Record count')) fail('my-count should not use per-row Record count');
    else if (!mcHtml.includes('Scan QR')) fail('my-count should have Scan QR');
    else if (!mcHtml.includes('fab-scan')) fail('my-count should have FAB scan');
    else if (!mcHtml.includes('Found OK (CO1)')) fail('my-count should show progress panel');
    else if (!mcHtml.includes('For demo')) fail('my-count scan session should show For demo label');
    else if (!mcHtml.includes('Simulate scan (wrong location)')) fail('my-count missing wrong-location demo');
    else if (!mcHtml.includes('Simulate scan (scanned already)')) fail('my-count missing already-scanned demo');
    else if (!mcHtml.includes('Count outcome')) fail('my-count should show Count outcome column');
    else console.log('  my-count scan UI ok.');
  }
  App.session.role = 'employee';
  App.session.userId = 'U-004';
  const denied = App.canAccessCount({ query: { plan: 'CP-2026', pkg: 'PKG-1' } });
  if (denied.ok) fail('employee should not access IT-assigned package');
  else console.log('  teamRole gate ok.');
  App.session.role = savedRole;
  App.session.userId = savedUser;
} else fail('App.flattenCountRows / canAccessCount not exported');

console.log('\nCount scan logic:');
if (App.forcedCountOutcome && App.unitsMatchForCount) {
  const ok = App.forcedCountOutcome('9F-IT', '9F-IT', 'yes');
  if (!ok || ok.outcome !== 'found_ok' || ok.scanKind !== 'correct_location') fail('forcedCountOutcome yes+match -> CO1');
  const wrong = App.forcedCountOutcome('5F-A', '9F-IT', 'yes');
  if (!wrong || wrong.outcome !== 'found_wrong' || wrong.scanKind !== 'incorrect_location') fail('forcedCountOutcome yes+mismatch unit -> CO2');
  const mismatch = App.forcedCountOutcome('9F-IT', '9F-IT', 'no');
  if (!mismatch || mismatch.scanKind !== 'mismatch_tagging') fail('forcedCountOutcome no -> mismatch');
  else console.log('  forcedCountOutcome matrix ok.');
} else fail('App.forcedCountOutcome not exported');

if ((App.store.sites || []).length < 30) fail('sites mock should have >= 30 rows, got ' + (App.store.sites || []).length);
else console.log('  location sites mock: ' + App.store.sites.length + ' rows.');

if (App.assetsWrongLocationForCount) {
  const plan = App.byId(App.store.countPlans, 'CP-2026');
  const pkg = App.countPkgById(plan, 'PKG-1');
  const taskAssets = (pkg.assetIds || []).map(App.asset).filter(Boolean);
  const wrong = App.assetsWrongLocationForCount(pkg, taskAssets, 'AIS');
  if (!wrong.length) fail('assetsWrongLocationForCount should find demo assets for CP-2026');
  else console.log('  wrong-location demo pool: ' + wrong.length + ' assets.');
}

console.log('\nHelp Center:');
if (App.helpSearch) {
  const r = App.helpSearch('lost');
  if (!r.do.length || r.do[0].item.id !== 'task-lost') fail('helpSearch(lost) should rank task-lost first');
  else console.log('  helpSearch lost ok.');
  const rb = App.helpSearch('borrow');
  if (!rb.do.length || rb.do[0].item.id !== 'task-borrow') fail('helpSearch(borrow) should rank task-borrow first');
  else console.log('  helpSearch borrow ok.');
  if (App._writeoffWizard) {
    App.startWriteoff('A-009', { track: 'Lost' });
    if (App._writeoffWizard.track !== 'Lost') fail('startWriteoff opts.track should prefill Lost');
    else if (!App._writeoffWizard.assetIds.includes('A-009')) fail('startWriteoff should prefill asset');
    else console.log('  startWriteoff Lost track ok.');
    App._writeoffWizard.step = 0;
    App._writeoffWizard.assetIds = [];
  }
  const helpHtml = App._views.find(v => v.route === '#/help').config.render({ params: {}, query: {} });
  if (!helpHtml.includes('WeCGA Help Center') || !helpHtml.includes('help-search-pill')) fail('#/help should render Meta-style hero');
  else if (!helpHtml.includes('help-primary-grid') || !helpHtml.includes('Main asset activities')) fail('#/help should highlight SOW C3 primary activities');
  else if (!helpHtml.includes('Tag untagged assets') || !helpHtml.includes('Reconcile count results')) fail('#/help should show SOW primary cards');
  else if (!helpHtml.includes('Holder change') || !helpHtml.includes('Request asset')) fail('#/help should show holder change section');
  else console.log('  help landing render ok.');
  const articleView = App._views.find(v => v.route === '#/help/:slug');
  const articleHtml = articleView.config.render({ params: { slug: 'reconcile-variance' }, query: {} });
  if (!articleHtml.includes('Step-by-step') || !articleHtml.includes('Who can do this')) fail('help article should render steps and roles');
  else if (!articleHtml.includes('Try it yourself') || !articleHtml.includes('#/reconcile')) fail('reconcile article should link to reconcile screen');
  else console.log('  help article render ok.');
  const rt = App.helpSearch('tag');
  if (!rt.learn.length || rt.learn[0].item.slug !== 'tag-qr-print') fail('helpSearch(tag) should rank tag-qr-print first');
  else console.log('  helpSearch tag ok.');
} else fail('App.helpSearch not exported');

// ---- 2 + 3. render + mount every view ----
console.log('\nRendering every route:');
const sampleIds = ['A-001', 'A-006', 'A-009', 'A-024', 'TK-0001', 'TK-0005', 'TK-0009', 'TK-0011', 'TK-0002', 'TK-0003', 'CP-2026', 'CP-RO-01', 'tag-three-photos', 'reconcile-variance'];
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
