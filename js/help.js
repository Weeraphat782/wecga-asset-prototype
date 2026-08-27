/* WeCGA Help Center catalog — mock keyword match, no NLP.
   ponytail: static topics/articles/tasks; upgrade path = search index or backend. */
(function () {
  const App = window.App;

  App.HELP_PRIMARY_SLUGS = ['tag-qr-print', 'handover-accept', 'count-outcomes', 'reconcile-variance'];

  App.HELP_TOPICS = [
    { id: 'movement', title: 'Holder change', desc: 'Request, Borrow, Return — 9-step holder transfer (not SOW 3.4 relocation)', icon: 'swap_horiz', intro: 'Transfer, borrow, and return change who holds the asset. This is not the physical relocation service in SOW 3.4 (moving team, building/floor/zone).' },
    { id: 'tagging', title: 'Tag & receive', desc: 'QR tagging, first record, handover acceptance', icon: 'qr_code_2', intro: 'From QR generation through first record and owner acceptance — how assets enter WeCGA traceability.' },
    { id: 'count', title: 'Inventory count', desc: 'My Count tasks and field outcomes', icon: 'fact_check', intro: 'Field count tasks, role-based evidence rules, and what happens after each outcome.' },
    { id: 'writeoff', title: 'Dispose asset', desc: 'Lost, damaged, donation, or destroy write-off', icon: 'delete_sweep', intro: 'Four write-off tracks — Lost, Sale (damaged/unused), Donation, and Dispose (destroy/scrap) — each with its own approval path.' },
  ];

  App.HELP_ARTICLES = [
    {
      slug: 'request-asset', topic: 'movement', title: 'Request asset',
      body: 'Request an asset when it should permanently move to a new holder — transfer between employees, teams, or cost centres.',
      roles: 'Any employee can start; receiver must accept; GA verifies; Asset HQ updates SAP',
      steps: [
        { title: 'Open Movement → New request', desc: 'From Help Center or Operations → Movement. Search and tick the assets you need.' },
        { title: 'Choose type: Transfer', desc: 'Select Transfer (Request asset). Use Borrow only for temporary use.' },
        { title: 'Enter receiver and reason', desc: 'Name the new holder and add a short business reason. Multiple assets can share one request if the receiver is the same.' },
        { title: 'Submit — receiver accepts', desc: 'WeCGA notifies the receiver. They open the ticket and accept each line.' },
        { title: 'GA verify → SAP update', desc: 'Regional GA confirms physical handover. Asset HQ posts the holder change to SAP. Ticket completes.' },
      ],
      tips: ['Request asset = permanent transfer. If you only need it temporarily, use Borrow asset instead.', 'This is holder change — not physical relocation (SOW 3.4).'],
      related: ['borrow-asset', 'return-asset', 'movement-types'], taskId: 'task-request', route: '#/movement/new',
      keywords: ['request', 'request asset', 'transfer', 'โอน', 'ขอ', 'holder'],
    },
    {
      slug: 'borrow-asset', topic: 'movement', title: 'Borrow asset',
      body: 'Borrow when you need an asset temporarily — you must return it when done. Same 9-step process as Request asset.',
      roles: 'Employee (borrower or lender side), GA Admin (verify), Asset Team HQ (SAP update)',
      steps: [
        { title: 'Open Movement → New request', desc: 'From Help Center or Operations → Movement. Pick the asset(s) to borrow.' },
        { title: 'Choose type: Borrow', desc: 'Select Borrow — not Transfer. The system tracks this as temporary custody.' },
        { title: 'Enter who receives the asset', desc: 'Usually yourself or your team as borrower. Add reason and expected return date if prompted.' },
        { title: 'Lender / receiver accepts', desc: 'Current holder accepts the borrow request line-by-line in the ticket.' },
        { title: 'GA verify → SAP update', desc: 'GA confirms handover on site. HQ updates holder in SAP. Asset stays on your name until Return.' },
      ],
      tips: ['When finished, open Return asset — do not use Transfer to send it back.', 'Borrow and Request share the same wizard; only the type label changes.', 'Not physical relocation (SOW 3.4).'],
      related: ['return-asset', 'request-asset', 'movement-types'], taskId: 'task-borrow', route: '#/movement/new',
      keywords: ['borrow', 'borrow asset', 'ยืม', 'loan', 'temporary'],
    },
    {
      slug: 'return-asset', topic: 'movement', title: 'Return asset',
      body: 'Return a borrowed asset to its owner or store when you no longer need it. Closes the borrow cycle.',
      roles: 'Employee (returning borrower), GA Admin (verify), Asset Team HQ (SAP update)',
      steps: [
        { title: 'Open Movement → New request', desc: 'From Help Center or Operations → Movement. Select the asset(s) you are returning.' },
        { title: 'Choose type: Return', desc: 'Select Return — not Transfer. This links logically to a prior Borrow.' },
        { title: 'Enter return destination', desc: 'Name the original holder, store, or GA contact receiving the asset back.' },
        { title: 'Receiver accepts return', desc: 'The receiving party confirms each asset line in the ticket.' },
        { title: 'GA verify → SAP update', desc: 'GA confirms asset is physically back. HQ updates SAP holder. Borrow cycle complete.' },
      ],
      tips: ['Always use Return after Borrow — do not use Transfer to hand back a borrowed item.', 'If the asset is damaged on return, note it in the reason; a Repair or Write-off SR may follow.', 'Not physical relocation (SOW 3.4).'],
      related: ['borrow-asset', 'request-asset', 'movement-types'], taskId: 'task-return', route: '#/movement/new',
      keywords: ['return', 'return asset', 'คืน', 'send back', 'give back'],
    },
    {
      slug: 'movement-types', topic: 'movement', title: 'How the 9-step movement process works',
      body: 'Request, Borrow, and Return (plus Repair and Change holder) all share one workflow. Only the type and reason differ at the start.',
      roles: 'Employee (requester or receiver), GA Admin (verify), Asset Team HQ (SAP update)',
      steps: [
        { title: 'Steps 1–3: Create & submit', desc: 'Pick assets, choose type (Request / Borrow / Return), enter receiver and reason.' },
        { title: 'Step 4: Receiver accepts', desc: 'New holder accepts each asset line. Partial acceptance allowed.' },
        { title: 'Steps 5–6: GA verifies', desc: 'Regional GA confirms physical handover on site.' },
        { title: 'Steps 7–9: SAP update', desc: 'Asset HQ posts holder change. Ticket completes.' },
      ],
      tips: ['Repair and Change holder use the same steps — less common than Request / Borrow / Return.', 'This workflow is holder transfer — not SOW 3.4 physical relocation (moving team, building/floor/zone).'],
      related: ['request-asset', 'borrow-asset', 'return-asset'], route: '#/movement/new',
      keywords: ['transfer', 'borrow', 'return', 'repair', 'holder', 'movement', '9-step'],
    },
    {
      slug: 'tag-three-photos', topic: 'tagging', title: 'First record: scan and 3 photos',
      body: 'After a QR label is applied, the first field visit must capture scan evidence and three photos with GPS.',
      roles: 'GA Admin or assigned employee (field); Asset Team HQ reviews exceptions',
      steps: [
        { title: 'Scan the QR code', desc: 'Open Scan from mobile menu or the tagging ticket. Point camera at the WeCGA QR — asset details load automatically.' },
        { title: 'Capture QR photo', desc: 'Photo 1: close-up of the QR label on the asset.' },
        { title: 'Capture serial photo', desc: 'Photo 2: manufacturer serial or asset tag plate, readable text.' },
        { title: 'Capture whole-asset photo', desc: 'Photo 3: full asset in context (desk, rack, room). GPS coordinates attach to each photo.' },
        { title: 'Submit first record', desc: 'Save — asset status moves to recorded. HQ can print handover pack next.' },
      ],
      tips: ['All three photos are mandatory for employee counts; IT mass-scan roles may skip photos on count but not on first record.'],
      related: ['tag-qr-print', 'handover-accept'], taskId: 'task-tag', route: '#/scan',
      keywords: ['photo', '3', 'scan', 'tag', 'first record'],
    },
    {
      slug: 'tag-qr-print', topic: 'tagging', title: 'Tag untagged assets', featured: true,
      body: 'Assets imported from SAP without a WeCGA QR need a tagging service request before field work.',
      roles: 'Asset Team HQ creates QR; GA or employee applies label and completes first record',
      steps: [
        { title: 'Create tagging SR', desc: 'Tagging → New. Search untagged assets and select lines to include.' },
        { title: 'Generate QR sheet', desc: 'HQ prints the QR PDF. Each label shows WeCGA code + SAP asset number.' },
        { title: 'Apply labels in the field', desc: 'Stick QR on a visible, durable spot. Mark "QR generated" in the ticket when printed.' },
        { title: 'Complete first record', desc: 'Field user scans and submits 3 photos (see First record article).' },
      ],
      tips: ['Do not register SAP-only assets here — use Manual Registration for assets not in SAP.'],
      related: ['tag-three-photos'], taskId: 'task-tag', route: '#/tagging',
      keywords: ['qr', 'print', 'label', 'untagged'],
    },
    {
      slug: 'handover-accept', topic: 'tagging', title: 'Handover — owner must accept', featured: true,
      body: 'Physical delivery is not enough — each owner must accept in WeCGA to create audit traceability.',
      roles: 'Asset Team HQ initiates; Employee (owner) accepts; GA may witness',
      steps: [
        { title: 'Create handover SR', desc: 'Handover → New. Pick assets that are tagged and first-recorded.' },
        { title: 'Choose delivery method', desc: 'Email link or in-person WeCGA record. Owner receives notification.' },
        { title: 'Owner opens acceptance screen', desc: 'Owner sees asset list, location, and photos. They confirm receipt per line.' },
        { title: 'Accept or reject with reason', desc: 'Accept = owner responsibility starts. Reject = returns to HQ with comment.' },
      ],
      tips: ['Handover is separate from movement — it confirms initial ownership after tagging, not a transfer between holders.'],
      related: ['tag-three-photos'], taskId: 'task-handover', route: '#/handover',
      keywords: ['handover', 'accept', 'deliver', 'owner'],
    },
    {
      slug: 'register-found', topic: 'tagging', title: 'Register a found asset',
      body: 'For assets physically present but not in SAP (typically under 2,000 THB), use manual registration — not a SAP field update.',
      roles: 'GA Admin or Asset Team HQ',
      steps: [
        { title: 'Open Manual Registration', desc: 'Registration → New wizard.' },
        { title: 'Enter asset details', desc: 'Description, location, cost estimate, and found circumstances. WeCGA code is auto-assigned.' },
        { title: 'Attach evidence', desc: 'Photos and optional memo. Committee may review high-value finds.' },
        { title: 'Submit for approval', desc: 'Approved assets appear in the register with source = Manual. Tagging can follow if QR needed.' },
      ],
      tips: ['This creates a WeCGA-only record — it does not post to SAP asset master.'],
      related: ['tag-qr-print'], taskId: 'task-register', route: '#/registration',
      keywords: ['found', 'register', 'not in sap', 'manual'],
    },
    {
      slug: 'count-outcomes', topic: 'count', title: 'Count outcomes and follow-up', featured: true,
      body: 'Each My Count submission picks an outcome. Some outcomes automatically spawn follow-up service requests.',
      roles: 'Employee, IT, Engineering, Committee — per count campaign assignment',
      steps: [
        { title: 'Open My Count task', desc: 'Inventory Counts lists locations — use My tasks on your assigned row to count in the field.' },
        { title: 'Scan or search asset', desc: 'Scan QR or type asset code. Confirm location matches.' },
        { title: 'Select outcome', desc: 'Found OK, Wrong location, Not in SAP, Damaged, Not found, or Moved.' },
        { title: 'Submit evidence', desc: 'Employees attach photos; IT roles may mass-scan without photos where policy allows.' },
        { title: 'Review spawned SRs', desc: 'Wrong location / Moved → Movement SR. Damaged / Not found → Write-off or Reconcile SR appears in your queue.' },
      ],
      tips: ['Not found on a count does not immediately write off — it opens a reconcile/write-off path for HQ review.'],
      related: ['count-roles', 'reconcile-variance'], taskId: 'task-count', route: '#/my-count',
      keywords: ['count', 'outcome', 'found', 'spawn'],
    },
    {
      slug: 'reconcile-variance', topic: 'count', title: 'Reconcile count results vs SAP', featured: true,
      body: 'After field counts, Asset HQ compares WeCGA outcomes against SAP and resolves variances — wrong location, not found, unregistered assets.',
      roles: 'Asset Team HQ, GA Admin; spawned from count outcomes or manual review',
      steps: [
        { title: 'Open Reconciliation', desc: 'Operations → Reconciliation. Review variance chips: unregistered, wrong location, not found.' },
        { title: 'Triage each line', desc: 'Match count evidence to SAP register. Open linked service request if one was spawned automatically.' },
        { title: 'Take action', desc: 'Spawn or complete Movement, Registration, or Write-off SRs as needed. Mark variance resolved when SAP aligns.' },
        { title: 'Export for audit', desc: 'Use Reports for count status and reconciliation summary (SOW 3.3.10, 3.5.1).' },
      ],
      tips: ['Count outcome "wrong location" often creates a transfer SR — still holder change, not SOW 3.4 relocation.'],
      related: ['count-outcomes'], route: '#/reconcile',
      keywords: ['reconcile', 'variance', 'sap', 'wrong location', 'not found', '3.3.10'],
    },
    {
      slug: 'count-roles', topic: 'count', title: 'Employee scan+photo vs IT mass scan',
      body: 'Count evidence rules depend on your role. Employees prove presence; IT-style roles optimise for volume.',
      roles: 'Employee = photos required; IT / Committee / Engineering = mass scan allowed',
      steps: [
        { title: 'Check your assignment', desc: 'Inventory Counts shows locations assigned to your team role (Employee vs IT). Asset HQ assigns teams per location.' },
        { title: 'Employee path', desc: 'Each asset: scan + at least one photo + GPS. Same rigour as first record.' },
        { title: 'IT / mass-scan path', desc: 'Barcode or QR scan in quick succession; photos optional unless asset is flagged exception.' },
        { title: 'Exception handling', desc: 'Damaged or not-found still require comment and may force photo even for IT roles.' },
      ],
      related: ['count-outcomes'], taskId: 'task-count', route: '#/my-count',
      keywords: ['role', 'mass', 'scan', 'employee'],
    },
    {
      slug: 'writeoff-tracks', topic: 'writeoff', title: 'Lost, Sale, Donation, and Dispose tracks',
      body: 'Write-off is always one service request per asset. Pick the track that matches why the asset leaves the register.',
      roles: 'Employee reports; Asset HQ / Accounting / Committee approve depending on track',
      steps: [
        { title: 'Lost track', desc: 'Asset cannot be located after search. May trigger compensation workflow.' },
        { title: 'Sale track', desc: 'Damaged beyond repair or unused and approved for disposal sale. HQ enters NBV/COST.' },
        { title: 'Donation track', desc: 'Unused but usable asset donated to external party. Requires donation memo.' },
        { title: 'Dispose track', desc: 'Destroy or scrap — no sale or donation. Licensed vendor or physical destruction with evidence.' },
        { title: 'Approval chain', desc: 'Each track has a different approver set — watch the ticket timeline for pending steps.' },
      ],
      tips: ['Count outcome "damaged" typically spawns a Sale-track write-off SR for HQ to complete.', 'Use Dispose when the asset has no resale or donation value.'],
      related: ['writeoff-lost'], route: '#/writeoff',
      keywords: ['sale', 'donation', 'lost', 'dispose', 'destroy', 'scrap', 'damage', 'write-off'],
    },
    {
      slug: 'writeoff-lost', topic: 'writeoff', title: 'Report a lost asset',
      body: 'Start here when an asset is missing and cannot be found after reasonable search.',
      roles: 'Employee or GA reports; Asset HQ and Accounting approve; Committee if compensation applies',
      steps: [
        { title: 'Open Write-off → Lost', desc: 'Pick the asset (or accept spawned SR from count/reconcile).' },
        { title: 'Describe search efforts', desc: 'When last seen, locations checked, police report if applicable.' },
        { title: 'Attach memo', desc: 'Upload signed explanation. Accounting reviews NBV impact.' },
        { title: 'Compensation decision', desc: 'HQ marks Compensate or Do not compensate. Employee may need to acknowledge.' },
        { title: 'Complete disposal', desc: 'SAP retirement posted after final approval.' },
      ],
      tips: ['If the asset is later found, stop the write-off and open a Movement or Registration instead.'],
      related: ['writeoff-tracks'], taskId: 'task-lost', route: '#/writeoff/new',
      keywords: ['lost', 'หาย', 'stolen', 'not found'],
    },
  ];

  App.HELP_TASKS = [
    { id: 'task-request', label: 'Request asset', desc: 'Holder change — Transfer (not SOW 3.4 relocation)', icon: 'swap_horiz', keywords: ['request', 'request asset', 'transfer', 'move', 'โอน', 'ขอ'], action: 'movement', moveType: 'Transfer' },
    { id: 'task-borrow', label: 'Borrow asset', desc: 'Holder change — Borrow', icon: 'handshake', keywords: ['borrow', 'borrow asset', 'ยืม', 'loan'], action: 'movement', moveType: 'Borrow' },
    { id: 'task-return', label: 'Return asset', desc: 'Holder change — Return', icon: 'undo', keywords: ['return', 'return asset', 'คืน', 'send back'], action: 'movement', moveType: 'Return' },
    { id: 'task-repair', label: 'Send for repair', desc: '9-step movement — Repair', icon: 'build', keywords: ['repair', 'fix', 'ซ่อม', 'broken'], action: 'movement', moveType: 'Repair' },
    { id: 'task-change-holder', label: 'Change holder', desc: '9-step movement — Change holder', icon: 'person', keywords: ['change holder', 'holder', 'เปลี่ยนผู้ถือ'], action: 'movement', moveType: 'Change holder' },
    { id: 'task-handover', label: 'Handover to owner', desc: 'Owner acceptance flow', icon: 'assignment_ind', keywords: ['handover', 'accept', 'รับของ', 'deliver', 'ส่งมอบ'], action: 'handover' },
    { id: 'task-lost', label: 'Report lost asset', desc: 'Write-off Lost track', icon: 'search_off', keywords: ['lost', 'หาย', 'stolen', 'not found', 'หายไป'], action: 'writeoff', track: 'Lost' },
    { id: 'task-damaged', label: 'Write off damaged asset', desc: 'Write-off Sale track', icon: 'sell', keywords: ['damaged', 'damage', 'พัง', 'broken', 'sale'], action: 'writeoff', track: 'Sale' },
    { id: 'task-donate', label: 'Donate unused asset', desc: 'Write-off Donation track', icon: 'volunteer_activism', keywords: ['donate', 'donation', 'บริจาค'], action: 'writeoff', track: 'Donation' },
    { id: 'task-dispose', label: 'Destroy / scrap asset', desc: 'Write-off Dispose track', icon: 'delete_forever', keywords: ['dispose', 'destroy', 'scrap', 'ทิ้ง', 'ทำลาย'], action: 'writeoff', track: 'Dispose' },
    { id: 'task-tag', label: 'Tag untagged assets', desc: 'Create tagging service request', icon: 'qr_code_2', keywords: ['tag', 'qr', 'ติดแท็ก', 'untagged'], action: 'tagging' },
    { id: 'task-register', label: 'Register found asset', desc: 'Manual registration wizard', icon: 'note_add', keywords: ['found', 'register', 'not in sap', 'ไม่มีใน sap'], action: 'registration' },
    { id: 'task-count', label: 'Record my count', desc: 'Field count tasks', icon: 'checklist', keywords: ['count', 'นับ', 'stock', 'ตรวจนับ'], action: 'my-count' },
  ];

  function norm(q) { return (q || '').trim().toLowerCase(); }

  function scoreKeywords(q, keywords) {
    if (!q) return 0;
    let s = 0;
    keywords.forEach(kw => {
      const k = kw.toLowerCase();
      if (q === k) s += 10;
      else if (q.includes(k) || k.includes(q)) s += 5;
      else if (q.split(/\s+/).some(w => w.length > 2 && k.includes(w))) s += 2;
    });
    return s;
  }

  function companyAssets() {
    return App.store.assets.filter(a => a.companyCode === App.session.company);
  }

  function findAssets(q) {
    const n = norm(q);
    if (!n || n.length < 2) return [];
    return companyAssets().filter(a => App.assetMatches(a, n)).slice(0, 5);
  }

  function findOpenSR(q) {
    const n = norm(q);
    if (!n) return [];
    return App.store.tickets.filter(t =>
      t.company === App.session.company &&
      t.status !== 'Completed' &&
      (String(t.id).toLowerCase().includes(n) || (t.title || '').toLowerCase().includes(n))
    ).slice(0, 3);
  }

  App.helpSearch = (q) => {
    const n = norm(q);
    const doItems = App.HELP_TASKS.map(t => ({
      type: 'do',
      score: (t.primary ? 3 : 0) + scoreKeywords(n, t.keywords),
      item: t,
    }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const learnItems = App.HELP_ARTICLES.map(a => ({
      type: 'learn',
      score: (a.featured ? 3 : 0) + scoreKeywords(n, [a.title, ...(a.keywords || []), a.topic]),
      item: a,
    })).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    const assets = findAssets(q).map(a => ({ type: 'find-asset', item: a }));
    const srs = findOpenSR(q).map(t => ({ type: 'find-sr', item: t }));
    const findItems = assets.concat(srs);
    return {
      q,
      do: doItems.slice(0, 4),
      learn: learnItems.slice(0, 5),
      find: findItems.slice(0, 5),
      hasResults: doItems.length + learnItems.length + findItems.length > 0,
    };
  };

  App.helpArticlesForTopic = (topicId) =>
    App.HELP_ARTICLES.filter(a => a.topic === topicId);

  App.helpPrimaryArticles = () =>
    (App.HELP_PRIMARY_SLUGS || []).map(s => App.helpArticle(s)).filter(Boolean);

  App.helpArticle = (slug) =>
    App.HELP_ARTICLES.find(a => a.slug === slug);

  App.helpRelatedArticles = (slug) => {
    const a = App.helpArticle(slug);
    if (!a || !a.related) return [];
    return a.related.map(s => App.helpArticle(s)).filter(Boolean);
  };

  App.helpRunTask = (task, assetId) => {
    if (!task) return;
    switch (task.action) {
      case 'writeoff':
        if (App.startWriteoff) App.startWriteoff(assetId, { track: task.track || 'Sale' });
        else App.navigate('#/writeoff/new');
        break;
      case 'movement':
        if (App.startMovement) App.startMovement(assetId, { type: task.moveType || 'Transfer' });
        else App.navigate('#/movement/new');
        break;
      case 'tagging':
        if (assetId && App.startTagging) App.startTagging(assetId);
        else App.navigate('#/tagging/new');
        break;
      case 'registration':
        App.navigate('#/registration/new');
        break;
      case 'my-count':
        App.navigate('#/counts');
        break;
      case 'handover':
        App.navigate('#/handover/new');
        break;
      default:
        App.navigate('#/dashboard');
    }
  };

  App.helpRunFindAsset = (a) => { if (a && a.id) App.navigate('#/assets/' + a.id); };

  App.helpRunFindSR = (t) => {
    if (!t) return;
    const type = t.type || '';
    let hash = '#/movement/' + t.id;
    if (type.startsWith('Write-off')) hash = '#/writeoff/' + t.id;
    else if (type === 'Registration') hash = '#/registration/' + t.id;
    else if (type === 'Handover') hash = '#/handover/' + t.id;
    else if (type === 'Tagging') hash = '#/tagging/' + t.id;
    App.navigate(hash);
  };
})();
