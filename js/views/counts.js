/* Inventory Counts (#/counts) + Count Plan progress (#/counts/:id)
   Covers: M5 (inventory count module), W4 (GA/RO special RO round), CP1 (create
   the count plan - p.10 item 3.1). Plan types: By Asset Location vs Personal Asset.
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

  const typeChip = (t) => t === 'personal'
    ? ui.chip('Personal Asset', 'info')
    : ui.chip('By Asset Location', 'neutral');

  const plansForCompany = () => App.store.countPlans.filter(p =>
    (p.companies && p.companies.includes(App.session.company)) || p.company === App.session.company);

  function pkgProgress(pkg) {
    const assets = (pkg.assetIds || []).map(App.asset).filter(Boolean);
    return {
      assigned: assets.length,
      counted: assets.filter(a => a.countStatus !== 'Not counted').length,
    };
  }

  function personalIsMine(p) {
    const me = App.currentUser();
    if (!me || !p.holderNames) return false;
    return p.holderNames.some(n => n === me.name);
  }

  function flattenCountRows(plans, typeFilter) {
    const filtered = typeFilter === 'All' ? plans : typeFilter === 'location'
      ? plans.filter(p => p.type === 'location' || p.type === 'annual' || p.type === 'adhoc')
      : plans.filter(p => p.type === typeFilter);
    const rows = [];
    filtered.forEach(p => {
      if (p.type === 'personal' || !(p.workPackages && p.workPackages.length)) {
        const assets = (p.assignedAssets || []).map(App.asset).filter(Boolean);
        rows.push({
          rowKey: p.id,
          p,
          pkg: null,
          personal: p.type === 'personal',
          location: p.type === 'personal' ? 'Personal asset' : (p.scopeDesc || '-'),
          assigned: assets.length,
          counted: assets.filter(a => a.countStatus !== 'Not counted').length,
        });
        return;
      }
      p.workPackages.forEach(pkg => {
        const prog = pkgProgress(pkg);
        rows.push({
          rowKey: p.id + ':' + pkg.id,
          p,
          pkg,
          personal: false,
          location: pkg.label,
          assigned: prog.assigned,
          counted: prog.counted,
        });
      });
    });
    return rows;
  }

  function rowIsMine(r) {
    if (r.personal) return personalIsMine(r.p);
    return r.pkg && App.pkgHasTeam(r.pkg, App.session.role);
  }

  function teamRoleCell(plan, pkg) {
    if (!pkg) return ui.chip('Personal', 'info');
    const roles = App.pkgTeamRoles(pkg);
    if (!roles.length) return ui.chip('Unassigned', 'warn');
    return roles.map(r => ui.chip(App.countTeamLabel(r), 'neutral')).join(' ');
  }

  function openAssignDialog(planId, pkgId) {
    const plan = App.byId(App.store.countPlans, planId);
    const pkg = plan && App.countPkgById(plan, pkgId);
    if (!pkg) return;
    const dlg = ui.dialog({
      title: 'Assign teams',
      sub: esc(pkg.label),
      body: ui.callout('info', 'Select one or more counting teams for this location (C3–C6).')
        + ui.teamPickDropdown(App.pkgTeamRoles(pkg)),
      actions: [
        { label: 'Cancel', kind: 'text' },
        { label: 'Save', kind: 'btn', close: false, act: (d) => {
          const roles = [...d.root.querySelectorAll('[data-team]:checked')].map(c => c.value);
          pkg.teamRoles = roles;
          delete pkg.teamRole;
          App.audit({ action: 'Assign count teams', target: planId, detail: `${pkg.label} -> ${roles.join(', ') || 'none'}` });
          dlg.close();
          App.refresh();
        } },
      ],
    });
    App.mountTeamPickDropdown(dlg.root.querySelector('.dialog-body'));
  }

  function mountCountActions(root) {
    root.querySelectorAll('[data-assign]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openAssignDialog(btn.getAttribute('data-assign'), btn.getAttribute('data-pkg'));
      };
    });
  }

  App.flattenCountRows = flattenCountRows; // ponytail: harness
  App.rowIsMine = rowIsMine; // ponytail: harness

  // Compute assigned asset ids from plan type + scope (+ optional assetClasses on scope).
  function computeAssigned(type, scope, holderNames) {
    let ids = [];
    if (type === 'location' || type === 'annual') {
      if (scope && scope.companies && scope.companies.length) {
        ids = App.store.assets.filter(a => App.locFilterMatch(a, scope)).map(a => a.id);
      } else if (scope && App.locComplete(scope)) {
        ids = App.store.assets.filter(a => App.locMatch(a, scope)).map(a => a.id);
      }
    } else if (type === 'personal') {
      const all = App.store.assets.filter(a => a.companyCode === App.session.company);
      const names = (Array.isArray(holderNames) ? holderNames : []).map(n => String(n).toLowerCase());
      if (names.length) {
        ids = all.filter(a => names.includes(String((a.owner && a.owner.name) || '').toLowerCase())).map(a => a.id);
      }
    } else if (type === 'adhoc' && scopeValue) {
      const kind = scopeValue;
      const val = holderNames;
      if (val) {
        const lc = String(val).toLowerCase();
        const all = App.store.assets.filter(a => a.companyCode === App.session.company);
        ids = all.filter(a => {
          if (kind === 'location') return String(a.area || '').toLowerCase() === lc;
          if (kind === 'type') return String(a.assetClassDesc || '').toLowerCase() === lc || String(a.assetClass || '') === val;
          if (kind === 'holder') return String((a.owner && a.owner.name) || '').toLowerCase() === lc;
          return false;
        }).map(a => a.id);
      }
    }
    return applyAssetClassFilter(ids, scope && scope.assetClasses);
  }
  App.applyAssetClassFilter = applyAssetClassFilter; // ponytail: harness self-check

  /* ------------------------------------------------------------------ */
  /* #/counts - list + wizard (#/counts/new before #/counts/:id)        */
  /* ------------------------------------------------------------------ */
  const CP_STEPS = [
    { id: 'basics', title: 'Plan basics', desc: 'Name and count type' },
    { id: 'scope', title: 'Scope & window', desc: 'Location, asset category, holders + audit window dates (CP1)' },
    { id: 'assign', title: 'Split work packages', desc: 'Choose how to divide counting work (location plans)' },
    { id: 'review', title: 'Review', desc: 'Preview assigned assets and packages before creating plan' },
  ];

  const wiz = { step: 0, name: '', type: 'location', locFilter: null, assignLevel: 'unit', holderNames: [], holderQ: '', assetClasses: [], start: '', end: '' };
  App._countsWizard = wiz; // ponytail: harness self-check
  App.computeAssigned = computeAssigned; // ponytail: harness self-check
  App._countsCreate = submitPlan; // ponytail: harness self-check

  let typeFilter = 'All';
  let scopeFilter = 'mine';

  function wizardSteps() {
    return wiz.type === 'personal' ? CP_STEPS.filter(s => s.id !== 'assign') : CP_STEPS;
  }

  function resetWizard() {
    wiz.step = 0; wiz.name = ''; wiz.type = 'location';
    wiz.locFilter = App.emptyLocFilter(); wiz.assignLevel = 'unit';
    wiz.holderNames = []; wiz.holderQ = ''; wiz.assetClasses = []; wiz.start = ''; wiz.end = '';
    App._locFilterOpen = null;
  }

  function applyAssetClassFilter(ids, assetClasses) {
    if (!assetClasses || !assetClasses.length) return ids;
    const set = new Set(assetClasses);
    return ids.filter(id => {
      const a = App.asset(id);
      return a && set.has(String(a.assetClass || ''));
    });
  }

  function assetClassPool() {
    let pool = assetsForCompany();
    if (wiz.type === 'location') {
      const f = wiz.locFilter || App.emptyLocFilter();
      if (f.companies.length) pool = pool.filter(a => App.locFilterMatch(a, f));
    } else if ((wiz.holderNames || []).length) {
      const names = new Set(wiz.holderNames.map(n => String(n).toLowerCase()));
      pool = pool.filter(a => names.has(String((a.owner && a.owner.name) || '').toLowerCase()));
    }
    return pool;
  }

  function assetClassOptions() {
    const map = new Map();
    assetClassPool().forEach(a => {
      const c = String(a.assetClass || '');
      if (!c) return;
      if (!map.has(c)) map.set(c, { code: c, desc: a.assetClassDesc || c, count: 0 });
      map.get(c).count++;
    });
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  function renderAssetClassFilter() {
    const opts = assetClassOptions();
    const selected = wiz.assetClasses || [];
    if (!opts.length) {
      return ui.callout('info', 'Select location or holder scope first to list asset categories.');
    }
    const allPicked = opts.every(o => selected.includes(o.code));
    return `<div class="asset-class-filter" style="margin-top:16px">
      <span class="muted">Asset category (optional — leave empty for all types in scope):</span>
      <div class="pill-row" style="margin:8px 0;align-items:center">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="classPickAll" ${allPicked ? 'checked' : ''}>
          Select all (${opts.length})
        </label>
        <span class="muted">${selected.length} selected</span>
      </div>
      <div class="pill-row" style="flex-wrap:wrap;gap:8px;align-items:stretch">
        ${opts.map(o => `<label class="chip outline" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin:0">
          <input type="checkbox" data-aclass="${esc(o.code)}" ${selected.includes(o.code) ? 'checked' : ''}>
          <span><span class="mono">${esc(o.code)}</span> · ${esc(o.desc)} <span class="muted">(${o.count})</span></span>
        </label>`).join('')}
      </div>
    </div>`;
  }

  function mountAssetClassFilter(root) {
    const opts = assetClassOptions();
    root.querySelectorAll('[data-aclass]').forEach(c => {
      c.onchange = () => {
        const code = c.getAttribute('data-aclass');
        if (!wiz.assetClasses) wiz.assetClasses = [];
        if (c.checked) { if (!wiz.assetClasses.includes(code)) wiz.assetClasses.push(code); }
        else wiz.assetClasses = wiz.assetClasses.filter(x => x !== code);
        App.refresh();
      };
    });
    const pickAll = root.querySelector('#classPickAll');
    if (pickAll) {
      const picked = opts.filter(o => (wiz.assetClasses || []).includes(o.code)).length;
      pickAll.indeterminate = picked > 0 && picked < opts.length;
      pickAll.onchange = () => {
        wiz.assetClasses = pickAll.checked ? opts.map(o => o.code) : [];
        App.refresh();
      };
    }
  }

  const assetsForCompany = () => App.store.assets.filter(a => a.companyCode === App.session.company);

  function holderOptions() {
    const map = {};
    assetsForCompany().forEach(a => {
      const n = a.owner && a.owner.name;
      if (!n) return;
      map[n] = (map[n] || 0) + 1;
    });
    return Object.keys(map).sort().map(name => ({ name, count: map[name] }));
  }

  function scopeDesc() {
    if (wiz.type === 'location') {
      const f = wiz.locFilter || App.emptyLocFilter();
      if (!f.companies.length) return 'By Asset Location: (select scope)';
      const bits = ['Companies: ' + f.companies.map(c => App.COMPANIES[c] || c).join(', ')];
      if (f.projects.length) bits.push('Projects: ' + f.projects.join(', '));
      if (f.buildings.length) bits.push('Buildings: ' + f.buildings.join(', '));
      if (f.floors.length) bits.push('Floors: ' + f.floors.join(', '));
      if (f.units.length) bits.push('Units: ' + f.units.join(', '));
      if (wiz.assetClasses && wiz.assetClasses.length) {
        const labels = wiz.assetClasses.map(c => {
          const o = assetClassOptions().find(x => x.code === c);
          return o ? `${c} (${o.desc})` : c;
        });
        bits.push('Asset categories: ' + labels.join(', '));
      }
      if (wiz.assignLevel) bits.push('Split at: ' + wiz.assignLevel);
      return 'By Asset Location: ' + bits.join('; ');
    }
    const n = (wiz.holderNames || []).length;
    if (!n) return 'Personal Asset: (none selected)';
    let s = n <= 3 ? `Personal Asset: ${wiz.holderNames.join(', ')}` : `Personal Asset: ${wiz.holderNames.slice(0, 2).join(', ')} +${n - 2} more`;
    if (wiz.assetClasses && wiz.assetClasses.length) s += '; categories: ' + wiz.assetClasses.join(', ');
    return s;
  }

  function captureCounts(root) {
    if (!root) return;
    const nameInp = root.querySelector('[name="name"]');
    if (nameInp) wiz.name = nameInp.value;
    const startInp = root.querySelector('[name="start"]');
    if (startInp) wiz.start = startInp.value;
    const endInp = root.querySelector('[name="end"]');
    if (endInp) wiz.end = endInp.value;
    if (wiz.type === 'location') {
      if (!wiz.locFilter) wiz.locFilter = App.emptyLocFilter();
    }
  }

  function stepError() {
    if (wiz.step === 0 && !wiz.name.trim()) return 'Enter a plan name';
    const cur = wizardSteps()[wiz.step];
    if (cur && cur.id === 'scope') {
      if (!wiz.start || !wiz.end) return 'Pick start and end dates';
      if (wiz.type === 'location' && !(wiz.locFilter && wiz.locFilter.companies.length)) return 'Select at least one company';
      if (wiz.type === 'personal' && !(wiz.holderNames || []).length) return 'Select at least one holder';
    }
    if (cur && cur.id === 'assign' && !wiz.assignLevel) return 'Choose a split level';
    return null;
  }

  function previewAssigned() {
    const scope = wiz.type === 'location'
      ? Object.assign({}, wiz.locFilter || App.emptyLocFilter(), { assetClasses: wiz.assetClasses || [] })
      : { assetClasses: wiz.assetClasses || [] };
    if (wiz.type === 'personal') return computeAssigned('personal', scope, wiz.holderNames);
    if (!wiz.locFilter) wiz.locFilter = App.emptyLocFilter();
    return computeAssigned('location', scope, []);
  }

  function previewPackages() {
    const assets = previewAssigned().map(App.asset).filter(Boolean);
    return App.countPackages(assets, wiz.assignLevel || 'unit');
  }

  function renderHolderPicker() {
    const all = holderOptions();
    const q = (wiz.holderQ || '').toLowerCase();
    const visible = all.filter(h => !q || h.name.toLowerCase().includes(q));
    const selected = wiz.holderNames || [];
    const allPicked = visible.length > 0 && visible.every(h => selected.includes(h.name));
    const search = `<div class="search" style="margin-bottom:10px"><span class="material-symbols-outlined">search</span>
      <input type="search" id="holderSearch" placeholder="Search holder name..." value="${esc(wiz.holderQ || '')}"></div>`;
    const bar = `<div class="pill-row" style="margin-bottom:10px;align-items:center">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="holderPickAll" ${allPicked ? 'checked' : ''}>
        Select all (${visible.length})
      </label>
      <span class="muted">all pages</span>
      <span class="muted">${selected.length} selected</span>
    </div>`;
    const pickCol = {
      key: '_pick', label: '',
      render: r => `<input type="checkbox" data-hpick="${esc(r.name)}" ${selected.includes(r.name) ? 'checked' : ''}>`,
    };
    let body;
    if (visible.length) {
      body = ui.table({
        columns: [pickCol, { key: 'name', label: 'Holder' }, { key: 'count', label: 'Assets', cls: 'num' }],
        rows: visible,
        empty: 'No holders',
      });
    } else if (all.length) {
      body = ui.callout('info', 'No holders match your search.');
    } else {
      body = ui.callout('info', 'No asset holders found for this company.');
    }
    return search + bar + body;
  }

  function mountHolderPicker(root) {
    const all = holderOptions();
    const visible = () => {
      const q = (wiz.holderQ || '').toLowerCase();
      return all.filter(h => !q || h.name.toLowerCase().includes(q));
    };
    root.querySelectorAll('[data-hpick]').forEach(c => {
      c.onchange = () => {
        const name = c.getAttribute('data-hpick');
        if (!wiz.holderNames) wiz.holderNames = [];
        if (c.checked) { if (!wiz.holderNames.includes(name)) wiz.holderNames.push(name); }
        else wiz.holderNames = wiz.holderNames.filter(x => x !== name);
        App.refresh();
      };
    });
    const pickAll = root.querySelector('#holderPickAll');
    if (pickAll) {
      const vis = visible();
      const picked = vis.filter(h => (wiz.holderNames || []).includes(h.name)).length;
      pickAll.indeterminate = picked > 0 && picked < vis.length;
      pickAll.onchange = () => {
        wiz.holderNames = pickAll.checked ? vis.map(h => h.name) : [];
        App.refresh();
      };
    }
    const search = root.querySelector('#holderSearch');
    if (search) {
      if (wiz._holderCaret != null) {
        search.focus();
        if (typeof search.setSelectionRange === 'function') search.setSelectionRange(wiz._holderCaret, wiz._holderCaret);
        delete wiz._holderCaret;
      }
      search.oninput = (e) => {
        wiz.holderQ = e.target.value;
        wiz._holderCaret = e.target.selectionStart;
        clearTimeout(search._t);
        search._t = setTimeout(App.refresh, 250);
      };
    }
  }

  function wizardStepBody() {
    const steps = wizardSteps();
    const cur = steps[wiz.step];
    if (!cur) return '';

    if (cur.id === 'basics') {
      return ui.field({ label: 'Plan name', name: 'name', required: true, value: wiz.name, attrs: 'placeholder="e.g. Annual Count 2026"' })
        + `<div class="pill-row" style="margin-top:14px;align-items:center">
          <span class="muted">Count type:</span>
          <div class="segmented" data-seg="type">
            <button type="button" data-val="location" class="${wiz.type === 'location' ? 'active' : ''}">By Asset Location</button>
            <button type="button" data-val="personal" class="${wiz.type === 'personal' ? 'active' : ''}">Personal Asset</button>
          </div>
        </div>`
        + (wiz.type === 'location'
          ? ui.callout('info', '<b>By Asset Location</b> — multi-select scope across companies and sites. Work is split into packages before assign (CP3).')
          : ui.callout('info', '<b>Personal Asset</b> — assign by holder. Each person counts only assets they own; no area-wide sweep.'));
    }

    if (cur.id === 'scope') {
      let body = '';
      if (wiz.type === 'location') {
        if (!wiz.locFilter) wiz.locFilter = App.emptyLocFilter();
        body += ui.locFilterFields(wiz.locFilter);
      } else {
        body += `<div style="margin-bottom:14px"><span class="muted">Select holder(s) whose assets are in scope:</span></div>` + renderHolderPicker();
      }
      body += renderAssetClassFilter();
      body += `<div class="form-grid" style="margin-top:14px">
        ${ui.field({ label: 'Start date', name: 'start', type: 'date', required: true, value: wiz.start })}
        ${ui.field({ label: 'End date', name: 'end', type: 'date', required: true, value: wiz.end })}
      </div>`;
      return body;
    }

    if (cur.id === 'assign') {
      const pkgs = previewPackages();
      const seg = App.ASSIGN_LEVELS.map(l => `<button type="button" data-val="${l}" class="${wiz.assignLevel === l ? 'active' : ''}">${l.charAt(0).toUpperCase() + l.slice(1)}</button>`).join('');
      return ui.callout('info', 'Choose how counting work is divided into packages. Each package appears separately on the progress board and in My Count.')
        + `<div class="pill-row" style="margin:14px 0;align-items:center"><span class="muted">Split at:</span><div class="segmented" data-seg="assign">${seg}</div></div>`
        + ui.table({
          columns: [
            { key: 'label', label: 'Work package' },
            { key: 'count', label: 'Assets', cls: 'num', render: r => r.assetIds.length },
          ],
          rows: pkgs,
          empty: 'No assets match this scope',
        });
    }

    const assignedIds = previewAssigned();
    const assets = assignedIds.map(App.asset).filter(Boolean);
    const pkgs = wiz.type === 'location' ? previewPackages() : [];
    let body = ui.callout('info', `<b>${assignedIds.length}</b> asset(s) will be assigned to this plan.<br>Scope: ${esc(scopeDesc())}`);
    if (pkgs.length) {
      body += ui.table({
        columns: [
          { key: 'label', label: 'Work package' },
          { key: 'count', label: 'Assets', cls: 'num', render: r => r.assetIds.length },
        ],
        rows: pkgs,
        empty: 'No packages',
      });
    }
    body += ui.table({
      columns: [
        { key: 'code', label: 'Asset code', render: r => `<span class="mono">${esc(App.assetCode(r))}</span>` },
        { key: 'desc', label: 'Description', cls: 'wrap', render: r => esc([r.desc1, r.desc2].filter(Boolean).join(' ')) },
        { key: 'class', label: 'Category', render: r => esc(r.assetClassDesc || r.assetClass || '-') },
        { key: 'area', label: 'Location', render: r => App.locCell(r) },
        { key: 'owner', label: 'Owner', render: r => esc(App.ownerLabel(r)) },
      ],
      rows: assets,
      empty: 'No assets match this scope',
    });
    return body;
  }

  function wizardNav() {
    const steps = wizardSteps();
    const last = steps.length - 1;
    const isLast = wiz.step === last;
    let btns = `<button type="button" class="btn text" id="wizCancel">${App.icon('close')} Cancel</button>`;
    if (wiz.step > 0) btns += ` <button type="button" class="btn tonal" id="wizBack">${App.icon('arrow_back')} Back</button>`;
    if (!isLast) btns += ` <button type="button" class="btn" id="wizNext">${App.icon('arrow_forward')} Next</button>`;
    else btns += ` <button type="button" class="btn" id="wizCreate">${App.icon('fact_check')} Create plan (${previewAssigned().length} assets)</button>`;
    return `<div class="pill-row" style="margin-top:22px;justify-content:flex-end">${btns}</div>`;
  }

  function submitPlan() {
    const assigned = previewAssigned();
    const assets = assigned.map(App.asset).filter(Boolean);
    const workPackages = wiz.type === 'location' ? App.countPackages(assets, wiz.assignLevel || 'unit') : undefined;
    const plan = {
      id: App.nextId('CP'),
      name: wiz.name.trim(),
      type: wiz.type,
      company: App.session.company,
      companies: wiz.type === 'location' ? (wiz.locFilter.companies || []).slice() : [App.session.company],
      status: 'Planned',
      start: new Date(wiz.start).toISOString(),
      end: new Date(wiz.end).toISOString(),
      scopeFilter: wiz.type === 'location'
        ? Object.assign(JSON.parse(JSON.stringify(wiz.locFilter)), { assetClasses: (wiz.assetClasses || []).slice() })
        : undefined,
      assetClasses: (wiz.assetClasses || []).length ? wiz.assetClasses.slice() : undefined,
      assignLevel: wiz.type === 'location' ? (wiz.assignLevel || 'unit') : undefined,
      workPackages,
      holderNames: wiz.type === 'personal' ? wiz.holderNames.slice() : undefined,
      scopeDesc: scopeDesc(),
      assignedAssets: assigned,
    };
    App.store.countPlans.push(plan);
    App.audit({ action: 'Create count plan', target: plan.id, detail: `${wiz.type} - ${assigned.length} assets, ${(workPackages || []).length} packages` });
    resetWizard();
    ui.toast(`Plan ${plan.id} created (${assigned.length} assets)`, 'fact_check');
    App.navigate('#/counts/' + plan.id);
  }

  function mountWizard(root) {
    const steps = wizardSteps();
    const cur = steps[wiz.step];
    root.querySelectorAll('[data-seg="type"] button').forEach(b => b.onclick = () => {
      captureCounts(root);
      wiz.type = b.getAttribute('data-val');
      if (wiz.type === 'location') { wiz.locFilter = wiz.locFilter || App.emptyLocFilter(); wiz.holderNames = []; }
      else { wiz.holderNames = wiz.holderNames || []; wiz.locFilter = App.emptyLocFilter(); wiz.assetClasses = wiz.assetClasses || []; }
      if (wiz.step >= wizardSteps().length) wiz.step = wizardSteps().length - 1;
      App.refresh();
    });
    if (cur && cur.id === 'scope' && wiz.type === 'personal') mountHolderPicker(root);
    if (cur && cur.id === 'scope') {
      if (wiz.type === 'location') {
        App.mountLocFilterFields(root, wiz.locFilter || App.emptyLocFilter(), () => App.refresh());
      }
      mountAssetClassFilter(root);
    }
    root.querySelectorAll('[data-seg="assign"] button').forEach(b => b.onclick = () => {
      wiz.assignLevel = b.getAttribute('data-val');
      App.refresh();
    });
    const cancel = root.querySelector('#wizCancel');
    if (cancel) cancel.onclick = () => { resetWizard(); App.navigate('#/counts'); };
    const back = root.querySelector('#wizBack');
    if (back) back.onclick = () => { captureCounts(root); wiz.step--; App.refresh(); };
    const next = root.querySelector('#wizNext');
    if (next) next.onclick = () => {
      captureCounts(root);
      const err = stepError();
      if (err) { ui.toast(err, 'error'); return; }
      wiz.step++;
      App.refresh();
    };
    const create = root.querySelector('#wizCreate');
    if (create) create.onclick = () => {
      captureCounts(root);
      const err = stepError();
      if (err) { ui.toast(err, 'error'); return; }
      submitPlan();
    };
  }

  App.registerView('#/counts', {
    title: 'Inventory Counts',
    render() {
      const plans = plansForCompany();
      const allRows = flattenCountRows(plans, typeFilter);
      const rows = scopeFilter === 'mine' ? allRows.filter(rowIsMine) : allRows;
      const canAssign = App.canAssignCountTeam();

      const active = plans.filter(p => p.status !== 'Completed').length;
      const completed = plans.length - active;
      const assetScope = plans.reduce((n, p) => n + (p.assignedAssets || []).length, 0);
      const mineCount = allRows.filter(rowIsMine).length;

      const typeSeg = `<div class="segmented" data-tfilter>
        <button type="button" data-val="All" class="${typeFilter === 'All' ? 'active' : ''}">All types</button>
        <button type="button" data-val="location" class="${typeFilter === 'location' ? 'active' : ''}">By Asset Location</button>
        <button type="button" data-val="personal" class="${typeFilter === 'personal' ? 'active' : ''}">Personal Asset</button>
      </div>`;
      const scopeSeg = `<div class="segmented" data-sfilter>
        <button type="button" data-val="mine" class="${scopeFilter === 'mine' ? 'active' : ''}">My tasks (${mineCount})</button>
        <button type="button" data-val="all" class="${scopeFilter === 'all' ? 'active' : ''}">All locations</button>
      </div>`;

      const table = ui.table({
        columns: [
          { key: 'name', label: 'Plan', render: r => `<b>${esc(r.p.name)}</b><div class="muted mono" style="font-size:12px">${esc(r.p.id)}</div>` },
          { key: 'location', label: 'Location', cls: 'wrap', render: r => esc(r.location) },
          { key: 'type', label: 'Type', render: r => typeChip(r.p.type) },
          { key: 'team', label: 'Team', render: r => teamRoleCell(r.p, r.pkg) },
          { key: 'status', label: 'Status', render: r => ui.statusChip(r.p.status) },
          { key: 'window', label: 'Window', render: r => `${fmt.date(r.p.start)} &rarr; ${fmt.date(r.p.end)}` },
          { key: 'prog', label: 'Progress', cls: 'num', render: r => `${r.counted}/${r.assigned}` },
          { key: '_action', label: 'Action', render: r => {
            const parts = [];
            if (canAssign && r.pkg) {
              parts.push(`<button type="button" class="btn sm outline" data-assign="${esc(r.p.id)}" data-pkg="${esc(r.pkg.id)}">${App.icon('group_add')} Assign</button>`);
            }
            if (rowIsMine(r)) {
              parts.push(`<button type="button" class="btn sm" data-nav="#/my-count?plan=${encodeURIComponent(r.p.id)}${r.pkg ? '&pkg=' + encodeURIComponent(r.pkg.id) : ''}">${App.icon('checklist')} My tasks</button>`);
            }
            return parts.length ? parts.join(' ') : '<span class="muted">-</span>';
          } },
        ],
        rows,
        rowLink: r => '#/counts/' + r.p.id,
        empty: scopeFilter === 'mine' ? 'No count tasks assigned to you yet' : 'No count plans for this company yet',
      });

      return ui.pageHead({
        title: 'Inventory Counts',
        sub: 'One plan may span many locations — each row is a work package you can assign to a counting team (C3–C6). Open <b>My tasks</b> to count in the field.',
        actions: `<button type="button" class="btn" id="addNewBtn">${App.icon('add')} Create count plan</button>`,
      })
      + ui.callout('info', '<b>My tasks</b> shows locations assigned to your role. Switch to <b>All locations</b> to assign teams (Asset HQ / GA). Field counting opens from the <b>My tasks</b> button on each row.')
      + ui.statStrip([
        { label: 'Plans', value: plans.length, ic: 'fact_check' },
        { label: 'My locations', value: mineCount, ic: 'checklist' },
        { label: 'Active', value: active, ic: 'pending' },
        { label: 'Assets in scope', value: assetScope, ic: 'inventory_2' },
      ])
      + ui.card({
        title: `${App.icon('fact_check')} Count work by location`,
        body: `<div class="pill-row" style="margin-bottom:14px;align-items:center;flex-wrap:wrap;gap:10px">
          <span class="muted">Show:</span>${scopeSeg}
          <span class="muted" style="margin-left:8px">Type:</span>${typeSeg}
        </div>` + table,
      });
    },
    mount(root) {
      const btn = root.querySelector('#addNewBtn');
      if (btn) btn.onclick = () => { resetWizard(); App.navigate('#/counts/new'); };
      root.querySelectorAll('[data-tfilter] [data-val]').forEach(b => b.onclick = () => {
        typeFilter = b.getAttribute('data-val');
        App.refresh();
      });
      root.querySelectorAll('[data-sfilter] [data-val]').forEach(b => b.onclick = () => {
        scopeFilter = b.getAttribute('data-val');
        App.refresh();
      });
      mountCountActions(root);
    },
  });

  App.registerView('#/counts/new', {
    title: 'Create count plan',
    render() {
      const steps = wizardSteps();
      if (wiz.step >= steps.length) wiz.step = steps.length - 1;
      const cur = steps[wiz.step];
      return ui.pageHead({
        title: 'Create count plan',
        breadcrumb: [{ label: 'Inventory Counts', hash: '#/counts' }, { label: 'Create count plan' }],
        sub: 'p.10 item 3.1 - create the count plan (CP1)',
        actions: ui.stepsBar(steps, wiz.step),
      }) + ui.card({
        title: App.icon('edit_note') + ' ' + esc(cur.title),
        sub: `Step ${wiz.step + 1} of ${steps.length} &mdash; ${cur.desc}`,
        body: `<form id="wizForm">${wizardStepBody()}${wizardNav()}</form>`,
      });
    },
    mount: mountWizard,
  });

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

      // Breakdown by work package (or legacy area)
      let breakdownCard;
      if (plan.workPackages && plan.workPackages.length) {
        const canAssign = App.canAssignCountTeam();
        const pkgRows = plan.workPackages.map(pkg => {
          const pkgAssets = pkg.assetIds.map(App.asset).filter(Boolean);
          return {
            pkg,
            planId: plan.id,
            label: pkg.label,
            team: teamRoleCell(plan, pkg),
            assigned: pkgAssets.length,
            found: pkgAssets.filter(a => a.countStatus === 'Found').length,
            notFound: pkgAssets.filter(a => a.countStatus === 'Not found').length,
            notCounted: pkgAssets.filter(a => a.countStatus === 'Not counted').length,
          };
        });
        breakdownCard = ui.card({
          title: `${App.icon('inventory')} Work packages by location`,
          body: ui.table({
            columns: [
              { key: 'label', label: 'Location', cls: 'wrap' },
              { key: 'team', label: 'Team' },
              { key: 'assigned', label: 'Assigned', cls: 'num' },
              { key: 'found', label: 'Found', cls: 'num' },
              { key: 'notFound', label: 'Not found', cls: 'num' },
              { key: 'notCounted', label: 'Not counted', cls: 'num' },
              { key: '_action', label: 'Action', render: r => canAssign
                ? `<button type="button" class="btn sm outline" data-assign="${esc(r.planId)}" data-pkg="${esc(r.pkg.id)}">${App.icon('group_add')} Assign</button>`
                : '<span class="muted">-</span>' },
            ],
            rows: pkgRows,
            empty: 'No work packages',
          }),
        });
      } else {
        const areaMap = {};
        assets.forEach(a => {
          const k = a.area || '-';
          (areaMap[k] = areaMap[k] || { area: k, assigned: 0, found: 0, notFound: 0, notCounted: 0 });
          areaMap[k].assigned++;
          if (a.countStatus === 'Found') areaMap[k].found++;
          else if (a.countStatus === 'Not found') areaMap[k].notFound++;
          else areaMap[k].notCounted++;
        });
        breakdownCard = ui.card({
          title: `${App.icon('map')} Breakdown by area`,
          body: ui.table({
            columns: [
              { key: 'area', label: 'Location', render: a => App.locCell(a) },
              { key: 'assigned', label: 'Assigned', cls: 'num' },
              { key: 'found', label: 'Found', cls: 'num' },
              { key: 'notFound', label: 'Not found', cls: 'num' },
              { key: 'notCounted', label: 'Not counted', cls: 'num' },
            ],
            rows: Object.values(areaMap),
            empty: 'No assigned assets',
          }),
        });
      }

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
            { key: 'area', label: 'Location', render: a => App.locCell(a) },
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
      + `<div class="grid cols-2" style="align-items:start">${breakdownCard}${byPerson}</div>`
      + list;
    },
    mount(root, ctx) {
      const plan = App.byId(App.store.countPlans, ctx.params.id);
      mountCountActions(root);
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
