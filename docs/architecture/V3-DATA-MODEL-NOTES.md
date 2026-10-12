# V3-0 — PostgreSQL / Prisma schema design review notes

**Status: DRAFT ONLY.** Accompanying file: docs/architecture/drafts/v3-schema.prisma. It is an *illustrative model sketch*: not a checked-in backend package, generated migration or deployable service. Prisma version/config syntax must be selected and validated with prisma validate in a future authorized implementation slice.

## Relationships and scope

- AppUser is mapped to externally verified Supabase subject; never import password hashes or use an AppUser row as authentication proof.
- One Organization has many Gardens; OrganizationMember gives organization-level role, GardenMember gives different per-garden role to the same user. A user may participate in any number of organizations/gardens. An invitation/member-in-organization prerequisite is a reviewed authorization constraint, not automatically guaranteed by two separate membership tables.
- Organization-scoped Contact may have both customer/supplier roles. Raw display phone is preserved; phoneNormalized is an indexed search key but **not unique** because explicit duplicate contacts remain supported.
- Garden-scoped Batch, Order, Reservation, Shipment, ShipmentLine, BatchDossier, DomainEvent, AppliedMutation and ChangeLog use tenant-bound foreign keys. GardenSetting replaces only reviewed local setting keys; current generic local settings must be mapped individually.
- Reservation sourceType own_batch requires batchId and excludes supplierId; external_supplier requires supplierId and excludes batchId. Conditional CHECK constraints plus service/domain tests are required in eventual migrations. No aggregate warehouse/garden cross-inference.
- Shipment lines must reference a reservation in the same garden. Domain event is append-only; audit event retention/version policy is separate from replication ChangeLog and idempotency AppliedMutation.
- MigrationImport records staged import ownership and digest; actual historical-to-cloud ID map and private staged blob storage will need a separate design/implementation. Do not put business backup payloads into public buckets.
- TutorialProgress is per authenticated user/guide key; optional garden-scoped progression and tutorial publication management are future UX decisions.

## Postgres correctness constraints NOT fully expressed by the illustrative Prisma models

1. Use CHECK constraints: positive original/reservation/planned quantities, nonnegative current/ready/fulfilled, ready<=current, fulfilled<=quantity, valid enum/source combinations, unitPrice new-command cap, version>=1. Some legacy import exceptions may require a quarantined read-only migration route.
2. Use a **partial unique index** for one shipment with status planned per (gardenId, orderId). Review its relation to historic completed shipments.
3. Consider tenant-aware composite FKs, prevent cross-garden links, prevent a GardenMember belonging to a different organization by a server/DB invariant, and reject hard deletes of referenced audit entities.
4. Use PostgreSQL transactions with appropriate row-level locking or SERIALIZABLE retry to ensure reservations never oversell. Check version as part of the write predicate; insert DomainEvent/AppliedMutation/ChangeLog atomically.
5. Keep canonical monotonic sequence in ChangeLog; safe cursor protocol must handle commit ordering, gaps, retention and pagination. Do not treat incrementing sequence allocation as proof of commit ordering without transaction design.
6. For JS clients, serialize BIGINT quantities to decimal strings with canonical checked integer parsing. Never silently coerce through floating point. Test MAX_SAFE_INTEGER and aggregates.
7. Define explicit data retention, access logs, export/erasure behavior, backups and point-in-time recovery before hosting real tenant data.

## Schema review checklist

- Tenant isolation: User A owner Garden 1, worker Garden 2, outsider Garden 3; all GET/list/mutate/import/sync commands are correctly scoped, including count/search/export.
- Identity: revoked account, expired JWT, wrong audience, wrong issuer, manipulated gardenId, switched account/device, shared cached storage.
- Concurrent operations: 2 devices reserve last available trees; stale version conflicts without orphan events. Offline client remains pending, not falsely confirmed.
- Migration: same legacy id across tenants, own/external reservation source mismatch, retained historical shortages, old phone data, dossier refs, partially shipped orders and event links.
- Data preservation: 9 business stores exactly, 2 telemetry stores excluded; never delete original IndexedDB on a cloud import.

## Decision blockers to resolve at independent review

- Prisma major version pin, exact compatible generator/database connection configuration, extensions and migration toolchain.
- Final OrganizationMember and GardenMember rights, invitation policy, privacy/retention and tenancy defense-in-depth.
- Whether contacts are shared within one Organization (current proposal) and what happens when a user moves a contact to another garden.
- Read-only historical record import exceptions, schema evolution and migration provenance.
- Database revision/changefeed ordering strategy and authorized device sync cadence.
