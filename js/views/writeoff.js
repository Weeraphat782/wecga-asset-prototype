/* Disposal / Write-off  (#/writeoff  +  #/writeoff/:id)
   The three PDF write-off tracks, each with its own literal FLOW:
     SALE     - damaged / not needed => sale   (App.FLOWS.writeoffSale, p.7)
     DONATION - donate unused asset            (App.FLOWS.writeoffDonation, p.8)
     LOST     - loss + compensation            (App.FLOWS.writeoffLost, p.6, p.9)
     DISPOSE  - destroy / scrap (no sale)      (App.FLOWS.writeoffDispose, M7)
   Coverage IDs: M7, W5, L1, L2, L3, L4, L5, WS1..WS6, WD1..WD3, WL1, WL2.
   Reuses App.assetCode / assetTitle / ownerLabel / exportRows from views/assets.js. */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, icon = App.icon;

  // Track config: maps the customer-facing track name to its FLOW + ticket type.
  const TRACKS = {
    Sale:     { flow: 'writeoffSale',     type: 'Write-off Sale',     icon: 'sell',                page: 'p.7', ids: 'WS1-WS6', tone: 'info' },
    Donation: { flow: 'writeoffDonation', type: 'Write-off Donation', icon: 'volunteer_activism',  page: 'p.8', ids: 'WD1-WD3', tone: 'ok'   },
    Lost:     { flow: 'writeoffLost',     type: 'Write-off Lost',      icon: 'search_off',          page: 'p.6 / p.9', ids: 'L1-L5, WL1-WL2', tone: 'danger' },
    Dispose:  { flow: 'writeoffDispose',  type: 'Write-off Dispose',  icon: 'delete_forever',      page: 'M7', ids: 'M7', tone: 'neutral' },
  };
  const DISPOSE_METHODS = ['Physical destruction', 'Licensed scrap vendor', 'E-waste recycler'];
  const trackOf = (t) => (t.type || '').replace('Write-off ', '') || 'Sale';

  function ememoRecipients(a) {
    if (!a) return [];
    const ownerEmail = a.owner && a.owner.type === 'org' ? (a.orgHeadEmail || a.owner.email) : (a.owner && a.owner.email);
    const rows = [];
    if (ownerEmail) rows.push({ role: 'Asset owner / Head-of', email: ownerEmail });
    const hq = App.store.users.find(u => u.role === 'asset_hq');
    if (hq) rows.push({ role: 'Asset Team HQ', email: hq.email });
    const acc = App.store.users.find(u => u.role === 'accounting');
    if (acc) rows.push({ role: 'Accounting', email: acc.email });
    const area = (a.area || '').toLowerCase();
    const ga = App.store.users.find(u => u.role === 'ga' && u.area && area && u.area.toLowerCase() === area);
    if (ga) rows.push({ role: 'GA (' + a.area + ')', email: ga.email });
    return rows;
  }

  // Track-specific documents named in the requirements (attachment affordance targets).
  function requiredDocs(t) {
    const track = trackOf(t);
    if (track === 'Sale') return ['Approved E-memo', 'Payment receipt (vendor)'];
    if (track === 'Donation') return ['Certificate of appreciation'];
    if (track === 'Dispose') return ['Approved E-memo', 'Destruction certificate / vendor receipt', 'Before-disposal photos'];
    // Lost - depends on the loss sub-case (p.6)
    if (t.lossType === 'theft') return ['Police daily record (copy)', 'POA + authorized signatory card', 'Compensation receipt'];
    return ['Supervisor / transferee memo', 'Disaster report (fire/flood/earthquake)', 'Compensation receipt'];
  }

  function causeLabel(t) {
    const track = trackOf(t);
    if (track === 'Lost') {
      let s = t.lossType === 'theft' ? 'Theft' : 'Unknown cause';
      if (t.unknownReason) s += ' - ' + t.unknownReason;
      return s;
    }
    if (track === 'Sale') return (t.verify && t.verify.cause) ? t.verify.cause : (t.insuranceClaim ? 'Damaged (insurance claim)' : 'Damaged / not needed');
    if (track === 'Donation') return t.recipient ? 'Donate \u2192 ' + t.recipient : 'Donation';
    if (track === 'Dispose') {
      const r = (t.verify && t.verify.cause) || t.disposeReason || 'Destroy / scrap';
      return t.disposeMethod ? r + ' \u2014 ' + t.disposeMethod : r;
    }
    return 'Lost';
  }

  const companyWriteoffs = () => App.store.tickets.filter(t =>
    (t.type || '').startsWith('Write-off') && t.company === App.session.company);

  const openQuestionCallouts = () => (App.OPEN_QUESTIONS || [])
    .filter(q => q.route === '#/writeoff')
    .map(q => ui.callout('question', `<b>Open question (p.${q.page})</b> - ${App.esc(q.text)}`))
    .join('');

  const stepLabel = (t) => {
    const flow = App.FLOWS[t.flow] || [];
    const s = flow[t.stepIndex];
    return s ? (t.stepIndex + 1) + '. ' + s.title : '-';
  };

  /* ====================================================================
     WIZARD + LIST  #/writeoff  +  #/writeoff/new
     ==================================================================== */
  const WO_STEPS = [
    { title: 'Select assets', desc: 'Pick assets to write off' },
    { title: 'Track & details', desc: 'Sale / Donation / Lost / Dispose track fields (p.6-9, M7)' },
    { title: 'Review & create', desc: 'Confirm and open write-off service request(s)' },
  ];

  const wiz = { step: 0, loc: null, assetIds: [], track: 'Sale', cause: '', insuranceClaim: false, recipient: '', lossType: 'unknown', unknownReason: '', disposeReason: '', disposeMethod: '', q: '' };
  App._writeoffWizard = wiz; // ponytail: harness self-check

  let _writeoffScanActive = false;
  App._writeoffScanActive = () => _writeoffScanActive; // ponytail: harness self-check

  let listFilter = 'all';
  let trackFilter = 'All';

  function resetWizard() {
    wiz.step = 0; wiz.loc = App.emptyLoc(); wiz.assetIds = []; wiz.q = '';
    wiz.track = 'Sale'; wiz.cause = ''; wiz.insuranceClaim = false;
    wiz.recipient = ''; wiz.lossType = 'unknown'; wiz.unknownReason = '';
    wiz.disposeReason = ''; wiz.disposeMethod = '';
    _writeoffScanActive = false;
  }

  function writeoffScanSessionBar() {
    if (!_writeoffScanActive) return '';
    const n = wiz.assetIds.length;
    return `<div class="count-scan-session card" id="writeoffScanSession">
      <div class="count-scan-session-head">
        <span class="material-symbols-outlined">qr_code_scanner</span>
        <strong>Scan session</strong>
        <span class="count-scan-counter">${n} selected</span>
        <button type="button" class="btn text sm" data-act="wo-end-scan">End session</button>
      </div>
      <div class="scan-box">
        <span class="material-symbols-outlined scan-box-icon">qr_code_scanner</span>
        <p class="scan-box-lead">Scan asset QR codes to add them to this write-off request. First scan sets location; keep scanning to add more.</p>
        <div class="scan-actions">
          <button type="button" class="btn" data-act="wo-scan-camera">${icon('photo_camera')} Scan with camera</button>
          <div class="scan-demo-group">
            <span class="scan-demo-label">For demo</span>
            <button type="button" class="btn outline sm" data-act="wo-scan-simulate">Simulate scan</button>
            <button type="button" class="btn outline sm" data-act="wo-scan-simulate-already">Simulate scan (already selected)</button>
          </div>
        </div>
        <div class="scan-manual-entry">
          <p class="muted" style="font-size:12px;margin:0 0 6px">Or enter asset code:</p>
          <input class="input" id="writeoffScanInput" placeholder="e.g. A-009 or asset code" autocomplete="off" />
          <button type="button" class="btn outline sm" data-act="wo-scan-lookup">Look up code</button>
        </div>
      </div>
    </div>`;
  }

  function addScannedAsset(a) {
    if (!a) return false;
    if (!App.locComplete(wiz.loc)) {
      wiz.loc = { company: a.companyCode, project: a.project, building: a.building, floor: a.floor, unit: a.unit };
    } else if (!App.locMatch(a, wiz.loc)) {
      ui.toast('Asset is not at the selected unit — ' + App.locLabel(a), 'warn');
      return false;
    }
    if (wiz.assetIds.includes(a.id)) {
      ui.toast(App.assetCode(a) + ' already selected', 'info');
      return false;
    }
    wiz.assetIds.push(a.id);
    ui.toast('Added ' + App.assetCode(a) + ' (' + wiz.assetIds.length + ' selected)', 'check_circle');
    return true;
  }

  function handleWriteoffScanCode(code) {
    const a = App.findCompanyAssetByScanCode(code);
    if (!a) {
      ui.toast('No asset found for: ' + String(code || '').trim(), 'error');
      return;
    }
    if (addScannedAsset(a)) App.refresh();
  }

  function simulateWriteoffScan() {
    const pool = companyAssets().filter(a => !wiz.assetIds.includes(a.id));
    let candidates = pool;
    if (App.locComplete(wiz.loc)) candidates = pool.filter(a => App.locMatch(a, wiz.loc));
    const a = candidates[0];
    if (!a) {
      ui.toast('No more assets to simulate at this location', 'info');
      return;
    }
    addScannedAsset(a);
    App.refresh();
  }

  function simulateWriteoffScanAlready() {
    const id = wiz.assetIds[0];
    if (!id) {
      ui.toast('Select an asset first — use Simulate scan', 'info');
      return;
    }
    handleWriteoffScanCode(id);
  }

  function mountWriteoffScan(root) {
    if (!_writeoffScanActive || wiz.step !== 0) return;
    root.querySelector('[data-act="wo-end-scan"]')?.addEventListener('click', () => {
      _writeoffScanActive = false;
      App.refresh();
    });
    root.querySelector('[data-act="wo-scan-camera"]')?.addEventListener('click', () => {
      ui.toast('Camera needs HTTPS in production — use For demo or Look up code', 'photo_camera');
    });
    root.querySelector('[data-act="wo-scan-lookup"]')?.addEventListener('click', () => {
      const inp = root.querySelector('#writeoffScanInput');
      if (inp) handleWriteoffScanCode(inp.value);
    });
    root.querySelector('#writeoffScanInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleWriteoffScanCode(e.target.value);
    });
    root.querySelector('[data-act="wo-scan-simulate"]')?.addEventListener('click', simulateWriteoffScan);
    root.querySelector('[data-act="wo-scan-simulate-already"]')?.addEventListener('click', simulateWriteoffScanAlready);
    if (_writeoffScanActive && !root.querySelector('#writeoffScanSession')) _writeoffScanActive = false;
  }

  function companyAssets() {
    return App.store.assets.filter(a => a.companyCode === App.session.company);
  }

  function writeoffIsMine(t) {
    const a = App.asset(t.assetId);
    if (!a || !a.owner) return false;
    const u = App.currentUser();
    if (!u) return false;
    return a.owner.email === u.email || a.owner.name === u.name;
  }

  function mineTickets() {
    return companyWriteoffs().filter(writeoffIsMine);
  }

  function filteredAssets() {
    if (!App.locComplete(wiz.loc)) return [];
    return companyAssets().filter(a => App.locMatch(a, wiz.loc));
  }

  function captureWriteoff(root) {
    if (!root) return;
    if (!wiz.loc) wiz.loc = App.emptyLoc();
    App.captureLocFields(root, wiz.loc);
    const causeInp = root.querySelector('[name="cause"]');
    if (causeInp) wiz.cause = causeInp.value;
    const claimSel = root.querySelector('[name="insuranceClaim"]');
    if (claimSel) wiz.insuranceClaim = claimSel.value === 'Yes';
    const recipInp = root.querySelector('[name="recipient"]');
    if (recipInp) wiz.recipient = recipInp.value;
    const lossSel = root.querySelector('[name="lossType"]');
    if (lossSel) wiz.lossType = lossSel.value;
    const unkSel = root.querySelector('[name="unknownReason"]');
    if (unkSel) wiz.unknownReason = unkSel.value;
    const dispReason = root.querySelector('[name="disposeReason"]');
    if (dispReason) wiz.disposeReason = dispReason.value;
    const dispMethod = root.querySelector('[name="disposeMethod"]');
    if (dispMethod) wiz.disposeMethod = dispMethod.value;
  }

  function stepError() {
    if (wiz.step === 0 && !App.locComplete(wiz.loc)) return 'Select Company through Unit';
    if (wiz.step === 0 && !wiz.assetIds.length) return 'Select at least one asset';
    return null;
  }

  function wizardAssets() {
    return wiz.assetIds.map(id => App.asset(id)).filter(Boolean);
  }

  function trackFieldsBody() {
    const track = wiz.track;
    const seg = `<div class="pill-row" style="margin-bottom:14px;align-items:center">
      <span class="muted">Track:</span>
      <div class="segmented" data-seg="track">${Object.keys(TRACKS).map(tr =>
        `<button type="button" data-val="${tr}" class="${wiz.track === tr ? 'active' : ''}">${icon(TRACKS[tr].icon)} ${tr}</button>`
      ).join('')}</div>
    </div>`;
    let fields = '';
    if (track === 'Sale') {
      fields = ui.field({ label: 'Cause (damaged / not needed)', name: 'cause', type: 'text', value: wiz.cause, attrs: 'placeholder="e.g. hardware failure, beyond repair"' })
        + ui.field({ label: 'Insurance claim?', name: 'insuranceClaim', type: 'select', options: ['No', 'Yes'], value: wiz.insuranceClaim ? 'Yes' : 'No', hint: 'A claimed asset may keep being used or be sold (p.7 WS1)' });
    } else if (track === 'Donation') {
      fields = ui.field({ label: 'Recipient', name: 'recipient', type: 'text', value: wiz.recipient, attrs: 'placeholder="e.g. local school / foundation"', hint: 'Recipient issues certificate of appreciation (p.8 WD3)' });
    } else if (track === 'Dispose') {
      fields = ui.field({ label: 'Reason for disposal', name: 'disposeReason', type: 'text', value: wiz.disposeReason, attrs: 'placeholder="e.g. obsolete, no salvage value, hazardous"', hint: 'Why the asset must be destroyed rather than sold or donated' })
        + ui.field({ label: 'Disposal method', name: 'disposeMethod', type: 'select', options: ['', ...DISPOSE_METHODS], value: wiz.disposeMethod, hint: 'Physical destruction or licensed vendor (M7)' });
    } else {
      fields = ui.field({ label: 'Loss type', name: 'lossType', type: 'select', options: [{ value: 'theft', label: 'Theft' }, { value: 'unknown', label: 'Unknown cause' }], value: wiz.lossType, hint: 'Theft needs police daily record (p.6 L3)' });
      if (wiz.lossType === 'unknown') {
        fields += ui.field({ label: 'Unknown sub-reason', name: 'unknownReason', type: 'select', options: ['resignation', 'disaster - fire', 'disaster - flood', 'disaster - earthquake'], value: wiz.unknownReason, hint: 'Resignation or disaster (p.6 L4)' });
      }
    }
    return seg + fields;
  }

  function wizardStepBody() {
    if (wiz.step === 0) {
      if (!wiz.loc) wiz.loc = App.emptyLoc();
      let body = writeoffScanSessionBar();
      body += ui.locFields(wiz.loc);
      if (App.locComplete(wiz.loc)) {
        const rows = filteredAssets();
        body += ui.assetPicker({
          rows, state: wiz,
          columns: [
            { key: 'code', label: 'Asset code', render: r => `<span class="mono">${App.esc(App.assetCode(r))}</span>` },
            { key: 'desc1', label: 'Description', cls: 'wrap', render: r => App.esc([r.desc1, r.desc2].filter(Boolean).join(' ')) },
            { key: 'owner', label: 'Owner', render: r => App.ownerLabel(r) },
            { key: 'loc', label: 'Location', render: r => App.locCell(r) },
          ],
          empty: 'No assets at this unit',
        });
      } else {
        body += ui.callout('info', 'Select Project, Building, Floor and Unit to list assets.');
      }
      return body;
    }

    if (wiz.step === 1) return trackFieldsBody();

    const assets = wizardAssets();
    const causeSummary = wiz.track === 'Sale' ? (wiz.cause || (wiz.insuranceClaim ? 'Insurance claim' : 'Damaged / not needed'))
      : wiz.track === 'Donation' ? (wiz.recipient ? 'Donate \u2192 ' + wiz.recipient : 'Donation')
      : wiz.track === 'Dispose' ? ((wiz.disposeReason || 'Destroy / scrap') + (wiz.disposeMethod ? ' \u2014 ' + wiz.disposeMethod : ''))
      : (wiz.lossType === 'theft' ? 'Theft' : 'Unknown cause' + (wiz.unknownReason ? ' - ' + wiz.unknownReason : ''));
    return ui.table({
      columns: [
        { key: 'code', label: 'Asset code', render: r => `<span class="mono">${App.esc(App.assetCode(r))}</span>` },
        { key: 'desc', label: 'Description', cls: 'wrap', render: r => App.esc([r.desc1, r.desc2].filter(Boolean).join(' ')) },
        { key: 'owner', label: 'Owner', render: r => App.ownerLabel(r) },
      ],
      rows: assets,
      empty: 'No assets',
    })
      + `<dl class="kv" style="grid-template-columns:auto 1fr;margin-top:14px">
        <dt>Track</dt><dd>${ui.chip(wiz.track, TRACKS[wiz.track].tone)}</dd>
        <dt>Cause / details</dt><dd>${App.esc(causeSummary)}</dd>
        <dt>Service requests to create</dt><dd>${wiz.assetIds.length} (one per asset)</dd>
      </dl>`
      + ui.callout('info', 'Creates <b>one write-off service request per asset</b> on the selected track flow.');
  }

  function wizardNav() {
    const last = WO_STEPS.length - 1;
    const isLast = wiz.step === last;
    const n = wiz.assetIds.length;
    let btns = `<button type="button" class="btn text" id="wizCancel">${icon('close')} Cancel</button>`;
    if (wiz.step > 0) btns += ` <button type="button" class="btn tonal" id="wizBack">${icon('arrow_back')} Back</button>`;
    if (!isLast) btns += ` <button type="button" class="btn" id="wizNext">${icon('arrow_forward')} Next</button>`;
    else btns += ` <button type="button" class="btn" id="wizCreate">${icon('add')} Create write-off${n ? ' (' + n + ' service request' + (n === 1 ? '' : 's') + ')' : ''}</button>`;
    return `<div class="pill-row" style="margin-top:22px;justify-content:flex-end">${btns}</div>`;
  }

  function createWriteoffTickets() {
    if (!wiz.assetIds.length) { ui.toast('No assets selected', 'error'); return; }
    const cfg = TRACKS[wiz.track];
    const created = [];
    // ponytail: 1 ticket per asset — detail view binds to t.assetId; multi-asset would need detail rewrite
    wiz.assetIds.forEach(assetId => {
      const t = { type: cfg.type, flow: cfg.flow, assetId, title: wiz.track + ' write-off - ' + assetId };
      if (wiz.track === 'Sale') {
        t.insuranceClaim = wiz.insuranceClaim;
        if (wiz.cause) {
          const a = App.asset(assetId) || {};
          t.verify = { cause: wiz.cause, cost: a.cost, nbv: a.nbv, storage: '' };
        }
      } else if (wiz.track === 'Donation') {
        t.recipient = wiz.recipient;
      } else if (wiz.track === 'Dispose') {
        t.disposeReason = wiz.disposeReason;
        t.disposeMethod = wiz.disposeMethod;
        if (wiz.disposeReason) {
          const a = App.asset(assetId) || {};
          t.verify = { cause: wiz.disposeReason, cost: a.cost, nbv: a.nbv, storage: '' };
        }
      } else {
        t.lossType = wiz.lossType;
        if (t.lossType === 'unknown') t.unknownReason = wiz.unknownReason;
      }
      created.push(App.addTicket(t));
    });
    resetWizard();
    ui.toast('Created ' + created.length + ' service request(s)', 'check_circle');
    App.navigate(created.length === 1 ? '#/writeoff/' + created[0].id : '#/writeoff');
  }

  function mountWizard(root, ctx) {
    if (ctx && ctx.query && ctx.query.scan === '1') _writeoffScanActive = true;
    mountWriteoffScan(root);
    root.querySelectorAll('[data-seg="track"] button').forEach(b => b.onclick = () => {
      captureWriteoff(root); wiz.track = b.getAttribute('data-val'); App.refresh();
    });
    let prevLoc = wiz.loc ? JSON.stringify(wiz.loc) : '';
    App.mountLocFields(root, wiz.loc || App.emptyLoc(), () => {
      captureWriteoff(root);
      const next = JSON.stringify(wiz.loc);
      if (next !== prevLoc) { wiz.assetIds = []; prevLoc = next; }
      App.refresh();
    });
    const lossSel = root.querySelector('[name="lossType"]');
    if (lossSel) lossSel.onchange = () => { captureWriteoff(root); App.refresh(); };

    if (wiz.step === 0 && App.locComplete(wiz.loc)) App.mountAssetPicker(root, { state: wiz, rows: filteredAssets() });

    const cancel = root.querySelector('#wizCancel');
    if (cancel) cancel.onclick = () => { resetWizard(); App.navigate('#/writeoff'); };
    const back = root.querySelector('#wizBack');
    if (back) back.onclick = () => { captureWriteoff(root); wiz.step--; App.refresh(); };
    const next = root.querySelector('#wizNext');
    if (next) next.onclick = () => {
      captureWriteoff(root);
      const err = stepError();
      if (err) { ui.toast(err, 'error'); return; }
      wiz.step++;
      App.refresh();
    };
    const create = root.querySelector('#wizCreate');
    if (create) create.onclick = () => {
      captureWriteoff(root);
      const err = stepError();
      if (err) { ui.toast(err, 'error'); return; }
      createWriteoffTickets();
    };
  }

  App.startWriteoff = (assetId, opts) => {
    resetWizard();
    const o = opts || {};
    if (o.track && TRACKS[o.track]) wiz.track = o.track;
    const a = assetId ? App.asset(assetId) : null;
    if (a) {
      wiz.loc = { company: a.companyCode, project: a.project, building: a.building, floor: a.floor, unit: a.unit };
      wiz.assetIds = [a.id];
    }
    App.navigate('#/writeoff/new');
  };
  App._writeoffCreate = createWriteoffTickets; // ponytail: harness self-check

  function trackSeg(all, filtered) {
    const opts = [{ v: 'All', l: 'All (' + filtered.length + ')' }]
      .concat(Object.keys(TRACKS).map(tr => ({
        v: tr,
        l: tr + ' (' + all.filter(t => trackOf(t) === tr).length + ')',
      })));
    return `<div class="segmented" data-tfilter>${opts.map(o =>
      `<button type="button" data-val="${App.esc(o.v)}" class="${trackFilter === o.v ? 'active' : ''}">${App.esc(o.l)}</button>`
    ).join('')}</div>`;
  }

  App.registerView('#/writeoff', {
    title: 'Disposal / Write-off',
    render() {
      const all = companyWriteoffs();
      const mine = mineTickets();
      const base = listFilter === 'mine' ? mine : all;
      const rows = base.filter(t => trackFilter === 'All' || trackOf(t) === trackFilter);
      const openCount = (track) => all.filter(t => trackOf(t) === track && t.status !== 'Completed').length;

      const stats = ui.statStrip([
        { label: 'Open write-offs', value: all.filter(t => t.status !== 'Completed').length, ic: 'delete_sweep' },
        { label: 'Sale (p.7)', value: openCount('Sale'), ic: TRACKS.Sale.icon },
        { label: 'Donation (p.8)', value: openCount('Donation'), ic: TRACKS.Donation.icon },
        { label: 'Lost (p.6 / p.9)', value: openCount('Lost'), ic: TRACKS.Lost.icon },
        { label: 'Dispose (M7)', value: openCount('Dispose'), ic: TRACKS.Dispose.icon },
      ]);

      const listFilterBar = `<div class="pill-row" style="margin-bottom:10px;align-items:center">
        <span class="muted">Show:</span>
        <div class="segmented" data-lfilter>
          <button type="button" data-val="all" class="${listFilter === 'all' ? 'active' : ''}">${icon('list')} All service requests (${all.length})</button>
          <button type="button" data-val="mine" class="${listFilter === 'mine' ? 'active' : ''}" ${mine.length ? '' : 'disabled'}>${icon('person')} Mine (${mine.length})</button>
        </div>
      </div>`;

      const trackFilterBar = `<div class="pill-row" style="margin-bottom:14px;align-items:center;flex-wrap:wrap;gap:8px">
        <span class="muted">Track:</span>
        ${trackSeg(all, base)}
      </div>`;

      const table = ui.table({
        columns: [
          { key: 'id', label: 'Service request', render: r => `<span class="mono">${App.esc(r.id)}</span>` },
          { key: 'track', label: 'Track', render: r => ui.chip(trackOf(r), TRACKS[trackOf(r)] ? TRACKS[trackOf(r)].tone : 'neutral') },
          { key: 'asset', label: 'Asset', cls: 'wrap', render: r => { const a = App.asset(r.assetId); return a ? App.esc(App.assetTitle(a)) : App.esc(r.assetId || '-'); } },
          { key: 'cause', label: 'Cause / loss type', cls: 'wrap', render: r => App.esc(causeLabel(r)) },
          { key: 'step', label: 'Current step', cls: 'wrap', render: r => App.esc(stepLabel(r)) },
          { key: 'status', label: 'Status', render: r => ui.statusChip(r.status) },
        ],
        rows,
        rowLink: r => '#/writeoff/' + r.id,
        empty: listFilter === 'mine' ? 'No write-off service requests involving you.' : 'No write-off service requests — click Add new to start.',
      });

      return ui.pageHead({
        title: 'Disposal / Write-off',
        sub: 'Four tracks: <b>Sale</b> (p.7), <b>Donation</b> (p.8), <b>Lost</b> (p.6 / p.9), <b>Dispose</b> (destroy / scrap, M7). '
          + 'Initiate and attach evidence in WeCGA; committee approval is outside platform scope (SOW E2). <span class="muted">Modules M7, W5</span>',
        actions: `<button type="button" class="btn tonal" id="scanAssetsBtn">${icon('qr_code_scanner')} Scan assets</button>`
          + `<button type="button" class="btn" id="addNewBtn">${icon('add')} Add new</button>`,
      })
      + ui.callout('info', '<b>SOW E2:</b> Sub-committee and committee approval for disposal is excluded from the platform — this prototype demos initiate, verify, and evidence only.')
      + openQuestionCallouts()
      + stats
      + ui.card({ title: `${icon('list_alt')} Write-off service requests`, body: listFilterBar + trackFilterBar + table });
    },
    mount(root, ctx) {
      const scan = root.querySelector('#scanAssetsBtn');
      if (scan) scan.onclick = () => { resetWizard(); _writeoffScanActive = true; App.navigate('#/writeoff/new?scan=1'); };
      const add = root.querySelector('#addNewBtn');
      if (add) add.onclick = () => { resetWizard(); App.navigate('#/writeoff/new'); };
      if (ctx.query && ctx.query.asset) App.startWriteoff(ctx.query.asset);
      root.querySelectorAll('[data-lfilter] [data-val]').forEach(b => b.onclick = () => {
        if (b.disabled) return;
        listFilter = b.getAttribute('data-val');
        App.refresh();
      });
      root.querySelectorAll('[data-tfilter] [data-val]').forEach(b => b.onclick = () => {
        trackFilter = b.getAttribute('data-val');
        App.refresh();
      });
    },
  });

  App.registerView('#/writeoff/new', {
    title: 'New write-off',
    render(ctx) {
      if (ctx && ctx.query && ctx.query.scan === '1') _writeoffScanActive = true;
      if (wiz.step >= WO_STEPS.length) wiz.step = WO_STEPS.length - 1;
      return ui.pageHead({
        title: 'New write-off',
        breadcrumb: [{ label: 'Disposal / Write-off', hash: '#/writeoff' }, { label: 'New write-off' }],
        sub: 'Select assets, pick track, create one service request per asset',
        actions: ui.stepsBar(WO_STEPS, wiz.step),
      }) + ui.card({
        title: icon('edit_note') + ' ' + WO_STEPS[wiz.step].title,
        sub: `Step ${wiz.step + 1} of ${WO_STEPS.length} &mdash; ${WO_STEPS[wiz.step].desc}`,
        body: `<form id="wizForm">${wizardStepBody()}${wizardNav()}</form>`,
      });
    },
    mount: mountWizard,
  });

  /* ====================================================================
     DETAIL SCREEN  #/writeoff/:id
     ==================================================================== */
  App.registerView('#/writeoff/:id', {
    title: ctx => ctx.params.id,
    render(ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t || !(t.type || '').startsWith('Write-off')) return ui.pageHead({ title: 'Write-off service request not found' }) + ui.callout('warn', 'No such write-off service request.');
      const track = trackOf(t);
      const cfg = TRACKS[track] || TRACKS.Sale;
      const a = App.asset(t.assetId);
      const flow = App.FLOWS[t.flow] || [];
      const done = t.status === 'Completed' || t.stepIndex >= flow.length - 1;

      /* --- header chips (track + sub-case) --- */
      let chips = ui.chip(track + ' (' + cfg.page + ')', cfg.tone);
      if (track === 'Lost') {
        chips += ' ' + ui.chip(t.lossType === 'theft' ? 'Theft' : 'Unknown cause', t.lossType === 'theft' ? 'danger' : 'warn');
        if (t.unknownReason) chips += ' ' + ui.chip(t.unknownReason, 'neutral');
      }
      if (track === 'Sale') chips += ' ' + ui.chip(t.insuranceClaim ? 'Insurance claim: Yes' : 'Insurance claim: No', t.insuranceClaim ? 'warn' : 'neutral');
      if (track === 'Dispose' && t.disposeMethod) chips += ' ' + ui.chip(t.disposeMethod, 'neutral');
      chips += ' ' + ui.statusChip(t.status);

      /* --- asset summary card --- */
      const assetCard = a ? ui.card({
        title: `${icon('inventory_2')} Asset`,
        actions: `<button class="btn text sm" data-nav="#/assets/${a.id}">Open asset ${icon('open_in_new')}</button>`,
        body: `<dl class="kv" style="grid-template-columns:auto 1fr">
          <dt>Asset</dt><dd><a class="link" data-nav="#/assets/${a.id}">${App.esc(App.assetTitle(a))}</a></dd>
          <dt>Owner</dt><dd>${App.esc(App.ownerLabel(a))}</dd>
          <dt>SAP Asset code</dt><dd class="mono">${App.esc(a.asset || '- (no SAP code, WeCGA only)')}</dd>
          <dt>COST</dt><dd>${fmt.money(a.cost)}</dd>
          <dt>NBV</dt><dd>${fmt.money(a.nbv)}</dd>
          <dt>Current storage / location</dt><dd>${App.esc(a.locationDesc || '-')}${a.room ? ' - ' + App.esc(a.room) : ''}</dd>
        </dl>`,
      }) : ui.callout('warn', 'Linked asset not found.');

      /* --- origin: spawned from a count --- */
      const originCallout = t.origin === 'count'
        ? ui.callout('info', `This write-off was spawned from an <b>inventory count</b> outcome (p.10 3.4). See <a class="link" data-nav="#/reconcile">Reconciliation</a> and <a class="link" data-nav="#/audit">Audit log</a>.`)
        : '';

      /* --- Asset Team Verify panel (cause / COST / NBV / storage) --- */
      const v = t.verify || {};
      const verifyCard = ui.card({
        title: `${icon('fact_check')} Asset Team Verify`,
        sub: (track === 'Sale' ? 'p.7 step 7 (WS3)' : track === 'Donation' ? 'p.8 step 3 (WD2)' : track === 'Dispose' ? 'Dispose step 3 (M7)' : 'p.6 / p.9 step 3 (L2, WL1)') + ' - verify cause, COST, NBV, current storage location. Role: <b>Asset Team HQ</b>.',
        body: `<div class="form-grid">
            ${ui.field({ label: 'Cause / damage detail', name: 'v_cause', type: 'text', value: v.cause || '', attrs: App.hasRole('asset_hq') ? '' : 'readonly' })}
            ${ui.field({ label: 'COST', name: 'v_cost', type: 'text', value: v.cost != null ? v.cost : (a ? a.cost : ''), attrs: App.hasRole('asset_hq') ? '' : 'readonly' })}
          </div>
          <div class="form-grid">
            ${ui.field({ label: 'NBV', name: 'v_nbv', type: 'text', value: v.nbv != null ? v.nbv : (a ? a.nbv : ''), attrs: App.hasRole('asset_hq') ? '' : 'readonly' })}
            ${ui.field({ label: 'Current storage location', name: 'v_storage', type: 'text', value: v.storage || (a ? (a.room || a.locationDesc || '') : ''), attrs: App.hasRole('asset_hq') ? '' : 'readonly' })}
          </div>
          ${track === 'Lost' ? ui.field({ label: 'Compensate or not', name: 'v_compensate', type: 'select', options: ['Compensate', 'Do not compensate'], value: v.compensate || '', attrs: App.hasRole('asset_hq') ? '' : 'disabled' }) : ''}
          ${App.hasRole('asset_hq') ? `<div class="pill-row" style="margin-top:8px"><button class="btn sm" data-act="saveVerify">${icon('save')} Save verify</button></div>` : ui.callout('info', 'Read-only - switch role to <b>Asset Team HQ</b> to edit the verify panel.')}`,
      });

      /* --- track-specific panel --- */
      let trackCard = '';
      if (track === 'Sale') {
        trackCard = ui.card({
          title: `${icon('sell')} Sale - insurance & E-memo`,
          sub: 'p.7 WS1-WS2. Claim insurance if applicable; a claimed asset may keep being used (transfer location while awaiting claim) or be sold.',
          body: `<div class="form-grid">
              ${ui.field({ label: 'Insurance claim?', name: 's_claim', type: 'select', options: ['No', 'Yes'], value: t.insuranceClaim ? 'Yes' : 'No' })}
              ${ui.field({ label: 'Claimed asset - what next?', name: 's_decision', type: 'select', value: t.claimDecision || '', options: ['', 'Continue using - transfer location while awaiting claim', 'Sell'] })}
            </div>
            ${ui.callout('question', 'p.7 open question - <b>WeCGA generates the E-memo detail</b> (flow step 5). Whether WeCGA also routes the request to the line supervisor, or the approved memo comes from outside WeCGA, is still to confirm. Both paths are shown.')}
            ${t.ememoSentAt ? ui.callout('ok', 'E-memo sent to stakeholders on <b>' + fmt.datetime(t.ememoSentAt) + '</b> (p.7 step 19).') : ''}
            <div class="pill-row" style="margin-top:8px"><button class="btn sm" data-act="genMemo">${icon('draft')} WeCGA generate E-memo detail</button> <button class="btn sm tonal" data-act="sendEmemo">${icon('send')} Send E-memo to stakeholders</button> <button class="btn text sm" data-act="saveClaim">${icon('save')} Save</button></div>`,
        });
      } else if (track === 'Donation') {
        trackCard = ui.card({
          title: `${icon('volunteer_activism')} Donation - recipient & certificate`,
          sub: 'p.8 WD1-WD3. Recipient receives the asset and issues a certificate of appreciation.',
          body: `${ui.field({ label: 'Recipient', name: 'd_recipient', type: 'text', value: t.recipient || '', attrs: 'placeholder="e.g. local school / foundation"' })}
            ${ui.callout('info', 'The <b>certificate of appreciation</b> is tracked in Attachments below (p.8 WD3).')}
            <div class="pill-row" style="margin-top:8px"><button class="btn sm" data-act="saveRecipient">${icon('save')} Save recipient</button></div>`,
        });
      } else if (track === 'Dispose') {
        trackCard = ui.card({
          title: `${icon('delete_forever')} Dispose - destroy / scrap`,
          sub: 'M7 — physical destruction or licensed vendor; no sale or donation.',
          body: `<div class="form-grid">
              ${ui.field({ label: 'Reason for disposal', name: 'x_disposeReason', type: 'text', value: t.disposeReason || (v.cause || ''), attrs: 'placeholder="e.g. obsolete, hazardous"' })}
              ${ui.field({ label: 'Disposal method', name: 'x_disposeMethod', type: 'select', value: t.disposeMethod || '', options: ['', ...DISPOSE_METHODS] })}
            </div>
            ${ui.callout('info', 'Attach <b>destruction certificate</b> or vendor receipt in Attachments below after step 6–7.')}
            <div class="pill-row" style="margin-top:8px"><button class="btn sm" data-act="saveDispose">${icon('save')} Save dispose details</button></div>`,
        });
      } else {
        trackCard = ui.card({
          title: `${icon('search_off')} Lost - sub-case`,
          sub: 'p.6 L1-L5. Memo + line approval up to Head-of; Asset Team checks cause/COST/NBV/compensate-or-not.',
          body: `<div class="form-grid">
              ${ui.field({ label: 'Loss type', name: 'l_type', type: 'select', options: [{ value: 'theft', label: 'Theft' }, { value: 'unknown', label: 'Unknown cause' }], value: t.lossType || 'unknown' })}
              ${ui.field({ label: 'Unknown sub-reason', name: 'l_reason', type: 'select', value: t.unknownReason || '', options: ['', 'resignation', 'disaster - fire', 'disaster - flood', 'disaster - earthquake', 'no evidence from Store'] })}
            </div>
            ${t.lossType === 'theft'
              ? ui.callout('warn', 'Theft (p.6 L3): attach the <b>police daily-record copy</b>; for a company asset also attach <b>POA + authorized signatory card</b> (see Attachments).')
              : ui.callout('info', 'Unknown cause (p.6 L4): resignation (supervisor / transferee memo) <b>or</b> disaster (fire / flood / earthquake).')}
            ${ui.callout('info', `L5 - the loss log is kept and searchable in WeCGA. Open the <a class="link" data-nav="#/audit">Audit log</a>.`)}
            <div class="pill-row" style="margin-top:8px"><button class="btn sm" data-act="saveLost">${icon('save')} Save sub-case</button></div>`,
        });
      }

      /* --- Attachments --- */
      const attached = t.attachments || [];
      const docs = requiredDocs(t);
      const docRows = docs.map(d => {
        const has = attached.includes(d);
        return `<li class="${has ? 'pass' : 'pending'}">${icon(has ? 'check_circle' : 'radio_button_unchecked')}
          <span style="flex:1">${App.esc(d)} ${has ? ui.chip('Attached', 'ok') : ui.chip('Required', 'warn')}</span>
          ${has ? '' : `<button class="btn text sm" data-act="attach" data-doc="${App.esc(d)}">${icon('attach_file')} Attach</button>`}</li>`;
      }).join('');
      const extra = attached.filter(x => !docs.includes(x)).map(x => `<li class="pass">${icon('check_circle')}<span>${App.esc(x)} ${ui.chip('Attached', 'ok')}</span></li>`).join('');
      const attachCard = ui.card({
        title: `${icon('attachment')} Attachments`,
        sub: 'Track-specific documents named in the requirements.',
        body: `<ul class="checklist">${docRows}${extra}</ul>`,
      });

      /* --- Stepper (all numbered steps) + advance/approval --- */
      const stepper = ui.stepper(flow, t.stepIndex);
      const step = flow[t.stepIndex];
      let advance = '';
      if (done) {
        advance = ui.callout('info', `${icon('task_alt')} This write-off is complete (all ${flow.length} steps done).`);
      } else if (step) {
        const roleName = App.ROLES[step.role] || step.role;
        const canAct = App.hasRole(step.role);
        const isApproval = step.role === 'committee';
        const btnLabel = isApproval ? (step.title.indexOf('Sub-committee') === 0 ? 'Approve (Sub-committee)' : 'Approve (Committee)') : 'Advance step';
        advance = canAct
          ? `<div class="pill-row"><button class="btn" data-act="advance">${icon(isApproval ? 'gavel' : 'arrow_forward')} ${btnLabel}</button>
             <span class="muted">Acting as <b>${App.esc(roleName)}</b></span></div>`
          : ui.callout('warn', `Current step <b>${App.esc(step.title)}</b> is gated to role <b>${App.esc(roleName)}</b>. Switch role (top bar) to act.`);
      }
      const stepperCard = ui.card({
        title: `${icon('conveyor_belt')} Process - ${cfg.flow} (${cfg.page}, ${cfg.ids})`,
        sub: 'The literal numbered steps from the PDF. Approvals: Sub-committee then Committee (role Disposal Committee); Verify (Asset Team HQ); SAP removal (Accounting).',
        body: stepper + advance,
      });

      /* --- history timeline --- */
      const historyCard = (t.history && t.history.length) ? ui.card({
        title: `${icon('history')} History`,
        body: ui.timeline(t.history.map(h => ({ title: h.step, meta: `${fmt.datetime(h.ts)} - ${h.actor}${h.note ? ' - ' + h.note : ''}` }))),
      }) : '';

      const runInfo = t.runNumber ? ui.callout('info', `${icon('description')} PDF report run number <b class="mono">${App.esc(t.runNumber)}</b> generated (p.7 WS6 step 15).`) : '';

      return ui.pageHead({
        title: t.id + ' - ' + track + ' write-off',
        breadcrumb: [{ label: 'Disposal / Write-off', hash: '#/writeoff' }, { label: t.id }],
        sub: chips,
        actions: `<button class="btn tonal sm" data-act="pdf">${icon('picture_as_pdf')} Generate PDF report (run number)</button>
          <button class="btn outline sm" data-act="excel">${icon('table_view')} Export Excel</button>`,
      })
      + openQuestionCallouts()
      + originCallout
      + runInfo
      + `<div class="grid cols-2" style="align-items:start">
          <div>${assetCard}${verifyCard}${trackCard}${attachCard}</div>
          <div>${stepperCard}${historyCard}</div>
        </div>`;
    },
    mount(root, ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t) return;

      const val = (n) => { const el = root.querySelector(`[name="${n}"]`); return el ? el.value : ''; };

      const save = root.querySelector('[data-act="saveVerify"]');
      if (save) save.onclick = () => {
        t.verify = Object.assign({}, t.verify, {
          cause: val('v_cause'),
          cost: Number(val('v_cost')) || val('v_cost'),
          nbv: Number(val('v_nbv')) || val('v_nbv'),
          storage: val('v_storage'),
        });
        if (root.querySelector('[name="v_compensate"]')) t.verify.compensate = val('v_compensate');
        App.audit({ action: 'Write-off verify saved', target: t.id, detail: t.verify.cause || '' });
        ui.toast('Verify saved', 'save');
        App.refresh();
      };

      const claim = root.querySelector('[data-act="saveClaim"]');
      if (claim) claim.onclick = () => {
        t.insuranceClaim = val('s_claim') === 'Yes';
        t.claimDecision = val('s_decision');
        App.audit({ action: 'Write-off insurance updated', target: t.id, detail: (t.insuranceClaim ? 'Claim: Yes' : 'Claim: No') + (t.claimDecision ? ' - ' + t.claimDecision : '') });
        ui.toast('Saved', 'save');
        App.refresh();
      };

      const memo = root.querySelector('[data-act="genMemo"]');
      if (memo) memo.onclick = () => {
        App.audit({ action: 'WeCGA generated E-memo detail', target: t.id, detail: 'p.7 step 5 (open question)' });
        ui.toast('WeCGA generated the E-memo detail', 'draft');
      };

      const sendEmemo = root.querySelector('[data-act="sendEmemo"]');
      if (sendEmemo) sendEmemo.onclick = () => {
        const recips = ememoRecipients(a);
        const rows = recips.length
          ? recips.map(r => `<li>${App.esc(r.role)} &mdash; <span class="mono">${App.esc(r.email)}</span></li>`).join('')
          : '<li class="muted">No recipients resolved from asset data.</li>';
        ui.dialog({
          title: 'Send E-memo to stakeholders', size: 'md',
          sub: 'p.7 step 19 - notify owner/Head-of, Asset Team HQ, Accounting, and GA for the asset area.',
          body: `<ul class="checklist">${rows}</ul>`,
          actions: [
            { label: 'Cancel', kind: 'text' },
            { label: 'Send E-memo', kind: 'btn', act: () => {
              t.ememoSentAt = new Date().toISOString();
              App.audit({ action: 'E-memo sent to stakeholders', target: t.id,
                detail: recips.map(r => r.email).join(', ') || 'no recipients' });
              ui.toast('E-memo sent to ' + recips.length + ' recipient(s)', 'send');
              App.refresh();
            } },
          ],
        });
      };

      const rec = root.querySelector('[data-act="saveRecipient"]');
      if (rec) rec.onclick = () => {
        t.recipient = val('d_recipient');
        App.audit({ action: 'Donation recipient saved', target: t.id, detail: t.recipient || '' });
        ui.toast('Recipient saved', 'save');
        App.refresh();
      };

      const disp = root.querySelector('[data-act="saveDispose"]');
      if (disp) disp.onclick = () => {
        t.disposeReason = val('x_disposeReason');
        t.disposeMethod = val('x_disposeMethod');
        if (t.disposeReason) t.verify = Object.assign({}, t.verify, { cause: t.disposeReason });
        App.audit({ action: 'Dispose details saved', target: t.id, detail: causeLabel(t) });
        ui.toast('Dispose details saved', 'save');
        App.refresh();
      };

      const lost = root.querySelector('[data-act="saveLost"]');
      if (lost) lost.onclick = () => {
        t.lossType = val('l_type');
        t.unknownReason = t.lossType === 'unknown' ? val('l_reason') : '';
        App.audit({ action: 'Loss sub-case saved', target: t.id, detail: causeLabel(t) });
        ui.toast('Sub-case saved', 'save');
        App.refresh();
      };

      root.querySelectorAll('[data-act="attach"]').forEach(b => b.onclick = () => {
        const doc = b.getAttribute('data-doc');
        t.attachments = t.attachments || [];
        if (!t.attachments.includes(doc)) t.attachments.push(doc);
        App.audit({ action: 'Attachment added', target: t.id, detail: doc });
        ui.toast('Attached: ' + doc, 'attach_file');
        App.refresh();
      });

      const adv = root.querySelector('[data-act="advance"]');
      if (adv) adv.onclick = () => {
        const flow = App.FLOWS[t.flow] || [];
        const next = flow[t.stepIndex + 1];
        App.advanceTicket(t, 'Advanced by ' + (App.ROLES[App.session.role] || App.session.role));
        ui.toast(next ? 'Advanced to: ' + next.title : 'Completed', 'check_circle');
        App.refresh();
      };

      const pdf = root.querySelector('[data-act="pdf"]');
      if (pdf) pdf.onclick = () => {
        if (!t.runNumber) t.runNumber = App.nextId('WO');
        App.audit({ action: 'Write-off PDF report generated', target: t.id, detail: 'Run number ' + t.runNumber });
        ui.toast('PDF report run number ' + t.runNumber, 'picture_as_pdf');
        App.refresh();
        setTimeout(() => window.print(), 150);
      };

      const excel = root.querySelector('[data-act="excel"]');
      if (excel) excel.onclick = () => {
        const a = App.asset(t.assetId) || {};
        const v = t.verify || {};
        App.exportRows('writeoff-' + t.id + '.csv',
          ['Service request', 'Track', 'Asset', 'Cause / loss type', 'COST', 'NBV', 'Storage', 'Current step', 'Status', 'Run number', 'Attachments'],
          [[t.id, trackOf(t), App.assetCode(a), causeLabel(t), v.cost != null ? v.cost : a.cost, v.nbv != null ? v.nbv : a.nbv, v.storage || a.room || '', stepLabel(t), t.status, t.runNumber || '', (t.attachments || []).join('; ')]]);
      };
    },
  });
})();
