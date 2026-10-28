---
title: Semantic matching in the browser, and why it needed concept tags
description: How the Academic Matchmaker ranks 181,568 researchers on a phone. A 4-bit language model on WebGPU, coarse-to-fine vector search scored with lookup tables, the generic-word failure of pure embeddings, OpenAlex concept tags with synonyms, and a Nobel and Fields laureate test set.
status: published
date: 2026-10-28
tags: [semantic search, embeddings, webgpu, binary quantization, tagging, evaluation]
image: /assets/img/writing/academic-matchmaker/architecture.svg
image_alt: Architecture of the Academic Matchmaker
---

[Part 2](/writing/academic-matchmaker/storage-and-data-pipeline/) built an index small enough to ship to a browser. This part is about the search itself: turning a CV into a query, ranking against 48-byte vectors, and the point where semantic similarity alone stopped being good enough.

## A language model that loads only when it has to

A CV is messy text. Before it can be matched, it has to become a short list of research interests. That job goes to Qwen2.5-0.5B-Instruct, quantized to 4 bits and run with Transformers.js in a Web Worker. The worker checks for WebGPU first, uses half-precision weights when the GPU supports them, and falls back to WebAssembly on the CPU:

```js
const gpu = await webgpuSupport()
const attempts = gpu
  ? [
      { device: 'webgpu', dtype: gpu.fp16 ? 'q4f16' : 'q4' },
      { device: 'wasm', dtype: 'q4' },
    ]
  : [{ device: 'wasm', dtype: 'q4' }]
```

The model is asked for JSON only, and the reader takes the first JSON object it can find, because small models like to wrap their answer in prose. If nothing parses, a rule-based reader splits the text into topics instead.

Even at 4 bits the model is a few hundred megabytes. Early versions ran every upload through it. Now an uploaded CV is matched with the embedding model alone, and the language model loads only when someone types in the chat box. For most visitors, the large download never happens.

## Coarse to fine: centroids, then clusters

The profile is embedded with the same MiniLM model that built the index, so query and index share one vector space. Then the search runs in two stages. It scores the 426 cluster centroids, loads the nearest 24 clusters, and ranks the people in them. When a country or university filter leaves too few people in those clusters, it widens the search, up to 192 clusters, until it has at least 200 candidates.

```js
const PROBE_START = 24      // clusters searched first
const PROBE_MAX = 192       // widest search when a filter leaves few people per cluster
const ENOUGH_FILTERED = 200 // a filtered search stops widening once it has this many
```

Each cluster file is fetched once and cached as a promise, so a second search in the same area costs nothing.

## Scoring 48 bytes with 48 lookups

Each person's vector is 384 sign bits. The obvious way to score one is to loop over 384 dimensions and add or subtract the query's value at each. Doing that for 10,000 people means about 4 million branches.

The trick is to precompute. For each of the 48 bytes in a vector, there are only 256 possible values. So before scoring anyone, the browser builds a 48 × 256 table with the query's partial dot product for every possible byte. After that, a person's score is 48 lookups and 47 additions:

```js
// table[j * 256 + b] is q·s over the 8 dimensions of byte j when that byte holds b.
function bitsTable(q, dim) {
  const bytes = dim / 8
  const table = new Float32Array(bytes * 256)
  for (let j = 0; j < bytes; j++)
    for (let b = 0; b < 256; b++) {
      let sum = 0
      for (let k = 0; k < 8; k++) sum += b & (0x80 >> k) ? q[j * 8 + k] : -q[j * 8 + k]
      table[j * 256 + b] = sum
    }
  return table
}

// Score: 48 lookups, rescaled so bit scores sit on the same 0-1 scale as full vectors.
const BITS_SCALE = Math.sqrt(2 / Math.PI)
let dot = 0
for (let j = 0, offset = r * bytes; j < bytes; j++) dot += table[j * 256 + bits[offset + j]]
const score = Math.min(1, dot / (Math.sqrt(dim) * BITS_SCALE))
```

The table costs 12,288 small sums to build, once per query. Every person after that is cheap, which is why the ranking feels instant on a phone.

## Where semantic matching went wrong

Embeddings are good at "close in meaning" and bad at "this specific thing". Two failure modes showed up in testing:

- **Generic words pulled in strangers.** A business-school CV full of "strategy", "framework" and "analysis" matched people whose abstracts used the same words about entirely different fields.
- **Specific asks got blurred.** Someone looking for "gastrointestinal + peptide" wanted researchers who work on both. A single embedding of that phrase lands somewhere between the two topics and returns people who work on either one.

More dimensions or a bigger model would not fix this. The fix was to add structure the embeddings do not have.

## Concept tags

Every researcher now carries up to eight tags. Up to six are their strongest OpenAlex topics and up to three are keywords OpenAlex assigned to their recent papers, all with a confidence score above 0.3. The tag names live in one shared `tags.json`, most common first, so search rows store small integer ids instead of strings.

On the site, a concept like "gastrointestinal" matches a tag when every significant word of the concept, or of one of its synonyms, appears in the tag's name, in OpenAlex's keywords for that topic, or in its subfield. Three details do most of the work:

- **Generic words never count on their own.** A stop list removes words like "strategy", "analysis", "model" and "framework" before matching, and a light stemmer makes "peptides" meet "peptide".
- **Synonyms are explicit.** "Gastrointestinal" also means GI, gut, digestive, intestinal and bowel. Colorectal, IBD and Crohn's count as narrower terms and score slightly lower.
- **Concepts are ANDed, and rare tags count more.** A person matches only if every concept finds one of their tags. A tag that half the database carries is worth half as much as a rare one:

```js
/** 1 for a rare tag down to 0.5 for one that half the database or more carries. */
export function rarity(count, total) {
  if (!count || !total) return 1
  const share = count / total
  return share >= 0.5 ? 0.5 : 1 - share
}
```

For uploaded CVs, the same vocabulary works in the other direction. The profile is mapped onto tags whose specific words all appear in it. Interests count double, and tags carried by more than 20% of the database are skipped as too common to tell people apart. Researchers who share those tags get a lift of up to 0.15 on their similarity score. Embeddings still decide who is close, and tags decide who is specifically right.

## Testing it on Nobel and Fields laureates

Search quality is easy to claim and hard to show, so the matcher has a fixed test set: the 2026 Fields Medal and Nobel Prize winners. After every data refresh, the pipeline:

1. resolves each laureate's OpenAlex author and ORCID iD, accepting a match only when the name and institution agree, and never guessing;
2. builds a profile from their public record using the site's own profile code, and a second one from a saved public CV where one exists, through the same no-language-model path an upload takes;
3. embeds it, ranks the published vectors, and records the top 10 matches and the topics and papers behind them.

A run passes when a profile is built and the best match scores at least 0.3, and the site shows "Prize test passing" when at least 80% of runs pass. The latest refresh passed 11 of 11 runs for the laureates it could resolve. The Demo tab shows the well-matched examples with the connections behind each one.

## What I would carry to the next retrieval build

- Decide what runs where before choosing models. "Private and serverless" set every other constraint here.
- Quantize the index, not the query. Sign bits plus a full-precision query keep most of the ranking for 3% of the storage.
- Precompute per query, not per item. One table turns 384 operations per person into 48.
- Pair embeddings with tags when people ask for specific things. Similarity finds the neighborhood, and tags make sure the match is specifically right.
- Keep a fixed, public test set and run it on every data refresh.

The code is open, and the [live site](https://pikulsomesh.github.io/academic-matchmaker/) is the fastest way to see whether it finds the right people for your work.
