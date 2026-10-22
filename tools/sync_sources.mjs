// Pulls fresh numbers and posts into assets/data/ from public sources.
// No dependencies; Node 22+.
//
//   node sync_sources.mjs scholar            # citation stats + per-paper counts
//   node sync_sources.mjs linkedin [url...]  # add LinkedIn posts (args or inbox)
//   node sync_sources.mjs all                # both
//
// Add --dry to print what would change without writing.
//
// Google Scholar: parses the public profile page. If Scholar blocks the
// request (captcha), counts are left alone and Semantic Scholar is used only
// to spot papers the site does not list yet.
//
// LinkedIn: there is no way to list a profile's posts without signing in, so
// new posts come from links. Paste post URLs, one per line, into
// tools/inbox/linkedin.txt (or pass them as arguments). Each public post page
// is read for its headline, date, text and hashtags. Series posts get a topic
// from their title. A post outside the three series is added only when its
// line names a topic after the link, as in "<url> | Agents & software", so a
// person decides what standalone posts appear. Processed links are removed
// from the inbox; the rest stay there with a note.
//
// Writes assets/data/site.json with the dates shown on the site, and prints a
// JSON report on the last line of stdout for whoever runs it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'assets/data');
const INBOX = path.join(ROOT, 'tools/inbox/linkedin.txt');
const IGNORE = path.join(ROOT, 'tools/inbox/scholar-ignore.txt');
const SCHOLAR_ID = 'xIx9ENcAAAAJ';
const S2_AUTHOR = '114955765';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const [cmd = 'all', ...rest] = args.filter((a) => a !== '--dry');
const report = { scholar: null, linkedin: null };
const today = new Date().toISOString().slice(0, 10);
// site.json drives the "Last updated" line in the footer and the "as of" dates.
const SITE = path.join(DATA, 'site.json');
const site = fs.existsSync(SITE) ? JSON.parse(fs.readFileSync(SITE, 'utf8')) : {};
let changed = false;

const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const write = (f, obj, indent) => { if (!DRY) fs.writeFileSync(path.join(DATA, f), `${JSON.stringify(obj, null, indent)}\n`); };
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const strip = (s) => unescape(s.replace(/<[^>]+>/g, '')).trim();
const norm = (s) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// curl rather than fetch: Scholar turns away Node's fetch but serves curl.
async function get(url) {
  const raw = execFileSync('curl', ['-sSL', '-m', '30', '-A', UA, '-H', 'Accept-Language: en-US,en;q=0.9', '-w', '\n%{http_code}', url],
    { encoding: 'utf8', maxBuffer: 32 << 20 });
  const cut = raw.lastIndexOf('\n');
  return { status: Number(raw.slice(cut + 1)), text: raw.slice(0, cut) };
}

// Same paper if the normalized titles match, or one is a prefix of the other
// (Scholar truncates long titles), or they share almost all their words.
function sameTitle(a, b) {
  const x = norm(a); const y = norm(b);
  if (x === y || (Math.min(x.length, y.length) > 40 && (x.startsWith(y) || y.startsWith(x)))) return true;
  const A = new Set(x.split(' ')); const B = new Set(y.split(' '));
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.max(A.size, B.size) >= 0.85;
}

// ---------- Google Scholar ----------

function parseScholar(html) {
  const std = [...html.matchAll(/<td class="gsc_rsb_std">(\d+)<\/td>/g)].map((m) => Number(m[1]));
  if (std.length < 6) return null;
  const rows = [...html.matchAll(/<tr class="gsc_a_tr">([\s\S]*?)<\/tr>/g)].map(([, r]) => {
    const title = strip((r.match(/class="gsc_a_at"[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '');
    const grays = [...r.matchAll(/<div class="gs_gray">([\s\S]*?)<\/div>/g)].map((m) => strip(m[1]));
    const cites = Number(strip((r.match(/class="gsc_a_ac[^"]*"[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '')) || 0;
    const year = Number(strip((r.match(/class="gsc_a_h gsc_a_hc[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '')) || null;
    const link = unescape((r.match(/href="(\/citations\?view_op=view_citation[^"]+)"/) || [])[1] || '');
    return { title, authors: grays[0] || '', venue: (grays[1] || '').replace(/,\s*\d{4}$/, ''), year, cites, link: link && `https://scholar.google.com${link}` };
  }).filter((r) => r.title);
  return { citations: std[0], hIndex: std[2], i10: std[4], rows };
}

async function scholar() {
  const pubs = read('publications.json');
  const listed = ['papers', 'preprints', 'chapters', 'patents', 'theses', 'other'].flatMap((k) => (pubs[k] || []).map((p) => ({ list: k, p })));
  const out = { source: 'Google Scholar', statsChanged: false, citesChanged: [], newOnScholar: [] };
  // Scholar items left off the site on purpose (thesis, reviews, other authors' merges).
  const ignored = fs.existsSync(IGNORE) ? fs.readFileSync(IGNORE, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
  const isIgnored = (t) => ignored.some((i) => sameTitle(i, t));

  let page = null;
  try {
    const res = await get(`https://scholar.google.com/citations?user=${SCHOLAR_ID}&hl=en&cstart=0&pagesize=100`);
    if (res.status === 200 && !/captcha|unusual traffic/i.test(res.text)) page = parseScholar(res.text);
    if (!page) out.blocked = `HTTP ${res.status}`;
  } catch (e) { out.blocked = e.message; }

  if (page) {
    const asOf = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const stats = { citations: String(page.citations), hIndex: page.hIndex, i10: page.i10, asOf };
    if (['citations', 'hIndex', 'i10'].some((k) => String(pubs.stats[k]) !== String(stats[k]))) {
      out.statsChanged = { from: { ...pubs.stats }, to: stats };
      pubs.stats = stats;
    }
    for (const row of page.rows) {
      const hit = listed.find(({ p }) => sameTitle(p.title, row.title));
      if (!hit) { if (!isIgnored(row.title)) out.newOnScholar.push(row); continue; }
      if (row.cites && row.cites !== hit.p.cites) {
        out.citesChanged.push({ title: hit.p.title, from: hit.p.cites ?? 0, to: row.cites });
        hit.p.cites = row.cites;
      }
    }
    if (out.statsChanged || out.citesChanged.length) { write('publications.json', pubs, 2); changed = true; }
    site.scholar = today;
  } else {
    // Scholar blocked: only look for papers the site is missing; leave counts alone.
    out.source = 'Semantic Scholar (Scholar blocked; counts not changed)';
    try {
      const res = await get(`https://api.semanticscholar.org/graph/v1/author/${S2_AUTHOR}/papers?fields=title,year,venue,externalIds,citationCount&limit=200`);
      const data = JSON.parse(res.text).data || [];
      out.newOnScholar = data.filter((d) => d.title && !isIgnored(d.title) && !listed.some(({ p }) => sameTitle(p.title, d.title)))
        .map((d) => ({ title: d.title, year: d.year, venue: d.venue, doi: d.externalIds?.DOI || null, cites: d.citationCount }));
    } catch (e) { out.fallbackError = e.message; }
  }
  report.scholar = out;
}

// ---------- LinkedIn ----------

const SERIES = [
  { name: 'Lab Series', re: /^lab\s*(\d+)?\s*[:|–-]\s*(.+)$/i },
  { name: 'The Human Loop', re: /^the human loop\s*\|?\s*(?:vol\.?\s*(\d+))?\s*[:|–-]?\s*(.+)$/i },
  { name: 'Digital Iron', re: /^digital iron\s*\|?\s*(?:vol\.?\s*(\d+))?\s*[:|–-]?\s*(.+)$/i },
];

const THEMES = ['Models & inference', 'Agents & software', 'Physical AI', 'AI & work'];

function guessTheme(post) {
  if (post.series === 'Digital Iron' || /physical world|digital twin|omniverse|robot/i.test(post.title)) return 'Physical AI';
  if (/agent|harness|orchestration|middleware|spec-driven|determinism|mainframe|evals|codebase/i.test(post.title) && post.title !== 'The Agentic Manager') return 'Agents & software';
  if (post.series === 'Lab Series') return 'Models & inference';
  return 'AI & work';
}

const activityId = (url) => (decodeURIComponent(url).match(/(?:activity|share|ugcPost)[:-](\d{15,})/) || [])[1] || null;

function excerpt(body) {
  const text = body.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
  if (text.length <= 240) return text;
  return `${text.slice(0, 240).replace(/\s+\S*$/, '')}…`;
}

async function readPost(url) {
  const res = await get(url);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const ld = [...res.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
    .find((j) => j && j.articleBody);
  if (!ld) throw new Error('no public post data (deleted, private or sign-in wall)');
  const author = ld.author?.name || '';
  if (!/mohapatra/i.test(author)) throw new Error(`post is by ${author || 'someone else'}`);
  const body = ld.articleBody.normalize('NFKC');
  const [first, ...restLines] = body.split('\n');
  const headline = first.trim();
  let series = null; let vol = null; let title = headline;
  for (const s of SERIES) {
    const m = headline.match(s.re);
    if (m) { series = s.name; vol = m[1] ? Number(m[1]) : null; title = m[2].trim(); break; }
  }
  const tags = [...new Set([...body.matchAll(/#(\w+)/g)].map((m) => m[1].toLowerCase()))].sort().slice(0, 5);
  return {
    series, vol, title,
    date: (ld.datePublished || '').slice(0, 10),
    url: url.startsWith('https://www.linkedin.com/feed/update/') ? url : (ld.url || url),
    excerpt: excerpt(restLines.join(' ')),
    tags,
  };
}

async function linkedin() {
  const out = { added: [], skipped: [], failed: [] };
  const fromInbox = fs.existsSync(INBOX)
    ? fs.readFileSync(INBOX, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/)[0])
    : [];
  // A topic written after the link ("<url> | Physical AI") lets a standalone post in.
  const chosen = new Map(fs.existsSync(INBOX)
    ? fs.readFileSync(INBOX, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
      .map((l) => [l.split(/\s+/)[0], (l.match(/\|\s*([^#]+?)\s*(?:#.*)?$/) || [])[1]])
    : []);
  const urls = [...new Set([...rest, ...fromInbox])];
  const posts = read('writing.json');
  const known = new Set(posts.map((p) => activityId(p.url)).filter(Boolean));
  const keep = [];

  for (const url of urls) {
    const id = activityId(url);
    if (id && known.has(id)) { out.skipped.push({ url, why: 'already on the site' }); continue; }
    try {
      const post = await readPost(url);
      if (known.has(activityId(post.url)) || posts.some((p) => p.date === post.date && sameTitle(p.title, post.title))) { out.skipped.push({ url, why: 'already on the site' }); continue; }
      const theme = THEMES.find((t) => t.toLowerCase() === (chosen.get(url) || '').toLowerCase());
      if (!post.series && !theme) {
        out.skipped.push({ url, why: `not one of the three series and no topic given: "${post.title.slice(0, 80)}"` });
        keep.push(`${url}  # not a series post; add " | <topic>" (${THEMES.join(', ')}) to publish it, or delete this line`);
        continue;
      }
      post.theme = theme || guessTheme(post);
      posts.push(post); known.add(activityId(post.url));
      out.added.push({ series: post.series, vol: post.vol, title: post.title, date: post.date, theme: post.theme });
    } catch (e) {
      out.failed.push({ url, why: e.message });
      keep.push(`${url}  # failed: ${e.message}`);
    }
  }

  if (out.added.length) {
    posts.sort((a, b) => b.date.localeCompare(a.date));
    write('writing.json', posts, 1);
    site.linkedin = today;
    changed = true;
  }
  if (!DRY && fs.existsSync(INBOX)) {
    const header = fs.readFileSync(INBOX, 'utf8').split('\n').filter((l) => l.startsWith('#'));
    fs.writeFileSync(INBOX, `${[...header, ...keep].join('\n')}\n`);
  }
  report.linkedin = out;
}

if (cmd === 'scholar' || cmd === 'all') await scholar();
if (cmd === 'linkedin' || cmd === 'all') await linkedin();
// "updated" moves when content changed or a source was read successfully, so
// the footer never claims freshness a run did not check.
if (changed || site.scholar === today) site.updated = today;
if (!DRY) fs.writeFileSync(SITE, `${JSON.stringify(site, null, 2)}\n`);
report.site = site;
console.log(JSON.stringify(report));
