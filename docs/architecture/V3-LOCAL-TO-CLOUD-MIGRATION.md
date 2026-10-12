# V3-0 — Local IndexedDB to Cloud Migration (draft)

Status: DESIGN ONLY. No data upload, schema migration, auth provisioning, or irreversible local cutover is authorized.

## Source of truth today

Dexie VuonUomDB v5 includes 11 stores. The current Backup V1 **9-business-store** envelope has format vuonuom-backup, formatVersion 1, dbSchemaVersion field 4, and includes organizations/settings/contacts/batches/orders/reservations/shipments/dossiers/events. pilotSessions and validationEvents are intentionally excluded. Never silently change this historical format or mix pilot telemetry into a cloud import.

## Owner-controlled migration

1. First authenticate and select/create exactly one target organization and one target garden. Take a durable local backup and download it to Files/Downloads; checksum and preview record counts.
2. Read the nine stores in the existing coherent Dexie readonly transaction; strict-normalize and validate Backup V1, including references, quantities, source semantics and historical allowed shortage. Malformed => 0 network writes.
3. Send an encrypted HTTPS, authenticated staged-import artifact to backend, bound to target user/org/garden, with full content hash, byte limit, replay token and expiration. Do not include research telemetry or other tenants' local cache.
4. Server validates schema, references and proposed ID remapping. Preview differences and warnings for legacy phones, price/date outliers and collisions; **do not rewrite** historical raw display values. Import preview cannot commit anything.
5. Owner explicitly confirms target garden and digest. Server creates all committed business entities, immutable historical audit records and provenance/import map in a single atomic commit if size permits; otherwise use hidden staging tables plus one publish/cutover transaction. Repeated confirmation of the same digest/import token is idempotent.
6. Compare business-store counts, record IDs via import-map, references, quantities and invariants from server canonical snapshot. Reject hybrid states, mismatched events or cross-garden references. Record import receipt and recovery instructions.
7. Switch that garden to CLOUD_AUTHORITY only after verified consistency and explicit approval. Keep the original local backup untouched until user confirms recovery; retain local offline cache/pending queue bound to this account/garden, not as a second uncoordinated authority.
8. On validation/commit/network failure keep local mode unchanged; expose retry or rollback of invisible staged data. Never full-clear local IndexedDB on migration success.

## ID and tenant mapping

Historical IDs such as contact_..., batch_..., order_... may collide across devices and existing organizations. Use a single per-import typed mapping from (sourceStore, sourceId) to server IDs. Remap orders.customerId; reservations.orderId/batchId/supplierId; shipments.orderId and lines[*].reservationId; dossier.batchId/supplierContactId; events.entityId with entityType namespace. Preserve all historical timestamps/payloads in audit-compatible format, or quarantine undecodable legacy events for explicit review. Do not create fictitious stock reservations.

## Risks / acceptance tests

- Synthetic datasets: empty, 100% valid, mixed valid/invalid, malformed, huge, duplicate historical IDs across gardens, legitimate commitment shortage, sourceType mismatch, overlapping imports, retries and concurrent live writes.
- Two-device/import overlap must not produce duplicated events or partially visible records.
- Unauthorized garden, expired token, tampered hash, tenant-crossing reference => 0 committed writes.
- Test browser refresh, iOS/Android native file backup/recovery and airplane-mode behavior; no claim these gates passed until evidence.
- Data minimization, encryption, retention, purge after failed staged imports and consent text need a separate review.

## Unresolved decisions

One legacy local dataset => one new garden by default; migration of multiple gardens from a single legacy snapshot is **not** inferred. Historical local device may need a read-only verification window. Need agreed size/performance threshold for single-transaction vs staging, and migration rollback operational playbook before launch.
