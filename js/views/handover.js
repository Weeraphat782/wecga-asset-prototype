/* Handover (#/handover, #/handover/new, #/handover/:id)  - page 3, item 9.
   Coverage: H1 (deliver + accept in system = traceability),
             H2 (send by owner OR as a list, via Email OR WeCGA record),
             H3 (owner = Individual [email] or Organization [Head-of email]).  */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, icon = App.icon, esc = App.esc;

  const HO_STEPS = [
    { title: 'Select assets', desc: 'Pick assets to deliver to their holders (H1)' },
    { title: 'Send options', desc: 'By owner or as a list, via Email or WeCGA record (H2)' },
    { title: 'Review & send', desc: 'Confirm and create one handover service request for owner acceptance' },
  ];

  const wiz = { step: 0, loc: null, assetIds: [], mode: 'owner', channel: 'email', q: '', taggingTicketId: null };
  App._handoverWizard = wiz; // ponytail: harness self-check
  let listFilter = 'all';
  let ownerFilter = 'all';

  function handoverTickets() {
    return App.store.tickets.filter(t => t.type === 'Handover' && t.company === App.session.company);
  }

  function companyAssets() {
    return App.store.assets.filter(a => a.companyCode === App.session.company);
  }

  function resetWizard() {
    wiz.step = 0; wiz.loc = App.emptyLoc(); wiz.assetIds = []; wiz.q = ''; wiz.mode = 'owner'; wiz.channel = 'email'; wiz.taggingTicketId = null;
  }

  function assetLoc(a) {
    return a ? { company: a.companyCode, project: a.project, building: a.building, floor: a.floor, unit: a.unit } : null;
  }

  function openHandoverForTagging(tagId) {
    return App.store.tickets.find(t => t.type === 'Handover' && t.taggingTicketId === tagId && t.status !== 'Completed');
  }
  App.handoverForTagging = openHandoverForTagging;

  // ponytail: after tagging complete — prefill handover wizard from source TK
  App.startHandoverFromTagging = (taggingId) => {
    const tag = App.ticket(taggingId);
    if (!tag || tag.type !== 'Tagging') { ui.toast('Tagging service request not found', 'error'); return; }
    const ids = App.ticketAssetIds(tag);
    if (!ids.length) { ui.toast('No assets on this tagging ticket', 'error'); return; }
    const open = openHandoverForTagging(taggingId);
    if (open) { ui.toast('Handover already open — ' + open.id, 'info'); App.navigate('#/handover/' + open.id); return; }
    const allTagged = ids.every(id => (App.asset(id) || {}).tagStatus === 'Tagged');
    if (tag.status !== 'Completed' && !allTagged) { ui.toast('Finish tagging and first record before handover', 'error'); return; }
    resetWizard();
    wiz.taggingTicketId = taggingId;
    wiz.assetIds = ids.slice();
    const first = App.asset(ids[0]);
    if (first) wiz.loc = assetLoc(first);
    wiz.step = 1;
    App.navigate('#/handover/new');
  };

  // H3 - resolve the acceptance recipient from the owner type.
  function recipient(a) {
    if (!a || !a.owner) return { label: 'Unknown', email: '-', kind: 'Individual' };
    if (a.owner.type === 'org') {
      return { label: a.orgName || a.owner.name, email: a.orgHeadEmail || a.owner.email || '-', kind: 'Organization (Head-of)' };
    }
    return { label: a.owner.name, email: a.owner.email || '-', kind: 'Individual' };
  }

  function recipientGroups(assets) {
    const map = new Map();
    assets.forEach(a => {
      const r = recipient(a);
      const key = r.email + '|' + r.label;
      if (!map.has(key)) map.set(key, { label: r.label, email: r.email, kind: r.kind, assets: [] });
      map.get(key).assets.push(a);
    });
    return [...map.values()];
  }
  App.handoverRecipientGroups = recipientGroups; // ponytail: harness self-check

  function isMine(g) {
    const u = App.currentUser();
    if (!u || !g) return false;
    if (g.kind === 'Individual') return g.email === u.email;
    return u.org === g.label;
  }
  App.handoverIsMine = isMine; // ponytail: harness self-check

  function canAccept(g) {
    return isMine(g) || App.hasRole('asset_hq', 'ga');
  }

  function ticketHasMine(t) {
    const assets = App.ticketAssetIds(t).map(id => App.asset(id)).filter(Boolean);
    return recipientGroups(assets).some(isMine);
  }

  function mineTickets() {
    return handoverTickets().filter(ticketHasMine);
  }

  App.handoverAcceptedIds = (t) => {
    if (!t) return [];
    if (t.acceptedIds) return t.acceptedIds;
    if (t.status === 'Completed') return App.ticketAssetIds(t);
    return [];
  };

  App.acceptHandover = (t, assetIds, opts) => {
    if (!t || t.type !== 'Handover' || !assetIds || !assetIds.length) return;
    const all = App.ticketAssetIds(t);
    if (!t.acceptedIds) t.acceptedIds = [];
    assetIds.forEach(id => {
      if (all.includes(id) && !t.acceptedIds.includes(id)) t.acceptedIds.push(id);
    });
    const actor = App.currentUser().name;
    const now = new Date().toISOString();
    const behalf = opts && opts.onBehalfOf;
    t.history.push({
      ts: now, actor, step: 'Owner accepts in system',
      note: (behalf ? 'Accepted on behalf of ' + behalf + ': ' : 'Accepted ')
        + assetIds.length + ' asset(s): ' + assetIds.join(', '),
    });
    const done = App.handoverAcceptedIds(t);
    if (done.length >= all.length) {
      App.advanceTicket(t, 'All recipients accepted');
      t.status = 'Completed';
    } else {
      t.status = t.status === 'Open' ? 'Awaiting acceptance' : 'In progress';
    }
    App.audit({ action: 'Handover accept', target: t.id, detail: done.length + '/' + all.length + ' assets' });
  };

  function channelLabel(ch) {
    return ch === 'wecga' ? 'WeCGA record' : 'Email';
  }

  function sendModeLabel(mode) {
    return mode === 'list' ? 'By list' : 'By owner';
  }

  function seg(id, val, opts) {
    return `<div class="segmented" data-seg="${id}">`
      + opts.map(o => `<button type="button" data-val="${o.v}" class="${o.v === val ? 'active' : ''}">${o.icon ? icon(o.icon) : ''}${o.l}</button>`).join('')
      + `</div>`;
  }

  function acceptanceEmail(assets) {
    const rows = assets.map(a => {
      const r = recipient(a);
      return `<tr><td class="mono">${esc(App.assetCode(a))}</td><td>${esc(a.desc1 || '')}</td><td>${esc(r.label)}</td><td>${esc(r.kind)}</td><td class="mono">${esc(r.email)}</td></tr>`;
    }).join('');
    const to = [...new Set(assets.map(a => recipient(a).email))].join('; ');
    return `<div class="callout info" style="margin-bottom:12px">${icon('mail')}<div>
        <b>To:</b> ${esc(to)}<br>
        <b>Subject:</b> WeCGA - Please accept the asset(s) assigned to you</div></div>
      <p>Dear Asset Owner,</p>
      <p>The following ${assets.length > 1 ? 'assets have' : 'asset has'} been delivered and assigned to you in WeCGA.
      Please open WeCGA and <b>Accept in system</b> to confirm receipt - this establishes traceability of the asset.</p>
      <div class="table-wrap"><table class="data"><thead><tr>
        <th>Asset code</th><th>Description</th><th>Owner</th><th>Type</th><th>Send to</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p style="margin-top:12px">Regards,<br>WeCGA Asset Management</p>`;
  }

  function previewBody(assets, mode, channel) {
    if (channel === 'wecga') {
      return ui.callout('info', 'A WeCGA in-system record is created; each owner accepts their items on the service request detail page.');
    }
    if (mode === 'list') return acceptanceEmail(assets);
    const groups = recipientGroups(assets);
    return groups.map((g, i) =>
      (i ? '<hr style="margin:20px 0;border:none;border-top:1px solid var(--sm-border-strong)">' : '')
      + `<div class="muted" style="margin-bottom:8px"><b>Email ${i + 1}/${groups.length}</b> &mdash; To: ${esc(g.label)} <span class="mono">(${esc(g.email)})</span></div>`
      + acceptanceEmail(g.assets)
    ).join('');
  }

  function filteredAssets() {
    if (!App.locComplete(wiz.loc)) return [];
    return companyAssets().filter(a => App.locMatch(a, wiz.loc));
  }

  function captureHandover(root) {
    if (!root) return;
    if (!wiz.loc) wiz.loc = App.emptyLoc();
    App.captureLocFields(root, wiz.loc);
  }

  function stepError() {
    if (wiz.step === 0 && !App.locComplete(wiz.loc)) return 'Select Company through Unit';
    if (wiz.step === 0 && !wiz.assetIds.length) return 'Select at least one asset';
    return null;
  }

  function wizardAssets() {
    return wiz.assetIds.map(id => App.asset(id)).filter(Boolean);
  }

  function acceptProgress(t) {
    const total = App.ticketAssetIds(t).length;
    const done = App.handoverAcceptedIds(t).length;
    return { done, total, left: total - done };
  }

  function progressCell(t) {
    const p = acceptProgress(t);
    if (!p.total) return '-';
    const chip = p.left ? ui.chip(p.left + ' remaining', 'warn') : ui.chip('All accepted', 'ok');
    return `<span class="mono">${p.done}/${p.total}</span> ${chip}`;
  }

  function showPreview() {
    const assets = wizardAssets();
    if (!assets.length) return ui.toast('Select at least one asset', 'warning');
    const groups = recipientGroups(assets);
    const title = wiz.channel === 'email'
      ? (wiz.mode === 'owner' ? 'Email preview - by owner (' + groups.length + ')' : 'Email preview - list')
      : (wiz.mode === 'owner' ? 'WeCGA record - by owner' : 'WeCGA record - list');
    ui.dialog({
      title, size: 'lg',
      sub: wiz.channel === 'email' ? 'Acceptance request email(s) to owner(s) (H2/H3).' : 'WeCGA record; owners accept on the service request detail page.',
      body: previewBody(assets, wiz.mode, wiz.channel),
      actions: [{ label: 'Close', kind: 'text' }],
    });
  }

  function wizardStepBody() {
    const tagBanner = wiz.taggingTicketId
      ? ui.callout('info', `${icon('link')} From completed tagging <a class="link" data-nav="#/tagging/${esc(wiz.taggingTicketId)}"><span class="mono">${esc(wiz.taggingTicketId)}</span></a> — ${wiz.assetIds.length} asset(s) ready to deliver to owner(s).`)
      : '';
    if (wiz.step === 0) {
      if (!wiz.loc) wiz.loc = App.emptyLoc();
      let body = ui.locFields(wiz.loc);
      if (App.locComplete(wiz.loc)) {
        const rows = filteredAssets();
        body += ui.assetPicker({
          rows, state: wiz,
          columns: [
            { key: 'code', label: 'Asset code', render: r => `<span class="mono">${esc(App.assetCode(r))}</span>` },
            { key: 'desc1', label: 'Description', cls: 'wrap', render: r => esc([r.desc1, r.desc2].filter(Boolean).join(' ')) },
            { key: 'owner', label: 'Owner', render: r => App.ownerLabel(r) },
            { key: '_kind', label: 'Owner type', render: r => esc(recipient(r).kind) },
            { key: '_email', label: 'Send to', render: r => `<span class="mono">${esc(recipient(r).email)}</span>` },
            { key: 'loc', label: 'Location', render: r => App.locCell(r) },
          ],
          empty: 'No assets at this unit',
        });
      } else {
        body += ui.callout('info', 'Select Project, Building, Floor and Unit to list assets.');
      }
      return tagBanner + body;
    }

    if (wiz.step === 1) {
      const assets = wizardAssets();
      if (!assets.length) return ui.callout('warn', 'No assets selected.');
      const groups = recipientGroups(assets);
      const emailCount = wiz.mode === 'owner' ? groups.length : 1;
      return tagBanner + `
        <div class="pill-row" style="margin-bottom:10px">
          <span class="muted">Scope:</span> ${seg('mode', wiz.mode, [{ v: 'owner', l: 'By owner', icon: 'person' }, { v: 'list', l: 'By list', icon: 'list' }])}
          <span class="muted" style="margin-left:12px">Channel:</span> ${seg('channel', wiz.channel, [{ v: 'email', l: 'Email', icon: 'mail' }, { v: 'wecga', l: 'WeCGA record', icon: 'inventory_2' }])}
        </div>
        ${ui.callout('info', `<b>${assets.length}</b> asset(s) to <b>${groups.length}</b> recipient(s). `
          + (wiz.mode === 'owner'
            ? `By owner sends <b>${emailCount}</b> separate email(s) — each owner sees only their items.`
            : 'By list sends <b>1</b> combined email to all recipients.'))}
        <div style="margin-top:12px">
          <button type="button" class="btn tonal" id="previewBtn">${icon('preview')} Email preview</button>
        </div>`;
    }

    // step 2 - review
    const assets = wizardAssets();
    const groups = recipientGroups(assets);
    const rows = assets.map(a => ({
      code: App.assetCode(a),
      desc: [a.desc1, a.desc2].filter(Boolean).join(' '),
      owner: App.ownerLabel(a),
      kind: recipient(a).kind,
      email: recipient(a).email,
    }));
    return tagBanner + ui.table({
      columns: [
        { key: 'code', label: 'Asset code', render: r => `<span class="mono">${esc(r.code)}</span>` },
        { key: 'desc', label: 'Description', cls: 'wrap', render: r => esc(r.desc) },
        { key: 'owner', label: 'Owner', render: r => esc(r.owner) },
        { key: 'kind', label: 'Owner type', render: r => esc(r.kind) },
        { key: 'email', label: 'Send to', render: r => `<span class="mono">${esc(r.email)}</span>` },
      ],
      rows,
      empty: 'No assets',
    })
      + `<dl class="kv" style="grid-template-columns:auto 1fr;margin-top:14px">
        <dt>Send scope</dt><dd>${wiz.mode === 'owner' ? 'By owner (' + groups.length + ' email(s))' : 'By list (1 email)'}</dd>
        <dt>Channel</dt><dd>${esc(channelLabel(wiz.channel))}</dd>
        <dt>Assets</dt><dd>${wiz.assetIds.length}</dd>
        <dt>Recipients</dt><dd>${groups.length}</dd>
      </dl>
      ${ui.callout('info', 'Creates <b>one</b> handover service request. Each owner accepts their items individually on the service request detail page (H1).')}`;
  }

  function wizardNav() {
    const last = HO_STEPS.length - 1;
    const isLast = wiz.step === last;
    const n = wiz.assetIds.length;
    let btns = `<button type="button" class="btn text" id="wizCancel">${icon('close')} Cancel</button>`;
    if (wiz.step > 0) btns += ` <button type="button" class="btn tonal" id="wizBack">${icon('arrow_back')} Back</button>`;
    if (!isLast) btns += ` <button type="button" class="btn" id="wizNext">${icon('arrow_forward')} Next</button>`;
    else btns += ` <button type="button" class="btn" id="wizCreate">${icon('send')} Send handover${n ? ' (' + n + ' assets)' : ''}</button>`;
    return `<div class="pill-row" style="margin-top:22px;justify-content:flex-end">${btns}</div>`;
  }

  function createHandoverTicket() {
    if (!wiz.assetIds.length) { ui.toast('No assets selected', 'error'); return; }
    const flow = App.FLOWS.handover;
    const now = new Date().toISOString();
    const actor = App.currentUser().name;
    const chLabel = channelLabel(wiz.channel);
    const assets = wizardAssets();
    const groups = recipientGroups(assets);
    const first = assets[0];
    const title = groups.length <= 1 && assets.length === 1
      ? 'Handover - ' + App.assetTitle(first)
      : 'Handover - ' + assets.length + ' assets / ' + groups.length + ' recipients';

    const t = App.addTicket({
      type: 'Handover', flow: 'handover',
      assetIds: wiz.assetIds.slice(), assetId: wiz.assetIds[0],
      title, area: first ? (first.area || first.project || '') : '',
      channel: wiz.channel, sendMode: wiz.mode,
      taggingTicketId: wiz.taggingTicketId || undefined,
      origin: wiz.taggingTicketId ? 'tagging' : undefined,
      acceptedIds: [], status: 'Awaiting acceptance', stepIndex: 1,
    });
    t.history = [
      { ts: now, actor, step: flow[0].title, note: assets.length + ' asset(s) delivered to holder(s)' + (wiz.taggingTicketId ? ' (from tagging ' + wiz.taggingTicketId + ')' : '') },
      { ts: now, actor, step: flow[1].title, note: 'Sent via ' + chLabel + ' (' + sendModeLabel(wiz.mode) + ', ' + (wiz.mode === 'owner' ? groups.length + ' email(s)' : '1 email') + ')' },
    ];
    App.audit({ action: 'Handover sent', target: t.id, detail: assets.length + ' assets, ' + groups.length + ' recipients via ' + chLabel });
    resetWizard();
    ui.toast('Handover sent - ' + t.id, 'send');
    App.navigate('#/handover/' + t.id);
  }

  function mountWizard(root) {
    root.querySelectorAll('[data-seg]').forEach(segEl => {
      const key = segEl.getAttribute('data-seg');
      segEl.querySelectorAll('button').forEach(b => b.onclick = () => {
        captureHandover(root); wiz[key] = b.getAttribute('data-val'); App.refresh();
      });
    });

    let prevLoc = wiz.loc ? JSON.stringify(wiz.loc) : '';
    App.mountLocFields(root, wiz.loc || App.emptyLoc(), () => {
      captureHandover(root);
      const next = JSON.stringify(wiz.loc);
      if (next !== prevLoc) { wiz.assetIds = []; prevLoc = next; }
      App.refresh();
    });

    if (wiz.step === 0 && App.locComplete(wiz.loc)) App.mountAssetPicker(root, { state: wiz, rows: filteredAssets() });

    const prev = root.querySelector('#previewBtn');
    if (prev) prev.onclick = () => { captureHandover(root); showPreview(); };

    const cancel = root.querySelector('#wizCancel');
    if (cancel) cancel.onclick = () => { resetWizard(); App.navigate('#/handover'); };

    const back = root.querySelector('#wizBack');
    if (back) back.onclick = () => { captureHandover(root); wiz.step--; App.refresh(); };

    const next = root.querySelector('#wizNext');
    if (next) next.onclick = () => {
      captureHandover(root);
      const err = stepError();
      if (err) { ui.toast(err, 'error'); return; }
      wiz.step++;
      App.refresh();
    };

    const create = root.querySelector('#wizCreate');
    if (create) create.onclick = () => {
      captureHandover(root);
      const err = stepError();
      if (err) { ui.toast(err, 'error'); return; }
      createHandoverTicket();
    };
  }

  function ownerCardsHtml(t, assets) {
    const accepted = App.handoverAcceptedIds(t);
    const allGroups = recipientGroups(assets);
    const mineGroups = allGroups.filter(isMine);
    const mineCount = mineGroups.length;
    const showMineOnly = ownerFilter === 'mine' && mineCount > 0;
    const groups = showMineOnly ? mineGroups : allGroups;
    const completed = t.status === 'Completed';
    const noMineCallout = ownerFilter === 'mine' && !mineCount
      ? ui.callout('info', 'No items assigned to you on this service request — showing all recipients.')
      : '';

    const filterBar = `<div class="pill-row" style="margin-bottom:14px;align-items:center">
      <span class="muted">Show:</span>
      <div class="segmented" data-ofilter>
        <button type="button" data-val="all" class="${ownerFilter === 'all' ? 'active' : ''}">${icon('groups')} All recipients (${allGroups.length})</button>
        <button type="button" data-val="mine" class="${ownerFilter === 'mine' ? 'active' : ''}" ${mineCount ? '' : 'disabled'}>${icon('person')} Mine (${mineCount})</button>
      </div>
    </div>`;

    const cards = groups.map(g => {
      const mine = isMine(g);
      const mayAccept = canAccept(g);
      const onBehalf = mayAccept && !mine;
      const pending = g.assets.filter(a => !accepted.includes(a.id));
      let acceptAllBtn = '';
      if (!completed && pending.length && mayAccept) {
        const lbl = onBehalf ? `Accept all (${pending.length}) on behalf` : `Accept all (${pending.length})`;
        const behalfAttr = onBehalf ? ` data-behalf="${esc(g.label)}"` : '';
        acceptAllBtn = `<button type="button" class="btn sm tonal" data-accept-all="${pending.map(a => a.id).join(',')}"${behalfAttr}>${icon('how_to_reg')} ${lbl}</button>`;
      }
      const titleExtra = !mayAccept ? ' ' + ui.chip('Read-only', 'neutral') : (onBehalf ? ' ' + ui.chip('On behalf', 'info') : '');
      const tableRows = g.assets.map(a => Object.assign({}, a, { _accepted: accepted.includes(a.id) }));
      return ui.card({
        title: `${icon('badge')} ${esc(g.label)}${titleExtra}`,
        sub: `${esc(g.kind)} &nbsp; <span class="mono">${esc(g.email)}</span>`,
        actions: acceptAllBtn,
        body: ui.table({
          columns: [
            { key: 'code', label: 'Asset code', render: r => `<span class="mono">${esc(App.assetCode(r))}</span>` },
            { key: 'desc1', label: 'Description', cls: 'wrap', render: r => esc([r.desc1, r.desc2].filter(Boolean).join(' ')) },
            { key: '_status', label: 'Status', render: r => ui.statusChip(r._accepted ? 'Accepted' : 'Awaiting acceptance') },
            { key: '_act', label: '', render: r => {
              if (r._accepted) return ui.chip('Accepted', 'ok');
              if (completed) return '<span class="muted">—</span>';
              if (!mayAccept) return '<span class="muted">Awaiting owner</span>';
              const behalfAttr = onBehalf ? ` data-behalf="${esc(g.label)}"` : '';
              const lbl = onBehalf ? 'Accept on behalf' : 'Accept';
              return `<button type="button" class="btn sm" data-accept="${r.id}"${behalfAttr}>${icon('how_to_reg')} ${lbl}</button>`;
            } },
          ],
          rows: tableRows,
          empty: 'No assets',
        }),
      });
    }).join('');

    return filterBar + noMineCallout + cards;
  }

  // ---------------- list ----------------
  App.registerView('#/handover', {
    title: 'Handover',
    render() {
      const allTickets = handoverTickets();
      const mine = mineTickets();
      const tickets = listFilter === 'mine' ? mine : allTickets;

      const listFilterBar = `<div class="pill-row" style="margin-bottom:14px;align-items:center">
        <span class="muted">Show:</span>
        <div class="segmented" data-lfilter>
          <button type="button" data-val="all" class="${listFilter === 'all' ? 'active' : ''}">${icon('list')} All service requests (${allTickets.length})</button>
          <button type="button" data-val="mine" class="${listFilter === 'mine' ? 'active' : ''}" ${mine.length ? '' : 'disabled'}>${icon('person')} Mine (${mine.length})</button>
        </div>
      </div>`;

      const list = ui.card({
        title: `${icon('assignment_ind')} Handover service requests`,
        sub: 'One service request can cover many assets and owners; each owner accepts their items (H1).',
        body: listFilterBar + ui.table({
          columns: [
            { key: 'id', label: 'Service request', render: r => `<span class="mono">${r.id}</span>` },
            { key: 'title', label: 'Handover', cls: 'wrap' },
            { key: '_tag', label: 'Tagging TK', render: r => r.taggingTicketId ? `<a class="link mono" data-nav="#/tagging/${App.esc(r.taggingTicketId)}">${App.esc(r.taggingTicketId)}</a>` : '<span class="muted">—</span>' },
            { key: '_mine', label: 'Mine', render: r => ticketHasMine(r) ? ui.chip('Yours', 'info') : '<span class="muted">—</span>' },
            { key: '_n', label: 'Assets', render: r => String(App.ticketAssetIds(r).length) },
            { key: '_asset', label: 'Asset', render: r => {
              const ids = App.ticketAssetIds(r);
              const a = App.asset(ids[0]);
              return a ? esc(App.assetCode(a)) + (ids.length > 1 ? ` <span class="muted">+${ids.length - 1}</span>` : '') : '-';
            } },
            { key: '_owner', label: 'Owner / recipient', render: r => {
              const assets = App.ticketAssetIds(r).map(id => App.asset(id)).filter(Boolean);
              const groups = recipientGroups(assets);
              if (!groups.length) return '-';
              const first = groups[0];
              const more = groups.length > 1 ? ` <span class="muted">+${groups.length - 1} more</span>` : '';
              return `${esc(first.label)} <span class="muted">(${esc(first.kind)})</span>${more}`;
            } },
            { key: '_prog', label: 'Accepted', render: r => progressCell(r) },
            { key: 'channel', label: 'Channel', render: r => esc(channelLabel(r.channel || 'email')) },
            { key: 'status', label: 'Status', render: r => ui.statusChip(r.status) },
          ],
          rows: tickets,
          rowLink: r => '#/handover/' + r.id,
          empty: listFilter === 'mine' ? 'No handover service requests with your items.' : 'No handover service requests — click Add new to start.',
        }),
      });

      return ui.pageHead({
        title: 'Handover',
        sub: 'Deliver assets to holders and record acceptance - page 3, item 9 (H1, H2, H3).',
        actions: `<button type="button" class="btn" id="addNewBtn">${icon('add')} Add new</button>`,
      })
      + ui.callout('info', 'Acceptance in the system establishes <b>traceability</b> of the asset back to its holder (p.3 item 9).')
      + list;
    },
    mount(root) {
      const add = root.querySelector('#addNewBtn');
      if (add) add.onclick = () => { resetWizard(); ownerFilter = 'all'; App.navigate('#/handover/new'); };
      root.querySelectorAll('[data-lfilter] [data-val]').forEach(b => b.onclick = () => {
        if (b.disabled) return;
        listFilter = b.getAttribute('data-val');
        App.refresh();
      });
    },
  });

  // ---------------- wizard (MUST register before #/handover/:id) ----------------
  App.registerView('#/handover/new', {
    title: 'New handover',
    render() {
      if (wiz.step >= HO_STEPS.length) wiz.step = HO_STEPS.length - 1;
      return ui.pageHead({
        title: 'New handover',
        breadcrumb: [{ label: 'Handover', hash: '#/handover' }, { label: 'New handover' }],
        sub: 'Select assets, choose send options, then create one handover service request (p.3 item 9)',
        actions: ui.stepsBar(HO_STEPS, wiz.step),
      }) + ui.card({
        title: icon('edit_note') + ' ' + esc(HO_STEPS[wiz.step].title),
        sub: `Step ${wiz.step + 1} of ${HO_STEPS.length} &mdash; ${HO_STEPS[wiz.step].desc}`,
        body: `<form id="wizForm">${wizardStepBody()}${wizardNav()}</form>`,
      });
    },
    mount: mountWizard,
  });

  // ---------------- detail ----------------
  App.registerView('#/handover/:id', {
    title: ctx => (App.ticket(ctx.params.id) || {}).id || 'Handover',
    render(ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t || t.type !== 'Handover') return ui.pageHead({ title: 'Handover not found' }) + ui.callout('warn', 'No handover service request for this id.');
      const ids = App.ticketAssetIds(t);
      const assets = ids.map(id => App.asset(id)).filter(Boolean);
      const groups = recipientGroups(assets);
      const p = acceptProgress(t);
      const codes = assets.map(x => App.assetCode(x)).join(', ');

      const record = `<div class="card" id="acceptRecord">
        <div class="card-title">${icon('receipt_long')} Acceptance record</div>
        <dl class="kv" style="grid-template-columns:auto 1fr">
          <dt>Service request</dt><dd class="mono">${esc(t.id)}</dd>
          <dt>Assets</dt><dd>${p.done}/${p.total} accepted</dd>
          <dt>Recipients</dt><dd>${groups.length}</dd>
          <dt>Asset codes</dt><dd class="mono wrap">${codes ? esc(codes) : '-'}</dd>
          <dt>Send scope</dt><dd>${esc(sendModeLabel(t.sendMode || 'owner'))}</dd>
          <dt>Channel</dt><dd>${esc(channelLabel(t.channel || 'email'))}</dd>
          ${t.taggingTicketId ? `<dt>Tagging TK</dt><dd><a class="link mono" data-nav="#/tagging/${esc(t.taggingTicketId)}">${esc(t.taggingTicketId)}</a></dd>` : ''}
          <dt>Date</dt><dd>${fmt.date(new Date().toISOString())}</dd>
        </dl>
        <div style="margin-top:24px;border-top:1px dashed var(--md-outline);padding-top:12px">
          Signature: <span style="display:inline-block;border-bottom:1px solid var(--md-on-surface);min-width:220px">&nbsp;</span>
          &nbsp;&nbsp; Date: <span style="display:inline-block;border-bottom:1px solid var(--md-on-surface);min-width:120px">&nbsp;</span>
        </div>
      </div>`;

      const actions = `<div class="pill-row" style="justify-content:flex-end">
        <button type="button" class="btn text" id="histBtn">${icon('history')} History</button>
        <button type="button" class="btn outline" id="printBtn">${icon('print')} Print acceptance record</button>
      </div>`;

      const progressCallout = p.left
        ? ui.callout('warn', `<b>${p.left}</b> asset(s) still awaiting acceptance. Owners may accept items individually — not every item for an owner must be accepted at once.`)
        : ui.callout('info', 'All assets accepted in system — traceability recorded (H1).');
      const tagRef = t.taggingTicketId
        ? ui.callout('info', `${icon('link')} Follows completed tagging <a class="link" data-nav="#/tagging/${esc(t.taggingTicketId)}"><span class="mono">${esc(t.taggingTicketId)}</span></a> — deliver tagged assets to owner(s) for acceptance (p.3 item 9).`)
        : '';

      return ui.pageHead({
        title: 'Handover - ' + t.id,
        breadcrumb: [{ label: 'Handover', hash: '#/handover' }, { label: t.id }],
        sub: `${esc(t.title)} &nbsp; ${ui.statusChip(t.status)} &nbsp; ${progressCell(t)}`,
        actions,
      })
      + tagRef
      + progressCallout
      + ownerCardsHtml(t, assets)
      + `<div class="grid cols-2" style="align-items:start;margin-top:16px">
          <div>${ui.card({ title: `${icon('conveyor_belt')} Handover flow`, sub: 'Service request completes when every asset is accepted in the system.', body: ui.stepper(App.FLOWS.handover, t.stepIndex) })}</div>
          <div>${record}</div>
        </div>`;
    },
    mount(root, ctx) {
      root.querySelectorAll('[data-ofilter] [data-val]').forEach(b => b.onclick = () => {
        if (b.disabled) return;
        ownerFilter = b.getAttribute('data-val');
        App.refresh();
      });
      root.querySelectorAll('[data-accept]').forEach(btn => btn.onclick = () => {
        const t = App.ticket(ctx.params.id);
        if (!t || t.status === 'Completed') return;
        const behalf = btn.getAttribute('data-behalf');
        App.acceptHandover(t, [btn.getAttribute('data-accept')], behalf ? { onBehalfOf: behalf } : undefined);
        ui.toast('Accepted in system', 'how_to_reg');
        App.refresh();
      });
      root.querySelectorAll('[data-accept-all]').forEach(btn => btn.onclick = () => {
        const t = App.ticket(ctx.params.id);
        if (!t || t.status === 'Completed') return;
        const ids = btn.getAttribute('data-accept-all').split(',').filter(Boolean);
        const behalf = btn.getAttribute('data-behalf');
        App.acceptHandover(t, ids, behalf ? { onBehalfOf: behalf } : undefined);
        ui.toast('Accepted ' + ids.length + ' item(s)', 'how_to_reg');
        App.refresh();
      });
      const hist = root.querySelector('#histBtn');
      if (hist) hist.onclick = () => {
        const t = App.ticket(ctx.params.id);
        const body = (t.history && t.history.length)
          ? ui.timeline(t.history.map(h => ({ title: h.step, meta: `${App.fmt.datetime(h.ts)} - ${h.actor}${h.note ? ' - ' + h.note : ''}` })))
          : '<div class="muted">No steps recorded yet.</div>';
        ui.dialog({ title: 'History', sub: t.id, body, size: 'lg' });
      };
      const p = root.querySelector('#printBtn');
      if (p) p.onclick = () => window.print();
    },
  });
})();
