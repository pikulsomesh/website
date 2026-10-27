// Site behaviour: theme, nav, reveal-on-scroll, and rendering of the JSON
// content files. Each page declares data-page and data-root on <body>.

const body = document.body;
const ROOT = body.dataset.root || './';
const PAGE = body.dataset.page || 'home';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function getJSON(name) {
  const res = await fetch(`${ROOT}assets/data/${name}`);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}

// "2026-10-20" -> "Oct 20, 2026"
const fmtDate = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/* ---------- Theme ---------- */
function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set) return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
$$('.theme-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
    btn.setAttribute('aria-label', `Switch to ${next === 'dark' ? 'light' : 'dark'} mode`);
  });
});

/* ---------- Mobile nav ---------- */
const menuBtn = $('.menu-btn');
const nav = $('.nav');
if (menuBtn && nav) {
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) nav.classList.remove('open'); });
}

/* ---------- Reveal ---------- */
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' })
  : null;
function observeReveals(scope = document) {
  $$('.reveal:not(.in)', scope).forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
}

/* ---------- Icons ---------- */
const ICONS = {
  twin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/></svg>',
  agent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M12 7.5v4M12 11.5 6.5 16M12 11.5l5.5 4.5"/></svg>',
  graph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 4v4l-3 2v4l3 2v4M18 4v4l3 2v4l-3 2v4M6 8h12M6 16h12"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  chain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7.3 11 16.7 6M7.3 13l9.4 5"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  molecule: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m12 3 7.8 4.5v9L12 21l-7.8-4.5v-9z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17 17 7M8 7h9v9"/></svg>',
};

/* ---------- Home ---------- */
function renderProof(p) {
  const el = $('#proof');
  if (!el) return;
  el.innerHTML = p.proof.map((x) => `<div><strong>${esc(x.value)}</strong><span>${esc(x.label)}</span></div>`).join('');
}

function renderTimeline(p) {
  const list = $('#tl-list');
  if (!list) return;
  list.innerHTML = p.timeline.map((t, i) => `
    <li class="tl-item" id="tl-${esc(t.id)}" data-tag="${esc(t.tag)}">
      <button class="tl-row" aria-expanded="${i === 0}" aria-controls="tl-${esc(t.id)}-detail">
        <span class="tl-years">${esc(t.years)}</span>
        <span><span class="tl-role">${esc(t.role)}</span><br><span class="tl-org">${esc(t.org)}</span></span>
        <span class="tl-plus" aria-hidden="true"></span>
      </button>
      <div class="tl-detail" id="tl-${esc(t.id)}-detail"><div><div class="tl-detail-inner">
        <ul>${t.points.map((pt) => `<li>${esc(pt)}</li>`).join('')}</ul>
        <div class="tl-metrics">${(t.metrics || []).map((m) => `<div class="metric"><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`).join('')}</div>
      </div></div></div>
    </li>`).join('');

  list.addEventListener('click', (e) => {
    const row = e.target.closest('.tl-row');
    if (!row) return;
    row.setAttribute('aria-expanded', String(row.getAttribute('aria-expanded') !== 'true'));
  });

  $$('#tl-filters .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $$('#tl-filters .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      const f = chip.dataset.filter;
      $$('.tl-item', list).forEach((li) => { li.hidden = f !== 'all' && li.dataset.tag !== f; });
    });
  });
}

function renderPillars(p) {
  const el = $('#pillars');
  if (!el) return;
  el.innerHTML = p.pillars.map((x) => `
    <article class="card reveal">
      <div class="glyph">${ICONS[x.icon] || ''}</div>
      <h3>${esc(x.title)}</h3>
      <p>${esc(x.text)}</p>
      <div class="tags">${x.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    </article>`).join('');
}

function renderWork(p) {
  const el = $('#work-grid');
  if (!el) return;
  el.innerHTML = p.work.map((w) => `
    <article class="card work reveal${w.feature ? ' feature' : ''}" id="${esc(w.id)}">
      ${w.icon ? `<div class="glyph">${ICONS[w.icon] || ''}</div>` : ''}
      <span class="kicker">${esc(w.kicker)}</span>
      <h3>${w.href ? `<a href="${ROOT}${esc(w.href)}">${esc(w.title)}</a>` : esc(w.title)}</h3>
      <p>${esc(w.text)}</p>
      <div class="impact">${w.impact.map((m) => `<div><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`).join('')}</div>
      ${w.press ? `<a class="press" href="${esc(w.press.url)}" target="_blank" rel="noopener">${esc(w.press.label)} ↗</a>` : ''}
    </article>`).join('');
}

function renderRecognition(p) {
  const el = $('#recog');
  if (!el) return;
  el.innerHTML = p.recognition.map((r) => `
    <li class="reveal"><span class="yr">${esc(r.year)}</span><div><b>${esc(r.title)}</b><span>${esc(r.text)}</span></div></li>`).join('');
}

// Topics run from the most technical to the most organizational; series are kept as a secondary filter.
const THEMES = [
  { name: 'Models & inference', blurb: 'Open weights, architectures, inference cost and what the newest models change.' },
  { name: 'Agents & software', blurb: 'Agent harnesses, evals, spec-driven development and the engineering around them.' },
  { name: 'Physical AI', blurb: 'Digital twins, sensing and AI inside heavy equipment and plants.' },
  { name: 'AI & work', blurb: 'What AI does to teams, judgment and how organizations run.' },
];
const TALKS = 'Talks & appearances';
const postMeta = (p) => `<span class="s">${esc(p.theme || '')}</span>${esc(fmtDate(p.date))}${p.series ? `<span class="sr">${esc(p.series)}</span>` : ''}`;

function renderSeriesTeaser(posts) {
  const el = $('#series');
  if (!el) return;
  el.innerHTML = THEMES.map((t) => {
    const items = posts.filter((p) => p.theme === t.name);
    if (!items.length) return '';
    return `<article class="card series reveal">
      <span class="count">${items.length} essays</span>
      <h3><a href="writing/#${encodeURIComponent(t.name)}">${esc(t.name)}</a></h3>
      <p>${esc(t.blurb)}</p>
      <ol>${items.slice(0, 3).map((p) => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener"><span class="v">${esc(fmtDate(p.date).replace(/, \d{4}$/, ''))}</span><span>${esc(p.title)}</span></a></li>`).join('')}</ol>
    </article>`;
  }).join('');
}

/* ---------- Writing page ---------- */
function renderWritingPage(posts) {
  const list = $('#post-list');
  if (!list) return;
  const q = $('#post-q');
  const talks = $('#talk-strip');
  if (talks) {
    talks.innerHTML = posts.filter((p) => p.theme === TALKS).map((p) => `
      <li><a href="${esc(p.url)}" target="_blank" rel="noopener"><span class="mono">${esc(fmtDate(p.date))}</span><b>${esc(p.title)}</b></a></li>`).join('');
  }
  let filter = 'all';
  const draw = () => {
    const term = (q.value || '').trim().toLowerCase();
    const shown = posts.filter((p) => (filter === 'all' || p.theme === filter || p.series === filter) &&
      (!term || `${p.title} ${p.excerpt} ${p.tags.join(' ')}`.toLowerCase().includes(term)));
    $('#post-count').textContent = `${shown.length} of ${posts.length}${posts.length ? ` · latest ${fmtDate(posts[0].date)}` : ''}`;
    list.innerHTML = shown.length ? shown.map((p) => `
      <li class="post">
        <div class="meta">${postMeta(p)}</div>
        <div><h3><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h3>
        <p>${esc(p.excerpt)}</p>
        <div class="tags">${p.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div></div>
      </li>`).join('') : '<li class="empty">Nothing matches that yet.</li>';
  };
  $$('#series-filters .chip').forEach((chip) => chip.addEventListener('click', () => {
    $$('#series-filters .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    filter = chip.dataset.filter;
    draw();
  }));
  q.addEventListener('input', draw);
  const fromHash = decodeURIComponent(location.hash.slice(1));
  if (fromHash) { const c = $(`#series-filters .chip[data-filter="${CSS.escape(fromHash)}"]`); if (c) c.click(); }
  draw();
}

/* ---------- Playbook page ---------- */
const BLOCKS = {
  h: (b) => `<h3 class="pb-h">${esc(b.text)}</h3>`,
  p: (b) => `<p>${esc(b.text)}</p>`,
  list: (b) => `<ul class="pb-list">${b.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`,
  callout: (b) => `<blockquote class="pb-callout">${esc(b.text)}</blockquote>`,
  source: (b) => `<p class="cloud-note pb-source">${esc(b.text)} <a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.label)} ↗</a></p>`,
  table: (b) => `<div class="table-wrap"><table><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="first"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
  cards: (b) => `<div class="pb-cards">${b.items.map((c) => `<div class="pb-card"><b>${esc(c.title)}</b><p>${esc(c.text)}</p></div>`).join('')}</div>`,
  steps: (b) => `<ol class="pb-steps${b.variant === 'loop' ? ' loop' : ''}">${b.items.map((st, i) => `<li><span class="sn mono">${String(i + 1).padStart(2, '0')}</span><b>${esc(st.title)}</b><p>${esc(st.text)}</p></li>`).join('')}</ol>`,
  layers: (b) => `<div class="pb-layers">${b.clouds ? `
    <div class="cloud-pick" role="group" aria-label="Show the stack on a cloud"><span class="mono">Show on</span>${b.clouds.map((c, i) => `<button class="chip" aria-pressed="${i === 0}" data-cloud="${esc(c.id)}">${esc(c.label)}</button>`).join('')}</div>` : ''}${b.items.map((l) => `
    <div class="layer"><button class="layer-btn" aria-expanded="false"><span class="mono">${esc(l.n)}</span><span class="lt"><b>${esc(l.title)}</b>${svcHTML(l.on)}</span><span class="owner">${esc(l.owner)}</span></button>
    <div class="layer-body"><div><p>${esc(l.text)}</p></div></div></div>`).join('')}${(b.spans || []).map((x) => `
    <div class="layer-span"><span class="mono">All</span><div><b>${esc(x.title)}</b><p>${esc(x.text)}</p>${svcHTML(x.on)}</div></div>`).join('')}${b.note ? `
    <p class="cloud-note">${esc(b.note)}</p>` : ''}</div>`,
  tiers: (b) => `<div class="pb-tiers" data-tiers='${esc(JSON.stringify(b.items))}'>
    <div class="tier-tabs" role="tablist">${b.items.map((t, i) => `<button role="tab" class="tier-tab" aria-selected="${i === 0}" data-i="${i}"><span class="mono">${esc(t.n)}</span>${esc(t.title)}</button>`).join('')}</div>
    <div class="tier-scale" aria-hidden="true"><span>More reversible</span><i></i><span>Higher consequence</span></div>
    <div class="tier-panel" role="tabpanel"></div></div>`,
  timeline: (b) => `<ol class="pb-timeline">${b.items.map((t) => `<li><span class="when mono">${esc(t.when)}</span><div><b>${esc(t.title)}</b><p>${esc(t.text)}</p>${t.out ? `<p class="out"><span class="mono">Deliverable</span> ${esc(t.out)}</p>` : ''}</div></li>`).join('')}</ol>`,
  decide: (b) => `<div class="pb-decide">
    <div class="dq">${b.questions.map((q) => `<div class="dq-row"><p>${esc(q.q)}</p><div class="seg" role="group" aria-label="${esc(q.q)}">${['yes', 'no'].map((v) => `<button class="chip" aria-pressed="false" data-q="${esc(q.id)}" data-v="${v}">${v === 'yes' ? 'Yes' : 'No'}</button>`).join('')}</div></div>`).join('')}</div>
    <p class="d-why" aria-live="polite"></p>
    <div class="d-opts">${b.items.map((o) => `<div class="d-opt" data-id="${esc(o.id)}"><span class="mono">${esc(o.sub)}</span><b>${esc(o.title)}</b><p>${esc(o.text)}</p><p class="eg"><span class="mono">Typically</span> ${esc(o.eg)}</p></div>`).join('')}</div></div>`,
};

function svcHTML(on) {
  return on ? Object.entries(on).map(([c, v]) => `<span class="svc mono" data-c="${esc(c)}" hidden>${esc(v)}</span>`).join('') : '';
}

/* Buy, partner or build: the rubric from the economics chapter, applied to the answers given so far. */
function verdict(a) {
  if (!a.edge) return [null, 'Start with the first question: whether the capability is where the business creates value decides most of this.'];
  if (a.edge === 'yes') {
    if (!a.run) return [null, 'It differentiates. Now, can you run it yourselves?'];
    if (a.run === 'no') return ['partner', 'It differentiates, but you cannot run it yet. Partner to get it built, and keep the architecture, the data and the IP in-house while the team grows into it.'];
    return ['build', `It differentiates and you can run it, so build it on the shared platform.${a.fast === 'yes' ? ' The technology is moving, so build from swappable parts and record the exit plan for each.' : ''}`];
  }
  if (!a.exists) return [null, 'It does not differentiate. Is there a proven product for it?'];
  if (a.exists === 'yes') return ['buy', `A proven product exists and it is not your edge, so buy it on open standards.${a.fast === 'yes' ? ' The market is moving, so keep the contract short and make sure you could leave within two quarters.' : ''}`];
  return ['partner', 'Nothing proven to buy and not worth building alone. Partner with a front-runner, share the risk, and revisit as the market catches up.'];
}

function drawDecide(wrap) {
  const a = {};
  $$('.seg .chip[aria-pressed="true"]', wrap).forEach((b) => { a[b.dataset.q] = b.dataset.v; });
  const [pick, why] = verdict(a);
  wrap.querySelector('.d-why').textContent = Object.keys(a).length ? why : 'Answer the questions to see where a capability lands.';
  $$('.d-opt', wrap).forEach((o) => { o.classList.toggle('on', o.dataset.id === pick); o.classList.toggle('off', !!pick && o.dataset.id !== pick); });
}

function drawTier(wrap, i) {
  const items = JSON.parse(wrap.dataset.tiers);
  const t = items[i];
  $$('.tier-tab', wrap).forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.i) === i)));
  wrap.querySelector('.tier-scale i').style.setProperty('--pos', `${(i / (items.length - 1)) * 100}%`);
  wrap.querySelector('.tier-panel').innerHTML = `
    <div class="tier-head"><span class="tier-n">${esc(t.n)}</span><div><b>${esc(t.title)}</b><span>${esc(t.risk)}</span></div></div>
    <dl><dt>What the agent may do</dt><dd>${esc(t.may)}</dd><dt>Control</dt><dd>${esc(t.control)}</dd><dt>Evidence to launch</dt><dd>${esc(t.evidence)}</dd></dl>`;
}

function renderPlaybook(pb) {
  const host = $('#chapters');
  if (!host) return;
  $('#pb-thesis').textContent = pb.thesis;
  $('#principles').innerHTML = pb.principles.map((x, i) => `
    <article class="principle reveal"><span class="mono">${String(i + 1).padStart(2, '0')}</span><b>${esc(x.title)}</b><p>${esc(x.text)}</p></article>`).join('');
  $('#toc').innerHTML = pb.chapters.map((c) => `<a href="#${esc(c.id)}"><span class="mono">${esc(c.num)}</span>${esc(c.title)}</a>`).join('');
  host.innerHTML = pb.chapters.map((c) => `
    <section class="chapter" id="${esc(c.id)}">
      <span class="eyebrow">Chapter ${esc(c.num)}</span>
      <h2>${esc(c.title)}</h2>
      <p class="chapter-lead">${esc(c.lead)}</p>
      ${c.blocks.map((b) => (BLOCKS[b.type] ? BLOCKS[b.type](b) : '')).join('')}
    </section>`).join('');

  $$('.pb-tiers', host).forEach((w) => {
    drawTier(w, 0);
    w.addEventListener('click', (e) => { const b = e.target.closest('.tier-tab'); if (b) drawTier(w, Number(b.dataset.i)); });
  });
  $$('.pb-decide', host).forEach((w) => {
    drawDecide(w);
    w.addEventListener('click', (e) => {
      const b = e.target.closest('.seg .chip');
      if (!b) return;
      const on = b.getAttribute('aria-pressed') !== 'true';
      $$('.chip', b.parentElement).forEach((x) => x.setAttribute('aria-pressed', String(x === b && on)));
      drawDecide(w);
    });
  });
  host.addEventListener('click', (e) => {
    const c = e.target.closest('.cloud-pick .chip');
    if (c) {
      const wrap = c.closest('.pb-layers');
      $$('.cloud-pick .chip', wrap).forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      $$('.svc', wrap).forEach((x) => { x.hidden = x.dataset.c !== c.dataset.cloud; });
      return;
    }
    const b = e.target.closest('.layer-btn');
    if (b) b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true'));
  });

  // Scrollspy for the chapter index
  const links = $$('#toc a');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${en.target.id}`));
        const act = $('#toc a.active');
        if (act && matchMedia('(max-width: 960px)').matches) act.scrollIntoView({ inline: 'center', block: 'nearest' });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('.chapter', host).forEach((c) => spy.observe(c));
  }
}

/* ---------- Builds (home + research) ---------- */
// Keep in step with buildCard in tools/build_seo.mjs, which prerenders the same markup.
// `updated` stays in the data for ordering; cards show no dates so the section reads as ongoing work.
function buildCard(b) {
  const links = (b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener">Live site ↗</a>` : '') + `<a href="${esc(b.repo)}" target="_blank" rel="noopener">Code ↗</a>`
    + (b.links || []).map((l) => (l.url.startsWith('/') ? `<a href="${esc(l.url)}">${esc(l.label)} →</a>` : `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`)).join('');
  return `<article class="card build reveal"><div class="build-top"><span class="kicker mono">${esc(b.theme)}</span><span class="build-status is-${esc(b.state)}">${esc(b.status)}</span></div>
    <h3><a href="${esc(b.url || b.repo)}" target="_blank" rel="noopener">${esc(b.title)}</a></h3>
    <p class="build-problem">${esc(b.problem)}</p><p>${esc(b.text)}</p>
    <ul class="tags build-stack" aria-label="Stack">${b.stack.map((x) => `<li class="tag">${esc(x)}</li>`).join('')}</ul>
    <div class="build-links">${links}</div></article>`;
}
function renderBuilds(p) {
  const el = $('#builds-grid') || $('#code');
  if (el && p.builds) el.innerHTML = p.builds.map(buildCard).join('');
}

/* ---------- Research page ---------- */
function pubRow(p, label) {
  const title = p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title);
  const meta = [label || p.kind, p.coFirst ? 'co-first author' : '', p.cites ? `${p.cites} citations` : ''].filter(Boolean).join(' · ');
  return `<li class="pub"><span class="yr">${esc(p.year)}</span><div><b>${title}</b><span>${esc(meta)}</span></div><span class="venue">${esc(p.venue)}</span></li>`;
}

function renderResearch(pubs, site) {
  const list = $('#pubs');
  if (!list) return;
  const asOf = site && site.scholar ? fmtDate(site.scholar) : pubs.stats.asOf;
  $('#pub-stats').textContent = `${pubs.stats.citations} citations · h-index ${pubs.stats.hIndex} · i10-index ${pubs.stats.i10} · Google Scholar, as of ${asOf}`;
  const groups = [
    ['Peer-reviewed', pubs.papers, 'Journal'],
    ['Preprints', pubs.preprints, 'Preprint'],
    ['Book chapters', pubs.chapters, 'Chapter'],
    ['Theses', pubs.theses || [], 'Thesis'],
    ['Other', pubs.other || [], ''],
  ];
  let group = 0;
  const draw = () => { const [, items, label] = groups[group]; list.innerHTML = items.map((p) => pubRow(p, label)).join(''); };
  $('#pub-filters').innerHTML = groups.map(([name, items], i) => `<button class="chip" aria-pressed="${i === 0}" data-g="${i}">${esc(name)} <span class="mono">${items.length}</span></button>`).join('');
  $('#pub-filters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    group = Number(b.dataset.g);
    $$('#pub-filters .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    draw();
  });
  draw();
  $('#patents').innerHTML = pubs.patents.map((p) => `<li class="pub"><span class="yr">Patent</span><div><b><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></b><span>${esc(p.number)}</span></div><span class="venue">USPTO</span></li>`).join('');
  $('#talk-list').innerHTML = pubs.talks.map((t) => `<li class="pub"><span class="yr">${t.year}</span><div><b>${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.title)}</a>` : esc(t.title)}</b><span>Invited</span></div><span class="venue">${esc(t.venue)}</span></li>`).join('');
  $('#conf-list').innerHTML = pubs.conference.map((c) => `<li class="pub"><span class="yr">${c.year}</span><div><b>${esc(c.title)}</b><span>${esc(c.kind)}</span></div><span class="venue">${esc(c.venue)}</span></li>`).join('');
  $('#service').innerHTML = pubs.service.map((x) => `<li>${esc(x)}</li>`).join('');
}

/* ---------- Resume page ---------- */
function renderResume(p) {
  const el = $('#resume-jobs');
  if (!el) return;
  el.innerHTML = p.timeline.map((t) => `
    <div class="job"><header><b>${esc(t.role)}</b><span>${esc(t.years)}</span></header>
    <div class="org">${esc(t.org)}</div>
    <ul>${t.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('');
  $('#resume-certs').innerHTML = p.certifications.map((c) => `<li>${esc(c)}</li>`).join('');
  $('#resume-recog').innerHTML = p.recognition.map((r) => `<li>${esc(r.year)} · <b>${esc(r.title)}</b>. ${esc(r.text)}</li>`).join('');
}

/* ---------- Contact email (assembled at runtime to deter scrapers) ---------- */
function wireEmail(p) {
  $$('[data-email]').forEach((a) => {
    a.href = `mailto:${p.email}`;
    if (a.dataset.email === 'show') a.textContent = p.email;
  });
}

/* ---------- Freshness ---------- */
// site.json is rewritten by tools/sync_sources.mjs on every scheduled refresh.
function renderUpdated(site) {
  if (!site || !site.updated) return;
  const foot = $('.site-footer .wrap > span');
  if (foot) foot.insertAdjacentHTML('beforeend', ` · <span class="updated">Last updated ${esc(fmtDate(site.updated))}</span>`);
}

/* ---------- Deep links (used by the assistant) ---------- */
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const t = id && document.getElementById(id);
  if (!t) return;
  const row = t.classList.contains('tl-item') && t.querySelector('.tl-row');
  if (row) { t.hidden = false; row.setAttribute('aria-expanded', 'true'); }
  t.scrollIntoView({ block: 'start', behavior: 'instant' });
}

/* ---------- Boot ---------- */
async function boot() {
  const site = await getJSON('site.json').catch(() => null);
  renderUpdated(site);
  try {
    if (['home', 'resume'].includes(PAGE) || $('[data-email]')) {
      const profile = await getJSON('profile.json');
      renderProof(profile); renderTimeline(profile); renderPillars(profile);
      renderWork(profile); renderBuilds(profile); renderRecognition(profile); renderResume(profile); wireEmail(profile);
    }
    if (PAGE === 'home' || PAGE === 'writing') {
      const posts = await getJSON('writing.json');
      renderSeriesTeaser(posts); renderWritingPage(posts);
    }
    if (PAGE === 'playbook') renderPlaybook(await getJSON('playbook.json'));
    if (PAGE === 'research') {
      renderResearch(await getJSON('publications.json'), site);
      renderBuilds(await getJSON('profile.json'));
    }
  } catch (err) {
    console.error('Content failed to load', err);
  }
  observeReveals();
  openFromHash();
  // Web fonts can reflow long pages after the first jump; land on the target again once they settle.
  if (location.hash && document.fonts) document.fonts.ready.then(() => requestAnimationFrame(openFromHash));
  addEventListener('hashchange', openFromHash);
}

$('#year') && ($('#year').textContent = new Date().getFullYear());
boot();

// The assistant module is loaded on first use, so the model never blocks the page.
import(new URL('./assistant/assistant.js', import.meta.url).href).then((m) => m.init({ root: ROOT })).catch((e) => console.error(e));

// Click-to-load YouTube (keeps third-party scripts off the page until asked).
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-yt]');
  if (!b) return;
  const f = document.createElement('iframe');
  f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.dataset.yt)}?autoplay=1&rel=0`;
  f.title = b.getAttribute('aria-label') || 'Video';
  f.allow = 'autoplay; encrypted-media; picture-in-picture';
  f.allowFullscreen = true;
  b.replaceWith(f);
});
