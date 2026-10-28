// Regenerates the search and answer-engine files from assets/data/*.json:
//   - JSON-LD and crawler-readable HTML between <!-- build:NAME --> markers in the pages
//   - sitemap.xml, llms.txt and llms-full.txt
//   - writing/feed.xml, the Atom feed of long-form writing
// No dependencies. Run `node tools/build_seo.mjs` after editing the data files;
// `--check` exits non-zero when the committed files are out of date.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadWriting, writingPages, seriesCardsHTML, essaysHTML, writingText, GENERATED, SERIES_NAME } from './lib/writing.mjs';
import { atomFeed, FEED_PATH } from './lib/feed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://someshmohapatra.in/';
const CHECK = process.argv.includes('--check');

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const data = (f) => JSON.parse(read(`assets/data/${f}`));
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const profile = data('profile.json');
const pubs = data('publications.json');
const playbook = data('playbook.json');
const posts = data('writing.json');
const faq = data('faq.json').items;
const longform = loadWriting(ROOT);

const PERSON_ID = `${SITE}#person`;
const IMAGE = `${SITE}assets/img/og.jpg`;
const PAGES = [
  { path: '', file: 'index.html', data: ['profile.json', 'writing.json', 'faq.json'] },
  { path: 'playbook/', file: 'playbook/index.html', data: ['playbook.json'] },
  { path: 'research/', file: 'research/index.html', data: ['publications.json'] },
  { path: 'writing/', file: 'writing/index.html', data: ['writing.json', 'content/writing'] },
  { path: 'resume/', file: 'resume/index.html', data: ['profile.json'] },
];

/* ---------- Structured data ---------- */
const person = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: profile.name,
  honorificSuffix: profile.credentials,
  url: SITE,
  image: `${SITE}assets/img/headshot.jpg`,
  jobTitle: 'Director, Analytics',
  description: 'AI, data science and product leader. Director of Analytics at Caterpillar Inc.; MIT PhD in machine learning for molecular design and MIT Sloan MBA.',
  worksFor: { '@type': 'Organization', name: 'Caterpillar Inc.', url: 'https://www.caterpillar.com/' },
  homeLocation: { '@type': 'Place', name: profile.location, address: { '@type': 'PostalAddress', addressLocality: 'Dallas–Fort Worth', addressRegion: 'TX', addressCountry: 'US' } },
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: 'Massachusetts Institute of Technology', sameAs: 'https://en.wikipedia.org/wiki/Massachusetts_Institute_of_Technology' },
    { '@type': 'CollegeOrUniversity', name: 'MIT Sloan School of Management', sameAs: 'https://en.wikipedia.org/wiki/MIT_Sloan_School_of_Management' },
    { '@type': 'CollegeOrUniversity', name: 'Indian Institute of Technology Roorkee', sameAs: 'https://en.wikipedia.org/wiki/IIT_Roorkee' },
  ],
  hasCredential: [
    { '@type': 'EducationalOccupationalCredential', credentialCategory: 'degree', name: 'PhD, Machine Learning for Molecular Design', recognizedBy: { '@type': 'CollegeOrUniversity', name: 'Massachusetts Institute of Technology' } },
    { '@type': 'EducationalOccupationalCredential', credentialCategory: 'degree', name: 'MBA, Leaders for Global Operations', recognizedBy: { '@type': 'CollegeOrUniversity', name: 'MIT Sloan School of Management' } },
    { '@type': 'EducationalOccupationalCredential', credentialCategory: 'degree', name: 'B.Tech', recognizedBy: { '@type': 'CollegeOrUniversity', name: 'Indian Institute of Technology Roorkee' } },
    ...profile.certifications.map((name) => ({ '@type': 'EducationalOccupationalCredential', credentialCategory: 'certification', name })),
  ],
  award: profile.recognition.filter((r) => /award|medal/i.test(r.title)).map((r) => `${r.title} (${r.year})`),
  knowsAbout: ['Artificial intelligence', 'Industrial AI', 'Digital twins', 'Agentic AI', 'Generative AI', 'Retrieval-augmented generation', 'Data science', 'Machine learning', 'Manufacturing analytics', 'Supply chain analytics', 'Product management', 'Molecular design', 'Graph neural networks'],
  knowsLanguage: ['English', 'Hindi', 'Odia', 'Bengali'],
  sameAs: [profile.links.linkedin, profile.links.scholar, profile.links.github, 'https://gomezbombarelli.mit.edu/someshm/'],
};

const website = { '@type': 'WebSite', '@id': `${SITE}#website`, url: SITE, name: 'Somesh Mohapatra', inLanguage: 'en', publisher: { '@id': PERSON_ID } };

const crumbs = (name, p) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
    { '@type': 'ListItem', position: 2, name, item: SITE + p },
  ],
});

const article = (p) => ({
  '@type': 'ScholarlyArticle',
  headline: p.title,
  datePublished: String(p.year),
  ...(p.venue ? { isPartOf: { '@type': 'Periodical', name: p.venue } } : {}),
  ...(p.url && !p.url.includes('scholar.google') ? { url: p.url } : {}),
  author: { '@id': PERSON_ID },
});

function jsonld(page, modified) {
  const graph = [];
  const web = (type, name, extra = {}) => ({ '@type': type, '@id': `${SITE + page.path}#webpage`, url: SITE + page.path, name, isPartOf: { '@id': `${SITE}#website` }, inLanguage: 'en', dateModified: modified, ...extra });
  if (page.path === '') {
    graph.push(web('ProfilePage', 'Somesh Mohapatra, PhD, MBA', { mainEntity: { '@id': PERSON_ID }, about: { '@id': PERSON_ID }, primaryImageOfPage: IMAGE }), website, person, {
      '@type': 'FAQPage',
      '@id': `${SITE}#faq`,
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  } else if (page.path === 'playbook/') {
    graph.push(web('WebPage', 'Playbook'), {
      '@type': 'Article',
      '@id': `${SITE}playbook/#article`,
      headline: 'How I think about data and AI at scale',
      description: playbook.thesis,
      image: IMAGE,
      author: { '@id': PERSON_ID },
      publisher: { '@id': PERSON_ID },
      dateModified: modified,
      mainEntityOfPage: { '@id': `${SITE}playbook/#webpage` },
      articleSection: playbook.chapters.map((c) => c.title),
    }, crumbs('Playbook', page.path));
  } else if (page.path === 'research/') {
    graph.push(web('CollectionPage', 'Research and publications', {
      about: { '@id': PERSON_ID },
      hasPart: [...pubs.papers, ...pubs.preprints, ...pubs.chapters].map(article),
    }), crumbs('Research', page.path));
  } else if (page.path === 'writing/') {
    graph.push(web('CollectionPage', 'Writing', {
      about: { '@id': PERSON_ID },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: longform.pages.length + posts.length,
        itemListElement: [...longform.pages.map((p) => ({ url: SITE + p.path, name: p.kind === 'part' ? `${p.series.title}, part ${p.n}: ${p.title}` : p.title })), ...posts.map((p) => ({ url: p.url, name: p.title }))]
          .map((x, i) => ({ '@type': 'ListItem', position: i + 1, ...x })),
      },
    }), crumbs('Writing', page.path));
  } else if (page.path === 'resume/') {
    graph.push(web('WebPage', 'Resume', { about: { '@id': PERSON_ID }, mainEntity: { '@id': PERSON_ID } }), person, crumbs('Resume', page.path));
  }
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return `\n  <script type="application/ld+json">${json}</script>\n  `;
}


/* Playbook blocks reduced to plain items, shared by the HTML fallback and llms-full.txt. */
const blockItems = (b) => [...(b.items || []), ...(b.spans || [])].map((x) => (typeof x === 'string' ? { text: x } : {
  title: [x.n || x.when, x.title].filter(Boolean).join(' · '),
  text: [x.text, x.owner && `Owner: ${x.owner}`, x.risk, x.may && `May: ${x.may}`, x.control && `Control: ${x.control}`, x.evidence && `Evidence to launch: ${x.evidence}`, x.out && `Deliverable: ${x.out}`, x.eg && `Typically: ${x.eg}`].filter(Boolean).join(' '),
}));
const blockHTML = (b) => {
  if (b.type === 'h') return `<h3 class="pb-h">${esc(b.text)}</h3>`;
  if (b.type === 'p') return `<p>${esc(b.text)}</p>`;
  if (b.type === 'callout') return `<blockquote class="pb-callout">${esc(b.text)}</blockquote>`;
  if (b.type === 'source') return `<p class="cloud-note pb-source">${esc(b.text)} <a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.label)} ↗</a></p>`;
  if (b.type === 'table') return `<div class="table-wrap"><table><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<ul class="pb-list">${blockItems(b).map((x) => `<li>${x.title ? `<b>${esc(x.title)}</b> ` : ''}${esc(x.text)}</li>`).join('')}</ul>`;
};
const blockText = (b) => {
  if (b.type === 'h') return `\n#### ${b.text}\n`;
  if (b.type === 'p' || b.type === 'callout') return `${b.text}\n`;
  if (b.type === 'source') return `${b.text} ${b.label}: ${b.url}\n`;
  if (b.type === 'table') return [b.head.join(' | '), ...b.rows.map((r) => r.join(' | '))].join('\n') + '\n';
  return blockItems(b).map((x) => `- ${[x.title, x.text].filter(Boolean).join(': ')}`).join('\n') + '\n';
};

/* ---------- Crawler-readable HTML (main.js re-renders these containers in the browser) ---------- */
const timelineHTML = () => profile.timeline.map((t, i) => `
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
    </li>`).join('') + '\n        ';

const faqHTML = () => faq.map((f) => `
          <details class="faq-item"><summary><h3>${esc(f.q)}</h3></summary><p>${esc(f.a)}</p></details>`).join('') + '\n        ';

const pubRow = (p, label) => {
  const title = p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title);
  const meta = [label || p.kind, p.coFirst ? 'co-first author' : '', p.cites ? `${p.cites} citations` : ''].filter(Boolean).join(' · ');
  return `<li class="pub"><span class="yr">${esc(p.year)}</span><div><b>${title}</b><span>${esc(meta)}</span></div><span class="venue">${esc(p.venue)}</span></li>`;
};
const rows = (items) => items.map((x) => `\n        ${x}`).join('') + '\n      ';

const resumeHTML = () => profile.timeline.map((t) => `
        <div class="job"><header><b>${esc(t.role)}</b><span>${esc(t.years)}</span></header>
        <div class="org">${esc(t.org)}</div>
        <ul>${t.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('') + '\n      ';

// Same markup as buildCard in assets/js/main.js.
const buildsHTML = () => rows(profile.builds.map((b) => `<article class="card build"><div class="build-top"><span class="kicker mono">${esc(b.theme)}</span><span class="build-status is-${esc(b.state)}">${esc(b.status)}</span></div><h3><a href="${esc(b.url || b.repo)}" target="_blank" rel="noopener">${esc(b.title)}</a></h3><p class="build-problem">${esc(b.problem)}</p><p>${esc(b.text)}</p><ul class="tags build-stack" aria-label="Stack">${b.stack.map((x) => `<li class="tag">${esc(x)}</li>`).join('')}</ul><div class="build-links">${b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener">Live site ↗</a>` : ''}<a href="${esc(b.repo)}" target="_blank" rel="noopener">Code ↗</a>${(b.links || []).map((l) => (l.url.startsWith('/') ? `<a href="${esc(l.url)}">${esc(l.label)} →</a>` : `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`)).join('')}</div></article>`));

const BLOCKS = {
  'index.html': { timeline: timelineHTML, faq: faqHTML, builds: buildsHTML },
  'research/index.html': {
    builds: buildsHTML,
    latest: () => rows((pubs.latest || []).map((p) => `<article class="card latest-pub"><span class="kicker mono">${esc(p.kind)} · ${esc(p.venue)} · ${esc(p.date)}</span><h3><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h3><p>${esc(p.text)}</p><div class="build-links"><a href="${esc(p.url)}" target="_blank" rel="noopener">Read the paper ↗</a>${(p.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</div></article>`)),
    pubs: () => rows(pubs.papers.map((p) => pubRow(p, 'Journal'))),
    talks: () => rows(pubs.talks.map((t) => `<li class="pub"><span class="yr">${esc(t.year)}</span><div><b>${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.title)}</a>` : esc(t.title)}</b><span>Invited</span></div><span class="venue">${esc(t.venue)}</span></li>`)),
    patents: () => rows(pubs.patents.map((p) => `<li class="pub"><span class="yr">Patent</span><div><b><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></b><span>${esc(p.number)}</span></div><span class="venue">USPTO</span></li>`)),
  },
  'resume/index.html': {
    jobs: resumeHTML,
    certs: () => rows(profile.certifications.map((c) => `<li>${esc(c)}</li>`)),
    recog: () => rows(profile.recognition.map((r) => `<li>${esc(r.year)} · <b>${esc(r.title)}</b>. ${esc(r.text)}</li>`)),
  },
  'writing/index.html': {
    series: () => seriesCardsHTML(longform),
    essays: () => essaysHTML(longform),
    posts: () => rows(posts.map((p) => `<li class="post"><div class="meta"><span class="s">${esc(p.theme || '')}</span>${esc(p.date)}${p.series ? `<span class="sr">${esc(p.series)}</span>` : ''}</div><div><h3><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h3><p>${esc(p.excerpt)}</p></div></li>`)),
  },
  'playbook/index.html': {
    thesis: () => esc(playbook.thesis),
    principles: () => rows(playbook.principles.map((x, i) => `<article class="principle"><span class="mono">${String(i + 1).padStart(2, '0')}</span><b>${esc(x.title)}</b><p>${esc(x.text)}</p></article>`)),
    toc: () => rows(playbook.chapters.map((c) => `<a href="#${esc(c.id)}"><span class="mono">${esc(c.num)}</span>${esc(c.title)}</a>`)),
    chapters: () => rows(playbook.chapters.map((c) => `<section class="chapter" id="${esc(c.id)}"><span class="eyebrow">Chapter ${esc(c.num)}</span><h2>${esc(c.title)}</h2><p class="chapter-lead">${esc(c.lead)}</p>${c.blocks.map(blockHTML).join('')}</section>`)),
  },
};

function fill(html, name, content) {
  const re = new RegExp(`(<!-- build:${name} -->)[\\s\\S]*?(<!-- /build:${name} -->)`);
  return html.replace(re, (_, open, close) => open + content + close);
}

/* ---------- Dates ---------- */
function lastModified(files) {
  const dates = files.map((f) => {
    try { return execFileSync('git', ['log', '-1', '--format=%cs', '--', f], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; }
  }).filter(Boolean).sort();
  return dates.at(-1) || new Date().toISOString().slice(0, 10);
}

/* ---------- llms.txt ---------- */
function llmsTxt() {
  return `# Somesh Mohapatra

> Somesh Mohapatra, PhD, MBA, is an AI, data science and product leader: Director of Analytics at Caterpillar Inc., where his teams build digital twins and agentic AI for global manufacturing. MIT PhD in machine learning for molecular design, MIT Sloan MBA (Leaders for Global Operations), IIT Roorkee gold medalist. Based in Dallas–Fort Worth, Texas.

This is his personal site. Every page is static HTML; the content also lives in plain JSON under /assets/data/. A full plain-text version of the site is at ${SITE}llms-full.txt.

## Pages

- [Home](${SITE}): profile, career timeline, selected work, recognition and FAQ
- [Playbook](${SITE}playbook/): a complete point of view on running data and AI in an enterprise, in ${playbook.chapters.length} chapters
- [Research](${SITE}research/): ${pubs.papers.length} peer-reviewed papers, preprints, talks and a patent application
${longform.series.filter((s) => s.published).map((s) => `- [${s.title}](${SITE}${s.path}): ${SERIES_NAME}, a build series in ${s.planned} parts. ${s.description}`).join('\n')}${longform.pages.some((p) => p.kind === 'series') ? '\n' : ''}- [Writing](${SITE}writing/): long-form build notes and essays, plus ${posts.length} essays published on LinkedIn on models and inference, agents and software, physical AI and AI at work, most in the Lab Series, The Human Loop and Digital Iron series
- [Resume](${SITE}resume/): experience, education and certifications
${buildNotesTxt()}
## Data

- [Profile](${SITE}assets/data/profile.json): roles, outcomes, recognition, certifications
- [Publications](${SITE}assets/data/publications.json): papers, talks, patent, Google Scholar metrics
- [Playbook](${SITE}assets/data/playbook.json): full playbook text
- [Writing](${SITE}assets/data/writing.json): essay titles, dates, excerpts and links
- [FAQ](${SITE}assets/data/faq.json): short answers about who he is and what he does

## Elsewhere

- [LinkedIn](${profile.links.linkedin})
- [Google Scholar](${profile.links.scholar})
- [GitHub](${profile.links.github})
- [TEDxBoston talk](${profile.links.tedx})
`;
}

// Every published part and essay, so an answer engine can cite the exact article rather than the hub.
function buildNotesTxt() {
  const items = longform.pages.filter((p) => p.kind !== 'series');
  if (!items.length) return '';
  const line = (p) => `- [${p.title}](${SITE}${p.path}): ${p.series ? `${p.series.title}, part ${p.n} of ${p.series.planned}. ` : ''}${p.description}`;
  return `\n## ${SERIES_NAME}\n\nLong-form write-ups of his own builds, with code and architecture. Feed: ${SITE}${FEED_PATH}\n\n${items.map(line).join('\n')}\n`;
}

function playbookText() {
  return playbook.chapters.map((c) => `### ${c.num}. ${c.title}\n\n${c.lead}\n${c.blocks.map(blockText).join('\n')}`).join('\n');
}

function llmsFullTxt() {
  const pubLine = (p) => `- ${p.title}. ${p.venue}, ${p.year}.${p.url && !p.url.includes('scholar.google') ? ` ${p.url}` : ''}`;
  return `# Somesh Mohapatra, PhD, MBA

Source: ${SITE} (generated from the site's data files)

${profile.location}. LinkedIn: ${profile.links.linkedin} · Google Scholar: ${profile.links.scholar} · GitHub: ${profile.links.github}

## Frequently asked questions

${faq.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}

## Experience

${profile.timeline.map((t) => `### ${t.role} · ${t.org} (${t.years})\n\n${t.points.map((x) => `- ${x}`).join('\n')}${t.metrics?.length ? `\n- Outcomes: ${t.metrics.map((m) => `${m.value} (${m.label})`).join('; ')}` : ''}`).join('\n\n')}

## Selected work

${profile.work.map((w) => `### ${w.title} (${w.kicker})\n\n${w.text} Impact: ${w.impact.map((m) => `${m.value} ${m.label}`).join('; ')}.${w.press ? ` Press: ${w.press.url}` : ''}`).join('\n\n')}

## Capabilities

${profile.pillars.map((p) => `- ${p.title}: ${p.text}`).join('\n')}

## Recognition

${profile.recognition.map((r) => `- ${r.year}: ${r.title}. ${r.text}`).join('\n')}

## Education

- PhD, Machine Learning for Molecular Design, Massachusetts Institute of Technology (2018 – 2022). Advisor: Prof. Rafael Gómez-Bombarelli.
- MBA, Leaders for Global Operations (dual degree), MIT Sloan School of Management (2021 – 2022).
- B.Tech, Indian Institute of Technology Roorkee (2014 – 2017). Institute Gold Medal, rank 1 of 110.

## Certifications

${profile.certifications.map((c) => `- ${c}`).join('\n')}

## Research

Google Scholar (${pubs.stats.asOf}): ${pubs.stats.citations} citations, h-index ${pubs.stats.hIndex}.

### Peer-reviewed papers

${pubs.papers.map(pubLine).join('\n')}

### Preprints

${pubs.preprints.map(pubLine).join('\n')}

### Book chapters

${pubs.chapters.map(pubLine).join('\n')}

### Patent

${pubs.patents.map((p) => `- ${p.title}. ${p.number}. ${p.url}`).join('\n')}

### Invited talks

${pubs.talks.map((t) => `- ${t.title}. ${t.venue}, ${t.year}.`).join('\n')}

## Recent builds

${profile.builds.map((b) => `- ${b.title} (${b.theme}; ${b.status}): ${b.problem} ${b.text} Stack: ${b.stack.join(', ')}. ${b.url || b.repo}`).join('\n')}

## Playbook: how I think about data and AI at scale

${playbook.thesis}

### Ten beliefs

${playbook.principles.map((p, i) => `${i + 1}. ${p.title}. ${p.text}`).join('\n')}

${playbookText()}
## ${SERIES_NAME} and essays

${writingText(SITE, longform)}
## Writing on LinkedIn

${posts.map((p) => `- ${p.date} · ${[p.theme, p.series].filter(Boolean).join(', ')}: ${p.title}. ${p.url}`).join('\n')}
`;
}

/* ---------- Sitemap ---------- */
function sitemap(dates) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...PAGES.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${dates[p.file]}</lastmod></url>`),
  ...longform.pages.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${p.kind === 'series' ? [p.updated, ...p.parts.filter((x) => x.published).map((x) => x.updated)].sort().at(-1) : p.updated}</lastmod></url>`)].join('\n')}
</urlset>
`;
}

/* ---------- Write or check ---------- */
const outputs = {};
const dates = {};
for (const page of PAGES) {
  dates[page.file] = lastModified([page.file, ...page.data.map((d) => (d.includes('/') ? d : `assets/data/${d}`))]);
  let html = read(page.file);
  html = fill(html, 'jsonld', jsonld(page, dates[page.file]));
  for (const [name, fn] of Object.entries(BLOCKS[page.file] || {})) html = fill(html, name, fn());
  outputs[page.file] = html;
}
Object.assign(outputs, writingPages(SITE, longform));
outputs['sitemap.xml'] = sitemap(dates);
outputs[FEED_PATH] = atomFeed(SITE, longform);
outputs['llms.txt'] = llmsTxt();
outputs['llms-full.txt'] = llmsFullTxt();

const stale = [];
for (const [file, content] of Object.entries(outputs)) {
  const target = path.join(ROOT, file);
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  // lastmod dates depend on commit history, so ignore them when checking.
  const norm = (s) => s.replace(/<lastmod>[^<]*<\/lastmod>|"dateModified":"[^"]*"/g, '');
  if (norm(current) === norm(content)) continue;
  stale.push(file);
  if (!CHECK) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
}
// Pages generated from content/writing/ whose post was removed or set back to draft.
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(path.join(ROOT, 'writing'))) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  if (rel.endsWith('index.html') && !outputs[rel] && fs.readFileSync(f, 'utf8').includes(GENERATED)) {
    stale.push(rel);
    if (!CHECK) { fs.unlinkSync(f); try { fs.rmdirSync(path.dirname(f)); } catch { /* not empty */ } }
  }
}
if (CHECK && stale.length) {
  console.error(`SEO files out of date: ${stale.join(', ')}. Run: node tools/build_seo.mjs`);
  process.exit(1);
}
console.log(stale.length ? `Updated ${stale.join(', ')}` : 'SEO files up to date');
