// A small Markdown renderer for the long-form writing, with no dependencies.
// Covers what the posts use: front matter, headings, paragraphs, lists, fenced
// code, block quotes, tables, images (rendered as figures), links, bold,
// italics, inline code and horizontal rules. Raw HTML is escaped.

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const slugify = (s) => String(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- Front matter: `key: value`, `[a, b]` lists, and `- item` lists ---------- */
const scalar = (v) => {
  v = v.trim();
  if (/^".*"$|^'.*'$/.test(v)) return v.slice(1, -1);
  if (/^\d+$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  return v;
};
export function parseFrontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) { meta[listKey].push(scalar(item[1])); continue; }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) throw new Error(`Front matter: cannot read "${line}"`);
    const [, key, raw] = kv;
    listKey = null;
    if (raw === '') { meta[key] = []; listKey = key; }
    else if (/^\[.*\]$/.test(raw.trim())) meta[key] = raw.trim().slice(1, -1).split(',').map(scalar).filter((x) => x !== '');
    else meta[key] = scalar(raw);
  }
  return { meta, body: src.slice(m[0].length) };
}

/* ---------- Inline ---------- */
function inline(text, opts) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${opts.url(src)}" alt="${alt}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const ext = /^https?:/.test(href);
    return `<a href="${opts.url(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^\w*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
}

/* ---------- Blocks ---------- */
// opts.url(path) rewrites relative links and images; returns { html, text, headings }.
export function renderMarkdown(src, opts = {}) {
  opts = { url: (u) => u, ...opts };
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const headings = [];
  let i = 0;
  const isBlockStart = (l) => /^(#{1,4}\s|```|>|\s*[-*]\s|\s*\d+\.\s|\|.*\|\s*$|---+\s*$|!\[)/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = line.match(/^```(\S*)/))) {
      const buf = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) buf.push(lines[i]);
      i++;
      out.push(`<pre${m[1] ? ` data-lang="${esc(m[1])}"` : ''}><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if ((m = line.match(/^(#{2,4})\s+(.*)$/))) {
      const level = m[1].length;
      const id = slugify(m[2]);
      if (level === 2) headings.push({ id, text: m[2] });
      out.push(`<h${level} id="${id}">${inline(m[2], opts)}</h${level}>`);
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/))) {
      out.push(`<figure><img src="${esc(opts.url(m[2]))}" alt="${esc(m[1])}" loading="lazy">${m[3] ? `<figcaption>${inline(m[3], opts)}</figcaption>` : ''}</figure>`);
      i++;
      continue;
    }
    if (line.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'), opts).html}</blockquote>`);
      continue;
    }
    if (/^\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().slice(1, -1).split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(/^\|[\s:|-]+\|$/.test(rows[1] || '') ? 2 : 1).map(cells);
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${inline(h, opts)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c, j) => `<td${j === 0 ? ' class="first"' : ''}>${inline(c, opts)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if ((m = line.match(/^\s*([-*]|\d+\.)\s/))) {
      const ordered = /\d/.test(m[1]);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) {
        let item = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s/.test(lines[i])) item += ` ${lines[i++].trim()}`;
        items.push(`<li>${inline(item, opts)}</li>`);
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }
    const buf = [line];
    for (i++; i < lines.length && lines[i].trim() && !isBlockStart(lines[i]); i++) buf.push(lines[i]);
    out.push(`<p>${inline(buf.join(' '), opts)}</p>`);
  }

  const text = src
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#|]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { html: out.join('\n'), text, headings };
}
