---
title: Academic Matchmaker
description: How I built a private, in-browser search that matches a CV against 181,568 researchers at the world's top 200 universities. Covers fitting the index into a static site, semantic matching with a small model, and why concept tags had to come next.
status: published
date: 2026-10-28
topic: Models & inference
order: 2
parts_planned: 3
repo: https://github.com/pikulsomesh/academic-matchmaker
live: https://pikulsomesh.github.io/academic-matchmaker/
image: /assets/img/writing/academic-matchmaker/site.jpg
image_alt: The Academic Matchmaker home page, with a drop zone for a resume and a chat box for describing research interests
image_caption: The live site. Upload a resume or describe your interests, and the matching runs in your browser.
facts:
  - 181,568 | Researchers indexed
  - 200 | Universities (QS 2026)
  - 48 bytes | Per person, per vector
  - $0 | Servers to run
stack: [OpenAlex, ORCID, Python, GitHub Actions, Hugging Face datasets, React + Vite, Transformers.js, WebGPU, MiniLM-L6, Qwen2.5-0.5B]
---

Choosing a PhD or postdoc advisor is one of the biggest decisions in an academic career, and it is still done by hand. Students read faculty pages one university at a time, guess at fit from paper titles, and cold-email people whose research moved on years ago.

The Academic Matchmaker turns that into a search problem. You drop in a CV, a paper or a Google Scholar screenshot, and it ranks researchers across the top 200 universities by how closely their recent work matches yours. Two constraints shaped every decision:

- **Nothing you upload leaves your device.** Text extraction, the language model and the matching all run in the browser.
- **No servers.** The site is static files on GitHub Pages. The data is rebuilt by GitHub Actions and served from a Hugging Face dataset.

Those two constraints are what make this build interesting. Fitting 181,568 researchers into something a browser can search in a second or two took a series of storage and ranking decisions. They are worth writing down because the same moves apply to any retrieval system with a tight budget.

![Architecture of the Academic Matchmaker: the build pipeline in GitHub Actions on the left, matching in the browser on the right](/assets/img/writing/academic-matchmaker/architecture.svg "Everything heavy happens in CI. Everything private happens in the visitor's browser.")

## The three parts

Part 1 covers the problem and the architecture. Part 2 is the data pipeline and storage: how 200 universities of OpenAlex data are ingested under a free API budget and squeezed from about 280 MB of vectors down to under 9 MB. Part 3 is matching: the small model in the browser, coarse-to-fine vector search, why pure semantic matching was not enough, and the concept tags and laureate test set that fixed it.
