---
title: Write the contract first, what AI agents taught me about building fast
description: When several AI coding agents build one system in parallel, the speed comes from clear ownership and a written contract between the parts, not from the agents. The same lesson that makes human teams fast, learned again across three builds.
status: published
date: 2026-10-28
topic: Agents & software
tags: [ai agents, claude code, software architecture, interfaces, parallel development]
image: /assets/img/writing/michelin-kitchen-twin/architecture.svg
image_alt: Architecture of the Michelin Kitchen Twin, showing one data contract feeding several parallel parts
---

Over the last few weeks I have built several systems with AI coding agents working in parallel: a [kitchen digital twin](/writing/michelin-kitchen-twin/), a [food bank twin built from a news video](/writing/foodbank-spatial-twin/), and a [research matchmaker](/writing/academic-matchmaker/) that indexes 181,568 researchers. Each one was built by several agent threads at once, each owning one part of the repository.

The thing that decided how fast each build went was not the model, the prompt or the tooling. It was whether the parts had a written contract between them before anyone wrote code.

## What goes wrong without one

Give several capable agents one goal and one repository, and they behave like several capable engineers in the same situation. Each makes reasonable local decisions. The 3D thread invents ids for the machines. The data thread invents different ones. The simulation thread reads a file shape that the data thread changes an hour later. Every part works on its own, and the system does not. The integration work at the end eats the time the parallelism saved.

## What a contract looks like in practice

The contract does not need to be elaborate. In each build it was one or two things that every part agreed to read and write:

- **Kitchen twin:** a set of ids (`EQ-*` for equipment, `WC-*` for work centers, `RM-*` for raw materials, `FG-*` for finished goods) and an ordered event log between the simulation and every view of it. The 3D scene places a model at each `EQ-*` id and exports a USD prim with the same name. The dashboard reports utilization by the same ids.
- **Food bank twin:** OpenUSD in metres, Y up, with the floor at zero, plus a small JSON API in the same frame. The capture pipeline, the Blender model, the AWS backend and three different renderers never needed to know about each other.
- **Matchmaker:** a published data format between the pipeline and the site, with versioned file formats (`compact-v1`, `tags-v1`) so the site can read old and new builds while the pipeline changes underneath it.

## Ownership is the other half

Each thread owned a directory, and nobody edited anyone else's. When the simulation thread needed ingredient prices, it asked the data thread in a message, and the data thread added them. That sounds bureaucratic for software written in an afternoon. In practice it removed most merge conflicts and kept every change reviewable by the one thread that understood that part.

The kitchen twin's first version, fifteen pull requests across five threads, came together in a day because of that structure. Each pull request was built and tested by CI before merge, so the system was integrated continuously instead of at the end.

## What still needs a person

Agents are very good at volume: sourcing and structuring data, writing an engine with tests, generating a 3D scene, keeping docs in step with code. The work that stayed with me was the work that does not parallelize:

- **Setting the bar.** "Realistic", "private" and "no servers" had to be defined up front, in writing, before any thread started.
- **Choosing what is honest.** Which numbers are labeled as estimates, what the demo is allowed to claim, and what the paper says about what failed.
- **Approving merges.** CI catches breakage. Judgment about whether a change moves toward the goal is still a human call.

## The takeaway

None of this is new. Interfaces before implementation, clear ownership and continuous integration are how good engineering teams have always moved fast. What is new is how much faster the cycle runs when the implementers are agents. A missing contract used to cost a week of integration. Now it can cost most of a one-day build. So write the contract first.
