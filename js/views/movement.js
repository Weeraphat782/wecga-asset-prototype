/* Movement / Transfer (#/movement) + Movement Detail (#/movement/:id)
   ---------------------------------------------------------------------
   The 5 movement types (p.5 process, p.3 item 10.2): Transfer, Borrow,
   Return, Repair (send / receive back), Change holder. All ride the same
   9-step App.FLOWS.movement flow so the customer can confirm the process.

   Coverage IDs satisfied here: M4, W3, T1, T2, T3, T4, T5.
     M4 - movement/transfer of an asset (p.5)
     W3 - GA-scoped initiation: GA may only start transfers in its own area (p.10 1.2)
     T1 - list & KPI of movement tickets by type
     T2 - initiate a new movement (Transfer/Borrow/Return/Repair/Change holder)
     T3 - drive the 9 documented steps (approvals, delivery, GA verify, SAP)
     T4 - receiver accepts by scanning QR OR by pressing accept (p.5 item 5)
     T5 - print paper record + export to Excel (p.5 items 6 & 9)
*/
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt;

  // The 5 documented movement types (p.5 / p.3 10.2).
  const MOVE_TYPES = ['Transfer', 'Borrow', 'Return', 'Repair', 'Change holder'];
  const SEG = ['All', ...MOVE_TYPES];

  const TYPE_KIND = { Transfer: 'info', Borrow: 'warn', Return: 'ok', Repair: 'danger', 'Change holder': 'neutral' };
  const typeChip = (t) => ui.chip(t, TYPE_KIND[t] || 'neutral');

  // Movement tickets for the current company.
  const movementTickets = () => App.store.tickets.filter(t =>
    MOVE_TYPES.includes(t.type) && t.company === App.session.company);

  const stepTitle = (t) => (App.FLOWS.movement[t.stepIndex] || {}).title || '-';

  // W3 - GA may only initiate a transfer within its own area (p.10 1.2).
  // Seed data has casing drift ('North' user vs 'NORTH' asset) so compare loosely.
  const norm = (s) => String(s == null ? '' : s).trim().toUpperCase();
  const gaBlocked = (asset) => App.session.role === 'ga'
    && asset && norm(asset.area) !== norm((App.currentUser() || {}).area);

  // module-level filter (segmented control state)
  let state = { type: 'All' };

  /* ============================ LIST (#/movement) ============================ */
  App.registerView('#/movement', {
    title: 'Movement',
    render() {
      const all = movementTickets();
      const open = all.filter(t => t.status !== 'Completed');

      // T1 - KPI summary of OPEN movement tickets by type.
      const kpis = ui.kpi({ label: 'Open movements', value: open.length, icon: 'swap_horiz', foot: `${all.length} total incl. completed` })
        + MOVE_TYPES.map(mt => ui.kpi({
          label: mt, icon: 'sync_alt',
          value: open.filter(t => t.type === mt).length,
          foot: `${all.filter(t => t.type === mt).length} all-time`,
        })).join('');

      // segmented filter (reuse ui.tabs as the segmented control)
      const seg = ui.tabs('mvType', SEG.map(s => ({ id: s, label: s })), state.type);

      const rows = all.filter(t => state.type === 'All' || t.type === state.type);
      const table = ui.table({
        columns: [
          { key: 'id', label: 'Ticket' },
          { key: 'type', label: 'Type', render: r => typeChip(r.type) },
          { key: 'asset', label: 'Asset', render: r => { const a = App.asset(r.assetId); return a ? App.esc(App.assetTitle(a)) : App.esc(r.assetId); } },
          { key: 'fromOwner', label: 'From owner', render: r => App.esc(r.fromOwner || '-') },
          { key: 'toOwner', label: 'To owner', render: r => App.esc(r.toOwner || '-') },
          { key: 'step', label: 'Current step', render: r => `<span class="muted">${r.stepIndex + 1}/9</span> ${App.esc(stepTitle(r))}` },
          { key: 'status', label: 'Status', render: r => ui.statusChip(r.status) },
        ],
        rows,
        rowLink: r => '#/movement/' + r.id,
        empty: 'No movement tickets for this filter',
      });

      const gaNote = App.session.role === 'ga'
        ? ui.callout('warn', `You are acting as <b>GA (${App.esc((App.currentUser() || {}).area || 'no area')})</b>. Per requirement <b>p.10 item 1.2 (W3)</b>, GA may only initiate transfers for assets in its own area. Assets outside your area are disabled in the New movement dialog.`, 'shield_person')
        : '';

      return ui.pageHead({
        title: 'Movement',
        sub: 'Transfer / Borrow / Return / Repair / Change holder - the 9-step transfer process (p.5, p.3 item 10.2). Coverage: M4, W3, T1-T5.',
        actions: `<button class="btn" id="newMoveBtn">${App.icon('add')} New movement</button>`,
      })
        + ui.callout('info', 'Every movement follows the same documented 9 steps: Ticket &rarr; Approval (transferor) &rarr; Approval (receiver) &rarr; Delivered &rarr; Receiver accepts (scan QR / press accept) &rarr; Print paper &rarr; GA Verify &rarr; Update SAP &rarr; Export Excel.')
        + gaNote
        + `<div class="grid cols-6">${kpis}</div>`
        + ui.card({ title: `${App.icon('filter_alt')} Movement tickets`, body: seg + table });
    },
    mount(root, ctx) {
      // segmented filter
      root.querySelectorAll('[data-tabs="mvType"] [data-tab]').forEach(b => b.onclick = () => {
        state.type = b.getAttribute('data-tab');
        App.refresh();
      });
      const nb = root.querySelector('#newMoveBtn');
      if (nb) nb.onclick = () => openNew(ctx.query && ctx.query.asset);
      // deep link from asset detail: #/movement?asset=A-023 opens the dialog pre-filled
      if (ctx.query && ctx.query.asset) openNew(ctx.query.asset);
    },
  });

  // T2 - New movement dialog (choose type, asset, from/to owner, reason).
  function openNew(preAssetId) {
    const comp = App.session.company;
    const assets = App.store.assets.filter(a => a.companyCode === comp);
    if (!assets.length) { ui.toast('No assets in this company', 'error'); return; }
    let sel = (preAssetId && assets.find(a => a.id === preAssetId)) || assets[0];

    const assetOpts = assets.map(a => ({ value: a.id, label: App.assetTitle(a) + '  [' + (a.area || '-') + ']' }));

    const body = `
      ${ui.field({ label: 'Movement type', name: 'mvType', type: 'select', options: MOVE_TYPES, value: 'Transfer', required: true, hint: 'p.5 process - the 5 documented movement types' })}
      ${ui.field({ label: 'Asset', name: 'mvAsset', type: 'select', options: assetOpts, value: sel.id, required: true })}
      ${ui.field({ label: 'From owner (current holder)', name: 'mvFrom', value: sel.owner ? sel.owner.name : '', hint: 'Auto-filled from the asset owner', attrs: 'readonly' })}
      ${ui.field({ label: 'To owner (person or organization)', name: 'mvTo', value: '', required: true, hint: 'Receiver / borrower / repair vendor' })}
      ${ui.field({ label: 'Reason / notes', name: 'mvReason', type: 'textarea', value: '', hint: 'Why is this asset moving?' })}
      <div id="mvGaWarn"></div>`;

    const dlg = ui.dialog({
      title: 'New movement', size: 'lg',
      sub: 'Opens a ticket on the 9-step transfer flow (p.5). W3: GA is limited to its own area.',
      body,
      actions: [
        { label: 'Cancel', kind: 'text' },
        {
          label: 'Create movement', kind: 'btn', close: false, act: ({ close }) => {
            const g = (n) => dlg.root.querySelector(`[name="${n}"]`);
            const asset = App.asset(g('mvAsset').value);
            const type = g('mvType').value;
            const toOwner = g('mvTo').value.trim();
            if (!asset) { ui.toast('Pick an asset', 'error'); return; }
            if (!toOwner) { ui.toast('Enter the receiving owner', 'error'); return; }
            if (gaBlocked(asset)) { ui.toast('Blocked: asset is outside your GA area (W3, p.10 1.2)', 'block'); return; }
            const fromOwner = asset.owner ? asset.owner.name : '-';
            const t = App.addTicket({
              type, flow: 'movement', assetId: asset.id,
              fromOwner, toOwner,
              reason: g('mvReason').value.trim(),
              area: asset.area,
              title: `${type} - ${App.assetTitle(asset)} : ${fromOwner} \u2192 ${toOwner}`,
              status: 'Open',
            });
            close();
            ui.toast('Movement ticket ' + t.id + ' created', 'add_task');
            App.navigate('#/movement/' + t.id);
          },
        },
      ],
    });

    // keep From-owner + GA area check in sync with the chosen asset
    const assetSel = dlg.root.querySelector('[name="mvAsset"]');
    const fromInp = dlg.root.querySelector('[name="mvFrom"]');
    const warnBox = dlg.root.querySelector('#mvGaWarn');
    const createBtn = dlg.root.querySelector('[data-act="1"]');
    const sync = () => {
      const a = App.asset(assetSel.value);
      fromInp.value = a && a.owner ? a.owner.name : '';
      const blocked = gaBlocked(a);
      warnBox.innerHTML = blocked
        ? ui.callout('danger', `This asset is in area <b>${App.esc(a.area || '-')}</b>, outside your GA area <b>${App.esc((App.currentUser() || {}).area || '-')}</b>. GA cannot initiate this transfer (W3, p.10 item 1.2).`, 'block')
        : '';
      if (createBtn) createBtn.disabled = blocked;
    };
    if (assetSel) assetSel.onchange = sync;
    sync();
  }

  /* ========================= DETAIL (#/movement/:id) ========================= */
  App.registerView('#/movement/:id', {
    title: ctx => ctx.params.id,
    render(ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t || !MOVE_TYPES.includes(t.type)) return ui.pageHead({ title: 'Movement ticket not found' })
        + ui.callout('warn', `No movement ticket <span class="mono">${App.esc(ctx.params.id)}</span>. <a data-nav="#/movement">Back to Movement</a>`);
      const a = App.asset(t.assetId);
      const flow = App.FLOWS.movement;

      // asset summary card (link to asset detail) + from/to owners
      const summary = ui.card({
        title: `${App.icon('inventory_2')} ${a ? App.esc(App.assetTitle(a)) : App.esc(t.assetId)}`,
        actions: a ? `<button class="btn text sm" data-nav="#/assets/${a.id}">${App.icon('open_in_new')} Open asset</button>` : '',
        body: `<div class="kv" style="grid-template-columns:auto 1fr">
            <dt>Type</dt><dd>${typeChip(t.type)}</dd>
            <dt>Status</dt><dd>${ui.statusChip(t.status)}</dd>
            <dt>From owner</dt><dd>${App.esc(t.fromOwner || '-')}</dd>
            <dt>To owner</dt><dd>${App.esc(t.toOwner || '-')}</dd>
            <dt>Area</dt><dd>${App.esc(t.area || (a && a.area) || '-')}</dd>
            <dt>Reason</dt><dd>${App.esc(t.reason || '-')}</dd>
            <dt>Created</dt><dd>${fmt.datetime(t.created)}</dd>
          </div>`,
      });

      // T3 - the 9 documented steps as a stepper.
      const stepper = ui.card({
        title: `${App.icon('conveyor_belt')} Transfer process (9 steps - p.5)`,
        sub: 'Ticket &rarr; Approval (transferor) &rarr; Approval (receiver) &rarr; Delivered &rarr; Receiver accepts &rarr; Print paper &rarr; GA Verify &rarr; Update SAP &rarr; Export Excel',
        body: ui.stepper(flow, t.stepIndex),
      });

      // contextual action(s) for the CURRENT step
      const actions = ui.card({
        title: `${App.icon('bolt')} Action - step ${t.stepIndex + 1}/9: ${App.esc(stepTitle(t))}`,
        body: stepActions(t),
      });

      // origin=count callout (spawned from an inventory count follow-up)
      const originNote = t.origin === 'count'
        ? ui.callout('question', 'This movement was <b>spawned from an inventory count follow-up</b> (a count outcome flagged the wrong holder/location). See Reconciliation &amp; Counts.', 'fact_check')
        : '';

      // ticket history timeline
      const hist = (t.history || []).map(h => ({ title: h.step, meta: `${fmt.datetime(h.ts)} - ${h.actor}${h.note ? ' - ' + h.note : ''}`, icon: 'check_circle' }));
      const history = ui.card({
        title: `${App.icon('history')} Ticket history`,
        body: hist.length ? ui.timeline(hist) : '<div class="muted">No steps recorded yet</div>',
      });

      return ui.pageHead({
        title: `${t.type} \u00b7 ${t.id}`,
        breadcrumb: [{ label: 'Movement', hash: '#/movement' }, { label: t.id }],
        sub: `Movement ticket on the transfer flow (M4). Coverage: T3, T4, T5.`,
      })
        + originNote
        + `<div class="grid cols-2" style="align-items:start"><div>${summary}${actions}${history}</div><div>${stepper}</div></div>`;
    },
    mount(root, ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t) return;
      const a = App.asset(t.assetId);
      const adv = (note) => { App.advanceTicket(t, note); App.refresh(); };
      const on = (act, fn) => { const el = root.querySelector(`[data-act="${act}"]`); if (el) el.onclick = fn; };

      on('submit', () => adv('Ticket submitted for approval'));
      on('approve-transferor', () => adv('Approved by transferor authority (step 2)'));
      on('approve-receiver', () => adv('Approved by receiver authority (step 3)'));
      on('delivered', () => adv('Asset delivered to receiver (step 4)'));

      // T4 - receiver accepts by scanning QR OR pressing accept (p.5 item 5).
      on('accept-system', () => adv('Receiver accepted in system'));
      on('accept-scan', () => {
        const d = ui.dialog({
          title: 'Accept by scanning QR', size: 'sm',
          sub: 'p.5 item 5 - receiver accepts by scanning the asset QR.',
          body: ui.qr(a ? App.assetCode(a) : t.assetId) + `<div class="muted" style="text-align:center;margin-top:8px">Point the WeCGA camera at the tag.</div>`,
          actions: [
            { label: 'Open full scanner', kind: 'text', act: () => App.navigate('#/scan?asset=' + t.assetId) },
            { label: 'Simulate scan & accept', kind: 'btn', act: () => adv('Receiver accepted by scanning QR') },
          ],
        });
        void d;
      });

      // T5 - print paper record (window.print of a formatted transfer record).
      on('print', () => { printRecord(t, a); adv('Printed paper record'); });

      // GA Verify (p.5 item 7) - verify via scan + destination photo that the move happened.
      on('verify', () => adv('GA verified transfer (scan + destination photo)'));

      // Update SAP (p.5 item 8).
      on('sap', () => { adv('Owner/location updated in SAP'); ui.toast('Owner/location updated in SAP', 'sync'); });

      // T5 - export the record to Excel (CSV) (p.5 item 9).
      on('export', () => exportTicket(t, a));
    },
  });

  // gated action buttons per current step index (0..8)
  function stepActions(t) {
    const btn = (act, label, kind, icon) => `<button class="btn ${kind || ''}" data-act="${act}">${App.icon(icon)} ${label}</button>`;
    let inner;
    switch (t.stepIndex) {
      case 0: inner = btn('submit', 'Submit ticket (send for approval)', '', 'send'); break;
      case 1: inner = btn('approve-transferor', 'Approve (transferor)', '', 'thumb_up'); break;
      case 2: inner = btn('approve-receiver', 'Approve (receiver)', '', 'thumb_up'); break;
      case 3: inner = btn('delivered', 'Mark delivered to receiver', '', 'local_shipping'); break;
      case 4: // T4 - BOTH options
        inner = btn('accept-scan', 'Accept by scanning QR', '', 'qr_code_scanner')
          + ' ' + btn('accept-system', 'Accept in system', 'tonal', 'task_alt');
        break;
      case 5: inner = btn('print', 'Print paper record', '', 'print'); break; // T5
      case 6: inner = btn('verify', 'GA Verify', '', 'verified'); break;
      case 7: inner = btn('sap', 'Update SAP', '', 'sync'); break;
      case 8: inner = btn('export', 'Export to Excel', '', 'table_view'); break; // T5
      default: inner = '';
    }
    const done = t.stepIndex >= App.FLOWS.movement.length - 1;
    const foot = done
      ? ui.callout('info', 'This movement has completed all 9 steps. You can still re-export the record to Excel.')
      : `<div class="muted" style="margin-top:8px">Buttons are gated by the current step; advancing records an entry in the ticket history.</div>`;
    return `<div class="pill-row" style="gap:8px">${inner}</div>${foot}`;
  }

  // T5 - printable paper transfer record (asset, from, to, date, signatures).
  function printRecord(t, a) {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) { ui.toast('Allow pop-ups to print the record', 'print'); return; }
    const row = (k, v) => `<tr><td style="padding:4px 10px;color:#555">${k}</td><td style="padding:4px 10px"><b>${App.esc(v)}</b></td></tr>`;
    w.document.write(`<!doctype html><html><head><title>Transfer record ${App.esc(t.id)}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;margin:40px;color:#111}h1{font-size:20px}
      table{border-collapse:collapse;margin:12px 0}.sig{margin-top:60px;display:flex;justify-content:space-between}
      .sig div{width:40%;border-top:1px solid #111;padding-top:6px;text-align:center;font-size:13px}</style></head><body>
      <h1>WeCGA Asset Movement Record</h1>
      <div>Ticket <b>${App.esc(t.id)}</b> &middot; Type <b>${App.esc(t.type)}</b> &middot; Printed ${App.esc(fmt.datetime(new Date().toISOString()))}</div>
      <table>
        ${row('Asset', a ? App.assetTitle(a) : t.assetId)}
        ${row('Serial', a ? (a.serial || '-') : '-')}
        ${row('From owner', t.fromOwner || '-')}
        ${row('To owner', t.toOwner || '-')}
        ${row('Area', t.area || (a && a.area) || '-')}
        ${row('Reason', t.reason || '-')}
        ${row('Created', fmt.datetime(t.created))}
      </table>
      <div class="sig"><div>Transferor signature</div><div>Receiver signature</div></div>
      <div class="sig"><div>GA verify signature</div><div>Date</div></div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  // T5 - export ticket + asset fields to Excel (CSV via App.exportRows).
  function exportTicket(t, a) {
    const headers = ['Ticket', 'Type', 'Status', 'Asset code', 'Asset', 'Serial', 'From owner', 'To owner', 'Area', 'Current step', 'Reason', 'Created', 'NBV'];
    const rows = [[
      t.id, t.type, t.status,
      a ? App.assetCode(a) : t.assetId,
      a ? App.assetTitle(a) : t.assetId,
      a ? (a.serial || '') : '',
      t.fromOwner || '', t.toOwner || '', t.area || (a && a.area) || '',
      stepTitle(t), t.reason || '', fmt.date(t.created),
      a ? a.nbv : '',
    ]];
    App.exportRows('movement-' + t.id + '.csv', headers, rows);
  }
})();
