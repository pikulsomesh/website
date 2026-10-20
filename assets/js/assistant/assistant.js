// "Ask About Somesh": a client-side semantic search palette.
// all-MiniLM-L6-v2 (int8 ONNX, ~22.6M params) runs in the browser through
// onnxruntime-web; queries are embedded with the vanilla WordPiece tokenizer,
// mean-pooled, L2-normalized and ranked by cosine similarity against
// assets/data/embeddings.json. Keyword search answers until the model is ready.

import { WordPieceTokenizer } from './tokenizer.js';

const ORT_VERSION = '1.20.1';
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const MAX_TOKENS = 128;
const SUGGESTIONS = [
  'Digital twins at Caterpillar',
  'How does he think about AI governance?',
  'GenAI that saved money',
  'Nature Chemistry papers',
  'Startup experience',
  'Google Scholar',
];
const PLACEHOLDERS = [
  'What has Somesh built with digital twins?',
  'How would he structure an AI organization?',
  'Where did he publish his research?',
  'Has he run a P&L?',
];

let root = './';
let index = null;           // { dim, entries: [{ id, title, kind, url, text, vector? }] }
let semantic = null;        // { session, tokenizer } once loaded
let loadingSemantic = null;
let els = {};
let results = [];
let active = 0;

/* ---------- Data ---------- */
async function loadIndex() {
  if (index) return index;
  const res = await fetch(`${root}assets/data/embeddings.json`);
  index = await res.json();
  index.entries.forEach((e) => {
    e.haystack = `${e.title} ${e.kind} ${e.text}`.toLowerCase();
    if (e.vector) e.vec = Float32Array.from(e.vector);
  });
  index.hasVectors = index.entries.some((e) => e.vec);
  return index;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.ort) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = resolve; s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total) onProgress(Math.min(got / total, 0.99));
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  onProgress(1);
  return out;
}

function loadSemantic() {
  if (loadingSemantic) return loadingSemantic;
  setStatus('loading', 'Loading on-device model… 0%', 0);
  loadingSemantic = (async () => {
    const modelDir = `${root}assets/models/minilm/`;
    const [, tokenizer, modelBytes] = await Promise.all([
      loadScript(`${ORT_BASE}ort.min.js`),
      WordPieceTokenizer.fromUrl(`${modelDir}vocab.txt`),
      fetchWithProgress(`${modelDir}model_quantized.onnx`, (f) =>
        setStatus('loading', `Loading on-device model… ${Math.round(f * 100)}%`, f)),
    ]);
    const ort = window.ort;
    ort.env.wasm.wasmPaths = ORT_BASE;
    ort.env.wasm.numThreads = 1; // GitHub Pages can't send COOP/COEP headers
    const session = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'] });
    semantic = { session, tokenizer, ort };
    setStatus('ready', 'On-device model ready · nothing you type leaves your browser', 1);
    if (els.input.value.trim()) search(els.input.value);
    return semantic;
  })().catch((err) => {
    console.error(err);
    setStatus('error', 'Semantic model unavailable · using keyword search', 0);
    loadingSemantic = null;
  });
  return loadingSemantic;
}

/* ---------- Embedding + ranking ---------- */
async function embed(text) {
  const { session, tokenizer, ort } = semantic;
  const enc = tokenizer.encode(text, MAX_TOKENS);
  const n = enc.tokens.length;
  const feeds = {
    input_ids: new ort.Tensor('int64', enc.inputIds, [1, n]),
    attention_mask: new ort.Tensor('int64', enc.attentionMask, [1, n]),
  };
  if (session.inputNames.includes('token_type_ids')) {
    feeds.token_type_ids = new ort.Tensor('int64', enc.tokenTypeIds, [1, n]);
  }
  const out = await session.run(feeds);
  const hidden = out.last_hidden_state || out[session.outputNames[0]];
  const dim = hidden.dims[2];
  const data = hidden.data;
  const v = new Float32Array(dim);
  for (let t = 0; t < n; t++) for (let d = 0; d < dim; d++) v[d] += data[t * dim + d];
  let norm = 0;
  for (let d = 0; d < dim; d++) { v[d] /= n; norm += v[d] * v[d]; }
  norm = Math.sqrt(norm) || 1;
  for (let d = 0; d < dim; d++) v[d] /= norm;
  return v;
}

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // both vectors are unit length
}

const STOP = new Set('a an and are about at be by can did do does for from has have he him his how i in is it me of on or so that the their them this to was what when where which who why with you your somesh mohapatra'.split(' '));

function keywordScore(entry, terms) {
  if (!terms.length) return 0;
  let s = 0;
  for (const t of terms) {
    if (entry.title.toLowerCase().includes(t)) s += 2;
    if (entry.haystack.includes(t)) s += 1;
  }
  return s / (terms.length * 3);
}

let searchSeq = 0;
async function search(q) {
  const seq = ++searchSeq;
  const query = q.trim();
  if (!query) { results = []; draw(); return; }
  await loadIndex();
  const terms = query.toLowerCase().split(/[^a-z0-9$%+.]+/).filter((t) => t.length > 1 && !STOP.has(t));
  let scored;
  if (semantic && index.hasVectors) {
    const qv = await embed(query);
    if (seq !== searchSeq) return;
    scored = index.entries.filter((e) => e.vec).map((e) => ({
      e, score: cosine(qv, e.vec) + 0.08 * keywordScore(e, terms),
    }));
  } else {
    scored = index.entries.map((e) => ({ e, score: keywordScore(e, terms) })).filter((r) => r.score > 0);
  }
  // Keep one result per destination so the list stays useful.
  const seen = new Set();
  results = scored.sort((a, b) => b.score - a.score)
    .filter((r) => (seen.has(r.e.url) ? false : seen.add(r.e.url)))
    .slice(0, 7);
  active = 0;
  if (seq === searchSeq) draw();
}

/* ---------- UI ---------- */
const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function hrefFor(url) {
  return /^https?:/.test(url) ? url : `${root}${url}`;
}

function draw() {
  const { list, suggest } = els;
  suggest.hidden = results.length > 0 || !!els.input.value.trim();
  if (!results.length) {
    list.innerHTML = els.input.value.trim()
      ? '<li class="empty" style="padding:14px">No close match. Try “digital twins”, “research” or “leadership”.</li>'
      : '';
    return;
  }
  const showScore = semantic && index.hasVectors;
  list.innerHTML = results.map((r, i) => {
    const ext = /^https?:/.test(r.e.url);
    return `<li role="option" aria-selected="${i === active}"><a href="${esc(hrefFor(r.e.url))}" ${ext ? 'target="_blank" rel="noopener"' : ''} aria-selected="${i === active}" data-i="${i}">
      <span class="t">${esc(r.e.title)}</span>
      <span class="k">${esc(r.e.kind)}${showScore ? ` · <span class="score">${(r.score * 100).toFixed(0)}</span>` : ''}</span>
      <span class="d">${esc(r.e.text)}</span></a></li>`;
  }).join('');
}

function setStatus(state, text, frac) {
  if (!els.status) return;
  els.status.dataset.state = state;
  els.statusText.textContent = text;
  els.bar.style.width = `${Math.round((frac || 0) * 100)}%`;
  els.bar.parentElement.hidden = state !== 'loading';
}

function buildDialog() {
  const d = document.createElement('dialog');
  d.className = 'ask-dialog';
  d.setAttribute('aria-label', 'Ask about Somesh');
  d.innerHTML = `
    <div class="ask-top">${ICON_SEARCH}
      <input type="text" enterkeyhint="search" placeholder="Ask about Somesh…" aria-label="Ask about Somesh" autocomplete="off" spellcheck="false">
      <button class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="ask-status" data-state="idle" aria-live="polite"><span class="dot"></span><span class="txt">Keyword search ready</span><span class="bar" hidden><i></i></span></div>
    <ul class="ask-results" role="listbox"></ul>
    <div class="ask-suggest">${SUGGESTIONS.map((s) => `<button class="chip" type="button">${esc(s)}</button>`).join('')}</div>
    <div class="ask-foot"><span>Runs entirely in your browser · MiniLM-L6 via ONNX</span><span class="keys"><kbd class="kbd">↑↓</kbd> move <kbd class="kbd">↵</kbd> open <kbd class="kbd">esc</kbd> close</span></div>`;
  document.body.appendChild(d);
  els = {
    dialog: d,
    input: d.querySelector('input'),
    list: d.querySelector('.ask-results'),
    suggest: d.querySelector('.ask-suggest'),
    status: d.querySelector('.ask-status'),
    statusText: d.querySelector('.ask-status .txt'),
    bar: d.querySelector('.ask-status .bar i'),
  };

  let timer;
  els.input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => search(els.input.value), semantic ? 120 : 60);
  });
  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      draw();
      els.list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      els.list.querySelector(`a[data-i="${active}"]`).click();
    }
  });
  els.suggest.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    els.input.value = b.textContent;
    search(b.textContent);
    els.input.focus();
  });
  els.list.addEventListener('click', (e) => { if (e.target.closest('a') && !e.target.closest('a[target]')) close(); });
  d.querySelector('[data-close]').addEventListener('click', close);
  d.addEventListener('click', (e) => { if (e.target === d) close(); });
}

function open(prefill = '') {
  if (!els.dialog) buildDialog();
  if (!els.dialog.open) els.dialog.showModal();
  els.input.value = prefill;
  els.input.focus();
  loadIndex().then(() => {
    if (index.hasVectors) loadSemantic();
    else setStatus('idle', 'Keyword search · run tools/build_embeddings.mjs to enable the on-device model', 0);
    search(els.input.value);
  });
}

function close() { els.dialog?.close(); }

function typePlaceholders() {
  const el = document.querySelector('.ask-hero .typed');
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let p = 0; let c = 0; let del = false;
  const tick = () => {
    const word = PLACEHOLDERS[p];
    c += del ? -1 : 1;
    el.textContent = word.slice(0, c);
    let wait = del ? 28 : 55;
    if (!del && c === word.length) { del = true; wait = 2200; }
    else if (del && c === 0) { del = false; p = (p + 1) % PLACEHOLDERS.length; wait = 400; }
    setTimeout(tick, wait);
  };
  setTimeout(tick, 1200);
}

export function init(opts = {}) {
  root = opts.root || './';
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-ask]');
    if (t) { e.preventDefault(); open(); }
  });
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      open();
    }
  });
  // Warm the small index in the background; the model waits for intent.
  (window.requestIdleCallback || setTimeout)(() => loadIndex().catch(() => {}));
  typePlaceholders();
}
