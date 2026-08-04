/* Administration (#/admin)
   Covers: M8 (SAP S/4HANA integration), M10 (admin / master data / roles),
           C1 (Asset Team HQ = system admin nationwide),
           C2 (GA/RO = regional admin, transfer only within own area),
           C3 (Committee = mass scan without photo, rights time-bound),
           C4 (IT = mass scan without photo),
           C5 (Engineering = mass scan without photo, technician equipment only).
   Screen references: page 1 (personas / rights) and page 10 (roles & permissions). */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, icon = App.icon;

  let tab = 'roles';

  /* ---- capability matrix (page 1 + page 10) ------------------------------
     Each cell is [label, chipKind]. Kinds: ok | warn | info | neutral | danger.
     Columns map to the rights called out in the requirements. */
  const CAPS = [
    { key: 'view', label: 'View all' },
    { key: 'register', label: 'Register' },
    { key: 'qr', label: 'Generate QR' },
    { key: 'transfer', label: 'Transfer' },
    { key: 'count', label: 'Count mode' },
    { key: 'writeoff', label: 'Approve write-off' },
    { key: 'sap', label: 'SAP config' },
    { key: 'admin', label: 'Admin' },
  ];

  const NO = ['\u2014', 'neutral'];
  const MASS = ['Mass scan (no photo)', 'ok'];
  const PHOTO = ['Scan + photo', 'info'];

  // role -> { cap: [label, kind] }
  const MATRIX = {
    asset_hq: {
      view: ['Nationwide', 'ok'], register: ['Yes', 'ok'], qr: ['Yes (central only)', 'ok'],
      transfer: ['Nationwide', 'ok'], count: PHOTO, writeoff: ['Verify + prepare', 'info'],
      sap: ['Full config', 'ok'], admin: ['System admin (nationwide)', 'ok'],
    },
    ga: {
      view: ['Nationwide', 'ok'], register: ['Yes', 'ok'], qr: ['Control tagging only', 'warn'],
      transfer: ['Own area only', 'warn'], count: PHOTO, writeoff: ['GA verify', 'info'],
      sap: NO, admin: ['Regional admin', 'info'],
    },
    employee: {
      view: ['Own / holding org', 'neutral'], register: ['Request', 'info'], qr: NO,
      transfer: ['Request', 'info'], count: PHOTO, writeoff: NO, sap: NO, admin: NO,
    },
    accounting: {
      view: ['Nationwide', 'ok'], register: ['Notify Asset Team', 'info'], qr: NO,
      transfer: NO, count: NO, writeoff: ['Cut SAP registration', 'info'],
      sap: ['SAP master data', 'info'], admin: NO,
    },
    it: {
      view: ['Own equipment', 'neutral'], register: ['Request', 'info'], qr: NO,
      transfer: ['Request', 'info'], count: MASS, writeoff: NO, sap: NO, admin: NO,
    },
    engineer: {
      view: ['Technician equipment only', 'neutral'], register: ['Request', 'info'], qr: NO,
      transfer: ['Request', 'info'], count: MASS, writeoff: NO, sap: NO, admin: NO,
    },
    store: {
      view: ['Custody scope', 'neutral'], register: ['Request', 'info'], qr: NO,
      transfer: ['Custody moves', 'info'], count: PHOTO, writeoff: NO, sap: NO, admin: NO,
    },
    committee: {
      view: ['Nationwide (review)', 'ok'], register: NO, qr: NO, transfer: NO,
      count: MASS, writeoff: ['Approve', 'ok'], sap: NO, admin: ['Time-bound rights', 'warn'],
    },
    exec: {
      view: ['Nationwide (read-only)', 'ok'], register: NO, qr: NO, transfer: NO,
      count: NO, writeoff: NO, sap: NO, admin: ['Read-only', 'neutral'],
    },
  };

  function rolesBody() {
    const cell = (spec) => spec ? ui.chip(spec[0], spec[1]) : ui.chip('\u2014', 'neutral');
    const head = `<th>Role / persona</th>` + CAPS.map(c => `<th>${App.esc(c.label)}</th>`).join('');
    const body = Object.keys(App.ROLES).map(rk => {
      const m = MATRIX[rk] || {};
      const cells = CAPS.map(c => `<td>${cell(m[c.key])}</td>`).join('');
      return `<tr><td><b>${App.esc(App.ROLES[rk])}</b><div class="muted mono" style="font-size:11px">${rk}</div></td>${cells}</tr>`;
    }).join('');
    const matrix = `<div class="table-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;

    const legend = `<div class="pill-row" style="margin-top:10px">
      ${ui.chip('Scan + photo', 'info')} <span class="muted">must photograph the asset (baseline)</span>
      &nbsp; ${ui.chip('Mass scan (no photo)', 'ok')} <span class="muted">may scan many items without photos (C3/C4/C5)</span>
      &nbsp; ${ui.chip('Own area only', 'warn')} <span class="muted">right is scoped or time-limited</span>
      &nbsp; ${ui.chip('\u2014', 'neutral')} <span class="muted">no right</span>
    </div>`;

    const committee = ui.card({
      title: `${icon('schedule')} Committee time-bound rights (C3)`,
      sub: 'Disposal Committee members may mass-scan without photos, but only inside a granted time window. Outside the window the rights lapse automatically.',
      body: `<div class="grid cols-3">
        ${ui.field({ label: 'Grant valid from', name: 'ttlFrom', type: 'date', value: '2026-01-15' })}
        ${ui.field({ label: 'Grant valid to', name: 'ttlTo', type: 'date', value: '2026-02-15' })}
        ${ui.field({ label: 'Bound to count plan', name: 'ttlPlan', type: 'select', value: 'CP-2026', options: App.store.countPlans.map(p => ({ value: p.id, label: p.name })) })}
      </div>`,
    });

    return ui.callout('info',
      '<b>Page 1 & page 10 - roles & permissions.</b> Rights below are exactly the persona rules from the requirements: '
      + 'Asset Team HQ is the nationwide system admin (C1); GA/RO is a regional admin that sees all assets but can transfer only within its own area (C2); '
      + 'the Committee (C3), IT (C4) and Engineering (C5) may mass-scan without photos, while everyone else must scan <i>and</i> photograph.')
      + ui.card({ title: `${icon('grid_on')} Permission matrix (9 personas)`, body: matrix + legend })
      + committee;
  }

  function usersBody() {
    const areaName = (u) => {
      if (!u.area) return '-';
      const a = App.store.areas.find(x => x.code === u.area || x.name === u.area);
      return a ? `${a.code} - ${a.name}` : u.area;
    };
    const rows = App.store.users;
    return ui.card({
      title: `${icon('group')} Users (${rows.length})`,
      sub: 'Every login is bound to a role, a holding organization and (for GA) a GA area. <span class="muted">M10</span>',
      actions: `<button class="btn sm" id="addUserBtn">${icon('person_add')} Add user</button>`,
      body: ui.table({
        columns: [
          { key: 'name', label: 'Name', render: r => `<b>${App.esc(r.name)}</b>` },
          { key: 'role', label: 'Role', render: r => App.esc(App.ROLES[r.role] || r.role) },
          { key: 'org', label: 'Organization' },
          { key: '_area', label: 'GA area', render: areaName },
          { key: 'email', label: 'Email', render: r => `<span class="mono">${App.esc(r.email)}</span>` },
          { key: 'company', label: 'Company', render: r => ui.chip(App.COMPANIES[r.company] || r.company, 'outline') },
        ],
        rows,
        empty: 'No users',
      }),
    });
  }

  function distinct(list, keyFn) {
    const seen = new Map();
    list.forEach(x => { const [k, v] = keyFn(x); if (k && !seen.has(k)) seen.set(k, v); });
    return [...seen.entries()];
  }

  function masterBody() {
    const companies = ui.card({
      title: `${icon('domain')} Companies`,
      sub: 'Two legal entities. Assets, QR series and SAP company codes are kept per company.',
      body: ui.table({
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Company' },
          { key: 'sap', label: 'SAP company code' },
        ],
        rows: [
          { code: 'AIS', name: App.COMPANIES.AIS, sap: '2900' },
          { code: 'BB', name: App.COMPANIES.BB, sap: '2901' },
        ],
      }),
    });

    const areasByCompany = ['AIS', 'BB'].map(c => {
      const rows = App.store.areas.filter(a => a.company === c);
      return ui.card({
        title: `${icon('map')} GA areas - ${App.COMPANIES[c]} (${rows.length})`,
        sub: c === 'AIS' ? 'AIS operates 6 GA areas.' : 'BB operates 10 GA areas.',
        body: ui.table({ columns: [{ key: 'code', label: 'Area code' }, { key: 'name', label: 'Area name' }], rows }),
      });
    }).join('');

    const costCenters = distinct(App.store.assets, a => [a.costCenter, a.costCenterName])
      .map(([code, name]) => ({ code, name }));
    const cc = ui.card({
      title: `${icon('account_tree')} Cost centers (${costCenters.length})`,
      sub: 'Derived from the asset register.',
      body: ui.table({ columns: [{ key: 'code', label: 'Cost center' }, { key: 'name', label: 'Name' }], rows: costCenters }),
    });

    const classes = distinct(App.store.assets, a => [a.assetClass, a.assetClassDesc])
      .map(([code, desc]) => ({ code, desc }));
    const ac = ui.card({
      title: `${icon('category')} Asset classes (${classes.length})`,
      sub: 'Derived from the asset register.',
      body: ui.table({ columns: [{ key: 'code', label: 'Class' }, { key: 'desc', label: 'Description' }], rows: classes }),
    });

    const locations = distinct(App.store.assets, a => [a.location, a.locationDesc])
      .map(([code, desc]) => ({ code, desc }));
    const loc = ui.card({
      title: `${icon('location_on')} Locations (${locations.length})`,
      sub: 'Derived from the asset register.',
      body: ui.table({ columns: [{ key: 'code', label: 'Location code' }, { key: 'desc', label: 'Location description' }], rows: locations }),
    });

    return ui.callout('info', 'Master data below drives the dropdowns across the app. In production these are editable; here they are seeded and derived from the asset register. <span class="muted">M10</span>')
      + companies + areasByCompany
      + `<div class="grid cols-2" style="align-items:start">${cc}${ac}</div>`
      + loc;
  }

  function sapBody() {
    const cfg = ui.card({
      title: `${icon('settings_ethernet')} SAP S/4HANA connection`,
      sub: 'Integration endpoint and schedule. <span class="muted">M8</span>',
      body: `<div class="grid cols-2">
          ${ui.field({ label: 'OData / API endpoint', name: 'sapEndpoint', value: 'https://s4hana.wecga.co.th/sap/opu/odata/sap/ZASSET_SRV' })}
          ${ui.field({ label: 'SAP client', name: 'sapClient', value: '100' })}
          ${ui.field({ label: 'Sync schedule', name: 'sapSchedule', type: 'select', value: 'Nightly 02:00', options: ['Realtime (event)', 'Hourly', 'Nightly 02:00', 'Manual only'] })}
          ${ui.field({ label: 'Auth', name: 'sapAuth', type: 'select', value: 'OAuth 2.0', options: ['OAuth 2.0', 'Basic', 'X.509 cert'] })}
        </div>
        <div class="field-group-title">Direction</div>
        <div class="pill-row">
          <label class="chip outline" style="cursor:pointer"><input type="checkbox" checked style="margin-right:6px">Inbound: asset master &amp; GR from SAP</label>
          <label class="chip outline" style="cursor:pointer"><input type="checkbox" checked style="margin-right:6px">Outbound: owner / location updates to SAP</label>
          <label class="chip outline" style="cursor:pointer"><input type="checkbox" checked style="margin-right:6px">Outbound: write-off / retire to SAP</label>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px">
          <button class="btn" id="syncBtn">${icon('sync')} Run sync now</button>
          <button class="btn outline" id="sapCsvBtn">${icon('download')} Export log (CSV)</button>
        </div>`,
    });

    const dirChip = (d) => d === 'inbound' ? ui.chip('Inbound', 'info') : ui.chip('Outbound', 'warn');
    const log = ui.card({
      title: `${icon('sync_alt')} Integration message log (${App.store.sapLog.length})`,
      sub: 'Inbound and outbound messages exchanged with SAP.',
      body: ui.table({
        columns: [
          { key: 'dir', label: 'Direction', render: r => dirChip(r.dir) },
          { key: 'ts', label: 'Timestamp', render: r => fmt.datetime(r.ts) },
          { key: 'type', label: 'Message type' },
          { key: 'ref', label: 'Reference', render: r => `<span class="mono">${App.esc(r.ref)}</span>` },
          { key: 'status', label: 'Status', render: r => ui.statusChip(r.status) },
          { key: 'detail', label: 'Detail' },
        ],
        rows: App.store.sapLog,
        empty: 'No messages',
      }),
    });

    return ui.callout('info', 'WeCGA and SAP S/4HANA stay in sync in both directions. New assets and Goods Receipts flow inbound; owner/location changes and write-offs flow outbound. <span class="muted">M8</span>')
      + cfg + log;
  }

  App.registerView('#/admin', {
    title: 'Administration',
    render() {
      const body = tab === 'users' ? usersBody()
        : tab === 'master' ? masterBody()
        : tab === 'sap' ? sapBody()
        : rolesBody();
      return ui.pageHead({
        title: 'Administration',
        sub: 'Roles &amp; permissions, users, master data and the SAP S/4HANA integration. <span class="muted">M8, M10 - pages 1 &amp; 10</span>',
      })
      + ui.tabs('adminTabs', [
          { id: 'roles', label: 'Roles & permissions' },
          { id: 'users', label: 'Users' },
          { id: 'master', label: 'Master data' },
          { id: 'sap', label: 'SAP S/4HANA Integration' },
        ], tab)
      + body;
    },
    mount(root) {
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.getAttribute('data-tab'); App.refresh(); });

      const addBtn = root.querySelector('#addUserBtn');
      if (addBtn) addBtn.onclick = () => {
        const dlg = ui.dialog({
          title: 'Add user',
          sub: 'Create a login bound to a role and (for GA) a GA area.',
          size: 'lg',
          body: `<div class="grid cols-2">
              ${ui.field({ label: 'Full name', name: 'name', required: true })}
              ${ui.field({ label: 'Email', name: 'email', type: 'email', required: true })}
              ${ui.field({ label: 'Role', name: 'role', type: 'select', options: Object.entries(App.ROLES).map(([v, l]) => ({ value: v, label: l })) })}
              ${ui.field({ label: 'GA area (GA roles)', name: 'area', type: 'select', options: [{ value: '', label: '- none -' }].concat(App.store.areas.map(a => ({ value: a.code, label: `${a.code} - ${a.name}` }))) })}
            </div>`,
          actions: [
            { label: 'Cancel', kind: 'text' },
            { label: 'Add user', kind: 'btn', act: ({ root: r }) => {
              const val = (n) => { const el = r.querySelector(`[name="${n}"]`); return el ? el.value.trim() : ''; };
              const name = val('name');
              if (!name) { ui.toast('Name is required', 'error'); return; }
              const id = 'U-' + String(App.store.users.length + 1).padStart(3, '0');
              const u = { id, name, role: val('role'), email: val('email'), org: '-', company: App.session.company };
              if (val('area')) u.area = val('area');
              App.store.users.push(u);
              App.audit({ action: 'Add user', target: id, detail: `${name} (${App.ROLES[u.role] || u.role})` });
              tab = 'users';
              App.refresh();
              ui.toast('User ' + name + ' added', 'person_add');
            } },
          ],
        });
        return dlg;
      };

      const runSync = (append) => {
        const ref = 'BATCH-' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
        if (append) App.store.sapLog.unshift({
          id: App.nextId('SAP'), dir: 'inbound', ts: new Date().toISOString(),
          type: 'Manual sync', ref, status: 'Processed', detail: 'On-demand sync triggered from Administration',
        });
        App.audit({ action: 'SAP sync run', target: ref, detail: 'Manual sync from Administration (M8)' });
      };
      const syncBtn = root.querySelector('#syncBtn');
      if (syncBtn) syncBtn.onclick = () => { runSync(true); App.refresh(); ui.toast('SAP sync started - log updated', 'sync'); };

      const sapCsv = root.querySelector('#sapCsvBtn');
      if (sapCsv) sapCsv.onclick = () => App.exportRows('sap-integration-log.csv',
        ['Direction', 'Timestamp', 'Type', 'Reference', 'Status', 'Detail'],
        App.store.sapLog.map(l => [l.dir, fmt.datetime(l.ts), l.type, l.ref, l.status, l.detail]));
    },
  });
})();
