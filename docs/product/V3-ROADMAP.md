# V3 Roadmap — Cloud-backed PWA & Feature Expansion

**Status: PROPOSED DESIGN ROADMAP, NOT AN IMPLEMENTATION APPROVAL.** V3-0 documentation and decision review only is authorized. All executable backend, auth, cloud data, user onboarding and production migration are gated. REM-05 remains independent and pilot remains NO-GO until explicit re-audit/approval. This roadmap does not retroactively close any historical gates or silently adopt PR #29/#31/#58.

## Architecture target

React + TypeScript Vite PWA; NestJS modular monolith + Express; PostgreSQL + Prisma; Supabase Auth. Dexie IndexedDB is a **tenant-scoped offline cache and durable pending outbox** after explicit cutover. Render is optional for synthetic staging, never the hosting constraint. References: ADR-003, V3 schema draft, sync and migration docs.

## Delivery slices and entry/exit gates

| Phase | Features | Entry / exit / authorization |
|---|---|---|
| V3-0 (NOW, docs only) | ADR, tenancy/roles, relational schema draft, sync protocol, safe migration design, feature inventory and staged rollout | Draft docs-only PR; independent architectural/security review; no package changes, services, live data or new DB |
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

QA-01 PR #59 merged as 09c98f70f8358c3c78baa039c10edd67403de532; its main push CI is a separate gate. REM-05 PR #58 remains OPEN/DRAFT/UNMERGED at V3-0 branch creation. Preserve STOP FEATURE BUILD and NO-GO for the original real pilot until historical audit is explicitly reconsidered; the new V3 product-development approval is **not** pilot authorization.
