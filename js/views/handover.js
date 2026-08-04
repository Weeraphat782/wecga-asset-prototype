/* Handover (#/handover) + detail (#/handover/:id)  - page 3, item 9.
   Coverage: H1 (deliver + accept in system = traceability),
             H2 (send per-item OR as a list, via Email OR WeCGA record),
             H3 (owner = Individual [email] or Organization [Head-of email]).  */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, icon = App.icon;

  // H2 send options + multi-select for the "send as a list" path.
  let state = { mode: 'item', channel: 'email', selected: [] };

  function handoverTickets() {
    return App.store.tickets.filter(t => t.type === 'Handover' && t.company === App.session.company);
  }

  // H3 - resolve the acceptance recipient from the owner type.
  function recipient(a) {
    if (!a || !a.owner) return { label: 'Unknown', email: '-', kind: 'Individual' };
    if (a.owner.type === 'org') {
      return { label: a.orgName || a.owner.name, email: a.orgHeadEmail || a.owner.email || '-', kind: 'Organization (Head-of)' };
    }
    return { label: a.owner.name, email: a.owner.email || '-', kind: 'Individual' };
  }

  function acceptanceEmail(assets) {
    const rows = assets.map(a => {
      const r = recipient(a);
      return `<tr><td class="mono">${App.esc(App.assetCode(a))}</td><td>${App.esc(a.desc1 || '')}</td><td>${App.esc(r.label)}</td><td>${App.esc(r.kind)}</td><td class="mono">${App.esc(r.email)}</td></tr>`;
    }).join('');
    const to = [...new Set(assets.map(a => recipient(a).email))].join('; ');
    return `<div class="callout info" style="margin-bottom:12px">${icon('mail')}<div>
        <b>To:</b> ${App.esc(to)}<br>
        <b>Subject:</b> WeCGA - Please accept the asset(s) assigned to you</div></div>
      <p>Dear Asset Owner,</p>
      <p>The following ${assets.length > 1 ? 'assets have' : 'asset has'} been delivered and assigned to you in WeCGA.
      Please open WeCGA and <b>Accept in system</b> to confirm receipt - this establishes traceability of the asset.</p>
      <div class="table-wrap"><table class="data"><thead><tr>
        <th>Asset code</th><th>Description</th><th>Owner</th><th>Type</th><th>Send to</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p style="margin-top:12px">Regards,<br>WeCGA Asset Management</p>`;
  }

  App.registerView('#/handover', {
    title: 'Handover',
    render() {
      const tickets = handoverTickets();
      const assets = App.store.assets.filter(a => a.companyCode === App.session.company);

      const list = ui.card({
        title: `${icon('assignment_ind')} Handover tickets`,
        sub: 'Deliver an asset to its holder; the receiver must accept in the system (H1).',
        body: ui.table({
          columns: [
            { key: 'id', label: 'Ticket' },
            { key: 'title', label: 'Handover' },
            { key: '_asset', label: 'Asset', render: r => { const a = App.asset(r.assetId); return a ? App.esc(App.assetCode(a)) : '-'; } },
            { key: '_owner', label: 'Owner / recipient', render: r => { const a = App.asset(r.assetId); const rc = recipient(a); return `${App.esc(rc.label)} <span class="muted">(${App.esc(rc.kind)})</span>`; } },
            { key: 'status', label: 'Status', render: r => ui.statusChip(r.status) },
          ],
          rows: tickets, rowLink: r => '#/handover/' + r.id, empty: 'No handover tickets for this company',
        }),
      });

      // H2 - send per-item or as a list, via Email or WeCGA record
      const seg = (id, val, opts) => `<div class="segmented" data-seg="${id}">` +
        opts.map(o => `<button data-val="${o.v}" class="${o.v === val ? 'active' : ''}">${o.icon ? icon(o.icon) : ''}${o.l}</button>`).join('') + `</div>`;

      const picker = assets.map(a => {
        const r = recipient(a);
        return `<label class="chip outline" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
          <input type="checkbox" data-hasset="${a.id}" ${state.selected.includes(a.id) ? 'checked' : ''}>
          ${App.esc(App.assetCode(a))} <span class="muted">- ${App.esc(r.kind)}</span></label>`;
      }).join('');

      const send = ui.card({
        title: `${icon('send')} Send handover (H2)`,
        sub: 'Choose per-item or as a list, and Email or a WeCGA record. Preview the acceptance email before sending.',
        body: `
          <div class="pill-row" style="margin-bottom:10px">
            <span class="muted">Scope:</span> ${seg('mode', state.mode, [{ v: 'item', l: 'Per item', icon: 'looks_one' }, { v: 'list', l: 'As a list', icon: 'list' }])}
            <span class="muted" style="margin-left:12px">Channel:</span> ${seg('channel', state.channel, [{ v: 'email', l: 'Email', icon: 'mail' }, { v: 'wecga', l: 'WeCGA record', icon: 'inventory_2' }])}
          </div>
          <div class="field-group-title">Assets to send</div>
          <div class="pill-row">${picker || '<span class="muted">No assets</span>'}</div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn" id="previewBtn">${icon('preview')} Email preview</button>
          </div>`,
      });

      return ui.pageHead({
        title: 'Handover',
        sub: 'Deliver assets to holders and record acceptance - page 3, item 9 (H1, H2, H3).',
      })
      + ui.callout('info', 'Acceptance in the system establishes <b>traceability</b> of the asset back to its holder (p.3 item 9).')
      + list + send;
    },
    mount(root) {
      root.querySelectorAll('[data-seg]').forEach(seg => {
        const key = seg.getAttribute('data-seg');
        seg.querySelectorAll('button').forEach(b => b.onclick = () => { state[key] = b.getAttribute('data-val'); App.refresh(); });
      });
      root.querySelectorAll('[data-hasset]').forEach(cb => cb.onchange = () => {
        const id = cb.getAttribute('data-hasset');
        if (cb.checked) { if (!state.selected.includes(id)) state.selected.push(id); }
        else state.selected = state.selected.filter(x => x !== id);
      });
      const prev = root.querySelector('#previewBtn');
      if (prev) prev.onclick = () => {
        let ids = state.selected.slice();
        if (state.mode === 'item') ids = ids.slice(0, 1);
        if (!ids.length) return ui.toast('Select at least one asset', 'warning');
        const assets = ids.map(App.asset).filter(Boolean);
        const title = state.channel === 'email'
          ? (state.mode === 'item' ? 'Email preview - single item' : 'Email preview - list')
          : (state.mode === 'item' ? 'WeCGA record - single item' : 'WeCGA record - list');
        ui.dialog({
          title, size: 'lg',
          sub: state.channel === 'email' ? 'Acceptance request email to the owner (H2/H3).' : 'A WeCGA in-system record is created; the owner accepts in the app.',
          body: acceptanceEmail(assets),
          actions: [{ label: 'Close', kind: 'text' }, { label: state.channel === 'email' ? 'Send email' : 'Create record', kind: 'btn', act: () => ui.toast(state.channel === 'email' ? 'Acceptance email sent' : 'WeCGA record created', 'send') }],
        });
      };
    },
  });

  App.registerView('#/handover/:id', {
    title: ctx => (App.ticket(ctx.params.id) || {}).id || 'Handover',
    render(ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t || t.type !== 'Handover') return ui.pageHead({ title: 'Handover not found' }) + ui.callout('warn', 'No handover ticket for this id.');
      const a = App.asset(t.assetId);
      const r = recipient(a);

      const record = `<div class="card" id="acceptRecord">
        <div class="card-title">${icon('receipt_long')} Acceptance record</div>
        <dl class="kv" style="grid-template-columns:auto 1fr">
          <dt>Ticket</dt><dd class="mono">${App.esc(t.id)}</dd>
          <dt>Asset code</dt><dd class="mono">${a ? App.esc(App.assetCode(a)) : '-'}</dd>
          <dt>Description</dt><dd>${a ? App.esc([a.desc1, a.desc2].filter(Boolean).join(' ')) : '-'}</dd>
          <dt>Owner / recipient</dt><dd>${App.esc(r.label)} <span class="muted">(${App.esc(r.kind)})</span></dd>
          <dt>Send to</dt><dd class="mono">${App.esc(r.email)}</dd>
          <dt>Date</dt><dd>${fmt.date(new Date().toISOString())}</dd>
        </dl>
        <div style="margin-top:24px;border-top:1px dashed var(--md-outline);padding-top:12px">
          Signature: <span style="display:inline-block;border-bottom:1px solid var(--md-on-surface);min-width:220px">&nbsp;</span>
          &nbsp;&nbsp; Date: <span style="display:inline-block;border-bottom:1px solid var(--md-on-surface);min-width:120px">&nbsp;</span>
        </div>
      </div>`;

      const actions = `
        <button class="btn" id="acceptBtn">${icon('how_to_reg')} Accept in system</button>
        <button class="btn outline" id="printBtn">${icon('print')} Print acceptance record</button>`;

      return ui.pageHead({
        title: 'Handover - ' + t.id,
        breadcrumb: [{ label: 'Handover', hash: '#/handover' }, { label: t.id }],
        sub: `${App.esc(t.title)} &nbsp; ${ui.statusChip(t.status)}`,
        actions,
      })
      + ui.callout('info', 'Acceptance in the system establishes <b>traceability</b> of the asset to its holder (H1, p.3 item 9).')
      + `<div class="grid cols-2" style="align-items:start">
          <div>${ui.card({ title: `${icon('conveyor_belt')} Handover flow`, sub: 'Middle / last step: owner accepts in the system.', body: ui.stepper(App.FLOWS.handover, t.stepIndex) })}</div>
          <div>
            ${ui.card({ title: `${icon('badge')} Recipient (H3)`, body: `<dl class="kv" style="grid-template-columns:auto 1fr">
              <dt>Type</dt><dd>${App.esc(r.kind)}</dd>
              <dt>Name</dt><dd>${App.esc(r.label)}</dd>
              <dt>Email</dt><dd class="mono">${App.esc(r.email)}</dd></dl>
              ${ui.callout(a && a.owner && a.owner.type === 'org' ? 'info' : 'info', a && a.owner && a.owner.type === 'org' ? 'Organization owner - acceptance request goes to the <b>Head-of</b> email.' : 'Individual owner - acceptance request goes to the owner\u2019s email.')}` })}
            ${record}
          </div>
        </div>`;
    },
    mount(root, ctx) {
      const acc = root.querySelector('#acceptBtn');
      if (acc) acc.onclick = () => {
        const t = App.ticket(ctx.params.id);
        if (!t) return;
        if (t.status === 'Completed') return ui.toast('Already accepted', 'info');
        App.advanceTicket(t, 'Owner accepted in system');
        if (t.stepIndex >= (App.FLOWS.handover.length - 1)) t.status = 'Completed'; else t.status = 'In progress';
        ui.toast('Accepted in system - traceability recorded', 'how_to_reg');
        App.refresh();
      };
      const p = root.querySelector('#printBtn');
      if (p) p.onclick = () => window.print();
    },
  });
})();
