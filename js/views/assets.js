/* Asset Register (#/assets) + Asset Detail (#/assets/:id)
   Shared, contract-heavy screen. Exposes reusable helpers for other views:
     App.SAP_FIELDS        full 33-field metadata (key,label,group,fmt)
     App.assetCode(a)      SAP Asset code or WeCGA code
     App.assetTitle(a)     "code - desc1 desc2"
     App.ownerLabel(a)     owner name + type
     App.exportRows(name, headers, rows)  CSV download (used by Excel/CSV exports)
     App.assetTimeline(id) activity events for an asset (audit + tickets + counts)
*/
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt;

  // ---- 33 SAP fields (verbatim labels from p.11) + WeCGA extension fields ----
  const F = App.SAP_FIELDS = [
    // Identity
    { key: 'company', label: 'Company', group: 'Identity' },
    { key: 'assetClass', label: 'Asset Class', group: 'Identity' },
    { key: 'assetClassDesc', label: 'Asset Class Desc.', group: 'Identity' },
    { key: 'municipality', label: 'Municipality (ECC6.0 Asset No.)', group: 'Identity' },
    { key: 'asset', label: 'Asset', group: 'Identity' },
    { key: 'wecgaCode', label: 'WeCGA Code', group: 'Identity' },
    { key: 'sno', label: 'SNo.', group: 'Identity' },
    { key: 'desc1', label: 'Description 1', group: 'Identity' },
    { key: 'desc2', label: 'Description 2', group: 'Identity' },
    { key: 'serial', label: 'Serial number', group: 'Identity' },
    { key: 'quantity', label: 'Quantity', group: 'Identity', num: true },
    { key: 'baseUnit', label: 'Base Unit', group: 'Identity' },
    // Accounting
    { key: 'capDate', label: 'Cap.Date', group: 'Accounting', fmt: 'date' },
    { key: 'cost', label: 'Cost', group: 'Accounting', fmt: 'money', num: true },
    { key: 'accum', label: 'Accum.', group: 'Accounting', fmt: 'money', num: true },
    { key: 'nbv', label: 'NBV', group: 'Accounting', fmt: 'money', num: true },
    { key: 'costCenter', label: 'Cost Center', group: 'Accounting' },
    { key: 'costCenterName', label: 'Cost Center Name', group: 'Accounting' },
    { key: 'po', label: 'PO number', group: 'Accounting' },
    // Location
    { key: 'location', label: 'Location', group: 'Location' },
    { key: 'locationBasis', label: 'Location basis', group: 'Location', opts: ['SAP', 'employee'] },
    { key: 'locationDesc', label: 'Location Desc.', group: 'Location' },
    { key: 'room', label: 'Room', group: 'Location' },
    { key: 'lat', label: 'Latitude', group: 'Location' },
    { key: 'lng', label: 'Longitude', group: 'Location' },
    { key: 'address', label: 'Address', group: 'Location' },
    { key: 'district', label: 'District', group: 'Location' },
    { key: 'province', label: 'Province', group: 'Location' },
    // WeCGA site hierarchy (separate from SAP location codes)
    { key: 'companyCode', label: 'Company', group: 'Site location' },
    { key: 'project', label: 'Project', group: 'Site location' },
    { key: 'building', label: 'Building', group: 'Site location' },
    { key: 'floor', label: 'Floor', group: 'Site location' },
    { key: 'unit', label: 'Unit', group: 'Site location' },
    // Evaluation
    { key: 'eva4', label: 'Eva4', group: 'Evaluation' },
    { key: 'eva4Desc', label: 'Eva 4 Desc.', group: 'Evaluation' },
    { key: 'evGrp5', label: 'Ev.Grp 5', group: 'Evaluation' },
    { key: 'eva5Desc', label: 'Eva 5 Desc.', group: 'Evaluation' },
    { key: 'wbs', label: 'WBS Element', group: 'Evaluation' },
    // Vendor
    { key: 'vendor', label: 'Vendor', group: 'Vendor' },
    { key: 'vendorName', label: 'Vendor Name', group: 'Vendor' },
    { key: 'manufacturer', label: 'Manufacturer', group: 'Vendor' },
    // Life & warranty
    { key: 'usefulLifePeriod', label: 'Useful Life (Period)', group: 'Life & Warranty' },
    { key: 'usefulLifeYear', label: 'Useful Life (Year)', group: 'Life & Warranty' },
    { key: 'ageOfAsset', label: 'Age of Asset', group: 'Life & Warranty' },
    { key: 'trPrt', label: 'Tr.Prt', group: 'Life & Warranty' },
    { key: 'typeName', label: 'Type Name', group: 'Life & Warranty' },
    { key: 'warranty', label: 'Warranty', group: 'Life & Warranty' },
    // WeCGA extension
    { key: 'brand', label: 'Brand', group: 'WeCGA' },
    { key: 'model', label: 'Model', group: 'WeCGA' },
    { key: 'carNumber', label: 'Serial / Car number', group: 'WeCGA' },
    { key: 'source', label: 'Source', group: 'WeCGA' },
  ];
  const fieldVal = (a, f) => {
    let v = a[f.key];
    if (v == null || v === '') return '-';
    if (f.fmt === 'date') return fmt.date(v);
    if (f.fmt === 'money') return fmt.money(v);
    return v;
  };

  App.assetCode = (a) => a.asset || a.wecgaCode || a.id;
  App.assetTitle = (a) => App.assetCode(a) + ' - ' + [a.desc1, a.desc2].filter(Boolean).join(' ');
  App.ownerLabel = (a) => a.owner ? `${a.owner.name} (${a.owner.type === 'org' ? 'Organization' : 'Individual'})` : '-';

  App.exportRows = (name, headers, rows) => {
    const csv = [headers, ...rows].map(r => r.map(c => {
      const s = String(c == null ? '' : c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    ui.toast('Exported ' + name, 'download');
  };

  const sourceChip = (a) => a.source === 'SAP' ? ui.chip('SAP', 'info')
    : a.source === 'reregistered' ? ui.chip('Re-registered', 'warn')
    : ui.chip('WeCGA manual', 'neutral');

  App.assetTimeline = (id) => {
    const ev = [];
    App.store.audit.filter(x => x.target === id).forEach(x => ev.push({ ts: x.ts, title: x.action, meta: `${x.actor}${x.detail ? ' - ' + x.detail : ''}` }));
    App.store.tickets.filter(t => t.assetId === id).forEach(t => ev.push({ ts: t.created, title: `${t.type} service request ${t.id}`, meta: t.title, icon: 'confirmation_number' }));
    App.store.countResults.filter(c => c.assetId === id).forEach(c => ev.push({ ts: c.date, title: 'Count: ' + c.outcome.replace('_', ' '), meta: c.note || '', icon: 'fact_check' }));
    return ev.sort((a, b) => new Date(b.ts) - new Date(a.ts)).map(e => ({ title: e.title, meta: `${fmt.datetime(e.ts)} - ${e.meta}`, icon: e.icon }));
  };

  // ---------- Register ----------
  const DEFAULT_COLS = ['asset', 'desc1', 'assetClassDesc', 'serial', 'costCenterName', 'location', 'nbv'];
  let state = { cols: DEFAULT_COLS.slice(), q: '', assetClass: '', source: '', tag: '', count: '' };

  function filtered() {
    const comp = App.session.company;
    return App.store.assets.filter(a => {
      if (a.companyCode !== comp) return false;
      if (state.assetClass && a.assetClass !== state.assetClass) return false;
      if (state.source && a.source !== state.source) return false;
      if (state.tag && a.tagStatus !== state.tag) return false;
      if (state.count && a.countStatus !== state.count) return false;
      if (state.q && !App.assetMatches(a, state.q)) return false;
      return true;
    });
  }

  App.registerView('#/assets', {
    title: 'Asset Register',
    render() {
      const rows = filtered();
      const classes = [...new Set(App.store.assets.filter(a => a.companyCode === App.session.company).map(a => a.assetClass))];
      const cols = state.cols.map(k => {
        const f = F.find(x => x.key === k);
        return { key: k, label: f.label, cls: f.num ? 'num' : '', render: r => r === undefined ? '' : fieldVal(r, f) };
      });
      cols.push({ key: '_st', label: 'Tag / Count', render: r => ui.statusChip(r.tagStatus) + ' ' + ui.statusChip(r.countStatus) });
      cols.push({ key: '_qr', label: '', render: r => `<button type="button" class="btn text sm" data-act="printQr" data-id="${r.id}">${App.icon('print')} QR</button>` });
      cols.unshift({ key: '_src', label: 'Source', render: sourceChip });
      cols.unshift({ key: '_img', label: '', render: r => App.assetImg(r, { w: 92, h: 68, cls: 'asset-thumb' }) });

      const toolbar = `
        <div class="table-toolbar">
          <div class="search"><span class="material-symbols-outlined">search</span>
            <input id="q" placeholder="Search asset code, description, serial, owner..." value="${App.esc(state.q)}"></div>
          <select id="fClass"><option value="">All Asset Classes</option>${classes.map(c => `<option value="${c}" ${c === state.assetClass ? 'selected' : ''}>${c}</option>`).join('')}</select>
          <select id="fSource"><option value="">All sources</option><option value="SAP" ${state.source === 'SAP' ? 'selected' : ''}>SAP</option><option value="WeCGA" ${state.source === 'WeCGA' ? 'selected' : ''}>WeCGA manual</option><option value="reregistered" ${state.source === 'reregistered' ? 'selected' : ''}>Re-registered</option></select>
          <select id="fTag"><option value="">Any tag</option><option ${state.tag === 'Tagged' ? 'selected' : ''}>Tagged</option><option ${state.tag === 'Not tagged' ? 'selected' : ''}>Not tagged</option></select>
          <select id="fCount"><option value="">Any count</option><option ${state.count === 'Found' ? 'selected' : ''}>Found</option><option ${state.count === 'Not found' ? 'selected' : ''}>Not found</option><option ${state.count === 'Not counted' ? 'selected' : ''}>Not counted</option></select>
          <span class="table-count">${rows.length} assets</span>
          <span style="margin-left:auto;display:flex;gap:6px">
            <button class="btn tonal sm" id="colBtn">${App.icon('view_column')} Columns</button>
            <button class="btn outline sm" id="csvBtn">${App.icon('download')} CSV</button>
            <button class="btn sm" id="xlsBtn">${App.icon('table_view')} Excel</button>
          </span>
        </div>`;

      return ui.pageHead({
        title: 'Asset Register',
        sub: 'All SAP fields kept verbatim. Assets from SAP need no request; low-value and re-registered assets live on the WeCGA code series.',
      }) + ui.callout('info', 'WeCGA headers mirror SAP headers so Generate / Query / Sort stay easy (requirement p.4). Use <b>Columns</b> to reveal any of the 33 fields.')
        + toolbar
        + ui.table({ columns: cols, rows, rowLink: r => '#/assets/' + r.id, empty: 'No assets for this company / filter' });
    },
    mount(root) {
      const bind = (id, key) => { const el = root.querySelector('#' + id); if (el) el.onchange = e => { state[key] = e.target.value; App.refresh(); }; };
      const q = root.querySelector('#q');
      if (q) q.oninput = e => { state.q = e.target.value; const rows = filtered(); const c = root.querySelector('.table-count'); if (c) c.textContent = rows.length + ' assets'; clearTimeout(q._t); q._t = setTimeout(App.refresh, 300); };
      bind('fClass', 'assetClass'); bind('fSource', 'source'); bind('fTag', 'tag'); bind('fCount', 'count');

      const exp = () => {
        const cols = state.cols.map(k => F.find(x => x.key === k));
        const headers = ['Source', ...cols.map(c => c.label), 'Tag', 'Count', 'Last count'];
        const rows = filtered().map(a => [a.source, ...cols.map(c => fieldVal(a, c).replace(/,/g, '')), a.tagStatus, a.countStatus, fmt.date(a.lastCountDate)]);
        App.exportRows('asset-register.csv', headers, rows);
      };
      const csv = root.querySelector('#csvBtn'); if (csv) csv.onclick = exp;
      const xls = root.querySelector('#xlsBtn'); if (xls) xls.onclick = exp;

      root.querySelectorAll('[data-act="printQr"]').forEach(b => b.onclick = (e) => {
        e.stopPropagation();
        App.printAssetQr(b.getAttribute('data-id'));
      });

      const colBtn = root.querySelector('#colBtn');
      if (colBtn) colBtn.onclick = () => {
        const groups = [...new Set(F.map(f => f.group))];
        const body = groups.map(g => `<div class="field-group-title">${g}</div><div class="pill-row">` +
          F.filter(f => f.group === g).map(f => `<label class="chip outline" style="cursor:pointer"><input type="checkbox" data-col="${f.key}" ${state.cols.includes(f.key) ? 'checked' : ''} style="margin-right:6px">${f.label}</label>`).join('') + `</div>`).join('');
        const dlg = ui.dialog({
          title: 'Choose columns', sub: 'Pick any of the 33 SAP + WeCGA fields to show in the register.', size: 'lg', body,
          actions: [{ label: 'Reset', kind: 'text', act: () => { state.cols = DEFAULT_COLS.slice(); App.refresh(); } }, { label: 'Apply', kind: 'btn', act: () => App.refresh() }],
        });
        dlg.root.querySelectorAll('[data-col]').forEach(cb => cb.onchange = () => {
          const k = cb.getAttribute('data-col');
          if (cb.checked) { if (!state.cols.includes(k)) state.cols.push(k); }
          else state.cols = state.cols.filter(x => x !== k);
        });
      };
    },
  });

  // ---------- Detail ----------
  App.registerView('#/assets/:id', {
    title: ctx => App.asset(ctx.params.id) ? App.assetCode(App.asset(ctx.params.id)) : 'Asset',
    render(ctx) {
      const a = App.asset(ctx.params.id);
      if (!a) return ui.pageHead({ title: 'Asset not found' });
      const groups = [...new Set(F.map(f => f.group))];
      const groupBlock = (g) => {
        const items = F.filter(f => f.group === g).filter(f => a[f.key] != null && a[f.key] !== '');
        if (!items.length) return '';
        return `<div class="field-group-title">${g}</div><dl class="kv">` +
          items.map(f => `<dt>${f.label}</dt><dd class="${f.num ? '' : ''}">${App.esc(fieldVal(a, f))}</dd>`).join('') + `</dl>`;
      };

      const photos = (a.photos && a.photos.length ? a.photos : [{ type: 'Whole asset' }, { type: 'QR code' }, { type: 'Serial number' }]).map(p => `
        <div class="photo-tile">
          ${p.type === 'QR code' ? '' : App.assetImg(a, { w: 320, h: 240 })}
          <span class="ph-tag">${p.type}</span>
          ${p.type === 'QR code' ? '<span class="material-symbols-outlined ph-icon">qr_code_2</span>' : ''}
          <div class="ph-overlay">${a.lat ? `LAT ${a.lat} LNG ${a.lng}<br>${App.esc(a.district || '')}, ${App.esc(a.province || '')}<br>${p.ts ? fmt.datetime(p.ts) : ''}` : 'No metadata (not yet recorded)'}</div>
        </div>`).join('');

      const tickets = App.store.tickets.filter(t => t.assetId === a.id);
      const tl = App.assetTimeline(a.id);

      const actions = `
        <button type="button" class="btn tonal sm" data-nav="#/scan?asset=${a.id}">${App.icon('photo_camera')} Scan & Record</button>
        <button type="button" class="btn tonal sm" id="printQrBtn">${App.icon('print')} Print QR</button>
        <button type="button" class="btn tonal sm" data-nav="#/movement?asset=${a.id}">${App.icon('swap_horiz')} Move</button>
        <button type="button" class="btn outline sm" data-nav="#/writeoff?asset=${a.id}">${App.icon('delete_sweep')} Write-off</button>`;

      return ui.pageHead({
        title: App.assetTitle(a),
        breadcrumb: [{ label: 'Asset Register', hash: '#/assets' }, { label: App.assetCode(a) }],
        sub: `${sourceChip(a)} ${ui.statusChip(a.tagStatus)} ${ui.statusChip(a.countStatus)} &nbsp; Owner: <b>${App.ownerLabel(a)}</b>`,
        actions,
      })
      + `<div class="grid cols-2" style="align-items:start">
          <div>
            ${ui.card({ title: 'Asset fields (SAP + WeCGA)', body: groups.map(groupBlock).join('') })}
          </div>
          <div>
            ${ui.card({ title: `${App.icon('photo_library')} Photos (metadata burned in)`, sub: 'QR code, Serial number, whole asset - carries Lat/Long, district, province, timestamp (p.3 8.2-8.5)', body: `<div class="grid cols-3">${photos}</div>` })}
            ${ui.card({ title: `${App.icon('qr_code_2')} Asset Tag`, actions: `<button type="button" class="btn text sm" id="printQrCardBtn">${App.icon('print')} Print QR</button>`, body: `<div style="display:flex;gap:18px;align-items:center">${ui.qr(App.assetCode(a))}<div class="kv" style="grid-template-columns:auto 1fr"><dt>Owner</dt><dd>${App.ownerLabel(a)}</dd><dt>Owner email</dt><dd>${App.esc(a.owner ? a.owner.email : '-')}</dd><dt>Org head email</dt><dd>${App.esc(a.orgHeadEmail || '-')}</dd><dt>Warranty</dt><dd>${App.esc(a.warranty || '-')}</dd></div></div>` })}
            ${ui.card({ title: `${App.icon('confirmation_number')} Related service requests`, body: tickets.length ? ui.table({ columns: [{ key: 'id', label: 'Service request' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status', render: r => ui.statusChip(r.status) }], rows: tickets, rowLink: r => '#/' + (r.type.startsWith('Write-off') ? 'writeoff' : r.type === 'Transfer' || r.type === 'Borrow' || r.type === 'Repair' ? 'movement' : r.type === 'Registration' ? 'registration' : r.type === 'Handover' ? 'handover' : 'tagging') + '/' + r.id }) : '<div class="muted">No service requests</div>' })}
            ${ui.card({ title: `${App.icon('history')} Activity log (timeline)`, sub: 'Requirement p.11: log activity as a timeline', body: tl.length ? ui.timeline(tl) : '<div class="muted">No activity</div>' })}
          </div>
        </div>`;
    },
    mount(root, ctx) {
      const printQr = () => App.printAssetQr(ctx.params.id);
      const p = root.querySelector('#printQrBtn'); if (p) p.onclick = printQr;
      const pc = root.querySelector('#printQrCardBtn'); if (pc) pc.onclick = printQr;
    },
  });
})();
