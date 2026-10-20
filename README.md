# someshmohapatra.in

Personal site of Somesh Mohapatra. Pure static HTML, CSS and vanilla JavaScript, served by GitHub Pages with no build step.

## Layout

```
index.html              Home: hero, trajectory, moments, capabilities, work, recognition, writing, contact
playbook/               Eight beliefs × five industries, plus the multi-cloud reference stack
writing/                Digital Iron, The Human Loop and Lab Series, filterable
research/               Papers, patent, open source, talks
resume/                 Web resume; "Save as PDF" uses the print stylesheet
404.html
assets/
  css/main.css          Design tokens (light/dark), layout, components
  js/main.js            Theme, nav, rendering of the JSON content
  js/assistant/         "Ask About Somesh": tokenizer.js (BERT WordPiece) + assistant.js (onnxruntime-web)
  data/*.json           All editable content (see below)
  models/minilm/        all-MiniLM-L6-v2, int8 ONNX (~23 MB) + vocab.txt
  img/                  Photos and favicon
tools/                  Offline helpers (Node); never served
CNAME                   someshmohapatra.in
```

## Updating content

Edit the JSON in `assets/data/` and commit. No build is needed.

| File | What it holds |
| --- | --- |
| `profile.json` | Proof numbers, timeline, capabilities, selected work, recognition, certifications, links |
| `playbook.json` | Beliefs, how each applies by industry, the reference stack per cloud |
| `publications.json` | Papers, patent, code, talks, citation stats |
| `writing.json` | Essay index (title, date, LinkedIn URL, excerpt, tags) |
| `knowledge.json` | Extra hand-written answers for the assistant |
| `embeddings.json` | Generated; do not edit by hand |

After changing any of them, refresh the assistant's index so it knows about the change:

```sh
cd tools
npm install          # once; installs onnxruntime-node
npm run embeddings   # rewrites assets/data/embeddings.json
npm run check        # verifies JSON, links and model files
```

If `embeddings.json` is stale the site still works; the assistant just won't know about new items.

## The assistant

A ~22.6M-parameter sentence-embedding model (all-MiniLM-L6-v2, int8) runs in the visitor's browser through `onnxruntime-web` (pinned, from jsDelivr). Queries go through `tokenizer.js`, a faithful port of BERT's uncased WordPiece tokenizer (verified token-for-token against Hugging Face `tokenizers`), then mean pooling, L2 normalization and cosine similarity against `embeddings.json`. The model loads only when someone opens the assistant; keyword search answers until it is ready. Nothing typed leaves the browser.

## Hosting and domain

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root. Custom domain `someshmohapatra.in`, then Enforce HTTPS.

DNS for `someshmohapatra.in` (at whichever provider runs its nameservers):

| Type | Host | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | pikulsomesh.github.io |

## Automation

- `.github/workflows/check.yml` runs `tools/check_site.mjs` on every PR and push.
- `.github/workflows/claude.yml` lets you mention `@claude` in an issue or PR to request edits. It needs the Claude GitHub App and a `CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`) repository secret.

## Privacy

This repository is public. Keep phone numbers, resume source files, analytics exports and employer-specific documents out of it.
