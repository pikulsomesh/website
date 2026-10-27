---
title: The cloud layer, a digital twin backend on AWS for $0.00
description: A serverless AWS backend serves telemetry and operations data in the twin's own coordinates, a real-sensor path is designed and priced, and Omniverse runs on EC2 GPUs that terminate themselves. What worked and every pitfall.
status: draft
date: 2026-10-31
tags: [aws, serverless, lambda, omniverse, iot, architecture]
image: /assets/img/writing/foodbank-spatial-twin/aws-architecture.jpg
image_alt: Reference architecture of the food bank twin on AWS
---

A twin is geometry plus data. Parts 2 and 3 built the geometry. This part is the data side and where it runs, with one design rule: everything bills only while it runs.

![Reference architecture of the twin on AWS](/assets/img/writing/foodbank-spatial-twin/aws-architecture.jpg "Solid boxes are deployed today, with simulated data. Dashed boxes are the real-sensor path, designed and priced but not installed.")

## The backend is three resources

The whole backend is one AWS SAM template:

| Resource | What it does |
|---|---|
| S3 bucket | Holds the twin's published assets and a copy of the site |
| HTTP API | `GET /telemetry`, `GET /operations`, `GET /health`, throttled to 5 requests a second |
| Lambda (Python, arm64, 128 MB) | Computes the current state of the building from the clock. Stateless, so there is no database |

`/telemetry` returns freezer, cooler and dry-storage temperature, humidity, door state and alarms, plus a forklift looping through the building. `/operations` returns inventory, flows, docks and the kitchen. Every position is in metres in the same frame as the OpenUSD scene, so a viewer can pin a badge to a cold room without a lookup table. Every payload says `simulated: true`.

```bash
scripts/deploy.sh   # sam build + deploy, syncs the site to S3, prints the URLs
```

Measured after deployment: 1,000 sequential calls all succeeded, with a 67 ms median round trip. Cost Explorer showed $0.00 for the month, inside the free tier. Past the free tier, a viewer polling every five seconds around the clock is roughly 60 cents a month.

## The contract is the product

The simulator is deliberately thin. What matters is the JSON contract, because a real feed replaces the simulator without touching any renderer. The real-floor path is designed and priced: LoRaWAN and Bluetooth sensors into AWS IoT Core, a Lambda to normalize, DynamoDB for state. For one facility that is about $2,700 of hardware once and about $12 a month to run.

The same design maps onto Azure and Google Cloud, with two honest caveats. Azure IoT Hub has no LoRaWAN network server, so it needs a partner. Google Cloud IoT Core was retired in 2023. Both are designs only and have never been deployed.

## Omniverse on a GPU that cannot outlive the job

Omniverse needs a GPU, and a GPU left running is the classic cloud bill surprise. So the render runs on a single EC2 instance launched for one job: no SSH key, no IAM role, inputs and outputs through presigned S3 URLs, a hard shutdown timer, and shutdown set to terminate. Seven runs took about 94 instance-minutes and about $1.34.

It took seven runs because of these, in the order I hit them:

1. **Driver too new.** The current Deep Learning AMI's driver crashed Isaac Sim 5.1 a second after start, even on an empty scene. Plain Ubuntu with the 580 server driver worked.
2. **Test with a cube first.** A one-cube stage separates "the GPU stack is broken" from "my scene is broken". It took four runs to learn the scene was never the problem.
3. **New accounts have zero GPU quota.** Ask on day one. Approval took about an hour, plus 30 minutes to apply.
4. **Budget 12 minutes to the first frame.** Boot, a 4.5-minute container pull, and a 5-minute shader cache build. Render everything in one session.
5. **Have a fallback instance type.** On the last run there was no g6.xlarge capacity in the region. A g5.xlarge ran the same setup unchanged.
6. **Splats rendered blank.** Omniverse rendered the Blender building in RTX, but drew the splat captures as a grey frame. The browser shows the splats instead.

![The modeled facility rendered in Omniverse RTX on an AWS GPU](/assets/img/writing/foodbank-spatial-twin/omniverse-forklift.jpg "The Blender facility rendered in Omniverse RTX on an EC2 GPU, with the forklift on its route.")

Tomorrow: the whole pipeline end to end, the full cost picture, and the paper.
