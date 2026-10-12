# V3-0 — Offline Sync Protocol (draft; NO implementation)

Status: **DESIGN ONLY / NOT APPROVED FOR DEPLOYMENT**. All quantities and reservations are server-authoritative after explicit cutover. Browser background-sync availability varies; foreground reconnect and manual retry are mandatory.

## Command envelope

~~~json
{
  "protocolVersion": 1,
  "mutationId": "client-generated-uuid",
  "idempotencyKey": "stable-uuid-for-this-intent",
  "deviceId": "registered-installation-id",
  "gardenId": "garden-uuid",
  "action": "batch.set_ready_quantity",
  "expectedVersions": { "batch:batch-uuid": 7 },
  "payload": { "batchId": "batch-uuid", "newReadyQuantity": "25000" },
  "clientCreatedAt": "2026-10-12T09:00:00.000Z"
}
~~~

- Bearer token identifies user; body gardenId is *untrusted*. Backend resolves garden membership and checks per-action permission.
- Protocol/schema versions are explicit; no unknown action execution; canonical IDs returned by server, not inferred from client timestamps.
- Idempotency receipt uniqueness: (gardenId, idempotencyKey). Same key + identical canonical payload hash returns the original durable response, even on retries or server restarts. Reuse with different payload is 409 and **never executes**. Do not rely on UUID randomness alone as validation.
- Atomically commit mutation + version increments + immutable DomainEvent + ChangeLog + AppliedMutation receipt. After commit, re-pull canonical server state; the client may not infer success from a timeout.
- API examples: POST /v3/gardens/{gardenId}/commands; GET /v3/gardens/{gardenId}/changes?cursor=opaque; GET /v3/gardens/{gardenId}/snapshot. Pagination and cursor continuity are required.
- Response has status APPLIED, CONFLICT, VALIDATION_REJECTED or FORBIDDEN; error codes are stable, no cross-tenant metadata leaks. A 401 pauses the outbox until explicit reauthentication.

## Client durable state

Dexie stores a cache per authenticated user + organization + garden + environment, and an outbox entry with original immutable command body, retry count, last error, creation timestamp and ack server cursor. Both optimistic UI projection and outbox persistence must happen atomically; failure to persist means no success UI.

Only one in-flight replay per garden/install. Retry transient 5xx/network errors with bounded exponential backoff; never generate a new idempotencyKey when retrying the same intent. Handle offline device duplicates and HTTP timeouts as UNKNOWN until reconciliation. Pull changefeed until an authoritative cursor, apply only complete ordered pages in one IndexedDB transaction. On cursor expiry, obtain a fresh scoped snapshot; never silently drop pending commands.

## Conflict policies

| Command or field | Policy |
|---|---|
| Batch living/ready quantity, own reservation, shipment, release, Undo | Server serializes concurrent writers; stale expectedVersion => CONFLICT. Recheck invariants; do not blindly retry with a new version; display side-by-side resolution |
| Contact name / note / metadata | By default compare versions or field-level revisions; never silently clobber another user's edits. A restricted server-time LWW policy may be proposed only for explicitly non-critical fields and reviewed separately |
| External supplier commitment | Never infer stock or accept an old acknowledgement for a changed source/variety/quantity; explicit re-acknowledgement |
| Offline create of batch/order/contact | Show local PENDING, resolve ID mapping only on ack; remote uniqueness/dedup must be reconciled |
| Revoked member or switched account | Stop replay; isolate local cached business records; user-visible backup/exit flow without leaking other tenants |

## Negative and concurrency tests required before V3-3

Two devices reserve same final stock concurrently; one valid and one conflict, zero oversell. Repeat same key 100 times; exactly one business event. Same key/different payload => reject. Crash between write/event => all roll back. Network timeout after commit => retry returns same receipt. Stale cache and out-of-order changefeed => no regression. Sign-out/switch garden => cannot sync cross-tenant records. Offline 3G, airplane cold start and native iOS/Android keyboard are device gates, not inferred from browser mocks.
