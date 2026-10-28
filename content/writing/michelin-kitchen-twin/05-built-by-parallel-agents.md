---
title: How five parallel AI agent threads built the kitchen twin
description: The first version of the kitchen twin was built in a day by five Claude Code threads working in parallel, one each for product, data, simulation, 3D and Studio. What made that work was not the agents. It was one shared contract and clear ownership.
status: published
date: 2026-10-28
tags: [ai agents, claude code, software engineering, parallel development, contracts]
image: /assets/img/writing/michelin-kitchen-twin/architecture.svg
image_alt: Architecture of the Michelin Kitchen Twin
---

The first working version of this twin was built in a single day by several Claude Code sessions working in parallel, each in its own thread, each owning one part of the repository. I set the goal and the bar ("as realistic as possible, hosted on GitHub Pages") and approved merges. The sessions wrote the code, the data and the docs, reviewed each other's interfaces, and merged their own pull requests once CI was green. The days after that were polish, performance and the optimizer.

This part is about what made that work, because the lesson carries well beyond kitchens.

## Who owned what

| Thread | Owned | Pull requests |
|---|---|---|
| Product | The press-release FAQ and the product requirements: who the twin is for, the two-minute demo, what "realistic" means | 2 |
| Research and data | `data/`: The French Laundry, chosen for having the most published detail, 14 cited sources, menu, recipes as BOMs and routings, equipment, brigade, layout, the MRP explosion, the site shell and final integration | 6 |
| Simulation | `src/sim` and `src/dashboard`: the seeded event engine, guest line, what-ifs, capacity sweep and the operations dashboard | 4 |
| 3D kitchen | `src/scene`: procedural materials, the vaulted kitchen and garden, cooks on a navigation grid, quality tiers, OpenUSD export | 1 |
| Studio | `src/studio`: dining room, menus, seasons, and light and mood, each re-running the whole service | 1 |

Fifteen pull requests in all, each built and tested by CI before merge. The result was about 7,000 lines of data and 10,600 lines of JavaScript and CSS.

## Product first, in writing

The first thread wrote nothing but documents: a working-backwards press release and FAQ, then a requirements doc with KPI definitions and the interfaces between parts. That sounds slow for a one-day build. It was the fastest part of the day, because every later thread could check its own decisions against the same page without asking anyone. "Is this realistic enough?" and "what does the dashboard show at 8:30?" had written answers before any code existed.

The FAQ also named the biggest risks up front. Realism on a browser budget was first. Three parallel threads drifting apart was second.

## A contract, not shared files

The fix for drift was a contract. The threads agreed on ids, not on files:

- `EQ-*` for equipment, `WC-*` for work centers, `SL-*` for storage,
- `RM-*` for raw materials, and `INT-*` and `FG-*` for intermediate and finished products.

Every part keys off those ids. The simulation's adapter reads `/data` and turns routings into task chains. The 3D scene places a model at each `EQ-*` id and exports a USD prim under the same name. The Studio compiles its edits back into the simulation's input. The dashboard reports utilization by the same ids, so clicking a station highlights it in 3D.

The second contract was the event log between the simulation and everything that draws it: `ticket.fired`, `op.start`, `op.end`, `staff.move`, `machine.state`, `inventory.change`, `plate.passed`, `plate.refire`. The scene never asks the engine how to animate. It reads the same events the dashboard does.

When one thread needed something from another, like ingredient prices from the data thread or a lighting hook from the 3D thread, it asked in a message, and the owning thread made the change in its own files. Nobody edited anyone else's directory.

## What the agents did well, and what I still did

The agents were very good at the volume work: sourcing and structuring 88 ingredients and 53 recipes with citations, writing a discrete-event engine with tests, generating a realistic 3D scene procedurally, and keeping docs in step with code. They were also good at reviewing interfaces, because each thread had a narrow, well-defined thing to protect.

The human work was the kind that does not parallelize:

- **Choosing the bar.** "Realistic" had to be defined, and the product thread's documents are where that happened.
- **Choosing what is honest.** Deciding that every record is either sourced or marked `est`, and that the 3D view is never animated independently of the simulation.
- **Approving merges.** CI caught breakage. Judgment about whether a change moved toward the goal stayed with a person.

## The lesson I took to the next builds

Parallel agents scale the same way parallel teams do. They go fast when ownership is clear and the interfaces are written down, and they stall when everyone shares the same files. The food bank twin used the same pattern with OpenUSD as the contract between steps. The Academic Matchmaker used it with a published data format between the pipeline and the site. In every case, the contract decided how fast the build could go.

The full story, with links to every pull request, is in the repository's `docs/how-it-was-built.md`. The [live twin](https://pikulsomesh.github.io/michelin-kitchen-twin/) opens a full service from a link.
