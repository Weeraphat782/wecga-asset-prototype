/* Manual Registration (#/registration, #/registration/new, #/registration/:id)
   For assets NOT in SAP ("found" assets). SAP-sourced assets need NO request here.
   Coverage: p.2 sources (S2, S3, W1, W2), p.3 10.1/10.2, p.4 R1-R5.
   Reuses: App.SAP_FIELDS, App.FLOWS.registration, App.addTicket, App.advanceTicket. */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, esc = App.esc;

  const SUBCASES = {
    under2000: {
      label: 'Low value < 2,000 THB', cov: 'S2 / W1', source: 'WeCGA',
      assetClass: '9000', assetClassDesc: 'Low-value (< 2,000)',
      desc: 'Accounting does not issue a SAP Asset Code for items under 2,000 THB. The Asset unit creates the record manually in WeCGA on the WeCGA code series (p.2 S2 / W1).',
    },
    reregistered: {
      label: 'Written off in SAP but still in use', cov: 'S3', source: 'reregistered',
      assetClass: '7200', assetClassDesc: 'IT Equipment',
      desc: 'The asset was written off in SAP but is still physically in use. Re-register the still-physical asset in WeCGA so it keeps being tracked (p.2 S3).',
    },
    found: {
      label: 'Found by employee', cov: 'W2', source: 'WeCGA',
      assetClass: '9000', assetClassDesc: 'Found asset (no SAP)',
      desc: 'An employee found an asset with no SAP data and sends a request to Asset Management to register it in WeCGA (p.2 W2).',
    },
  };

  const state = { step: 0, subCase: 'under2000', mode: 'single', owner: 'person', draft: {}, preview: null };
  App._regWizard = state; // ponytail: harness self-check for draft across wizard steps

  const SINGLE_STEPS = [
    { title: 'Entry mode & sub-case', desc: 'Single or Mass Data; which found-asset source (p.2, R3)' },
    { title: 'Identity', desc: 'Description, serial, quantity (R2)', groups: ['Identity'] },
    { title: 'Accounting & Location', desc: 'Cost, NBV, PO, Lat/Long, location basis', groups: ['Accounting', 'Location'] },
    { title: 'Other details', desc: 'Optional - evaluation, vendor, life, brand', groups: ['Evaluation', 'Vendor', 'Life & Warranty', 'WeCGA'] },
    { title: 'Owner & review', desc: 'Individual or organization, then create (R2, R4)' },
  ];
  const MASS_STEPS = [
    SINGLE_STEPS[0],
    { title: 'Paste rows', desc: 'CSV columns: code, description, serial, cost, location, owner (R3, p.3 10.2)' },
    { title: 'Validate & import', desc: 'Preview parsed rows and import eligible assets' },
  ];
  const steps = () => (state.mode === 'single' ? SINGLE_STEPS : MASS_STEPS);

  function nextWecgaCode() {
    const seq = App.nextId('WECGA');
    const n = seq.split('-')[1];
    return 'WECGA-' + App.session.company + '-' + String(n).padStart(6, '0');
  }

  const subCaseChip = (key) => {
    const s = SUBCASES[key];
    return s ? ui.chip(s.label, key === 'reregistered' ? 'warn' : 'neutral') : ui.chip(key || '-', 'neutral');
  };

  function segmented(act, current, opts) {
    return `<div class="segmented" data-seg="${act}">` + opts.map(o =>
      `<button type="button" data-act="${act}" data-val="${o.val}" class="${o.val === current ? 'active' : ''}">${o.icon ? App.icon(o.icon) : ''}${esc(o.label)}</button>`
    ).join('') + `</div>`;
  }

  function capture(root) {
    if (!root) return;
    root.querySelectorAll('#wizForm [name]').forEach(el => { state.draft[el.name] = el.value; });
    if (state.draft.ownerType) state.owner = state.draft.ownerType;
  }

  function defaultFor(f) {
    const sc = SUBCASES[state.subCase];
    if (f.key === 'source') return sc.source;
    if (f.key === 'company') return App.session.company === 'AIS' ? '2900' : '2901';
    if (f.key === 'assetClass') return sc.assetClass;
    if (f.key === 'assetClassDesc') return sc.assetClassDesc;
    if (f.key === 'quantity') return '1';
    if (f.key === 'baseUnit') return 'EA';
    if (f.key === 'locationBasis') return 'SAP';
    return '';
  }

  function fieldFor(f) {
    const sc = SUBCASES[state.subCase];
    const readonly = f.key === 'wecgaCode' || f.key === 'source';
    const value = (f.key in state.draft) ? state.draft[f.key] : defaultFor(f);
    const type = f.opts ? 'select' : (f.fmt === 'date' ? 'date' : (f.num ? 'number' : 'text'));
    const opts = f.opts ? f.opts.map(o => ({ value: o, label: o === 'SAP' ? 'SAP Location' : 'Employee org (movable equipment)' })) : undefined;
    return ui.field({
      label: f.label, name: f.key, type, value, options: opts,
      attrs: readonly ? 'readonly' : '',
      hint: f.key === 'wecgaCode' ? 'Auto-generated on submit - WeCGA series, separate from SAP (R1)'
        : f.key === 'asset' ? 'Leave blank - no SAP Asset for found assets'
        : f.key === 'locationBasis' ? 'SAP Location or employee org for movable equipment (p.1 M3)' : '',
    });
  }

  function ownerBlock() {
    const ownerKind = state.draft.ownerType || state.owner;
    const typeSel = ui.field({
      label: 'Owner type', name: 'ownerType', type: 'select', value: ownerKind,
      options: [{ value: 'person', label: 'Individual (person)' }, { value: 'org', label: 'Organization' }],
      attrs: 'data-act="ownerType"',
    });
    const personFields = ownerKind === 'person'
      ? ui.field({ label: 'Owner name', name: 'ownerName', required: true, value: state.draft.ownerName || '' }) +
        ui.field({ label: 'Owner email', name: 'ownerEmail', type: 'email', required: true, value: state.draft.ownerEmail || '', hint: 'Required when owner is a person (R2)' })
      : ui.field({ label: 'Organization name', name: 'orgName', required: true, value: state.draft.orgName || '' }) +
        ui.field({ label: 'Head-of email', name: 'orgHeadEmail', type: 'email', required: true, value: state.draft.orgHeadEmail || '', hint: 'Approver for the holding organization (R2 / R4)' });
    return `<div class="field-group-title">Owner (WeCGA header - R2)</div><div class="form-grid">${typeSel}${personFields}</div>`;
  }

  function stepError() {
    const s = steps()[state.step];
    if (s.groups && s.groups.includes('Identity') && !(state.draft.desc1 || '').trim()) return 'Description 1 is required';
    if (s.groups && s.groups.includes('Accounting') && state.subCase === 'under2000') {
      const cost = Number(state.draft.cost);
      if (cost >= 2000) return 'Cost >= 2,000 - not eligible for low-value (S2/W1)';
    }
    return null;
  }

  function reviewSummary() {
    const keys = ['desc1', 'desc2', 'serial', 'cost', 'nbv', 'locationDesc', 'location', 'brand', 'model'];
    const rows = keys.filter(k => state.draft[k]).map(k => {
      const f = App.SAP_FIELDS.find(x => x.key === k);
      const lab = f ? f.label : k;
      let v = state.draft[k];
      if (k === 'cost' || k === 'nbv') v = fmt.money(Number(v));
      return `<dt>${esc(lab)}</dt><dd>${esc(v)}</dd>`;
    }).join('');
    if (!rows) return ui.callout('info', 'Fill in the steps above to see a summary here.');
    return `<dl class="kv" style="grid-template-columns:auto 1fr;margin-top:12px">${rows}</dl>`;
  }

  function entryStepBody() {
    const sc = SUBCASES[state.subCase];
    return `<div class="field-group-title">Entry mode (R3)</div>
      ${segmented('mode', state.mode, [
        { val: 'single', label: 'Single item', icon: 'note_add' },
        { val: 'mass', label: 'Mass Data', icon: 'table_view' },
      ])}
      <div class="field-group-title" style="margin-top:18px">Sub-case (p.2 found-asset sources)</div>
      ${segmented('subCase', state.subCase, [
        { val: 'under2000', label: 'Low value < 2,000 THB' },
        { val: 'reregistered', label: 'Written off in SAP, still in use' },
        { val: 'found', label: 'Found by employee' },
      ])}
      ${ui.callout('info', `<b>${esc(sc.cov)}</b> &mdash; ${esc(sc.desc)}`)}`;
  }

  function groupsStepBody(s) {
    return (s.groups || []).map(g => {
      const fields = App.SAP_FIELDS.filter(f => f.group === g);
      return `<div class="field-group-title">${esc(g)}</div><div class="form-grid">${fields.map(fieldFor).join('')}</div>`;
    }).join('');
  }

  function parseMass(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const p = line.split(',').map(s => (s || '').trim());
      const [code, desc, serial, cost, location, owner] = p;
      const c = Number(cost) || 0;
      const issues = [];
      let valid = true;
      if (!desc) { issues.push('missing description'); valid = false; }
      if (state.subCase === 'under2000' && c >= 2000) { issues.push('Cost >= 2,000 - not eligible for low-value (S2/W1)'); valid = false; }
      if (!serial) issues.push('no serial (warning)');
      return { code, desc, serial, cost: c, location, owner, valid, issues };
    });
  }

  function rowStatusChip(r) {
    if (!r.valid) return ui.chip(r.issues[0] || 'Invalid', 'danger');
    if (r.issues.length) return ui.chip('Warning: ' + r.issues[0], 'warn');
    return ui.chip('OK', 'ok');
  }

  function massPasteBody() {
    const sample = 'FAN-01,Office Fan Hatari 16",HT-16-9001,690,ABC_BKK_HQ_5F,Wanida Employee\nLAMP-02,Desk Lamp LED,,450,ABC_BKK_HQ_5F,General Admin\nBADKB,Keyboard over budget,KB-9,2500,ABC_BKK_HQ_9F,Kittipong IT';
    const val = state.draft.massText || '';
    return ui.field({
      label: 'Paste rows', name: 'massText', type: 'textarea', value: val, rows: 8,
      hint: 'Low-value case flags any cost &ge; 2,000 THB as not eligible; missing serial is a warning.',
      attrs: `placeholder="${esc(sample)}"`,
    });
  }

  function massValidateBody() {
    const lines = (state.draft.massText || '').split('\n').map(l => l.trim()).filter(Boolean).length;
    let body = ui.callout('info', `<b>${lines}</b> row(s) pasted. Click Validate to preview before import.`);
    if (state.preview && state.preview.length) {
      const validN = state.preview.filter(r => r.valid).length;
      body += ui.table({
        columns: [
          { key: '_n', label: '#', render: (r) => String(state.preview.indexOf(r) + 1) },
          { key: 'code', label: 'Code' },
          { key: 'desc', label: 'Description', cls: 'wrap' },
          { key: 'serial', label: 'Serial' },
          { key: 'cost', label: 'Cost', cls: 'num', render: (r) => fmt.money(r.cost) },
          { key: 'location', label: 'Location' },
          { key: 'owner', label: 'Owner' },
          { key: '_st', label: 'Validation', render: rowStatusChip },
        ],
        rows: state.preview,
        empty: 'Nothing parsed',
      }) + `<div class="pill-row" style="margin-top:14px">
        <button type="button" class="btn" id="importBtn" ${validN ? '' : 'disabled'}>${App.icon('upload')} Import ${validN} valid row${validN === 1 ? '' : 's'}</button>
        <span class="hint">${state.preview.length} parsed, ${validN} eligible.</span>
      </div>`;
    } else {
      body += `<div class="pill-row" style="margin-top:14px"><button type="button" class="btn tonal" id="validateBtn">${App.icon('fact_check')} Validate & preview</button></div>`;
    }
    return body;
  }

  function wizardStepBody() {
    const s = steps()[state.step];
    if (state.step === 0) return entryStepBody();
    if (state.mode === 'mass') {
      if (state.step === 1) return massPasteBody();
      return massValidateBody();
    }
    if (s.groups) return groupsStepBody(s);
    return ownerBlock() + `<div class="field-group-title">Review</div>${reviewSummary()}
      <p class="hint" style="margin-top:12px">Source: <b>${esc(SUBCASES[state.subCase].source)}</b>; WeCGA code issued on submit (R1).</p>`;
  }

  function wizardNav() {
    const last = steps().length - 1;
    const isLast = state.step === last;
    let btns = `<button type="button" class="btn text" id="wizCancel">${App.icon('close')} Cancel</button>`;
    if (state.step > 0) btns += ` <button type="button" class="btn tonal" id="wizBack">${App.icon('arrow_back')} Back</button>`;
    if (!isLast) btns += ` <button type="button" class="btn" id="wizNext">${App.icon('arrow_forward')} Next</button>`;
    else if (state.mode === 'single') btns += ` <button type="button" class="btn" id="wizCreate">${App.icon('check')} Create asset & open Registration service request</button>`;
    return `<div class="pill-row" style="margin-top:22px;justify-content:flex-end">${btns}</div>`;
  }

  function mountWizard(root) {
    root.querySelectorAll('[data-act="subCase"]').forEach(b => b.onclick = () => {
      capture(root); state.subCase = b.getAttribute('data-val'); state.preview = null; App.refresh();
    });
    root.querySelectorAll('[data-act="mode"]').forEach(b => b.onclick = () => {
      capture(root); state.mode = b.getAttribute('data-val'); state.preview = null;
      if (state.step >= steps().length) state.step = steps().length - 1;
      App.refresh();
    });
    const ot = root.querySelector('[data-act="ownerType"]');
    if (ot) ot.onchange = () => { capture(root); state.owner = ot.value; App.refresh(); };

    const cancel = root.querySelector('#wizCancel');
    if (cancel) cancel.onclick = () => { state.step = 0; state.draft = {}; state.preview = null; App.navigate('#/registration'); };

    const back = root.querySelector('#wizBack');
    if (back) back.onclick = () => { capture(root); state.step--; App.refresh(); };

    const next = root.querySelector('#wizNext');
    if (next) next.onclick = () => {
      capture(root);
      const err = stepError();
      if (err) { ui.toast(err, 'error'); return; }
      state.step++;
      App.refresh();
    };

    const create = root.querySelector('#wizCreate');
    if (create) create.onclick = () => { capture(root); submitSingle(); };

    const vBtn = root.querySelector('#validateBtn');
    if (vBtn) vBtn.onclick = () => {
      capture(root);
      state.preview = parseMass(state.draft.massText || '');
      App.refresh();
    };
    const iBtn = root.querySelector('#importBtn');
    if (iBtn) iBtn.onclick = () => importMass();
  }

  function resetWizard() {
    state.step = 0; state.draft = {}; state.preview = null;
    state.subCase = 'under2000'; state.mode = 'single'; state.owner = 'person';
  }

  // ---------------- list ----------------
  App.registerView('#/registration', {
    title: 'Manual Registration',
    render() {
      const regTickets = App.store.tickets.filter(t => t.type === 'Registration');
      const intro = ui.callout('info',
        'Assets that come from <b>SAP need NO registration here</b> &mdash; they are already on the SAP Asset code series and only need QR tagging. '
        + 'This screen is <b>only for found assets with no SAP data</b> (p.2). WeCGA issues its <b>own Asset Code series</b>, separate from SAP '
        + '(<span class="mono">WECGA-' + esc(App.session.company) + '-000005</span>, requirement R1).');
      const ticketsCard = ui.card({
        title: App.icon('confirmation_number') + ' Registration service requests',
        sub: 'Existing found-asset registrations, incl. seeded TK-0003 (low-value) and TK-0004 (re-registered).',
        body: ui.table({
          columns: [
            { key: 'id', label: 'Service request' },
            { key: 'title', label: 'Title', cls: 'wrap' },
            { key: 'subCase', label: 'Sub-case', render: (r) => subCaseChip(r.subCase) },
            { key: 'status', label: 'Status', render: (r) => ui.statusChip(r.status) },
            { key: 'created', label: 'Created', render: (r) => fmt.date(r.created) },
          ],
          rows: regTickets,
          rowLink: (r) => '#/registration/' + r.id,
          empty: 'No registration service requests yet — click Add new to start.',
        }),
      });
      return ui.pageHead({
        title: 'Manual Registration',
        sub: 'Found assets not in SAP &mdash; low-value, written-off-still-in-use, or employee-found (p.2 &bull; p.3 10.1/10.2 &bull; p.4 R1-R5).',
        actions: `<button type="button" class="btn" id="addNewBtn">${App.icon('add')} Add new</button>`,
      }) + intro + ticketsCard;
    },
    mount(root) {
      const btn = root.querySelector('#addNewBtn');
      if (btn) btn.onclick = () => { resetWizard(); App.navigate('#/registration/new'); };
    },
  });

  // ---------------- wizard (MUST register before #/registration/:id) ----------------
  App.registerView('#/registration/new', {
    title: 'New registration',
    render() {
      const flow = steps();
      if (state.step >= flow.length) state.step = flow.length - 1;
      return ui.pageHead({
        title: 'New registration',
        breadcrumb: [{ label: 'Manual Registration', hash: '#/registration' }, { label: 'New registration' }],
        sub: `${state.mode === 'single' ? 'Single item' : 'Mass Data'} &mdash; ${esc(SUBCASES[state.subCase].label)}`,
        actions: ui.stepsBar(flow, state.step),
      }) + ui.card({
        title: App.icon('edit_note') + ' ' + esc(flow[state.step].title),
        sub: `Step ${state.step + 1} of ${flow.length} &mdash; ${flow[state.step].desc}`,
        body: `<form id="wizForm">${wizardStepBody()}${wizardNav()}</form>`,
      });
    },
    mount: mountWizard,
  });

  function submitSingle() {
    const g = (name) => (state.draft[name] || '').trim();
    const sc = SUBCASES[state.subCase];
    const ownerKind = state.draft.ownerType || state.owner;

    if (!g('desc1')) { ui.toast('Description 1 is required', 'error'); return; }
    if (state.subCase === 'under2000' && Number(g('cost')) >= 2000) {
      ui.toast('Cost >= 2,000 - not eligible for low-value (S2/W1)', 'error'); return;
    }
    let owner;
    if (ownerKind === 'person') {
      if (!g('ownerName') || !g('ownerEmail')) { ui.toast('Owner name & email are required', 'error'); return; }
      owner = { type: 'person', name: g('ownerName'), email: g('ownerEmail') };
    } else {
      if (!g('orgName') || !g('orgHeadEmail')) { ui.toast('Organization name & head-of email are required', 'error'); return; }
      owner = { type: 'org', name: g('orgName'), email: g('orgHeadEmail') };
    }

    const asset = { id: App.nextId('A'), source: sc.source, companyCode: App.session.company, wecgaCode: nextWecgaCode() };
    App.SAP_FIELDS.forEach(f => {
      if (f.key === 'wecgaCode' || f.key === 'source') return;
      let v = g(f.key);
      if (v === '') return;
      if (f.num) v = Number(v);
      asset[f.key] = v;
    });
    asset.assetClass = asset.assetClass || sc.assetClass;
    asset.assetClassDesc = asset.assetClassDesc || sc.assetClassDesc;
    asset.owner = owner;
    if (owner.type === 'org') { asset.orgName = owner.name; asset.orgHeadEmail = owner.email; }
    asset.tagStatus = 'Not tagged';
    asset.countStatus = 'Not counted';
    asset.photos = [];
    App.store.assets.push(asset);

    const t = App.addTicket({
      type: 'Registration', flow: 'registration', subCase: state.subCase,
      title: 'Manual registration - ' + (asset.desc1 || App.assetCode(asset)) + ' (' + sc.label + ')',
      assetId: asset.id, area: App.currentUser() ? App.currentUser().area : undefined,
      status: 'Open',
    });
    resetWizard();
    ui.toast('Registered ' + asset.wecgaCode + ' - service request ' + t.id, 'note_add');
    App.navigate('#/registration/' + t.id);
  }

  function importMass() {
    const rows = (state.preview || []).filter(r => r.valid);
    if (!rows.length) return;
    const sc = SUBCASES[state.subCase];
    let firstId = null;
    rows.forEach(r => {
      const asset = {
        id: App.nextId('A'), source: sc.source, companyCode: App.session.company,
        wecgaCode: nextWecgaCode(), assetClass: sc.assetClass, assetClassDesc: sc.assetClassDesc,
        company: App.session.company === 'AIS' ? '2900' : '2901', quantity: 1, baseUnit: 'EA',
        desc1: r.desc, serial: r.serial, cost: r.cost, accum: 0, nbv: r.cost,
        locationDesc: r.location,
        owner: { type: 'person', name: r.owner || 'Unassigned', email: '' },
        tagStatus: 'Not tagged', countStatus: 'Not counted', photos: [],
      };
      App.store.assets.push(asset);
      if (!firstId) firstId = asset.id;
    });
    const t = App.addTicket({
      type: 'Registration', flow: 'registration', subCase: state.subCase,
      title: 'Mass registration - ' + rows.length + ' ' + sc.label + ' item' + (rows.length === 1 ? '' : 's'),
      assetId: firstId, massCount: rows.length, status: 'Open',
    });
    resetWizard();
    ui.toast('Imported ' + rows.length + ' assets - service request ' + t.id, 'upload');
    App.navigate('#/registration/' + t.id);
  }

  // ---------------- detail ----------------
  const STEP_ACTIONS = [
    { label: 'GA: print QR & verify', icon: 'qr_code_2', roles: ['ga', 'asset_hq'] },
    { label: 'Supervisor / Head-of approve', icon: 'approval', roles: ['employee', 'asset_hq'] },
    { label: 'Confirm stored in WeCGA', icon: 'inventory_2', roles: ['asset_hq'] },
  ];

  App.registerView('#/registration/:id', {
    title: (ctx) => App.ticket(ctx.params.id) ? App.ticket(ctx.params.id).id : 'Registration',
    render(ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t || t.type !== 'Registration') return ui.pageHead({ title: 'Registration service request not found' })
        + ui.callout('warn', 'No registration service request <span class="mono">' + esc(ctx.params.id) + '</span>');
      const a = App.asset(t.assetId);
      const flow = App.FLOWS.registration;
      const done = t.stepIndex >= flow.length - 1;

      const summary = a ? ui.card({
        title: App.icon('inventory_2') + ' Asset summary',
        body: `<dl class="kv" style="grid-template-columns:auto 1fr">
          <dt>WeCGA Code</dt><dd class="mono">${esc(a.wecgaCode || App.assetCode(a))}</dd>
          <dt>SAP Asset</dt><dd>${a.asset ? esc(a.asset) : '<span class="muted">none - not in SAP (R5)</span>'}</dd>
          <dt>Description</dt><dd>${esc([a.desc1, a.desc2].filter(Boolean).join(' '))}</dd>
          <dt>Source</dt><dd>${esc(a.source)}</dd>
          <dt>Serial / Car</dt><dd>${esc(a.serial || a.carNumber || '-')}</dd>
          <dt>Cost / NBV</dt><dd>${fmt.money(a.cost)} / ${fmt.money(a.nbv)}</dd>
          <dt>Location</dt><dd>${esc(a.locationDesc || a.location || '-')}</dd>
          <dt>Owner</dt><dd>${esc(App.ownerLabel(a))} ${a.owner && a.owner.email ? '&lt;' + esc(a.owner.email) + '&gt;' : ''}</dd>
        </dl>`,
        actions: `<button class="btn text sm" data-nav="#/assets/${a.id}">Open in register</button>`,
      }) : ui.callout('warn', 'Linked asset missing.');

      const action = done ? '' : STEP_ACTIONS[t.stepIndex];
      const canAct = action && App.hasRole.apply(null, action.roles);
      const actionCard = ui.card({
        title: App.icon('play_arrow') + ' Next action (R4 approval flow)',
        body: done
          ? ui.callout('info', 'Completed &mdash; <b>stored in WeCGA</b>. No SAP registration; kept on the WeCGA code series (R5).')
          : `<div class="step-desc" style="margin-bottom:12px">Current step: <b>${esc(flow[t.stepIndex].title)}</b> &mdash; ${esc(flow[t.stepIndex].desc)}</div>`
            + `<div class="pill-row">
                <button class="btn" id="advBtn" data-id="${t.id}" ${canAct ? '' : 'disabled'}>${App.icon(action.icon)} ${esc(action.label)}</button>
                ${canAct ? '' : `<span class="hint">Switch role to <b>${esc(action.roles.join(' / '))}</b> to act.</span>`}
              </div>`,
      });

      const qrCard = ui.card({
        title: App.icon('qr_code_2') + ' WeCGA tag',
        sub: 'Printed by GA at the "GA prints QR + GA Verify" step (R4).',
        body: `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">${ui.qr(a ? App.assetCode(a) : t.id)}
          <div>${ui.callout('info', '<b>No SAP registration</b> &mdash; kept in the WeCGA database on the WeCGA code series (R5).')}</div></div>`,
      });

      return ui.pageHead({
        title: t.id + ' - Registration',
        breadcrumb: [{ label: 'Manual Registration', hash: '#/registration' }, { label: t.id }],
        sub: `${subCaseChip(t.subCase)} ${ui.statusChip(t.status)} ${t.massCount ? ui.chip(t.massCount + ' items (mass)', 'info') : ''}`,
      })
      + `<div class="grid cols-2" style="align-items:start"><div>${summary}${actionCard}</div>`
      + `<div>${ui.card({
          title: App.icon('checklist') + ' Registration flow (p.4 R4)',
          sub: 'Employee submits &rarr; GA prints QR + verify &rarr; Supervisor/Head-of approval &rarr; Store in WeCGA (not in SAP).',
          body: ui.stepper(flow, t.stepIndex),
        })}${qrCard}</div></div>`;
    },
    mount(root) {
      const b = root.querySelector('#advBtn');
      if (b && !b.disabled) b.onclick = () => {
        const t = App.ticket(b.getAttribute('data-id'));
        if (!t) return;
        App.advanceTicket(t, 'Advanced from Manual Registration');
        ui.toast('Step advanced', 'check');
        App.refresh();
      };
    },
  });
})();
