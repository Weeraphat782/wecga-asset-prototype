/* Manual Registration (#/registration) + detail (#/registration/:id)
   For assets NOT in SAP ("found" assets). SAP-sourced assets need NO request here.
   Coverage: p.2 sources (S2 low-value, S3 written-off-still-in-use, W1 accounting-no-code,
             W2 employee-found), p.3 item 10.1/10.2 (single OR mass create),
             p.4 requirements R1 (WeCGA own code series, separate from SAP),
             R2 (WeCGA header == SAP header), R3 (single/mass), R4 (approval flow),
             R5 (kept in WeCGA, no SAP registration).
   Reuses: App.SAP_FIELDS, App.FLOWS.registration, App.addTicket, App.advanceTicket,
           App.nextId, App.assetCode, App.assetTitle, App.ownerLabel. */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, esc = App.esc;

  // ---- the three found-asset sub-cases (p.2 sources) ----
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

  const state = { subCase: 'under2000', mode: 'single', owner: 'person', preview: null };

  const GROUPS = [...new Set(App.SAP_FIELDS.map(f => f.group))];

  // WeCGA own series (R1). Reuse App.nextId to advance the shared WECGA sequence,
  // then format as WECGA-<COMPANY>-000005 to match the seeded codes.
  function nextWecgaCode() {
    const seq = App.nextId('WECGA');            // e.g. "WECGA-0005" (advances App.store.seq.WECGA)
    const n = seq.split('-')[1];
    return 'WECGA-' + App.session.company + '-' + String(n).padStart(6, '0');
  }

  const subCaseChip = (key) => {
    const s = SUBCASES[key];
    return s ? ui.chip(s.label, key === 'reregistered' ? 'warn' : 'neutral') : ui.chip(key || '-', 'neutral');
  };

  // ---------------- segmented controls ----------------
  function segmented(act, current, opts) {
    return `<div class="segmented" data-seg="${act}">` + opts.map(o =>
      `<button data-act="${act}" data-val="${o.val}" class="${o.val === current ? 'active' : ''}">${o.icon ? App.icon(o.icon) : ''}${esc(o.label)}</button>`
    ).join('') + `</div>`;
  }

  // ---------------- single-item form (R2: WeCGA header == SAP header) ----------------
  function fieldFor(f) {
    const sc = SUBCASES[state.subCase];
    const readonly = f.key === 'wecgaCode' || f.key === 'source';
    let value = '';
    if (f.key === 'source') value = sc.source;
    else if (f.key === 'company') value = App.session.company === 'AIS' ? '2900' : '2901';
    else if (f.key === 'assetClass') value = sc.assetClass;
    else if (f.key === 'assetClassDesc') value = sc.assetClassDesc;
    else if (f.key === 'quantity') value = 1;
    else if (f.key === 'baseUnit') value = 'EA';
    const type = f.fmt === 'date' ? 'date' : (f.num ? 'number' : 'text');
    return ui.field({
      label: f.label, name: f.key, type, value,
      attrs: readonly ? 'readonly' : '',
      hint: f.key === 'wecgaCode' ? 'Auto-generated on submit - WeCGA series, separate from SAP (R1)'
        : f.key === 'asset' ? 'Leave blank - no SAP Asset for found assets' : '',
    });
  }

  function ownerBlock() {
    const typeSel = ui.field({
      label: 'Owner type', name: 'ownerType', type: 'select', value: state.owner,
      options: [{ value: 'person', label: 'Individual (person)' }, { value: 'org', label: 'Organization' }],
      attrs: 'data-act="ownerType"',
    });
    const personFields = state.owner === 'person'
      ? ui.field({ label: 'Owner name', name: 'ownerName', required: true }) +
        ui.field({ label: 'Owner email', name: 'ownerEmail', type: 'email', required: true, hint: 'Required when owner is a person (R2)' })
      : ui.field({ label: 'Organization name', name: 'orgName', required: true }) +
        ui.field({ label: 'Head-of email', name: 'orgHeadEmail', type: 'email', required: true, hint: 'Approver for the holding organization (R2 / R4)' });
    return `<div class="field-group-title">Owner (WeCGA header - R2)</div><div class="form-grid">${typeSel}${personFields}</div>`;
  }

  function singleForm() {
    const groupsHtml = GROUPS.map(g => {
      const fields = App.SAP_FIELDS.filter(f => f.group === g);
      return `<div class="field-group-title">${esc(g)}</div><div class="form-grid">${fields.map(fieldFor).join('')}</div>`;
    }).join('');
    return ui.card({
      title: App.icon('note_add') + ' Single item &mdash; header matches SAP exactly (R2)',
      sub: 'Every SAP field from the 33-field register is reused verbatim so Generate / Query / Sort stay identical (p.4 R2).',
      body: `<form id="regForm">${groupsHtml}${ownerBlock()}
        <div class="pill-row" style="margin-top:18px">
          <button type="button" class="btn" id="createBtn">${App.icon('check')} Create asset & open Registration ticket</button>
          <span class="hint">Source will be set to <b>${esc(SUBCASES[state.subCase].source)}</b>; a WeCGA code is issued on submit.</span>
        </div></form>`,
    });
  }

  // ---------------- mass data (R3: create single OR mass) ----------------
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

  function massForm() {
    const sample = 'FAN-01,Office Fan Hatari 16",HT-16-9001,690,ABC_BKK_HQ_5F,Wanida Employee\nLAMP-02,Desk Lamp LED,,450,ABC_BKK_HQ_5F,General Admin\nBADKB,Keyboard over budget,KB-9,2500,ABC_BKK_HQ_9F,Kittipong IT';
    let preview = '';
    if (state.preview && state.preview.length) {
      const validN = state.preview.filter(r => r.valid).length;
      preview = ui.table({
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
        <span class="hint">${state.preview.length} parsed, ${validN} eligible. Ineligible rows are skipped.</span>
      </div>`;
    }
    return ui.card({
      title: App.icon('table_view') + ' Mass Data &mdash; paste rows (R3, p.3 10.2)',
      sub: 'CSV columns: <span class="mono">code,description,serial,cost,location,owner</span>',
      body: `<div class="field">
          <label for="massText">Paste rows</label>
          <textarea id="massText" name="massText" rows="6" placeholder="${esc(sample)}"></textarea>
          <span class="hint">Low-value case flags any cost &ge; 2,000 THB as not eligible; missing serial is a warning.</span>
        </div>
        <div class="pill-row"><button type="button" class="btn tonal" id="validateBtn">${App.icon('fact_check')} Validate & preview</button></div>
        ${preview}`,
    });
  }

  // ---------------- main screen ----------------
  App.registerView('#/registration', {
    title: 'Manual Registration',
    render() {
      const regTickets = App.store.tickets.filter(t => t.type === 'Registration');
      const sc = SUBCASES[state.subCase];

      const intro = ui.callout('info',
        'Assets that come from <b>SAP need NO registration here</b> &mdash; they are already on the SAP Asset code series and only need QR tagging. '
        + 'This screen is <b>only for found assets with no SAP data</b> (p.2). WeCGA issues its <b>own Asset Code series</b>, separate from SAP '
        + '(<span class="mono">WECGA-' + esc(App.session.company) + '-000005</span>, requirement R1).');

      const subCaseBar = ui.card({
        title: App.icon('rule') + ' Sub-case (p.2 found-asset sources)',
        body: segmented('subCase', state.subCase, [
          { val: 'under2000', label: 'Low value < 2,000 THB' },
          { val: 'reregistered', label: 'Written off in SAP, still in use' },
          { val: 'found', label: 'Found by employee' },
        ]) + ui.callout('info', `<b>${esc(sc.cov)}</b> &mdash; ${esc(sc.desc)}`),
      });

      const modeBar = `<div class="pill-row" style="margin:0 0 14px">
        <span class="hint">Entry mode (R3 &mdash; create single OR mass):</span>
        ${segmented('mode', state.mode, [
          { val: 'single', label: 'Single item', icon: 'note_add' },
          { val: 'mass', label: 'Mass Data', icon: 'table_view' },
        ])}</div>`;

      const ticketsCard = ui.card({
        title: App.icon('confirmation_number') + ' Registration tickets',
        sub: 'Existing found-asset registrations, incl. seeded TK-0003 (low-value) and TK-0004 (re-registered).',
        body: ui.table({
          columns: [
            { key: 'id', label: 'Ticket' },
            { key: 'title', label: 'Title', cls: 'wrap' },
            { key: 'subCase', label: 'Sub-case', render: (r) => subCaseChip(r.subCase) },
            { key: 'status', label: 'Status', render: (r) => ui.statusChip(r.status) },
            { key: 'created', label: 'Created', render: (r) => fmt.date(r.created) },
          ],
          rows: regTickets,
          rowLink: (r) => '#/registration/' + r.id,
          empty: 'No registration tickets yet',
        }),
      });

      return ui.pageHead({
        title: 'Manual Registration',
        sub: 'Found assets not in SAP &mdash; low-value, written-off-still-in-use, or employee-found (p.2 &bull; p.3 10.1/10.2 &bull; p.4 R1-R5).',
      }) + intro + subCaseBar + modeBar + (state.mode === 'single' ? singleForm() : massForm()) + ticketsCard;
    },
    mount(root) {
      // segmented controls -> update state + re-render
      root.querySelectorAll('[data-act="subCase"]').forEach(b => b.onclick = () => { state.subCase = b.getAttribute('data-val'); state.preview = null; App.refresh(); });
      root.querySelectorAll('[data-act="mode"]').forEach(b => b.onclick = () => { state.mode = b.getAttribute('data-val'); App.refresh(); });
      const ot = root.querySelector('[data-act="ownerType"]');
      if (ot) ot.onchange = (e) => { state.owner = e.target.value; App.refresh(); };

      // single item create
      const createBtn = root.querySelector('#createBtn');
      if (createBtn) createBtn.onclick = () => submitSingle(root);

      // mass validate / import
      const vBtn = root.querySelector('#validateBtn');
      if (vBtn) vBtn.onclick = () => {
        const ta = root.querySelector('#massText');
        state.preview = parseMass(ta ? ta.value : '');
        App.refresh();
      };
      const iBtn = root.querySelector('#importBtn');
      if (iBtn) iBtn.onclick = () => importMass();
    },
  });

  function submitSingle(root) {
    const form = root.querySelector('#regForm');
    if (!form) return;
    const g = (name) => { const el = form.elements[name]; return el ? el.value.trim() : ''; };
    const sc = SUBCASES[state.subCase];

    if (!g('desc1')) { ui.toast('Description 1 is required', 'error'); return; }
    let owner;
    if (state.owner === 'person') {
      if (!g('ownerName') || !g('ownerEmail')) { ui.toast('Owner name & email are required', 'error'); return; }
      owner = { type: 'person', name: g('ownerName'), email: g('ownerEmail') };
    } else {
      if (!g('orgName') || !g('orgHeadEmail')) { ui.toast('Organization name & head-of email are required', 'error'); return; }
      owner = { type: 'org', name: g('orgName'), email: g('orgHeadEmail') };
    }

    const a = { id: App.nextId('A'), source: sc.source, companyCode: App.session.company, wecgaCode: nextWecgaCode() };
    App.SAP_FIELDS.forEach(f => {
      if (f.key === 'wecgaCode' || f.key === 'source') return;
      let v = g(f.key);
      if (v === '') return;
      if (f.num) v = Number(v);
      a[f.key] = v;
    });
    a.assetClass = a.assetClass || sc.assetClass;
    a.assetClassDesc = a.assetClassDesc || sc.assetClassDesc;
    a.owner = owner;
    if (owner.type === 'org') { a.orgName = owner.name; a.orgHeadEmail = owner.email; }
    a.tagStatus = 'Not tagged';
    a.countStatus = 'Not counted';
    a.photos = [];
    App.store.assets.push(a);

    const t = App.addTicket({
      type: 'Registration', flow: 'registration', subCase: state.subCase,
      title: 'Manual registration - ' + (a.desc1 || App.assetCode(a)) + ' (' + sc.label + ')',
      assetId: a.id, area: App.currentUser() ? App.currentUser().area : undefined,
      status: 'Open',
    });
    ui.toast('Registered ' + a.wecgaCode + ' - ticket ' + t.id, 'note_add');
    App.navigate('#/registration/' + t.id);
  }

  function importMass() {
    const rows = (state.preview || []).filter(r => r.valid);
    if (!rows.length) return;
    const sc = SUBCASES[state.subCase];
    let firstId = null;
    rows.forEach(r => {
      const a = {
        id: App.nextId('A'), source: sc.source, companyCode: App.session.company,
        wecgaCode: nextWecgaCode(), assetClass: sc.assetClass, assetClassDesc: sc.assetClassDesc,
        company: App.session.company === 'AIS' ? '2900' : '2901', quantity: 1, baseUnit: 'EA',
        desc1: r.desc, serial: r.serial, cost: r.cost, accum: 0, nbv: r.cost,
        locationDesc: r.location,
        owner: { type: 'person', name: r.owner || 'Unassigned', email: '' },
        tagStatus: 'Not tagged', countStatus: 'Not counted', photos: [],
      };
      App.store.assets.push(a);
      if (!firstId) firstId = a.id;
    });
    const t = App.addTicket({
      type: 'Registration', flow: 'registration', subCase: state.subCase,
      title: 'Mass registration - ' + rows.length + ' ' + sc.label + ' item' + (rows.length === 1 ? '' : 's'),
      assetId: firstId, massCount: rows.length, status: 'Open',
    });
    state.preview = null;
    ui.toast('Imported ' + rows.length + ' assets - ticket ' + t.id, 'upload');
    App.navigate('#/registration/' + t.id);
  }

  // ---------------- detail ----------------
  // current stepIndex -> the action that advances to the next flow step (R4)
  const STEP_ACTIONS = [
    { label: 'GA: print QR & verify', icon: 'qr_code_2', roles: ['ga', 'asset_hq'] },
    { label: 'Supervisor / Head-of approve', icon: 'approval', roles: ['employee', 'asset_hq'] },
    { label: 'Confirm stored in WeCGA', icon: 'inventory_2', roles: ['asset_hq'] },
  ];

  App.registerView('#/registration/:id', {
    title: (ctx) => App.ticket(ctx.params.id) ? App.ticket(ctx.params.id).id : 'Registration',
    render(ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t || t.type !== 'Registration') return ui.pageHead({ title: 'Registration ticket not found' })
        + ui.callout('warn', 'No registration ticket <span class="mono">' + esc(ctx.params.id) + '</span>');
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
