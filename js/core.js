/* =====================================================================
   WeCGA Asset Management - prototype core
   No build, no framework. Load order (see index.html):
     core.js -> seed.js -> coverage.js -> views/*.js
   =====================================================================

   VIEW AUTHOR API  (everything a views/*.js file needs)
   ---------------------------------------------------------------------
   App.registerView(route, config)
     route  : string like "#/assets" or "#/assets/:id" (":x" = param)
     config : {
       title:  string | (ctx)=>string     shown in page head + tab title
       render: (ctx) => htmlString          REQUIRED. Return HTML string.
       mount:  (root, ctx) => void          OPTIONAL. Wire events on `root`.
     }
   ctx = { params:{}, query:{}, store, session, S:store (alias) }

   App.navigate(hash)        change route
   App.refresh()             re-render the current route (after a mutation)
   App.go(hash)              alias for navigate

   App.session              { role, roleName, company, userId } (live)
   App.hasRole(...roles)    boolean
   App.currentUser()        user object for session.userId

   DATA
   App.store  ( = App.S )   { assets, tickets, countPlans, countResults, users, sites, sapLog, audit, seq }
   App.byId(collection, id)
   App.asset(id) / App.ticket(id) / App.user(id)
   App.nextId(prefix)       e.g. App.nextId('TK') -> "TK-0007"
   App.audit(entry)         push {ts, actor, action, target, detail}
   App.addTicket(obj)       pushes ticket, stamps id/created/audit, returns it
   App.advanceTicket(t, note) move ticket to next flow step (records history)

   FLOWS  App.FLOWS[key] = [{title, desc, role?, open?}]  literal PDF steps.
     keys: registration, tagging, firstRecord, handover, movement, transfer,
           lost, writeoffSale, writeoffDonation, writeoffLost, writeoffDispose, count

   UI HELPERS (all return HTML strings unless noted)
   App.ui.pageHead({title, sub, breadcrumb:[{label,hash}], actions:html})
   App.ui.card({title, sub, body, actions, cls})       body = html string
   App.ui.kpi({label, value, foot, icon, tone})
   App.ui.chip(label, kind)         kind: ok|warn|info|danger|neutral|outline
   App.ui.statusChip(status)        maps common status words to a chip
   App.ui.table({columns, rows, rowLink, empty})
        columns:[{key,label,cls?,render?(row)}], rows:[obj], rowLink:(row)=>hash
   App.ui.stepper(steps, currentIndex)  steps:[{title,desc,meta,open}]
   App.ui.timeline(events)          events:[{title,meta,icon}]
   App.ui.field({label,name,type,value,options,hint,required,attrs})
   App.ui.checklist(items)          items:[{label,state:'pass'|'fail'|'pending'}]
   App.ui.callout(kind, html, icon) kind: info|warn|danger|question
   App.ui.qr(label)                 fake QR block
   App.ui.tabs(id, tabs)            tabs:[{id,label}] -> renders bar; you handle clicks by data-tab
   App.ui.phone(innerHtml)          phone frame wrapper

   NOT strings (side effects):
   App.ui.dialog({title, sub, body, actions, size})  -> returns {close()}
       actions:[{label, kind, act:(dlg)=>void, close:true}]
   App.ui.toast(msg, icon)
   App.confirm(title, body, onYes)  convenience dialog

   FORMAT
   App.fmt.money(n) App.fmt.date(d) App.fmt.datetime(d) App.fmt.rel(d)

   CONVENTIONS for interactive elements inside render():
     Put data-act="name" (+ any data-*), then wire in mount():
        root.querySelectorAll('[data-act="foo"]').forEach(el => el.onclick = ...)
   After mutating App.store, call App.refresh() to re-render.
   ===================================================================== */

(function () {
  const App = window.App = {};

  /* ---------------- session / roles ---------------- */
  App.ROLES = {
    employee:  'Employee (Asset Owner)',
    ga:        'GA / RO Admin (Regional)',
    asset_hq:  'Asset Team HQ (Central)',
    accounting:'Accounting',
    it:        'IT',
    engineer:  'Engineering (Network)',
    store:     'Store',
    committee: 'Disposal Committee',
    exec:      'Executive',
  };
  App.COMPANIES = { AIS: 'AIS (2900)', BB: 'BB (Broadband)' };

  App.session = { role: 'asset_hq', company: 'AIS', userId: 'U-001' };
  App.hasRole = (...roles) => roles.includes(App.session.role);
  App.currentUser = () => App.user(App.session.userId);

  /* ---------------- store accessors ---------------- */
  App.store = null; // set by seed.js via App.setStore
  App.setStore = (s) => { App.store = App.S = s; };
  App.byId = (coll, id) => (coll || []).find(x => x.id === id);
  App.asset = (id) => App.byId(App.store.assets, id);
  App.ticket = (id) => App.byId(App.store.tickets, id);
  App.user = (id) => App.byId(App.store.users, id);

  App.nextId = (prefix) => {
    App.store.seq = App.store.seq || {};
    const n = (App.store.seq[prefix] || 0) + 1;
    App.store.seq[prefix] = n;
    return prefix + '-' + String(n).padStart(4, '0');
  };

  App.audit = (entry) => {
    App.store.audit.unshift(Object.assign({
      ts: new Date().toISOString(),
      actor: App.currentUser() ? App.currentUser().name : App.session.role,
    }, entry));
  };

  App.addTicket = (obj) => {
    const t = Object.assign({
      id: App.nextId('TK'),
      created: new Date().toISOString(),
      company: App.session.company,
      stepIndex: 0,
      history: [],
      status: 'Open',
    }, obj);
    App.store.tickets.unshift(t);
    App.audit({ action: 'Create service request', target: t.id, detail: (t.type || '') + ' - ' + (t.title || '') });
    return t;
  };

  App.advanceTicket = (t, note) => {
    const flow = App.FLOWS[t.flow] || [];
    if (t.stepIndex < flow.length - 1) {
      t.stepIndex++;
      t.history.push({ ts: new Date().toISOString(), actor: App.currentUser().name, step: flow[t.stepIndex].title, note: note || '' });
      if (t.stepIndex >= flow.length - 1) t.status = 'Completed';
      App.audit({ action: 'Advance step', target: t.id, detail: flow[t.stepIndex].title });
    }
  };

  // ponytail: older tickets (seed TK-0001) only have assetId
  App.ticketAssetIds = (t) => t && (t.assetIds || (t.assetId ? [t.assetId] : []));

  App.assetMatches = (a, q) => {
    if (!q) return true;
    const hay = [App.assetCode(a), a.desc1, a.desc2, a.serial, a.owner && a.owner.name, a.locationDesc].join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  };

  /* ---------------- FLOWS (literal numbered steps from the requirements PDF) ----------------
     Every ticket detail page renders these as a stepper so the customer can confirm
     "yes, that is exactly our process". Descriptions are English renderings of the Thai steps. */
  App.FLOWS = {
    // Page 4 - registering an asset not found in SAP
    registration: [
      { title: 'Employee submits request', desc: 'Employee finds the asset and sends the request to the Asset Management unit', role: 'employee' },
      { title: 'GA prints QR + GA Verify', desc: 'GA prints the QR code and verifies per the tagging flow', role: 'ga' },
      { title: 'Supervisor / Head-of approval', desc: 'The employee\u2019s supervisor or the holding organization approves the record entry', role: 'employee' },
      { title: 'Store in WeCGA (not in SAP)', desc: 'No SAP registration; asset is kept in the WeCGA database on the WeCGA code series', role: 'asset_hq' },
    ],
    // Page 2 items 5-7 - QR generation & tagging
    tagging: [
      { title: 'Accounting notifies Asset Team', desc: 'Accounting flags a new asset so the team tracks QR tagging', role: 'accounting' },
      { title: 'Asset Team generates QR', desc: 'QR generated by central Asset Team only; company-specific', role: 'asset_hq' },
      { title: 'GA (RO) controls tagging in area', desc: 'GA acts as intermediary controlling tagging within each area', role: 'ga' },
      { title: 'Tag applied', desc: 'Applied by GA-Asset Team (AIS 6 / BB 10 areas) or by the local employee / user', role: 'ga' },
      { title: 'First record (scan + photos)', desc: 'Use WeCGA to scan and record the asset on first receipt', role: 'ga' },
    ],
    // Page 2-3 item 8 - first record on receipt / re-record on count
    firstRecord: [
      { title: 'Scan QR', desc: '8.1 Scan the QR code', role: 'employee' },
      { title: 'Capture 3 photos', desc: '8.2 QR code, Serial number, and whole-asset overview', role: 'employee' },
      { title: 'Location matches real asset', desc: '8.3 Photo location must match the physical asset; Location per SAP', role: 'employee' },
      { title: 'AI serial & fake check', desc: '8.4 AI checks the serial in the photo against the record and whether the photo is fake', role: 'employee', open: true },
      { title: 'Embed Lat/Long & address', desc: '8.5 Photo carries Latitude/Longitude, address, district, province', role: 'employee' },
    ],
    // Page 3 item 9 - handover to holder
    handover: [
      { title: 'Deliver to holder', desc: 'Asset delivered to the Asset Owner (individual or organization)', role: 'ga' },
      { title: 'Send file (item or list)', desc: 'Sent per-item or as a list via Email or as a WeCGA record', role: 'asset_hq' },
      { title: 'Owner accepts in system', desc: 'Receiver accepts the goods in the system to establish traceability', role: 'employee' },
    ],
    // Page 5 - transfer / movement process
    movement: [
      { title: 'Service request in WeCGA', desc: '1. Service request reporting the transfer or receipt in WeCGA', role: 'employee' },
      { title: 'Approval - transferor side', desc: '2. System sends transfer approval to the authority on the transferor side', role: 'employee' },
      { title: 'Approval - receiver side', desc: '3. System sends transfer approval to the authority on the receiver side', role: 'employee' },
      { title: 'Delivered to receiver', desc: '4. Asset delivered to the receiver', role: 'ga' },
      { title: 'Receiver accepts', desc: '5. Receiver accepts in system by scanning QR or pressing accept', role: 'employee' },
      { title: 'Print paper record', desc: '6. Print out as paper for a record', role: 'ga' },
      { title: 'GA Verify', desc: '7. GA verifies the transfer actually happened', role: 'ga' },
      { title: 'Update SAP', desc: '8. Update the data in SAP', role: 'asset_hq' },
      { title: 'Export Excel', desc: '9. Can export the record to Excel', role: 'asset_hq' },
    ],
    // Page 7 - write-off: damaged / not needed => sale
    writeoffSale: [
      { title: 'Supervisor approval', desc: '1. User sends to supervisor along the line for approval', role: 'employee' },
      { title: 'Open write-off service request', desc: '2. User opens service request reporting unused / deteriorated asset for write-off', role: 'employee' },
      { title: 'Insurance claim (if any)', desc: 'Claim insurance if applicable; claimed asset may keep being used (transfer location while awaiting claim) or be sold', role: 'employee' },
      { title: 'Scan + photo (WeCGA)', desc: '4. Scan and photograph via WeCGA', role: 'employee' },
      { title: 'WeCGA generates memo detail', desc: '5. WeCGA generates the detail for the E-memo', role: 'asset_hq', open: true },
      { title: 'Attach approved memo', desc: '6. Attach the approved memo in the service request', role: 'employee' },
      { title: 'Asset Team Verify', desc: '7. Verify cause, COST, NBV, current storage location', role: 'asset_hq' },
      { title: 'Sub-committee approval', desc: '8. Present to the sub-committee to approve write-off', role: 'committee' },
      { title: 'Committee approval', desc: '9. Present to the committee to approve write-off', role: 'committee' },
      { title: 'Vendor pays', desc: '10. Vendor pays money', role: 'asset_hq' },
      { title: 'Attach receipt', desc: '11. Attach the payment receipt', role: 'asset_hq' },
      { title: 'Vendor collects asset', desc: '12. Vendor receives the asset', role: 'asset_hq' },
      { title: 'Remove from SAP', desc: '13. Send data to cut registration out of SAP', role: 'accounting' },
      { title: 'Remove from WeCGA', desc: '14. Cut from WeCGA when there is no SAP Asset Code', role: 'asset_hq' },
      { title: 'PDF report + run number', desc: '15. Print report as PDF for a record with a run number', role: 'asset_hq' },
      { title: 'GA Verify', desc: '16. GA verifies', role: 'ga' },
      { title: 'Update SAP', desc: '17. Update SAP', role: 'accounting' },
      { title: 'Export Excel + E-memo', desc: '18-19. Export Excel report; E-memo to stakeholders. 20. Searchable later', role: 'asset_hq' },
    ],
    // Page 8 - write-off: donation
    writeoffDonation: [
      { title: 'Asset not in use', desc: '1. Asset is not being used', role: 'employee' },
      { title: 'Open donation service request', desc: '2. User opens service request to donate (follow the SAP-asset scan+photo steps 6,7,8)', role: 'employee' },
      { title: 'Asset Team check', desc: '3. Check COST / NBV / current storage location before write-off', role: 'asset_hq' },
      { title: 'Sub-committee', desc: '4. Present to the sub-committee', role: 'committee' },
      { title: 'Committee', desc: '5. Present to the committee', role: 'committee' },
      { title: 'Recipient + certificate', desc: '6. Recipient receives the asset and issues a certificate of appreciation', role: 'asset_hq' },
      { title: 'Remove from SAP', desc: '7. Send data to cut registration from SAP', role: 'accounting' },
      { title: 'Remove from WeCGA', desc: '8. Cut from WeCGA when there is no SAP Asset Code', role: 'asset_hq' },
    ],
    // Page 6 / 9 - loss & write-off lost (with compensation)
    writeoffLost: [
      { title: 'Service request report loss', desc: '1. Service request reporting the loss / write-off', role: 'employee' },
      { title: 'Memo & line approval', desc: '2. On loss, user writes a memo of explanation and requests approval along the line up to Head-of', role: 'employee' },
      { title: 'Asset Team check', desc: '3. Check damage detail, cause, COST, NBV, compensate or not', role: 'asset_hq' },
      { title: 'Sub-committee', desc: '4. Present to the sub-committee', role: 'committee' },
      { title: 'Committee', desc: '5. Present to the committee', role: 'committee' },
      { title: 'Compensate damages', desc: '6. Compensation for damages', role: 'employee' },
      { title: 'Attach compensation receipt', desc: '7. Attach the compensation receipt', role: 'employee' },
      { title: 'Accounting issues receipt', desc: '8. Notify Accounting to issue the receipt', role: 'accounting' },
      { title: 'Remove from SAP', desc: '9. Send data to cut registration from SAP', role: 'accounting' },
      { title: 'Remove from WeCGA', desc: '10. Cut from WeCGA when there is no SAP Asset Code', role: 'asset_hq' },
    ],
    // Destroy / scrap — no sale or donation (M7)
    writeoffDispose: [
      { title: 'Open dispose service request', desc: '1. User opens service request to destroy or scrap asset (no sale or donation)', role: 'employee' },
      { title: 'Scan + photo (WeCGA)', desc: '2. Scan and photograph asset condition before disposal', role: 'employee' },
      { title: 'Asset Team Verify', desc: '3. Verify cause, COST, NBV, current storage location', role: 'asset_hq' },
      { title: 'Sub-committee approval', desc: '4. Present to the sub-committee to approve destruction', role: 'committee' },
      { title: 'Committee approval', desc: '5. Present to the committee to approve destruction', role: 'committee' },
      { title: 'Destroy / scrap asset', desc: '6. Physical destruction or licensed scrap vendor collects asset', role: 'asset_hq' },
      { title: 'Attach destruction evidence', desc: '7. Attach destruction certificate or vendor receipt', role: 'asset_hq' },
      { title: 'Remove from SAP', desc: '8. Send data to cut registration from SAP', role: 'accounting' },
      { title: 'Remove from WeCGA', desc: '9. Cut from WeCGA when there is no SAP Asset Code', role: 'asset_hq' },
      { title: 'GA Verify', desc: '10. GA verifies disposal completed', role: 'ga' },
    ],
    // Page 10 - inventory count
    count: [
      { title: 'Create count plan', desc: '3.1 Create the count plan (annual / ad-hoc)', role: 'asset_hq' },
      { title: 'User sees what to count', desc: '3.2 The user must see what they have to count', role: 'employee' },
      { title: 'Count in area', desc: '3.3 User can count items in their area even when not the owner', role: 'employee' },
      { title: 'Record count result', desc: '3.4 Record the count outcome (found / wrong / not in SAP / damaged / lost / moved)', role: 'employee' },
    ],
  };

  /* ---------------- formatting ---------------- */
  const pad = n => String(n).padStart(2, '0');
  App.fmt = {
    money: (n) => n == null ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    int: (n) => n == null ? '-' : Number(n).toLocaleString('en-US'),
    date: (d) => { if (!d) return '-'; const x = new Date(d); return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()}`; },
    datetime: (d) => { if (!d) return '-'; const x = new Date(d); return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}`; },
    rel: (d) => {
      if (!d) return '';
      const diff = (Date.now() - new Date(d).getTime()) / 1000;
      if (diff < 60) return 'just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    },
  };
  const esc = App.esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- asset photos (Unsplash, verified IDs) ----------------
     Category-matched real photos so the prototype looks realistic. Each <img>
     falls back to a keyword photo (LoremFlickr) then to the CSS gradient, so a
     dropped network connection never shows a broken image during the demo. */
  const UNSPLASH = {
    network: 'photo-1606904825846-647eb07f5be2', server: 'photo-1544197150-b99a580bb7a8',
    laptop: 'photo-1517336714731-489689fd1ca8', monitor: 'photo-1527443224154-c4a3942d3acf',
    chair: 'photo-1580480055273-228ff5388ef8', table: 'photo-1524758631624-e2822e304c36',
    truck: 'photo-1552519507-da3b142c6e3d', van: 'photo-1601584115197-04ecc0da31d7',
    printer: 'photo-1516873240891-4bf014598ab4', projector: 'photo-1626379953822-baec19c3accd',
    keyboard: 'photo-1587829741301-dc798b83add3', tablet: 'photo-1544244015-0df4b3ffc6b0',
    fan: 'photo-1558002038-1055907df827', lamp: 'photo-1507003211169-0a1dd7228f2d',
    office: 'photo-1497366216548-37526070297c',
  };
  function assetCategory(a) {
    const t = [a.desc1, a.desc2, a.assetClassDesc, a.brand, a.model].join(' ').toLowerCase();
    const has = (...w) => w.some(x => t.includes(x));
    if (has('switch', 'router', 'firewall', 'access point', 'network', 'ont', 'gpon', 'echolife')) return 'network';
    if (has('server')) return 'server';
    if (has('notebook', 'laptop', 'macbook', 'thinkpad', 'elitebook', 'travelmate', 'xps', 'latitude', 'acer')) return 'laptop';
    if (has('monitor', 'ultrawide', 'display')) return 'monitor';
    if (has('keyboard')) return 'keyboard';
    if (has('ipad', 'tablet')) return 'tablet';
    if (has('printer', 'laserjet')) return 'printer';
    if (has('projector', 'nebula')) return 'projector';
    if (has('chair')) return 'chair';
    if (has('table', 'desk')) return 'table';
    if (has('fan')) return 'fan';
    if (has('lamp')) return 'lamp';
    if (has('truck', 'pickup', 'd-max', 'isuzu')) return 'truck';
    if (has('van', 'hiace', 'vehicle')) return 'van';
    return 'office';
  }
  App.assetImage = (a, w) => `https://images.unsplash.com/${UNSPLASH[assetCategory(a)]}?w=${w || 400}&q=70&auto=format&fit=crop`;
  App.assetImg = (a, opts) => {
    opts = opts || {};
    const cat = assetCategory(a);
    const primary = `https://images.unsplash.com/${UNSPLASH[cat]}?w=${opts.w || 400}&q=70&auto=format&fit=crop`;
    const fallback = `https://loremflickr.com/${opts.w || 400}/${opts.h || 300}/${encodeURIComponent(cat + ',equipment')}`;
    const onerr = `if(!this.dataset.fb){this.dataset.fb=1;this.src='${fallback}';}else{this.style.display='none';}`;
    return `<img src="${primary}" alt="${esc(a.desc1 || 'asset')}" loading="lazy" class="${opts.cls || ''}" style="${opts.style || ''}" onerror="${onerr}">`;
  };

  /* ---------------- UI helpers ---------------- */
  const icon = (name) => `<span class="material-symbols-outlined">${name}</span>`;
  App.icon = icon;
  const ui = App.ui = {};

  ui.pageHead = ({ title, sub, breadcrumb, actions }) => {
    let bc = '';
    if (breadcrumb && breadcrumb.length) {
      bc = `<div class="breadcrumb">` + breadcrumb.map((b, i) =>
        (b.hash ? `<a data-nav="${b.hash}">${esc(b.label)}</a>` : `<span>${esc(b.label)}</span>`) +
        (i < breadcrumb.length - 1 ? '<span class="bc-sep"> / </span>' : '')
      ).join('') + `</div>`;
    }
    return `<div class="page-head">
      <div>${bc}<h1>${esc(title)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>`;
  };

  ui.card = ({ title, sub, body, actions, cls }) => `
    <div class="card ${cls || ''}">
      ${title ? `<div class="card-title">${title}${actions ? `<span style="margin-left:auto;display:flex;gap:6px">${actions}</span>` : ''}</div>` : ''}
      ${sub ? `<div class="card-sub">${sub}</div>` : ''}
      ${body || ''}
    </div>`;

  ui.kpi = ({ label, value, foot, icon: ic, tone }) => `
    <div class="kpi">
      <div class="kpi-label">${ic ? icon(ic) : ''}${esc(label)}</div>
      <div class="kpi-value" ${tone ? `style="color:var(--${tone})"` : ''}>${value}</div>
      ${foot ? `<div class="kpi-foot">${foot}</div>` : ''}
    </div>`;

  ui.statStrip = (stats) => `<div class="stat-strip">${(stats || []).map(s =>
    `<div class="stat"><div class="stat-label">${s.ic ? icon(s.ic) : ''} ${esc(s.label)}</div><div class="stat-value">${s.value}</div></div>`
  ).join('')}</div>`;

  ui.chip = (label, kind) => `<span class="chip ${kind || 'neutral'}">${esc(label)}</span>`;

  const STATUS_KIND = {
    'Completed': 'ok', 'Done': 'ok', 'Approved': 'ok', 'Verified': 'ok', 'Found': 'ok', 'Accepted': 'ok', 'Active': 'ok', 'Confirmed': 'ok', 'Tagged': 'ok', 'Registered': 'ok',
    'Open': 'info', 'In progress': 'info', 'Pending': 'warn', 'Awaiting approval': 'warn', 'Draft': 'neutral', 'Planned': 'info', 'Awaiting acceptance': 'warn', 'Not tagged': 'warn', 'Not counted': 'neutral', 'Untagged': 'warn',
    'Rejected': 'danger', 'Lost': 'danger', 'Not found': 'danger', 'Damaged': 'danger', 'Blocked': 'danger', 'Written off': 'danger', 'Cancelled': 'neutral',
  };
  ui.statusChip = (status) => ui.chip(status, STATUS_KIND[status] || 'neutral');

  // ponytail: client-side paging in DOM; upgrade path = server-side when rows >> 1000
  const PAGE_SIZES = [5, 10, 20, 50];
  const PAGE_DEFAULT = 10;

  ui.table = ({ columns, rows, rowLink, empty }) => {
    if (!rows || !rows.length) return `<div class="empty">${icon('inbox')}<div>${empty || 'No records'}</div></div>`;
    const head = columns.map(c => `<th class="${c.cls || ''}">${esc(c.label)}</th>`).join('');
    const size = PAGE_DEFAULT;
    const needPager = rows.length > PAGE_SIZES[0];
    const body = rows.map((r, i) => {
      const link = rowLink ? rowLink(r) : null;
      const cells = columns.map(c => {
        const v = c.render ? c.render(r) : (r[c.key] == null ? '-' : esc(r[c.key]));
        return `<td class="${c.cls || ''}">${v}</td>`;
      }).join('');
      const hideCls = needPager && i >= size ? ' pg-hide' : '';
      const cls = ((link ? 'clickable' : '') + hideCls).trim();
      return `<tr${cls ? ` class="${cls}"` : ''} ${link ? `data-nav="${link}"` : ''}>${cells}</tr>`;
    }).join('');
    const table = `<div class="table-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    if (!needPager) return table;
    const end = Math.min(size, rows.length);
    const pager = `<div class="table-pager" data-page="1" data-size="${size}" data-total="${rows.length}">
      <label class="table-pager-size">Rows per page
        <select data-pgsize>${PAGE_SIZES.map(n => `<option value="${n}"${n === size ? ' selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      <span data-pginfo>1-${end} of ${rows.length}</span>
      <button type="button" class="btn text sm" data-pgprev disabled>${icon('chevron_left')}</button>
      <button type="button" class="btn text sm" data-pgnext${rows.length <= size ? ' disabled' : ''}>${icon('chevron_right')}</button>
    </div>`;
    return `<div class="table-block">${table}${pager}</div>`;
  };

  ui.assetPicker = ({ rows, state, columns, empty, selectable }) => {
    const canPick = selectable || (() => true);
    const q = (state && state.q) || '';
    const allRows = rows || [];
    const visible = allRows.filter(a => App.assetMatches(a, q));
    const selectableRows = visible.filter(a => canPick(a));
    const ids = (state && state.assetIds) || [];
    const allPicked = selectableRows.length > 0 && selectableRows.every(a => ids.includes(a.id));
    const pickCol = {
      key: '_pick', label: '',
      render: r => {
        if (!canPick(r)) return `<input type="checkbox" disabled title="Not selectable">`;
        return `<input type="checkbox" data-pick="${r.id}" ${ids.includes(r.id) ? 'checked' : ''}>`;
      },
    };
    const search = `<div class="search" style="margin-bottom:10px"><span class="material-symbols-outlined">search</span>
      <input type="search" id="pickSearch" placeholder="Search asset code, description, serial, owner..." value="${esc(q)}"></div>`;
    const bar = `<div class="pill-row" style="margin-bottom:10px;align-items:center">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="pickAll" ${allPicked ? 'checked' : ''}>
        Select all (${selectableRows.length})
      </label>
      <span class="muted">all pages</span>
      <span class="muted">${ids.length} selected</span>
    </div>`;
    let body;
    if (visible.length) {
      body = ui.table({ columns: [pickCol].concat(columns || []), rows: visible, empty: empty || 'No assets' });
    } else if (allRows.length) {
      body = ui.callout('info', 'No assets match your search.');
    } else {
      body = ui.callout('info', empty || 'No assets available.');
    }
    return `<div id="assetPicker" style="margin-top:14px">${search}${bar}${body}</div>`;
  };

  App.mountAssetPicker = (root, { state, rows, selectable }) => {
    const canPick = selectable || (() => true);
    const allRows = rows || [];
    const visible = () => allRows.filter(a => App.assetMatches(a, state.q || ''));
    const selectableRows = () => visible().filter(a => canPick(a));

    root.querySelectorAll('[data-pick]').forEach(c => c.onchange = () => {
      const id = c.getAttribute('data-pick');
      if (!state.assetIds) state.assetIds = [];
      if (c.checked) { if (!state.assetIds.includes(id)) state.assetIds.push(id); }
      else state.assetIds = state.assetIds.filter(x => x !== id);
      App.refresh();
    });

    const pickAll = root.querySelector('#pickAll');
    if (pickAll) {
      const sr = selectableRows();
      const picked = sr.filter(a => (state.assetIds || []).includes(a.id)).length;
      pickAll.indeterminate = picked > 0 && picked < sr.length;
      pickAll.onchange = () => {
        state.assetIds = pickAll.checked ? selectableRows().map(a => a.id) : [];
        App.refresh();
      };
    }

    const search = root.querySelector('#pickSearch');
    if (search) {
      if (state._qCaret != null) {
        search.focus();
        if (typeof search.setSelectionRange === 'function') search.setSelectionRange(state._qCaret, state._qCaret);
        delete state._qCaret;
      }
      search.oninput = (e) => {
        state.q = e.target.value;
        state._qCaret = e.target.selectionStart;
        clearTimeout(search._t);
        search._t = setTimeout(App.refresh, 250);
      };
    }
  };

  ui.stepper = (steps, current) => `<ul class="stepper">` + steps.map((s, i) => {
    const cls = s.blocked ? 'blocked' : (i < current ? 'done' : (i === current ? 'current' : ''));
    const mark = s.blocked ? icon('block') : (i < current ? icon('check') : (i + 1));
    return `<li class="${cls}">
      <div class="step-rail"><div class="dot">${mark}</div><div class="line"></div></div>
      <div class="step-body">
        <div class="step-title">${esc(s.title)}${s.open ? ` <span class="chip" style="background:#ede0ff;color:#6b3fbb">Open question</span>` : ''}</div>
        ${s.desc ? `<div class="step-desc">${esc(s.desc)}</div>` : ''}
        ${s.meta ? `<div class="step-meta">${s.meta}</div>` : ''}
      </div>
    </li>`;
  }).join('') + `</ul>`;

  ui.stepsBar = (steps, current) => `<div class="steps-bar">` + steps.map((s, i) => {
    const cls = i < current ? 'done' : (i === current ? 'current' : '');
    return `<div class="sb-item ${cls}"><span class="sb-dot">${i < current ? icon('check') : (i + 1)}</span>`
      + `<span class="sb-label">${esc(s.title)}</span></div>`
      + (i < steps.length - 1 ? `<span class="sb-sep"></span>` : '');
  }).join('') + `</div>`;

  ui.timeline = (events) => `<ul class="timeline">` + events.map(e => `
    <li>
      <div class="tl-rail"><div class="tl-dot"></div><div class="tl-line"></div></div>
      <div class="tl-body"><div class="tl-title">${e.icon ? icon(e.icon) + ' ' : ''}${esc(e.title)}</div><div class="tl-meta">${esc(e.meta || '')}</div></div>
    </li>`).join('') + `</ul>`;

  ui.field = ({ label, name, type, value, options, hint, required, attrs, rows }) => {
    type = type || 'text';
    const id = 'f_' + (name || Math.random().toString(36).slice(2));
    let control;
    if (type === 'select') {
      control = `<select name="${name}" id="${id}" ${attrs || ''}>` +
        (options || []).map(o => {
          const val = typeof o === 'string' ? o : o.value;
          const lab = typeof o === 'string' ? o : o.label;
          return `<option value="${esc(val)}" ${val == value ? 'selected' : ''}>${esc(lab)}</option>`;
        }).join('') + `</select>`;
    } else if (type === 'textarea') {
      control = `<textarea name="${name}" id="${id}" rows="${rows || 3}" ${attrs || ''}>${esc(value || '')}</textarea>`;
    } else {
      control = `<input type="${type}" name="${name}" id="${id}" value="${esc(value == null ? '' : value)}" ${attrs || ''}>`;
    }
    return `<div class="field ${required ? 'req' : ''}">
      <label for="${id}">${esc(label)}</label>${control}${hint ? `<span class="hint">${hint}</span>` : ''}
    </div>`;
  };

  /* Site hierarchy: Company → Project → Building → Floor → Unit */
  App.LOC_KEYS = ['company', 'project', 'building', 'floor', 'unit'];

  App.emptyLoc = (company) => ({ company: company || App.session.company, project: '', building: '', floor: '', unit: '' });

  App.locComplete = (loc) => loc && App.LOC_KEYS.every(k => loc[k] && String(loc[k]).trim());

  App.locMatch = (asset, loc) => asset && App.locComplete(loc) && App.LOC_KEYS.every(k => String(asset[k] || '') === String(loc[k] || ''));

  App.locOptions = (sites, partial) => {
    const p = partial || {};
    const ok = (s) => {
      if (p.company && s.company !== p.company) return false;
      if (p.project && s.project !== p.project) return false;
      if (p.building && s.building !== p.building) return false;
      if (p.floor && s.floor !== p.floor) return false;
      return true;
    };
    const uniq = (key) => [...new Set((sites || []).filter(ok).map(s => s[key]).filter(Boolean))].sort();
    return {
      projects: uniq('project'),
      buildings: p.project ? uniq('building') : [],
      floors: p.building ? uniq('floor') : [],
      units: p.floor ? uniq('unit') : [],
    };
  };

  App.locLabel = (x) => {
    if (!x) return '-';
    const parts = [x.project, x.building, x.floor, x.unit].filter(Boolean);
    return parts.length ? parts.join(' · ') : (x.area || '-');
  };

  App.locCell = (a) => {
    if (!a || !a.unit) return `<span class="muted">-</span>`;
    return `<span>${esc(a.unit)}</span><div class="muted" style="font-size:12px">${esc(App.locLabel(a))}</div>`;
  };

  App.captureLocFields = (root, loc, prefix) => {
    if (!root || !loc) return;
    prefix = prefix || 'loc';
    loc.company = App.session.company;
    ['project', 'building', 'floor', 'unit'].forEach(k => {
      const el = root.querySelector(`[name="${prefix}_${k}"]`);
      if (el) loc[k] = el.value;
    });
  };

  ui.locFields = (loc, opts) => {
    const company = App.session.company;
    const sites = (App.store.sites || []).filter(s => s.company === company);
    const l = loc || App.emptyLoc(company);
    l.company = company;
    const o = App.locOptions(sites, l);
    const prefix = (opts && opts.namePrefix) || 'loc';
    const pick = (name, label, options, val, disabled) => {
      const opts2 = [{ value: '', label: 'Select ' + label }].concat((options || []).map(v => ({ value: v, label: v })));
      return ui.field({ label, name: `${prefix}_${name}`, type: 'select', value: val || '', options: opts2, attrs: disabled ? 'disabled' : '' });
    };
    return `<div class="form-grid loc-fields">
      ${ui.field({ label: 'Company', name: `${prefix}_company`, type: 'select', value: company, options: [{ value: company, label: App.COMPANIES[company] || company }], attrs: 'disabled' })}
      ${pick('project', 'Project', o.projects, l.project)}
      ${pick('building', 'Building', o.buildings, l.building, !l.project)}
      ${pick('floor', 'Floor', o.floors, l.floor, !l.building)}
      ${pick('unit', 'Unit', o.units, l.unit, !l.floor)}
    </div>`;
  };

  App.mountLocFields = (root, loc, onChange, prefix) => {
    if (!root || !loc) return;
    prefix = prefix || 'loc';
    const fields = ['project', 'building', 'floor', 'unit'];
    fields.forEach((k, i) => {
      const el = root.querySelector(`[name="${prefix}_${k}"]`);
      if (el) el.onchange = () => {
        App.captureLocFields(root, loc, prefix);
        fields.slice(i + 1).forEach(kk => { loc[kk] = ''; });
        if (onChange) onChange(); else App.refresh();
      };
    });
  };

  App.projectOptions = (company) => {
    const c = company || App.session.company;
    return [...new Set((App.store.sites || []).filter(s => s.company === c).map(s => s.project))].sort();
  };

  /* Multi-select location filter (count plans) */
  App.LOC_FILTER_KEYS = ['companies', 'projects', 'buildings', 'floors', 'units'];
  App.COUNT_TEAM_ROLES = ['employee', 'ga', 'it', 'engineer', 'committee'];
  App.COUNT_TEAM_LABELS = {
    employee: 'พนักงาน',
    ga: 'GA / RO',
    it: 'IT',
    engineer: 'วิศวกร (Network)',
    committee: 'คณะกรรมการ',
  };
  App.countTeamLabel = (role) => role
    ? (App.COUNT_TEAM_LABELS[role] || App.ROLES[role] || role)
    : 'Unassigned';
  App.pkgTeamRoles = (pkg) => {
    if (!pkg) return [];
    if (Array.isArray(pkg.teamRoles) && pkg.teamRoles.length) return pkg.teamRoles;
    if (pkg.teamRole) return [pkg.teamRole];
    return [];
  };
  App.pkgHasTeam = (pkg, role) => App.pkgTeamRoles(pkg).includes(role);
  App.canAssignCountTeam = () => App.hasRole('asset_hq', 'ga');
  App.countPkgById = (plan, pkgId) => (plan && plan.workPackages || []).find(p => p.id === pkgId);
  App.ASSIGN_LEVELS = ['project', 'building', 'floor', 'unit'];

  App.emptyLocFilter = () => ({ companies: [], projects: [], buildings: [], floors: [], units: [] });

  App.locFilterSites = (filter) => {
    const f = filter || App.emptyLocFilter();
    return (App.store.sites || []).filter(s => {
      if (f.companies.length && !f.companies.includes(s.company)) return false;
      if (f.projects.length && !f.projects.includes(s.project)) return false;
      if (f.buildings.length && !f.buildings.includes(s.building)) return false;
      if (f.floors.length && !f.floors.includes(s.floor)) return false;
      if (f.units.length && !f.units.includes(s.unit)) return false;
      return true;
    });
  };

  App.locFilterMatch = (asset, filter) => {
    const f = filter || App.emptyLocFilter();
    if (!asset || !f.companies.length) return false;
    const cc = asset.companyCode || asset.company;
    if (!f.companies.includes(cc)) return false;
    if (f.projects.length && !f.projects.includes(asset.project)) return false;
    if (f.buildings.length && !f.buildings.includes(asset.building)) return false;
    if (f.floors.length && !f.floors.includes(asset.floor)) return false;
    if (f.units.length && !f.units.includes(asset.unit)) return false;
    return true;
  };

  App.locFilterOptions = (filter, key) => {
    const f = filter || App.emptyLocFilter();
    let pool = App.store.sites || [];
    if (key === 'companies') return [...new Set(pool.map(s => s.company))].sort();
    if (!f.companies.length) return [];
    pool = pool.filter(s => f.companies.includes(s.company));
    if (key === 'projects') return [...new Set(pool.map(s => s.project))].sort();
    if (f.projects.length) pool = pool.filter(s => f.projects.includes(s.project));
    if (key === 'buildings') return [...new Set(pool.map(s => s.building))].sort();
    if (f.buildings.length) pool = pool.filter(s => f.buildings.includes(s.building));
    if (key === 'floors') return [...new Set(pool.map(s => s.floor))].sort();
    if (f.floors.length) pool = pool.filter(s => f.floors.includes(s.floor));
    if (key === 'units') return [...new Set(pool.map(s => s.unit))].sort();
    return [];
  };

  App.locFilterTableMeta = (key) => {
    if (key === 'companies') return [{ label: 'Company' }, { label: 'Code' }];
    if (key === 'projects') return [{ label: 'Project' }, { label: 'Company' }];
    if (key === 'buildings') return [{ label: 'Building' }, { label: 'Project' }, { label: 'Company' }];
    if (key === 'floors') return [{ label: 'Floor' }, { label: 'Building' }, { label: 'Project' }];
    if (key === 'units') return [{ label: 'Unit' }, { label: 'Floor' }, { label: 'Building' }, { label: 'Project' }];
    return [];
  };

  App.locFilterRows = (filter, key) => {
    const f = filter || App.emptyLocFilter();
    const opts = App.locFilterOptions(f, key);
    let pool = App.store.sites || [];
    if (key !== 'companies') {
      if (!f.companies.length) return [];
      pool = pool.filter(s => f.companies.includes(s.company));
    }
    if (key !== 'companies' && key !== 'projects' && f.projects.length) pool = pool.filter(s => f.projects.includes(s.project));
    if (['floors', 'units'].includes(key) && f.buildings.length) pool = pool.filter(s => f.buildings.includes(s.building));
    if (key === 'units' && f.floors.length) pool = pool.filter(s => f.floors.includes(s.floor));
    const siteFor = (pred) => pool.find(pred);
    if (key === 'companies') {
      return opts.map(v => ({ value: v, cells: [App.COMPANIES[v] || v, v] }));
    }
    if (key === 'projects') {
      return opts.map(v => {
        const s = siteFor(x => x.project === v);
        return { value: v, cells: [v, s ? (App.COMPANIES[s.company] || s.company) : ''] };
      });
    }
    if (key === 'buildings') {
      return opts.map(v => {
        const s = siteFor(x => x.building === v);
        return { value: v, cells: [v, s ? s.project : '', s ? (App.COMPANIES[s.company] || s.company) : ''] };
      });
    }
    if (key === 'floors') {
      return opts.map(v => {
        const s = siteFor(x => x.floor === v);
        return { value: v, cells: [v, s ? s.building : '', s ? s.project : ''] };
      });
    }
    if (key === 'units') {
      return opts.map(v => {
        const s = siteFor(x => x.unit === v);
        return { value: v, cells: [v, s ? s.floor : '', s ? s.building : '', s ? s.project : ''] };
      });
    }
    return [];
  };

  App.countPackageKey = (asset, level) => {
    const cc = asset.companyCode || asset.company || '';
    if (level === 'project') return [cc, asset.project].join('|');
    if (level === 'building') return [cc, asset.project, asset.building].join('|');
    if (level === 'floor') return [cc, asset.project, asset.building, asset.floor].join('|');
    return [cc, asset.project, asset.building, asset.floor, asset.unit].join('|');
  };

  App.countPackageLabel = (asset, level) => {
    if (level === 'project') return (App.COMPANIES[asset.companyCode] || asset.companyCode) + ' · ' + asset.project;
    if (level === 'building') return asset.project + ' · ' + asset.building;
    if (level === 'floor') return asset.project + ' · ' + asset.building + ' · ' + asset.floor;
    return App.locLabel(asset);
  };

  App.countPackages = (assets, assignLevel) => {
    const level = assignLevel || 'unit';
    const map = new Map();
    (assets || []).forEach(a => {
      if (!a) return;
      const key = App.countPackageKey(a, level);
      if (!map.has(key)) {
        map.set(key, { id: 'PKG-' + (map.size + 1), key, label: App.countPackageLabel(a, level), assetIds: [], teamRoles: [] });
      }
      map.get(key).assetIds.push(a.id);
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  };

  App.locFilterSummary = (key, selected, options, label) => {
    if (!options.length) return 'Select parent first';
    if (!selected.length) return key === 'companies' ? 'Select ' + label : 'All ' + label + 's';
    if (selected.length === 1) {
      const v = selected[0];
      return key === 'companies' ? (App.COMPANIES[v] || v) : v;
    }
    return selected.length + ' selected';
  };

  ui.locFilterFields = (filter) => {
    const f = filter || App.emptyLocFilter();
    const openKey = App._locFilterOpen || '';
    const levels = [
      { key: 'companies', label: 'Company', req: true },
      { key: 'projects', label: 'Project' },
      { key: 'buildings', label: 'Building' },
      { key: 'floors', label: 'Floor' },
      { key: 'units', label: 'Unit' },
    ];
    const fields = levels.map(l => {
      const rows = App.locFilterRows(f, l.key);
      const options = rows.map(r => r.value);
      const selected = f[l.key] || [];
      const allPicked = options.length > 0 && options.every(v => selected.includes(v));
      const summary = App.locFilterSummary(l.key, selected, options, l.label);
      const cols = App.locFilterTableMeta(l.key);
      let panel;
      if (rows.length) {
        const head = `<thead><tr><th class="loc-ms-pick"></th>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>`;
        const body = `<tbody>${rows.map(r => `<tr class="loc-ms-row">
          <td class="loc-ms-pick"><input type="checkbox" data-lf="${l.key}" data-val="${esc(r.value)}" ${selected.includes(r.value) ? 'checked' : ''}></td>
          ${r.cells.map((cell, i) => `<td class="${i ? 'muted' : ''}">${esc(cell)}</td>`).join('')}
        </tr>`).join('')}</tbody>`;
        panel = `<div class="loc-ms-toolbar">
            <label class="loc-ms-all"><input type="checkbox" data-lfall="${l.key}" ${allPicked ? 'checked' : ''}> Select all (${options.length})</label>
            <span class="muted">all pages</span>
            <span class="muted">${selected.length} selected</span>
          </div>
          <div class="loc-ms-scroll"><table class="data loc-ms-table">${head}${body}</table></div>`;
      } else {
        panel = `<div class="loc-ms-empty">Select parent level first</div>`;
      }
      return `<div class="field loc-ms ${l.req ? 'req' : ''} ${openKey === l.key ? 'open' : ''}" data-lfkey="${l.key}">
        <label>${esc(l.label)}</label>
        <div class="loc-ms-control">
          <button type="button" class="loc-ms-trigger" data-lftoggle="${l.key}" ${options.length ? '' : 'disabled'}>
            <span>${esc(summary)}</span>
            ${icon('expand_more')}
          </button>
          <div class="loc-ms-panel" data-lfpanel="${l.key}">${panel}</div>
        </div>
      </div>`;
    }).join('');
    return `<div class="form-grid loc-filter-fields">${fields}</div>`
      + ui.callout('info', 'Leave a level empty (<b>All</b>) to include every value under the level above. At least one <b>Company</b> is required.');
  };

  App.mountLocFilterFields = (root, filter, onChange) => {
    if (!root || !filter) return;
    const refresh = () => { if (onChange) onChange(); else App.refresh(); };
    const toggle = (key, val, on) => {
      if (!filter[key]) filter[key] = [];
      if (on) { if (!filter[key].includes(val)) filter[key].push(val); }
      else filter[key] = filter[key].filter(x => x !== val);
      const idx = App.LOC_FILTER_KEYS.indexOf(key);
      App.LOC_FILTER_KEYS.slice(idx + 1).forEach(k => { filter[k] = []; });
      refresh();
    };
    root.querySelectorAll('[data-lf]').forEach(c => {
      c.onchange = (e) => { e.stopPropagation(); toggle(c.getAttribute('data-lf'), c.getAttribute('data-val'), c.checked); };
    });
    root.querySelectorAll('.loc-ms-row').forEach(row => {
      row.onclick = (e) => {
        if (e.target.tagName === 'INPUT') return;
        const cb = row.querySelector('[data-lf]');
        if (!cb) return;
        cb.checked = !cb.checked;
        toggle(cb.getAttribute('data-lf'), cb.getAttribute('data-val'), cb.checked);
      };
    });
    root.querySelectorAll('[data-lfall]').forEach(c => {
      const key = c.getAttribute('data-lfall');
      const opts = App.locFilterOptions(filter, key);
      const picked = (filter[key] || []).filter(v => opts.includes(v)).length;
      c.indeterminate = picked > 0 && picked < opts.length;
      c.onchange = (e) => {
        e.stopPropagation();
        filter[key] = c.checked ? opts.slice() : [];
        const idx = App.LOC_FILTER_KEYS.indexOf(key);
        App.LOC_FILTER_KEYS.slice(idx + 1).forEach(k => { filter[k] = []; });
        refresh();
      };
    });
    root.querySelectorAll('[data-lftoggle]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const key = btn.getAttribute('data-lftoggle');
        App._locFilterOpen = App._locFilterOpen === key ? null : key;
        refresh();
      };
    });
    root.querySelectorAll('.loc-ms-panel').forEach(p => {
      p.onclick = (e) => e.stopPropagation();
    });
    if (!App._locFilterDocClose) {
      App._locFilterDocClose = true;
      document.addEventListener('click', () => {
        if (!App._locFilterOpen) return;
        App._locFilterOpen = null;
        if (App._views && App.refresh) App.refresh();
      });
    }
  };

  ui.teamPickDropdown = (selected) => {
    const picked = selected || [];
    const roles = App.COUNT_TEAM_ROLES;
    const allPicked = roles.length && roles.every(r => picked.includes(r));
    const summary = !picked.length ? 'Select teams'
      : picked.length === 1 ? App.countTeamLabel(picked[0])
      : picked.length + ' teams selected';
    const rows = roles.map(r => `<tr class="loc-ms-row">
      <td class="loc-ms-pick"><input type="checkbox" data-team="${esc(r)}" value="${esc(r)}" ${picked.includes(r) ? 'checked' : ''}></td>
      <td>${esc(App.countTeamLabel(r))}</td>
      <td class="muted">${esc(App.ROLES[r] || r)}</td>
    </tr>`).join('');
    return `<div class="field loc-ms team-pick" style="margin-bottom:0">
      <label>Counting teams</label>
      <div class="loc-ms-control">
        <button type="button" class="loc-ms-trigger" data-team-toggle>
          <span data-team-summary>${esc(summary)}</span>
          ${icon('expand_more')}
        </button>
        <div class="loc-ms-panel">
          <div class="loc-ms-toolbar">
            <label class="loc-ms-all"><input type="checkbox" data-team-all ${allPicked ? 'checked' : ''}> Select all (${roles.length})</label>
            <span class="muted" data-team-count>${picked.length} selected</span>
          </div>
          <div class="loc-ms-scroll">
            <table class="data loc-ms-table">
              <thead><tr><th class="loc-ms-pick"></th><th>Team</th><th>Role</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;
  };

  App.mountTeamPickDropdown = (root) => {
    const wrap = root && root.querySelector('.team-pick');
    if (!wrap) return;
    const sync = () => {
      const picked = [...wrap.querySelectorAll('[data-team]:checked')].map(c => c.value);
      const cnt = wrap.querySelector('[data-team-count]');
      const sum = wrap.querySelector('[data-team-summary]');
      if (cnt) cnt.textContent = picked.length + ' selected';
      if (sum) {
        sum.textContent = !picked.length ? 'Select teams'
          : picked.length === 1 ? App.countTeamLabel(picked[0])
          : picked.length + ' teams selected';
      }
      const all = wrap.querySelector('[data-team-all]');
      if (all) {
        const roles = App.COUNT_TEAM_ROLES;
        const n = picked.filter(r => roles.includes(r)).length;
        all.indeterminate = n > 0 && n < roles.length;
        all.checked = n === roles.length;
      }
    };
    const trigger = wrap.querySelector('[data-team-toggle]');
    if (trigger) {
      trigger.onclick = (e) => {
        e.stopPropagation();
        wrap.classList.toggle('open');
      };
    }
    wrap.querySelectorAll('[data-team]').forEach(c => { c.onchange = sync; });
    wrap.querySelectorAll('.loc-ms-row').forEach(row => {
      row.onclick = (e) => {
        if (e.target.tagName === 'INPUT') return;
        const cb = row.querySelector('[data-team]');
        if (cb) { cb.checked = !cb.checked; sync(); }
      };
    });
    const pickAll = wrap.querySelector('[data-team-all]');
    if (pickAll) {
      pickAll.onchange = () => {
        wrap.querySelectorAll('[data-team]').forEach(c => { c.checked = pickAll.checked; });
        sync();
      };
    }
    const panel = wrap.querySelector('.loc-ms-panel');
    if (panel) panel.onclick = (e) => e.stopPropagation();
    sync();
  };

  ui.checklist = (items) => `<ul class="checklist">` + items.map(i => {
    const ic = i.state === 'pass' ? 'check_circle' : (i.state === 'fail' ? 'cancel' : 'radio_button_unchecked');
    return `<li class="${i.state}">${icon(ic)}<span>${i.label}${i.note ? ` <span class="muted">- ${esc(i.note)}</span>` : ''}</span></li>`;
  }).join('') + `</ul>`;

  ui.callout = (kind, html, ic) => `<div class="callout ${kind}">${icon(ic || (kind === 'question' ? 'help' : kind === 'danger' ? 'error' : kind === 'warn' ? 'warning' : 'info'))}<div>${html}</div></div>`;

  ui.qr = (label) => `<div style="text-align:center"><div class="qr-box"></div>${label ? `<div class="mono" style="margin-top:6px">${esc(label)}</div>` : ''}</div>`;

  ui.photoTile = (a, type, ts) => {
    const ic = type === 'QR code' ? 'qr_code_2' : type === 'Serial number' ? 'tag' : 'photo_camera';
    const meta = `LAT ${a.lat} LNG ${a.lng}<br>${esc(a.district || '')}, ${esc(a.province || '')}<br>${App.fmt.datetime(ts)}`;
    return `<div class="photo-tile">
      ${type === 'QR code' ? `<span class="material-symbols-outlined ph-icon">${ic}</span>` : App.assetImg(a, { w: 320, h: 240 })}
      <span class="ph-tag">${esc(type)}</span>
      <span class="ph-tag" style="left:auto;right:6px;background:var(--md-primary)">${icon('check')}</span>
      <div class="ph-overlay">${meta}</div>
    </div>`;
  };

  App.printAssetQr = (assetOrId) => {
    const a = typeof assetOrId === 'string' ? App.asset(assetOrId) : assetOrId;
    if (!a) { ui.toast('Asset not found', 'error'); return; }
    const code = App.assetCode(a);
    const desc = [a.desc1, a.desc2].filter(Boolean).join(' ');
    const comp = App.COMPANIES[a.companyCode] || a.companyCode;
    const el = document.createElement('div');
    el.className = 'qr-print-only';
    el.innerHTML = ui.qr(code) + `<div class="qr-print-meta"><b>${esc(desc)}</b><br>${esc(comp)}${a.serial ? '<br><span class="mono">' + esc(a.serial) + '</span>' : ''}</div>`;
    document.body.classList.add('printing-qr');
    document.body.appendChild(el);
    window.print();
    el.remove();
    document.body.classList.remove('printing-qr');
  };

  ui.tabs = (id, tabs, active) => `<div class="tabs" data-tabs="${id}">` +
    tabs.map(t => `<button data-tab="${t.id}" class="${t.id === active ? 'active' : ''}">${esc(t.label)}</button>`).join('') + `</div>`;

  ui.phone = (inner) => `<div class="phone"><div class="phone-notch"></div><div class="phone-screen">
    <div class="phone-statusbar"><span>WeCGA</span><span>${icon('signal_cellular_alt')} ${icon('battery_full')} 09:41</span></div>${inner}</div></div>`;

  ui.dialog = ({ title, sub, body, actions, size }) => {
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    const acts = (actions || [{ label: 'Close', close: true }]).map((a, i) =>
      `<button class="btn ${a.kind || 'text'}" data-act="${i}">${esc(a.label)}</button>`).join('');
    scrim.innerHTML = `<div class="dialog ${size || ''}">
      <h2>${esc(title || '')}</h2>${sub ? `<div class="dialog-sub">${sub}</div>` : ''}
      <div class="dialog-body">${body || ''}</div>
      <div class="dialog-actions">${acts}</div></div>`;
    document.body.appendChild(scrim);
    const close = () => scrim.remove();
    scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
    (actions || [{ close: true }]).forEach((a, i) => {
      const btn = scrim.querySelector(`[data-act="${i}"]`);
      if (btn) btn.onclick = () => { if (a.act) a.act({ close, root: scrim }); if (a.close !== false) close(); };
    });
    return { close, root: scrim };
  };

  App.confirm = (title, body, onYes, yesLabel) => ui.dialog({
    title, body,
    actions: [
      { label: 'Cancel', kind: 'text' },
      { label: yesLabel || 'Confirm', kind: 'btn', act: onYes },
    ],
  });

  ui.toast = (msg, ic) => {
    let host = document.querySelector('.toast-host');
    if (!host) { host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `${icon(ic || 'check_circle')}<span>${esc(msg)}</span>`;
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 2600);
  };

  /* ---------------- router ---------------- */
  const views = App._views = [];
  App.registerView = (route, config) => {
    const parts = route.split('/');
    views.push({ route, parts, config });
  };

  function match(hash) {
    const clean = hash.split('?')[0];
    const query = {};
    if (hash.includes('?')) hash.split('?')[1].split('&').forEach(kv => { const [k, v] = kv.split('='); query[k] = decodeURIComponent(v || ''); });
    const hp = clean.split('/');
    for (const v of views) {
      if (v.parts.length !== hp.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < v.parts.length; i++) {
        if (v.parts[i].startsWith(':')) params[v.parts[i].slice(1)] = decodeURIComponent(hp[i]);
        else if (v.parts[i] !== hp[i]) { ok = false; break; }
      }
      if (ok) return { view: v, params, query };
    }
    return null;
  }

  App.navigate = App.go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
  App.refresh = () => render();

  function render() {
    const hash = location.hash || '#/dashboard';
    const m = match(hash);
    const main = document.getElementById('main');
    // active nav
    document.querySelectorAll('.nav a').forEach(a => {
      const h = a.getAttribute('data-nav');
      a.classList.toggle('active', h === hash || (h !== '#/dashboard' && hash.startsWith(h)));
    });
    document.querySelectorAll('.nav-group').forEach((group, gi) => {
      const g = App.NAV[gi];
      if (!g) return;
      const open = g.items.some(i => hash === i.hash || (i.hash !== '#/dashboard' && hash.startsWith(i.hash)));
      group.classList.toggle('open', open);
    });
    if (!m) {
      main.innerHTML = ui.pageHead({ title: 'Not found' }) + ui.callout('warn', `No screen for <span class="mono">${esc(hash)}</span>`);
      return;
    }
    const ctx = { params: m.params, query: m.query, store: App.store, S: App.store, session: App.session };
    try {
      main.innerHTML = m.view.config.render(ctx) || '';
      document.title = 'WeCGA - ' + (typeof m.view.config.title === 'function' ? m.view.config.title(ctx) : (m.view.config.title || ''));
      if (m.view.config.mount) m.view.config.mount(main, ctx);
      window.scrollTo(0, 0);
    } catch (err) {
      main.innerHTML = ui.pageHead({ title: 'Render error' }) + ui.callout('danger', `<b>${esc(hash)}</b><br><span class="mono">${esc(err.message)}</span><br><pre style="white-space:pre-wrap;font-size:11px">${esc(err.stack || '')}</pre>`);
      console.error(err);
    }
  }

  // global delegated navigation via data-nav
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); App.navigate(nav.getAttribute('data-nav')); return; }
    const prev = e.target.closest('[data-pgprev]');
    const next = e.target.closest('[data-pgnext]');
    if (!prev && !next) return;
    e.preventDefault();
    const block = (prev || next).closest('.table-block');
    if (!block) return;
    const pager = block.querySelector('.table-pager');
    if (!pager) return;
    let page = parseInt(pager.getAttribute('data-page'), 10) || 1;
    if (prev && !prev.disabled) page--;
    if (next && !next.disabled) page++;
    pager.setAttribute('data-page', String(page));
    applyPager(block);
  });
  document.addEventListener('change', (e) => {
    if (!e.target.matches('[data-pgsize]')) return;
    const block = e.target.closest('.table-block');
    if (!block) return;
    const pager = block.querySelector('.table-pager');
    if (!pager) return;
    pager.setAttribute('data-size', String(parseInt(e.target.value, 10) || PAGE_DEFAULT));
    pager.setAttribute('data-page', '1');
    applyPager(block);
  });
  function applyPager(block) {
    const pager = block.querySelector('.table-pager');
    if (!pager) return;
    const size = parseInt(pager.getAttribute('data-size'), 10) || PAGE_DEFAULT;
    const total = parseInt(pager.getAttribute('data-total'), 10) || 0;
    const maxPage = Math.max(1, Math.ceil(total / size));
    let page = parseInt(pager.getAttribute('data-page'), 10) || 1;
    page = Math.min(Math.max(1, page), maxPage);
    pager.setAttribute('data-page', String(page));
    block.querySelectorAll('tbody tr').forEach((tr, i) => {
      tr.classList.toggle('pg-hide', i < (page - 1) * size || i >= page * size);
    });
    const start = total ? (page - 1) * size + 1 : 0;
    const end = Math.min(page * size, total);
    const info = block.querySelector('[data-pginfo]');
    if (info) info.textContent = total ? `${start}-${end} of ${total}` : '0 of 0';
    const prevBtn = block.querySelector('[data-pgprev]');
    const nextBtn = block.querySelector('[data-pgnext]');
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= maxPage;
  }
  window.addEventListener('hashchange', render);

  /* ---------------- navigation model ---------------- */
  App.NAV = [
    { group: 'Overview', icon: 'home', items: [
      { hash: '#/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { hash: '#/assets', label: 'Asset Register', icon: 'inventory_2' },
    ]},
    { group: 'Intake & Registration', icon: 'input', items: [
      { hash: '#/intake', label: 'Procurement / SAP Inbound', icon: 'input' },
      { hash: '#/registration', label: 'Manual Registration', icon: 'note_add' },
      { hash: '#/tagging', label: 'Tagging', icon: 'qr_code_2' },
      { hash: '#/handover', label: 'Handover', icon: 'assignment_ind' },
    ]},
    { group: 'Operations', icon: 'build_circle', items: [
      { hash: '#/movement', label: 'Movement', icon: 'swap_horiz' },
      { hash: '#/counts', label: 'Inventory Counts', icon: 'fact_check' },
      { hash: '#/reconcile', label: 'Reconciliation', icon: 'difference' },
      { hash: '#/writeoff', label: 'Disposal / Write-off', icon: 'delete_sweep' },
    ]},
    { group: 'Insight', icon: 'insights', items: [
      { hash: '#/reports', label: 'Reports', icon: 'summarize' },
      { hash: '#/help', label: 'Help Center', icon: 'help' },
      { hash: '#/audit', label: 'Audit Log', icon: 'history' },
      { hash: '#/coverage', label: 'Requirements Coverage', icon: 'rule' },
    ]},
  ];
  App.NAV_AFTER = [
    { hash: '#/admin', label: 'Administration', icon: 'admin_panel_settings' },
  ];

  function ticketBadge(hash) {
    if (!App.store) return 0;
    const map = {
      '#/movement': t => t.type && ['Transfer', 'Borrow', 'Return', 'Repair', 'Change holder'].includes(t.type),
      '#/writeoff': t => t.type && t.type.startsWith('Write-off'),
    };
    if (map[hash]) return App.store.tickets.filter(t => map[hash](t) && t.status !== 'Completed').length;
    return 0;
  }

  App.renderNav = () => {
    const nav = document.getElementById('nav');
    const hash = location.hash || '#/dashboard';
    nav.innerHTML = App.NAV.map((g, gi) => {
      const open = g.items.some(i => hash === i.hash || (i.hash !== '#/dashboard' && hash.startsWith(i.hash)));
      return `<div class="nav-group${open ? ' open' : ''}" data-nav-group="${gi}">
        <button type="button" class="nav-group-toggle" aria-expanded="${open}">
          ${icon(g.icon || 'folder')}
          <span class="nav-group-title">${esc(g.group)}</span>
          <span class="material-symbols-outlined nav-chevron">expand_more</span>
        </button>
        <div class="nav-group-items">
          ${g.items.map(i => {
            const b = ticketBadge(i.hash);
            const active = hash === i.hash || (i.hash !== '#/dashboard' && hash.startsWith(i.hash));
            return `<a class="${active ? 'active' : ''}" data-nav="${i.hash}">${icon(i.icon)}<span>${esc(i.label)}</span>${b ? `<span class="badge">${b}</span>` : ''}</a>`;
          }).join('')}
        </div>
      </div>`;
    }).join('') + (App.NAV_AFTER || []).map(i => {
      const active = hash === i.hash || hash.startsWith(i.hash);
      return `<a class="nav-standalone${active ? ' active' : ''}" data-nav="${i.hash}">${icon(i.icon)}<span>${esc(i.label)}</span></a>`;
    }).join('');
    nav.querySelectorAll('.nav-group-toggle').forEach(btn => {
      btn.onclick = () => btn.closest('.nav-group').classList.toggle('open');
    });
  };

  /* ---------------- app bar controls ---------------- */
  App.renderBar = () => {
    const user = App.currentUser();
    const roleSel = `<div class="bar-select"><span class="bar-label">Role</span>
      <select id="roleSel">${Object.entries(App.ROLES).map(([k, v]) => `<option value="${k}" ${k === App.session.role ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>`;
    const compSel = `<div class="bar-select"><span class="bar-label">Company</span>
      <select id="compSel">${Object.entries(App.COMPANIES).map(([k, v]) => `<option value="${k}" ${k === App.session.company ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>`;
    const profile = `<button type="button" class="bar-profile" id="barProfile" title="Demo profile">
      ${icon('account_circle')}
      <span class="bar-profile-meta">
        <span class="bar-profile-name">${esc(user ? user.name : 'Demo user')}</span>
        <span class="bar-profile-role">${esc(App.ROLES[App.session.role] || '')}</span>
      </span>
    </button>`;
    document.getElementById('barControls').innerHTML =
      `<button type="button" class="btn-icon" title="Help Center" data-nav="#/help">${icon('help')}</button>` +
      `<button type="button" class="btn-icon" title="Notifications">${icon('notifications')}</button>` +
      roleSel + compSel + profile;
    document.getElementById('roleSel').onchange = (e) => {
      App.session.role = e.target.value;
      const u = App.store.users.find(u => u.role === e.target.value);
      if (u) App.session.userId = u.id;
      App.renderBar();
      App.renderNav();
      render();
      ui.toast('Viewing as ' + App.ROLES[e.target.value], 'switch_account');
    };
    document.getElementById('compSel').onchange = (e) => {
      App.session.company = e.target.value;
      App.renderNav();
      render();
    };
  };

  /* ---------------- boot ---------------- */
  App.start = () => {
    const toggle = document.getElementById('navToggle');
    if (toggle) toggle.onclick = () => document.body.classList.toggle('nav-collapsed');
    App.renderBar();
    App.renderNav();
    if (!location.hash) location.hash = '#/dashboard';
    render();
    if (App.coverageSelfCheck) {
      const r = App.coverageSelfCheck();
      console.log(`[coverage] ${r.covered}/${r.total} requirements mapped to a live route` + (r.gaps.length ? `, GAPS: ${r.gaps.join(', ')}` : ', no gaps'));
    }
  };
})();
