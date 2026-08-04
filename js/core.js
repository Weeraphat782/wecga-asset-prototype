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
   App.store  ( = App.S )   { assets, tickets, countPlans, countResults, users, areas, sapLog, audit, seq }
   App.byId(collection, id)
   App.asset(id) / App.ticket(id) / App.user(id)
   App.nextId(prefix)       e.g. App.nextId('TK') -> "TK-0007"
   App.audit(entry)         push {ts, actor, action, target, detail}
   App.addTicket(obj)       pushes ticket, stamps id/created/audit, returns it
   App.advanceTicket(t, note) move ticket to next flow step (records history)

   FLOWS  App.FLOWS[key] = [{title, desc, role?, open?}]  literal PDF steps.
     keys: registration, tagging, firstRecord, handover, movement, transfer,
           lost, writeoffSale, writeoffDonation, writeoffLost, count

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
    App.audit({ action: 'Create ticket', target: t.id, detail: (t.type || '') + ' - ' + (t.title || '') });
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
      { title: 'Ticket in WeCGA', desc: '1. Ticket reporting the transfer or receipt in WeCGA', role: 'employee' },
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
      { title: 'Open write-off ticket', desc: '2. User opens ticket reporting unused / deteriorated asset for write-off', role: 'employee' },
      { title: 'Insurance claim (if any)', desc: 'Claim insurance if applicable; claimed asset may keep being used (transfer location while awaiting claim) or be sold', role: 'employee' },
      { title: 'Scan + photo (WeCGA)', desc: '4. Scan and photograph via WeCGA', role: 'employee' },
      { title: 'WeCGA generates memo detail', desc: '5. WeCGA generates the detail for the E-memo', role: 'asset_hq', open: true },
      { title: 'Attach approved memo', desc: '6. Attach the approved memo in the ticket', role: 'employee' },
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
      { title: 'Open donation ticket', desc: '2. User opens ticket to donate (follow the SAP-asset scan+photo steps 6,7,8)', role: 'employee' },
      { title: 'Asset Team check', desc: '3. Check COST / NBV / current storage location before write-off', role: 'asset_hq' },
      { title: 'Sub-committee', desc: '4. Present to the sub-committee', role: 'committee' },
      { title: 'Committee', desc: '5. Present to the committee', role: 'committee' },
      { title: 'Recipient + certificate', desc: '6. Recipient receives the asset and issues a certificate of appreciation', role: 'asset_hq' },
      { title: 'Remove from SAP', desc: '7. Send data to cut registration from SAP', role: 'accounting' },
      { title: 'Remove from WeCGA', desc: '8. Cut from WeCGA when there is no SAP Asset Code', role: 'asset_hq' },
    ],
    // Page 6 / 9 - loss & write-off lost (with compensation)
    writeoffLost: [
      { title: 'Ticket report loss', desc: '1. Ticket reporting the loss / write-off', role: 'employee' },
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
        (i < breadcrumb.length - 1 ? ' <span class="material-symbols-outlined" style="font-size:14px">chevron_right</span> ' : '')
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

  ui.chip = (label, kind) => `<span class="chip ${kind || 'neutral'}">${esc(label)}</span>`;

  const STATUS_KIND = {
    'Completed': 'ok', 'Done': 'ok', 'Approved': 'ok', 'Verified': 'ok', 'Found': 'ok', 'Accepted': 'ok', 'Active': 'ok', 'Confirmed': 'ok', 'Tagged': 'ok', 'Registered': 'ok',
    'Open': 'info', 'In progress': 'info', 'Pending': 'warn', 'Awaiting approval': 'warn', 'Draft': 'neutral', 'Planned': 'info', 'Awaiting acceptance': 'warn', 'Not tagged': 'warn', 'Not counted': 'neutral', 'Untagged': 'warn',
    'Rejected': 'danger', 'Lost': 'danger', 'Not found': 'danger', 'Damaged': 'danger', 'Blocked': 'danger', 'Written off': 'danger', 'Cancelled': 'neutral',
  };
  ui.statusChip = (status) => ui.chip(status, STATUS_KIND[status] || 'neutral');

  ui.table = ({ columns, rows, rowLink, empty }) => {
    if (!rows || !rows.length) return `<div class="empty">${icon('inbox')}<div>${empty || 'No records'}</div></div>`;
    const head = columns.map(c => `<th class="${c.cls || ''}">${esc(c.label)}</th>`).join('');
    const body = rows.map(r => {
      const link = rowLink ? rowLink(r) : null;
      const cells = columns.map(c => {
        const v = c.render ? c.render(r) : (r[c.key] == null ? '-' : esc(r[c.key]));
        return `<td class="${c.cls || ''}">${v}</td>`;
      }).join('');
      return `<tr class="${link ? 'clickable' : ''}" ${link ? `data-nav="${link}"` : ''}>${cells}</tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
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

  ui.checklist = (items) => `<ul class="checklist">` + items.map(i => {
    const ic = i.state === 'pass' ? 'check_circle' : (i.state === 'fail' ? 'cancel' : 'radio_button_unchecked');
    return `<li class="${i.state}">${icon(ic)}<span>${i.label}${i.note ? ` <span class="muted">- ${esc(i.note)}</span>` : ''}</span></li>`;
  }).join('') + `</ul>`;

  ui.callout = (kind, html, ic) => `<div class="callout ${kind}">${icon(ic || (kind === 'question' ? 'help' : kind === 'danger' ? 'error' : kind === 'warn' ? 'warning' : 'info'))}<div>${html}</div></div>`;

  ui.qr = (label) => `<div style="text-align:center"><div class="qr-box"></div>${label ? `<div class="mono" style="margin-top:6px">${esc(label)}</div>` : ''}</div>`;

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
    if (nav) { e.preventDefault(); App.navigate(nav.getAttribute('data-nav')); }
  });
  window.addEventListener('hashchange', render);

  /* ---------------- navigation model ---------------- */
  App.NAV = [
    { group: 'Overview', items: [
      { hash: '#/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { hash: '#/assets', label: 'Asset Register', icon: 'inventory_2' },
    ]},
    { group: 'Intake & Registration', items: [
      { hash: '#/intake', label: 'Procurement / SAP Inbound', icon: 'input' },
      { hash: '#/registration', label: 'Manual Registration', icon: 'note_add' },
      { hash: '#/tagging', label: 'QR Tagging', icon: 'qr_code_2' },
      { hash: '#/scan', label: 'Scan & Record', icon: 'photo_camera' },
      { hash: '#/handover', label: 'Handover', icon: 'assignment_ind' },
    ]},
    { group: 'Operations', items: [
      { hash: '#/movement', label: 'Movement', icon: 'swap_horiz' },
      { hash: '#/counts', label: 'Inventory Counts', icon: 'fact_check' },
      { hash: '#/my-count', label: 'My Count Tasks', icon: 'checklist' },
      { hash: '#/reconcile', label: 'Reconciliation', icon: 'difference' },
      { hash: '#/writeoff', label: 'Disposal / Write-off', icon: 'delete_sweep' },
    ]},
    { group: 'Insight & Admin', items: [
      { hash: '#/reports', label: 'Reports', icon: 'summarize' },
      { hash: '#/admin', label: 'Administration', icon: 'admin_panel_settings' },
      { hash: '#/audit', label: 'Audit Log', icon: 'history' },
      { hash: '#/coverage', label: 'Requirements Coverage', icon: 'rule' },
    ]},
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
    nav.innerHTML = App.NAV.map(g => `
      <div class="nav-group-label">${g.group}</div>
      ${g.items.map(i => {
        const b = ticketBadge(i.hash);
        return `<a data-nav="${i.hash}">${icon(i.icon)}<span>${i.label}</span>${b ? `<span class="badge">${b}</span>` : ''}</a>`;
      }).join('')}
    `).join('');
  };

  /* ---------------- app bar controls ---------------- */
  App.renderBar = () => {
    const roleSel = `<div class="bar-select"><span class="bar-label">Role</span>
      <select id="roleSel">${Object.entries(App.ROLES).map(([k, v]) => `<option value="${k}" ${k === App.session.role ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
    const compSel = `<div class="bar-select"><span class="bar-label">Company</span>
      <select id="compSel">${Object.entries(App.COMPANIES).map(([k, v]) => `<option value="${k}" ${k === App.session.company ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
    document.getElementById('barControls').innerHTML = roleSel + compSel;
    document.getElementById('roleSel').onchange = (e) => {
      App.session.role = e.target.value;
      // pick a representative user for the role
      const u = App.store.users.find(u => u.role === e.target.value);
      if (u) App.session.userId = u.id;
      App.renderNav(); render();
      ui.toast('Viewing as ' + App.ROLES[e.target.value], 'switch_account');
    };
    document.getElementById('compSel').onchange = (e) => { App.session.company = e.target.value; App.renderNav(); render(); };
  };

  /* ---------------- boot ---------------- */
  App.start = () => {
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
