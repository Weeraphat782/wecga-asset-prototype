/* Reports catalog (#/reports)
   Covers M9 (p.1 reporting) and D2 (p.11): the Inventory Count report MUST show
   Found / Not found status and the count date. Each report is a print-friendly
   table with Export Excel (App.exportRows -> CSV) and Export PDF (window.print()).
   Respects the company filter (assets.companyCode === App.session.company). */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, esc = App.esc, icon = App.icon;

  const MOVE_TYPES = ['Transfer', 'Borrow', 'Return', 'Repair', 'Change holder'];

  // report registry: id -> {label, requirement, build()}
  // build() returns { headers:[], rows:[[...]], columns, tableRows } so the same
  // data feeds both the on-screen table and the Excel export.
  const REPORTS = {
    register: {
      label: 'Asset Register', icon: 'inventory_2', req: 'M9 - full SAP asset register',
      build() {
        const assets = companyAssets();
        const headers = ['Asset code', 'Description', 'Asset class', 'Serial', 'Cost center', 'Location', 'Cost', 'NBV', 'Tag', 'Count'];
        const rows = assets.map(a => [
          App.assetCode(a), [a.desc1, a.desc2].filter(Boolean).join(' '), a.assetClassDesc, a.serial,
          a.costCenterName, a.locationDesc, a.cost, a.nbv, a.tagStatus, a.countStatus,
        ]);
        const columns = [
          { key: 'code', label: 'Asset code', render: a => `<span class="mono">${esc(App.assetCode(a))}</span>` },
          { key: 'desc', label: 'Description', cls: 'wrap', render: a => esc([a.desc1, a.desc2].filter(Boolean).join(' ')) },
          { key: 'assetClassDesc', label: 'Asset class' },
          { key: 'serial', label: 'Serial', render: a => `<span class="mono">${esc(a.serial || '-')}</span>` },
          { key: 'costCenterName', label: 'Cost center' },
          { key: 'locationDesc', label: 'Location' },
          { key: 'cost', label: 'Cost', cls: 'num', render: a => fmt.money(a.cost) },
          { key: 'nbv', label: 'NBV', cls: 'num', render: a => fmt.money(a.nbv) },
          { key: 'tag', label: 'Tag', render: a => ui.statusChip(a.tagStatus) },
          { key: 'count', label: 'Count', render: a => ui.statusChip(a.countStatus) },
        ];
        return { headers, rows, columns, tableRows: assets, rowLink: a => '#/assets/' + a.id };
      },
    },

    count: {
      label: 'Inventory Count', icon: 'fact_check', req: 'D2 (p.11) - Found / Not found status + count date',
      build() {
        const assets = companyAssets();
        const headers = ['Asset code', 'Description', 'Owner', 'Location', 'Count status', 'Count date'];
        const rows = assets.map(a => [
          App.assetCode(a), [a.desc1, a.desc2].filter(Boolean).join(' '),
          a.owner ? a.owner.name : '-', a.locationDesc, a.countStatus, fmt.date(a.lastCountDate),
        ]);
        const columns = [
          { key: 'code', label: 'Asset code', render: a => `<span class="mono">${esc(App.assetCode(a))}</span>` },
          { key: 'desc', label: 'Description', cls: 'wrap', render: a => esc([a.desc1, a.desc2].filter(Boolean).join(' ')) },
          { key: 'owner', label: 'Owner', render: a => esc(a.owner ? a.owner.name : '-') },
          { key: 'location', label: 'Location', render: a => esc(a.locationDesc || '-') },
          // REQUIREMENT D2: Found / Not found status column
          { key: 'countStatus', label: 'Found / Not found', render: a => ui.statusChip(a.countStatus) },
          // REQUIREMENT D2: count date column
          { key: 'countDate', label: 'Count date', render: a => fmt.date(a.lastCountDate) },
        ];
        return { headers, rows, columns, tableRows: assets, rowLink: a => '#/assets/' + a.id };
      },
    },

    disposal: {
      label: 'Disposal / Write-off', icon: 'delete_sweep', req: 'M9 - disposal report by track & status',
      build() {
        const t = companyTickets().filter(x => (x.type || '').startsWith('Write-off'));
        const headers = ['Service request', 'Track', 'Asset', 'Description', 'Cost', 'NBV', 'Status', 'Opened'];
        const track = (x) => (x.type || '').replace('Write-off ', '') || '-';
        const rows = t.map(x => {
          const a = App.asset(x.assetId) || {};
          return [x.id, track(x), App.assetCode(a) || x.assetId, [a.desc1, a.desc2].filter(Boolean).join(' '), a.cost, a.nbv, x.status, fmt.date(x.created)];
        });
        const columns = [
          { key: 'id', label: 'Service request', render: x => `<span class="mono">${esc(x.id)}</span>` },
          { key: 'track', label: 'Track', render: x => ui.chip(track(x), track(x) === 'Lost' ? 'danger' : track(x) === 'Donation' ? 'ok' : 'info') },
          { key: 'asset', label: 'Asset', render: x => esc(App.assetCode(App.asset(x.assetId) || {}) || x.assetId) },
          { key: 'desc', label: 'Description', cls: 'wrap', render: x => { const a = App.asset(x.assetId) || {}; return esc([a.desc1, a.desc2].filter(Boolean).join(' ')); } },
          { key: 'cost', label: 'Cost', cls: 'num', render: x => fmt.money((App.asset(x.assetId) || {}).cost) },
          { key: 'nbv', label: 'NBV', cls: 'num', render: x => fmt.money((App.asset(x.assetId) || {}).nbv) },
          { key: 'status', label: 'Status', render: x => ui.statusChip(x.status) },
          { key: 'created', label: 'Opened', render: x => fmt.date(x.created) },
        ];
        return { headers, rows, columns, tableRows: t, rowLink: x => '#/writeoff/' + x.id };
      },
    },

    movement: {
      label: 'Movement', icon: 'swap_horiz', req: 'M9 - movement / transfer report',
      build() {
        const t = companyTickets().filter(x => MOVE_TYPES.includes(x.type));
        const headers = ['Service request', 'Type', 'Asset', 'From', 'To', 'Status', 'Opened'];
        const rows = t.map(x => [x.id, x.type, App.assetCode(App.asset(x.assetId) || {}) || x.assetId, x.fromOwner || '-', x.toOwner || '-', x.status, fmt.date(x.created)]);
        const columns = [
          { key: 'id', label: 'Service request', render: x => `<span class="mono">${esc(x.id)}</span>` },
          { key: 'type', label: 'Type', render: x => ui.chip(x.type, 'info') },
          { key: 'asset', label: 'Asset', render: x => esc(App.assetCode(App.asset(x.assetId) || {}) || x.assetId) },
          { key: 'from', label: 'From', render: x => esc(x.fromOwner || '-') },
          { key: 'to', label: 'To', render: x => esc(x.toOwner || '-') },
          { key: 'status', label: 'Status', render: x => ui.statusChip(x.status) },
          { key: 'created', label: 'Opened', render: x => fmt.date(x.created) },
        ];
        return { headers, rows, columns, tableRows: t, rowLink: x => '#/movement/' + x.id };
      },
    },

    kpi: {
      label: 'KPI summary', icon: 'monitoring', req: 'M9 - headline KPI summary',
      build() {
        const assets = companyAssets();
        const tickets = companyTickets();
        const tagged = assets.filter(a => a.tagStatus === 'Tagged').length;
        const found = assets.filter(a => a.countStatus === 'Found').length;
        const notFound = assets.filter(a => a.countStatus === 'Not found').length;
        const notCounted = assets.filter(a => a.countStatus === 'Not counted').length;
        const metrics = [
          ['Total assets', fmt.int(assets.length)],
          ['Total cost value', fmt.money(assets.reduce((s, a) => s + (a.cost || 0), 0))],
          ['Total NBV', fmt.money(assets.reduce((s, a) => s + (a.nbv || 0), 0))],
          ['Tagged assets', `${fmt.int(tagged)} (${assets.length ? Math.round(tagged / assets.length * 100) : 0}%)`],
          ['Found on count', fmt.int(found)],
          ['Not found on count', fmt.int(notFound)],
          ['Not counted', fmt.int(notCounted)],
          ['Open movements', fmt.int(tickets.filter(t => MOVE_TYPES.includes(t.type) && t.status !== 'Completed').length)],
          ['Open write-offs', fmt.int(tickets.filter(t => (t.type || '').startsWith('Write-off') && t.status !== 'Completed').length)],
        ];
        const headers = ['Metric', 'Value'];
        const rows = metrics.map(m => [m[0], String(m[1]).replace(/,/g, '')]);
        const columns = [
          { key: 'm', label: 'Metric', render: r => esc(r[0]) },
          { key: 'v', label: 'Value', cls: 'num', render: r => r[1] },
        ];
        return { headers, rows, columns, tableRows: metrics, rowLink: null };
      },
    },
  };

  function companyAssets() { return App.store.assets.filter(a => a.companyCode === App.session.company); }
  function companyTickets() { return App.store.tickets.filter(t => t.company === App.session.company); }

  let active = 'register';

  App.registerView('#/reports', {
    title: 'Reports',
    render(ctx) {
      if (ctx.query && ctx.query.tab && REPORTS[ctx.query.tab]) active = ctx.query.tab;
      const comp = App.session.company;
      const rep = REPORTS[active];
      const data = rep.build();

      const tabs = ui.tabs('reports', Object.keys(REPORTS).map(k => ({ id: k, label: REPORTS[k].label })), active);

      // print-friendly header (stays visible in the printed PDF)
      const printHead = `<div class="report-print-head" style="margin-bottom:14px">
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
          <h2 style="margin:0;font-size:18px">${icon(rep.icon)} ${esc(rep.label)} Report</h2>
          <span class="muted" style="font-size:12.5px">${esc(App.COMPANIES[comp] || comp)}</span>
        </div>
        <div class="muted" style="font-size:12px;margin-top:2px">
          Generated ${fmt.datetime(new Date().toISOString())} · by ${esc(App.currentUser() ? App.currentUser().name : App.session.role)} · ${data.tableRows.length} rows · <span class="mono">${esc(rep.req)}</span>
        </div>
      </div>`;

      const exportBtns = `<div class="pill-row no-print" style="margin-bottom:12px">
        <button class="btn sm" id="xlsBtn">${icon('table_view')} Export Excel</button>
        <button class="btn outline sm" id="pdfBtn">${icon('picture_as_pdf')} Export PDF</button>
      </div>`;

      const table = ui.table({ columns: data.columns, rows: data.tableRows, rowLink: data.rowLink, empty: 'No records for this report / company' });

      const d2note = active === 'count'
        ? ui.callout('info', 'Requirement <b>D2 (p.11)</b>: this report shows the <b>Found / Not found</b> status and the <b>count date</b> for every asset, plus owner and location.')
        : '';

      return ui.pageHead({
        title: 'Reports',
        sub: 'M9 (p.1) reporting catalog. Every report exports to Excel (CSV) and PDF (print). D2 satisfied by the Inventory Count report.',
      }) + `<div class="no-print">${tabs}</div>` + d2note + ui.card({ body: printHead + exportBtns + table });
    },
    mount(root) {
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { active = b.getAttribute('data-tab'); App.refresh(); });
      const data = REPORTS[active].build();
      const xls = root.querySelector('#xlsBtn');
      if (xls) xls.onclick = () => App.exportRows(`report-${active}.csv`, data.headers, data.rows);
      const pdf = root.querySelector('#pdfBtn');
      if (pdf) pdf.onclick = () => window.print();
    },
  });
})();
