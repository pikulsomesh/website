---
title: Covers as the build plan, recipes as bills of materials
description: The data model behind the kitchen twin. 53 recipes as bills of materials and routings, 88 sourced raw materials, and a classic MRP explosion that turns covers into plates, prep batches, grams of ingredients and minutes of work per cook.
status: published
date: 2026-10-28
tags: [mrp, bill of materials, routing, data model, manufacturing]
image: /assets/img/writing/michelin-kitchen-twin/architecture.svg
image_alt: Architecture of the Michelin Kitchen Twin
---

A twin is only as good as its master data. For this one, every file in `/data` maps to a standard manufacturing object, so the simulation and the 3D scene can read the kitchen the way an ERP or MES reads a plant.

## The master data

| File | What it holds | Manufacturing object |
|---|---|---|
| `restaurant.json` | The kitchen, annex and dining room | Plant |
| `menu.json` | Courses, choices, supplements, eating times | Product catalog |
| `service.json` | Covers, seatings, variability, what-ifs | Build plan and scenarios |
| `items.json` | 88 ingredients with yield, storage and shelf life | Item master |
| `products.json` | 38 sub-assemblies and 15 plated dishes, each with `bom` and `routing` | BOMs and routings |
| `resources.json` | 10 work centers, 32 machines, 10 storage locations, 14 roles, 19 staff | Resources and skills matrix |
| `layout.json` | Positions of every station and machine | Plant layout |
| `sources.json` | 14 publications | Traceability |

Every record has a `src` list pointing at the sources, or `est: true` when it is a modeling estimate. A validator checks every reference: items, work centers, equipment, roles, storage locations, sources and positions. It also checks that option shares sum to 1.

## From covers to a production plan

The planning step is a classic MRP explosion. It runs in four steps, and the same code runs in the browser and in Node.

**Demand.** Covers become plates. Option shares (70% beef, 30% veal tongue) and supplement uptake (20% caviar, 25% foie gras) apply as expected values, rounded up.

**Explosion.** The bills of materials are walked in low-level-code order, so every parent is processed before its children. Sub-assemblies are made in whole batches, which is why 31 lobsters' worth of demand blanches two batches of 20. Raw materials are grossed up for trim and yield: 900 g of shelled corn needs 2 kg on the cob.

```js
// Trimmed from src/model/mrp.js
export function explode(index, demand, { stockFactor = 1 } = {}) {
  const required = new Map();
  for (const [id, qty] of Object.entries(demand)) required.set(id, (required.get(id) ?? 0) + qty * stockFactor);

  // Parents before children: low-level code order.
  const order = [...index.products.keys()].sort((a, b) => index.lowLevelCode.get(a) - index.lowLevelCode.get(b));
  const make = {};
  for (const id of order) {
    const need = required.get(id) ?? 0;
    if (need <= 0) continue;
    const p = index.products.get(id);
    const isFinished = p.type === 'finished';
    const qty = isFinished ? Math.ceil(need) : need;
    // Plates are made one by one; prep is made in whole batches.
    const batches = isFinished ? qty / p.batchYield : Math.ceil(qty / p.batchYield - 1e-9);
    const produced = isFinished ? qty : batches * p.batchYield;
    make[id] = { id, name: p.name, type: p.type, required: need, batches, produced, phase: p.phase };
    for (const c of p.bom) required.set(c.item, (required.get(c.item) ?? 0) + c.qty * batches);
  }

  // Net to gross: trim, shelling and peeling losses.
  const raw = {};
  for (const [id, net] of required) {
    const item = index.items.get(id);
    if (item) raw[id] = { id, name: item.name, net, gross: net / (item.yieldPct || 1) };
  }
  // ...then every routing operation becomes labor and machine minutes.
}
```

The small `- 1e-9` matters. Floating-point demand like 2.0000000001 batches would otherwise round up to a whole extra batch of veal stock.

**Load.** Every routing operation becomes labor minutes for a role and machine minutes for a piece of equipment. Labor is scaled by a hands-on fraction, because a cook is not standing at the combi while it runs. Operations are split into `prep`, which is mise en place before service, and `service`, which is cooked to order when a ticket fires.

**Capacity.** Labor minutes are compared with rostered minutes per role and shift.

```sh
npm run plan -- 62    # one full turn of the dining room
npm run plan -- 120   # a double turn
```

At 62 covers every station has headroom. At 120 the fish commis needs 105% of the prep time the shift allows, and the fish and meat chefs de partie run at 90 to 93% during service. Those are the bottlenecks the simulation later shows live. The stock-pot ranges carry about 20 hours of simmering, which is why a real kitchen makes veal stock and corned tongue days ahead. The planner reports those lead times too: corned tongue is about 76 hours and the foie gras torchon about 49.

## Testing the data against published recipes

A planning model is easy to get subtly wrong, so it is tested against something real. For dishes with a published recipe, the test checks that the explosion reproduces the published quantities. The signature oysters-and-caviar course is one of them. If someone edits a yield or a batch size and breaks it, the test fails.

## Being honest about what is estimated

The menu is a composite, because the real one changes daily. Quantities for courses with no published recipe are typical fine-dining portions. Operation times not stated in a recipe come from professional practice, and brigade size, shifts and machine positions are informed estimates. Ingredient prices are typical US wholesale prices. All of it is flagged in the data, so anyone using the model knows which numbers to challenge first.

[Part 3](/writing/michelin-kitchen-twin/simulating-dinner-service/) turns this plan into a simulated night.
