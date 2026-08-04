/* Reconciliation (#/reconcile)
   Covers: M6 - reconcile WeCGA actual count findings against SAP master and
   generate the follow-on correction with one click.
   Variance types: Location differs / Owner differs / In SAP but Not found /
   Found but Not in SAP / OK (+ Found-damaged as a documented case).
   Reuses App.assetCode / App.ownerLabel / App.addTicket / App.exportRows. */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, esc = App.esc;

  const OUTCOME_LABEL = {
    found_ok: 'Found - OK', found_wrong: 'Found - wrong owner/location',
    not_in_sap: 'Found - not in SAP', found_damaged: 'Found - damaged',
    not_found: 'Not found', moved: 'Moved elsewhere',
  };

  // Map a count outcome to a SAP variance + the proposed one-click correction.
  function variance(outcome) {
    switch (outcome) {
      case 'found_wrong':   return { type: 'Owner / Location differs', kind: 'warn',   corr: 'transfer' };
      case 'moved':         return { type: 'Location differs',         kind: 'warn',   corr: 'transfer' };
      case 'not_found':     return { type: 'In SAP but Not found',     kind: 'danger', corr: 'lost' };
      case 'not_in_sap':    return { type: 'Found but Not in SAP',     kind: 'warn',   corr: 'register' };
      case 'found_damaged': return { type: 'Found - damaged',          kind: 'danger', corr: 'writeoffSale' };
      default:              return { type: 'OK',                       kind: 'ok',     corr: null };
    }
  }

  const CORR = {
    transfer:     { label: 'Create Transfer',      type: 'Transfer',       flow: 'movement' },
    lost:         { label: 'Create Write-off Lost', type: 'Write-off Lost', flow: 'writeoffLost' },
    register:     { label: 'Create Registration',  type: 'Registration',   flow: 'registration' },
    writeoffSale: { label: 'Create Write-off Sale', type: 'Write-off Sale', flow: 'writeoffSale' },
  };

  function rowsForCompany() {
    const comp = App.session.company;
    return App.store.countResults
      .map(r => ({ r, a: App.asset(r.assetId) }))
      .filter(x => x.a && x.a.companyCode === comp)
      .map(x => ({ r: x.r, a: x.a, v: variance(x.r.outcome) }));
  }

  App.registerView('#/reconcile', {
    title: 'Reconciliation',
    render() {
      const rows = rowsForCompany();

      const ok = rows.filter(x => x.v.type === 'OK').length;
      const diffs = rows.filter(x => x.v.corr === 'transfer').length;
      const notFound = rows.filter(x => x.v.corr === 'lost').length;
      const notInSap = rows.filter(x => x.v.corr === 'register').length;
      const damaged = rows.filter(x => x.v.corr === 'writeoffSale').length;

      const kpis = `<div class="grid cols-5">
        ${ui.kpi({ label: 'Reconciled', value: rows.length, icon: 'difference' })}
        ${ui.kpi({ label: 'OK / matched', value: ok, icon: 'check_circle', tone: 'ok' })}
        ${ui.kpi({ label: 'Owner/Location diff', value: diffs, icon: 'swap_horiz', tone: diffs ? 'warn' : undefined })}
        ${ui.kpi({ label: 'In SAP, not found', value: notFound, icon: 'error', tone: notFound ? 'danger' : undefined })}
        ${ui.kpi({ label: 'Found, not in SAP', value: notInSap, icon: 'note_add', tone: notInSap ? 'warn' : undefined })}
      </div>`;

      const table = ui.table({
        columns: [
          { key: 'asset', label: 'Asset', render: x => `<span class="mono">${esc(App.assetCode(x.a))}</span><div class="muted" style="font-size:12px">${esc([x.a.desc1, x.a.desc2].filter(Boolean).join(' '))}</div>` },
          { key: 'sap', label: 'SAP owner / location', cls: 'wrap', render: x => `${esc(App.ownerLabel(x.a))}<div class="muted" style="font-size:12px">${esc(x.a.locationDesc || '-')}</div>` },
          { key: 'actual', label: 'Actual finding', cls: 'wrap', render: x => `${OUTCOME_LABEL[x.r.outcome] || x.r.outcome}${x.r.note ? `<div class="muted" style="font-size:12px">${esc(x.r.note)}</div>` : ''}` },
          { key: 'var', label: 'Variance', render: x => ui.chip(x.v.type, x.v.kind) },
          { key: 'corr', label: 'Proposed correction', render: x => {
            if (!x.v.corr) return '<span class="muted">None</span>';
            if (x.r.spawnedTicket) return ui.chip('Ticket ' + x.r.spawnedTicket + ' created', 'info');
            return `<button class="btn sm" data-act="corr" data-asset="${x.a.id}" data-corr="${x.v.corr}">${App.icon('build')} ${CORR[x.v.corr].label}</button>`;
          } },
        ],
        rows,
        empty: 'No count results to reconcile for this company yet',
      });

      return ui.pageHead({
        title: 'Reconciliation',
        sub: 'WeCGA actual count findings vs SAP master - one click generates the correcting ticket. <span class="muted">Module M6</span>',
        actions: `<button class="btn outline sm" id="expRec">${App.icon('table_view')} Export Excel</button>`,
      })
      + ui.callout('info', 'Each counted asset is compared to its SAP record. <b>Owner/Location differs</b> &rarr; Transfer. <b>In SAP but Not found</b> &rarr; Write-off Lost. <b>Found but Not in SAP</b> &rarr; Registration. <b>Damaged</b> &rarr; Write-off Sale.')
      + kpis
      + ui.card({ title: `${App.icon('difference')} Variance register`, body: table });
    },
    mount(root) {
      root.querySelectorAll('[data-act="corr"]').forEach(b => b.onclick = () => {
        const a = App.asset(b.getAttribute('data-asset'));
        const corr = CORR[b.getAttribute('data-corr')];
        if (!a || !corr) return;
        const res = App.store.countResults.find(r => r.assetId === a.id);
        const t = App.addTicket({
          type: corr.type, flow: corr.flow, assetId: a.id, origin: 'reconcile',
          title: 'Reconciliation correction (' + corr.type + ') - ' + App.assetCode(a),
          fromOwner: (a.owner && a.owner.name) || '',
        });
        if (res) res.spawnedTicket = t.id;
        App.audit({ action: 'Reconcile correction', target: t.id, detail: corr.type + ' for ' + App.assetCode(a) });
        ui.toast(corr.type + ' ' + t.id + ' created', 'build');
        App.refresh();
      });

      const exp = root.querySelector('#expRec');
      if (exp) exp.onclick = () => {
        const headers = ['Asset', 'Description', 'SAP owner', 'SAP location', 'Actual finding', 'Variance', 'Proposed correction', 'Ticket'];
        const rows = rowsForCompany().map(x => [
          App.assetCode(x.a),
          [x.a.desc1, x.a.desc2].filter(Boolean).join(' '),
          App.ownerLabel(x.a),
          x.a.locationDesc || '',
          OUTCOME_LABEL[x.r.outcome] || x.r.outcome,
          x.v.type,
          x.v.corr ? CORR[x.v.corr].type : 'None',
          x.r.spawnedTicket || '',
        ]);
        App.exportRows('reconciliation.csv', headers, rows);
      };
    },
  });
})();
