/* My Count Tasks (#/my-count) — scan session port from asset-tracking mockup. */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, esc = App.esc;

  const OUTCOME = {
    found_ok:      { label: 'Found - OK',          kind: 'ok' },
    found_wrong:   { label: 'Found - wrong info',  kind: 'warn' },
    not_in_sap:    { label: 'Found - not in SAP',  kind: 'warn' },
    found_damaged: { label: 'Found - damaged',     kind: 'danger' },
    not_found:     { label: 'Not found - lost',    kind: 'danger' },
    moved:         { label: 'Moved elsewhere',     kind: 'info' },
  };

  function roleMode() {
    switch (App.session.role) {
      case 'committee': return { key: 'committee', mass: true, photo: false, network: false, note: 'Committee - <b>mass scan, no photo</b>. Note rights are <b>time-bound</b> (C3).' };
      case 'it':        return { key: 'it',        mass: true, photo: false, network: false, note: 'IT - <b>mass scan, no photo</b> (C4).' };
      case 'engineer':  return { key: 'engineer',  mass: true, photo: false, network: true,  note: 'Engineering - <b>mass scan</b>, network equipment only (C5).' };
      default:          return { key: 'employee',  mass: false, photo: true, network: false, note: 'Employee - <b>scan + photo</b> per asset (C6).' };
    }
  }

  const isNetwork = (a) => /network/i.test(a.assetClassDesc || '') || a.assetClass === '7150';

  let _countPlan = null;
  let _countPkg = null;
  let _taskAssets = [];
  let _scanSessionActive = false;
  let _notScannedOnly = false;
  let _pendingScanAsset = null;
  let _scanPoolIndex = 0;
  let _wrongPoolIndex = 0;
  let _alreadyPoolIndex = 0;

  function planFromQuery(ctx) {
    const id = ctx && ctx.query && ctx.query.plan;
    if (!id) return null;
    return App.byId(App.store.countPlans, id);
  }

  function personalIsMine(p) {
    const me = App.currentUser();
    if (!me || !p.holderNames) return false;
    return p.holderNames.some(n => n === me.name || (n && n.name === me.name));
  }

  function canAccessCount(ctx) {
    const plan = planFromQuery(ctx);
    if (!plan) return { ok: false, reason: 'missing' };
    const comp = App.session.company;
    if (!((plan.companies && plan.companies.includes(comp)) || plan.company === comp)) {
      return { ok: false, reason: 'company', plan };
    }
    if (plan.type === 'personal') {
      if (!personalIsMine(plan)) return { ok: false, reason: 'holder', plan };
      return { ok: true, plan, pkg: null };
    }
    const pkgId = ctx.query && ctx.query.pkg;
    if (!pkgId) return { ok: false, reason: 'pkg', plan };
    const pkg = App.countPkgById(plan, pkgId);
    if (!pkg) return { ok: false, reason: 'pkg', plan };
    if (App.pkgHasTeam(pkg, App.session.role)) return { ok: true, plan, pkg };
    if (App.canAssignCountTeam() && !App.pkgTeamRoles(pkg).length) return { ok: true, plan, pkg };
    return { ok: false, reason: 'team', plan, pkg };
  }

  function ownedByMe(a) {
    const me = App.currentUser();
    if (!me || !a.owner) return false;
    return a.owner.email === me.email || a.owner.name === me.name;
  }

  function assetsForTask(plan, pkg, mode) {
    const comp = App.session.company;
    let assets = (plan.assignedAssets || []).map(App.asset).filter(a => a && a.companyCode === comp);
    if (mode.network) assets = assets.filter(isNetwork);
    if (plan.type === 'personal') return assets.filter(ownedByMe);
    if (!pkg) return [];
    const pkgAssets = pkg.assetIds.map(App.asset).filter(a => a && assets.some(pa => pa.id === a.id));
    if (mode.mass) return pkgAssets;
    const mine = pkgAssets.filter(ownedByMe);
    const others = pkgAssets.filter(a => !ownedByMe(a));
    return mine.concat(others);
  }

  function filteredAssets(assets, plan) {
    if (!_notScannedOnly || !plan) return assets;
    return assets.filter(a => !App.assetCountedInPlan(plan.id, a.id));
  }

  function scanSessionBar(scanned, total) {
    if (!_scanSessionActive) return '';
    return `<div class="count-scan-session card" id="countScanSession">
      <div class="count-scan-session-head">
        <span class="material-symbols-outlined">qr_code_scanner</span>
        <strong>Scan session</strong>
        <span class="count-scan-counter">${scanned} / ${total} scanned</span>
        <button type="button" class="btn text sm" data-act="end-scan">End session</button>
      </div>
      <div class="scan-box">
        <span class="material-symbols-outlined scan-box-icon">qr_code_scanner</span>
        <p class="scan-box-lead">Point your camera at the asset QR code, or use demo tools below.</p>
        <div class="scan-actions">
          <button type="button" class="btn" data-act="scan-camera">${App.icon('photo_camera')} Scan with camera</button>
          <div class="scan-demo-group">
            <span class="scan-demo-label">For demo</span>
            <button type="button" class="btn outline sm" data-act="scan-simulate">Simulate scan</button>
            <button type="button" class="btn outline sm" data-act="scan-simulate-wrong">Simulate scan (wrong location)</button>
            <button type="button" class="btn outline sm" data-act="scan-simulate-already">Simulate scan (scanned already)</button>
          </div>
        </div>
        <div class="scan-manual-entry">
          <p class="muted" style="font-size:12px;margin:0 0 6px">Or enter asset code:</p>
          <input class="input" id="countScanInput" placeholder="e.g. 715000017728" autocomplete="off" />
          <button type="button" class="btn outline sm" data-act="scan-lookup">Look up code</button>
        </div>
      </div>
    </div>`;
  }

  function fabHtml(plan) {
    return `<div class="count-fab-wrap" id="countFabWrap">
      <div class="count-fab-menu" id="countFabMenu" hidden>
        <button type="button" class="count-fab-action" data-act="fab-scan"><span class="material-symbols-outlined">qr_code_scanner</span>Scan QR</button>
        <button type="button" class="count-fab-action" data-act="fab-manual"><span class="material-symbols-outlined">edit_note</span>Record without scan</button>
        <button type="button" class="count-fab-action" data-nav="#/counts/${plan.id}"><span class="material-symbols-outlined">stacked_bar_chart</span>Plan progress</button>
      </div>
      <button type="button" class="fab-scan" id="countFab" aria-label="Count actions"><span class="material-symbols-outlined">apps</span></button>
    </div>`;
  }

  function countOutcomeCell(planId, assetId) {
    const cr = App.countResultForAsset(planId, assetId);
    if (!cr || !cr.outcome) return '<span class="muted">—</span>';
    const o = OUTCOME[cr.outcome];
    return ui.chip(o ? o.label : cr.outcome, o ? o.kind : 'neutral');
  }

  function assetTable(assets, plan, mode) {
    const rows = filteredAssets(assets, plan);
    return ui.table({
      columns: [
        { key: 'scanned', label: 'Scanned', cls: 'col-scanned', render: a => App.countScannedIcon(plan.id, a.id) },
        { key: 'code', label: 'Asset', render: a => `<span class="mono">${esc(App.assetCode(a))}</span><div class="muted" style="font-size:12px">${esc([a.desc1, a.desc2].filter(Boolean).join(' '))}</div>` },
        { key: 'area', label: 'Location', render: a => App.locCell(a) },
        { key: 'owner', label: 'Owner', cls: 'wrap', render: a => esc(App.ownerLabel(a)) },
        { key: 'countStatus', label: 'Status', render: a => ui.statusChip(a.countStatus) },
        { key: 'outcome', label: 'Count outcome', render: a => countOutcomeCell(plan.id, a.id) },
        { key: '_act', label: '', render: a => {
          const cr = App.countResultForAsset(plan.id, a.id);
          if (cr) return `<button class="btn text sm" data-act="report" data-id="${a.id}">${App.icon('report')} Report issue</button>`;
          return '<span class="muted">—</span>';
        } },
      ],
      rows,
      empty: _notScannedOnly ? 'All assets scanned' : 'Nothing to count here',
    });
  }

  App.registerView('#/my-count', {
    title: 'My Count Tasks',
    render(ctx) {
      const access = canAccessCount(ctx);
      if (!access.ok) {
        const msg = access.reason === 'missing'
          ? 'Open a count task from <a class="link" data-nav="#/counts">Inventory Counts</a> using the <b>My tasks</b> button.'
          : access.reason === 'team'
            ? `Location นี้มอบหมายให้ <b>${esc(App.pkgTeamRoles(access.pkg).map(App.countTeamLabel).join(', '))}</b> ไม่ใช่ role ของคุณ`
            : access.reason === 'holder'
              ? 'This personal count plan is not assigned to you as holder.'
              : 'Select a location work package from Inventory Counts.';
        return ui.pageHead({
          title: 'My Count Tasks',
          breadcrumb: [{ label: 'Inventory Counts', hash: '#/counts' }, { label: 'My Count Tasks' }],
        }) + ui.callout('warn', msg);
      }

      const plan = access.plan;
      const pkg = access.pkg;
      _countPlan = plan;
      _countPkg = pkg;
      const mode = roleMode();
      _taskAssets = assetsForTask(plan, pkg, mode);
      if (ctx.query && ctx.query.scan === '1') _scanSessionActive = true;

      const personal = plan.type === 'personal';
      const title = personal ? 'Assigned to me' : esc(pkg.label);
      const stats = App.countOutcomeStats(plan.id, _taskAssets);
      const scanned = Object.values(stats).reduce((s, n) => s + n, 0);

      const banner = ui.callout(mode.mass ? 'info' : 'warn',
        `<b>Counting mode:</b> ${mode.note}`, mode.mass ? 'bolt' : 'photo_camera');

      const layout = `<div class="count-task-layout">
        <div class="count-task-main">
          ${scanSessionBar(scanned, _taskAssets.length)}
          <label class="count-filter-not-scanned chip outline" style="cursor:pointer;display:inline-flex;align-items:center;margin:0 0 12px">
            <input type="checkbox" id="countNotScannedOnly" ${_notScannedOnly ? 'checked' : ''} style="margin-right:6px" /> Show not scanned only
          </label>
          ${ui.card({ title: `${App.icon('fact_check')} ${title}`, sub: 'Scan assets in session — list ticks as you count.', body: assetTable(_taskAssets, plan, mode) })}
        </div>
        <div class="count-task-side">
          ${ui.card({ title: `${App.icon('stacked_bar_chart')} Progress`, body: App.countScanProgressHtml(plan, _taskAssets) })}
        </div>
      </div>`;

      return ui.pageHead({
        title: 'My Count Tasks',
        breadcrumb: [{ label: 'Inventory Counts', hash: '#/counts' }, { label: plan.name }],
        sub: `<b>${esc(plan.name)}</b> (${esc(plan.id)}) — ${fmt.date(plan.start)} &rarr; ${fmt.date(plan.end)}`,
        actions: `<button class="btn tonal sm" data-act="fab-scan-inline">${App.icon('qr_code_scanner')} Scan QR</button>`,
      }) + banner + layout + fabHtml(plan);
    },
    mount(root, ctx) {
      const plan = _countPlan;
      const mode = roleMode();

      const toggleFab = () => {
        const menu = root.querySelector('#countFabMenu');
        const fab = root.querySelector('#countFab');
        if (!menu || !fab) return;
        const open = menu.hidden;
        menu.hidden = !open;
        fab.setAttribute('aria-expanded', open ? 'true' : 'false');
      };

      const startScanSession = () => {
        _scanSessionActive = true;
        App.refresh();
        setTimeout(() => document.getElementById('countScanInput')?.focus(), 50);
      };

      const endScanSession = () => {
        _scanSessionActive = false;
        App.refresh();
      };

      const handleScanCode = (code) => {
        let a = App.findAssetByScanCode(code, _taskAssets);
        if (!a) a = App.findCompanyAssetByScanCode(code, App.session.company);
        if (!a) { ui.toast('Asset not found for code/serial', 'error'); return; }
        if (App.assetCountedInPlan(plan.id, a.id)) {
          openAlreadyScanned(a);
          return;
        }
        const inPackage = _taskAssets.some(x => x.id === a.id);
        if (mode.network && inPackage && !isNetwork(a)) {
          ui.toast('Engineering role: network equipment only (C5)', 'error');
          return;
        }
        if (!inPackage) {
          const units = App.pkgUnits(_countPkg, _taskAssets);
          openScanResult(a, mode, { prefillFoundUnit: units[0] || '' });
          return;
        }
        openScanResult(a, mode);
      };

      const simulateHappyScan = () => {
        const pending = _taskAssets.filter(a => !App.assetCountedInPlan(plan.id, a.id));
        if (!pending.length) { ui.toast('All in-scope assets already counted', 'info'); return; }
        const asset = pending[_scanPoolIndex % pending.length];
        _scanPoolIndex++;
        openScanResult(asset, mode);
      };

      const simulateWrongLocationScan = () => {
        const units = App.pkgUnits(_countPkg, _taskAssets);
        if (!units.length) { ui.toast('This package has no units', 'error'); return; }
        const pool = App.assetsWrongLocationForCount(_countPkg, _taskAssets, App.session.company);
        if (!pool.length) {
          ui.toast('No demo asset with a unit outside this package', 'error');
          return;
        }
        const asset = pool[_wrongPoolIndex % pool.length];
        _wrongPoolIndex++;
        openScanResult(asset, mode, { prefillFoundUnit: units[0] });
      };

      const simulateAlreadyScanned = () => {
        const pool = _taskAssets.filter(a => App.assetCountedInPlan(plan.id, a.id));
        if (!pool.length) {
          ui.toast('No count record yet — simulate scan and save first', 'info');
          return;
        }
        const asset = pool[_alreadyPoolIndex % pool.length];
        _alreadyPoolIndex++;
        openAlreadyScanned(asset);
      };

      root.querySelector('[data-act="fab-scan-inline"]')?.addEventListener('click', startScanSession);
      root.querySelector('#countFab')?.addEventListener('click', toggleFab);
      root.querySelector('[data-act="fab-scan"]')?.addEventListener('click', () => { toggleFab(); startScanSession(); });
      root.querySelector('[data-act="fab-manual"]')?.addEventListener('click', () => { toggleFab(); openManualRecord(); });
      root.querySelector('[data-act="end-scan"]')?.addEventListener('click', endScanSession);
      root.querySelector('[data-act="scan-camera"]')?.addEventListener('click', () => {
        ui.toast('Camera needs HTTPS in production — use For demo or Look up code', 'photo_camera');
      });
      root.querySelector('[data-act="scan-lookup"]')?.addEventListener('click', () => {
        const inp = root.querySelector('#countScanInput');
        if (inp) handleScanCode(inp.value);
      });
      root.querySelector('#countScanInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleScanCode(e.target.value);
      });
      root.querySelector('[data-act="scan-simulate"]')?.addEventListener('click', simulateHappyScan);
      root.querySelector('[data-act="scan-simulate-wrong"]')?.addEventListener('click', simulateWrongLocationScan);
      root.querySelector('[data-act="scan-simulate-already"]')?.addEventListener('click', simulateAlreadyScanned);

      root.querySelector('#countNotScannedOnly')?.addEventListener('change', (e) => {
        _notScannedOnly = e.target.checked;
        App.refresh();
      });

      root.querySelectorAll('[data-act="report"]').forEach(b => b.onclick = () => {
        const a = App.asset(b.getAttribute('data-id'));
        if (a) openRecord(a, { manual: true });
      });

      if (_scanSessionActive && !root.querySelector('#countScanSession')) {
        _scanSessionActive = false;
      }
    },
  });

  function readScanModal(dlg, asset) {
    const foundUnit = dlg.root.querySelector('[name="foundUnit"]')?.value?.trim() || '';
    const picked = dlg.root.querySelector('input[name="scanQrOnAsset"]:checked');
    if (!foundUnit) { ui.toast('Select Found this QR code in Location (Unit)', 'error'); return null; }
    if (!picked) { ui.toast('Answer: Is QR attached to the correct asset?', 'error'); return null; }
    const scanAns = picked.value;
    const derived = App.forcedCountOutcome(foundUnit, asset.unit, scanAns);
    if (!derived) { ui.toast('Invalid scan answers', 'error'); return null; }
    const meta = {
      fromQrScan: true,
      scannedLocation: foundUnit,
      qrOnAssetAnswer: scanAns,
      scanKind: derived.scanKind,
      scanVerified: true,
      scannedAt: new Date().toISOString(),
    };
    return { foundUnit, scanAns, outcome: derived.outcome, meta };
  }

  function openScanResult(asset, mode, scanOpts) {
    scanOpts = scanOpts || {};
    _pendingScanAsset = asset;
    const units = App.pkgUnits(_countPkg, _taskAssets);
    const dlg = ui.dialog({
      title: 'QR found — asset details',
      size: 'lg',
      body: App.countScanResultBody(asset, units),
      actions: [
        { label: 'Close', kind: 'text' },
        { label: 'Continue to count form', kind: 'tonal', close: false, act: (d) => {
          const r = readScanModal(d, asset);
          if (!r) return;
          d.close();
          openRecord(asset, { lockedOutcome: r.outcome, scanMeta: r.meta, foundUnit: r.foundUnit, scanAns: r.scanAns });
        }},
        { label: 'Confirm count', kind: 'btn', close: false, act: (d) => {
          const r = readScanModal(d, asset);
          if (!r) return;
          if (r.outcome !== 'found_ok') {
            ui.toast('Use Continue for non-CO1 outcomes', 'warning');
            return;
          }
          if (!mode.mass) {
            d.close();
            openRecord(asset, { lockedOutcome: 'found_ok', scanMeta: r.meta, foundUnit: r.foundUnit, scanAns: r.scanAns, photoRequired: true });
            return;
          }
          d.close();
          saveFromScan(asset, r.outcome, { note: '' }, r.meta);
        }},
      ],
    });
    const def = scanOpts.prefillFoundUnit
      || dlg.root.querySelector('[name="countScanDefaultUnit"]')?.value;
    const sel = dlg.root.querySelector('[name="foundUnit"]');
    if (sel && def) sel.value = def;
    sel?.addEventListener('change', () => App.syncCountScanUnitBadge(dlg.root, asset));
    App.syncCountScanUnitBadge(dlg.root, asset);
  }

  function openAlreadyScanned(asset) {
    const cr = App.countResultForAsset(_countPlan.id, asset.id);
    const body = `
      <p class="scan-already-lead">This asset was already counted in this plan.</p>
      <dl class="kv" style="grid-template-columns:auto 1fr">
        <dt>Outcome</dt><dd>${esc(OUTCOME[cr.outcome]?.label || cr.outcome)}</dd>
        <dt>Date</dt><dd>${esc(fmt.date(cr.date))}</dd>
        <dt>Scan verified</dt><dd>${cr.scanVerified ? 'Yes' : 'No'}</dd>
        ${cr.scannedLocation ? `<dt>Found unit</dt><dd>${esc(cr.scannedLocation)}</dd>` : ''}
        ${cr.scanKind ? `<dt>Scan kind</dt><dd>${esc(App.countScanKindLabel(cr.scanKind))}</dd>` : ''}
      </dl>`;
    ui.dialog({ title: 'Already scanned', body, actions: [{ label: 'Close', kind: 'text' }] });
  }

  function saveFromScan(asset, outcome, d, scanMeta) {
    recordCount(asset, outcome, d, scanMeta);
    _pendingScanAsset = null;
    if (_scanSessionActive) {
      App.refresh();
      setTimeout(() => document.getElementById('countScanInput')?.focus(), 50);
    }
  }

  function openManualRecord() {
    const pending = filteredAssets(_taskAssets, _countPlan).filter(a => !App.assetCountedInPlan(_countPlan.id, a.id));
    const opts = pending.map(a => `<option value="${a.id}">${esc(App.assetCode(a))} — ${esc(a.desc1 || '')}</option>`).join('');
    const body = `
      ${ui.field({ label: 'Asset', name: 'manualAsset', type: 'select', required: true, options: [{ value: '', label: 'Select…' }].concat(pending.map(a => ({ value: a.id, label: App.assetCode(a) + ' — ' + (a.desc1 || '') }))) })}
      ${ui.field({ label: 'Record type (no QR)', name: 'manualType', type: 'select', required: true, options: [
        { value: 'not_in_sap', label: 'New / unregistered asset (CO3)' },
        { value: 'not_found', label: 'Not found — lost (CO5)' },
        { value: 'found_damaged', label: 'Found damaged (CO4)' },
        { value: 'moved', label: 'Moved elsewhere (CO6)' },
        { value: 'found_wrong', label: 'Wrong info / missing QR (CO2)' },
      ] })}
      <p class="muted" style="font-size:12px;margin:0">Manual path — no scan verification. Use for assets without QR or field exceptions.</p>`;
    ui.dialog({
      title: 'Record without scan',
      body,
      actions: [
        { label: 'Cancel', kind: 'text' },
        { label: 'Continue', kind: 'btn', close: false, act: (dlg) => {
          const id = dlg.root.querySelector('[name="manualAsset"]')?.value;
          const type = dlg.root.querySelector('[name="manualType"]')?.value;
          if (!id || !type) { ui.toast('Select asset and record type', 'error'); return; }
          const a = App.asset(id);
          if (!a) return;
          dlg.close();
          openRecord(a, { lockedOutcome: type, manual: true, scanMeta: { fromQrScan: false, scanVerified: false } });
        }},
      ],
    });
  }

  function openRecord(a, opts) {
    opts = opts || {};
    const mode = roleMode();
    const locked = opts.lockedOutcome;
    const scanMeta = opts.scanMeta || {};
    const notOwner = !ownedByMe(a);

    const outcomeOptions = [
      { value: 'found_ok',      label: 'CO1 - Found: location & owner correct' },
      { value: 'found_wrong',   label: 'CO2 - Found: location / owner WRONG' },
      { value: 'not_in_sap',    label: 'CO3 - Found: NOT in SAP' },
      { value: 'found_damaged', label: 'CO4 - Found: DAMAGED' },
      { value: 'not_found',     label: 'CO5 - NOT found (lost)' },
      { value: 'moved',         label: 'CO6 - Moved elsewhere' },
    ];

    const scanBanner = scanMeta.fromQrScan
      ? ui.callout('info', `Scan verified — found unit <b>${esc(scanMeta.scannedLocation || opts.foundUnit || '')}</b>`
        + (scanMeta.scanKind ? ` · ${esc(App.countScanKindLabel(scanMeta.scanKind))}` : '')
        + (locked ? ` · Outcome locked: <b>${esc(OUTCOME[locked]?.label || locked)}</b>` : ''))
      : (opts.manual ? ui.callout('warn', 'Manual record — no QR scan verification.') : '');

    const photoBlock = (mode.photo || opts.photoRequired) && locked === 'found_ok'
      ? ui.callout('warn', `Photo required (C6). <a class="link" data-nav="#/scan?asset=${a.id}">Open Scan &amp; Record</a> to capture photos, or check below to confirm.`, 'photo_camera')
        + `<label class="chip outline" style="cursor:pointer;display:inline-flex;align-items:center;margin-top:8px"><input type="checkbox" name="photoDone" style="margin-right:6px" /> Photo captured (demo)</label>`
      : (mode.photo && !mode.mass
        ? ui.callout('warn', 'Employee role: scan + photo required (C6).', 'photo_camera')
        : ui.callout('ok', 'Mass-scan role: no photo required.', 'bolt'));

    const outcomeField = locked
      ? `<input type="hidden" name="outcome" value="${esc(locked)}" />${ui.callout('info', `<b>${esc(OUTCOME[locked]?.label || locked)}</b> — derived from scan answers.`)}`
      : ui.field({ label: 'Count outcome', name: 'outcome', type: 'select', required: true, options: outcomeOptions });

    const body = `
      ${ui.callout('info', `Counting <b>${esc(App.assetTitle(a))}</b><br>Owner: <b>${esc(App.ownerLabel(a))}</b> · Unit: ${esc(a.unit || '—')}`)}
      ${scanBanner}
      ${photoBlock}
      ${outcomeField}
      <div data-sub="found_wrong" style="display:none">
        ${ui.callout('warn', 'CO2 — On save: Transfer service request (movement).')}
        <div class="form-grid">
          ${ui.field({ label: 'Correct location', name: 'correctLocation', attrs: 'placeholder="Room / site"' })}
          ${ui.field({ label: 'Correct holder', name: 'correctHolder', attrs: 'placeholder="Actual holder"' })}
        </div>
      </div>
      <div data-sub="not_in_sap" style="display:none">${ui.callout('warn', 'CO3 — Registration service request.')}</div>
      <div data-sub="found_damaged" style="display:none">
        ${ui.callout('danger', 'CO4 — Write-off (damage) service request.')}
        ${ui.field({ label: 'Damage detail', name: 'damageNote', type: 'textarea' })}
      </div>
      <div data-sub="not_found" style="display:none">${ui.callout('danger', 'CO5 — Write-off (lost) service request.')}</div>
      <div data-sub="moved" style="display:none">
        ${ui.callout('info', 'CO6 — Note required. No evidence escalates to lost.')}
        <div class="form-grid">
          ${ui.field({ label: 'Destination', name: 'dest', type: 'select', options: ['Store', 'Engineering', 'Vendor', 'IT'] })}
          ${ui.field({ label: 'Evidence', name: 'evidence', type: 'select', options: [
            { value: 'email', label: 'Email' }, { value: 'attachment', label: 'Attachment' }, { value: 'none', label: 'No evidence' },
          ] })}
        </div>
      </div>
      ${ui.field({ label: 'Note', name: 'note', type: 'textarea', attrs: 'placeholder="Observation"' })}
      <label class="chip outline" style="cursor:pointer;display:inline-flex;align-items:center">
        <input type="checkbox" name="onBehalf" style="margin-right:6px" ${notOwner ? 'checked' : ''}> On behalf of owner (C7)
      </label>`;

    const dlg = ui.dialog({
      title: 'Record count — ' + App.assetCode(a),
      size: 'lg',
      body,
      actions: [
        { label: 'Cancel', kind: 'text' },
        { label: 'Save count', kind: 'btn', close: false, act: (d) => saveRecord(a, d, scanMeta, opts) },
      ],
    });

    const sel = dlg.root.querySelector('[name="outcome"]');
    const subs = dlg.root.querySelectorAll('[data-sub]');
    if (sel && sel.tagName === 'SELECT') {
      const updSub = () => subs.forEach(x => { x.style.display = x.getAttribute('data-sub') === sel.value ? '' : 'none'; });
      sel.onchange = updSub;
      updSub();
    } else if (locked) {
      subs.forEach(x => { x.style.display = x.getAttribute('data-sub') === locked ? '' : 'none'; });
    }
  }

  function saveRecord(a, dlg, scanMeta, opts) {
    const q = s => { const el = dlg.root.querySelector(s); return el ? el.value.trim() : ''; };
    const chk = s => { const el = dlg.root.querySelector(s); return !!(el && el.checked); };
    const outcome = q('[name="outcome"]') || (opts && opts.lockedOutcome);
    if (!outcome) { ui.toast('Select outcome', 'error'); return; }
    if ((opts?.photoRequired || roleMode().photo) && outcome === 'found_ok' && scanMeta?.fromQrScan && !chk('[name="photoDone"]')) {
      ui.toast('Photo required for employee CO1 (C6)', 'error');
      return;
    }
    const d = {
      note: q('[name="note"]'),
      correctLocation: q('[name="correctLocation"]') || (scanMeta?.scannedLocation || ''),
      correctHolder: q('[name="correctHolder"]'),
      damageNote: q('[name="damageNote"]'),
      dest: q('[name="dest"]'),
      evidence: q('[name="evidence"]'),
      onBehalf: chk('[name="onBehalf"]'),
    };
    if (outcome === 'moved' && !d.note) { ui.toast('CO6 requires a note', 'error'); return; }
    if (scanMeta?.fromQrScan && !scanMeta.scanVerified && !opts?.manual) {
      ui.toast('Scan verification required', 'error');
      return;
    }
    recordCount(a, outcome, d, scanMeta);
    dlg.close();
    if (_scanSessionActive) {
      App.refresh();
      setTimeout(() => document.getElementById('countScanInput')?.focus(), 50);
    }
  }

  function recordCount(a, outcome, d, scanMeta) {
    scanMeta = scanMeta || {};
    const code = App.assetCode(a);
    let countStatus = 'Found';
    let spawned = null;

    if (outcome === 'found_wrong') {
      const note = d.note || (scanMeta.scanKind === 'mismatch_tagging' ? 'QR mismatch' : scanMeta.scanKind === 'detached_tag' ? 'Detached QR tag' : '');
      spawned = App.addTicket({ type: 'Transfer', flow: 'movement', assetId: a.id, origin: 'count',
        title: 'Count follow-up: correct owner/location of ' + code,
        fromOwner: (a.owner && a.owner.name) || '', toOwner: d.correctHolder || '', correctLocation: d.correctLocation || scanMeta.scannedLocation || '' });
      if (scanMeta.scanKind === 'mismatch_tagging') {
        scanMeta.companion = { type: 'missing_qr', note: 'Companion: QR on wrong asset' };
      }
    } else if (outcome === 'not_in_sap') {
      spawned = App.addTicket({ type: 'Registration', flow: 'registration', assetId: a.id, origin: 'count',
        title: 'Count follow-up: register asset not in SAP - ' + code });
    } else if (outcome === 'found_damaged') {
      spawned = App.addTicket({ type: 'Write-off Sale', flow: 'writeoffSale', assetId: a.id, origin: 'count',
        title: 'Count follow-up: damaged write-off - ' + code, damageNote: d.damageNote || d.note || '' });
    } else if (outcome === 'not_found') {
      countStatus = 'Not found';
      spawned = App.addTicket({ type: 'Write-off Lost', flow: 'writeoffLost', assetId: a.id, origin: 'count', lossType: 'unknown',
        title: 'Count follow-up: lost asset - ' + code });
    } else if (outcome === 'moved') {
      if (d.evidence === 'none') {
        countStatus = 'Not found';
        spawned = App.addTicket({ type: 'Write-off Lost', flow: 'writeoffLost', assetId: a.id, origin: 'count', lossType: 'unknown',
          unknownReason: 'no evidence for move to ' + (d.dest || '?'),
          title: 'Count follow-up: moved without evidence - ' + code });
      } else {
        spawned = App.addTicket({ type: 'Return', flow: 'movement', assetId: a.id, origin: 'count',
          confirmDept: d.dest, evidenceKind: d.evidence,
          title: 'Confirm return evidence with ' + d.dest + ' - ' + code });
      }
    }

    if (d.onBehalf && d.actualHolder) {
      App.addTicket({ type: 'Change holder', flow: 'movement', assetId: a.id, origin: 'count',
        toOwner: d.actualHolder, title: 'Count follow-up: change holder - ' + code });
    }

    const existing = App.countResultForAsset((_countPlan || {}).id, a.id);
    const rec = {
      id: existing ? existing.id : App.nextId('CR'),
      planId: (_countPlan || {}).id,
      assetId: a.id,
      outcome,
      by: App.session.userId,
      date: new Date().toISOString(),
      note: d.note || '',
      onBehalf: !!d.onBehalf,
      evidence: outcome === 'moved' ? (d.evidence !== 'none') : undefined,
      spawnedTicket: spawned ? spawned.id : undefined,
      fromQrScan: !!scanMeta.fromQrScan,
      scannedLocation: scanMeta.scannedLocation,
      qrOnAssetAnswer: scanMeta.qrOnAssetAnswer,
      scanKind: scanMeta.scanKind,
      scanVerified: !!scanMeta.scanVerified,
      scannedAt: scanMeta.scannedAt,
      companion: scanMeta.companion,
    };
    if (existing) {
      Object.assign(existing, rec);
    } else {
      App.store.countResults.push(rec);
    }

    a.countStatus = countStatus;
    a.lastCountDate = new Date().toISOString();
    App.audit({ action: 'Count recorded', target: a.id,
      detail: 'Outcome: ' + (OUTCOME[outcome] ? OUTCOME[outcome].label : outcome) + (spawned ? ' -> ' + spawned.id : '') });
    App.refresh();
    ui.toast(spawned ? ('Recorded — ' + spawned.type + ' ' + spawned.id) : 'Count recorded', 'fact_check');
    return spawned;
  }

  App.recordCount = recordCount;
  App.canAccessCount = canAccessCount;
})();
