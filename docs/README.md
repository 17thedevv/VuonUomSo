# Vườn Ươm — Project Documentation

Thư mục `docs/` chứa product contracts, architecture decisions, UX, development evidence và academic presentation material của **Vườn Ươm**.

Trạng thái phase hiện tại luôn lấy từ [`.agent/PROJECT_STATE.md`](../.agent/PROJECT_STATE.md), không suy ra từ tuổi của một file tài liệu.

## Current V3 design set

V3 hiện ở **V3-0 — design complete, pending exact-head CI/independent review/merge**. Runtime vẫn chưa được mở.

- [V3 Roadmap](product/V3-ROADMAP.md)
- [ADR-003 — Cloud-backed Architecture](architecture/ADR-003-CLOUD-BACKED-ARCHITECTURE.md)
- [V3 API Contract](architecture/V3-API-CONTRACT.md)
- [Machine-readable OpenAPI](api/v3.openapi.json)
- [V3 Authorization Contract](architecture/V3-AUTHORIZATION-CONTRACT.md)
- [V3 Implementation Foundation](architecture/V3-IMPLEMENTATION-FOUNDATION.md)
- [V3 Data Model Notes](architecture/V3-DATA-MODEL-NOTES.md)
- [V3 Prisma Draft](architecture/drafts/v3-schema.prisma)
- [V3 Sync Protocol](architecture/V3-SYNC-PROTOCOL.md)
- [V3 Local-to-Cloud Migration](architecture/V3-LOCAL-TO-CLOUD-MIGRATION.md)
- [V3-1 Two-person Implementation Handoff](development/V3-1-IMPLEMENTATION-HANDOFF.md)
- [Cloud Computing Project Boundary](academic/cloud-computing-2026/PROJECT-BOUNDARY.md)

Target design:

```text
React/Vite PWA
  ↕ REST/OpenAPI
NestJS modular monolith
  ↕ Prisma
PostgreSQL

Supabase Auth
Dexie tenant-scoped cache + pending outbox after cutover
```

V3-0 documentation does **not** authorize backend runtime, cloud provisioning, live migration, production deployment or real tenant data.

## Documentation structure

```text
docs/
├── architecture/   # ADR, API/data/sync/migration contracts and architecture audits
├── product/        # roadmap, product contracts, workflow/IA
├── ux/             # mobile/Zalo-first UX guidance
├── development/    # implementation/acceptance/history evidence
└── academic/       # course/report/demo packaging only
```

## Historical V2/FC material

V2/FC documents remain valuable as accepted domain/history evidence, especially for quantity/reservation/shipment semantics. They are **not the current roadmap authority** unless V3 docs explicitly reference those frozen semantics.

Important retained sources include:

- [V2 Roadmap](product/V2-ROADMAP.md)
- [V2-A Functional Contract](product/V2-A-FUNCTIONAL-CONTRACT.md)
- [Workflow Audit](product/V2-WORKFLOW-AUDIT.md)
- [Information Architecture](product/V2-INFORMATION-ARCHITECTURE.md)
- [Route & Component Map](product/V2-ROUTE-COMPONENT-MAP.md)
- [General-Commerce Readiness Audit](architecture/GENERAL-COMMERCE-READINESS-AUDIT.md)
- FC3/FC4 functional contracts for reservation/fulfillment truth.

## Source authority

When documents conflict:

1. explicit current owner decision;
2. `.agent/PROJECT_STATE.md`;
3. approved ADR/domain/product contracts;
4. V3 roadmap;
5. high-level planning mirrors;
6. academic presentation material.

Course material may summarize the product but cannot change product architecture or phase gates.
