# ADR-003 — V3 Cloud-backed Architecture

- Status: **V3-0 DESIGN FROZEN / PENDING INDEPENDENT REVIEW + MERGE**. The architecture/API/auth/sync/migration design is implementation-ready; executable backend, provisioning, live migration, deployment, real tenant data and real pilot remain phase-gated.
- Date: 2026-10-12
- Baseline: QA-01 PR #59 merged on main at 09c98f70f8358c3c78baa039c10edd67403de532. REM-05 PR #58 remains independently gated.
- Frozen initial decision: React 19 + Vite PWA; NestJS 12 modular monolith with Express; PostgreSQL; Prisma 7; Supabase Auth; Dexie/IndexedDB tenant-scoped cache plus durable offline command outbox. Render is a test host, not an architecture requirement.

## Motivation and boundaries

Current source uses a Dexie database VuonUomDB, currently 11 stores: 9 business stores (organizations, settings, contacts, batches, orders, reservations, shipments, dossiers, events) plus pilotSessions and validationEvents. Backup v1 exports exactly the nine business stores and never research telemetry. Server migration cannot merely upload the browser database and treat every historical record as multi-tenant.

- PostgreSQL is authoritative for all committed business facts after explicit **per-garden cutover**, never before.
- IndexedDB remains primary for instant launch and *pending/tentative* offline drafts and commands; offline data is **not** proof that a server-side reservation was accepted.
- Supabase Auth owns credentials, email verification, password recovery, access/refresh-token lifecycle. NestJS verifies token signature, issuer, audience, expiration and authorized subject, then independently authorizes organization/garden membership on every request. Prefer asymmetric signing keys/JWKS; no service-role key or JWT secret in browser.
- NestJS owns business invariants and transaction boundaries; Prisma is the database access layer, not a source of domain permission rules. REST + OpenAPI is the initial API contract; no GraphQL/microservices requirement. Canonical V3 endpoint/DTO/error/idempotency design is maintained in [V3-API-CONTRACT.md](./V3-API-CONTRACT.md).
- Share portable pure TypeScript invariants from web/src/domain/ only after auditing transitive browser imports; backend owns persisted canonical results. Do not share mutable Dexie repositories or authorization code across client/server.

## Product / academic boundary

This architecture is selected for the **Vườn Ươm product**, not to satisfy a course rubric. The Cloud Computing mini-project may use an actual stable deployment of Vườn Ươm as its case study, but it does not become an architecture authority.

- Do not add a cloud component, provider, feature or migration solely because a presentation requires it.
- The public-cloud service shown in coursework should reflect the product's actual approved deployment at the chosen demo snapshot.
- A course deadline must not bypass V3 phase gates, security review, migration safeguards, tenant isolation or pilot authorization.
- The demo/report should pin a stable commit/tag while normal product development continues on `main`.
- Course-specific documents belong under `docs/academic/`; contradictions are resolved in favor of ADR/product/domain authority.

## Multi-tenant organizational decision

- A person may belong to **multiple organizations and multiple gardens**, with different roles in each.
- Organization 1:N Garden; User N:M Organization via OrganizationMember; User N:M Garden via GardenMember; one garden belongs to exactly one organization.
- Frozen organization roles: OWNER, ADMIN, MEMBER. Frozen garden roles: OWNER, MANAGER, WORKER, VIEWER. Exact privileges/invitation governance are defined in [V3-AUTHORIZATION-CONTRACT.md](./V3-AUTHORIZATION-CONTRACT.md).
- Platform support admin is an isolated, audited break-glass role **not implicitly an owner of tenant data**.
- Contacts are organization-scoped shared directory entries; operational batches, orders, reservations, shipments, dossiers and audit events are garden-scoped. Cross-garden order fulfillment or transfer is **out of scope** pending an explicit product contract.
- Every business query filters tenant scope derived from a verified server-side membership, not solely a client-supplied organizationId/gardenId. Composite tenant-aware foreign keys and indexes provide additional isolation; provide database RLS defense in depth if direct database access is ever permitted.
- Removing garden access must revoke further sync; don't continue displaying another tenant's cached data when switching users or organizations.

## Correctness contract (non-negotiable)

- Living stock, ready stock, available stock and outstanding reservation are distinct. Available = max(ready - active outstanding, 0), with legitimate commitment shortages displayed, not hidden.
- A reserve command must atomically read/check current authority, compare expected version, apply reservation and append immutable audit event + changefeed + idempotency receipt in a single PostgreSQL transaction; suitable row locking or SERIALIZABLE isolation with bounded retry is required. ACID is necessary, not by itself proof of no oversell.
- Own batch reservation and external supplier acknowledgement remain semantically distinct. No inferred external stock, debt, or supplier commitment. Do not automatically create a reservation when creating an order.
- One open planned shipment per order remains a domain invariant; implement a partial unique database index in reviewed SQL migration as well as service checks.
- Quantities use integer tree units, bounded by JS MAX_SAFE_INTEGER at API edges. PostgreSQL BIGINT should be serialized as decimal strings until validated, not lossy JS numbers. Price VNĐ integer (0..1,000,000,000 for new commands); preserve historic values read-only during migration.
- Every action includes actor, garden, command ID, expected versions, event lineage and a database-owned receipt. Undo is a new explicit compensating command with fresh validation, not a blind rollback of someone else's subsequent change.

## Security, privacy and operations

HTTPS/TLS only; verified JWT; deny-by-default authorization; parameterized queries; CORS allowlist; rate limiting; secure log redaction; tenant-bound API error responses; non-public backups; at-rest encryption provided by infrastructure. Keys are environment-specific, never committed. Operational admin tooling is separate from tenant roles. Set retention and erasure policy before collecting real accounts. Email/phone are personal data: audit access to exports and migration.

## Non-goals / implementation gates

No production credentials, provider provisioning, executable schema migrations, deployment or real-user data in V3-0. The previously open permission/invitation/toolchain/device/cursor/import/Undo design blockers are frozen in the linked V3 contracts. Implementation still must prove the frozen design with tests, Prisma validation/generated SQL review and sandbox auth/database evidence. **Do not promise fully automatic background sync on iOS**; foreground reconnect/manual retry remains the correctness path.

## Alternatives recorded

- Fastify: possible NestJS adapter later based on benchmark; not a constraint now.
- Supabase-only database functions: fewer backend components, but weaker fit for complex server-owned stock/reservation business workflows under this product choice.
- Local-only current architecture: continues unchanged until an explicit cutover gate, but does not satisfy account/multi-device cloud requirements.
- Microservices: rejected for initial V3 due to complexity with little evidence of need.

## References

- Internal: [V3 API Contract](./V3-API-CONTRACT.md), [V3 Authorization Contract](./V3-AUTHORIZATION-CONTRACT.md), [V3 Implementation Foundation](./V3-IMPLEMENTATION-FOUNDATION.md), [V3 Sync Protocol](./V3-SYNC-PROTOCOL.md), [V3 Data Model Notes](./V3-DATA-MODEL-NOTES.md), [machine-readable OpenAPI](../api/v3.openapi.json), web/src/data/db.ts, web/src/domain/{batch,order,reservation,shipment}.ts, web/src/data/backup/*; QA-01 PR #59; REM-05 PR #58.
- External: https://docs.nestjs.com/guards ; https://docs.nestjs.com/openapi/security ; https://supabase.com/docs/guides/auth/jwts ; https://www.prisma.io/docs/orm/prisma-client/queries/transactions
