/* Tagging (#/tagging, #/tagging/new, #/tagging/:id)
   Covers: I5-I8 (p.2 items 5-8), M3 (QR tag per company). */
(function () {
  const App = window.App, ui = App.ui, esc = App.esc;

  const HQ_ONLY = 'QR generation is restricted to the central Asset Team (p.2 5.1)';

  const TAG_STEPS = [
    { title: 'Select assets', desc: 'Asset ใหม่ที่บัญชีแจ้งมาและยังไม่ได้ติด QR (p.2 ข้อ 5)' },
    { title: 'Generate QR', desc: 'QR Code Generate โดย Asset Team ส่วนกลางเท่านั้น (p.2 ข้อ 6 / 5.1)' },
    { title: 'Assign tagging', desc: 'GA (RO) คุมพื้นที่ หรือพนักงานในพื้นที่ติดเอง (p.2 ข้อ 5.2, 7.1, 7.2)' },
    { title: 'Review & create', desc: 'สรุปแล้วเปิดใบงานให้ไปติดจริง' },
  ];

  const wiz = { step: 0, loc: null, assetIds: [], qrDone: false, qrGeneratedAt: null, assignMode: 'area', userId: '', q: '' };
  App._tagWizard = wiz; // ponytail: harness self-check

  function untagged() {
    return App.store.assets.filter(a => a.tagStatus === 'Not tagged' && a.companyCode === App.session.company);
  }
  function taggingTickets() {
    return App.store.tickets.filter(t => t.type === 'Tagging' && t.company === App.session.company);
  }
  function openTicketFor(assetId) {
    return App.store.tickets.find(t => t.type === 'Tagging' && t.status !== 'Completed' && App.ticketAssetIds(t).includes(assetId));
  }
  function openTicketForPo(po) {
    return App.store.tickets.find(t => t.type === 'Tagging' && t.status !== 'Completed' && t.po === po);
  }
  function assetInOpenTicket(assetId) {
    return !!openTicketFor(assetId);
  }
  function untaggedAvailable() {
    return untagged().filter(a => !assetInOpenTicket(a.id));
  }
  function tagProgress(t) {
    const ids = App.ticketAssetIds(t);
    const total = ids.length;
    const done = ids.filter(id => (App.asset(id) || {}).tagStatus === 'Tagged').length;
    return { done, total, left: total - done };
  }

  function resetWizard() {
    wiz.step = 0; wiz.loc = App.emptyLoc(); wiz.assetIds = []; wiz.q = ''; wiz.qrDone = false; wiz.qrGeneratedAt = null;
    wiz.assignMode = 'area'; wiz.userId = '';
  }

  function assetLoc(a) {
    return a ? { company: a.companyCode, project: a.project, building: a.building, floor: a.floor, unit: a.unit } : null;
  }

  // ponytail: entry from intake / asset detail — open ticket or preselect wizard
  App.startTagging = (assetId) => {
    const open = openTicketFor(assetId);
    if (open) return App.navigate('#/tagging/' + open.id);
    const a = App.asset(assetId);
    resetWizard();
    if (a && a.unit) { wiz.loc = assetLoc(a); wiz.assetIds = [a.id]; }
    App.navigate('#/tagging/new');
  };

  // ponytail: procurement I2 — book appointment opens a Tagging service request (asset linked when PO already has one)
  App.createTaggingFromAppointment = ({ po, expectedDate, window, notes, poRecord }) => {
    const fmt = App.fmt;
    const existing = openTicketForPo(po);
    if (existing) {
      ui.toast('Tagging service request already open for this PO — ' + existing.id, 'info');
      App.navigate('#/tagging/' + existing.id);
      return existing;
    }
    const item = (poRecord && poRecord.item) || po;
    const detailNote = `Expected ${fmt.date(expectedDate)} (${window})${notes ? ' — ' + notes : ''}`;
    let assetIds = [];
    const wanted = poRecord
      ? (poRecord.createdAssets || (poRecord.createdAsset ? [poRecord.createdAsset] : []))
      : [];
    for (const id of wanted) {
      const open = openTicketFor(id);
      if (open) {
        ui.toast('Asset already on ' + open.id, 'info');
        App.navigate('#/tagging/' + open.id);
        return open;
      }
      const a = App.asset(id);
      if (a && a.tagStatus === 'Not tagged' && a.companyCode === App.session.company) assetIds.push(id);
    }
    const first = assetIds.length ? App.asset(assetIds[0]) : null;
    const flow = App.FLOWS.tagging;
    const now = new Date().toISOString();
    const t = App.addTicket({
      type: 'Tagging', flow: 'tagging', origin: 'procurement', po,
      title: 'Tagging appointment — ' + item,
      expectedDelivery: expectedDate, appointmentWindow: window, appointmentNotes: notes || '',
      assetIds: assetIds.length ? assetIds.slice() : undefined, assetId: assetIds[0],
      area: first ? first.project : '', status: 'Open',
      assignedTo: window + ' — ' + fmt.date(expectedDate),
    });
    t.stepIndex = 0;
    t.history = [{
      ts: now, actor: App.currentUser().name, step: flow[0].title,
      note: 'Procurement I2: delivery date confirmed — QR tagging appointment booked. ' + detailNote,
    }];
    App.audit({ action: 'Delivery date confirmed - QR appointment booked', target: po, detail: detailNote + ' → ' + t.id });
    ui.toast('Created ' + t.id + ' — QR tagging appointment booked', 'event_available');
    App.navigate('#/tagging/' + t.id);
    return t;
  };

  function captureTag(root) {
    if (!root) return;
    if (!wiz.loc) wiz.loc = App.emptyLoc();
    App.captureLocFields(root, wiz.loc);
    const userSel = root.querySelector('[name="user"]');
    if (userSel) wiz.userId = userSel.value;
  }

  function stepError() {
    if (wiz.step === 0 && !App.locComplete(wiz.loc)) return 'Select Company through Unit';
    if (wiz.step === 0 && !wiz.assetIds.length) return 'Select at least one asset';
    if (wiz.step === 1 && !App.hasRole('asset_hq')) return HQ_ONLY;
    if (wiz.step === 1 && !wiz.qrDone) return 'Generate the QR before continuing (p.2 5.1)';
    if (wiz.step === 2 && wiz.assignMode === 'user' && !wiz.userId) return 'Pick the employee who applies the tag';
    return null;
  }

  function assignSummary() {
    if (wiz.assignMode === 'area') {
      return App.locLabel(wiz.loc) + ' (GA/RO controlled)';
    }
    const u = App.user(wiz.userId);
    return u ? u.name + ' - ' + App.ROLES[u.role] : 'local user';
  }

  function wizardAssets() {
    return wiz.assetIds.map(id => App.asset(id)).filter(Boolean);
  }

  function wizardStepBody() {
    const users = App.store.users.filter(u => u.company === App.session.company && (u.role === 'employee' || u.role === 'ga'));
    const assets = wizardAssets();

    if (wiz.step === 0) {
      if (!wiz.loc) wiz.loc = App.emptyLoc();
      let body = ui.locFields(wiz.loc);
      if (App.locComplete(wiz.loc)) {
        const rows = untaggedAvailable().filter(a => App.locMatch(a, wiz.loc));
        body += ui.assetPicker({
          rows, state: wiz,
          columns: [
            { key: 'code', label: 'Asset code', render: r => `<span class="mono">${App.esc(App.assetCode(r))}</span>` },
            { key: 'desc1', label: 'Description', cls: 'wrap', render: r => App.esc([r.desc1, r.desc2].filter(Boolean).join(' ')) },
            { key: 'owner', label: 'Owner', render: r => App.ownerLabel(r) },
          ],
          empty: 'No untagged assets at this unit without an open service request',
        });
      } else {
        body += ui.callout('info', 'Select Project, Building, Floor and Unit to list untagged assets.');
      }
      return body;
    }

    if (wiz.step === 1) {
      if (!assets.length) return ui.callout('warn', 'No assets selected.');
      const comp = App.COMPANIES[App.session.company];
      const isHQ = App.hasRole('asset_hq');
      const qrGrid = assets.map(a => `<div style="text-align:center;padding:8px;border:1px solid var(--md-outline-variant);border-radius:8px">
          ${ui.qr(App.assetCode(a))}
          <div class="muted" style="font-size:12px;margin-top:4px">${esc([a.desc1, a.desc2].filter(Boolean).join(' '))}</div>
        </div>`).join('');
      return (isHQ ? '' : ui.callout('warn', HQ_ONLY + '. Switch role to <b>Asset Team HQ (Central)</b>.'))
        + `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px">${qrGrid}</div>
          <div class="kv" style="grid-template-columns:auto 1fr;margin-bottom:14px">
            <dt>Company</dt><dd>${esc(comp)}</dd>
            <dt>Assets</dt><dd>${assets.length} at ${esc(App.locLabel(wiz.loc))}</dd>
          </div>
          ${ui.callout('info', 'The QR encodes the company-specific asset code. Print and hand to GA (RO) for controlled tagging in the area.')}
          ${wiz.qrDone ? ui.callout('info', 'QR marked generated' + (wiz.qrGeneratedAt ? ' at ' + App.fmt.datetime(wiz.qrGeneratedAt) : '') + ' for ' + assets.length + ' asset(s).') : ''}
          <div class="pill-row" style="margin-top:14px">
            <button type="button" class="btn tonal" id="printQrBtn" ${isHQ ? '' : 'disabled'}>${App.icon('print')} Print QR sheet</button>
            <button type="button" class="btn" id="markQrBtn" ${isHQ ? '' : 'disabled'}>${App.icon('qr_code_2')} Mark QR generated</button>
          </div>`;
    }

    if (wiz.step === 2) {
      const modeSeg = `<div class="segmented" data-seg="assignMode" style="margin-bottom:14px">
        <button type="button" data-mode="area" class="${wiz.assignMode === 'area' ? 'active' : ''}">${App.icon('groups')} By GA-Asset Team (per area)</button>
        <button type="button" data-mode="user" class="${wiz.assignMode === 'user' ? 'active' : ''}">${App.icon('person')} By local employee / user</button>
      </div>`;
      const modeBody = wiz.assignMode === 'area'
        ? ui.callout('info', `p.2 item 7 (I7): tagging assigned to <b>GA (RO) at ${esc(App.locLabel(wiz.loc))}</b>.`)
        : ui.callout('info', `p.2 item 8 (I8): tag applied directly by the <b>local employee / user</b> who holds the asset.`)
          + ui.field({ label: 'Assign to employee / user', name: 'user', type: 'select', value: wiz.userId,
            options: [{ value: '', label: 'Pick employee' }].concat(users.map(u => ({ value: u.id, label: u.name + ' - ' + App.ROLES[u.role] }))) });
      return modeSeg + modeBody;
    }

    // step 3 - review
    const rows = assets.map(a => ({
      code: App.assetCode(a),
      desc: [a.desc1, a.desc2].filter(Boolean).join(' '),
      owner: App.ownerLabel(a),
    }));
    return ui.table({
      columns: [
        { key: 'code', label: 'Asset code', render: r => `<span class="mono">${esc(r.code)}</span>` },
        { key: 'desc', label: 'Description', cls: 'wrap', render: r => esc(r.desc) },
        { key: 'owner', label: 'Owner', render: r => esc(r.owner) },
      ],
      rows,
      empty: 'No assets',
    })
      + `<dl class="kv" style="grid-template-columns:auto 1fr;margin-top:14px">
        <dt>Location</dt><dd>${esc(App.locLabel(wiz.loc))}</dd>
        <dt>Assets</dt><dd>${wiz.assetIds.length}</dd>
        <dt>QR generated</dt><dd>${wiz.qrDone ? (wiz.qrGeneratedAt ? App.fmt.datetime(wiz.qrGeneratedAt) : 'Yes') : ui.chip('Pending', 'warn')}</dd>
        <dt>Assigned to</dt><dd>${esc(assignSummary())}</dd>
      </dl>
      ${ui.callout('info', 'Creates one tagging service request at step 4 (Tag applied). Physical tagging and first-record scan happen on the service request detail page (p.2 items 7-8).')}`;
  }

  function wizardNav() {
    const last = TAG_STEPS.length - 1;
    const isLast = wiz.step === last;
    const n = wiz.assetIds.length;
    let btns = `<button type="button" class="btn text" id="wizCancel">${App.icon('close')} Cancel</button>`;
    if (wiz.step > 0) btns += ` <button type="button" class="btn tonal" id="wizBack">${App.icon('arrow_back')} Back</button>`;
    if (!isLast) btns += ` <button type="button" class="btn" id="wizNext">${App.icon('arrow_forward')} Next</button>`;
    else btns += ` <button type="button" class="btn" id="wizCreate">${App.icon('check')} Create tagging service request${n ? ' (' + n + ' assets)' : ''}</button>`;
    return `<div class="pill-row" style="margin-top:22px;justify-content:flex-end">${btns}</div>`;
  }

  function createTaggingTicket() {
    if (!wiz.assetIds.length) { ui.toast('No assets selected', 'error'); return; }
    const blocked = wiz.assetIds.filter(id => assetInOpenTicket(id));
    if (blocked.length) { ui.toast('Some assets already have an open tagging service request', 'error'); return; }
    const flow = App.FLOWS.tagging;
    const first = App.asset(wiz.assetIds[0]);
    let target, note;
    if (wiz.assignMode === 'area') {
      target = App.locLabel(wiz.loc) + ' (GA/RO controlled)';
      note = 'Tag applied by GA-Asset Team at ' + App.locLabel(wiz.loc) + ' (' + wiz.assetIds.length + ' assets)';
    } else {
      const u = App.user(wiz.userId);
      target = u ? u.name : 'local user';
      note = 'Tag applied by local employee/user: ' + target + ' (' + wiz.assetIds.length + ' assets)';
    }
    const now = new Date().toISOString();
    const title = wiz.assetIds.length === 1 && first
      ? 'Tagging - ' + App.assetTitle(first)
      : 'Tagging - ' + wiz.assetIds.length + ' assets (' + (wiz.loc && wiz.loc.unit || '') + ')';
    const t = App.addTicket({
      type: 'Tagging', flow: 'tagging',
      assetIds: wiz.assetIds.slice(), assetId: wiz.assetIds[0],
      title, area: wiz.loc ? wiz.loc.project : '', status: 'In progress',
      qrGeneratedAt: wiz.qrGeneratedAt || now,
      assignedTo: target,
    });
    t.stepIndex = 3;
    t.history = [
      { ts: now, actor: App.currentUser().name, step: flow[0].title, note: 'Accounting notified Asset Team (p.2 item 5)' },
      { ts: now, actor: App.currentUser().name, step: flow[1].title, note: 'QR generated for ' + wiz.assetIds.length + ' asset(s)' },
      { ts: now, actor: App.currentUser().name, step: flow[2].title, note: note },
    ];
    App.audit({ action: 'Tagging service request created', target: t.id, detail: target + ' - ' + wiz.assetIds.length + ' assets' });
    const n = wiz.assetIds.length;
    resetWizard();
    ui.toast('Created ' + t.id + ' - ' + n + ' assets', 'qr_code_2');
    App.navigate('#/tagging/' + t.id);
  }

  function mountWizard(root) {
    root.querySelectorAll('[data-seg="assignMode"] [data-mode]').forEach(b => b.onclick = () => {
      captureTag(root); wiz.assignMode = b.getAttribute('data-mode'); App.refresh();
    });

    let prevLoc = wiz.loc ? JSON.stringify(wiz.loc) : '';
    App.mountLocFields(root, wiz.loc || App.emptyLoc(), () => {
      captureTag(root);
      const next = JSON.stringify(wiz.loc);
      if (next !== prevLoc) { wiz.assetIds = []; prevLoc = next; }
      App.refresh();
    });

    if (wiz.step === 0 && App.locComplete(wiz.loc)) {
      App.mountAssetPicker(root, { state: wiz, rows: untaggedAvailable().filter(a => App.locMatch(a, wiz.loc)) });
    }

    const printQr = root.querySelector('#printQrBtn');
    if (printQr) printQr.onclick = () => window.print();

    const markQr = root.querySelector('#markQrBtn');
    if (markQr) markQr.onclick = () => {
      if (!App.hasRole('asset_hq')) { ui.toast(HQ_ONLY, 'lock'); return; }
      wiz.qrDone = true;
      wiz.qrGeneratedAt = new Date().toISOString();
      wiz.assetIds.forEach(id => App.audit({ action: 'QR generated', target: id, detail: 'Company ' + App.session.company }));
      ui.toast('QR generated for ' + wiz.assetIds.length + ' asset(s)', 'qr_code_2');
      App.refresh();
    };

    const cancel = root.querySelector('#wizCancel');
    if (cancel) cancel.onclick = () => { resetWizard(); App.navigate('#/tagging'); };

    const back = root.querySelector('#wizBack');
    if (back) back.onclick = () => { captureTag(root); wiz.step--; App.refresh(); };

    const next = root.querySelector('#wizNext');
    if (next) next.onclick = () => {
      captureTag(root);
      const err = stepError();
      if (err) { ui.toast(err, 'error'); return; }
      wiz.step++;
      App.refresh();
    };

    const create = root.querySelector('#wizCreate');
    if (create) create.onclick = () => { captureTag(root); const err = stepError(); if (err) { ui.toast(err, 'error'); return; } createTaggingTicket(); };
  }

  function taggingReadyForHandover(t) {
    const p = tagProgress(t);
    return t.status === 'Completed' || (p.total > 0 && !p.left);
  }

  function handoverActionCell(t) {
    if (!taggingReadyForHandover(t)) return '<span class="muted">—</span>';
    const open = App.handoverForTagging && App.handoverForTagging(t.id);
    if (open) {
      return `<button type="button" class="btn text sm" data-nav="#/handover/${open.id}">${App.icon('assignment_ind')} ${App.esc(open.id)}</button>`;
    }
    return `<button type="button" class="btn tonal sm" data-act="handover" data-id="${App.esc(t.id)}">${App.icon('assignment_ind')} Handover</button>`;
  }

  function progressCell(t) {
    const p = tagProgress(t);
    if (!p.total) return '-';
    const chip = p.left ? ui.chip(p.left + ' remaining', 'warn') : ui.chip('All tagged', 'ok');
    return `<span class="mono">${p.done}/${p.total}</span> ${chip}`;
  }

  // ---------------- list ----------------
  App.registerView('#/tagging', {
    title: 'Tagging',
    render() {
      const isHQ = App.hasRole('asset_hq');
      const rows = untagged();
      const sites = (App.store.sites || []).filter(s => s.company === App.session.company);
      const projects = [...new Set(sites.map(s => s.project))];
      const orphans = untaggedAvailable();

      const kpis = `<div class="grid cols-4">
        ${ui.kpi({ label: 'Awaiting QR / tagging', value: rows.length, icon: 'qr_code_2', tone: 'warn' })}
        ${ui.kpi({ label: 'Open tagging service requests', value: taggingTickets().filter(t => t.status !== 'Completed').length, icon: 'confirmation_number' })}
        ${ui.kpi({ label: 'Site units (this company)', value: sites.length, icon: 'map', foot: projects.length + ' projects' })}
        ${ui.kpi({ label: 'QR authority', value: isHQ ? 'Central' : 'Read-only', icon: 'verified_user', tone: isHQ ? 'ok' : 'danger' })}
      </div>`;

      const notifyCallout = ui.callout('info', `p.2 item 5 (I5): <b>Accounting notifies the Asset Team</b> of each new asset so QR tagging can be tracked.`);

      const restrictCallout = isHQ
        ? ui.callout('info', `You are the <b>central Asset Team</b> - QR generation is enabled (p.2 5.1, I6).`)
        : ui.callout('warn', HQ_ONLY + '. Switch role to <b>Asset Team HQ (Central)</b> to generate QR codes.');

      const orphanCallout = orphans.length
        ? ui.callout('warn', `<b>${orphans.length} assets</b> are not tagged and not on any service request yet — click <b>Add new</b> to create a batch service request.`)
        : ui.callout('info', 'Every untagged asset is covered by an open tagging service request.');

      const tickets = ui.card({
        title: `${App.icon('confirmation_number')} Tagging service requests`,
        sub: 'One service request per area can cover many assets. Open a service request to see which items still need tagging and first record.',
        body: ui.table({
          columns: [
            { key: 'id', label: 'Service request', render: r => `<span class="mono">${r.id}</span>` },
            { key: 'title', label: 'Title', cls: 'wrap' },
            { key: 'po', label: 'PO no.', render: r => r.po ? `<span class="mono">${App.esc(r.po)}</span>` : '<span class="muted">—</span>' },
            { key: 'area', label: 'Project', render: r => App.esc(r.area || '-') },
            { key: '_n', label: 'Assets', render: r => String(App.ticketAssetIds(r).length) },
            { key: '_prog', label: 'Progress', render: r => progressCell(r) },
            { key: 'assignedTo', label: 'Assigned to', cls: 'wrap', render: r => App.esc(r.assignedTo || '-') },
            { key: 'status', label: 'Status', render: r => ui.statusChip(r.status) },
            { key: '_act', label: '', render: r => handoverActionCell(r) },
          ],
          rows: taggingTickets(),
          rowLink: r => '#/tagging/' + r.id,
          empty: 'No tagging service requests — click Add new to start.',
        }),
      });

      return ui.pageHead({
        title: 'Tagging',
        sub: 'Generate company-specific QR codes and assign tagging to a GA area or a local user. <span class="muted">p.2 items 5-8 (I5-I8), module M3</span>',
        actions: `<button type="button" class="btn" id="addNewBtn">${App.icon('add')} Add new</button>`,
      }) + kpis + notifyCallout + restrictCallout + orphanCallout + tickets;
    },
    mount(root) {
      const add = root.querySelector('#addNewBtn');
      if (add) add.onclick = () => { resetWizard(); App.navigate('#/tagging/new'); };
      root.querySelectorAll('[data-act="handover"]').forEach(b => b.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (App.startHandoverFromTagging) App.startHandoverFromTagging(b.getAttribute('data-id'));
      });
    },
  });

  // ---------------- wizard (MUST register before #/tagging/:id) ----------------
  App.registerView('#/tagging/new', {
    title: 'New tagging',
    render() {
      if (wiz.step >= TAG_STEPS.length) wiz.step = TAG_STEPS.length - 1;
      return ui.pageHead({
        title: 'New tagging',
        breadcrumb: [{ label: 'Tagging', hash: '#/tagging' }, { label: 'New tagging' }],
        sub: 'Desk work: pick area, select assets, generate QR, assign who applies the tag (p.2 items 5-7)',
        actions: ui.stepsBar(TAG_STEPS, wiz.step),
      }) + ui.card({
        title: App.icon('edit_note') + ' ' + esc(TAG_STEPS[wiz.step].title),
        sub: `Step ${wiz.step + 1} of ${TAG_STEPS.length} &mdash; ${TAG_STEPS[wiz.step].desc}`,
        body: `<form id="wizForm">${wizardStepBody()}${wizardNav()}</form>`,
      });
    },
    mount: mountWizard,
  });

  // ---------------- detail ----------------
  App.registerView('#/tagging/:id', {
    title: ctx => ctx.params.id,
    render(ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t) return ui.pageHead({ title: 'Service request not found', breadcrumb: [{ label: 'Tagging', hash: '#/tagging' }, { label: ctx.params.id }] });
      const ids = App.ticketAssetIds(t);
      const flow = App.FLOWS[t.flow] || App.FLOWS.tagging;
      const p = tagProgress(t);
      const isFinal = t.stepIndex >= flow.length - 1;
      const atTagStep = t.stepIndex === 3;

      const assetRows = ids.map(id => {
        const a = App.asset(id);
        return a ? a : { id, desc1: id, tagStatus: 'Not tagged' };
      });

      const nextScanId = ids.find(id => (App.asset(id) || {}).tagStatus !== 'Tagged');
      const printTargetId = nextScanId || ids[0];
      const isHQ = App.hasRole('asset_hq');
      const taggingDone = t.status === 'Completed' || (p.total > 0 && !p.left);
      const openHo = taggingDone && App.handoverForTagging ? App.handoverForTagging(t.id) : null;

      const headActions = `<div class="pill-row" style="justify-content:flex-end">
          <button type="button" class="btn text" id="histBtn">${App.icon('history')} History</button>
          ${printTargetId
            ? `<button type="button" class="btn tonal" id="printQrDetailBtn" data-id="${printTargetId}" ${isHQ ? '' : `disabled title="${HQ_ONLY}"`}>${App.icon('print')} Print QR code</button>`
            : ''}
          ${nextScanId
            ? `<button type="button" class="btn tonal" id="scanRecBtn" data-nav="#/scan?asset=${nextScanId}">${App.icon('photo_camera')} Scan &amp; record</button>`
            : `<button type="button" class="btn tonal" disabled title="All assets recorded">${App.icon('photo_camera')} Scan &amp; record</button>`}
          ${taggingDone
            ? (openHo
              ? `<button type="button" class="btn" data-nav="#/handover/${openHo.id}">${App.icon('assignment_ind')} Open handover ${openHo.id}</button>`
              : `<button type="button" class="btn" id="startHoBtn">${App.icon('assignment_ind')} Handover to owners</button>`)
            : ''}
        </div>`;

      const assetsCard = ui.card({
        title: `${App.icon('inventory_2')} Assets in this service request`,
        sub: `${p.done} of ${p.total} tagged` + (t.qrGeneratedAt ? ` &nbsp; QR generated ${App.fmt.datetime(t.qrGeneratedAt)}` : '')
          + (t.assignedTo ? ` &nbsp; Assigned to ${App.esc(t.assignedTo)}` : ''),
        body: ui.table({
          columns: [
            { key: 'code', label: 'Asset code', render: r => `<span class="mono">${App.esc(App.assetCode(r))}</span>` },
            { key: 'desc1', label: 'Description', cls: 'wrap', render: r => App.esc([r.desc1, r.desc2].filter(Boolean).join(' ')) },
            { key: 'owner', label: 'Owner', render: r => App.ownerLabel(r) },
            { key: 'tagStatus', label: 'Tag status', render: r => ui.statusChip(r.tagStatus) },
          ],
          rows: assetRows,
          empty: 'No assets on this service request',
        }),
      });

      let stepActions;
      if (isFinal) {
        stepActions = ui.callout('info', 'All assets tagged and first-record complete.'
          + (taggingDone ? ' Use <b>Handover to owners</b> above to send acceptance to holder(s) (p.3 item 9).' : ''));
      } else if (atTagStep) {
        stepActions = ui.callout('info', 'Use <b>Scan &amp; record</b> above for each asset. Service request completes when every item is saved (p.2 item 8).');
      } else {
        stepActions = `<button class="btn" data-act="advance">${App.icon('arrow_forward')} Advance step</button>`;
      }

      const stepper = ui.card({
        title: `${App.icon('checklist')} Tagging flow`,
        sub: 'p.2 items 5-8 - the exact process steps (I5-I8).',
        body: ui.stepper(flow, t.stepIndex) + `<div class="pill-row" style="margin-top:14px">${stepActions}</div>`,
      });

      const apptCallout = t.po
        ? ui.callout('info', `Procurement appointment for <b>${esc(t.po)}</b>${t.expectedDelivery ? ' — expected ' + App.fmt.date(t.expectedDelivery) : ''}${t.appointmentWindow ? ' (' + esc(t.appointmentWindow) + ')' : ''}${t.appointmentNotes ? '<br><span class="muted">' + esc(t.appointmentNotes) + '</span>' : ''}`)
        : '';

      return ui.pageHead({
        title: t.id + ' - ' + t.title,
        breadcrumb: [{ label: 'Tagging', hash: '#/tagging' }, { label: t.id }],
        sub: `${ui.statusChip(t.status)} &nbsp; Company ${App.esc(App.COMPANIES[t.company] || t.company)} &nbsp; Area ${App.esc(t.area || '-')}`,
        actions: headActions,
      }) + apptCallout + assetsCard + stepper;
    },
    mount(root, ctx) {
      const hist = root.querySelector('#histBtn');
      if (hist) hist.onclick = () => {
        const t = App.ticket(ctx.params.id);
        const body = (t.history && t.history.length)
          ? ui.timeline(t.history.map(h => ({ title: h.step, meta: `${App.fmt.datetime(h.ts)} - ${h.actor}${h.note ? ' - ' + h.note : ''}` })))
          : '<div class="muted">No steps recorded yet.</div>';
        ui.dialog({ title: 'History', sub: t.id, body, size: 'lg' });
      };

      const adv = root.querySelector('[data-act="advance"]');
      if (adv) adv.onclick = () => {
        const t = App.ticket(ctx.params.id);
        App.advanceTicket(t);
        ui.toast('Step advanced', 'arrow_forward');
        App.refresh();
      };

      const printQr = root.querySelector('#printQrDetailBtn');
      if (printQr) printQr.onclick = () => {
        if (!App.hasRole('asset_hq')) { ui.toast(HQ_ONLY, 'lock'); return; }
        App.printAssetQr(printQr.getAttribute('data-id'));
      };

      const startHo = root.querySelector('#startHoBtn');
      if (startHo) startHo.onclick = () => {
        if (App.startHandoverFromTagging) App.startHandoverFromTagging(ctx.params.id);
        else ui.toast('Handover module not loaded', 'error');
      };
    },
  });
})();
