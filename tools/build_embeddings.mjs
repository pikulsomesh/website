// Builds assets/data/embeddings.json for the "Ask About Somesh" assistant.
//
// Uses the same ONNX model and the same vanilla WordPiece tokenizer as the
// browser, so stored vectors and query vectors always line up.
//
//   cd tools && npm install && npm run embeddings
//
// Re-run it whenever you edit anything in assets/data/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ort from 'onnxruntime-node';
import { WordPieceTokenizer } from '../assets/js/assistant/tokenizer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'assets/data');
const MODEL_DIR = path.join(ROOT, 'assets/models/minilm');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

function collectEntries() {
  const profile = read('profile.json');
  const playbook = read('playbook.json');
  const pubs = read('publications.json');
  const posts = read('writing.json');
  const manual = read('knowledge.json').entries;

  const entries = [...manual];
  profile.timeline.forEach((t) => entries.push({
    id: `tl-${t.id}`, kind: 'Experience', title: `${t.role}, ${t.org}`, url: `#tl-${t.id}`,
    text: `${t.years}. ${t.points.join(' ')}`,
  }));
  profile.pillars.forEach((p, i) => entries.push({
    id: `pillar-${i}`, kind: 'Expertise', title: p.title, url: '#capabilities',
    text: `${p.text} ${p.tags.join(', ')}.`,
  }));
  profile.work.forEach((w) => entries.push({
    id: w.id, kind: 'Work', title: w.title, url: w.href || `#${w.id}`,
    text: `${w.kicker}. ${w.text} ${w.impact.map((m) => `${m.value} ${m.label}`).join('; ')}.`,
  }));
  profile.recognition.forEach((r, i) => entries.push({
    id: `recog-${i}`, kind: 'Recognition', title: r.title, url: '#recognition', text: `${r.year}. ${r.text}`,
  }));
  playbook.beliefs.forEach((b, i) => entries.push({
    id: `belief-${i + 1}`, kind: 'Playbook', title: b.title, url: `playbook/#belief-${i + 1}`,
    text: `${b.why} ${Object.values(b.apply).join(' ')}`,
  }));
  pubs.items.forEach((p, i) => entries.push({
    id: `pub-${i}`, kind: 'Paper', title: p.title, url: p.url, text: `${p.venue}, ${p.year}. ${p.theme}.`,
  }));
  pubs.code.forEach((c) => entries.push({
    id: `code-${c.title.toLowerCase()}`, kind: 'Code', title: c.title, url: c.url, text: c.text,
  }));
  posts.forEach((p, i) => entries.push({
    id: `post-${i}`, kind: p.series, title: p.title, url: p.url, text: p.excerpt,
  }));
  return entries;
}

async function main() {
  const tokenizer = new WordPieceTokenizer(fs.readFileSync(path.join(MODEL_DIR, 'vocab.txt'), 'utf8'));
  const session = await ort.InferenceSession.create(path.join(MODEL_DIR, 'model_quantized.onnx'));
  const entries = collectEntries();

  for (const e of entries) {
    const enc = tokenizer.encode(`${e.title}. ${e.text}`, 128);
    const n = enc.tokens.length;
    const feeds = {
      input_ids: new ort.Tensor('int64', enc.inputIds, [1, n]),
      attention_mask: new ort.Tensor('int64', enc.attentionMask, [1, n]),
    };
    if (session.inputNames.includes('token_type_ids')) feeds.token_type_ids = new ort.Tensor('int64', enc.tokenTypeIds, [1, n]);
    const out = await session.run(feeds);
    const h = out.last_hidden_state || out[session.outputNames[0]];
    const dim = h.dims[2];
    const v = new Float64Array(dim);
    for (let t = 0; t < n; t++) for (let d = 0; d < dim; d++) v[d] += h.data[t * dim + d] / n;
    const norm = Math.hypot(...v) || 1;
    e.vector = Array.from(v, (x) => Math.round((x / norm) * 1e4) / 1e4);
  }

  const out = {
    model: 'sentence-transformers/all-MiniLM-L6-v2 (Xenova int8 ONNX)',
    dim: entries[0].vector.length,
    generated: new Date().toISOString().slice(0, 10),
    entries,
  };
  fs.writeFileSync(path.join(DATA, 'embeddings.json'), JSON.stringify(out));
  console.log(`Wrote ${entries.length} entries × ${out.dim} dims to assets/data/embeddings.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
