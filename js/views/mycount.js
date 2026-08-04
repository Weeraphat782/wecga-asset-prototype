/* My Count Tasks (#/my-count)
   The employee/committee/IT/engineer field-counting screen (p.10 items 3.2-3.4).
   Covers:
     CP2  - the user sees exactly what THEY must count.
     CP3  - a user can count items in their AREA even when not the owner.
     C3   - Committee: mass scan, no photo (note rights time-bound).
     C4   - IT: mass scan, no photo.
     C5   - Engineering: mass scan, no photo, network equipment only.
     C6   - all other employees: MUST scan AND photo.
     C7   - count on behalf of someone else (counter recorded, owner unchanged).
     CO1..CO6 - the six count outcomes (p.10 item 3.4).
   Reuses App.assetCode / App.assetTitle / App.ownerLabel / App.addTicket. */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, esc = App.esc;

  const OUTCOME = {
    found_ok:      { label: 'Found - OK',          kind: 'ok' },
    found_wrong:   { label: 'Found - wrong info',  kind: 'warn' },
    not_in_sap:    { label: 'Found - not in SAP',  kind: 'warn' },
    found_damaged: { label: 'Found - damaged',     kind: 'danger' },
    not_found:     { label: 'Not found - lost',    kind: 'danger' },
    moved:         { label: 'Moved elsewhere',     kind: 'info' },
  };

  // Role matrix (C3-C6). mass = mass scan; photo = photo required per asset.
  function roleMode() {
    switch (App.session.role) {
      case 'committee': return { key: 'committee', mass: true, photo: false, network: false, note: 'Committee - <b>mass scan, no photo</b>. Note-taking rights are <b>time-bound</b> to the count window (C3).' };
      case 'it':        return { key: 'it',        mass: true, photo: false, network: false, note: 'IT - <b>mass scan, no photo</b> required (C4).' };
      case 'engineer':  return { key: 'engineer',  mass: true, photo: false, network: true,  note: 'Engineering - <b>mass scan, no photo</b>, technician / <b>network equipment only</b> (C5).' };
      default:          return { key: 'employee',  mass: false, photo: true, network: false, note: 'Employee - you <b>must SCAN and take a PHOTO</b> for every asset you count (C6).' };
    }
  }

  const isNetwork = (a) => /network/i.test(a.assetClassDesc || '') || a.assetClass === '7150';

  function activePlan() {
    const comp = App.session.company;
    return App.store.countPlans.find(p => p.company === comp && p.status === 'In progress')
        || App.store.countPlans.find(p => p.company === comp)
        || null;
  }

  function ownedByMe(a) {
    const me = App.currentUser();
    if (!me || !a.owner) return false;
    return a.owner.email === me.email || a.owner.name === me.name;
  }

  /* ------------------------------------------------------------------ */
  App.registerView('#/my-count', {
    title: 'My Count Tasks',
    render() {
      const mode = roleMode();
      const plan = activePlan();
      if (!plan) {
        return ui.pageHead({ title: 'My Count Tasks' })
          + ui.callout('warn', 'There is no active count plan for this company. Create one in <a class="link" data-nav="#/counts">Inventory Counts</a>.');
      }

      const comp = App.session.company;
      let planAssets = (plan.assignedAssets || []).map(App.asset).filter(a => a && a.companyCode === comp);
      if (mode.network) planAssets = planAssets.filter(isNetwork);   // C5

      const banner = ui.callout(mode.mass ? 'info' : 'warn',
        `<b>Counting mode for ${esc(App.ROLES[App.session.role] || App.session.role)}:</b> ${mode.note}`,
        mode.mass ? 'bolt' : 'photo_camera');

      // CP2 (mine) vs CP3 (others in my area)
      const me = App.currentUser();
      let cards;
      if (mode.mass) {
        // mass-scan roles sweep the whole assigned scope
        cards = taskCard(`${App.icon('bolt')} Mass count - all assigned assets`,
          'Mass-scan role: sweep every assigned asset in scope. No per-asset photo required.', planAssets, mode);
      } else {
        const mine = planAssets.filter(ownedByMe);
        const myAreas = new Set(mine.map(a => a.area).concat(me && me.area ? [me.area] : []));
        const areaAssets = planAssets.filter(a => !ownedByMe(a) && myAreas.has(a.area));
        cards = taskCard(`${App.icon('assignment_ind')} Assigned to me (CP2)`,
          'Exactly what you own and must count.', mine, mode)
          + taskCard(`${App.icon('groups')} Others in my area (CP3)`,
            'You may count assets in your area even when you are not the owner. The owner is not changed - you are recorded as the counter.', areaAssets, mode);
      }

      const done = planAssets.filter(a => a.countStatus !== 'Not counted').length;
      const kpis = `<div class="grid cols-3">
        ${ui.kpi({ label: 'My tasks', value: planAssets.length, icon: 'checklist' })}
        ${ui.kpi({ label: 'Counted', value: done, icon: 'fact_check', tone: 'ok' })}
        ${ui.kpi({ label: 'Remaining', value: planAssets.length - done, icon: 'pending', tone: (planAssets.length - done) ? 'warn' : undefined })}
      </div>`;

      return ui.pageHead({
        title: 'My Count Tasks',
        sub: `Active plan <b>${esc(plan.name)}</b> (${esc(plan.id)}) - ${fmt.date(plan.start)} &rarr; ${fmt.date(plan.end)}. <span class="muted">p.10 items 3.2-3.4</span>`,
        actions: `<button class="btn tonal sm" data-nav="#/counts/${plan.id}">${App.icon('fact_check')} Plan progress</button>`,
      })
      + banner + kpis + cards;
    },
    mount(root) {
      root.querySelectorAll('[data-act="rec"]').forEach(b => b.onclick = () => {
        const a = App.asset(b.getAttribute('data-id'));
        if (a) openRecord(a);
      });
    },
  });

  function taskCard(title, sub, assets, mode) {
    return ui.card({
      title, sub,
      body: ui.table({
        columns: [
          { key: 'code', label: 'Asset', render: a => `<span class="mono">${esc(App.assetCode(a))}</span><div class="muted" style="font-size:12px">${esc([a.desc1, a.desc2].filter(Boolean).join(' '))}</div>` },
          { key: 'area', label: 'Area' },
          { key: 'owner', label: 'Owner', cls: 'wrap', render: a => esc(App.ownerLabel(a)) },
          { key: 'countStatus', label: 'Status', render: a => ui.statusChip(a.countStatus) },
          { key: 'req', label: 'Requires', render: () => mode.photo ? ui.chip('Scan + Photo', 'warn') : ui.chip('Scan only', 'ok') },
          { key: '_act', label: '', render: a => `<button class="btn sm" data-act="rec" data-id="${a.id}">${App.icon('fact_check')} Record count</button>` },
        ],
        rows: assets,
        empty: 'Nothing to count here',
      }),
    });
  }

  /* -------------------- Record count dialog (CO1..CO6) -------------------- */
  function openRecord(a) {
    const mode = roleMode();
    const notOwner = !ownedByMe(a);

    const photoBlock = mode.photo
      ? ui.callout('warn', `Your role must <b>scan + photo</b> this asset. <a class="link" data-nav="#/scan?asset=${a.id}">Open Scan &amp; Record</a> to capture QR, serial and whole-asset photos (C6, p.3 8.2-8.5).`, 'photo_camera')
      : ui.callout('ok', 'Mass-scan role: scan only, no photo required (C3/C4/C5).', 'bolt');

    const body = `
      ${ui.callout('info', `Counting <b>${esc(App.assetTitle(a))}</b><br>SAP owner: <b>${esc(App.ownerLabel(a))}</b> &nbsp; Location: ${esc(a.locationDesc || '-')} &nbsp; Area: ${esc(a.area || '-')}`)}
      ${photoBlock}
      ${ui.field({ label: 'Count outcome (p.10 item 3.4)', name: 'outcome', type: 'select', required: true, options: [
        { value: 'found_ok',      label: 'CO1 - Found: location & owner correct' },
        { value: 'found_wrong',   label: 'CO2 - Found: location / owner WRONG' },
        { value: 'not_in_sap',    label: 'CO3 - Found: NOT in SAP' },
        { value: 'found_damaged', label: 'CO4 - Found: DAMAGED' },
        { value: 'not_found',     label: 'CO5 - NOT found (lost)' },
        { value: 'moved',         label: 'CO6 - Moved elsewhere' },
      ] })}

      <div data-sub="found_ok">
        ${ui.callout('ok', 'CO1 - Just confirm. Sets count status to <b>Found</b>. No follow-up ticket.')}
      </div>

      <div data-sub="found_wrong" style="display:none">
        ${ui.callout('warn', 'CO2 - Capture the correct location / holder. On save: <b>&rarr; GA Verify &rarr; Transfer</b> ticket is created (movement flow).')}
        <div class="form-grid">
          ${ui.field({ label: 'Correct location', name: 'correctLocation', attrs: 'placeholder="Room / site where it actually is"' })}
          ${ui.field({ label: 'Correct holder', name: 'correctHolder', attrs: 'placeholder="Actual person / organization"' })}
        </div>
      </div>

      <div data-sub="not_in_sap" style="display:none">
        ${ui.callout('warn', 'CO3 - Asset found but not in SAP. On save: <b>&rarr; Registration</b> ticket is created (registration flow, WeCGA code series).')}
      </div>

      <div data-sub="found_damaged" style="display:none">
        ${ui.callout('danger', 'CO4 - Damaged / beyond repair. On save: <b>&rarr; Write-off (damage / sale)</b> ticket is created (writeoffSale flow).')}
        ${ui.field({ label: 'Damage detail', name: 'damageNote', type: 'textarea', attrs: 'placeholder="What is damaged and why it is beyond repair"' })}
      </div>

      <div data-sub="not_found" style="display:none">
        ${ui.callout('danger', 'CO5 - Not found. Sets count status to <b>Not found</b>. On save: <b>&rarr; compensation + Write-off (lost)</b> ticket is created (writeoffLost flow).')}
      </div>

      <div data-sub="moved" style="display:none">
        ${ui.callout('info', 'CO6 - Moved elsewhere. A <b>note is required</b>. Choose the destination and its evidence. <b>No evidence &rarr; escalate to lost</b>. If IT names a different holder &rarr; a Change-holder ticket is created.')}
        <div class="form-grid">
          ${ui.field({ label: 'Destination', name: 'dest', type: 'select', options: ['Store', 'Engineering', 'Vendor', 'IT'] })}
          ${ui.field({ label: 'Evidence', name: 'evidence', type: 'select', options: [
            { value: 'email', label: 'Email' },
            { value: 'attachment', label: 'Attachment' },
            { value: 'none', label: 'No evidence (escalate to lost)' },
          ] })}
        </div>
        <div data-moved="IT" style="display:none">
          ${ui.field({ label: 'New holder reported by IT', name: 'newHolder', attrs: 'placeholder="If IT names a different holder -> Change holder ticket"' })}
        </div>
      </div>

      ${ui.field({ label: 'Note', name: 'note', type: 'textarea', attrs: 'placeholder="Observation / remark"' })}

      <hr style="border:none;border-top:1px solid var(--md-outline-variant);margin:12px 0">
      <label class="chip outline" style="cursor:pointer;display:inline-flex;align-items:center">
        <input type="checkbox" name="onBehalf" style="margin-right:6px" ${notOwner ? 'checked' : ''}> Recording on behalf of the owner (C7)
      </label>
      <div data-behalf style="${notOwner ? '' : 'display:none'};margin-top:8px">
        ${ui.callout('info', 'C7 - You (<b>' + esc(App.currentUser() ? App.currentUser().name : App.session.role) + '</b>) are recorded as the counter; the asset owner is <b>not</b> changed. If the holder name is wrong, request a change-holder ticket.')}
        <label class="chip outline" style="cursor:pointer;display:inline-flex;align-items:center">
          <input type="checkbox" name="reqChangeHolder" style="margin-right:6px"> Holder name is wrong - request change-holder ticket
        </label>
        ${ui.field({ label: 'Correct holder name', name: 'actualHolder', attrs: 'placeholder="Who actually holds this asset"' })}
      </div>`;

    const dlg = ui.dialog({
      title: 'Record count - ' + App.assetCode(a),
      size: 'lg',
      body,
      actions: [
        { label: 'Cancel', kind: 'text' },
        { label: 'Save count', kind: 'btn', close: false, act: (d) => saveRecord(a, d) },
      ],
    });

    const sel = dlg.root.querySelector('[name="outcome"]');
    const subs = dlg.root.querySelectorAll('[data-sub]');
    const updSub = () => subs.forEach(x => x.style.display = x.getAttribute('data-sub') === sel.value ? '' : 'none');
    sel.onchange = updSub; updSub();

    const destSel = dlg.root.querySelector('[name="dest"]');
    const movedIT = dlg.root.querySelector('[data-moved="IT"]');
    if (destSel && movedIT) {
      const updDest = () => { movedIT.style.display = destSel.value === 'IT' ? '' : 'none'; };
      destSel.onchange = updDest; updDest();
    }

    const behalf = dlg.root.querySelector('[name="onBehalf"]');
    const behalfWrap = dlg.root.querySelector('[data-behalf]');
    if (behalf && behalfWrap) behalf.onchange = () => { behalfWrap.style.display = behalf.checked ? '' : 'none'; };
  }

  function saveRecord(a, dlg) {
    const q = s => { const el = dlg.root.querySelector(s); return el ? el.value.trim() : ''; };
    const chk = s => { const el = dlg.root.querySelector(s); return !!(el && el.checked); };
    const outcome = q('[name="outcome"]');
    const d = {
      note: q('[name="note"]'),
      correctLocation: q('[name="correctLocation"]'),
      correctHolder: q('[name="correctHolder"]'),
      damageNote: q('[name="damageNote"]'),
      dest: q('[name="dest"]'),
      evidence: q('[name="evidence"]'),
      newHolder: q('[name="newHolder"]'),
      onBehalf: chk('[name="onBehalf"]'),
      reqChangeHolder: chk('[name="reqChangeHolder"]'),
      actualHolder: q('[name="actualHolder"]'),
    };
    if (outcome === 'moved' && !d.note) { ui.toast('CO6 requires a note', 'error'); return; }
    recordCount(a, outcome, d);
    dlg.close();
  }

  function recordCount(a, outcome, d) {
    const code = App.assetCode(a);
    let countStatus = 'Found';
    let spawned = null;

    if (outcome === 'found_wrong') {                              // CO2
      spawned = App.addTicket({ type: 'Transfer', flow: 'movement', assetId: a.id, origin: 'count',
        title: 'Count follow-up: correct owner/location of ' + code,
        fromOwner: (a.owner && a.owner.name) || '', toOwner: d.correctHolder || '', correctLocation: d.correctLocation || '' });
    } else if (outcome === 'not_in_sap') {                        // CO3
      spawned = App.addTicket({ type: 'Registration', flow: 'registration', assetId: a.id, origin: 'count',
        title: 'Count follow-up: register asset not in SAP - ' + code });
    } else if (outcome === 'found_damaged') {                     // CO4
      spawned = App.addTicket({ type: 'Write-off Sale', flow: 'writeoffSale', assetId: a.id, origin: 'count',
        title: 'Count follow-up: damaged write-off - ' + code, damageNote: d.damageNote || d.note || '' });
    } else if (outcome === 'not_found') {                         // CO5
      countStatus = 'Not found';
      spawned = App.addTicket({ type: 'Write-off Lost', flow: 'writeoffLost', assetId: a.id, origin: 'count', lossType: 'unknown',
        title: 'Count follow-up: lost asset (compensation + write-off) - ' + code });
    } else if (outcome === 'moved') {                             // CO6
      if (d.evidence === 'none') {
        countStatus = 'Not found';
        spawned = App.addTicket({ type: 'Write-off Lost', flow: 'writeoffLost', assetId: a.id, origin: 'count', lossType: 'unknown',
          unknownReason: 'no evidence for claimed move to ' + (d.dest || '?'),
          title: 'Count follow-up: moved without evidence -> lost - ' + code });
      } else if (d.dest === 'IT' && d.newHolder) {
        spawned = App.addTicket({ type: 'Change holder', flow: 'movement', assetId: a.id, origin: 'count',
          toOwner: d.newHolder, title: 'Count follow-up: IT reports new holder - ' + code });
      }
      // else: moved with evidence, recorded only.
    }

    // C7 - explicit change-holder request when counting on behalf.
    if (d.onBehalf && d.reqChangeHolder && d.actualHolder) {
      App.addTicket({ type: 'Change holder', flow: 'movement', assetId: a.id, origin: 'count',
        fromOwner: (a.owner && a.owner.name) || '', toOwner: d.actualHolder,
        title: 'Count follow-up: change holder (on-behalf) - ' + code });
    }

    App.store.countResults.push({
      id: App.nextId('CR'),
      planId: (activePlan() || {}).id,
      assetId: a.id,
      outcome,
      by: App.session.userId,
      date: new Date().toISOString(),
      note: d.note || '',
      onBehalf: !!d.onBehalf,
      evidence: outcome === 'moved' ? (d.evidence !== 'none') : undefined,
      spawnedTicket: spawned ? spawned.id : undefined,
    });

    a.countStatus = countStatus;
    a.lastCountDate = new Date().toISOString();
    App.audit({ action: 'Count recorded', target: a.id,
      detail: 'Outcome: ' + (OUTCOME[outcome] ? OUTCOME[outcome].label : outcome) + (spawned ? ' -> ' + spawned.id : '') });
    App.refresh();
    ui.toast(spawned ? ('Recorded - ' + spawned.type + ' ' + spawned.id + ' created') : 'Count recorded', 'fact_check');
  }
})();
