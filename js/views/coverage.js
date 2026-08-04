/* Requirements Coverage Matrix (#/coverage)
   The customer sign-off artifact. Lists every requirement from the PDF,
   its page and route, and whether a live screen exists. Red on any gap. */
(function () {
  const App = window.App, ui = App.ui;

  App.registerView('#/coverage', {
    title: 'Requirements Coverage',
    render() {
      const check = App.coverageSelfCheck();
      const routes = new Set(App._views.map(v => v.route.split('/').slice(0, 2).join('/')));
      const pct = Math.round(check.covered / check.total * 100);

      const kpis = `<div class="grid cols-4">
        ${ui.kpi({ label: 'Requirements tracked', value: check.total, icon: 'rule' })}
        ${ui.kpi({ label: 'Mapped to a live screen', value: check.covered, icon: 'check_circle', tone: 'ok' })}
        ${ui.kpi({ label: 'Gaps', value: check.gaps.length, icon: 'error', tone: check.gaps.length ? 'danger' : 'ok' })}
        ${ui.kpi({ label: 'Coverage', value: pct + '%', foot: `<div class="bar-track" style="margin-top:6px"><div class="bar-fill" style="width:${pct}%"></div></div>` })}
      </div>`;

      const sections = App.COVERAGE.map(g => {
        const rows = g.items.map(it => {
          const base = it.route.split('/').slice(0, 2).join('/');
          const ok = routes.has(base);
          return { it, ok };
        });
        return ui.card({
          title: g.group,
          body: ui.table({
            columns: [
              { key: 'id', label: 'ID', render: r => `<span class="mono">${r.it.id}</span>` },
              { key: 'page', label: 'Pg', render: r => 'p.' + r.it.page },
              { key: 'text', label: 'Requirement', cls: 'wrap', render: r => App.esc(r.it.text) },
              { key: 'route', label: 'Screen', render: r => `<a class="link" data-nav="${r.it.route}">${r.it.route}</a>` },
              { key: 'ok', label: 'Status', render: r => r.ok ? ui.chip('Covered', 'ok') : ui.chip('GAP', 'danger') },
            ],
            rows,
          }),
        });
      }).join('');

      const oq = ui.card({
        title: `${App.icon('help')} Open questions to confirm with the customer`,
        cls: 'flat',
        body: App.OPEN_QUESTIONS.map(q => ui.callout('question', `<b>p.${q.page}</b> - ${App.esc(q.text)} <a class="link" data-nav="${q.route}">${q.route}</a>`)).join(''),
      });

      return ui.pageHead({
        title: 'Requirements Coverage Matrix',
        sub: 'Sign-off artifact: every requirement from the 11-page document, mapped to the screen that demonstrates it.',
        actions: `<button class="btn outline sm" id="expCov">${App.icon('download')} Export CSV</button><button class="btn outline sm" id="printCov">${App.icon('print')} Print</button>`,
      }) + kpis + oq + sections;
    },
    mount(root) {
      const p = root.querySelector('#printCov'); if (p) p.onclick = () => window.print();
      const e = root.querySelector('#expCov'); if (e) e.onclick = () => {
        const routes = new Set(App._views.map(v => v.route.split('/').slice(0, 2).join('/')));
        const rows = [];
        App.COVERAGE.forEach(g => g.items.forEach(it => rows.push([it.id, 'p.' + it.page, g.group, it.text, it.route, routes.has(it.route.split('/').slice(0, 2).join('/')) ? 'Covered' : 'GAP'])));
        App.exportRows('requirements-coverage.csv', ['ID', 'Page', 'Group', 'Requirement', 'Screen', 'Status'], rows);
      };
    },
  });
})();
