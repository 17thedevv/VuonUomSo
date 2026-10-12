# V3 Roadmap — Cloud-backed PWA & Feature Expansion

**Status: PROPOSED DESIGN ROADMAP, NOT AN IMPLEMENTATION APPROVAL.** V3-0 documentation and decision review only is authorized. All executable backend, auth, cloud data, user onboarding and production migration are gated. REM-05 remains independent and pilot remains NO-GO until explicit re-audit/approval. This roadmap does not retroactively close any historical gates or silently adopt PR #29/#31/#58.

## Architecture target

React + TypeScript Vite PWA; NestJS modular monolith + Express; PostgreSQL + Prisma; Supabase Auth. Dexie IndexedDB is a **tenant-scoped offline cache and durable pending outbox** after explicit cutover. Render is optional for synthetic staging, never the hosting constraint. References: ADR-003, V3 schema draft, sync and migration docs.

## Product roadmap vs academic presentation

V3 is the roadmap of the **real Vườn Ươm product**. The Cloud Computing mini-project may document and demo one stable version of the product, but it does not create a parallel product roadmap.

- Product requirements and architecture are chosen for real user/domain needs.
- Coursework must not force a feature, provider, migration, deadline or architecture that the product would not otherwise need.
- At report/demo time, pin a stable commit/tag as the **course snapshot**; `main` continues normal product development.
- If `main` is mid-slice, demo the nearest stable snapshot instead of rushing unfinished work.
- Course-specific report/deployment/demo material lives under [docs/academic/cloud-computing-2026/](../academic/cloud-computing-2026/PROJECT-BOUNDARY.md) and is presentation-only authority.
- High-level planning is mirrored in [Notion — V3 Product & Delivery Plan](https://app.notion.com/p/3f7368d81eff81e4861afe3ae14692d1); GitHub docs and `.agent/PROJECT_STATE.md` remain implementation/review authority.

## Delivery slices and entry/exit gates

| Phase | Features | Entry / exit / authorization |
|---|---|---|
| V3-0 (NOW, docs only) | ADR, tenancy/roles, relational schema draft, sync protocol, safe migration design, feature inventory, staged rollout and product/course boundary | Draft docs-only PR; independent architectural/security review; no package changes, services, live data or new DB |
| V3-1 (PENDING) | Login/signup, email verification/recovery, user profile, organization onboarding, garden membership invites and revocation | Explicit auth/privacy/role contract and sandbox credentials; anonymous and denied tenant tests |
| V3-2 (PENDING) | Server CRUD + immutable audit for garden, batches, contacts, orders, reservation, shipment, dossier; backup staging/import & explicit cutover | Exact test parity with current domain; atomic transactions; reconciliation; read-only migration preview and server restore drill |
| V3-3 (PENDING) | Multi-device online sync, offline cache/outbox, re-auth, conflict/duplicate handling, data versioning, retries | Two-device native concurrency; idempotency; no overselling; revoke/switch tenant/failed sync evidence |
| V3-4 (PENDING) | Interactive tutorial, first-run walkthrough, task-based guides, searchable help, progress per user, offline help assets | Evidence-based UX copy, opt-out/restart tutorial, screen-reader, Telex/VNI/mobile acceptance |
| V3-5 (PENDING) | Reports, notifications, staff workload, photos, cross-garden planning subject to contract, export/share improvements | Product discovery, scoped feature-by-feature PRs; explicit privacy/cost/support model |

## Priority feature inventory (proposal only)

- **P0 foundation:** identity, tenant/org/garden switch, permission matrix, audit, backups, migrations, offline correctness and REST/OpenAPI contract.
- **P1 high-value:** member invitation, garden assignment, tutorial checklist, explicit pending/offline banner, conflict inbox and device sync status, secure share/export.
- **P2 discovery candidates:** crop photographs, task reminders, notifications, dashboards, richer filtering, printable reports, Zalo-friendly sharing.
- **DEFER:** AI automation, MCP control, payment/debt inference, autonomous stock decisions, cross-garden pooled reservations, platform superuser impersonation without auditable reason.

## Feature gates

Every feature requires (a) field contracts/validation, (b) per-tenant authorization matrix and negative tests, (c) DomainEvent and idempotency invariants when writing, (d) offline behavior/conflict policy, (e) accessibility/native Vietnamese IME and phone width, (f) privacy/retention and export implications, (g) reviewed exact-head CI + explicit approval before merge. No broad merge of unfinished V3 slices.

## Baseline and historical status

QA-01 PR #59 merged as 09c98f70f8358c3c78baa039c10edd67403de532; main push CI #38232017795 completed **SUCCESS** on attempt 1. Draft PR #60 initial V3-0 head CI #38232994935 also completed **SUCCESS**; any later documentation head must pass its own CI before merge. REM-05 PR #58 remains OPEN/DRAFT/UNMERGED from the V3-0 baseline. Preserve NO-GO for the original real pilot until its gates are explicitly reconsidered; the V3 product-development direction is **not** pilot authorization.
