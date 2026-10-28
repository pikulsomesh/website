---
title: Food Bank Spatial Twin
description: A working digital twin of a representative Texas food bank, built from a public news video in seven days for about $1.54 of compute. No CAD drawings, no laser scans, no site visit. Five parts, from why to the full pipeline and the paper.
status: published
date: 2026-10-28
topic: Physical AI
order: 1
parts_planned: 5
repo: https://github.com/pikulsomesh/foodbank-spatial-twin
live: https://pikulsomesh.github.io/foodbank-spatial-twin/
paper: https://pikulsomesh.github.io/foodbank-spatial-twin/paper/from-video-to-digital-twin.pdf
paper_title: "From Video to Digital Twin: Accelerating Spatial Twins with World Models and NVIDIA Omniverse"
image: /assets/img/writing/foodbank-spatial-twin/facility.jpg
image_alt: Cutaway render of the modeled food bank, with cold storage, racking, volunteer sorting, a client market and a community kitchen
image_caption: The whole building, modeled in Blender by one script and rendered in Cycles. The parts the video showed are also captured as Gaussian splats.
facts:
  - 7 days | First commit to deployed
  - $1.54 | Compute for the build
  - $0.00 | AWS backend billed so far
  - ~$12/mo | To run on real sensors
stack: [World model API, 3D Gaussian splatting, COLMAP, PyTorch, Blender, OpenUSD, AWS SAM + Lambda, Omniverse on EC2, three.js]
---

Digital twins help warehouses plan, schedule and catch failures early, but most of them start from CAD drawings or laser scans. That puts them out of reach for the organizations that could use one and can least afford one, like a regional food bank running a warehouse-scale cold chain on a non-profit budget.

This build asks a narrow question: **is a publicly available video tour enough to start a useful twin?** The answer turned out to be mostly yes. Frames from a local news tour went through a world model and a locally trained Gaussian-splat model to become 3D captures of four areas. A Blender script modeled the rest of the building. A serverless AWS backend serves operations data in the same coordinates, and the twin runs in a browser and in NVIDIA Omniverse. OpenUSD is the only contract between the steps.

The twin is a **representative** food bank inspired by that tour, not a model of any one site, and nobody at the food bank or the news station was involved. Every part of it is labeled as captured, designed, published, estimated or simulated. It is a personal project, done in personal time, because food security matters and because this is the cheapest way I know to show what the current tools can do.

## How to read the series

Each part stands on its own and links to the exact code it describes. Part 1 is the why. Parts 2 to 4 each take one layer: the captures, the building, and the cloud. Part 5 puts the whole pipeline together with the numbers and the paper.
