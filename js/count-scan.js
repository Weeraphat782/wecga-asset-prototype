/* Inventory count scan logic — port of asset-tracking-mockup QR decision tree. */
(function () {
  const App = window.App, esc = App.esc, ui = App.ui;

  const OUTCOME_LABELS = {
    found_ok: 'CO1 Found OK',
    found_wrong: 'CO2 Wrong info',
    not_in_sap: 'CO3 Not in SAP',
    found_damaged: 'CO4 Damaged',
    not_found: 'CO5 Not found',
    moved: 'CO6 Moved',
  };

  const SCAN_KIND_LABELS = {
    correct_location: 'Correct location',
    incorrect_location: 'Incorrect location',
    mismatch_tagging: 'QR mismatch',
    detached_tag: 'Detached tag',
  };

  App.unitsMatchForCount = (foundUnit, assetUnit) =>
    String(foundUnit || '').trim() === String(assetUnit || '').trim();

  App.forcedCountOutcome = (foundUnit, assetUnit, scanAns) => {
    if (scanAns === 'detached') return { outcome: 'found_wrong', scanKind: 'detached_tag' };
    if (scanAns === 'no') return { outcome: 'found_wrong', scanKind: 'mismatch_tagging' };
    if (scanAns === 'yes') {
      return App.unitsMatchForCount(foundUnit, assetUnit)
        ? { outcome: 'found_ok', scanKind: 'correct_location' }
        : { outcome: 'found_wrong', scanKind: 'incorrect_location' };
    }
    return null;
  };

  App.countResultsForPlan = (planId) =>
    (App.store.countResults || []).filter(r => r.planId === planId);

  App.countResultForAsset = (planId, assetId) =>
    App.countResultsForPlan(planId).find(r => r.assetId === assetId) || null;

  App.assetCountedInPlan = (planId, assetId) => !!App.countResultForAsset(planId, assetId);

  App.countOutcomeStats = (planId, assets) => {
    const ids = new Set((assets || []).map(a => a.id));
    const stats = { found_ok: 0, found_wrong: 0, not_in_sap: 0, found_damaged: 0, not_found: 0, moved: 0 };
    App.countResultsForPlan(planId).forEach(r => {
      if (ids.has(r.assetId) && stats[r.outcome] != null) stats[r.outcome]++;
    });
    return stats;
  };

  App.findAssetByScanCode = (code, pool) => {
    const q = String(code || '').trim().toLowerCase();
    if (!q) return null;
    return (pool || []).find(a =>
      a.id.toLowerCase() === q
      || String(App.assetCode(a)).toLowerCase() === q
      || String(a.serial || '').toLowerCase().replace(/^\*/, '') === q.replace(/^\*/, '')
    ) || null;
  };

  App.findCompanyAssetByScanCode = (code, company) => {
    const comp = company || App.session.company;
    const pool = (App.store.assets || []).filter(a => a.companyCode === comp);
    return App.findAssetByScanCode(code, pool);
  };

  App.assetsWrongLocationForCount = (pkg, taskAssets, company) => {
    const pkgUnits = new Set(App.pkgUnits(pkg, taskAssets));
    const taskIds = new Set((taskAssets || []).map(a => a.id));
    return (App.store.assets || []).filter(a =>
      a.companyCode === (company || App.session.company)
      && a.unit
      && !pkgUnits.has(a.unit)
      && !taskIds.has(a.id)
    );
  };

  App.pkgUnits = (pkg, assets) => {
    const units = new Set();
    (pkg && pkg.assetIds || []).forEach(id => {
      const a = App.asset(id);
      if (a && a.unit) units.add(a.unit);
    });
    (assets || []).forEach(a => { if (a && a.unit) units.add(a.unit); });
    return [...units].sort();
  };

  App.countScannedIcon = (planId, assetId) => {
    const cr = App.countResultForAsset(planId, assetId);
    if (!cr) {
      return '<span class="material-symbols-outlined count-scanned-icon count-scanned-icon--no" aria-label="Not scanned">do_not_disturb_on</span>';
    }
    const ok = cr.outcome === 'found_ok';
    return `<span class="material-symbols-outlined count-scanned-icon count-scanned-icon--${ok ? 'yes' : 'warn'}" aria-label="Counted">${ok ? 'check_circle' : 'error'}</span>`;
  };

  App.countScanProgressHtml = (plan, assets) => {
    const total = (assets || []).length;
    const stats = App.countOutcomeStats(plan.id, assets);
    const correctLoc = stats.found_ok;
    const pct = total ? Math.min(100, Math.round((correctLoc / total) * 100)) : 0;
    const countLabel = `${correctLoc}/${total} (${pct}%)`;
    const fillWidth = correctLoc > 0 ? `max(${pct}%, 5.5rem)` : '0';
    const correctBar = correctLoc > 0
      ? `<div class="job-progress-bar-fill bar-correct" style="width:${fillWidth}"><span class="job-progress-bar-inbar-count">${esc(countLabel)}</span></div>`
      : `<span class="job-progress-bar-inbar-count job-progress-bar-inbar-count--empty">${esc(countLabel)}</span>`;
    const otherKeys = ['found_wrong', 'not_in_sap', 'found_damaged', 'not_found', 'moved'];
    const otherTotal = otherKeys.reduce((s, k) => s + stats[k], 0);
    const otherRow = otherKeys.map(k =>
      `<div class="job-progress-mini-stat"><div class="n">${stats[k]}</div><div class="l">${esc(OUTCOME_LABELS[k] || k)}</div></div>`
    ).join('');
    return `
      <div class="job-progress-panel">
        <div class="job-progress-hero">
          <div class="n">${total}</div>
          <div class="l">Total assets in package</div>
        </div>
        <div class="job-progress-bars">
          <div class="job-progress-bar-row">
            <span class="job-progress-bar-label">Found OK (CO1)</span>
            <div class="job-progress-bar-track" title="CO1: ${correctLoc} of ${total}">
              ${correctBar}
            </div>
          </div>
        </div>
        <details class="count-progress-other"${otherTotal ? ' open' : ''}>
          <summary>Other outcomes <span class="job-progress-other-count">${otherTotal}</span></summary>
          <div class="job-progress-mini-grid">${otherRow}</div>
        </details>
      </div>`;
  };

  App.countScanResultBody = (asset, units) => {
    const unitOpts = (units || []).map(u =>
      `<option value="${esc(u)}">${esc(u)}</option>`).join('');
    const defUnit = units.length === 1 ? units[0] : (units.includes(asset.unit) ? asset.unit : '');
    return `
      ${ui.callout('ok', `QR found — <b>${esc(App.assetTitle(asset))}</b>`)}
      <dl class="kv" style="grid-template-columns:auto 1fr;margin-bottom:12px">
        <dt>Registered unit</dt><dd>${esc(asset.unit || '—')}</dd>
        <dt>Location</dt><dd>${esc(App.locLabel(asset))}</dd>
        <dt>Owner</dt><dd>${esc(App.ownerLabel(asset))}</dd>
      </dl>
      <div class="field req">
        <label for="countScanFoundUnit">Found this QR code in Location (Unit)</label>
        <select class="input" name="foundUnit" id="countScanFoundUnit">
          <option value="">Select…</option>${unitOpts}
        </select>
        <div id="countScanUnitBadge" class="count-scan-unit-badge"></div>
      </div>
      <div class="field req">
        <label>Is this QR code attached to the correct asset?</label>
        <div class="count-scan-yesno" role="radiogroup">
          <label><input type="radio" name="scanQrOnAsset" value="yes" /> Yes</label>
          <label><input type="radio" name="scanQrOnAsset" value="no" /> No</label>
          <label><input type="radio" name="scanQrOnAsset" value="detached" /> Found Detached Tag</label>
        </div>
      </div>
      <input type="hidden" name="countScanDefaultUnit" value="${esc(defUnit)}" />`;
  };

  App.syncCountScanUnitBadge = (root, asset) => {
    const sel = root.querySelector('[name="foundUnit"]');
    const badge = root.querySelector('#countScanUnitBadge');
    if (!sel || !badge) return;
    const found = sel.value.trim();
    if (!found) { badge.innerHTML = ''; return; }
    const match = App.unitsMatchForCount(found, asset.unit);
    badge.innerHTML = match
      ? ui.chip('Unit match', 'ok')
      : ui.chip('Unit mismatch', 'warn');
  };

  App.buildCountScanMeta = (foundUnit, scanAns) => ({
    fromQrScan: true,
    scannedLocation: foundUnit,
    qrOnAssetAnswer: scanAns,
    scanVerified: true,
    scannedAt: new Date().toISOString(),
    ...App.forcedCountOutcome(foundUnit, '', scanAns),
  });

  App.countScanKindLabel = (kind) => SCAN_KIND_LABELS[kind] || kind || '—';
})();
