---
title: The whole pipeline, what it cost, and the paper
description: The food bank twin end to end, from video to world model to Blender to AWS to Omniverse, with the full cost picture, what is real versus simulated, what failed, and the paper that documents it.
status: draft
date: 2026-11-01
tags: [digital twin, world models, openusd, research paper]
image: /assets/img/writing/foodbank-spatial-twin/omniverse-forklift.jpg
image_alt: The modeled facility rendered in Omniverse
---

Four parts, four layers. This one puts them together, adds up the cost, and points to the paper that writes it all down properly.

## The pipeline on one page

```
video (MP4)
  -> frames, people masked                       ffmpeg, MediaPipe
  -> world model: poses + metric depth           20 frames, 200 credits
  -> fused splats, and locally trained 3DGS      COLMAP + PyTorch, 0 credits
  -> OpenUSD captures (metres, Y up, floor at 0)

operations data
  -> Blender, headless                           one script
  -> facility.glb (browser) + facility.usdz (Omniverse)

twin.usda = facility + captures + operations, one frame

AWS: S3 + HTTP API + Lambda                      /telemetry, /operations
  -> browser on GitHub Pages | Omniverse on EC2 | Blender
```

OpenUSD is the only interface between the steps. That is what makes the renderer a deployment choice: the browser for anyone with a link, Omniverse when you need RTX and simulation, Blender on a laptop.

## What it cost

| | Cost |
|---|---|
| This build: world model, local training, Blender, AWS, GPU trials | about $1.54 |
| Capture to deployed twin for a full facility of about 135,000 sq ft | about $25 to $50 of cloud spend |
| Real sensors on the floor | about $2,700 once, about $12 a month |
| Omniverse on demand, 10 hours a week | about $124 a month |

These are directional, from public list prices and one individual AWS account. Enterprise discounts, quotas and policies will differ.

## What is real, and what is not

| Part | Kind |
|---|---|
| Racking aisle, sorting room, client market, community kitchen | Captured from the video, partial |
| Absolute scale | Estimated from the world model's metric depth |
| Building shell, cold rooms, staging, kitchen annex | Designed |
| Volumes, capacities, recipes, step times | Published figures or flagged estimates |
| Temperatures, doors, forklifts, inventory | Simulated, and every payload says so |

## What failed

Generating views of unfilmed space failed twice on the provider's side. Omniverse loaded the splat captures and drew them blank. Both are listed in the repo with what I tried. Filling in unseen space is the open step, and it is the one I expect the next round of world models to close.

## The paper

The build is written up as a paper: *From Video to Digital Twin: Accelerating Spatial Twins with World Models and NVIDIA Omniverse*. It covers the method, the provenance labels, the measurements, and the limits, with three supplementary movies.

## What I would tell someone starting one

- Start from footage you already have. It is enough to get a first twin and to find out which parts are worth real money.
- Pick the contract first. Metres, Y up, floor at zero, one scene format. Everything else becomes swappable.
- Label provenance from day one. It is what lets people trust the parts that are real.
- Make every paid step resumable and capped, and make cloud GPUs unable to outlive their job.

Next in Build notes: the Michelin kitchen twin, a three-star kitchen modeled the way a plant is.
