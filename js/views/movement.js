/* Movement (#/movement, #/movement/new, #/movement/:id)
   Coverage: M4, W3, T1-T5 — 9-step transfer flow (p.5). */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, icon = App.icon, esc = App.esc;

  const MOVE_TYPES = ['Transfer', 'Borrow', 'Return', 'Repair', 'Change holder'];
  const TYPE_KIND = { Transfer: 'info', Borrow: 'warn', Return: 'ok', Repair: 'danger', 'Change holder': 'neutral' };
  const typeChip = (t) => ui.chip(t, TYPE_KIND[t] || 'neutral');

  const MV_STEPS = [
    { title: 'Select assets', desc: 'Pick assets to move (W3: GA limited to own area)' },
    { title: 'Movement details', desc: 'Type, receiver, reason (T2)' },
    { title: 'Review & create', desc: 'Confirm and open one movement service request' },
  ];

  const wiz = { step: 0, loc: null, assetIds: [], type: 'Transfer', toOwner: '', reason: '', notifyMovers: true, q: '' };
  App._movementWizard = wiz; // ponytail: harness self-check

  let _movementScanActive = false;
  App._movementScanActive = () => _movementScanActive; // ponytail: harness self-check

  let listFilter = 'all';
  let typeFilter = 'All';

  const movementTickets = () => App.store.tickets.filter(t =>
    MOVE_TYPES.includes(t.type) && t.company === App.session.company);

  const stepTitle = (t) => (App.FLOWS.movement[t.stepIndex] || {}).title || '-';

  const norm = (s) => String(s == null ? '' : s).trim().toUpperCase();
  const gaBlocked = (asset) => App.session.role === 'ga'
    && asset && norm(asset.area) !== norm((App.currentUser() || {}).area);

  function companyAssets() {
    return App.store.assets.filter(a => a.companyCode === App.session.company);
  }

  function resetWizard() {
    wiz.step = 0; wiz.loc = App.emptyLoc(); wiz.assetIds = []; wiz.q = '';
    wiz.type = 'Transfer'; wiz.toOwner = ''; wiz.reason = ''; wiz.notifyMovers = true;
    _movementScanActive = false;
  }

  function movementScanSessionBar() {
    if (!_movementScanActive) return '';
    const n = wiz.assetIds.length;
    return `<div class="count-scan-session card" id="movementScanSession">
      <div class="count-scan-session-head">
        <span class="material-symbols-outlined">qr_code_scanner</span>
        <strong>Scan session</strong>
        <span class="count-scan-counter">${n} selected</span>
        <button type="button" class="btn text sm" data-act="mv-end-scan">End session</button>
      </div>
      <div class="scan-box">
        <span class="material-symbols-outlined scan-box-icon">qr_code_scanner</span>
        <p class="scan-box-lead">Scan asset QR codes to add them to this movement request. First scan sets location; keep scanning to add more.</p>
        <div class="scan-actions">
          <button type="button" class="btn" data-act="mv-scan-camera">${icon('photo_camera')} Scan with camera</button>
          <div class="scan-demo-group">
            <span class="scan-demo-label">For demo</span>
            <button type="button" class="btn outline sm" data-act="mv-scan-simulate">Simulate scan</button>
            <button type="button" class="btn outline sm" data-act="mv-scan-simulate-already">Simulate scan (already selected)</button>
          </div>
        </div>
        <div class="scan-manual-entry">
          <p class="muted" style="font-size:12px;margin:0 0 6px">Or enter asset code:</p>
          <input class="input" id="movementScanInput" placeholder="e.g. A-023 or asset code" autocomplete="off" />
          <button type="button" class="btn outline sm" data-act="mv-scan-lookup">Look up code</button>
        </div>
      </div>
    </div>`;
  }

  function addScannedAsset(a) {
    if (!a) return false;
    if (gaBlocked(a)) {
      ui.toast('Asset outside your GA area (W3)', 'block');
      return false;
    }
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

  function handleMovementScanCode(code) {
    const a = App.findCompanyAssetByScanCode(code);
    if (!a) {
      ui.toast('No asset found for: ' + String(code || '').trim(), 'error');
      return;
    }
    if (addScannedAsset(a)) App.refresh();
  }

  function simulateMovementScan() {
    const pool = companyAssets().filter(a => !gaBlocked(a) && !wiz.assetIds.includes(a.id));
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

  function simulateMovementScanAlready() {
    const id = wiz.assetIds[0];
    if (!id) {
      ui.toast('Select an asset first — use Simulate scan', 'info');
      return;
    }
    handleMovementScanCode(id);
  }

  function mountMovementScan(root) {
    if (!_movementScanActive || wiz.step !== 0) return;
    root.querySelector('[data-act="mv-end-scan"]')?.addEventListener('click', () => {
      _movementScanActive = false;
      App.refresh();
    });
    root.querySelector('[data-act="mv-scan-camera"]')?.addEventListener('click', () => {
      ui.toast('Camera needs HTTPS in production — use For demo or Look up code', 'photo_camera');
    });
    root.querySelector('[data-act="mv-scan-lookup"]')?.addEventListener('click', () => {
      const inp = root.querySelector('#movementScanInput');
      if (inp) handleMovementScanCode(inp.value);
    });
    root.querySelector('#movementScanInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleMovementScanCode(e.target.value);
    });
    root.querySelector('[data-act="mv-scan-simulate"]')?.addEventListener('click', simulateMovementScan);
    root.querySelector('[data-act="mv-scan-simulate-already"]')?.addEventListener('click', simulateMovementScanAlready);
    if (_movementScanActive && !root.querySelector('#movementScanSession')) _movementScanActive = false;
  }

  // ponytail: free-text owner match by name/org; upgrade path = owner ref id on ticket
  function ownerMatches(label) {
    const u = App.currentUser();
    if (!u || !label) return false;
    const n = norm(label);
    return n === norm(u.name) || (u.org && n === norm(u.org));
  }

  function movementIsMine(t) {
    if (!t) return false;
    return ownerMatches(t.toOwner) || ownerMatches(t.fromOwner);
  }
  App.movementIsMine = movementIsMine; // ponytail: harness self-check

  function isReceiver(t) {
    return ownerMatches(t.toOwner);
  }

  function canAcceptMovement(t) {
    return isReceiver(t) || App.hasRole('asset_hq', 'ga');
  }

  function mineTickets() {
    return movementTickets().filter(movementIsMine);
  }

  App.movementAcceptedIds = (t) => {
    if (!t) return [];
    if (t.acceptedIds) return t.acceptedIds;
    if (t.stepIndex > 4) return App.ticketAssetIds(t);
    return [];
  };

  App.acceptMovement = (t, assetIds, opts) => {
    if (!t || !MOVE_TYPES.includes(t.type) || !assetIds || !assetIds.length) return;
    if (t.stepIndex !== 4) return;
    const all = App.ticketAssetIds(t);
    if (!t.acceptedIds) t.acceptedIds = [];
    assetIds.forEach(id => {
      if (all.includes(id) && !t.acceptedIds.includes(id)) t.acceptedIds.push(id);
    });
    const actor = App.currentUser().name;
    const now = new Date().toISOString();
    const behalf = opts && opts.onBehalfOf;
    t.history.push({
      ts: now, actor, step: 'Receiver accepts',
      note: (behalf ? 'Accepted on behalf of ' + behalf + ': ' : 'Accepted ')
        + assetIds.length + ' asset(s): ' + assetIds.join(', '),
    });
    const done = App.movementAcceptedIds(t);
    if (done.length >= all.length) {
      App.advanceTicket(t, 'All assets accepted by receiver');
    } else {
      t.status = t.status === 'Open' ? 'In progress' : t.status;
    }
    App.audit({ action: 'Movement accept', target: t.id, detail: done.length + '/' + all.length + ' assets' });
  };

  App.movementVerifiedIds = (t) => {
    if (!t) return [];
    if (t.verifiedIds) return t.verifiedIds;
    if (t.stepIndex > 6) return App.ticketAssetIds(t);
    return [];
  };

  function canVerifyMovement(t) {
    if (!App.hasRole('ga', 'asset_hq')) return false;
    if (App.session.role === 'ga') {
      const u = App.currentUser();
      return u && norm(t.area) === norm(u.area);
    }
    return true;
  }

  App.verifyMovement = (t, assetIds) => {
    if (!t || !MOVE_TYPES.includes(t.type) || !assetIds || !assetIds.length) return;
    if (t.stepIndex !== 6) return;
    const all = App.ticketAssetIds(t);
    if (!t.verifiedIds) t.verifiedIds = [];
    assetIds.forEach(id => {
      if (all.includes(id) && !t.verifiedIds.includes(id)) t.verifiedIds.push(id);
    });
    const actor = App.currentUser().name;
    const now = new Date().toISOString();
    t.history.push({
      ts: now, actor, step: 'GA Verify',
      note: 'Verified ' + assetIds.length + ' asset(s) via scan QR + destination photo: ' + assetIds.join(', '),
    });
    const done = App.movementVerifiedIds(t);
    if (done.length >= all.length) {
      App.advanceTicket(t, 'GA verified all assets (scan + destination photo)');
    } else {
      t.status = t.status === 'Open' ? 'In progress' : t.status;
    }
    App.audit({ action: 'Movement GA verify', target: t.id, detail: done.length + '/' + all.length + ' assets' });
  };

  App.startMovement = (assetId, opts) => {
    resetWizard();
    const type = opts && opts.type;
    if (type && MOVE_TYPES.includes(type)) wiz.type = type;
    const a = App.asset(assetId);
    if (a) {
      wiz.loc = { company: a.companyCode, project: a.project, building: a.building, floor: a.floor, unit: a.unit };
      if (!gaBlocked(a)) wiz.assetIds = [a.id];
    }
    App.navigate('#/movement/new');
  };

  function acceptProgress(t) {
    const total = App.ticketAssetIds(t).length;
    const done = App.movementAcceptedIds(t).length;
    return { done, total, left: total - done };
  }

  function progressCell(t) {
    const p = acceptProgress(t);
    if (!p.total) return '-';
    if (t.stepIndex < 4) return '<span class="muted">—</span>';
    if (t.stepIndex > 4) return ui.chip('All accepted', 'ok');
    const chip = p.left ? ui.chip(p.left + ' remaining', 'warn') : ui.chip('All accepted', 'ok');
    return `<span class="mono">${p.done}/${p.total}</span> ${chip}`;
  }

  function awaitingMyAccept() {
    return movementTickets().filter(t => {
      if (t.stepIndex !== 4 || t.status === 'Completed') return false;
      const p = acceptProgress(t);
      return canAcceptMovement(t) && p.left > 0;
    }).length;
  }

  function statStrip(all) {
    const open = all.filter(t => t.status !== 'Completed');
    const completed = all.length - open.length;
    return ui.statStrip([
      { label: 'Open movements', value: open.length, ic: 'swap_horiz' },
      { label: 'Awaiting my accept', value: awaitingMyAccept(), ic: 'how_to_reg' },
      { label: 'Completed', value: completed, ic: 'check_circle' },
      { label: 'Total', value: all.length, ic: 'inventory_2' },
    ]);
  }

  function typeSeg(all, filtered) {
    const opts = [{ v: 'All', l: 'All (' + filtered.length + ')' }]
      .concat(MOVE_TYPES.map(mt => ({
        v: mt,
        l: mt + ' (' + all.filter(t => t.type === mt).length + ')',
      })));
    return `<div class="segmented" data-tfilter>${opts.map(o =>
      `<button type="button" data-val="${esc(o.v)}" class="${typeFilter === o.v ? 'active' : ''}">${esc(o.l)}</button>`
    ).join('')}</div>`;
  }

  function filteredAssets() {
    if (!App.locComplete(wiz.loc)) return [];
    return companyAssets().filter(a => App.locMatch(a, wiz.loc));
  }

  function selectableAssets() {
    return filteredAssets().filter(a => !gaBlocked(a));
  }

  function captureMovement(root) {
    if (!root) return;
    if (!wiz.loc) wiz.loc = App.emptyLoc();
    App.captureLocFields(root, wiz.loc);
    const toInp = root.querySelector('[name="toOwner"]');
    if (toInp) wiz.toOwner = toInp.value;
    const reasonInp = root.querySelector('[name="reason"]');
    if (reasonInp) wiz.reason = reasonInp.value;
    const notifySel = root.querySelector('[name="notifyMovers"]');
    if (notifySel) wiz.notifyMovers = notifySel.value === 'Yes';
  }

  function stepError() {
    if (wiz.step === 0 && !App.locComplete(wiz.loc)) return 'Select Company through Unit';
    if (wiz.step === 0 && !wiz.assetIds.length) return 'Select at least one asset';
    if (wiz.step === 1 && !wiz.toOwner.trim()) return 'Enter the receiving owner';
    return null;
  }

  function wizardAssets() {
    return wiz.assetIds.map(id => App.asset(id)).filter(Boolean);
  }

  function wizardStepBody() {
    if (wiz.step === 0) {
      if (!wiz.loc) wiz.loc = App.emptyLoc();
      let body = movementScanSessionBar();
      body += ui.locFields(wiz.loc);
      if (App.locComplete(wiz.loc)) {
        const rows = filteredAssets();
        body += ui.assetPicker({
          rows, state: wiz,
          selectable: a => !gaBlocked(a),
          columns: [
            { key: 'code', label: 'Asset code', render: r => `<span class="mono">${esc(App.assetCode(r))}</span>` },
            { key: 'desc1', label: 'Description', cls: 'wrap', render: r => esc([r.desc1, r.desc2].filter(Boolean).join(' ')) },
            { key: 'owner', label: 'Current holder', render: r => App.ownerLabel(r) },
            { key: 'loc', label: 'Location', render: r => gaBlocked(r) ? App.locCell(r) + ' ' + ui.chip('Outside your project', 'danger') : App.locCell(r) },
          ],
          empty: 'No assets at this unit',
        });
      } else {
        body += ui.callout('info', 'Select Project, Building, Floor and Unit to list assets. W3: GA may only select assets in their own project.');
      }
      return body;
    }

    if (wiz.step === 1) {
      const assets = wizardAssets();
      if (!assets.length) return ui.callout('warn', 'No assets selected.');
      const typeSegHtml = `<div class="pill-row" style="margin-bottom:14px;align-items:center">
        <span class="muted">Type:</span>
        <div class="segmented" data-seg="type">${MOVE_TYPES.map(mt =>
          `<button type="button" data-val="${mt}" class="${wiz.type === mt ? 'active' : ''}">${esc(mt)}</button>`
        ).join('')}</div>
      </div>`;
      return typeSegHtml
        + ui.field({ label: 'To owner (person or organization)', name: 'toOwner', value: wiz.toOwner, required: true, hint: 'Receiver / borrower / repair vendor' })
        + ui.field({ label: 'Reason / notes', name: 'reason', type: 'textarea', value: wiz.reason, hint: 'Why are these assets moving?' })
        + ui.field({ label: 'Notify moving / logistics team?', name: 'notifyMovers', type: 'select', options: ['Yes', 'No'], value: wiz.notifyMovers ? 'Yes' : 'No', hint: 'p.2: transfer + notify moving department (T6)' });
    }

    const assets = wizardAssets();
    const rows = assets.map(a => ({
      code: App.assetCode(a),
      desc: [a.desc1, a.desc2].filter(Boolean).join(' '),
      owner: App.ownerLabel(a),
      area: a.area || '-',
      loc: App.locLabel(a),
    }));
    return ui.table({
      columns: [
        { key: 'code', label: 'Asset code', render: r => `<span class="mono">${esc(r.code)}</span>` },
        { key: 'desc', label: 'Description', cls: 'wrap', render: r => esc(r.desc) },
        { key: 'owner', label: 'From (holder)', render: r => esc(r.owner) },
        { key: 'loc', label: 'Location', render: r => esc(r.loc) },
      ],
      rows,
      empty: 'No assets',
    })
      + `<dl class="kv" style="grid-template-columns:auto 1fr;margin-top:14px">
        <dt>Movement type</dt><dd>${typeChip(wiz.type)}</dd>
        <dt>To owner</dt><dd>${esc(wiz.toOwner)}</dd>
        <dt>Assets</dt><dd>${wiz.assetIds.length}</dd>
        <dt>Notify movers</dt><dd>${wiz.notifyMovers ? 'Yes' : 'No'}</dd>
      </dl>
      ${ui.callout('info', 'Creates <b>one</b> movement service request on the 9-step transfer flow. Each asset is accepted individually at step 5 (T4).')}`;
  }

  function wizardNav() {
    const last = MV_STEPS.length - 1;
    const isLast = wiz.step === last;
    const n = wiz.assetIds.length;
    let btns = `<button type="button" class="btn text" id="wizCancel">${icon('close')} Cancel</button>`;
    if (wiz.step > 0) btns += ` <button type="button" class="btn tonal" id="wizBack">${icon('arrow_back')} Back</button>`;
    if (!isLast) btns += ` <button type="button" class="btn" id="wizNext">${icon('arrow_forward')} Next</button>`;
    else btns += ` <button type="button" class="btn" id="wizCreate">${icon('add_task')} Create movement${n ? ' (' + n + ' assets)' : ''}</button>`;
    return `<div class="pill-row" style="margin-top:22px;justify-content:flex-end">${btns}</div>`;
  }

  function createMovementTicket() {
    if (!wiz.assetIds.length) { ui.toast('No assets selected', 'error'); return; }
    const assets = wizardAssets();
    const blocked = assets.filter(gaBlocked);
    if (blocked.length) { ui.toast('Some assets are outside your GA area (W3)', 'block'); return; }
    const toOwner = wiz.toOwner.trim();
    if (!toOwner) { ui.toast('Enter the receiving owner', 'error'); return; }
    const first = assets[0];
    const holders = [...new Set(assets.map(a => a.owner ? a.owner.name : '-'))];
    const fromOwner = holders.length === 1 ? holders[0] : holders.length + ' holders';
    const title = assets.length === 1 && first
      ? `${wiz.type} - ${App.assetTitle(first)} : ${fromOwner} \u2192 ${toOwner}`
      : `${wiz.type} - ${assets.length} assets : ${fromOwner} \u2192 ${toOwner}`;
    const t = App.addTicket({
      type: wiz.type, flow: 'movement',
      assetIds: wiz.assetIds.slice(), assetId: wiz.assetIds[0],
      fromOwner, toOwner,
      reason: wiz.reason.trim(),
      notifyMovers: wiz.notifyMovers,
      acceptedIds: [],
      verifiedIds: [],
      area: first ? (first.area || (wiz.loc && wiz.loc.project) || '') : (wiz.loc && wiz.loc.project) || '',
      title,
      status: 'Open',
    });
    resetWizard();
    ui.toast('Movement service request ' + t.id + ' created', 'add_task');
    App.navigate('#/movement/' + t.id);
  }

  function mountWizard(root, ctx) {
    if (ctx && ctx.query && ctx.query.scan === '1') _movementScanActive = true;
    mountMovementScan(root);
    root.querySelectorAll('[data-seg="type"] button').forEach(b => b.onclick = () => {
      captureMovement(root); wiz.type = b.getAttribute('data-val'); App.refresh();
    });

    let prevLoc = wiz.loc ? JSON.stringify(wiz.loc) : '';
    App.mountLocFields(root, wiz.loc || App.emptyLoc(), () => {
      captureMovement(root);
      const next = JSON.stringify(wiz.loc);
      if (next !== prevLoc) { wiz.assetIds = []; prevLoc = next; }
      App.refresh();
    });

    if (wiz.step === 0 && App.locComplete(wiz.loc)) App.mountAssetPicker(root, { state: wiz, rows: filteredAssets(), selectable: a => !gaBlocked(a) });

    const cancel = root.querySelector('#wizCancel');
    if (cancel) cancel.onclick = () => { resetWizard(); App.navigate('#/movement'); };

    const back = root.querySelector('#wizBack');
    if (back) back.onclick = () => { captureMovement(root); wiz.step--; App.refresh(); };

    const next = root.querySelector('#wizNext');
    if (next) next.onclick = () => {
      captureMovement(root);
      const err = stepError();
      if (err) { ui.toast(err, 'error'); return; }
      wiz.step++;
      App.refresh();
    };

    const create = root.querySelector('#wizCreate');
    if (create) create.onclick = () => {
      captureMovement(root);
      const err = stepError();
      if (err) { ui.toast(err, 'error'); return; }
      createMovementTicket();
    };
  }

  function acceptProgress(t) {
    const total = App.ticketAssetIds(t).length;
    const done = App.movementAcceptedIds(t).length;
    return { done, total, left: total - done };
  }

  function verifyProgress(t) {
    const total = App.ticketAssetIds(t).length;
    const done = App.movementVerifiedIds(t).length;
    return { done, total, left: total - done };
  }

  function openVerifyDialog(t, assetId) {
    const a = App.asset(assetId);
    if (!a) return;
    const ts = new Date().toISOString();
    const u = App.currentUser();
    const gaAreaOk = App.session.role !== 'ga' || norm(a.area) === norm(u && u.area);
    // ponytail: destination GPS mocked from asset record; upgrade path = live device GPS at capture time
    const body = `
      ${ui.callout('info', `Verify transfer of <b>${esc(App.assetTitle(a))}</b> to <b>${esc(t.toOwner || '-')}</b> (p.3 10.2)`)}
      <div style="margin-top:12px"><div class="card-title">${icon('qr_code_scanner')} 8.1 Scan QR at destination</div>
      ${ui.qr(App.assetCode(a))}</div>
      <div class="grid cols-2" style="margin-top:12px">
        ${ui.photoTile(a, 'Destination', ts)}
        ${ui.photoTile(a, 'QR code', ts)}
      </div>
      <dl class="kv" style="grid-template-columns:auto 1fr;margin-top:12px">
        <dt>Latitude</dt><dd class="mono">${a.lat}</dd>
        <dt>Longitude</dt><dd class="mono">${a.lng}</dd>
        <dt>Address</dt><dd>${esc(a.address || '-')}</dd>
        <dt>District</dt><dd>${esc(a.district || '-')}</dd>
        <dt>Province</dt><dd>${esc(a.province || '-')}</dd>
        <dt>Timestamp</dt><dd>${fmt.datetime(ts)}</dd>
      </dl>
      ${ui.checklist([
        { label: 'QR scanned at destination', state: 'pass' },
        { label: 'Destination photo captured', state: 'pass' },
        { label: 'Receiver matches service request To owner', state: 'pass', note: t.toOwner || '-' },
        { label: 'Asset area within GA scope', state: gaAreaOk ? 'pass' : 'fail', note: a.area || '-' },
      ])}`;

    ui.dialog({
      title: 'GA Verify — ' + App.assetCode(a),
      sub: 'Scan QR + destination photo per p.3 item 10.2 / p.2-3 item 8',
      size: 'lg',
      body,
      actions: [
        { label: 'Cancel', kind: 'text' },
        { label: 'Open full scanner', kind: 'text', act: () => App.navigate('#/scan?asset=' + assetId) },
        { label: 'Confirm verified', kind: 'btn', act: () => {
          App.verifyMovement(t, [assetId]);
          ui.toast('Verified ' + App.assetCode(a), 'verified');
          App.refresh();
        } },
      ],
    });
  }

  function verifyAssetsHtml(t) {
    const ids = App.ticketAssetIds(t);
    const verified = App.movementVerifiedIds(t);
    const mayVerify = canVerifyMovement(t);
    const pending = ids.filter(id => !verified.includes(id));
    let verifyAllBtn = '';
    if (pending.length && mayVerify) {
      verifyAllBtn = `<button type="button" class="btn sm tonal" data-verify-all="${pending.join(',')}">${icon('verified')} Verify all (${pending.length})</button>`;
    }
    const tableRows = ids.map(id => {
      const a = App.asset(id);
      return { id, a, _verified: verified.includes(id) };
    });
    return ui.card({
      title: `${icon('verified')} Assets to GA verify`,
      sub: 'Step 7/9 — GA verifies each asset via scan QR + destination photo (p.3 10.2)',
      actions: verifyAllBtn,
      body: ui.table({
        columns: [
          { key: 'code', label: 'Asset code', render: r => `<span class="mono">${r.a ? esc(App.assetCode(r.a)) : esc(r.id)}</span>` },
          { key: 'desc', label: 'Description', cls: 'wrap', render: r => r.a ? esc([r.a.desc1, r.a.desc2].filter(Boolean).join(' ')) : '-' },
          { key: '_dest', label: 'Destination', cls: 'wrap', render: () => esc(t.toOwner || '-') },
          { key: '_status', label: 'Status', render: r => ui.statusChip(r._verified ? 'Verified' : 'Awaiting GA verify') },
          { key: '_act', label: '', render: r => {
            if (r._verified) return ui.chip('Verified', 'ok');
            if (!mayVerify) {
              const blocked = App.hasRole('ga') && r.a && norm(r.a.area) !== norm((App.currentUser() || {}).area);
              if (blocked) return ui.chip('Outside your area', 'danger');
              return '<span class="muted">Awaiting GA verify</span>';
            }
            return `<button type="button" class="btn sm" data-verify="${r.id}">${icon('qr_code_scanner')} Scan &amp; verify</button>`;
          } },
        ],
        rows: tableRows,
        empty: 'No assets',
      }),
    });
  }

  function acceptAssetsHtml(t) {
    const ids = App.ticketAssetIds(t);
    const accepted = App.movementAcceptedIds(t);
    const mayAccept = canAcceptMovement(t);
    const onBehalf = mayAccept && !isReceiver(t);
    const pending = ids.filter(id => !accepted.includes(id));
    let acceptAllBtn = '';
    if (pending.length && mayAccept) {
      const lbl = onBehalf ? `Accept all (${pending.length}) on behalf` : `Accept all (${pending.length})`;
      const behalfAttr = onBehalf ? ` data-behalf="${esc(t.toOwner || '')}"` : '';
      acceptAllBtn = `<button type="button" class="btn sm tonal" data-accept-all="${pending.join(',')}"${behalfAttr}>${icon('how_to_reg')} ${lbl}</button>`;
    }
    const tableRows = ids.map(id => {
      const a = App.asset(id);
      return { id, a, _accepted: accepted.includes(id) };
    });
    return ui.card({
      title: `${icon('inventory_2')} Assets to accept`,
      sub: `Step 5/9 — receiver accepts each asset by scan or in system (T4)${onBehalf ? ' ' + ui.chip('On behalf', 'info') : ''}`,
      actions: acceptAllBtn,
      body: ui.table({
        columns: [
          { key: 'code', label: 'Asset code', render: r => `<span class="mono">${r.a ? esc(App.assetCode(r.a)) : esc(r.id)}</span>` },
          { key: 'desc', label: 'Description', cls: 'wrap', render: r => r.a ? esc([r.a.desc1, r.a.desc2].filter(Boolean).join(' ')) : '-' },
          { key: '_status', label: 'Status', render: r => ui.statusChip(r._accepted ? 'Accepted' : 'Awaiting acceptance') },
          { key: '_act', label: '', render: r => {
            if (r._accepted) return ui.chip('Accepted', 'ok');
            if (!mayAccept) return '<span class="muted">Awaiting receiver</span>';
            const behalfAttr = onBehalf ? ` data-behalf="${esc(t.toOwner || '')}"` : '';
            return `<button type="button" class="btn sm" data-accept="${r.id}"${behalfAttr}>${icon('task_alt')} Accept</button>`
              + ` <button type="button" class="btn sm tonal" data-accept-scan="${r.id}"${behalfAttr}>${icon('qr_code_scanner')} Scan</button>`;
          } },
        ],
        rows: tableRows,
        empty: 'No assets',
      }),
    });
  }

  function stepActions(t) {
    const btn = (act, label, kind, ic) => `<button class="btn ${kind || ''}" data-act="${act}">${icon(ic)} ${label}</button>`;
    let inner = '';
    if (t.stepIndex === 4) {
      const p = acceptProgress(t);
      inner = p.left
        ? ui.callout('warn', `<b>${p.left}</b> asset(s) still awaiting acceptance below.`)
        : ui.callout('info', 'All assets accepted — advance continues automatically.');
    } else if (t.stepIndex === 6) {
      const p = verifyProgress(t);
      inner = p.left
        ? ui.callout('warn', `<b>${p.left}</b> asset(s) still awaiting GA verify below.`)
        : ui.callout('info', 'All assets verified — advance continues automatically.');
    } else {
      switch (t.stepIndex) {
        case 0: inner = btn('submit', 'Submit service request (send for approval)', '', 'send'); break;
        case 1: inner = btn('approve-transferor', 'Approve (transferor)', '', 'thumb_up'); break;
        case 2: inner = btn('approve-receiver', 'Approve (receiver)', '', 'thumb_up'); break;
        case 3: inner = btn('delivered', 'Mark delivered to receiver', '', 'local_shipping'); break;
        case 5: inner = btn('print', 'Print paper record', '', 'print'); break;
        case 7: inner = btn('sap', 'Update SAP', '', 'sync'); break;
        case 8: inner = btn('export', 'Export to Excel', '', 'table_view'); break;
        default: inner = '';
      }
    }
    const done = t.stepIndex >= App.FLOWS.movement.length - 1;
    const foot = done
      ? ui.callout('info', 'This movement has completed all 9 steps. You can still re-export the record to Excel.')
      : (t.stepIndex !== 4 && t.stepIndex !== 6 ? `<div class="muted" style="margin-top:8px">Buttons are gated by the current step; advancing records an entry in the service request history.</div>` : '');
    return `<div class="pill-row" style="gap:8px">${inner}</div>${foot}`;
  }

  function printRecord(t) {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) { ui.toast('Allow pop-ups to print the record', 'print'); return; }
    const row = (k, v) => `<tr><td style="padding:4px 10px;color:#555">${k}</td><td style="padding:4px 10px"><b>${App.esc(v)}</b></td></tr>`;
    const assets = App.ticketAssetIds(t).map(id => App.asset(id)).filter(Boolean);
    const assetRows = assets.map(a =>
      `<tr><td style="padding:4px 8px;border:1px solid #ddd">${App.esc(App.assetCode(a))}</td>`
      + `<td style="padding:4px 8px;border:1px solid #ddd">${App.esc(App.assetTitle(a))}</td>`
      + `<td style="padding:4px 8px;border:1px solid #ddd">${App.esc(a.serial || '-')}</td></tr>`
    ).join('');
    w.document.write(`<!doctype html><html><head><title>Transfer record ${App.esc(t.id)}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;margin:40px;color:#111}h1{font-size:20px}
      table{border-collapse:collapse;margin:12px 0}.sig{margin-top:60px;display:flex;justify-content:space-between}
      .sig div{width:40%;border-top:1px solid #111;padding-top:6px;text-align:center;font-size:13px}</style></head><body>
      <h1>WeCGA Asset Movement Record</h1>
      <div>Service request <b>${App.esc(t.id)}</b> &middot; Type <b>${App.esc(t.type)}</b> &middot; Printed ${App.esc(fmt.datetime(new Date().toISOString()))}</div>
      <table>
        ${row('From owner', t.fromOwner || '-')}
        ${row('To owner', t.toOwner || '-')}
        ${row('Area', t.area || '-')}
        ${row('Reason', t.reason || '-')}
        ${row('Created', fmt.datetime(t.created))}
      </table>
      <h2 style="font-size:16px;margin-top:20px">Assets (${assets.length})</h2>
      <table><thead><tr><th style="padding:4px 8px;border:1px solid #ddd">Code</th><th style="padding:4px 8px;border:1px solid #ddd">Description</th><th style="padding:4px 8px;border:1px solid #ddd">Serial</th></tr></thead>
      <tbody>${assetRows}</tbody></table>
      <div class="sig"><div>Transferor signature</div><div>Receiver signature</div></div>
      <div class="sig"><div>GA verify signature</div><div>Date</div></div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  function exportTicket(t) {
    const headers = ['Service request', 'Type', 'Status', 'Asset code', 'Asset', 'Serial', 'From owner', 'To owner', 'Area', 'Current step', 'Reason', 'Created', 'NBV'];
    const rows = App.ticketAssetIds(t).map(id => {
      const a = App.asset(id);
      return [
        t.id, t.type, t.status,
        a ? App.assetCode(a) : id,
        a ? App.assetTitle(a) : id,
        a ? (a.serial || '') : '',
        t.fromOwner || '', t.toOwner || '', t.area || (a && a.area) || '',
        stepTitle(t), t.reason || '', fmt.date(t.created),
        a ? a.nbv : '',
      ];
    });
    App.exportRows('movement-' + t.id + '.csv', headers, rows);
  }

  /* ============================ LIST (#/movement) ============================ */
  App.registerView('#/movement', {
    title: 'Movement',
    render() {
      const allTickets = movementTickets();
      const mine = mineTickets();
      const base = listFilter === 'mine' ? mine : allTickets;
      const rows = base.filter(t => typeFilter === 'All' || t.type === typeFilter);

      const listFilterBar = `<div class="pill-row" style="margin-bottom:10px;align-items:center">
        <span class="muted">Show:</span>
        <div class="segmented" data-lfilter>
          <button type="button" data-val="all" class="${listFilter === 'all' ? 'active' : ''}">${icon('list')} All service requests (${allTickets.length})</button>
          <button type="button" data-val="mine" class="${listFilter === 'mine' ? 'active' : ''}" ${mine.length ? '' : 'disabled'}>${icon('person')} Mine (${mine.length})</button>
        </div>
      </div>`;

      const typeFilterBar = `<div class="pill-row" style="margin-bottom:14px;align-items:center;flex-wrap:wrap;gap:8px">
        <span class="muted">Type:</span>
        ${typeSeg(allTickets, base)}
      </div>`;

      const gaNote = App.session.role === 'ga'
        ? ui.callout('warn', `You are acting as <b>GA (${esc((App.currentUser() || {}).area || 'no area')})</b>. Per <b>W3 (p.10 1.2)</b>, GA may only initiate transfers for assets in its own area.`, 'shield_person')
        : '';

      const table = ui.table({
        columns: [
          { key: 'id', label: 'Service request', render: r => `<span class="mono">${r.id}</span>` },
          { key: 'type', label: 'Type', render: r => typeChip(r.type) },
          { key: '_mine', label: 'Mine', render: r => movementIsMine(r) ? ui.chip('Yours', 'info') : '<span class="muted">—</span>' },
          { key: '_n', label: 'Assets', render: r => String(App.ticketAssetIds(r).length) },
          { key: '_asset', label: 'Asset', render: r => {
            const ids = App.ticketAssetIds(r);
            const a = App.asset(ids[0]);
            return a ? esc(App.assetCode(a)) + (ids.length > 1 ? ` <span class="muted">+${ids.length - 1}</span>` : '') : '-';
          } },
          { key: '_route', label: 'From → To', cls: 'wrap', render: r => `${esc(r.fromOwner || '-')} → ${esc(r.toOwner || '-')}` },
          { key: 'step', label: 'Step', render: r => `<span class="muted">${r.stepIndex + 1}/9</span> ${esc(stepTitle(r))}` },
          { key: '_prog', label: 'Accepted', render: r => progressCell(r) },
          { key: 'status', label: 'Status', render: r => ui.statusChip(r.status) },
        ],
        rows,
        rowLink: r => '#/movement/' + r.id,
        empty: listFilter === 'mine' ? 'No movement service requests involving you.' : 'No movement service requests — click Add new to start.',
      });

      return ui.pageHead({
        title: 'Movement',
        sub: 'Transfer / Borrow / Return / Repair / Change holder — 9-step holder transfer (M4, W3, T1–T5).',
        actions: `<button type="button" class="btn tonal" id="scanAssetsBtn">${icon('qr_code_scanner')} Scan assets</button>`
          + `<button type="button" class="btn" id="addNewBtn">${icon('add')} Add new</button>`,
      })
        + ui.callout('info', '<b>Not SOW 3.4 physical relocation.</b> This screen changes who holds the asset (Request / Borrow / Return). Physical relocation — moving team, building/floor/zone — is a separate service in the AIS SOW and is not implemented in this prototype.')
        + gaNote
        + statStrip(allTickets)
        + ui.card({ title: `${icon('filter_alt')} Movement service requests`, body: listFilterBar + typeFilterBar + table });
    },
    mount(root, ctx) {
      const scan = root.querySelector('#scanAssetsBtn');
      if (scan) scan.onclick = () => { resetWizard(); _movementScanActive = true; App.navigate('#/movement/new?scan=1'); };
      const add = root.querySelector('#addNewBtn');
      if (add) add.onclick = () => { resetWizard(); App.navigate('#/movement/new'); };
      if (ctx.query && ctx.query.asset) App.startMovement(ctx.query.asset);
      root.querySelectorAll('[data-lfilter] [data-val]').forEach(b => b.onclick = () => {
        if (b.disabled) return;
        listFilter = b.getAttribute('data-val');
        App.refresh();
      });
      root.querySelectorAll('[data-tfilter] [data-val]').forEach(b => b.onclick = () => {
        typeFilter = b.getAttribute('data-val');
        App.refresh();
      });
    },
  });

  /* ========================= WIZARD (#/movement/new) ========================= */
  App.registerView('#/movement/new', {
    title: 'New movement',
    render(ctx) {
      if (ctx && ctx.query && ctx.query.scan === '1') _movementScanActive = true;
      if (wiz.step >= MV_STEPS.length) wiz.step = MV_STEPS.length - 1;
      return ui.pageHead({
        title: 'New movement',
        breadcrumb: [{ label: 'Movement', hash: '#/movement' }, { label: 'New request' }],
        sub: 'Select assets, set type and receiver, create one movement service request (T2)',
        actions: ui.stepsBar(MV_STEPS, wiz.step),
      }) + ui.card({
        title: icon('edit_note') + ' ' + esc(MV_STEPS[wiz.step].title),
        sub: `Step ${wiz.step + 1} of ${MV_STEPS.length} &mdash; ${MV_STEPS[wiz.step].desc}`,
        body: `<form id="wizForm">${wizardStepBody()}${wizardNav()}</form>`,
      });
    },
    mount: mountWizard,
  });

  /* ========================= DETAIL (#/movement/:id) ========================= */
  App.registerView('#/movement/:id', {
    title: ctx => ctx.params.id,
    render(ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t || !MOVE_TYPES.includes(t.type)) return ui.pageHead({ title: 'Movement service request not found' })
        + ui.callout('warn', `No movement service request <span class="mono">${esc(ctx.params.id)}</span>. <a data-nav="#/movement">Back to Movement</a>`);
      const ids = App.ticketAssetIds(t);
      const flow = App.FLOWS.movement;
      const p = acceptProgress(t);

      const summary = ui.card({
        title: `${icon('swap_horiz')} ${esc(t.title)}`,
        actions: (t.notifyMovers && !t.moversNotified ? `<button class="btn sm tonal" data-act="notifyMovers">${icon('local_shipping')} Notify moving team</button>` : ''),
        body: `<div class="kv" style="grid-template-columns:auto 1fr">
            <dt>Type</dt><dd>${typeChip(t.type)}</dd>
            <dt>Status</dt><dd>${ui.statusChip(t.status)}</dd>
            <dt>Assets</dt><dd>${p.done}/${p.total} accepted</dd>
            <dt>From owner</dt><dd>${esc(t.fromOwner || '-')}</dd>
            <dt>To owner</dt><dd>${esc(t.toOwner || '-')}</dd>
            <dt>Area</dt><dd>${esc(t.area || '-')}</dd>
            <dt>Reason</dt><dd>${esc(t.reason || '-')}</dd>
            <dt>Moving team</dt><dd>${t.moversNotified ? ui.chip('Notified ' + fmt.datetime(t.moversNotified), 'ok') : (t.notifyMovers ? ui.chip('Pending notification', 'warn') : ui.chip('Not requested', 'neutral'))}</dd>
            <dt>Created</dt><dd>${fmt.datetime(t.created)}</dd>
          </div>`,
      });

      const assetList = ids.length > 1 ? ui.card({
        title: `${icon('inventory_2')} Assets (${ids.length})`,
        body: ui.table({
          columns: [
            { key: 'code', label: 'Code', render: r => `<span class="mono">${esc(App.assetCode(r))}</span>` },
            { key: 'desc', label: 'Description', cls: 'wrap', render: r => esc([r.desc1, r.desc2].filter(Boolean).join(' ')) },
            { key: 'owner', label: 'Holder', render: r => App.ownerLabel(r) },
          ],
          rows: ids.map(id => App.asset(id)).filter(Boolean),
          empty: '-',
        }),
      }) : (() => {
        const a = App.asset(ids[0]);
        return a ? ui.card({
          title: `${icon('inventory_2')} ${esc(App.assetTitle(a))}`,
          actions: `<button class="btn text sm" data-nav="#/assets/${a.id}">${icon('open_in_new')} Open asset</button>`,
          body: `<div class="kv" style="grid-template-columns:auto 1fr">
            <dt>Code</dt><dd class="mono">${esc(App.assetCode(a))}</dd>
            <dt>Holder</dt><dd>${App.ownerLabel(a)}</dd>
          </div>`,
        }) : '';
      })();

      const acceptBlock = t.stepIndex === 4 ? acceptAssetsHtml(t) : '';
      const verifyBlock = t.stepIndex === 6 ? verifyAssetsHtml(t) : '';

      const stepper = ui.card({
        title: `${icon('conveyor_belt')} Transfer process (9 steps - p.5)`,
        body: ui.stepper(flow, t.stepIndex),
      });

      const actions = ui.card({
        title: `${icon('bolt')} Action — step ${t.stepIndex + 1}/9: ${esc(stepTitle(t))}`,
        body: stepActions(t),
      });

      const originNote = t.origin === 'count'
        ? ui.callout('question', 'Spawned from an inventory count follow-up. See Reconciliation &amp; Counts.', 'fact_check')
        : '';

      const hist = (t.history || []).map(h => ({ title: h.step, meta: `${fmt.datetime(h.ts)} - ${h.actor}${h.note ? ' - ' + h.note : ''}`, icon: 'check_circle' }));
      const history = ui.card({
        title: `${icon('history')} Service request history`,
        body: hist.length ? ui.timeline(hist) : '<div class="muted">No steps recorded yet</div>',
      });

      return ui.pageHead({
        title: `${t.type} \u00b7 ${t.id}`,
        breadcrumb: [{ label: 'Movement', hash: '#/movement' }, { label: t.id }],
        sub: `${ui.statusChip(t.status)} ${progressCell(t)}`,
      })
        + originNote
        + `<div class="grid cols-2" style="align-items:start"><div>${summary}${assetList}${acceptBlock}${verifyBlock}${actions}${history}</div><div>${stepper}</div></div>`;
    },
    mount(root, ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t) return;
      const adv = (note) => { App.advanceTicket(t, note); App.refresh(); };
      const on = (act, fn) => { const el = root.querySelector(`[data-act="${act}"]`); if (el) el.onclick = fn; };

      on('submit', () => adv('Service request submitted for approval'));
      on('approve-transferor', () => adv('Approved by transferor authority (step 2)'));
      on('approve-receiver', () => adv('Approved by receiver authority (step 3)'));
      on('delivered', () => adv('Asset delivered to receiver (step 4)'));

      on('notifyMovers', () => {
        t.moversNotified = new Date().toISOString();
        App.audit({ action: 'Moving team notified', target: t.id, detail: 'Transfer + notify moving department (p.2)' });
        ui.toast('Moving / logistics team notified', 'local_shipping');
        App.refresh();
      });

      root.querySelectorAll('[data-accept]').forEach(btn => btn.onclick = () => {
        const id = btn.getAttribute('data-accept');
        const behalf = btn.getAttribute('data-behalf');
        App.acceptMovement(t, [id], behalf ? { onBehalfOf: behalf } : undefined);
        ui.toast('Accepted in system', 'task_alt');
        App.refresh();
      });

      root.querySelectorAll('[data-accept-all]').forEach(btn => btn.onclick = () => {
        const ids = btn.getAttribute('data-accept-all').split(',').filter(Boolean);
        const behalf = btn.getAttribute('data-behalf');
        App.acceptMovement(t, ids, behalf ? { onBehalfOf: behalf } : undefined);
        ui.toast('Accepted ' + ids.length + ' item(s)', 'task_alt');
        App.refresh();
      });

      root.querySelectorAll('[data-accept-scan]').forEach(btn => btn.onclick = () => {
        const id = btn.getAttribute('data-accept-scan');
        const a = App.asset(id);
        const behalf = btn.getAttribute('data-behalf');
        ui.dialog({
          title: 'Accept by scanning QR', size: 'sm',
          sub: 'p.5 item 5 — receiver accepts by scanning the asset QR.',
          body: ui.qr(a ? App.assetCode(a) : id) + `<div class="muted" style="text-align:center;margin-top:8px">Point the WeCGA camera at the tag.</div>`,
          actions: [
            { label: 'Open full scanner', kind: 'text', act: () => App.navigate('#/scan?asset=' + id) },
            { label: 'Simulate scan & accept', kind: 'btn', act: () => {
              App.acceptMovement(t, [id], behalf ? { onBehalfOf: behalf } : undefined);
              ui.toast('Accepted by scan', 'qr_code_scanner');
              App.refresh();
            } },
          ],
        });
      });

      root.querySelectorAll('[data-verify]').forEach(btn => btn.onclick = () => {
        openVerifyDialog(t, btn.getAttribute('data-verify'));
      });

      root.querySelectorAll('[data-verify-all]').forEach(btn => btn.onclick = () => {
        const ids = btn.getAttribute('data-verify-all').split(',').filter(Boolean);
        ids.forEach(id => App.verifyMovement(t, [id]));
        ui.toast('Verified ' + ids.length + ' item(s)', 'verified');
        App.refresh();
      });

      on('print', () => { printRecord(t); adv('Printed paper record'); });
      on('sap', () => { adv('Owner/location updated in SAP'); ui.toast('Owner/location updated in SAP', 'sync'); });
      on('export', () => exportTicket(t));
    },
  });
})();
