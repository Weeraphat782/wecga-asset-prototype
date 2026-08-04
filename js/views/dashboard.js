/* Executive Dashboard (#/dashboard)
   Covers M9 (p.1) - executive dashboard part: headline KPIs + charts across the
   asset lifecycle. Charts are pure CSS / inline-SVG (no libraries) so the file://
   prototype works fully offline. Every KPI card drills into its source screen.
   Respects the company filter (assets.companyCode === App.session.company). */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, esc = App.esc, icon = App.icon;

  const MOVE_TYPES = ['Transfer', 'Borrow', 'Return', 'Repair', 'Change holder'];

  // ---- scoped data (current company) ----
  const scope = () => {
    const comp = App.session.company;
    const assets = App.store.assets.filter(a => a.companyCode === comp);
    const tickets = App.store.tickets.filter(t => t.company === comp);
    const plans = App.store.countPlans.filter(p => p.company === comp);
    const assetIds = new Set(assets.map(a => a.id));
    const results = App.store.countResults.filter(r => assetIds.has(r.assetId));
    return { comp, assets, tickets, plans, results, assetIds };
  };

  const activePlan = (plans) => plans.find(p => p.status === 'In progress') || plans[0] || null;

  // ---- pure-CSS chart helpers ----
  function hbars(items) {
    const max = Math.max(1, ...items.map(i => i.value));
    return `<div class="dash-bars">` + items.map(i => `
      <div style="display:grid;grid-template-columns:160px 1fr 56px;gap:10px;align-items:center;margin:9px 0">
        <div class="muted" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(i.label)}">${esc(i.label)}</div>
        <div class="bar-track" style="height:16px"><div class="bar-fill" style="width:${(i.value / max * 100).toFixed(1)}%${i.tone ? `;background:var(--${i.tone})` : ''}"></div></div>
        <div class="num" style="font-weight:600;font-variant-numeric:tabular-nums">${fmt.int(i.value)}</div>
      </div>`).join('') + `</div>`;
  }

  function donut(segments, centerTop, centerSub) {
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    const stops = segments.map(s => {
      const from = acc / total * 100; acc += s.value; const to = acc / total * 100;
      return `var(--${s.tone}) ${from.toFixed(2)}% ${to.toFixed(2)}%`;
    }).join(',');
    const legend = segments.map(s => `
      <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;margin:5px 0">
        <span style="width:11px;height:11px;border-radius:3px;background:var(--${s.tone});flex-shrink:0"></span>
        <span>${esc(s.label)}</span>
        <span class="muted" style="margin-left:auto;font-variant-numeric:tabular-nums">${fmt.int(s.value)} (${Math.round(s.value / total * 100)}%)</span>
      </div>`).join('');
    return `<div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
      <div style="width:132px;height:132px;border-radius:50%;flex-shrink:0;background:conic-gradient(${stops});display:grid;place-items:center">
        <div style="width:82px;height:82px;border-radius:50%;background:var(--md-surface);display:grid;place-items:center;text-align:center">
          <div><div style="font-size:20px;font-weight:700">${centerTop}</div><div class="muted" style="font-size:10.5px">${esc(centerSub || '')}</div></div>
        </div>
      </div>
      <div style="flex:1;min-width:160px">${legend}</div>
    </div>`;
  }

  function stacked(segments) {
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const bar = `<div style="display:flex;height:24px;border-radius:8px;overflow:hidden;border:1px solid var(--md-outline-variant)">` +
      segments.filter(s => s.value > 0).map(s => `<div title="${esc(s.label)}: ${s.value}" style="width:${(s.value / total * 100).toFixed(1)}%;background:var(--${s.tone})"></div>`).join('') + `</div>`;
    const legend = `<div class="pill-row" style="margin-top:10px">` + segments.map(s => `
      <span style="display:flex;align-items:center;gap:6px;font-size:12px">
        <span style="width:10px;height:10px;border-radius:3px;background:var(--${s.tone})"></span>${esc(s.label)} <b>${fmt.int(s.value)}</b></span>`).join('') + `</div>`;
    return bar + legend;
  }

  App.registerView('#/dashboard', {
    title: 'Dashboard',
    render() {
      const { comp, assets, tickets, plans, results } = scope();

      const totalCost = assets.reduce((s, a) => s + (a.cost || 0), 0);
      const totalNbv = assets.reduce((s, a) => s + (a.nbv || 0), 0);
      const tagged = assets.filter(a => a.tagStatus === 'Tagged').length;
      const tagPct = assets.length ? Math.round(tagged / assets.length * 100) : 0;

      const plan = activePlan(plans);
      const assigned = plan ? plan.assignedAssets.map(id => App.asset(id)).filter(Boolean) : [];
      const counted = assigned.filter(a => a.countStatus === 'Found' || a.countStatus === 'Not found').length;
      const countPct = assigned.length ? Math.round(counted / assigned.length * 100) : 0;

      const openMoves = tickets.filter(t => MOVE_TYPES.includes(t.type) && t.status !== 'Completed').length;
      const openWriteoffs = tickets.filter(t => (t.type || '').startsWith('Write-off') && t.status !== 'Completed').length;
      const variance = results.filter(r => r.outcome !== 'found_ok').length;

      // KPI cards (each drills into its source screen)
      const clickable = (hash, kpi) => `<div data-nav="${hash}" style="cursor:pointer">${kpi}</div>`;
      const kpis = `<div class="grid cols-4">
        ${clickable('#/assets', ui.kpi({ label: 'Total assets', value: fmt.int(assets.length), foot: comp + ' company scope', icon: 'inventory_2' }))}
        ${clickable('#/assets', ui.kpi({ label: 'Total asset value (cost)', value: fmt.money(totalCost), foot: 'NBV ' + fmt.money(totalNbv), icon: 'payments' }))}
        ${clickable('#/assets', ui.kpi({ label: 'Tag coverage', value: tagPct + '%', foot: `${tagged}/${assets.length} tagged<div class="bar-track" style="margin-top:6px"><div class="bar-fill" style="width:${tagPct}%"></div></div>`, icon: 'qr_code_2', tone: tagPct >= 90 ? 'ok' : 'warn' }))}
        ${clickable('#/counts', ui.kpi({ label: 'Count progress', value: countPct + '%', foot: `${counted}/${assigned.length} in ${plan ? esc(plan.name) : 'active plan'}<div class="bar-track" style="margin-top:6px"><div class="bar-fill" style="width:${countPct}%"></div></div>`, icon: 'fact_check' }))}
      </div>
      <div class="grid cols-4" style="margin-top:16px">
        ${clickable('#/movement', ui.kpi({ label: 'Open movements', value: fmt.int(openMoves), foot: 'Transfer / borrow / repair', icon: 'swap_horiz', tone: openMoves ? 'info' : 'ok' }))}
        ${clickable('#/writeoff', ui.kpi({ label: 'Open write-offs', value: fmt.int(openWriteoffs), foot: 'Sale / donation / lost', icon: 'delete_sweep', tone: openWriteoffs ? 'warn' : 'ok' }))}
        ${clickable('#/reconcile', ui.kpi({ label: 'Variance items', value: fmt.int(variance), foot: 'Count outcomes needing action', icon: 'difference', tone: variance ? 'danger' : 'ok' }))}
        ${clickable('#/reports', ui.kpi({ label: 'Reports', value: '5', foot: 'Register / Count / Disposal / Movement / KPI', icon: 'summarize' }))}
      </div>`;

      // Chart 1 - assets by class
      const byClass = {};
      assets.forEach(a => { const k = a.assetClassDesc || 'Unclassified'; byClass[k] = (byClass[k] || 0) + 1; });
      const classItems = Object.entries(byClass).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
      const classCard = ui.card({ title: `${icon('category')} Assets by Asset Class`, sub: 'Grouped by SAP Asset Class description', body: hbars(classItems) });

      // Chart 2 - tag coverage donut
      const notTagged = assets.length - tagged;
      const tagCard = ui.card({
        title: `${icon('qr_code_2')} Tag coverage`, sub: 'Tagged vs not tagged',
        body: donut([{ label: 'Tagged', value: tagged, tone: 'ok' }, { label: 'Not tagged', value: notTagged, tone: 'warn' }], tagPct + '%', 'tagged'),
        actions: `<button class="btn text sm" data-nav="#/tagging">${icon('arrow_forward')} Tagging</button>`,
      });

      // Chart 3 - count progress donut (found / not found / not counted) - whole company
      const found = assets.filter(a => a.countStatus === 'Found').length;
      const notFound = assets.filter(a => a.countStatus === 'Not found').length;
      const notCounted = assets.filter(a => a.countStatus === 'Not counted').length;
      const countCard = ui.card({
        title: `${icon('fact_check')} Count progress`, sub: 'Found / not found / not counted (all assets)',
        body: donut([
          { label: 'Found', value: found, tone: 'ok' },
          { label: 'Not found', value: notFound, tone: 'danger' },
          { label: 'Not counted', value: notCounted, tone: 'neutral' },
        ], fmt.int(found + notFound), 'counted'),
        actions: `<button class="btn text sm" data-nav="#/counts">${icon('arrow_forward')} Counts</button>`,
      });

      // Chart 4 - write-off pipeline by track and by step/status
      const woTracks = [
        { label: 'Sale', type: 'Write-off Sale', tone: 'info' },
        { label: 'Donation', type: 'Write-off Donation', tone: 'ok' },
        { label: 'Lost', type: 'Write-off Lost', tone: 'danger' },
      ].map(t => ({ label: t.label, tone: t.tone, value: tickets.filter(x => x.type === t.type).length }));
      const woTickets = tickets.filter(t => (t.type || '').startsWith('Write-off'));
      // funnel by lifecycle stage (bucketed on relative progress through its flow)
      const stage = (t) => {
        const flow = App.FLOWS[t.flow] || [];
        const p = flow.length ? t.stepIndex / (flow.length - 1) : 0;
        if (t.status === 'Completed') return 3;
        if (p >= 0.66) return 2;      // removal / finalize
        if (p >= 0.33) return 1;      // committee review
        return 0;                      // opened / verify
      };
      const buckets = ['Opened / verify', 'Committee review', 'Removal / finalize', 'Completed'];
      const funnel = buckets.map((label, i) => ({ label, tone: ['info', 'warn', 'ok', 'neutral'][i], value: woTickets.filter(t => stage(t) === i).length }));
      const woCard = ui.card({
        title: `${icon('delete_sweep')} Write-off pipeline`, sub: 'By disposal track, then by lifecycle stage (funnel)',
        actions: `<button class="btn text sm" data-nav="#/writeoff">${icon('arrow_forward')} Write-off</button>`,
        body: `<div class="muted" style="font-size:12px;margin-bottom:4px">By track</div>${hbars(woTracks)}
          <hr class="divider"><div class="muted" style="font-size:12px;margin-bottom:8px">By stage (${woTickets.length} tickets)</div>${stacked(funnel)}`,
      });

      // Recent activity timeline (company-scoped where the target is identifiable)
      const inScope = (target) => {
        if (!target) return true;
        if (target.startsWith('A-')) { const a = App.asset(target); return !a || a.companyCode === comp; }
        if (target.startsWith('TK')) { const t = App.ticket(target); return !t || t.company === comp; }
        return true;
      };
      const events = App.store.audit.filter(e => inScope(e.target)).slice(0, 8).map(e => ({
        title: `${e.action}${e.target ? ' · ' + e.target : ''}`,
        meta: `${fmt.datetime(e.ts)} — ${e.actor}${e.detail ? ' · ' + e.detail : ''}`,
        icon: 'history',
      }));
      const activityCard = ui.card({
        title: `${icon('history')} Recent activity`, sub: 'Latest audit events across the lifecycle',
        actions: `<button class="btn text sm" data-nav="#/audit">${icon('arrow_forward')} Full log</button>`,
        body: events.length ? ui.timeline(events) : '<div class="muted">No recent activity</div>',
      });

      return ui.pageHead({
        title: 'Executive Dashboard',
        sub: `M9 (p.1) - executive dashboard. Company scope: <b>${esc(App.COMPANIES[comp] || comp)}</b>. Cards drill into the source screen.`,
        actions: `<button class="btn outline sm no-print" data-nav="#/reports">${icon('summarize')} Reports</button>`,
      })
        + kpis
        + `<h3 class="sec">Portfolio</h3>`
        + `<div class="grid cols-2" style="align-items:start">${classCard}${tagCard}</div>`
        + `<h3 class="sec">Lifecycle</h3>`
        + `<div class="grid cols-2" style="align-items:start">${countCard}${woCard}</div>`
        + activityCard;
    },
  });
})();
