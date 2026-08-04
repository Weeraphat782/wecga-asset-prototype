/* Inventory Counts (#/counts) + Count Plan progress (#/counts/:id)
   Covers: M5 (inventory count module), W4 (GA/RO can open a special ad-hoc RO
   round independent of the annual count), CT1 (annual nationwide simultaneous
   count), CT2 (ad-hoc count by location / asset type / holder), CP1 (create the
   count plan - p.10 item 3.1).
   Reuses App.assetCode / App.assetTitle / App.ownerLabel / App.exportRows. */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, esc = App.esc;

  // 6 count outcomes (p.10 item 3.4) - shared visual vocabulary.
  const OUTCOME = {
    found_ok:      { label: 'Found - OK',          kind: 'ok' },
    found_wrong:   { label: 'Found - wrong info',  kind: 'warn' },
    not_in_sap:    { label: 'Found - not in SAP',  kind: 'warn' },
    found_damaged: { label: 'Found - damaged',     kind: 'danger' },
    not_found:     { label: 'Not found - lost',    kind: 'danger' },
    moved:         { label: 'Moved elsewhere',     kind: 'info' },
  };
  const outcomeChip = (o) => o && OUTCOME[o] ? ui.chip(OUTCOME[o].label, OUTCOME[o].kind) : '<span class="muted">-</span>';

  const typeChip = (t) => t === 'annual'
    ? ui.chip('Annual (nationwide)', 'info')
    : ui.chip('Ad-hoc', 'neutral');

  const plansForCompany = () => App.store.countPlans.filter(p => p.company === App.session.company);
  const assetsForCompany = () => App.store.assets.filter(a => a.companyCode === App.session.company);

  // Compute the assigned asset ids from the chosen scope (CT1 / CT2).
  function computeAssigned(type, scopeKind, value) {
    const all = assetsForCompany();
    if (type === 'annual') return all.map(a => a.id);      // CT1: nationwide, everything
    if (!value) return [];
    const v = String(value).toLowerCase();
    return all.filter(a => {
      if (scopeKind === 'location') return String(a.area || '').toLowerCase() === v || String(a.locationDesc || '').toLowerCase().includes(v);
      if (scopeKind === 'type')     return String(a.assetClassDesc || '').toLowerCase() === v || String(a.assetClass || '') === value;
      if (scopeKind === 'holder')   return String((a.owner && a.owner.name) || '').toLowerCase() === v;
      return false;
    }).map(a => a.id);
  }

  /* ------------------------------------------------------------------ */
  /* #/counts - list of count plans + create plan (CP1, CT1, CT2, W4)   */
  /* ------------------------------------------------------------------ */
  App.registerView('#/counts', {
    title: 'Inventory Counts',
    render() {
      const plans = plansForCompany();
      const rows = plans.map(p => ({
        p,
        counted: (p.assignedAssets || []).map(App.asset).filter(a => a && a.countStatus !== 'Not counted').length,
        assigned: (p.assignedAssets || []).length,
      }));

      const table = ui.table({
        columns: [
          { key: 'name', label: 'Plan', render: r => `<b>${esc(r.p.name)}</b><div class="muted mono" style="font-size:12px">${esc(r.p.id)}</div>` },
          { key: 'type', label: 'Type', render: r => typeChip(r.p.type) },
          { key: 'status', label: 'Status', render: r => ui.statusChip(r.p.status) },
          { key: 'window', label: 'Window', render: r => `${fmt.date(r.p.start)} &rarr; ${fmt.date(r.p.end)}` },
          { key: 'scope', label: 'Scope', cls: 'wrap', render: r => esc(r.p.scopeDesc || '-') },
          { key: 'prog', label: 'Progress', cls: 'num', render: r => `${r.counted}/${r.assigned}` },
        ],
        rows,
        rowLink: r => '#/counts/' + r.p.id,
        empty: 'No count plans for this company yet',
      });

      return ui.pageHead({
        title: 'Inventory Counts',
        sub: 'Annual and ad-hoc counting rounds (p.10 item 3.1). <span class="muted">Modules M5, W4 - GA/RO may open a special RO round independent of the annual count.</span>',
        actions: `<button class="btn" id="newPlan">${App.icon('add')} Create count plan</button>`,
      })
      + ui.callout('info', 'A count plan defines <b>who counts what, where and when</b>. <b>CT1</b> Annual = nationwide, all assets, simultaneous. <b>CT2</b> Ad-hoc = scoped by Location / Asset type / Holder. <b>W4</b> GA (RO) can open a special ad-hoc round independent of the annual count.')
      + ui.card({ title: `${App.icon('fact_check')} Count plans`, body: table });
    },
    mount(root) {
      const btn = root.querySelector('#newPlan');
      if (btn) btn.onclick = openCreateDialog;
    },
  });

  function openCreateDialog() {
    const comp = App.session.company;
    const areas = App.store.areas.filter(a => a.company === comp);
    const classes = [...new Set(assetsForCompany().map(a => a.assetClassDesc).filter(Boolean))];
    const holders = [...new Set(assetsForCompany().map(a => a.owner && a.owner.name).filter(Boolean))];

    const body = `
      ${ui.field({ label: 'Plan name', name: 'name', required: true, attrs: 'placeholder="e.g. Annual Count 2026"' })}
      ${ui.field({ label: 'Count type', name: 'type', type: 'select', required: true, options: [
        { value: 'annual', label: 'Annual - nationwide, all assets, simultaneous (CT1)' },
        { value: 'adhoc',  label: 'Ad-hoc - scoped round (CT2)' },
      ] })}
      <div data-scope="adhoc" style="display:none">
        ${ui.field({ label: 'Ad-hoc scope', name: 'scopeKind', type: 'select', options: [
          { value: 'location', label: 'By Location / area' },
          { value: 'type',     label: 'By Asset type (class)' },
          { value: 'holder',   label: 'By Holder (person or organization)' },
        ] })}
        <div data-scopeval="location">
          ${ui.field({ label: 'Location / area', name: 'valLocation', type: 'select', options: areas.map(a => ({ value: a.code, label: a.code + ' - ' + a.name })) })}
        </div>
        <div data-scopeval="type" style="display:none">
          ${ui.field({ label: 'Asset type', name: 'valType', type: 'select', options: classes })}
        </div>
        <div data-scopeval="holder" style="display:none">
          ${ui.field({ label: 'Holder', name: 'valHolder', type: 'select', options: holders })}
        </div>
        ${ui.callout('question', '<b>W4</b> - This is exactly how GA (RO) opens a <b>special RO round independent of the annual count</b>: pick a location, asset type, or holder and run the round on its own window.')}
      </div>
      <div class="form-grid">
        ${ui.field({ label: 'Start date', name: 'start', type: 'date', required: true })}
        ${ui.field({ label: 'End date', name: 'end', type: 'date', required: true })}
      </div>`;

    const dlg = ui.dialog({
      title: 'Create count plan',
      sub: 'p.10 item 3.1 - create the count plan (CP1)',
      size: 'lg',
      body,
      actions: [
        { label: 'Cancel', kind: 'text' },
        { label: 'Create plan', kind: 'btn', close: false, act: (d) => submitPlan(d) },
      ],
    });

    const q = s => dlg.root.querySelector(s);
    const typeSel = q('[name="type"]');
    const scopeWrap = q('[data-scope="adhoc"]');
    const updType = () => { scopeWrap.style.display = typeSel.value === 'adhoc' ? '' : 'none'; };
    typeSel.onchange = updType; updType();

    const scopeKind = q('[name="scopeKind"]');
    const updScope = () => dlg.root.querySelectorAll('[data-scopeval]').forEach(el =>
      el.style.display = el.getAttribute('data-scopeval') === scopeKind.value ? '' : 'none');
    scopeKind.onchange = updScope; updScope();
  }

  function submitPlan(dlg) {
    const q = s => { const el = dlg.root.querySelector(s); return el ? el.value : ''; };
    const name = q('[name="name"]').trim();
    const type = q('[name="type"]');
    const start = q('[name="start"]');
    const end = q('[name="end"]');
    if (!name) { ui.toast('Enter a plan name', 'error'); return; }
    if (!start || !end) { ui.toast('Pick start and end dates', 'error'); return; }

    let scopeKind = '', value = '', scopeDesc = 'Nationwide, all assets, simultaneous';
    if (type === 'adhoc') {
      scopeKind = q('[name="scopeKind"]');
      value = scopeKind === 'location' ? q('[name="valLocation"]')
            : scopeKind === 'type'     ? q('[name="valType"]')
            :                            q('[name="valHolder"]');
      const label = scopeKind === 'location' ? 'Location' : scopeKind === 'type' ? 'Asset type' : 'Holder';
      scopeDesc = `${label}: ${value} (ad-hoc round, independent of annual count)`;
    }

    const assigned = computeAssigned(type, scopeKind, value);
    const plan = {
      id: App.nextId('CP'),
      name, type,
      company: App.session.company,
      status: 'Planned',
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      scope: scopeKind || undefined,
      scopeDesc,
      assignedAssets: assigned,
    };
    App.store.countPlans.push(plan);
    App.audit({ action: 'Create count plan', target: plan.id, detail: `${type} - ${assigned.length} assets` });
    dlg.close();
    ui.toast(`Plan ${plan.id} created (${assigned.length} assets)`, 'fact_check');
    App.navigate('#/counts/' + plan.id);
  }

  /* ------------------------------------------------------------------ */
  /* #/counts/:id - progress board                                      */
  /* ------------------------------------------------------------------ */
  App.registerView('#/counts/:id', {
    title: ctx => { const p = App.byId(App.store.countPlans, ctx.params.id); return p ? p.name : 'Count plan'; },
    render(ctx) {
      const plan = App.byId(App.store.countPlans, ctx.params.id);
      if (!plan) return ui.pageHead({ title: 'Count plan not found', breadcrumb: [{ label: 'Inventory Counts', hash: '#/counts' }] });

      const assets = (plan.assignedAssets || []).map(App.asset).filter(Boolean);
      const results = App.store.countResults.filter(r => r.planId === plan.id);
      const resultFor = (id) => results.find(r => r.assetId === id);

      const assigned = assets.length;
      const found = assets.filter(a => a.countStatus === 'Found').length;
      const notFound = assets.filter(a => a.countStatus === 'Not found').length;
      const notCounted = assets.filter(a => a.countStatus === 'Not counted').length;
      const counted = found + notFound;
      const pct = assigned ? Math.round(counted / assigned * 100) : 0;

      const kpis = `<div class="grid cols-5">
        ${ui.kpi({ label: 'Assigned', value: assigned, icon: 'assignment' })}
        ${ui.kpi({ label: 'Counted', value: counted, icon: 'fact_check', tone: 'ok' })}
        ${ui.kpi({ label: 'Found', value: found, icon: 'check_circle', tone: 'ok' })}
        ${ui.kpi({ label: 'Not found', value: notFound, icon: 'error', tone: notFound ? 'danger' : undefined })}
        ${ui.kpi({ label: 'Not counted', value: notCounted, icon: 'pending', tone: notCounted ? 'warn' : undefined })}
      </div>`;

      const progress = ui.card({
        title: `${App.icon('donut_large')} Overall progress`,
        body: `<div class="pill-row" style="justify-content:space-between"><span class="muted">${counted} of ${assigned} counted</span><b>${pct}%</b></div>
          <div class="bar-track" style="margin-top:8px"><div class="bar-fill" style="width:${pct}%"></div></div>`,
      });

      // Breakdown by area
      const areaMap = {};
      assets.forEach(a => {
        const k = a.area || '-';
        (areaMap[k] = areaMap[k] || { area: k, assigned: 0, found: 0, notFound: 0, notCounted: 0 });
        areaMap[k].assigned++;
        if (a.countStatus === 'Found') areaMap[k].found++;
        else if (a.countStatus === 'Not found') areaMap[k].notFound++;
        else areaMap[k].notCounted++;
      });
      const byArea = ui.card({
        title: `${App.icon('map')} Breakdown by area`,
        body: ui.table({
          columns: [
            { key: 'area', label: 'Area' },
            { key: 'assigned', label: 'Assigned', cls: 'num' },
            { key: 'found', label: 'Found', cls: 'num' },
            { key: 'notFound', label: 'Not found', cls: 'num' },
            { key: 'notCounted', label: 'Not counted', cls: 'num' },
          ],
          rows: Object.values(areaMap),
          empty: 'No assigned assets',
        }),
      });

      // Breakdown by person (who counted)
      const personMap = {};
      results.forEach(r => {
        const u = App.user(r.by);
        const k = u ? u.name : r.by;
        (personMap[k] = personMap[k] || { person: k, total: 0, ok: 0, issues: 0 });
        personMap[k].total++;
        if (r.outcome === 'found_ok') personMap[k].ok++; else personMap[k].issues++;
      });
      const byPerson = ui.card({
        title: `${App.icon('groups')} Breakdown by person (counter)`,
        body: ui.table({
          columns: [
            { key: 'person', label: 'Counted by' },
            { key: 'total', label: 'Records', cls: 'num' },
            { key: 'ok', label: 'Found OK', cls: 'num' },
            { key: 'issues', label: 'Issues raised', cls: 'num' },
          ],
          rows: Object.values(personMap),
          empty: 'No count records recorded yet',
        }),
      });

      const list = ui.card({
        title: `${App.icon('inventory_2')} Assigned assets`,
        actions: `<button class="btn outline sm" id="expPlan">${App.icon('table_view')} Export Excel</button>`,
        body: ui.table({
          columns: [
            { key: 'code', label: 'Asset', render: a => `<span class="mono">${esc(App.assetCode(a))}</span><div class="muted" style="font-size:12px">${esc([a.desc1, a.desc2].filter(Boolean).join(' '))}</div>` },
            { key: 'area', label: 'Area' },
            { key: 'owner', label: 'Owner', cls: 'wrap', render: a => esc(App.ownerLabel(a)) },
            { key: 'countStatus', label: 'Count status', render: a => ui.statusChip(a.countStatus) },
            { key: 'outcome', label: 'Outcome', render: a => { const r = resultFor(a.id); return outcomeChip(r && r.outcome); } },
          ],
          rows: assets,
          rowLink: a => '#/assets/' + a.id,
          empty: 'No assigned assets',
        }),
      });

      return ui.pageHead({
        title: plan.name,
        breadcrumb: [{ label: 'Inventory Counts', hash: '#/counts' }, { label: plan.id }],
        sub: `${typeChip(plan.type)} ${ui.statusChip(plan.status)} &nbsp; ${fmt.date(plan.start)} &rarr; ${fmt.date(plan.end)} &nbsp; <span class="muted">${esc(plan.scopeDesc || '')}</span>`,
      })
      + kpis + progress
      + `<div class="grid cols-2" style="align-items:start">${byArea}${byPerson}</div>`
      + list;
    },
    mount(root, ctx) {
      const plan = App.byId(App.store.countPlans, ctx.params.id);
      const exp = root.querySelector('#expPlan');
      if (exp && plan) exp.onclick = () => {
        const results = App.store.countResults.filter(r => r.planId === plan.id);
        const resultFor = (id) => results.find(r => r.assetId === id);
        const headers = ['Asset', 'Description', 'Area', 'Owner', 'Count status', 'Outcome', 'Counted by', 'Date'];
        const rows = (plan.assignedAssets || []).map(App.asset).filter(Boolean).map(a => {
          const r = resultFor(a.id);
          const u = r && App.user(r.by);
          return [
            App.assetCode(a),
            [a.desc1, a.desc2].filter(Boolean).join(' '),
            a.area || '',
            App.ownerLabel(a),
            a.countStatus,
            r && OUTCOME[r.outcome] ? OUTCOME[r.outcome].label : '',
            u ? u.name : (r ? r.by : ''),
            r ? fmt.date(r.date) : '',
          ];
        });
        App.exportRows('count-plan-' + plan.id + '.csv', headers, rows);
      };
    },
  });
})();
