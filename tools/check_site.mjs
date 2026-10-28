// Static checks with no dependencies: every data file parses, every local
// href/src in the HTML points at a file that exists, and embeddings match the model.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (msg) => { failures++; console.error(`✗ ${msg}`); };

for (const f of fs.readdirSync(path.join(ROOT, 'assets/data'))) {
  if (!f.endsWith('.json')) continue;
  try { JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data', f), 'utf8')); }
  catch (e) { fail(`assets/data/${f}: ${e.message}`); }
}

const emb = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/embeddings.json'), 'utf8'));
const bad = emb.entries.filter((e) => e.vector && e.vector.length !== 384);
if (bad.length) fail(`embeddings.json: ${bad.length} vectors are not 384-d`);
for (const f of ['assets/models/minilm/model_quantized.onnx', 'assets/models/minilm/vocab.txt', 'CNAME']) {
  if (!fs.existsSync(path.join(ROOT, f))) fail(`missing ${f}`);
}

// Every index.html in the site, including generated writing pages a few folders deep.
const SKIP = new Set(['.git', '.github', 'assets', 'content', 'node_modules', 'tools']);
const findPages = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !SKIP.has(d.name))
  .flatMap((d) => {
    const sub = dir ? `${dir}/${d.name}` : d.name;
    return [...(fs.existsSync(path.join(ROOT, sub, 'index.html')) ? [`${sub}/index.html`] : []), ...findPages(sub)];
  });
const pages = ['index.html', '404.html', ...findPages('')];
for (const page of pages) {
  const file = path.join(ROOT, page);
  if (!fs.existsSync(file)) { fail(`missing ${page}`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|#|data:)/.test(url)) continue;
    const clean = url.split('#')[0].split('?')[0];
    if (!clean) continue;
    let target = clean.startsWith('/') ? path.join(ROOT, clean) : path.resolve(path.dirname(file), clean);
    if (clean.endsWith('/')) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) fail(`${page}: broken link ${url}`);
  }
}

// Structured data, crawler fallbacks, sitemap and llms.txt are generated from the data files.
try { execFileSync('node', [path.join(ROOT, 'tools/build_seo.mjs'), '--check'], { stdio: 'inherit' }); }
catch { fail('SEO files are stale; run node tools/build_seo.mjs and commit the result'); }

if (failures) { console.error(`\n${failures} problem(s)`); process.exit(1); }
console.log(`✓ ${pages.length} pages, data files and model assets look good`);
