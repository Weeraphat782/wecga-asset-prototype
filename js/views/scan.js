/* Scan & Record (#/scan)  - mobile "first record" flow (p.2-3, item 8)
   Coverage: M3, P1, P2, P3, P4, P5, P6.
   Rendered inside the phone frame. Accepts ?asset=A-006 to preselect.
   The same scan + 3-photo pattern is reused by counts, transfers
   (destination photo) and write-off - see the muted links at the bottom. */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, icon = App.icon;

  // simulateMismatch is a demo toggle so both the match and the mismatch
  // (8.3) case are documented for customer sign-off. ponytail: seed GPS all
  // matches SAP, so a toggle is the smallest way to show the warning path.
  let state = { simulateMismatch: false };

  function companyAssets() {
    return App.store.assets.filter(a => a.companyCode === App.session.company);
  }

  function taggingTicket(a) {
    return App.store.tickets.find(t => t.assetId === a.id && t.type === 'Tagging');
  }

  function photoTile(type, a, ts, matches) {
    const ic = type === 'QR code' ? 'qr_code_2' : type === 'Serial number' ? 'tag' : 'photo_camera';
    const meta = `LAT ${a.lat} LNG ${a.lng}<br>${App.esc(a.district || '')}, ${App.esc(a.province || '')}<br>${fmt.datetime(ts)}`;
    return `<div class="photo-tile">
      ${type === 'QR code' ? `<span class="material-symbols-outlined ph-icon">${ic}</span>` : App.assetImg(a, { w: 320, h: 240 })}
      <span class="ph-tag">${App.esc(type)}</span>
      <span class="ph-tag" style="left:auto;right:6px;background:var(--md-primary)">${icon('check')}</span>
      <div class="ph-overlay">${meta}</div>
    </div>`;
  }

  App.registerView('#/scan', {
    title: 'Scan & Record',
    render(ctx) {
      const list = companyAssets();
      const a = ctx.query.asset ? App.asset(ctx.query.asset) : null;

      // ---- no asset chosen yet: asset picker ----
      if (!a) {
        const opts = list.map(x => `<option value="${x.id}">${App.esc(App.assetCode(x))} - ${App.esc(x.desc1 || '')}</option>`).join('');
        const picker = `
          <div class="card">
            <div class="card-title">${icon('photo_camera')} First record</div>
            <div class="card-sub">Scan a QR tag or pick the asset you are standing in front of.</div>
            <div class="field req"><label for="scanPick">Asset to record</label>
              <select id="scanPick"><option value="">Select an asset...</option>${opts}</select></div>
            <button class="btn" id="scanGo" style="width:100%">${icon('qr_code_scanner')} Open scanner</button>
          </div>`;
        return ui.pageHead({ title: 'Scan & Record', sub: 'Mobile first-record flow - page 2-3, item 8 (coverage M3, P1-P6).' })
          + ui.callout('info', 'This is the WeCGA mobile app used on first receipt of an asset. Pick an asset to open the phone view.')
          + ui.phone(picker);
      }

      // ---- asset chosen: the mobile first-record flow ----
      const ts = new Date().toISOString();
      const gpsMatch = !state.simulateMismatch;
      const tkt = taggingTicket(a);
      const ownerOrg = a.owner && a.owner.type === 'org';

      const switcher = `<div class="field"><label for="scanPick">Asset</label>
        <select id="scanPick">${list.map(x => `<option value="${x.id}" ${x.id === a.id ? 'selected' : ''}>${App.esc(App.assetCode(x))} - ${App.esc(x.desc1 || '')}</option>`).join('')}</select></div>`;

      // 8.1 Scan QR
      const step81 = `<div class="card">
        <div class="card-title">${icon('qr_code_scanner')} 8.1 Scan QR</div>
        ${ui.qr(App.assetCode(a))}
        <div class="mono" style="text-align:center;margin-top:6px">Scanned: ${App.esc(App.assetCode(a))}</div>
        <div class="muted" style="text-align:center;font-size:12px">${App.esc(a.desc1 || '')} ${App.esc(a.desc2 || '')}</div>
      </div>`;

      // 8.2 three mandatory photos with burned-in metadata
      const step82 = `<div class="card">
        <div class="card-title">${icon('photo_library')} 8.2 Three mandatory photos</div>
        <div class="card-sub">Whole asset, QR code, Serial number - Lat/Long, district, province & timestamp burned into each shot.</div>
        <div class="grid cols-3">
          ${photoTile('Whole asset', a, ts, gpsMatch)}
          ${photoTile('QR code', a, ts, gpsMatch)}
          ${photoTile('Serial number', a, ts, gpsMatch)}
        </div>
      </div>`;

      // 8.3 location must match SAP
      const step83 = `<div class="card">
        <div class="card-title">${icon('location_on')} 8.3 Location matches SAP</div>
        <label class="chip outline" style="cursor:pointer;margin-bottom:8px"><input type="checkbox" id="simMismatch" ${state.simulateMismatch ? 'checked' : ''} style="margin-right:6px">Simulate GPS mismatch</label>
        <dl class="kv" style="grid-template-columns:auto 1fr">
          <dt>Photo GPS</dt><dd class="mono">${a.lat}, ${a.lng}</dd>
          <dt>SAP Location</dt><dd class="mono">${App.esc(a.location || '-')} - ${App.esc(a.locationDesc || '-')}</dd>
        </dl>
        ${gpsMatch
          ? ui.callout('info', `${icon('check_circle')} GPS matches SAP Location - <b>${App.esc(a.locationDesc || '')}</b>`, 'check_circle')
          : ui.callout('warn', 'GPS does not match SAP Location - flag for GA verification before submit.')}
      </div>`;

      // 8.4 AI checks (mocked - open question)
      const serialPct = 98, authenticPct = 96;
      const step84 = `<div class="card">
        <div class="card-title">${icon('smart_toy')} 8.4 AI verification</div>
        <dl class="kv" style="grid-template-columns:auto 1fr">
          <dt>Serial OCR (photo)</dt><dd class="mono">${App.esc(a.serial || '-')}</dd>
          <dt>Serial on record</dt><dd class="mono">${App.esc(a.serial || '-')}</dd>
          <dt>OCR match</dt><dd>${ui.chip(serialPct + '%', 'ok')}</dd>
          <dt>Fake-photo score</dt><dd>${ui.chip('Authentic ' + authenticPct + '%', 'ok')}</dd>
        </dl>
        ${ui.callout('question', 'AI serial-match and fake-photo detection are <b>mocked</b> in this prototype, pending a vendor / model decision (open question, p.3 8.4).')}
      </div>`;

      // 8.5 embedded metadata
      const step85 = `<div class="card">
        <div class="card-title">${icon('data_object')} 8.5 Embedded photo metadata</div>
        <dl class="kv" style="grid-template-columns:auto 1fr">
          <dt>Latitude</dt><dd class="mono">${a.lat}</dd>
          <dt>Longitude</dt><dd class="mono">${a.lng}</dd>
          <dt>Address</dt><dd>${App.esc(a.address || '-')}</dd>
          <dt>District</dt><dd>${App.esc(a.district || '-')}</dd>
          <dt>Province</dt><dd>${App.esc(a.province || '-')}</dd>
          <dt>Timestamp</dt><dd>${fmt.datetime(ts)}</dd>
        </dl>
      </div>`;

      // P6 - Asset-Team 8-point verification checklist
      const p6 = `<div class="card">
        <div class="card-title">${icon('rule')} 8-point verification (P6)</div>
        <div class="card-sub">Asset-Team first-record checklist (p.3).</div>
        ${ui.checklist([
          { label: 'Asset photo captured', state: 'pass' },
          { label: 'QR code photo captured', state: 'pass' },
          { label: 'Serial number photo captured', state: a.serial ? 'pass' : 'pending', note: a.serial ? '' : 'no serial on record' },
          { label: 'Photo matches Description', state: 'pass', note: App.esc([a.desc1, a.desc2].filter(Boolean).join(' ')) },
          { label: 'Location correct per SAP (Lat/Long matches SAP Location)', state: gpsMatch ? 'pass' : 'fail' },
          { label: 'Serial correct', state: 'pass' },
          { label: 'Owner Name correct', state: 'pass', note: App.esc(a.owner ? a.owner.name : '-') },
          { label: 'Organization correct', state: ownerOrg ? 'pass' : 'pass', note: App.esc(a.orgName || (a.owner ? a.owner.name : '-')) },
        ])}
      </div>`;

      const submit = `<button class="btn" id="submitRec" style="width:100%">${icon('cloud_upload')} Submit first record</button>`;
      const reuse = `<div class="muted" style="font-size:12px;margin-top:10px">
        Same scan + 3-photo flow is reused by
        <a class="link" data-nav="#/counts">counts</a>,
        <a class="link" data-nav="#/movement">transfers (destination photo)</a> and
        <a class="link" data-nav="#/writeoff">write-off</a>.</div>`;

      const inner = switcher + step81 + step82 + step83 + step84 + step85 + p6 + submit;

      return ui.pageHead({
        title: 'Scan & Record',
        breadcrumb: [{ label: 'Scan & Record', hash: '#/scan' }, { label: App.assetCode(a) }],
        sub: `First record - ${App.assetTitle(a)}. Page 2-3 item 8 (M3, P1-P6).`,
      })
      + (tkt ? ui.callout('info', `Linked tagging ticket <b>${tkt.id}</b> - submitting advances it and marks the asset <b>Tagged</b>.`) : '')
      + ui.phone(inner)
      + reuse;
    },
    mount(root, ctx) {
      const pick = root.querySelector('#scanPick');
      if (pick) pick.onchange = e => { if (e.target.value) App.navigate('#/scan?asset=' + e.target.value); };
      const go = root.querySelector('#scanGo');
      if (go) go.onclick = () => { const v = pick && pick.value; if (v) App.navigate('#/scan?asset=' + v); else ui.toast('Pick an asset first', 'warning'); };

      const sim = root.querySelector('#simMismatch');
      if (sim) sim.onchange = e => { state.simulateMismatch = e.target.checked; App.refresh(); };

      const sub = root.querySelector('#submitRec');
      if (sub) sub.onclick = () => {
        const a = App.asset(ctx.query.asset);
        if (!a) return;
        if (state.simulateMismatch) return App.confirm('GPS mismatch', 'Photo GPS does not match SAP Location. Submit anyway and flag for GA verification?', () => doSubmit(a));
        doSubmit(a);
      };
    },
  });

  function doSubmit(a) {
    const ts = new Date().toISOString();
    a.photos = ['Whole asset', 'QR code', 'Serial number'].map(type => ({
      type, lat: a.lat, lng: a.lng, district: a.district, province: a.province, ts,
    }));
    a.tagStatus = 'Tagged';
    const tkt = taggingTicket(a);
    if (tkt && tkt.status !== 'Completed') App.advanceTicket(tkt, 'First record submitted (scan + 3 photos)');
    App.audit({ action: 'First record submitted', target: a.id, detail: '3 photos + GPS embedded' + (tkt ? ' (' + tkt.id + ')' : '') });
    ui.toast('First record saved for ' + App.assetCode(a), 'cloud_done');
    App.navigate('#/assets/' + a.id);
  }
})();
