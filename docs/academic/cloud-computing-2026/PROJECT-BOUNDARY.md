# Cloud Computing Mini-project — Presentation Boundary

**Status:** documentation/presentation boundary only. This file does not authorize product features, cloud provisioning, deployment, migration or real-user data collection.

## Purpose

Use **Vườn Ươm** itself as the mini-project case study for the Cloud Computing course while product development continues normally.

The course work is a presentation layer over the real product:

```text
Vườn Ươm product roadmap (V3)
        |
        +-- normal development continues on main
        |
        +-- stable commit/tag selected for course snapshot
                |
                +-- report
                +-- deployment guide
                +-- screenshots
                +-- presentation
                +-- demo script
```

## Non-negotiable boundary

- Do not build a separate "course version" of Vườn Ươm.
- Do not add features solely to make the report look larger.
- Do not change architecture solely because a course suggests a provider.
- Do not rush an unfinished V3 slice to meet a demo date.
- Do not treat course documentation as implementation authority.
- If the latest `main` is unstable or mid-slice, demo the nearest stable snapshot.

## Snapshot procedure

Before preparing the final report/demo:

1. Select a commit that has passed the project's normal review/CI gates.
2. Create a clearly named tag or recorded commit SHA for the course snapshot.
3. Record the exact frontend/backend/database/auth deployment state used by that snapshot.
4. Capture deployment steps and screenshots against that exact snapshot.
5. Keep `main` free to continue normal product development.
6. If the product changes after the snapshot, update the course snapshot only when the newer version is independently stable; do not silently mix screenshots/steps from different versions.

Suggested tag pattern:

```text
course/cloud-computing-2026
```

or a versioned equivalent when the release point is known.

## Mapping to the course report

The report can be produced from real product evidence:

| Course section | Vườn Ươm evidence |
|---|---|
| 1. Problem | nursery operations, batches, availability, reservations, orders, fulfillment/shipment |
| 2. Selected cloud service | actual approved services used by the snapshot; explain why they fit the workload |
| 3. Team assignment | real workstreams: frontend, backend/domain, cloud/deployment, QA/docs |
| 4. Plan | relevant V3 phases/milestones, without pretending the course owns the roadmap |
| 5. Deployment steps | exact deployment procedure for the pinned snapshot, with screenshots |
| 6. Result | actual product UI/features and deployed behavior |
| 7. Conclusion/future | current limitations plus the real V3 roadmap after the snapshot |

## Cloud provider rule

The course recommends public-cloud services that are appropriate and cost-controlled. Provider choice must still follow product needs and the approved V3 architecture.

Render or any other provider may be used for staging/demo if appropriate, but **hosting convenience must not redefine the architecture**. Document costs/free-tier limitations and avoid uncontrolled billing.

## Source of truth

Priority when documents conflict:

1. Current explicit owner decision.
2. `.agent/PROJECT_STATE.md`.
3. Approved ADR/domain/product contracts in GitHub.
4. `docs/product/V3-ROADMAP.md`.
5. Notion V3 Product & Delivery Plan for high-level planning context.
6. This academic folder and course presentation material.

Course material may summarize higher-authority sources but must not override them.

## Current V3 reference

- V3-0: architecture/product foundation, docs/design only.
- Target: React/Vite PWA + NestJS modular monolith + PostgreSQL/Prisma + Supabase Auth.
- Dexie/IndexedDB remains tenant-scoped offline cache/outbox after explicit cutover.
- Multi-organization / multi-garden membership is part of the product design.
- Real pilot, live migration, production auth and real tenant data remain separately gated until explicitly authorized.
