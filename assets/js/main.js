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
      <span class="kicker">${esc(w.kicker)}</span>
      <h3>${w.href ? `<a href="${ROOT}${esc(w.href)}">${esc(w.title)}</a>` : esc(w.title)}</h3>
      <p>${esc(w.text)}</p>
      <div class="impact">${w.impact.map((m) => `<div><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`).join('')}</div>
    </article>`).join('');
}

function renderRecognition(p) {
  const el = $('#recog');
  if (!el) return;
  el.innerHTML = p.recognition.map((r) => `
    <li class="reveal"><span class="yr">${esc(r.year)}</span><div><b>${esc(r.title)}</b><span>${esc(r.text)}</span></div></li>`).join('');
}

const SERIES = [
  { name: 'Digital Iron', blurb: 'How AI and sensing change heavy equipment, one machine at a time.' },
  { name: 'The Human Loop', blurb: 'What AI does to work, teams and judgment inside the enterprise.' },
  { name: 'Lab Series', blurb: 'Hands-on notes on models, agents and the infrastructure under them.' },
];

function renderSeriesTeaser(posts) {
  const el = $('#series');
  if (!el) return;
  el.innerHTML = SERIES.map((s) => {
    const items = posts.filter((p) => p.series === s.name);
    return `<article class="card series reveal">
      <span class="count">${items.length} essays</span>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.blurb)}</p>
      <ol>${items.slice(0, 3).map((p) => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener"><span class="v">${p.vol ? 'No. ' + p.vol : ''}</span><span>${esc(p.title)}</span></a></li>`).join('')}</ol>
    </article>`;
  }).join('');
}

/* ---------- Writing page ---------- */
function renderWritingPage(posts) {
  const list = $('#post-list');
  if (!list) return;
  const q = $('#post-q');
  let series = 'all';
  const draw = () => {
    const term = (q.value || '').trim().toLowerCase();
    const shown = posts.filter((p) => (series === 'all' || p.series === series) &&
      (!term || `${p.title} ${p.excerpt} ${p.tags.join(' ')}`.toLowerCase().includes(term)));
    $('#post-count').textContent = `${shown.length} of ${posts.length}`;
    list.innerHTML = shown.length ? shown.map((p) => `
      <li class="post">
        <div class="meta"><span class="s">${esc(p.series)}${p.vol ? ' · ' + p.vol : ''}</span>${esc(new Date(p.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</div>
        <div><h3><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h3>
        <p>${esc(p.excerpt)}</p>
        <div class="tags">${p.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div></div>
      </li>`).join('') : '<li class="empty">Nothing matches that yet.</li>';
  };
  $$('#series-filters .chip').forEach((chip) => chip.addEventListener('click', () => {
    $$('#series-filters .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    series = chip.dataset.filter;
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
  table: (b) => `<div class="table-wrap"><table><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="first"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
  cards: (b) => `<div class="pb-cards">${b.items.map((c) => `<div class="pb-card"><b>${esc(c.title)}</b><p>${esc(c.text)}</p></div>`).join('')}</div>`,
  steps: (b) => `<ol class="pb-steps${b.variant === 'loop' ? ' loop' : ''}">${b.items.map((st, i) => `<li><span class="sn mono">${String(i + 1).padStart(2, '0')}</span><b>${esc(st.title)}</b><p>${esc(st.text)}</p></li>`).join('')}</ol>`,
  layers: (b) => `<div class="pb-layers">${b.items.map((l, i) => `
    <div class="layer${i === 0 ? '' : ''}"><button class="layer-btn" aria-expanded="false"><span class="mono">${esc(l.n)}</span><b>${esc(l.title)}</b><span class="owner">${esc(l.owner)}</span></button>
    <div class="layer-body"><div><p>${esc(l.text)}</p></div></div></div>`).join('')}</div>`,
  tiers: (b) => `<div class="pb-tiers" data-tiers='${esc(JSON.stringify(b.items))}'>
    <div class="tier-tabs" role="tablist">${b.items.map((t, i) => `<button role="tab" class="tier-tab" aria-selected="${i === 0}" data-i="${i}"><span class="mono">${esc(t.n)}</span>${esc(t.title)}</button>`).join('')}</div>
    <div class="tier-scale" aria-hidden="true"><span>More reversible</span><i></i><span>Higher consequence</span></div>
    <div class="tier-panel" role="tabpanel"></div></div>`,
  timeline: (b) => `<ol class="pb-timeline">${b.items.map((t) => `<li><span class="when mono">${esc(t.when)}</span><div><b>${esc(t.title)}</b><p>${esc(t.text)}</p>${t.out ? `<p class="out"><span class="mono">Deliverable</span> ${esc(t.out)}</p>` : ''}</div></li>`).join('')}</ol>`,
};

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
  host.addEventListener('click', (e) => {
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
function buildCard(b) {
  const live = b.url !== b.repo;
  return `<article class="card build reveal"><span class="kicker mono">${esc(b.tag)}</span>
    <h3><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a></h3><p>${esc(b.text)}</p>
    <div class="build-links">${live ? `<a href="${esc(b.url)}" target="_blank" rel="noopener">Live site ↗</a>` : ''}<a href="${esc(b.repo)}" target="_blank" rel="noopener">Code ↗</a></div></article>`;
}
function renderBuilds(p) {
  const el = $('#builds-grid');
  if (el && p.builds) el.innerHTML = p.builds.map(buildCard).join('');
}

/* ---------- Research page ---------- */
function pubRow(p, label) {
  const title = p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title);
  const meta = [label, p.coFirst ? 'co-first author' : '', p.cites ? `${p.cites} citations` : ''].filter(Boolean).join(' · ');
  return `<li class="pub"><span class="yr">${esc(p.year)}</span><div><b>${title}</b><span>${esc(meta)}</span></div><span class="venue">${esc(p.venue)}</span></li>`;
}

function renderResearch(pubs) {
  const list = $('#pubs');
  if (!list) return;
  $('#pub-stats').textContent = `${pubs.stats.citations} citations · h-index ${pubs.stats.hIndex} · i10-index ${pubs.stats.i10} · Google Scholar, ${pubs.stats.asOf}`;
  const groups = [
    ['Peer-reviewed', pubs.papers, 'Journal'],
    ['Preprints', pubs.preprints, 'Preprint'],
    ['Book chapters', pubs.chapters, 'Chapter'],
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
  $('#code').innerHTML = pubs.code.map(buildCard).join('');
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
}

/* ---------- Contact email (assembled at runtime to deter scrapers) ---------- */
function wireEmail(p) {
  $$('[data-email]').forEach((a) => {
    a.href = `mailto:${p.email}`;
    if (a.dataset.email === 'show') a.textContent = p.email;
  });
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
    if (PAGE === 'research') renderResearch(await getJSON('publications.json'));
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
