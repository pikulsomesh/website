// Atom feed for long-form writing (/writing/feed.xml), built from loadWriting() output.
// Feed readers, Google and cross-posting sites (dev.to, Hashnode, Medium import) read it.
// Entries carry the full article, with links made absolute, so a cross-post keeps its figures.

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const absolute = (site, html) => html.replace(/(href|src)="\/(?!\/)/g, `$1="${site}`);
const stamp = (d) => `${d}T00:00:00Z`;

export const FEED_PATH = 'writing/feed.xml';

export function atomFeed(site, w) {
  const entries = w.pages.filter((p) => p.kind !== 'series').sort((a, b) => b.date.localeCompare(a.date) || (b.n || 0) - (a.n || 0));
  const updated = entries.map((p) => p.updated).sort().at(-1) || '2026-01-01';
  const entry = (p) => {
    const title = p.series ? `${p.title} (${p.series.title}, part ${p.n})` : p.title;
    const cats = [...(p.series ? [p.series.title] : []), ...p.tags].map((t) => `    <category term="${esc(t)}"/>`).join('\n');
    return `  <entry>
    <title>${esc(title)}</title>
    <link rel="alternate" type="text/html" href="${site + p.path}"/>
    <id>${site + p.path}</id>
    <published>${stamp(p.date)}</published>
    <updated>${stamp(p.updated)}</updated>
    <summary>${esc(p.description)}</summary>
${cats ? `${cats}\n` : ''}    <content type="html">${esc(absolute(site, p.html))}</content>
  </entry>`;
  };
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
  <title>Build notes · Somesh Mohapatra</title>
  <subtitle>Long-form write-ups of what Somesh Mohapatra builds, with code, architecture and numbers.</subtitle>
  <link rel="self" type="application/atom+xml" href="${site + FEED_PATH}"/>
  <link rel="alternate" type="text/html" href="${site}writing/"/>
  <id>${site}writing/</id>
  <updated>${stamp(updated)}</updated>
  <author><name>Somesh Mohapatra</name><uri>${site}</uri></author>
  <icon>${site}assets/img/favicon.svg</icon>
  <logo>${site}assets/img/og.jpg</logo>
${entries.map(entry).join('\n')}
</feed>
`;
}
