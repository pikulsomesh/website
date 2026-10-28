---
title: Simulating a dinner service, minute by minute
description: The discrete-event simulation behind the kitchen twin. A seeded event heap that replays the same night every time, tickets as work orders, OEE per appliance, a named bottleneck, and an optimizer that tests every fix across five seeds.
status: published
date: 2026-10-28
tags: [discrete event simulation, oee, theory of constraints, optimization, javascript]
image: /assets/img/writing/michelin-kitchen-twin/dashboard-rush.jpg
image_alt: The operations dashboard during a rush seating of 120 covers
---

[Part 2](/writing/michelin-kitchen-twin/recipes-as-bills-of-materials/) turned covers into a plan. A plan says what has to be made. It does not say what happens when 14 tables sit down within 20 minutes and the fish station has one chef de partie. That is the simulation's job.

## Why discrete events

A dinner service is a set of things that happen at specific moments: a party arrives, a ticket fires, a cook starts searing, a combi finishes, a plate reaches the pass. Between those moments nothing changes. A discrete-event simulation jumps from one event to the next instead of ticking a clock, so a whole night runs headlessly in a fraction of a second, and the same engine can also play in real time to drive the 3D scene.

The engine is plain JavaScript with no dependencies. It has two building blocks.

## Same seed, same night

The first is a seeded random number generator. Operation times are means with lognormal spread, 20% for hands-on work and 5% for machine cycles. Arrivals, party sizes and no-shows are random too. So that a share link can replay the night to the second, every draw comes from mulberry32, a tiny, fast generator that gives the same sequence for the same seed:

```js
// Deterministic PRNG (mulberry32) + helpers. Same seed => identical service.
export function makeRng(seed = 1) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const u = Math.max(next(), 1e-12), v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    next, normal,
    /** mean-preserving lognormal multiplier with coefficient of variation cv */
    jitter: (cv) => (cv ? Math.exp(normal() * cv - (cv * cv) / 2) : 1),
  };
}
```

The `- cv²/2` term keeps the mean of the multiplier at exactly 1. Without it, adding variability would quietly make every operation slower on average, and every what-if would be biased.

The second building block is the event queue, a binary min-heap ordered by time and then by insertion order. The tie-break matters. Two events at the same second must always run in the same order, or determinism breaks in ways that are very hard to debug.

## Tickets as work orders

Each table's course is a ticket. Expo fires it early by the planned lead time of its slowest dish, which is just-in-time offset scheduling, and staggers the dish lines so every plate on the table finishes together. Each dish is a small graph of steps, each with a station, an appliance type, a role, a duration, a hands-on time and an ingredient draw. Hands-on time is separate from duration so an oven stays busy after the cook walks away.

Resources behave like a plant's:

- **Cooks** have roles, skills, shifts and walking time between stations.
- **Appliances** have slots and fail and recover, with mean time between failures and mean time to repair.
- **Prep** is exploded from the menu with a safety factor. It consumes raw stock and produces the components that service steps consume.
- **The pass** is a quality gate. Rejected plates and plates held too long trigger re-fires and are counted as waste.
- **Stockouts** are handled the way a kitchen handles them. The dish is 86'd, swapped for another option in the same course if one exists, and comped if not.

The dining room is a second production line. Parties arrive, wait for a table, balk if they wait too long, eat at their own pace, and leave. Every stage has a queue and a KPI.

## KPIs a plant manager would recognize

The dashboard has a toggle between kitchen and factory vocabulary. "Ticket time p90" becomes "lead time p90", and "covers served" becomes "units shipped". Behind it:

- ticket time p50, p90 and p95 per course, guest wait, throughput and work in process;
- utilization of cooks, stations and appliances, over a rolling 15 minutes;
- **OEE = availability × performance × quality** for every appliance;
- first-pass yield, food cost and waste;
- and a theory-of-constraints read-out that names the bottleneck and says why.

![The dashboard naming the constraint during a rush seating](/assets/img/writing/michelin-kitchen-twin/dashboard-rush.jpg "120 covers in a rush seating. The read-out names the fish chef de partie as the constraint: 96% busy, 10 tasks queued, 22 tasks waited 3 hours in total over the last 30 minutes.")

Naming the bottleneck is the most useful line on the screen. A dashboard full of red numbers says something is wrong. A sentence that names the resource, its load and its queue says what to fix.

## An optimizer that cannot be fooled by one lucky night

The last piece answers "what should I change?" for the most common complaint: guests sitting longer than the menu intends. The optimizer tries two kinds of levers:

1. **One more cook**, cloned from each line role, on the same shift and station.
2. **A re-sequenced fire**, calling each course earlier by a larger share of its slowest dish's lead time.

Every candidate re-runs the whole night headlessly, from five seeds, and is ranked on the average:

```js
export const SEEDS = [1, 2, 3, 4, 5];
const FIRE_LEADS = [1, 1.15, 1.3, 1.5];
const LEAD_SECS = [75, 150, 225];
// guards: a candidate that wins on meal time by hurting something else is flagged, not recommended
const GUARD = { fpyPts: 1, ticketP90Sec: 120, tableWaitP90Sec: 120 };
```

The guards matter as much as the search. A fix that shortens the meal by firing everything earlier but drops first-pass yield by a point, because plates sit at the pass, is not a fix. It is flagged, not recommended.

The common scenarios (40, 62, 90 and 120 guests) and the optimizer's results are precomputed at build time, so the site opens with answers already on the page. Anything you change re-runs live.

[Part 4](/writing/michelin-kitchen-twin/3d-kitchen-and-studio/) is the photoreal 3D kitchen this simulation drives, and the Studio that lets you redesign the restaurant around it.
