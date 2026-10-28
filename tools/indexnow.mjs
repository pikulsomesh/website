// Tells Bing, Yandex, Seznam and Naver (the IndexNow engines) which pages changed in a push,
// so new writing is crawled within hours instead of days. Bing's index also feeds ChatGPT search,
// Copilot and DuckDuckGo. Google does not use IndexNow; it reads sitemap.xml.
//
// Usage: node tools/indexnow.mjs <before-sha> <after-sha>
// Runs in .github/workflows/indexnow.yml after each push to main. It waits until GitHub Pages
// serves the new sitemap, then submits the changed URLs. The key file at the site root proves
// the site owns the key; it is public by design.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://someshmohapatra.in/';
const KEY = '89f0e8f1b8cf86c46c3f58bd1daa97f6';
const [before, after = 'HEAD'] = process.argv.slice(2);

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const listed = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

const zero = !before || /^0+$/.test(before);
const changed = execFileSync('git', ['diff', '--name-only', zero ? `${after}~1` : before, after], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
const urls = changed.flatMap((f) => {
  if (f === 'index.html') return [SITE];
  if (f.endsWith('/index.html')) return [SITE + f.replace(/index\.html$/, '')];
  if (f === 'writing/feed.xml') return [SITE + f];
  return [];
}).filter((u) => listed.has(u) || u.endsWith('feed.xml'));

if (!urls.length) {
  console.log('No page changes to submit.');
  process.exit(0);
}

// GitHub Pages deploys a minute or two after the push. Submitting before then wastes the crawl.
const deadline = Date.now() + 10 * 60 * 1000;
for (;;) {
  const live = await fetch(`${SITE}sitemap.xml`, { cache: 'no-store' }).then((r) => r.text()).catch(() => '');
  if (live.trim() === sitemap.trim()) break;
  if (Date.now() > deadline) {
    console.error('The live sitemap still differs from this commit after 10 minutes; submitting anyway.');
    break;
  }
  await new Promise((r) => setTimeout(r, 20000));
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow ${res.status} for ${urls.length} URL(s):\n${urls.join('\n')}`);
// 200 and 202 are success. 422 means a URL is not on this host; 403 means the key file is not live yet.
if (![200, 202].includes(res.status)) process.exit(1);
