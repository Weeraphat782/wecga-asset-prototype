/* Procurement / SAP Inbound (#/intake)
   Covers: M1 (Procurement interface PR/PO + GR), M2 (asset created by SAP/Accounting),
           I1 (purchased via PR/PO), I2 (confirm delivery date -> QR appointment),
           I3 (record Goods Receipt in SAP), I4 (Accounting checks & creates asset).
   Also links S1 (SAP assets need no WeCGA request) vs manual registration. */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt;

  // Mock PR/PO pipeline. PO-4500091231 mirrors App.store.sapLog (SAP-02).
  const PURCHASE_ORDERS = [
    { po: 'PO-4500091231', vendor: '\u0e1a\u0e08. Dell TH', item: 'Monitor Dell 27" U2723QE', qty: 1, company: 'AIS', delivery: 'Delivered - GR pending', createdAsset: 'A-006' },
    { po: 'PO-4500091190', vendor: '\u0e1a\u0e08. ABC', item: 'Firewall Fortinet FG-100F', qty: 1, company: 'AIS', delivery: 'In transit' },
    { po: 'PO-4500091255', vendor: '\u0e1a\u0e08. HP TH', item: 'Notebook HP EliteBook 840 G10', qty: 5, company: 'AIS', delivery: 'Ordered' },
    { po: 'PO-4500091260', vendor: '\u0e1a\u0e08. Fiber TH', item: 'ONT Router GPON', qty: 10, company: 'BB', delivery: 'Delivered - GR pending', createdAsset: 'A-012' },
    { po: 'PO-4500091277', vendor: '\u0e1a\u0e08. Toyota', item: 'Service Van Toyota Hiace', qty: 1, company: 'BB', delivery: 'In transit' },
  ];

  let tab = 'prpo';

  const deliveryChip = (s) => s.startsWith('Delivered') ? ui.chip(s, 'ok')
    : s === 'In transit' ? ui.chip(s, 'info') : ui.chip(s, 'neutral');

  function poForCompany() {
    return PURCHASE_ORDERS.filter(p => p.company === App.session.company);
  }

  /* ---------- Tab bodies ---------- */
  function prpoBody() {
    const rows = poForCompany();
    return ui.card({
      title: `${App.icon('receipt_long')} Purchase Requisition / Purchase Order`,
      sub: 'Pulled from SAP via the Procurement Interface. <span class="muted">p.2 item 1 - asset purchased via PR/PO (M1, I1)</span>',
      body: ui.table({
        columns: [
          { key: 'po', label: 'PO Number', render: r => `<span class="mono">${App.esc(r.po)}</span>` },
          { key: 'vendor', label: 'Vendor' },
          { key: 'item', label: 'Item', cls: 'wrap' },
          { key: 'qty', label: 'Qty', cls: 'num' },
          { key: 'delivery', label: 'Delivery', render: r => deliveryChip(r.delivery) },
        ],
        rows,
        empty: 'No open PR/PO for this company',
      }),
    });
  }

  function grBody() {
    const delivered = poForCompany().filter(p => p.delivery.startsWith('Delivered'));
    const list = delivered.length ? delivered.map(p => `
      <div class="pill-row" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--md-outline-variant)">
        <div>
          <div><span class="mono">${App.esc(p.po)}</span> &nbsp; <b>${App.esc(p.item)}</b></div>
          <div class="muted" style="font-size:12.5px">${App.esc(p.vendor)} - Qty ${p.qty}</div>
        </div>
        <button class="btn sm" data-act="gr" data-po="${App.esc(p.po)}">${App.icon('inventory')} Post GR</button>
      </div>`).join('') : '<div class="muted">Nothing awaiting Goods Receipt right now.</div>';

    return ui.card({
      title: `${App.icon('local_shipping')} Goods Receipt (GR)`,
      sub: 'Record GR in SAP once the item physically arrives. <span class="muted">p.2 item 3 (I3)</span>',
      body: list,
    })
    + ui.card({
      title: `${App.icon('event_available')} Confirm delivery date - book QR tagging appointment`,
      sub: 'p.2 item 2 (I2): the User confirms the expected delivery date in advance with the Asset Management unit so a QR tagging appointment can be scheduled.',
      body: `<div class="form-grid">
          ${ui.field({ label: 'Purchase order', name: 'po', type: 'select', options: poForCompany().map(p => p.po), required: true })}
          ${ui.field({ label: 'Expected delivery date', name: 'deliveryDate', type: 'date', required: true, hint: 'Confirm in advance with Asset Management' })}
        </div>
        <div class="form-grid">
          ${ui.field({ label: 'Preferred appointment window', name: 'window', type: 'select', options: ['Morning (09:00-12:00)', 'Afternoon (13:00-17:00)'] })}
          ${ui.field({ label: 'Notes to Asset Management', name: 'notes', type: 'textarea', attrs: 'placeholder="Site access, contact person, dock number..."' })}
        </div>
        <div class="pill-row" style="margin-top:8px">
          <button class="btn" data-act="confirmDate">${App.icon('event')} Confirm date &amp; book appointment</button>
        </div>`,
    });
  }

  function newAssetsBody() {
    const queue = App.store.assets.filter(a => a.source === 'SAP' && a.tagStatus === 'Not tagged' && a.companyCode === App.session.company);
    return ui.callout('info',
      `Assets that come from <b>SAP</b> need <b>no WeCGA request or registration</b> (p.2 - requirement S1): Accounting creates the asset master and it flows into WeCGA automatically, then only awaits QR tagging. Found / non-SAP assets instead go through <a class="link" data-nav="#/registration">Manual Registration</a>.`)
    + ui.card({
      title: `${App.icon('playlist_add_check')} New assets from Accounting - awaiting QR tagging`,
      sub: 'p.2 item 4 (I4): Accounting checks and creates the asset (Asset code, Cap.Date, Cost, buyer, PO). Each row is ready for the QR Tagging queue.',
      actions: `<button class="btn tonal sm" data-nav="#/tagging">${App.icon('qr_code_2')} Open QR Tagging</button>`,
      body: ui.table({
        columns: [
          { key: 'code', label: 'Asset code', render: r => `<span class="mono">${App.esc(App.assetCode(r))}</span>` },
          { key: 'desc1', label: 'Description', cls: 'wrap', render: r => App.esc([r.desc1, r.desc2].filter(Boolean).join(' ')) },
          { key: 'capDate', label: 'Cap.Date', render: r => fmt.date(r.capDate) },
          { key: 'cost', label: 'Cost', cls: 'num', render: r => fmt.money(r.cost) },
          { key: 'tagStatus', label: 'Tag', render: r => ui.statusChip(r.tagStatus) },
          { key: '_act', label: '', render: r => `<span class="pill-row"><button class="btn text sm" data-nav="#/assets/${r.id}">Detail</button><button class="btn tonal sm" data-nav="#/tagging/TK-0001">Tag</button></span>` },
        ],
        rows: queue,
        rowLink: r => '#/assets/' + r.id,
        empty: 'No untagged SAP assets for this company',
      }),
    });
  }

  App.registerView('#/intake', {
    title: 'Procurement / SAP Inbound',
    render() {
      const comp = App.COMPANIES[App.session.company];
      const inbound = App.store.sapLog.filter(l => l.dir === 'inbound');
      const queue = App.store.assets.filter(a => a.source === 'SAP' && a.tagStatus === 'Not tagged' && a.companyCode === App.session.company);

      const kpis = `<div class="grid cols-4">
        ${ui.kpi({ label: 'Open PR/PO', value: poForCompany().length, icon: 'receipt_long' })}
        ${ui.kpi({ label: 'Awaiting GR', value: poForCompany().filter(p => p.delivery.startsWith('Delivered')).length, icon: 'local_shipping', tone: 'warn' })}
        ${ui.kpi({ label: 'New from Accounting (untagged)', value: queue.length, icon: 'playlist_add_check', tone: 'warn' })}
        ${ui.kpi({ label: 'SAP inbound messages', value: inbound.length, icon: 'sync' })}
      </div>`;

      const body = tab === 'prpo' ? prpoBody() : tab === 'gr' ? grBody() : newAssetsBody();

      return ui.pageHead({
        title: 'Procurement / SAP Inbound',
        sub: `Company <b>${comp}</b>. The procurement pipeline: PR/PO &rarr; delivery date confirmation &rarr; Goods Receipt &rarr; asset created by Accounting &rarr; QR tagging. <span class="muted">Modules M1, M2</span>`,
      })
      + kpis
      + ui.tabs('intakeTabs', [
          { id: 'prpo', label: 'PR / PO' },
          { id: 'gr', label: 'Goods Receipt (GR)' },
          { id: 'newassets', label: 'New assets from Accounting' },
        ], tab)
      + body;
    },
    mount(root) {
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.getAttribute('data-tab'); App.refresh(); });

      root.querySelectorAll('[data-act="gr"]').forEach(b => b.onclick = () => {
        const po = b.getAttribute('data-po');
        App.audit({ action: 'Goods Receipt posted', target: po, detail: 'GR posted in SAP (inbound)' });
        ui.toast('GR posted in SAP', 'inventory');
      });

      const confirm = root.querySelector('[data-act="confirmDate"]');
      if (confirm) confirm.onclick = () => {
        const po = root.querySelector('[name="po"]').value;
        const date = root.querySelector('[name="deliveryDate"]').value;
        const win = root.querySelector('[name="window"]').value;
        const notes = root.querySelector('[name="notes"]').value;
        if (!date) { ui.toast('Pick an expected delivery date first', 'error'); return; }
        App.audit({
          action: 'Delivery date confirmed - QR appointment booked',
          target: po,
          detail: `Expected ${fmt.date(date)} (${win})${notes ? ' - ' + notes : ''}`,
        });
        ui.toast('Delivery date confirmed - QR tagging appointment booked', 'event_available');
      };
    },
  });
})();
