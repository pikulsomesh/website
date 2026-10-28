---
title: An open, cited history of digital twins, from andon lights to Physical AI
description: Why I built an open dataset and interactive site tracing digital twins from 1880s time clocks and Apollo's simulators to live factory twins and AI world models, with 53 cited milestones, a walkable 3D factory in six eras, and research trends from OpenAlex.
status: published
date: 2026-10-28
topic: Physical AI
tags: [digital twin, history, physical ai, open data, three.js, openalex]
repo: https://github.com/pikulsomesh/digital-twin-history
live: https://pikulsomesh.github.io/digital-twin-history/
linkedin: https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A7514413206941937664
image: /assets/img/writing/essays/digital-twin-history.jpg
image_alt: The Digital Twin History home page with its 3D growth spiral of milestones
---

"Digital twin" sounds like a 2010s idea. The name is, and the idea is not. People have been building live stand-ins for physical things for well over a century: a time clock that records who is on the floor, a loom that stops itself when a thread breaks, a flight simulator that behaves like an aircraft, and the ground simulators that helped bring Apollo 13 home. Each of them answers the same question a twin answers today: what is happening out there, and what happens if we change something?

I wanted that history in one place, with a public source for every claim, so it could be reused in courses, talks and reports. So I built **[Digital Twin History](https://pikulsomesh.github.io/digital-twin-history/)**, an open dataset and an interactive site built from it. Everything is MIT licensed.

![The Digital Twin History home page](/assets/img/writing/essays/digital-twin-history.jpg "The growth spiral: every milestone placed by year, with the spiral widening as more domains take up the idea.")

## Seven eras

| Era | Years | In one line |
|---|---|---|
| Mirrors before the name | 1880–1970 | Time clocks, andon lights, simulators, the Kalman filter, Apollo 13 |
| The digital model | 1971–1989 | CAD, finite elements, PLCs, SCADA, computer-integrated manufacturing |
| Connected models | 1990–2001 | *Mirror Worlds*, MES, OPC, ISA-95, virtual cities |
| The idea gets a name | 2002–2013 | The 2002 product-lifecycle model, NASA's "digital twin" in 2010, Industrie 4.0 |
| Industrial scale-up | 2014–2019 | Fleet twins, city twins, organ twins, sim-to-real robotics |
| Definitions and standards | 2020–2023 | ISO 23247, ISO/IEC 30173, the National Academies report, Destination Earth |
| AI-native twins and Physical AI | 2024–now | Learned forecasting in operations, fast reality capture, twins as training grounds, world models, agents |

The pattern across the eras is that the 3D view was never the point. Each era added a new answer to "what can we know about the machine?": from "someone has to walk over and look", to "which alarm fired", to "which machine is drifting toward failure", to "what happens if we change the layout". The current era adds "which policy is most robust before we try it". That is where Physical AI comes in: twins have become the place where machines learn.

## Built as data first

The site is the second thing in the repository. The first is a structured dataset: milestones, eras, domains, definitions and the narrative for the 3D factory, all as JSON and Markdown. Every milestone has a year, an era, one or more domains, a kind of change (precursor, enabling technology, concept, standard, deployment or research), a significance level and at least one source.

A validator runs before every build and fails it if any milestone is malformed or uncited:

```js
// Excerpt from scripts/validate-content.mjs
if (!Array.isArray(m.sources) || !m.sources.length) errors.push(`${where}: needs at least one source`);
else m.sources.forEach((s) => {
  if (!s.title) errors.push(`${where}: source missing title`);
  try { if (new URL(s.url).protocol !== 'https:') throw 0; } catch { errors.push(`${where}: source url must be https: ${s.url}`); }
});
if (era && (m.year < era.range[0] || m.year > era.range[1])) errors.push(`${where}: year ${m.year} is outside era ${m.era}`);
```

That one rule, no source and no merge, is what makes the dataset safe to reuse. It also makes contributing simple: edit `content/timeline.json`, cite a public source, and run the validator.

## Three ways in

**The growth spiral.** Every milestone is a sphere placed by year. The spiral widens as more domains take up the idea, so you can see the field spread from manufacturing and aerospace to energy, cities, health and Earth systems. Time is compressed before 1960 and stretched after 2000, where most of the activity is:

```js
// Time is compressed before 1960 and stretched after 2000, where most activity is.
export function yearToY(year) {
  if (year < 1960) return (year - 1880) * 0.06;
  if (year < 2000) return 4.8 + (year - 1960) * 0.2;
  return 12.8 + (year - 2000) * 0.7;
}
```

**The factory through time.** A walkable 3D production line shown in six eras: lights on the floor, the control room, the connected plant, sensors and dashboards, the live digital twin, and Physical AI. Click any machine to see what people could know about it in that era. The machine values are simulated and labeled as illustrative.

**Growth in research.** Yearly counts of papers with "digital twin" in the title come from OpenAlex at build time. The fetch never fails the build. If the API is unreachable, the page says so instead:

```js
// Simplified from scripts/fetch-publication-counts.mjs
const url = 'https://api.openalex.org/works?filter=title.search:%22digital%20twin%22&group_by=publication_year&per_page=200';
try {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const counts = (await res.json()).group_by.map((g) => ({ year: Number(g.key), count: g.count }));
  // ...written to public/data/publications.json
} catch (err) {
  console.warn(`Skipping publication counts: ${err.message}`);
}
```

A weekly run refreshes those counts, so the chart stays current without anyone touching it.

## Principles

- **Traceable.** Every claim links to a public source.
- **Vendor-neutral.** The history is told through ideas, practices, standards and public programs. Organizations are named only where history requires it, never as recommendations.
- **Honest about data.** Charts built on the curated milestones say so, and simulated values in the 3D factory are labeled.

## Where this connects to what I build

The frontier section of the site argues that the next steps for twins are not better 3D. They are faster reality capture, hybrid physics and AI, world models, agentic interfaces, and trust: verification, validation and uncertainty built in from the start. My recent builds are experiments on exactly those lines. The [Food Bank Spatial Twin](/writing/foodbank-spatial-twin/) tests fast reality capture with world models. The [Michelin Kitchen Twin](/writing/michelin-kitchen-twin/) tests whether a twin can explain a bottleneck rather than just show one.

Corrections and new milestones are welcome on [GitHub](https://github.com/pikulsomesh/digital-twin-history).
