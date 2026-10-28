---
title: Modeling the rest of the building in Blender, from footprints
description: Splat captures only read well from where the camera stood. One headless Blender script models the whole food bank from the operations data and publishes it to the browser and Omniverse in the same OpenUSD frame.
status: published
date: 2026-10-28
tags: [blender, openusd, digital twin, procedural modeling]
image: /assets/img/writing/foodbank-spatial-twin/facility.jpg
image_alt: Cutaway render of the modeled food bank
---

The captures from Part 2 are real, but they are fragments. Each one looks right from its source cameras and breaks up anywhere else, and together they cover a small fraction of the building. The world model was supposed to fill the gaps, and that step failed. A twin that only exists where a news crew happened to walk is not a twin.

## Model the building from the data, not from the video

The fix was to stop asking the video for things it never showed. The operations data already describes the site: the footprint of each area, the cold rooms and their temperature probes, the docks, the racking rows. So the building is modeled from that data, by one script, with Blender running headless as a Python library.

```bash
pip install bpy pillow numpy   # bpy wheels need Python 3.13
python scripts/build_facility.py --blend renders/facility.blend --render docs/img/facility.jpg
```

The script builds the shell and dock doors with a trailer, a cut-away freezer and cooler racked inside, four rows of red selective racking with pallets, receiving and order staging, the volunteer sorting room with roller conveyors and scales, the client market, the community kitchen annex, painted lanes, signage and forklifts. The fit-out is inspired by what the video shows. The layout is designed, and labeled as designed.

Every area is a few lines of data-driven calls. The racking aisles, for example, are four rows placed in the same coordinates the telemetry uses:

```python
def racking():
    B.area = "DryStorage"
    rack_row(17.2, 1.1, 1.0, 8.6, "A1")
    rack_row(21.5, 1.1, 1.0, 8.6, "A2")
    rack_row(22.75, 1.1, 1.0, 8.6, "A3")
    rack_row(24.75, 1.1, 1.0, 8.6, "A4")
```

Underneath, geometry is built from boxes whose hidden faces are skipped, and meshes are merged per area and material. That is why the browser model draws in about 150 calls instead of thousands.

## Same frame as everything else

The model is built in the same coordinate frame as the telemetry: metres, Y up, origin at the dock-door corner. That one decision is why everything lines up without manual fiddling.

![The captured splat zones placed on the facility plan](/assets/img/writing/foodbank-spatial-twin/twin-alignment.jpg "Alignment check: the captured sorting room, market and racking splats dropped onto the facility footprints, in one metric frame.")
 The temperature badges in the browser sit on the cold rooms, the forklift drives the route the telemetry describes, and the captured splats drop into their places on the floor plan.

## One scene, two outputs

From a single Blender scene the script writes:

- `facility.glb` for the browser, about 1.8 MB and about 150 draw calls, so it runs on a phone. One named node is the forklift the live data animates.
- `facility.usdz` for Omniverse and other OpenUSD tools, same frame, same names.
- Optionally a `.blend` to open on a desktop and a Cycles render of the overview.

Every texture is generated procedurally at build time, so the model needs no downloads and the whole thing rebuilds from the repo in minutes.

## Why scripted beats hand-modeled here

A hand-built model is a one-off. A scripted one is a function of the data. Change a footprint in the operations file, and the building, the browser view and the Omniverse stage all change with it on the next build. That is the same discipline a plant uses when the bill of materials drives the build, applied to a building.

[Part 4](/writing/foodbank-spatial-twin/aws-architecture/): the cloud layer. How the data side runs on AWS for $0.00 so far, and what it took to get Omniverse rendering on a rented GPU.
