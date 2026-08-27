/* WeCGA Help Center (#/help, #/help/:slug) — Meta-style landing for AIS walkthrough. */
(function () {
  const App = window.App, ui = App.ui, icon = App.icon, esc = App.esc;

  let searchQ = '';
  let dropdownOpen = false;

  function topicById(id) {
    return (App.HELP_TOPICS || []).find(t => t.id === id);
  }

  function renderSuggestions(q) {
    const r = App.helpSearch(q);
    if (!q.trim()) return '';
    if (!r.hasResults) {
      return `<div class="help-suggest empty">${icon('search_off')} No matches — try <b>tag</b>, <b>count</b>, <b>handover</b>, or an asset code</div>`;
    }
    let html = '<div class="help-suggest">';
    if (r.learn.length) {
      html += `<div class="help-suggest-label">Help articles</div>`;
      r.learn.forEach(x => {
        const a = x.item;
        html += `<button type="button" class="help-suggest-row" data-help-slug="${esc(a.slug)}">
          ${icon('article')}<span><b>${esc(a.title)}</b><span class="muted">${esc(a.body)}</span></span>
          <span class="badge help-badge-learn">Learn</span></button>`;
      });
    }
    if (r.do.length) {
      html += `<div class="help-suggest-label">Quick actions</div>`;
      r.do.forEach(x => {
        const t = x.item;
        html += `<button type="button" class="help-suggest-row" data-help-do="${esc(t.id)}">
          ${icon(t.icon || 'play_arrow')}<span><b>${esc(t.label)}</b><span class="muted">${esc(t.desc)}</span></span>
          <span class="badge help-badge-do">Do</span></button>`;
      });
    }
    if (r.find.length) {
      html += `<div class="help-suggest-label">Find</div>`;
      r.find.forEach(x => {
        if (x.type === 'find-asset') {
          const a = x.item;
          html += `<button type="button" class="help-suggest-row" data-help-asset="${esc(a.id)}">
            ${icon('inventory_2')}<span><b>${esc(App.assetCode(a))}</b><span class="muted">${esc([a.desc1, a.desc2].filter(Boolean).join(' '))}</span></span>
            <span class="badge help-badge-find">Asset</span></button>`;
        } else {
          const t = x.item;
          html += `<button type="button" class="help-suggest-row" data-help-sr="${esc(t.id)}">
            ${icon('confirmation_number')}<span><b>${esc(t.id)}</b><span class="muted">${esc(t.type)}</span></span>
            <span class="badge help-badge-find">SR</span></button>`;
        }
      });
    }
    html += '</div>';
    return html;
  }

  function renderHero(q, topicId) {
    const topic = topicId ? topicById(topicId) : null;
    return `<div class="help-hero">
      <h1 class="help-hero-title">WeCGA Help Center</h1>
      <p class="help-hero-sub">${topic ? esc(topic.title) : 'How can we help you?'}</p>
      ${topic && topic.intro ? `<p class="help-hero-intro muted">${esc(topic.intro)}</p>` : ''}
      <div class="help-search-wrap">
        <form class="help-search-pill" id="helpSearchForm">
          <span class="material-symbols-outlined help-search-ic">search</span>
          <input type="search" id="helpSearchInput" placeholder="Search help articles" value="${esc(q)}" autocomplete="off">
          <button type="submit" class="btn help-search-btn" aria-label="Search">${icon('search')}</button>
        </form>
        <div id="helpSuggest">${dropdownOpen && q ? renderSuggestions(q) : ''}</div>
      </div>
    </div>`;
  }

  function primaryTaskForArticle(a) {
    return a.taskId ? App.HELP_TASKS.find(t => t.id === a.taskId) : null;
  }

  const PRIMARY_ICONS = {
    'tag-qr-print': 'qr_code_2',
    'handover-accept': 'assignment_ind',
    'count-outcomes': 'checklist',
    'reconcile-variance': 'difference',
  };

  function renderPrimaryActivity(a) {
    const task = primaryTaskForArticle(a);
    const stepCount = (a.steps || []).length;
    const ic = PRIMARY_ICONS[a.slug] || task?.icon || 'article';
    return `<div class="help-primary-card">
      <span class="help-primary-ic">${icon(ic)}</span>
      <div class="help-primary-body">
        <h3>${esc(a.title)}</h3>
        <p class="muted">${esc(a.body)}</p>
        ${stepCount ? `<span class="help-article-meta">${stepCount}-step guide</span>` : ''}
        <div class="help-primary-actions">
          <a class="btn tonal sm" data-nav="#/help/${esc(a.slug)}">${icon('menu_book')} Read guide</a>
          ${task ? `<button type="button" class="btn sm" data-help-do="${esc(task.id)}">${icon('play_arrow')} Start</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  function renderPrimaryActivities() {
    const articles = App.helpPrimaryArticles ? App.helpPrimaryArticles() : [];
    if (!articles.length) return '';
    return `<section class="help-section help-primary-section">
      <h2 class="help-section-title">Main asset activities</h2>
      <p class="muted help-section-sub">SOW Component 3 — tag, handover, count, and reconcile (§3.2–3.3)</p>
      <div class="help-primary-grid">${articles.map(renderPrimaryActivity).join('')}</div>
    </section>`;
  }

  function renderHolderChangeSection() {
    const articles = ['request-asset', 'borrow-asset', 'return-asset', 'movement-types']
      .map(s => App.helpArticle(s)).filter(Boolean);
    if (!articles.length) return '';
    return `<section class="help-section">
      <h2 class="help-section-title">Holder change</h2>
      <p class="muted help-section-sub">Request, Borrow, and Return use the 9-step holder transfer wizard — not physical relocation (SOW 3.4)</p>
      <div class="help-article-grid">${articles.map(renderArticleCard).join('')}</div>
    </section>`;
  }

  function renderTopicCards(activeTopic) {
    if (!activeTopic) return '';
    return `<section class="help-section">
      <h2 class="help-section-title">Browse by topic</h2>
      <div class="help-topic-grid">
        ${App.HELP_TOPICS.map(t => `<a class="help-topic-card${activeTopic === t.id ? ' active' : ''}" data-nav="#/help?topic=${esc(t.id)}">
          <span class="help-topic-ic">${icon(t.icon)}</span>
          <span class="help-topic-text"><b>${esc(t.title)}</b><span class="muted">${esc(t.desc)}</span></span>
        </a>`).join('')}
      </div>
    </section>`;
  }

  function renderTopicPicker() {
    return `<section class="help-section help-more-topics">
      <h2 class="help-section-title">More topics</h2>
      <div class="help-topic-grid">
        ${App.HELP_TOPICS.filter(t => t.id !== 'movement').map(t => `<a class="help-topic-card" data-nav="#/help?topic=${esc(t.id)}">
          <span class="help-topic-ic">${icon(t.icon)}</span>
          <span class="help-topic-text"><b>${esc(t.title)}</b><span class="muted">${esc(t.desc)}</span></span>
        </a>`).join('')}
        <a class="help-topic-card" data-nav="#/help?topic=movement">
          <span class="help-topic-ic">${icon('swap_horiz')}</span>
          <span class="help-topic-text"><b>Holder change</b><span class="muted">Request / Borrow / Return — not SOW 3.4 relocation</span></span>
        </a>
      </div>
    </section>`;
  }

  function renderArticleCard(a) {
    const stepCount = (a.steps || []).length;
    return `<a class="help-article-card" data-nav="#/help/${esc(a.slug)}">
      <span class="help-article-card-ic">${icon('article')}</span>
      <span class="help-article-card-body">
        <b>${esc(a.title)}</b>
        <span class="muted">${esc(a.body)}</span>
        ${stepCount ? `<span class="help-article-meta">${stepCount} steps${a.roles ? ' · ' + esc(a.roles.split(';')[0].split(',')[0]) : ''}</span>` : ''}
      </span>
      ${icon('chevron_right')}
    </a>`;
  }

  function renderBrowseArticles(topicId) {
    let articles = topicId
      ? App.helpArticlesForTopic(topicId)
      : App.HELP_ARTICLES.filter(a => !a.featured && a.topic !== 'movement');
    if (!articles.length) return '';
    const title = topicId === 'movement'
      ? 'Holder change'
      : topicId
        ? (topicById(topicId)?.title || 'Topic') + ' — help articles'
        : 'More help articles';
    const sub = topicId === 'movement'
      ? 'Request, Borrow, Return, and the shared 9-step process — not physical relocation (SOW 3.4)'
      : 'Registration, write-off, and other asset workflows';
    return `<section class="help-section">
      <h2 class="help-section-title">${esc(title)}</h2>
      <p class="muted help-section-sub">${esc(sub)}</p>
      <div class="help-article-grid">${articles.map(renderArticleCard).join('')}</div>
    </section>`;
  }

  function renderQuickActions() {
    const tasks = App.HELP_TASKS.filter(t => !t.primary);
    if (!tasks.length) return '';
    return `<section class="help-section help-quick-actions">
      <h2 class="help-section-title">Other activities</h2>
      <p class="muted help-section-sub">Repair, write-off, register found, and holder-change shortcuts</p>
      <div class="help-task-grid">
        ${tasks.map(t => `<button type="button" class="help-task-card" data-help-do="${esc(t.id)}">
          ${icon(t.icon || 'play_arrow')}
          <span><b>${esc(t.label)}</b><span class="muted">${esc(t.desc)}</span></span>
        </button>`).join('')}
      </div>
    </section>`;
  }

  function renderArticleSteps(steps) {
    if (!steps || !steps.length) return '';
    return `<section class="help-article-section">
      <h2 class="help-article-h2">Step-by-step</h2>
      <ol class="help-steps">${steps.map(s => `<li>
        <div class="help-step-body"><b>${esc(s.title)}</b><p>${esc(s.desc)}</p></div>
      </li>`).join('')}</ol>
    </section>`;
  }

  function renderRelatedArticles(related) {
    if (!related.length) return '';
    return `<section class="help-article-section">
      <h2 class="help-article-h2">Related articles</h2>
      <div class="help-article-list">${related.map(a => `<a class="help-article-row" data-nav="#/help/${esc(a.slug)}">
        ${icon('chevron_right')}<span>${esc(a.title)}</span></a>`).join('')}</div>
    </section>`;
  }

  function renderTryIt(a) {
    const task = a.taskId ? App.HELP_TASKS.find(t => t.id === a.taskId) : null;
    if (!task && !a.route) return '';
    return `<section class="help-article-section help-try-it no-print">
      <h2 class="help-article-h2">Try it yourself</h2>
      <p class="muted">Ready to start? Open the screen with a prefilled demo wizard.</p>
      <div class="help-try-actions">
        ${task ? `<button type="button" class="btn" data-help-do="${esc(task.id)}">${icon(task.icon || 'play_arrow')} ${esc(task.label)}</button>` : ''}
        ${a.route ? `<button type="button" class="btn tonal" data-nav="${esc(a.route)}">${icon('open_in_new')} Open ${esc(a.route.replace('#/', ''))}</button>` : ''}
      </div>
    </section>`;
  }

  function renderArticlePage(a) {
    const topic = topicById(a.topic);
    const related = App.helpRelatedArticles ? App.helpRelatedArticles(a.slug) : [];
    const tips = a.tips || [];
    return ui.pageHead({
      title: a.title,
      breadcrumb: [
        { label: 'Help Center', hash: '#/help' },
        ...(topic ? [{ label: topic.title, hash: '#/help?topic=' + topic.id }] : []),
        { label: a.title },
      ],
    })
    + `<div class="help-article-page">
      <p class="help-article-lead">${esc(a.body)}</p>
      ${a.roles ? ui.callout('info', `<b>Who can do this:</b> ${esc(a.roles)}`, 'group') : ''}
      ${renderArticleSteps(a.steps)}
      ${tips.length ? ui.callout('question', tips.map(t => esc(t)).join('<br>'), 'lightbulb') : ''}
      ${renderRelatedArticles(related)}
      ${renderTryIt(a)}
    </div>`;
  }

  function mountHelpActions(root) {
    const form = root.querySelector('#helpSearchForm');
    const input = root.querySelector('#helpSearchInput');
    const suggest = root.querySelector('#helpSuggest');

    if (input) {
      input.oninput = () => {
        searchQ = input.value;
        dropdownOpen = true;
        if (suggest) suggest.innerHTML = renderSuggestions(searchQ);
      };
      input.onfocus = () => {
        dropdownOpen = true;
        if (suggest && searchQ) suggest.innerHTML = renderSuggestions(searchQ);
      };
    }
    if (form) form.onsubmit = (e) => {
      e.preventDefault();
      searchQ = input ? input.value : '';
      dropdownOpen = true;
      if (suggest) suggest.innerHTML = renderSuggestions(searchQ);
    };

    root.onclick = (e) => {
      const doEl = e.target.closest('[data-help-do]');
      if (doEl) {
        const task = App.HELP_TASKS.find(t => t.id === doEl.getAttribute('data-help-do'));
        if (task) App.helpRunTask(task);
        return;
      }
      const slugEl = e.target.closest('[data-help-slug]');
      if (slugEl) {
        App.navigate('#/help/' + slugEl.getAttribute('data-help-slug'));
        return;
      }
      const assetEl = e.target.closest('[data-help-asset]');
      if (assetEl) {
        App.helpRunFindAsset(App.asset(assetEl.getAttribute('data-help-asset')));
        return;
      }
      const srEl = e.target.closest('[data-help-sr]');
      if (srEl) {
        App.helpRunFindSR(App.ticket(srEl.getAttribute('data-help-sr')));
      }
    };
  }

  App.registerView('#/help', {
    title: 'Help Center',
    render(ctx) {
      const topicId = ctx.query.topic || '';
      if (ctx.query.q && !searchQ) searchQ = ctx.query.q;
      dropdownOpen = !!searchQ;
      return `<div class="help-page">${renderHero(searchQ, topicId)}`
        + (topicId ? '' : renderPrimaryActivities())
        + (topicId ? '' : renderHolderChangeSection())
        + renderTopicCards(topicId)
        + renderBrowseArticles(topicId)
        + (topicId ? '' : renderTopicPicker())
        + renderQuickActions()
        + `</div>`;
    },
    mount(root) { mountHelpActions(root); },
  });

  App.registerView('#/help/:slug', {
    title: ctx => {
      const a = App.helpArticle((ctx.params || {}).slug);
      return a ? a.title : 'Help article';
    },
    render(ctx) {
      const a = App.helpArticle(ctx.params.slug);
      if (!a) {
        return ui.pageHead({ title: 'Article not found', breadcrumb: [{ label: 'Help Center', hash: '#/help' }] })
          + ui.callout('warn', 'No help article for this link.');
      }
      return renderArticlePage(a);
    },
    mount(root) { mountHelpActions(root); },
  });
})();
