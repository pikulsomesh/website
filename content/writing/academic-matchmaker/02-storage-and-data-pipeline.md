---
title: Fitting 181,568 researchers into a static website
description: The data pipeline and storage behind the Academic Matchmaker. Ingesting 200 universities under a free API budget, compact search rows, 1-bit vectors that cut the index from 280 MB to under 9 MB, and a clustered index the browser loads piece by piece.
status: published
date: 2026-10-28
tags: [data engineering, vector quantization, ivf index, openalex, github actions, hugging face]
image: /assets/img/writing/academic-matchmaker/architecture.svg
image_alt: Architecture of the Academic Matchmaker
---

A matchmaker is only as good as its index. This part is about building that index for 200 universities with no database and no server, and then making it small enough for a browser to search.

## Ingesting under a request budget

The source is OpenAlex, which is free and open but meters requests. Without a key the daily budget is about 1,000 list calls. With a free key it is about 10,000. A naive pipeline asks for each researcher's recent papers one person at a time, which is hundreds of thousands of calls.

The first fix was to batch. OpenAlex filters accept up to 100 values joined with `|`, so one request can ask for the recent papers of 25 authors at once, newest first, and stop paging once everyone has enough:

```python
for batch in chunks(todo, batch_size):          # 25 authors per request
    params = {
        "filter": f"author.id:{'|'.join(batch)},from_publication_date:{since},to_publication_date:{today_iso()}",
        "sort": "publication_date:desc",
        "select": WORK_SELECT,                    # only the fields we store
    }
    for work in client.iterate("works", params, max_results=200 * max_pages):
        for authorship in work.get("authorships") or []:
            aid = short_id((authorship.get("author") or {}).get("id"))
            if aid in wanted and len(found[aid]) < MAX_RECENT_PUBLICATIONS:
                found[aid].append(publication_entry(work, aid))
        if all(len(v) >= MAX_RECENT_PUBLICATIONS for v in found.values()):
            break                                 # everyone in the batch is full
```

A full build now takes roughly 3,000 to 4,000 calls, and a monthly update roughly 1,000 to 1,500.

The second fix was structural. A full build runs **one job per university**, at most 20 in parallel, each with its own cache keyed by the university's name. Each job takes a share of the daily request budget, and together they stay at about 10 requests a second. When a job hits its time limit or the daily cap, it stops as "paused" with its progress cached, nothing is published, and the next daily run picks up where it left off. An assemble step merges the results, and only then does a quality gate decide whether the build is published.

Keying the cache by name, not by position, sounds minor. It is what let the list grow from 100 to 200 universities without throwing away anyone's progress.

## Who counts as a researcher

For each university, the pipeline takes OpenAlex authors whose last known institution is that university, with at least 20 works, 500 citations, an h-index of 10 and a paper in the last three years, most cited first, up to 1,000 per university. Research areas come from OpenAlex topics. Titles and roles come from faculty pages, then from ORCID employment history. Emails come from faculty pages, then ORCID-linked pages, then the affiliation strings on the person's own papers. An email is kept only when it matches both the person's name and the university's domain.

## Storage: from 500 bytes a row to 100

The first version published one JSON object per person. At 181,568 people that is far too much to download up front, so search rows went to a compact format: field names once, values as arrays, repeated strings as indexes into shared tables, and common URL prefixes stored once.

```json
{
  "format": "compact-v1",
  "fields": ["id", "name", "title", "institution_id", "primary_domain", "domains", "citation_count", "email", "profile_url"],
  "institutions": ["I63966007", "I40120149"],
  "domains": ["Artificial Intelligence", "Materials Chemistry"],
  "url_prefixes": ["https://orcid.org/"],
  "rows": [["A5012345678", "A. Researcher", "Professor", 0, 1, [1, 0], 5120, null, "0|0000-0002-1825-0097"]]
}
```

Trailing nulls are dropped, and the decoder in the browser rebuilds full objects. The result is about 100 bytes a person instead of about 500. Full records, with publications and contact details, stay in per-university files that load only when someone opens a profile.

## Vectors: from 1,536 bytes to 48

Each researcher has a 384-dimension embedding. Here is what that costs at 181,568 people:

| Storage | Bytes per person | Whole index |
|---|---|---|
| float32 | 1,536 | about 279 MB |
| int8 | 384 | about 70 MB |
| 1 bit per dimension | 48 | about 8.7 MB |

The int8 version was the first step: scale, round, and keep a per-row norm. The bigger step was to keep only the **sign** of each dimension. A positive value becomes a 1 and a negative one a 0, packed eight to a byte:

```python
def pack_bits(q):
    """Sign bits of int8 vectors, packed 8 per byte: dimension i is byte i // 8, mask 0x80 >> (i % 8)."""
    return np.packbits(q > 0, axis=1)
```

Throwing away 31 of every 32 bits sounds reckless. It works because the query is not quantized. The browser keeps the full-precision query vector and scores it against each sign vector, and for a unit query that dot product is, on average, a fixed fraction (the square root of 2/π) of the true cosine. Dividing by that constant puts bit scores back on the same 0 to 1 scale as the full vectors. Part 3 shows how the browser scores 48 bytes with 48 lookups.

## Clustering: download a few percent of the index

8.7 MB is small for a database and large for a first page load. So the build also clusters the vectors, an inverted-file (IVF) index. It runs plain k-means on the unit vectors, with k set to the square root of the number of people, which gives **426 clusters**. Then it writes one centroid file and one file per cluster:

```python
k = k or max(1, min(n, round(math.sqrt(n))))
unit = q.astype(np.float32) / SCALE
unit /= np.maximum(np.linalg.norm(unit, axis=1, keepdims=True), 1e-9)
centroids = kmeans(unit, k)
for start in range(0, n, 20000):                  # assign in blocks to bound memory
    assignment[start:start + 20000] = np.argmax(unit[start:start + 20000] @ centroids.T, axis=1)
```

Centroids stay int8. Cluster members are stored as bits, along with the university of each member, so filters work without loading anything else. A search ranks the 426 centroids first and then loads the 24 closest clusters, which is about 5% of the people and a few hundred kilobytes.

## Hosting the data

GitHub Pages is fine for the app and wrong for a dataset that is rewritten every month, because every rebuild would add hundreds of megabytes to the repository's history. The data lives in a Hugging Face dataset instead. The pipeline uploads `public/data` as one commit, deletes files the build no longer writes, then squashes the dataset's history so old copies do not pile up. The site reads the files from the dataset's CDN URL, and falls back to a small bundled sample when no hosted data is configured.

The result is a pipeline that rebuilds itself on a schedule and an index a phone can search, with no server anywhere. [Part 3](/writing/academic-matchmaker/semantic-matching-and-tags/) is about what happens when the search runs.
