---
title: Michelin Kitchen Twin
description: A browser-based digital twin of The French Laundry, a three-Michelin-star kitchen, running a full dinner service, modeled the way a factory is. Recipes are bills of materials, covers are the build plan, and a deterministic simulation drives a photoreal 3D kitchen and an operations dashboard.
status: published
date: 2026-10-28
topic: Physical AI
order: 3
parts_planned: 5
repo: https://github.com/pikulsomesh/michelin-kitchen-twin
live: https://pikulsomesh.github.io/michelin-kitchen-twin/
linkedin: https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A7519170240069427200
image: /assets/img/writing/michelin-kitchen-twin/kitchen-3d.jpg
image_alt: The 3D kitchen twin mid-service, with cooks at their stations under a vaulted ceiling and the kitchen garden in front
image_caption: The live twin at 18:30, an hour and a half into service. Every cook, plate and machine in the scene is the simulation's state.
facts:
  - 53 | Recipes as BOMs and routings
  - 88 | Raw materials, sourced
  - ~0.5 MB | Gzipped, no 3D assets
  - 1 day | First version, parallel agents
stack: [JavaScript, three.js, discrete-event simulation, MRP, OpenUSD, GitHub Pages, Claude Code]
---

I have always been fascinated by how great kitchens work. On a busy night, a tasting-menu restaurant makes hundreds of plates, each one to order, timed to the minute, and inspected before it leaves. That is high-mix, low-volume, just-in-time production with shared machines, skilled labor, perishable inventory and a customer who will not wait. It is the hardest case most factories face, and kitchens solve it every night without software.

So I built a twin of one, using the same vocabulary a plant would. The restaurant is **The French Laundry** in Yountville, California, chosen because it has the most published detail about its kitchen, menu and recipes of any three-star restaurant. Every record in the data cites a source or is marked as an estimate. Pick the number of covers, press play, and a deterministic simulation runs the night. Tickets fire, cooks move, ovens fill, stock drains and the bottleneck moves. The 3D kitchen, the dashboard and the Studio are all views of that one simulation.

![Architecture of the Michelin Kitchen Twin](/assets/img/writing/michelin-kitchen-twin/architecture.svg "One sourced data model feeds an MRP explosion and a discrete-event simulation. The 3D kitchen, dashboard, Studio and OpenUSD export all read the same event log.")

## The five parts

Part 1 is why a kitchen is a good test of a digital twin. Part 2 is the data model: recipes as bills of materials and routings, and the MRP explosion. Part 3 is the discrete-event simulation, KPIs and the optimizer. Part 4 is the photoreal 3D kitchen and the Studio, in about half a megabyte. Part 5 is how five parallel AI agent threads built the first version in a day.

This is an independent, non-commercial project built from publicly available information. It is not affiliated with or endorsed by The French Laundry, Thomas Keller Restaurant Group or the Michelin Guide.
