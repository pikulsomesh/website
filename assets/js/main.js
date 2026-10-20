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
function renderPlaybook(pb) {
  const list = $('#beliefs');
  if (!list) return;
  list.innerHTML = pb.beliefs.map((b, i) => `
    <li><button class="belief-btn" role="tab" aria-selected="${i === 0}" data-i="${i}">
      <span class="n">${String(i + 1).padStart(2, '0')}</span><strong>${esc(b.title)}</strong>
    </button></li>`).join('');
  const panel = $('#belief-panel');
  const show = (i) => {
    const b = pb.beliefs[i];
    $$('.belief-btn', list).forEach((btn) => btn.setAttribute('aria-selected', String(Number(btn.dataset.i) === i)));
    panel.innerHTML = `
      <span class="eyebrow">Belief ${String(i + 1).padStart(2, '0')}</span>
      <h3>${esc(b.title)}</h3>
      <p class="why">${esc(b.why)}</p>
      <div class="industries">${pb.industries.map((ind) => {
        const a = b.apply[ind.id];
        return `<div class="industry${a ? '' : ' off'}"><span class="name">${esc(ind.name)}</span><p>${a ? esc(a) : 'Not a lead theme here.'}</p></div>`;
      }).join('')}</div>`;
  };
  list.addEventListener('click', (e) => { const btn = e.target.closest('.belief-btn'); if (btn) show(Number(btn.dataset.i)); });
  list.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const btns = $$('.belief-btn', list);
    const cur = btns.indexOf(document.activeElement);
    const next = btns[(cur + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length];
    next.focus(); next.click();
  });
  const m = location.hash.match(/^#belief-(\d+)$/);
  show(m ? Math.min(Number(m[1]) - 1, pb.beliefs.length - 1) : 0);

  // Reference stack with cloud switcher
  const stack = $('#stack');
  if (!stack) return;
  const clouds = pb.stack.clouds;
  let cloud = clouds[0];
  const drawStack = () => {
    stack.querySelector('tbody').innerHTML = pb.stack.layers.map((l, i) => `
      <tr><td class="mono">L${i}</td><td><b>${esc(l.layer)}</b><span>${esc(l.desc)}</span></td><td class="svc">${esc(l[cloud])}</td></tr>`).join('');
  };
  $('#cloud-switch').innerHTML = clouds.map((c, i) => `<button class="chip" aria-pressed="${i === 0}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  $('#cloud-switch').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    cloud = b.dataset.c;
    $$('#cloud-switch .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    drawStack();
  });
  drawStack();
}

/* ---------- Research page ---------- */
function renderResearch(pubs) {
  const list = $('#pubs');
  if (!list) return;
  $('#pub-stats').textContent = `${pubs.stats.citations} citations · h-index ${pubs.stats.hIndex} · i10-index ${pubs.stats.i10} · Google Scholar, ${pubs.stats.asOf}`;
  const themes = ['All', ...new Set(pubs.items.map((p) => p.theme))];
  let theme = 'All';
  const draw = () => {
    list.innerHTML = pubs.items.filter((p) => theme === 'All' || p.theme === theme).map((p) => `
      <li class="pub"><span class="yr">${p.year}</span><div><b><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></b><span>${esc(p.theme)}${p.cites ? ` · ${p.cites} citations` : ''}</span></div><span class="venue">${esc(p.venue)}</span></li>`).join('');
  };
  $('#pub-filters').innerHTML = themes.map((t, i) => `<button class="chip" aria-pressed="${i === 0}" data-t="${esc(t)}">${esc(t)}</button>`).join('');
  $('#pub-filters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    theme = b.dataset.t;
    $$('#pub-filters .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    draw();
  });
  draw();
  $('#patents').innerHTML = pubs.patents.map((p) => `<li class="pub"><span class="yr">Patent</span><div><b><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></b><span>${esc(p.number)}</span></div><span class="venue">USPTO</span></li>`).join('');
  $('#code').innerHTML = pubs.code.map((c) => `<article class="card"><span class="kicker mono">Open source</span><h3><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a></h3><p>${esc(c.text)}</p></article>`).join('');
  $('#talk-list').innerHTML = pubs.talks.map((t) => `<li class="pub"><span class="yr">${t.year}</span><div><b>${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.title)}</a>` : esc(t.title)}</b></div><span class="venue">${esc(t.venue)}</span></li>`).join('');
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
  t.scrollIntoView({ block: 'start' });
}

/* ---------- Boot ---------- */
async function boot() {
  try {
    if (['home', 'resume'].includes(PAGE) || $('[data-email]')) {
      const profile = await getJSON('profile.json');
      renderProof(profile); renderTimeline(profile); renderPillars(profile);
      renderWork(profile); renderRecognition(profile); renderResume(profile); wireEmail(profile);
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
