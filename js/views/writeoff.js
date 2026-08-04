/* Disposal / Write-off  (#/writeoff  +  #/writeoff/:id)
   The three PDF write-off tracks, each with its own literal FLOW:
     SALE     - damaged / not needed => sale   (App.FLOWS.writeoffSale, p.7)
     DONATION - donate unused asset            (App.FLOWS.writeoffDonation, p.8)
     LOST     - loss + compensation            (App.FLOWS.writeoffLost, p.6, p.9)
   Coverage IDs: M7, W5, L1, L2, L3, L4, L5, WS1..WS6, WD1..WD3, WL1, WL2.
   Reuses App.assetCode / assetTitle / ownerLabel / exportRows from views/assets.js. */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, icon = App.icon;

  // Track config: maps the customer-facing track name to its FLOW + ticket type.
  const TRACKS = {
    Sale:     { flow: 'writeoffSale',     type: 'Write-off Sale',     icon: 'sell',                page: 'p.7', ids: 'WS1-WS6', tone: 'info' },
    Donation: { flow: 'writeoffDonation', type: 'Write-off Donation', icon: 'volunteer_activism',  page: 'p.8', ids: 'WD1-WD3', tone: 'ok'   },
    Lost:     { flow: 'writeoffLost',     type: 'Write-off Lost',      icon: 'search_off',          page: 'p.6 / p.9', ids: 'L1-L5, WL1-WL2', tone: 'danger' },
  };
  const trackOf = (t) => (t.type || '').replace('Write-off ', '') || 'Sale';

  // Track-specific documents named in the requirements (attachment affordance targets).
  function requiredDocs(t) {
    const track = trackOf(t);
    if (track === 'Sale') return ['Approved E-memo', 'Payment receipt (vendor)'];
    if (track === 'Donation') return ['Certificate of appreciation'];
    // Lost - depends on the loss sub-case (p.6)
    if (t.lossType === 'theft') return ['Police daily record (copy)', 'POA + authorized signatory card', 'Compensation receipt'];
    return ['Supervisor / transferee memo', 'Disaster report (fire/flood/earthquake)', 'Compensation receipt'];
  }

  function causeLabel(t) {
    const track = trackOf(t);
    if (track === 'Lost') {
      let s = t.lossType === 'theft' ? 'Theft' : 'Unknown cause';
      if (t.unknownReason) s += ' - ' + t.unknownReason;
      return s;
    }
    if (track === 'Sale') return (t.verify && t.verify.cause) ? t.verify.cause : (t.insuranceClaim ? 'Damaged (insurance claim)' : 'Damaged / not needed');
    return t.recipient ? 'Donate \u2192 ' + t.recipient : 'Donation';
  }

  const companyWriteoffs = () => App.store.tickets.filter(t =>
    (t.type || '').startsWith('Write-off') && t.company === App.session.company);

  const openQuestionCallouts = () => (App.OPEN_QUESTIONS || [])
    .filter(q => q.route === '#/writeoff')
    .map(q => ui.callout('question', `<b>Open question (p.${q.page})</b> - ${App.esc(q.text)}`))
    .join('');

  const stepLabel = (t) => {
    const flow = App.FLOWS[t.flow] || [];
    const s = flow[t.stepIndex];
    return s ? (t.stepIndex + 1) + '. ' + s.title : '-';
  };

  /* ====================================================================
     MAIN SCREEN  #/writeoff
     ==================================================================== */
  let state = { filter: 'All' };

  App.registerView('#/writeoff', {
    title: 'Disposal / Write-off',
    render() {
      const all = companyWriteoffs();
      const openCount = (track) => all.filter(t => trackOf(t) === track && t.status !== 'Completed').length;

      const kpis = `<div class="grid cols-4">
        ${ui.kpi({ label: 'Open write-offs', value: all.filter(t => t.status !== 'Completed').length, icon: 'delete_sweep' })}
        ${ui.kpi({ label: 'Sale (p.7)', value: openCount('Sale'), icon: TRACKS.Sale.icon, tone: 'info' })}
        ${ui.kpi({ label: 'Donation (p.8)', value: openCount('Donation'), icon: TRACKS.Donation.icon, tone: 'ok' })}
        ${ui.kpi({ label: 'Lost (p.6 / p.9)', value: openCount('Lost'), icon: TRACKS.Lost.icon, tone: 'danger' })}
      </div>`;

      const rows = all.filter(t => state.filter === 'All' || trackOf(t) === state.filter);
      const table = ui.table({
        columns: [
          { key: 'id', label: 'Ticket', render: r => `<span class="mono">${App.esc(r.id)}</span>` },
          { key: 'track', label: 'Track', render: r => ui.chip(trackOf(r), TRACKS[trackOf(r)] ? TRACKS[trackOf(r)].tone : 'neutral') },
          { key: 'asset', label: 'Asset', cls: 'wrap', render: r => { const a = App.asset(r.assetId); return a ? App.esc(App.assetTitle(a)) : App.esc(r.assetId || '-'); } },
          { key: 'cause', label: 'Cause / loss type', cls: 'wrap', render: r => App.esc(causeLabel(r)) },
          { key: 'step', label: 'Current step', cls: 'wrap', render: r => App.esc(stepLabel(r)) },
          { key: 'status', label: 'Status', render: r => ui.statusChip(r.status) },
        ],
        rows,
        rowLink: r => '#/writeoff/' + r.id,
        empty: 'No write-off tickets for this company / filter',
      });

      return ui.pageHead({
        title: 'Disposal / Write-off',
        sub: 'Three tracks with the literal PDF steps: <b>Sale</b> (p.7), <b>Donation</b> (p.8), <b>Lost</b> (p.6 / p.9). '
          + 'Approval workflow via sub-committee then committee. <span class="muted">Modules M7, W5</span>',
        actions: `<button class="btn" id="newWo">${icon('add')} New write-off</button>`,
      })
      + openQuestionCallouts()
      + kpis
      + ui.tabs('woTracks', [
          { id: 'All', label: 'All' },
          { id: 'Sale', label: 'Sale' },
          { id: 'Donation', label: 'Donation' },
          { id: 'Lost', label: 'Lost' },
        ], state.filter)
      + ui.card({ title: `${icon('list_alt')} Write-off tickets`, body: table });
    },
    mount(root) {
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { state.filter = b.getAttribute('data-tab'); App.refresh(); });
      const nw = root.querySelector('#newWo');
      if (nw) nw.onclick = () => openNewDialog();
    },
  });

  /* ---------- New write-off dialog ---------- */
  function openNewDialog(presetAssetId) {
    const assets = App.store.assets.filter(a => a.companyCode === App.session.company);
    const assetOpts = assets.map(a => ({ value: a.id, label: App.assetCode(a) + ' - ' + [a.desc1, a.desc2].filter(Boolean).join(' ') }));

    const body = `
      <div class="form-grid">
        ${ui.field({ label: 'Track', name: 'track', type: 'select', required: true, options: ['Sale', 'Donation', 'Lost'], hint: 'Sale p.7 / Donation p.8 / Lost p.6-9' })}
        ${ui.field({ label: 'Asset', name: 'assetId', type: 'select', required: true, value: presetAssetId || '', options: assetOpts })}
      </div>
      <div data-tf="Sale">
        ${ui.field({ label: 'Cause (damaged / not needed)', name: 'cause', type: 'text', attrs: 'placeholder="e.g. hardware failure, beyond repair"' })}
        ${ui.field({ label: 'Insurance claim?', name: 'insuranceClaim', type: 'select', options: ['No', 'Yes'], hint: 'A claimed asset may keep being used (transfer location while awaiting claim) or be sold (p.7 WS1)' })}
      </div>
      <div data-tf="Donation" style="display:none">
        ${ui.field({ label: 'Recipient', name: 'recipient', type: 'text', attrs: 'placeholder="e.g. local school / foundation"', hint: 'Recipient issues a certificate of appreciation (p.8 WD3)' })}
      </div>
      <div data-tf="Lost" style="display:none">
        ${ui.field({ label: 'Loss type', name: 'lossType', type: 'select', options: [{ value: 'theft', label: 'Theft' }, { value: 'unknown', label: 'Unknown cause' }], hint: 'Theft needs a police daily record; company asset needs POA + signatory card (p.6 L3)' })}
        <div data-lost="unknown" style="display:none">
          ${ui.field({ label: 'Unknown sub-reason', name: 'unknownReason', type: 'select', options: ['resignation', 'disaster - fire', 'disaster - flood', 'disaster - earthquake'], hint: 'Resignation (supervisor/transferee memo) or disaster (p.6 L4)' })}
        </div>
      </div>`;

    const dlg = ui.dialog({
      title: 'New write-off ticket', size: 'lg',
      sub: 'Pick a track and asset. Track-specific fields follow the PDF cases.',
      body,
      actions: [
        { label: 'Cancel', kind: 'text' },
        { label: 'Create ticket', kind: 'btn', act: (d) => {
          const val = (n) => { const el = d.root.querySelector(`[name="${n}"]`); return el ? el.value : ''; };
          const track = val('track');
          const assetId = val('assetId');
          if (!assetId) { ui.toast('Pick an asset first', 'warning'); return; }
          const cfg = TRACKS[track];
          const t = { type: cfg.type, flow: cfg.flow, assetId, title: track + ' write-off - ' + assetId };
          if (track === 'Sale') { t.insuranceClaim = val('insuranceClaim') === 'Yes'; if (val('cause')) t.verify = { cause: val('cause'), cost: (App.asset(assetId) || {}).cost, nbv: (App.asset(assetId) || {}).nbv, storage: '' }; }
          else if (track === 'Donation') { t.recipient = val('recipient'); }
          else { t.lossType = val('lossType'); if (t.lossType === 'unknown') t.unknownReason = val('unknownReason'); }
          const created = App.addTicket(t);
          ui.toast('Created ' + created.id, 'check_circle');
          App.navigate('#/writeoff/' + created.id);
        } },
      ],
    });

    // track selector toggles the track-specific field blocks
    const trackSel = dlg.root.querySelector('[name="track"]');
    const showTrack = (tr) => dlg.root.querySelectorAll('[data-tf]').forEach(el => { el.style.display = el.getAttribute('data-tf') === tr ? '' : 'none'; });
    if (trackSel) trackSel.onchange = e => showTrack(e.target.value);
    const lossSel = dlg.root.querySelector('[name="lossType"]');
    const showLost = (v) => { const el = dlg.root.querySelector('[data-lost="unknown"]'); if (el) el.style.display = v === 'unknown' ? '' : 'none'; };
    if (lossSel) lossSel.onchange = e => showLost(e.target.value);
  }

  /* ====================================================================
     DETAIL SCREEN  #/writeoff/:id
     ==================================================================== */
  App.registerView('#/writeoff/:id', {
    title: ctx => ctx.params.id,
    render(ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t || !(t.type || '').startsWith('Write-off')) return ui.pageHead({ title: 'Write-off ticket not found' }) + ui.callout('warn', 'No such write-off ticket.');
      const track = trackOf(t);
      const cfg = TRACKS[track] || TRACKS.Sale;
      const a = App.asset(t.assetId);
      const flow = App.FLOWS[t.flow] || [];
      const done = t.status === 'Completed' || t.stepIndex >= flow.length - 1;

      /* --- header chips (track + sub-case) --- */
      let chips = ui.chip(track + ' (' + cfg.page + ')', cfg.tone);
      if (track === 'Lost') {
        chips += ' ' + ui.chip(t.lossType === 'theft' ? 'Theft' : 'Unknown cause', t.lossType === 'theft' ? 'danger' : 'warn');
        if (t.unknownReason) chips += ' ' + ui.chip(t.unknownReason, 'neutral');
      }
      if (track === 'Sale') chips += ' ' + ui.chip(t.insuranceClaim ? 'Insurance claim: Yes' : 'Insurance claim: No', t.insuranceClaim ? 'warn' : 'neutral');
      chips += ' ' + ui.statusChip(t.status);

      /* --- asset summary card --- */
      const assetCard = a ? ui.card({
        title: `${icon('inventory_2')} Asset`,
        actions: `<button class="btn text sm" data-nav="#/assets/${a.id}">Open asset ${icon('open_in_new')}</button>`,
        body: `<dl class="kv" style="grid-template-columns:auto 1fr">
          <dt>Asset</dt><dd><a class="link" data-nav="#/assets/${a.id}">${App.esc(App.assetTitle(a))}</a></dd>
          <dt>Owner</dt><dd>${App.esc(App.ownerLabel(a))}</dd>
          <dt>SAP Asset code</dt><dd class="mono">${App.esc(a.asset || '- (no SAP code, WeCGA only)')}</dd>
          <dt>COST</dt><dd>${fmt.money(a.cost)}</dd>
          <dt>NBV</dt><dd>${fmt.money(a.nbv)}</dd>
          <dt>Current storage / location</dt><dd>${App.esc(a.locationDesc || '-')}${a.room ? ' - ' + App.esc(a.room) : ''}</dd>
        </dl>`,
      }) : ui.callout('warn', 'Linked asset not found.');

      /* --- origin: spawned from a count --- */
      const originCallout = t.origin === 'count'
        ? ui.callout('info', `This write-off was spawned from an <b>inventory count</b> outcome (p.10 3.4). See <a class="link" data-nav="#/reconcile">Reconciliation</a> and <a class="link" data-nav="#/audit">Audit log</a>.`)
        : '';

      /* --- Asset Team Verify panel (cause / COST / NBV / storage) --- */
      const v = t.verify || {};
      const verifyCard = ui.card({
        title: `${icon('fact_check')} Asset Team Verify`,
        sub: (track === 'Sale' ? 'p.7 step 7 (WS3)' : track === 'Donation' ? 'p.8 step 3 (WD2)' : 'p.6 / p.9 step 3 (L2, WL1)') + ' - verify cause, COST, NBV, current storage location. Role: <b>Asset Team HQ</b>.',
        body: `<div class="form-grid">
            ${ui.field({ label: 'Cause / damage detail', name: 'v_cause', type: 'text', value: v.cause || '', attrs: App.hasRole('asset_hq') ? '' : 'readonly' })}
            ${ui.field({ label: 'COST', name: 'v_cost', type: 'text', value: v.cost != null ? v.cost : (a ? a.cost : ''), attrs: App.hasRole('asset_hq') ? '' : 'readonly' })}
          </div>
          <div class="form-grid">
            ${ui.field({ label: 'NBV', name: 'v_nbv', type: 'text', value: v.nbv != null ? v.nbv : (a ? a.nbv : ''), attrs: App.hasRole('asset_hq') ? '' : 'readonly' })}
            ${ui.field({ label: 'Current storage location', name: 'v_storage', type: 'text', value: v.storage || (a ? (a.room || a.locationDesc || '') : ''), attrs: App.hasRole('asset_hq') ? '' : 'readonly' })}
          </div>
          ${track === 'Lost' ? ui.field({ label: 'Compensate or not', name: 'v_compensate', type: 'select', options: ['Compensate', 'Do not compensate'], value: v.compensate || '', attrs: App.hasRole('asset_hq') ? '' : 'disabled' }) : ''}
          ${App.hasRole('asset_hq') ? `<div class="pill-row" style="margin-top:8px"><button class="btn sm" data-act="saveVerify">${icon('save')} Save verify</button></div>` : ui.callout('info', 'Read-only - switch role to <b>Asset Team HQ</b> to edit the verify panel.')}`,
      });

      /* --- track-specific panel --- */
      let trackCard = '';
      if (track === 'Sale') {
        trackCard = ui.card({
          title: `${icon('sell')} Sale - insurance & E-memo`,
          sub: 'p.7 WS1-WS2. Claim insurance if applicable; a claimed asset may keep being used (transfer location while awaiting claim) or be sold.',
          body: `<div class="form-grid">
              ${ui.field({ label: 'Insurance claim?', name: 's_claim', type: 'select', options: ['No', 'Yes'], value: t.insuranceClaim ? 'Yes' : 'No' })}
              ${ui.field({ label: 'Claimed asset - what next?', name: 's_decision', type: 'select', value: t.claimDecision || '', options: ['', 'Continue using - transfer location while awaiting claim', 'Sell'] })}
            </div>
            ${ui.callout('question', 'p.7 open question - <b>WeCGA generates the E-memo detail</b> (flow step 5). Whether WeCGA also routes the request to the line supervisor, or the approved memo comes from outside WeCGA, is still to confirm. Both paths are shown.')}
            <div class="pill-row" style="margin-top:8px"><button class="btn sm" data-act="genMemo">${icon('draft')} WeCGA generate E-memo detail</button> <button class="btn text sm" data-act="saveClaim">${icon('save')} Save</button></div>`,
        });
      } else if (track === 'Donation') {
        trackCard = ui.card({
          title: `${icon('volunteer_activism')} Donation - recipient & certificate`,
          sub: 'p.8 WD1-WD3. Recipient receives the asset and issues a certificate of appreciation.',
          body: `${ui.field({ label: 'Recipient', name: 'd_recipient', type: 'text', value: t.recipient || '', attrs: 'placeholder="e.g. local school / foundation"' })}
            ${ui.callout('info', 'The <b>certificate of appreciation</b> is tracked in Attachments below (p.8 WD3).')}
            <div class="pill-row" style="margin-top:8px"><button class="btn sm" data-act="saveRecipient">${icon('save')} Save recipient</button></div>`,
        });
      } else {
        trackCard = ui.card({
          title: `${icon('search_off')} Lost - sub-case`,
          sub: 'p.6 L1-L5. Memo + line approval up to Head-of; Asset Team checks cause/COST/NBV/compensate-or-not.',
          body: `<div class="form-grid">
              ${ui.field({ label: 'Loss type', name: 'l_type', type: 'select', options: [{ value: 'theft', label: 'Theft' }, { value: 'unknown', label: 'Unknown cause' }], value: t.lossType || 'unknown' })}
              ${ui.field({ label: 'Unknown sub-reason', name: 'l_reason', type: 'select', value: t.unknownReason || '', options: ['', 'resignation', 'disaster - fire', 'disaster - flood', 'disaster - earthquake', 'no evidence from Store'] })}
            </div>
            ${t.lossType === 'theft'
              ? ui.callout('warn', 'Theft (p.6 L3): attach the <b>police daily-record copy</b>; for a company asset also attach <b>POA + authorized signatory card</b> (see Attachments).')
              : ui.callout('info', 'Unknown cause (p.6 L4): resignation (supervisor / transferee memo) <b>or</b> disaster (fire / flood / earthquake).')}
            ${ui.callout('info', `L5 - the loss log is kept and searchable in WeCGA. Open the <a class="link" data-nav="#/audit">Audit log</a>.`)}
            <div class="pill-row" style="margin-top:8px"><button class="btn sm" data-act="saveLost">${icon('save')} Save sub-case</button></div>`,
        });
      }

      /* --- Attachments --- */
      const attached = t.attachments || [];
      const docs = requiredDocs(t);
      const docRows = docs.map(d => {
        const has = attached.includes(d);
        return `<li class="${has ? 'pass' : 'pending'}">${icon(has ? 'check_circle' : 'radio_button_unchecked')}
          <span style="flex:1">${App.esc(d)} ${has ? ui.chip('Attached', 'ok') : ui.chip('Required', 'warn')}</span>
          ${has ? '' : `<button class="btn text sm" data-act="attach" data-doc="${App.esc(d)}">${icon('attach_file')} Attach</button>`}</li>`;
      }).join('');
      const extra = attached.filter(x => !docs.includes(x)).map(x => `<li class="pass">${icon('check_circle')}<span>${App.esc(x)} ${ui.chip('Attached', 'ok')}</span></li>`).join('');
      const attachCard = ui.card({
        title: `${icon('attachment')} Attachments`,
        sub: 'Track-specific documents named in the requirements.',
        body: `<ul class="checklist">${docRows}${extra}</ul>`,
      });

      /* --- Stepper (all numbered steps) + advance/approval --- */
      const stepper = ui.stepper(flow, t.stepIndex);
      const step = flow[t.stepIndex];
      let advance = '';
      if (done) {
        advance = ui.callout('info', `${icon('task_alt')} This write-off is complete (all ${flow.length} steps done).`);
      } else if (step) {
        const roleName = App.ROLES[step.role] || step.role;
        const canAct = App.hasRole(step.role);
        const isApproval = step.role === 'committee';
        const btnLabel = isApproval ? (step.title.indexOf('Sub-committee') === 0 ? 'Approve (Sub-committee)' : 'Approve (Committee)') : 'Advance step';
        advance = canAct
          ? `<div class="pill-row"><button class="btn" data-act="advance">${icon(isApproval ? 'gavel' : 'arrow_forward')} ${btnLabel}</button>
             <span class="muted">Acting as <b>${App.esc(roleName)}</b></span></div>`
          : ui.callout('warn', `Current step <b>${App.esc(step.title)}</b> is gated to role <b>${App.esc(roleName)}</b>. Switch role (top bar) to act.`);
      }
      const stepperCard = ui.card({
        title: `${icon('conveyor_belt')} Process - ${cfg.flow} (${cfg.page}, ${cfg.ids})`,
        sub: 'The literal numbered steps from the PDF. Approvals: Sub-committee then Committee (role Disposal Committee); Verify (Asset Team HQ); SAP removal (Accounting).',
        body: stepper + advance,
      });

      /* --- history timeline --- */
      const historyCard = (t.history && t.history.length) ? ui.card({
        title: `${icon('history')} History`,
        body: ui.timeline(t.history.map(h => ({ title: h.step, meta: `${fmt.datetime(h.ts)} - ${h.actor}${h.note ? ' - ' + h.note : ''}` }))),
      }) : '';

      const runInfo = t.runNumber ? ui.callout('info', `${icon('description')} PDF report run number <b class="mono">${App.esc(t.runNumber)}</b> generated (p.7 WS6 step 15).`) : '';

      return ui.pageHead({
        title: t.id + ' - ' + track + ' write-off',
        breadcrumb: [{ label: 'Disposal / Write-off', hash: '#/writeoff' }, { label: t.id }],
        sub: chips,
        actions: `<button class="btn tonal sm" data-act="pdf">${icon('picture_as_pdf')} Generate PDF report (run number)</button>
          <button class="btn outline sm" data-act="excel">${icon('table_view')} Export Excel</button>`,
      })
      + openQuestionCallouts()
      + originCallout
      + runInfo
      + `<div class="grid cols-2" style="align-items:start">
          <div>${assetCard}${verifyCard}${trackCard}${attachCard}</div>
          <div>${stepperCard}${historyCard}</div>
        </div>`;
    },
    mount(root, ctx) {
      const t = App.ticket(ctx.params.id);
      if (!t) return;

      const val = (n) => { const el = root.querySelector(`[name="${n}"]`); return el ? el.value : ''; };

      const save = root.querySelector('[data-act="saveVerify"]');
      if (save) save.onclick = () => {
        t.verify = Object.assign({}, t.verify, {
          cause: val('v_cause'),
          cost: Number(val('v_cost')) || val('v_cost'),
          nbv: Number(val('v_nbv')) || val('v_nbv'),
          storage: val('v_storage'),
        });
        if (root.querySelector('[name="v_compensate"]')) t.verify.compensate = val('v_compensate');
        App.audit({ action: 'Write-off verify saved', target: t.id, detail: t.verify.cause || '' });
        ui.toast('Verify saved', 'save');
        App.refresh();
      };

      const claim = root.querySelector('[data-act="saveClaim"]');
      if (claim) claim.onclick = () => {
        t.insuranceClaim = val('s_claim') === 'Yes';
        t.claimDecision = val('s_decision');
        App.audit({ action: 'Write-off insurance updated', target: t.id, detail: (t.insuranceClaim ? 'Claim: Yes' : 'Claim: No') + (t.claimDecision ? ' - ' + t.claimDecision : '') });
        ui.toast('Saved', 'save');
        App.refresh();
      };

      const memo = root.querySelector('[data-act="genMemo"]');
      if (memo) memo.onclick = () => {
        App.audit({ action: 'WeCGA generated E-memo detail', target: t.id, detail: 'p.7 step 5 (open question)' });
        ui.toast('WeCGA generated the E-memo detail', 'draft');
      };

      const rec = root.querySelector('[data-act="saveRecipient"]');
      if (rec) rec.onclick = () => {
        t.recipient = val('d_recipient');
        App.audit({ action: 'Donation recipient saved', target: t.id, detail: t.recipient || '' });
        ui.toast('Recipient saved', 'save');
        App.refresh();
      };

      const lost = root.querySelector('[data-act="saveLost"]');
      if (lost) lost.onclick = () => {
        t.lossType = val('l_type');
        t.unknownReason = t.lossType === 'unknown' ? val('l_reason') : '';
        App.audit({ action: 'Loss sub-case saved', target: t.id, detail: causeLabel(t) });
        ui.toast('Sub-case saved', 'save');
        App.refresh();
      };

      root.querySelectorAll('[data-act="attach"]').forEach(b => b.onclick = () => {
        const doc = b.getAttribute('data-doc');
        t.attachments = t.attachments || [];
        if (!t.attachments.includes(doc)) t.attachments.push(doc);
        App.audit({ action: 'Attachment added', target: t.id, detail: doc });
        ui.toast('Attached: ' + doc, 'attach_file');
        App.refresh();
      });

      const adv = root.querySelector('[data-act="advance"]');
      if (adv) adv.onclick = () => {
        const flow = App.FLOWS[t.flow] || [];
        const next = flow[t.stepIndex + 1];
        App.advanceTicket(t, 'Advanced by ' + (App.ROLES[App.session.role] || App.session.role));
        ui.toast(next ? 'Advanced to: ' + next.title : 'Completed', 'check_circle');
        App.refresh();
      };

      const pdf = root.querySelector('[data-act="pdf"]');
      if (pdf) pdf.onclick = () => {
        if (!t.runNumber) t.runNumber = App.nextId('WO');
        App.audit({ action: 'Write-off PDF report generated', target: t.id, detail: 'Run number ' + t.runNumber });
        ui.toast('PDF report run number ' + t.runNumber, 'picture_as_pdf');
        App.refresh();
        setTimeout(() => window.print(), 150);
      };

      const excel = root.querySelector('[data-act="excel"]');
      if (excel) excel.onclick = () => {
        const a = App.asset(t.assetId) || {};
        const v = t.verify || {};
        App.exportRows('writeoff-' + t.id + '.csv',
          ['Ticket', 'Track', 'Asset', 'Cause / loss type', 'COST', 'NBV', 'Storage', 'Current step', 'Status', 'Run number', 'Attachments'],
          [[t.id, trackOf(t), App.assetCode(a), causeLabel(t), v.cost != null ? v.cost : a.cost, v.nbv != null ? v.nbv : a.nbv, v.storage || a.room || '', stepLabel(t), t.status, t.runNumber || '', (t.attachments || []).join('; ')]]);
      };
    },
  });
})();
