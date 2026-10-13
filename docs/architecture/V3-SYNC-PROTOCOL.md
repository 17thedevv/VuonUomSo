# V3-0 — Offline Sync Protocol

**Status: DESIGN FROZEN FOR V3-3 IMPLEMENTATION HANDOFF. Runtime implementation remains phase-gated.**

Canonical API shapes live in [V3-API-CONTRACT.md](./V3-API-CONTRACT.md). Data ordering/storage decisions live in [V3-DATA-MODEL-NOTES.md](./V3-DATA-MODEL-NOTES.md).

All committed business facts are server-authoritative after explicit per-garden cutover. Offline client state is pending/tentative until acknowledged.

---

# 1. Device identity

Client generates one random UUID:

```text
clientInstallationId
```

per browser/PWA storage profile + environment.

After authenticated registration:

```http
POST /v3/devices/register
```

server returns canonical `deviceId`.

Every command includes this deviceId. Server verifies it belongs to authenticated actor and is registered.

Device ID is not an authorization substitute.

---

# 2. Command envelope

```json
{
  "protocolVersion": 1,
  "mutationId": "client-generated-uuid",
  "idempotencyKey": "stable-uuid-for-this-intent",
  "deviceId": "registered-device-uuid",
  "gardenId": "garden-uuid",
  "action": "batch.set_ready_quantity",
  "expectedVersions": {
    "batch:batch-uuid": 7
  },
  "payload": {
    "batchId": "batch-uuid",
    "newReadyQuantity": "25000"
  },
  "clientCreatedAt": "2026-10-12T09:00:00.000Z"
}
```

Rules:

- bearer JWT identifies actor;
- body/path garden is untrusted until server membership check;
- unknown protocol/action rejected;
- same business intent retry preserves mutationId and idempotencyKey;
- quantities are decimal strings;
- client timestamps are diagnostic only, never server ordering authority.

---

# 3. Idempotency

Uniqueness:

```text
(gardenId, idempotencyKey)
(gardenId, mutationId)
```

Same idempotency key + same canonical request hash:

- return original durable response;
- do not run domain mutation again.

Same key + different canonical request:

```text
409 IDEMPOTENCY_KEY_REUSED
```

with zero second business effect.

Network timeout after submit is:

```text
UNKNOWN
```

until receipt/changefeed/snapshot proves outcome.

Never generate a fresh key simply because HTTP retry occurred.

---

# 4. Atomic server commit

A successful garden business mutation commits in one PostgreSQL transaction:

1. auth/permission checks;
2. expected-version checks;
3. business invariant checks;
4. business rows;
5. DomainEvent;
6. increment Garden.syncRevision exactly once;
7. ChangeLog rows at that revision;
8. AppliedMutation durable receipt.

If any part fails, all roll back.

---

# 5. Per-garden revision ordering

Each Garden owns:

```text
syncRevision BIGINT
```

Mutation transaction serializes revision increment on that garden.

All ChangeLog rows from one mutation receive:

```text
revision = same value
ordinal = 0..N-1
```

ChangeLog identity:

```text
(gardenId, revision, ordinal)
```

A cursor always means “all changes through a complete revision have been applied.”

Do not use raw PostgreSQL sequence allocation as commit-order proof.

---

# 6. Signed opaque cursor

Logical cursor payload:

```json
{
  "v": 1,
  "scope": "garden",
  "scopeId": "garden-uuid",
  "revision": "1234"
}
```

Server base64url-encodes and HMAC-SHA256-signs with server-only `SYNC_CURSOR_HMAC_KEY`.

Server rejects:

- invalid signature;
- wrong scope;
- wrong garden;
- unsupported cursor version;
- revision greater than current authority.

Client stores cursor unchanged and never parses it for business logic.

---

# 7. Changefeed

```http
GET /v3/gardens/{gardenId}/changes?cursor=<opaque>&limit=100
```

Default target:

```text
100 change rows
```

Maximum target:

```text
500 change rows
```

A response **never splits one revision**. One revision may exceed max target.

Example:

```json
{
  "changes": [
    {
      "revision": "1235",
      "ordinal": 0,
      "entityType": "batch",
      "entityId": "uuid",
      "entityVersion": 8,
      "action": "updated",
      "payload": {},
      "createdAt": "2026-10-12T12:00:00.000Z"
    }
  ],
  "nextCursor": "opaque",
  "hasMore": false,
  "organizationContactDirectoryVersion": "42"
}
```

Client applies a complete page atomically in IndexedDB. Every changefeed response also returns the current organization `contactDirectoryVersion`; if it differs from the locally committed contact-cache version, schedule a version-bound contact snapshot refresh.

---

# 8. Retention and cursor expiry

Minimum ChangeLog retention:

```text
90 days
```

Deployments may retain longer.

If cursor predates retained floor:

```http
410 Gone
```

```text
SYNC_CURSOR_EXPIRED
```

Client downloads a fresh garden snapshot.

DomainEvent audit retention is separate and is not deleted just because replication ChangeLog expires.

---

# 9. Garden snapshot

```http
GET /v3/gardens/{gardenId}/snapshot
```

Used for:

- first cloud-authority bootstrap;
- cursor expiry;
- explicit repair/reconciliation.

Server uses one consistent database snapshot:

1. read garden.syncRevision;
2. read canonical garden business data;
3. return signed cursor for that revision.

Example:

```json
{
  "gardenId": "uuid",
  "cursor": "opaque",
  "generatedAt": "2026-10-12T12:00:00.000Z",
  "organizationContactDirectoryVersion": "42",
  "data": {
    "garden": {},
    "batches": [],
    "orders": [],
    "reservations": [],
    "shipments": [],
    "dossiers": []
  }
}
```

Organization contacts are not duplicated here. The snapshot exposes only the current `organizationContactDirectoryVersion`, letting the client decide whether its separate organization contact cache must be refreshed.

---

# 10. Organization contact directory

Contacts are organization-scoped and have:

```text
Organization.contactDirectoryVersion
```

Contact create/update increments version atomically. Garden changefeed and garden snapshot responses expose the current organization directory version as a lightweight invalidation signal; they do not embed contact rows.

Client downloads:

```http
GET /v3/organizations/{organizationId}/contacts/snapshot?limit=100&cursor=<opaque>
```

First page returns directoryVersion. Subsequent cursor is bound to it.

If current directory changes before all pages complete:

```text
409 DIRECTORY_SNAPSHOT_STALE
```

Client:

1. discards temporary pages;
2. restarts snapshot;
3. swaps organization contact cache only after one complete version.

This avoids a second organization changefeed in initial V3.

---

# 11. Client durable state

Dexie cache is partitioned by:

```text
authenticated user
+ organization
+ garden
+ environment
```

Organization contact directory is cached at:

```text
authenticated user
+ organization
+ environment
```

Outbox record stores at least:

- immutable original command;
- mutationId;
- idempotencyKey;
- deviceId;
- garden scope;
- retry count;
- last error;
- client creation timestamp;
- acknowledgement cursor/receipt when known.

Optimistic UI projection + outbox persistence must be one local transaction.

If outbox persistence fails, UI must not claim pending success.

---

# 12. Replay

One in-flight replay loop per garden/installation.

Retry:

- network;
- timeout;
- transient 5xx;
- bounded exponential backoff with jitter.

Do not blind-retry:

- 409 conflict;
- 422 validation;
- 403/404 revoked scope.

401:

- pause outbox;
- require re-auth;
- resume only after authenticated user and garden scope match queued command.

---

# 13. Conflict policies

| Area | Policy |
|---|---|
| batch current/ready quantity | expectedVersion conflict; no silent overwrite |
| own reservation | server rechecks current available and serializes concurrent writers |
| shipment confirmation | explicit version + reservation/stock invariant recheck |
| release/reconciliation | explicit versions and historical F preservation |
| metadata/contact update | version conflict by default |
| offline create | local PENDING until canonical server ID |
| compensation/Undo | new `mutation.compensate` command + fresh current-state validation |
| revoked membership | stop replay, hide/isolate inaccessible cache |

No client “fixes” conflict by simply replacing expectedVersion with latest and resubmitting business intent.

---

# 14. Compensation

Applied result may indicate compensation support.

Client may show Undo.

Undo submission:

```text
mutation.compensate
```

with targetMutationId.

Server re-validates current state. If later changes make it unsafe:

```text
COMPENSATION_CONFLICT
```

No blind inverse patch.

---

# 15. Account/garden switching

Before showing a different account/garden:

- stop current replay;
- detach previous cache view;
- load only correctly partitioned cache;
- register/resolve device for authenticated account;
- authorize selected garden;
- never replay queued command into another tenant.

Logout does not mean deleting a user's backup automatically, but cached inaccessible business data must not remain visible to another account.

---

# 16. Required V3-3 tests

## Idempotency

- same key/request repeated 100 times → exactly one business effect;
- same key/different payload → reject;
- timeout after commit → retry returns original receipt.

## Transaction

- crash/error after business write but before event/receipt → total rollback;
- no orphan ChangeLog/DomainEvent/receipt.

## Concurrency

- two devices reserve final stock concurrently;
- exactly one valid result where capacity only supports one;
- zero oversell.

## Revision/changefeed

- concurrent garden writers produce strictly increasing committed revisions;
- no revision split across pages;
- out-of-order HTTP completion does not regress local state;
- cursor tamper rejected;
- >90-day-expired cursor → snapshot recovery.

## Snapshot

- mutation before snapshot transaction visible with cursor;
- mutation after snapshot not in snapshot and appears in next changefeed;
- applying snapshot + changes converges canonical state.

## Contacts

- contact mutation during directory pagination → DIRECTORY_SNAPSHOT_STALE;
- partial pages never replace current cache.

## Auth/revoke

- revoked membership stops replay immediately despite still-valid JWT;
- account switch cannot read/replay prior tenant;
- foreign deviceId rejected.

## Device/offline

- airplane cold start;
- offline write persists durable queue;
- foreground reconnect sync;
- iOS background sync is not required for correctness.

---

# 17. Browser background-sync position

Do not promise continuous background synchronization.

Correctness path is:

```text
foreground reconnect
+ app resume
+ explicit/manual retry
```

Background Sync API may optimize supported platforms but is never the only delivery mechanism.
