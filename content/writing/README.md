# Writing: build notes and essays

Long-form posts are Markdown files in this folder. `node tools/build_seo.mjs` turns every
**published** one into a static page under `/writing/`, adds it to the Writing page, the
sitemap, `llms.txt` and `llms-full.txt`, and removes pages whose post went back to draft.
Drafts never become pages, but this repository is public, so a draft is readable on GitHub.

## Where files go

| File | Page |
|---|---|
| `<series>/_series.md` | `/writing/<series>/`, the hub for one build |
| `<series>/NN-<slug>.md` | `/writing/<series>/<slug>/`, part NN of that build |
| `essays/<slug>.md` | `/writing/<slug>/`, a standalone essay |

The folder name of a series and the `<slug>` of a post become the URL, so pick them once and
keep them. Use words people would search for (`video-to-world-model`, not `part-2`).

## Front matter

Every file starts with:

```
---
title: From a news video to a 3D world model
description: One or two sentences. This is the search snippet and the LinkedIn preview.
status: draft            # or published
date: 2026-10-29         # publication date; required once published
tags: [world models, gaussian splatting]
image: /assets/img/writing/<series>/<file>.jpg   # optional, also the share image
image_alt: What the image shows
linkedin: https://www.linkedin.com/feed/update/...   # optional, once the post is up
---
```

A series hub (`_series.md`) also takes `topic`, `parts_planned`, `repo`, `live`, `paper`,
`paper_title`, `stack: [..]`, `image_caption` and `facts`, a list of `value | label` lines.
An essay also takes `topic` (Models & inference, Agents & software, Physical AI, AI & work).

## Releasing a series, one part a day

1. Write all parts as `status: draft`. The hub lists them as "Coming".
2. Day 1: set the hub and part 1 to `published` with today's date, run
   `node tools/build_seo.mjs`, commit.
3. Each next day: publish the next part the same way, then post on LinkedIn linking to
   that part's URL, and add the post's URL back as `linkedin:`.

## Markdown that works

Headings (`##`, `###`), paragraphs, `-` and `1.` lists, **bold**, *italic*, `inline code`,
fenced code blocks, `>` quotes, tables, links, and images on their own line as
`![alt text](/assets/img/... "Caption")`, which become figures. Images go in
`assets/img/writing/<series>/`, about 1600 px wide.
