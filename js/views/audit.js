/* Audit Log (#/audit)
   Covers: M10 (system-wide activity log), D3 (page 11 - log activity as a TIMELINE),
           L5 (loss / write-off logs are retained here for later retrieval & search).
   Screen reference: page 11. */
(function () {
  const App = window.App, ui = App.ui, fmt = App.fmt, icon = App.icon;

  let state = { q: '', actor: '', action: '', from: '', to: '', view: 'timeline' };

  function filtered() {
    return App.store.audit.filter(e => {
      if (state.actor && e.actor !== state.actor) return false;
      if (state.action && e.action !== state.action) return false;
      if (state.from && new Date(e.ts) < new Date(state.from)) return false;
      if (state.to && new Date(e.ts) > new Date(state.to + 'T23:59:59')) return false;
      if (state.q) {
        const hay = [e.actor, e.action, e.target, e.detail].join(' ').toLowerCase();
        if (!hay.includes(state.q.toLowerCase())) return false;
      }
      return true;
    }).slice().sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }

  const isAsset = (t) => typeof t === 'string' && t.startsWith('A-');
  const isTicket = (t) => typeof t === 'string' && t.startsWith('TK-');
  const targetHtml = (t) => {
    if (isAsset(t)) return `<a data-nav="#/assets/${App.esc(t)}" class="mono">${App.esc(t)}</a>`;
    return `<span class="mono">${App.esc(t || '-')}</span>`;
  };
  const actionIcon = (a) => /count/i.test(a) ? 'fact_check'
    : /transfer|move/i.test(a) ? 'swap_horiz'
    : /qr|tag/i.test(a) ? 'qr_code_2'
    : /sap|sync/i.test(a) ? 'sync'
    : /approv/i.test(a) ? 'verified'
    : /user/i.test(a) ? 'person'
    : /ticket|spawn/i.test(a) ? 'confirmation_number'
    : /lost|write/i.test(a) ? 'delete_sweep'
    : 'history';

  App.registerView('#/audit', {
    title: 'Audit Log',
    render() {
      const rows = filtered();
      const actors = [...new Set(App.store.audit.map(e => e.actor))].sort();
      const actions = [...new Set(App.store.audit.map(e => e.action))].sort();

      const toolbar = `
        <div class="table-toolbar">
          <div class="search"><span class="material-symbols-outlined">search</span>
            <input id="q" placeholder="Search actor, action, target, detail..." value="${App.esc(state.q)}"></div>
          <select id="fActor"><option value="">All actors</option>${actors.map(a => `<option ${a === state.actor ? 'selected' : ''}>${App.esc(a)}</option>`).join('')}</select>
          <select id="fAction"><option value="">All actions</option>${actions.map(a => `<option ${a === state.action ? 'selected' : ''}>${App.esc(a)}</option>`).join('')}</select>
          <label class="muted" style="display:flex;align-items:center;gap:4px">From <input type="date" id="fFrom" value="${App.esc(state.from)}"></label>
          <label class="muted" style="display:flex;align-items:center;gap:4px">To <input type="date" id="fTo" value="${App.esc(state.to)}"></label>
          <span class="table-count">${rows.length} entries</span>
          <span style="margin-left:auto;display:flex;gap:6px">
            <div class="segmented" data-seg="view">
              <button data-val="timeline" class="${state.view === 'timeline' ? 'active' : ''}">${icon('timeline')} Timeline</button>
              <button data-val="table" class="${state.view === 'table' ? 'active' : ''}">${icon('table_rows')} Table</button>
            </div>
            <button class="btn outline sm" id="csvBtn">${icon('download')} Export CSV</button>
          </span>
        </div>`;

      let body;
      if (state.view === 'table') {
        body = ui.table({
          columns: [
            { key: 'ts', label: 'Timestamp', render: r => fmt.datetime(r.ts) },
            { key: 'actor', label: 'Actor' },
            { key: 'action', label: 'Action', render: r => `${icon(actionIcon(r.action))} ${App.esc(r.action)}` },
            { key: 'target', label: 'Target', render: r => targetHtml(r.target) },
            { key: 'detail', label: 'Detail' },
          ],
          rows,
          rowLink: r => isAsset(r.target) ? '#/assets/' + r.target : null,
          empty: 'No audit entries match the filters',
        });
      } else {
        const events = rows.map(e => ({
          title: e.action,
          meta: `${fmt.datetime(e.ts)} \u00b7 ${e.actor}${e.target ? ' \u00b7 ' + e.target : ''}${e.detail ? ' \u2014 ' + e.detail : ''}`,
          icon: actionIcon(e.action),
        }));
        body = ui.card({
          title: `${icon('timeline')} Activity timeline`,
          sub: 'Newest first. Click an asset entry to open the asset. <span class="muted">D3 - page 11</span>',
          body: rows.length ? `<div id="auditTl">${ui.timeline(events)}</div>` : `<div class="empty">${icon('inbox')}<div>No audit entries match the filters</div></div>`,
        });
      }

      return ui.pageHead({
        title: 'Audit Log',
        sub: 'Every action across WeCGA is logged here for retrieval and search. <span class="muted">M10, D3 - page 11</span>',
      })
      + ui.callout('info', '<b>Retention (L5).</b> Loss and write-off logs are kept here permanently so they can be searched and retrieved long after the asset leaves the register.')
      + toolbar
      + body;
    },
    mount(root) {
      const q = root.querySelector('#q');
      if (q) q.oninput = e => { state.q = e.target.value; clearTimeout(q._t); q._t = setTimeout(App.refresh, 250); };
      const bind = (id, key) => { const el = root.querySelector('#' + id); if (el) el.onchange = e => { state[key] = e.target.value; App.refresh(); }; };
      bind('fActor', 'actor'); bind('fAction', 'action'); bind('fFrom', 'from'); bind('fTo', 'to');

      root.querySelectorAll('[data-seg="view"] [data-val]').forEach(b => b.onclick = () => { state.view = b.getAttribute('data-val'); App.refresh(); });

      // Timeline entries are rendered in the same order as filtered(); wire asset clicks.
      const rows = filtered();
      root.querySelectorAll('#auditTl .timeline > li').forEach((li, i) => {
        const t = rows[i] && rows[i].target;
        if (isAsset(t)) { li.style.cursor = 'pointer'; li.onclick = () => App.navigate('#/assets/' + t); }
      });

      const csv = root.querySelector('#csvBtn');
      if (csv) csv.onclick = () => App.exportRows('audit-log.csv',
        ['Timestamp', 'Actor', 'Action', 'Target', 'Detail'],
        filtered().map(e => [fmt.datetime(e.ts), e.actor, e.action, e.target, e.detail]));
    },
  });
})();
