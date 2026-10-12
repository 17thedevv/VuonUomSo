# V3-0 — REST / OpenAPI Contract

**Status: DESIGN FROZEN FOR IMPLEMENTATION HANDOFF. Runtime implementation/deployment still requires the corresponding V3 phase to be explicitly authorized in PROJECT_STATE.**

This document is the canonical narrative frontend/backend API design for Vườn Ươm V3. The machine-readable design contract is [`docs/api/v3.openapi.json`](../api/v3.openapi.json). They must stay semantically aligned so 17thedev and Tráng A Thư can implement separate server/client slices without inventing incompatible DTOs.

Read with:

- [ADR-003](./ADR-003-CLOUD-BACKED-ARCHITECTURE.md)
- [V3 Data Model Notes](./V3-DATA-MODEL-NOTES.md)
- [V3 Sync Protocol](./V3-SYNC-PROTOCOL.md)
- [V3 Local-to-Cloud Migration](./V3-LOCAL-TO-CLOUD-MIGRATION.md)
- [V3 Authorization Contract](./V3-AUTHORIZATION-CONTRACT.md)
- [V3 Implementation Foundation](./V3-IMPLEMENTATION-FOUNDATION.md)
- [V3 Roadmap](../product/V3-ROADMAP.md)

If this document conflicts with an approved domain contract, **domain semantics win** and this API document must be corrected before implementation.

---

## 1. Goals

The API must provide:

1. one stable contract shared by React PWA and NestJS;
2. explicit authentication vs authorization boundaries;
3. organization/garden tenant isolation;
4. canonical server reads after cutover;
5. idempotent, conflict-aware domain writes;
6. offline replay support;
7. BIGINT-safe quantity serialization;
8. coherent snapshot/changefeed for multi-device sync;
9. stable machine-readable errors;
10. OpenAPI-compatible DTOs that can later generate/validate clients.

### Non-goals

V3 API is **not**:

- GraphQL;
- public marketplace API;
- generic CRUD over arbitrary tables;
- microservice/event-sourcing transport;
- realtime WebSocket requirement;
- payment/accounting API;
- MCP/AI control surface.

---

## 2. Canonical base path and versioning

Canonical application paths start with:

```text
/v3
```

Deployment infrastructure may place a reverse proxy/domain in front of this path, but client code must treat the API base origin separately from the canonical path.

Breaking API changes require a reviewed versioning decision; do not silently change V3 field meaning.

### Content type

```http
Content-Type: application/json
Accept: application/json
```

Normal API uses JSON. Legacy import upload is frozen as authenticated `multipart/form-data` with one `application/json` file field, maximum 10 MiB; see §13.

---

## 3. Authentication and authorization

### 3.1 Supabase Auth responsibility

Signup, login, logout, refresh, email verification and password recovery are handled by Supabase Auth client flows. The V3 email/password configuration keeps **Confirm Email enabled** before a new signup can obtain a sign-in session.

They are **not duplicated as NestJS password endpoints**.

### 3.2 NestJS API authentication

Authenticated requests send:

```http
Authorization: Bearer <supabase-access-token>
```

NestJS must verify:

- signature via reviewed JWKS strategy;
- issuer;
- audience;
- expiration;
- subject.

Then server maps verified subject to `AppUser`.

### 3.3 Authorization

JWT identity does not prove garden access.

For every tenant-scoped request, backend must:

1. identify caller;
2. resolve organization/garden membership;
3. check action permission;
4. verify referenced resources belong to same tenant scope;
5. only then query/mutate.

Client-provided `organizationId`, `gardenId`, roles or entity IDs are untrusted.

### 3.4 Tenant enumeration policy

- unauthenticated/invalid token → `401 AUTHENTICATION_REQUIRED`;
- caller can see garden but lacks action permission → `403 PERMISSION_DENIED`;
- garden/entity is outside caller-visible scope → `404 RESOURCE_NOT_FOUND`.

404 details must not reveal whether a foreign tenant resource exists.

---

## 4. Common data representation

### 4.1 IDs

Canonical server IDs are UUID strings.

```json
{
  "id": "807ce2af-0d69-46d2-a37b-3f661c4e4afe"
}
```

Local temporary IDs are client-only and must be replaced/mapped after server acknowledgement.

### 4.2 Quantities

All business quantities exposed by the V3 API are **base-10 integer strings**:

```json
{
  "currentQuantity": "82000",
  "readyQuantity": "50000",
  "availableQuantity": "30000"
}
```

Rules:

- digits only for non-negative values unless a specific field allows another domain;
- no decimal notation;
- no exponent notation;
- server parses to BIGINT/canonical integer type;
- client must not route values through floating-point arithmetic.

### 4.3 Monetary values

`unitPrice` follows the same integer-string strategy while exact V3 price limits remain subject to reviewed domain constraints.

### 4.4 Timestamps

UTC ISO 8601 strings:

```text
2026-10-12T12:00:00.000Z
```

### 4.5 Entity version

Mutable canonical entities use:

```json
{ "version": 7 }
```

`version` is an integer >= 1.

Client does not invent/increment canonical versions.

### 4.6 Cursor

List and sync cursors are opaque strings. Client stores and returns them unchanged.

---

## 5. Standard error envelope

All non-command JSON errors use:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Không tìm thấy dữ liệu.",
    "requestId": "req_01J...",
    "details": {}
  }
}
```

Fields:

| Field | Rule |
|---|---|
| `code` | stable machine-readable enum/string |
| `message` | safe Vietnamese/user-facing summary where appropriate |
| `requestId` | correlation ID for logs/support |
| `details` | optional structured data; never cross-tenant metadata |

Client logic must branch on `code`, not framework exception text.

### Initial error code taxonomy

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | malformed DTO/query/protocol |
| 400 | `TENANT_CONTEXT_MISMATCH` | body/path tenant context disagree |
| 401 | `AUTHENTICATION_REQUIRED` | missing/invalid/expired token |
| 403 | `PERMISSION_DENIED` | visible tenant, action not allowed |
| 404 | `RESOURCE_NOT_FOUND` | not visible/not found |
| 409 | `VERSION_CONFLICT` | expected version stale |
| 409 | `IDEMPOTENCY_KEY_REUSED` | same key, different canonical request |
| 409 | `BUSINESS_CONFLICT` | current canonical state rejects operation |
| 422 | `VALIDATION_REJECTED` | well-formed but invalid input/domain fields |
| 422 | `INSUFFICIENT_AVAILABLE_QUANTITY` | new own reservation exceeds commit-time available |
| 429 | `RATE_LIMITED` | throttled |
| 500 | `INTERNAL_ERROR` | unexpected server failure |
| 503 | `SERVICE_UNAVAILABLE` | transient dependency/runtime outage |

Additional frozen codes:

```text
INVITATION_EXPIRED
INVITATION_REVOKED
INVITATION_EMAIL_MISMATCH
INVITATION_ROLE_NOT_ALLOWED
MEMBERSHIP_ALREADY_EXISTS
MEMBERSHIP_NOT_FOUND
ROLE_CHANGE_NOT_ALLOWED
ORGANIZATION_OWNER_IMMUTABLE
DEVICE_NOT_REGISTERED
DIRECTORY_SNAPSHOT_STALE
SYNC_CURSOR_EXPIRED
COMPENSATION_NOT_SUPPORTED
COMPENSATION_CONFLICT
IMPORT_EXPIRED
IMPORT_HASH_MISMATCH
```

Domain-specific codes can be added, but removal/semantic reuse is a contract change.

---

## 6. Pagination

List endpoint request:

```http
GET /v3/gardens/{gardenId}/batches?limit=50&cursor=<opaque>
```

Response:

```json
{
  "items": [],
  "nextCursor": "opaque-or-null"
}
```

Rules:

- default `limit = 50`, maximum `limit = 100`;
- deterministic default ordering is `createdAt DESC, id ASC` unless an endpoint explicitly freezes another order;
- cursor opaque;
- filters must be tenant scoped server-side;
- count/search must not leak other tenants.

---

# 7. V3-1 — Identity and tenant endpoints

These endpoints are **design-frozen for V3-1 handoff**, but V3-1 runtime implementation still requires explicit phase authorization.

## 7.1 Current user bootstrap/profile

### POST `/v3/me/bootstrap`

Idempotently ensures an `AppUser` row exists for the verified Supabase `sub`.

- no tenant membership is invented;
- repeated calls for the same subject return the same canonical user;
- normalized lowercase email is refreshed from the authenticated JWT when it changes;
- same subject + same normalized email is a no-op; an actual email change increments AppUser.version;
- this is the only automatic identity-provisioning endpoint;
- `GET /me` remains side-effect free.

Response `200`:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": null,
  "version": 1
}
```

### GET `/v3/me`

Read-only current profile plus caller-visible memberships.

Example:

```json
{
  "id": "uuid",
  "email": "athu@example.com",
  "displayName": "A Thư",
  "version": 2,
  "organizations": [
    {
      "organizationId": "uuid",
      "role": "MEMBER",
      "version": 1
    }
  ],
  "gardens": [
    {
      "organizationId": "uuid",
      "gardenId": "uuid",
      "role": "WORKER",
      "version": 1
    }
  ]
}
```

### PATCH `/v3/me`

Updates self-owned profile fields only.

Request:

```json
{
  "displayName": "A Thư",
  "expectedVersion": 1
}
```

Rules:

- `displayName` is trimmed Unicode text; final length validation is 1–120 when non-null;
- profile update never changes organization/garden role;
- stale expectedVersion → `409 VERSION_CONFLICT`;
- successful update increments AppUser.version.

Do not return credential/session secrets or the provider-specific `authSubject`; it remains an internal identity mapping.

## 7.2 Organizations

### GET `/v3/organizations`

List caller-visible organizations.

### POST `/v3/organizations`

Create organization during authorized onboarding flow.

Request:

```json
{
  "name": "Vườn ươm Tuấn Sơn"
}
```

Response: `201` canonical organization + initial caller membership.

Organization creator becomes the single Organization OWNER for initial V3. Organization OWNER transfer/multiple owners are deferred.

### GET `/v3/organizations/{organizationId}`

Caller-visible organization detail.

### PATCH `/v3/organizations/{organizationId}`

Organization OWNER/ADMIN only.

```json
{
  "name": "Vườn ươm Tuấn Sơn",
  "expectedVersion": 2
}
```

Organization has an optimistic `version`; stale update returns `409 VERSION_CONFLICT`.

### GET `/v3/organizations/{organizationId}/members`

Organization OWNER/ADMIN only. Returns member `userId`, normalized email, displayName, organization role and membership version.

## 7.3 Gardens

### GET `/v3/organizations/{organizationId}/gardens`

List caller-visible gardens in organization.

### POST `/v3/organizations/{organizationId}/gardens`

Create garden if caller has permission.

### GET `/v3/gardens/{gardenId}`

Canonical garden metadata + server-computed effective role/permission keys.

Garden creation rules:

- created by Organization OWNER → owner receives Garden OWNER;
- created by Organization ADMIN → Organization OWNER receives Garden OWNER and creating ADMIN receives Garden MANAGER;
- no garden exists without the Organization OWNER as Garden OWNER.

## 7.4 Membership and invitations

Canonical policy is frozen in [V3-AUTHORIZATION-CONTRACT.md](./V3-AUTHORIZATION-CONTRACT.md).

### GET `/v3/gardens/{gardenId}/members`

Garden OWNER/MANAGER only. Each row returns userId, normalized email, displayName, role and membership version.

### GET `/v3/gardens/{gardenId}/invitations`

Garden OWNER/MANAGER only. Lists **currently PENDING and non-expired** invitation metadata needed for member-management UI; **never returns raw token/shareUrl**. Historical accepted/revoked/expired records remain audit data but are not part of this initial UI list.

### POST `/v3/gardens/{gardenId}/invitations`

Request:

```json
{
  "email": "member@example.com",
  "role": "WORKER"
}
```

Allowed invite roles:

```text
OWNER   → MANAGER / WORKER / VIEWER
MANAGER → WORKER / VIEWER
```

Garden OWNER role is reserved for the Organization OWNER and cannot be invited.

Invitation expires after 7 days. Creating a replacement invite for the same garden + normalized email revokes the previous pending token.

Response returns invitation metadata plus a one-time share URL containing the raw opaque token. Server stores only SHA-256(token).

### POST `/v3/invitations/preview`

Authenticated body:

```json
{ "token": "opaque" }
```

Authenticated non-anonymous JWT email must match the invite target. Do not require or trust a non-standard/editable `email_verified` metadata field; the confirmation guarantee comes from the Supabase Confirm Email project policy.

### POST `/v3/invitations/accept`

Authenticated body:

```json
{ "token": "opaque" }
```

Acceptance atomically creates OrganizationMember(MEMBER) when missing, creates GardenMember, accepts invitation and appends audit evidence.

### DELETE `/v3/gardens/{gardenId}/invitations/{invitationId}`

Revoke pending invite.

### PATCH `/v3/gardens/{gardenId}/members/{userId}`

```json
{
  "role": "VIEWER",
  "expectedVersion": 3
}
```

OWNER manages MANAGER/WORKER/VIEWER. MANAGER only changes WORKER ↔ VIEWER. OWNER target is immutable through this endpoint.

### DELETE `/v3/gardens/{gardenId}/members/{userId}`

Revokes according to permission matrix. A non-owner may leave their own garden.

### PATCH `/v3/organizations/{organizationId}/members/{userId}`

Organization OWNER only; target role is ADMIN or MEMBER. Organization OWNER cannot be changed in V3-1.

## 7.5 Device registration

Client creates one random `clientInstallationId` UUID per PWA/browser storage profile and environment.

### POST `/v3/devices/register`

```json
{
  "clientInstallationId": "uuid",
  "label": "Chrome Android",
  "platform": "pwa"
}
```

Idempotent by `(authenticated user, clientInstallationId)`. Returns canonical `deviceId`.

### DELETE `/v3/devices/{deviceId}`

Unregister caller-owned device. Commands using an unregistered/foreign device return `DEVICE_NOT_REGISTERED`.

No hardware fingerprinting, IMEI or advertising identifier is collected.

---

# 8. V3-2 — Canonical read endpoints

## 8.1 Batch

### GET `/v3/gardens/{gardenId}/batches`

Optional future filters may include `variety`, status/view and search after contract review.

Batch read DTO:

```json
{
  "id": "uuid",
  "gardenId": "uuid",
  "code": "K01",
  "variety": "Keo lai BV16",
  "initialQuantity": "100000",
  "currentQuantity": "82000",
  "readyQuantity": "50000",
  "ownOutstandingQuantity": "20000",
  "availableQuantity": "30000",
  "status": "ready",
  "version": 7,
  "createdAt": "2026-10-01T00:00:00.000Z"
}
```

Derived values are server canonical after cutover.

### GET `/v3/gardens/{gardenId}/batches/{batchId}`

Batch detail + allowed related operational summary.

## 8.2 Contacts

Contacts are organization-scoped.

### GET `/v3/organizations/{organizationId}/contacts`

### GET `/v3/organizations/{organizationId}/contacts/{contactId}`

Contact DTO preserves raw display phone; normalized phone is internal/search support unless explicitly needed by client.

## 8.3 Orders

### GET `/v3/gardens/{gardenId}/orders`

### GET `/v3/gardens/{gardenId}/orders/{orderId}`

Order read DTO includes canonical derived facts:

```json
{
  "id": "uuid",
  "gardenId": "uuid",
  "customerId": "uuid",
  "variety": "Keo lai BV16",
  "requestedQuantity": "30000",
  "coverageQuantity": "25000",
  "shortageQuantity": "5000",
  "shippedQuantity": "10000",
  "requestedDate": "2026-10-20T00:00:00.000Z",
  "unitPrice": null,
  "note": null,
  "status": "open",
  "version": 4
}
```

Order creation does **not** auto-reserve.

## 8.4 Reservations

### GET `/v3/gardens/{gardenId}/orders/{orderId}/reservations`

Reservation DTO:

```json
{
  "id": "uuid",
  "orderId": "uuid",
  "sourceType": "own_batch",
  "batchId": "uuid",
  "supplierId": null,
  "quantity": "20000",
  "fulfilledQuantity": "5000",
  "outstandingQuantity": "15000",
  "coverageQuantity": "20000",
  "status": "active",
  "version": 3
}
```

Semantics:

- active: O=Q-F, C=Q;
- released: O=0, C=F;
- fulfilled: O=0, C=Q.

## 8.5 Shipments

### GET `/v3/gardens/{gardenId}/shipments`

### GET `/v3/gardens/{gardenId}/shipments/{shipmentId}`

Planned is not shipped. Response must keep planned vs actually shipped explicit.

## 8.6 Dossiers

### GET `/v3/gardens/{gardenId}/batches/{batchId}/dossier`

No public document bucket assumption in V3-0.

---

# 9. Domain command endpoint

Canonical offline-capable mutation route:

```http
POST /v3/gardens/{gardenId}/commands
```

This is preferred for business writes that must preserve domain invariants, version checks and idempotency.

## 9.1 Command request

```json
{
  "protocolVersion": 1,
  "mutationId": "client-generated-uuid",
  "idempotencyKey": "stable-uuid-for-this-intent",
  "deviceId": "registered-installation-id",
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

- body `gardenId` must equal path garden; mismatch → 400;
- bearer identity + membership decides authority;
- retry same intent keeps `mutationId` and `idempotencyKey`;
- unknown `protocolVersion` or action rejected;
- canonical payload hash stored with receipt;
- same key + same request returns original durable result;
- same key + different request → 409 and zero second business write.

## 9.2 Applied response

```json
{
  "status": "APPLIED",
  "mutationId": "uuid",
  "receiptId": "uuid",
  "serverCursor": "opaque",
  "result": {
    "entityType": "batch",
    "entityId": "uuid",
    "version": 8
  }
}
```

Idempotent replay may return the same logical receipt/result.

## 9.3 Conflict response

HTTP `409`:

```json
{
  "status": "CONFLICT",
  "mutationId": "uuid",
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Dữ liệu đã thay đổi.",
    "requestId": "req_...",
    "details": {
      "entityType": "batch",
      "entityId": "uuid",
      "expectedVersion": 7,
      "currentVersion": 8
    }
  }
}
```

Details only include resources caller is authorized to see.

## 9.4 Validation response

HTTP `422`:

```json
{
  "status": "VALIDATION_REJECTED",
  "mutationId": "uuid",
  "error": {
    "code": "INSUFFICIENT_AVAILABLE_QUANTITY",
    "message": "Lô không còn đủ cây để giữ.",
    "requestId": "req_...",
    "details": {
      "availableQuantity": "12000"
    }
  }
}
```

## 9.5 Forbidden response

HTTP `403` only when garden itself is visible but role lacks permission:

```json
{
  "status": "FORBIDDEN",
  "mutationId": "uuid",
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Bạn không có quyền thực hiện thao tác này.",
    "requestId": "req_..."
  }
}
```

---

# 10. Initial command action inventory

V3-1 identity/tenant DTOs are frozen and code-ready. For V3-2 business mutations, the command envelope/action names below are frozen architecture, while each action's exact payload DTO must be frozen in its V3-2 implementation slice before backend/client code for that action starts. This is intentional phase-gating, not a V3-1 blocker.

| Action | Purpose | Phase |
|---|---|---|
| `batch.create` | create own batch | V3-2 |
| `batch.set_current_quantity` | absolute inventory/current quantity update | V3-2 |
| `batch.set_ready_quantity` | absolute ready quantity update | V3-2 |
| `contact.create` | create org-scoped contact from garden workflow | V3-2 |
| `contact.update` | update permitted contact fields/version | V3-2 |
| `order.create` | create demand only; no auto-reserve | V3-2 |
| `order.update` | update allowed order metadata/quantity with reconciliation rules | V3-2 |
| `order.cancel` | cancel per current domain contract | V3-2 |
| `reservation.reserve_own_batch` | explicit own source reservation | V3-2 |
| `reservation.reserve_external_supplier` | explicit external supplier commitment | V3-2 |
| `reservation.release` | release outstanding while preserving F/history | V3-2 |
| `reservation.reconcile_order_reduction` | current FC3 order-reduction semantics | V3-2 |
| `reservation.reconcile_batch_shortage` | current FC3 batch-shortage/transfer semantics | V3-2 |
| `shipment.plan` | create/update allowed planned shipment state | V3-2 |
| `shipment.confirm` | record actual shipment/fulfillment | V3-2 |
| `shipment.cancel` | cancel planned shipment where allowed | V3-2 |
| `dossier.upsert` | update batch dossier | V3-2 |
| `mutation.compensate` | explicit safe compensation of a supported prior mutation | V3-2 |

### Compensation / Undo

V3 maps Undo to `mutation.compensate`, not a blind rollback.

Payload:

```json
{
  "targetMutationId": "uuid"
}
```

Server checks same garden, current permission, explicit compensation registry and current state/version/history. Compensation is a new mutation with a new idempotency key and audit/change revision.

Unsupported target → `COMPENSATION_NOT_SUPPORTED`.

State no longer safe → `COMPENSATION_CONFLICT`.

Applied command responses may expose:

```json
{
  "compensation": {
    "supported": true,
    "targetMutationId": "uuid"
  }
}
```

as a UI affordance only.

---

# 11. Command payload examples

## 11.1 Create order

```json
{
  "action": "order.create",
  "payload": {
    "customerId": "uuid",
    "variety": "Keo lai BV16",
    "requestedQuantity": "30000",
    "requestedDate": "2026-10-20T00:00:00.000Z",
    "unitPrice": null,
    "note": "Giao buổi sáng"
  }
}
```

Server creates demand only.

## 11.2 Reserve own batch

```json
{
  "action": "reservation.reserve_own_batch",
  "expectedVersions": {
    "order:order-uuid": 4,
    "batch:batch-uuid": 7
  },
  "payload": {
    "orderId": "order-uuid",
    "batchId": "batch-uuid",
    "quantity": "12000"
  }
}
```

Server rechecks commit-time available quantity. Client preview is not authority.

## 11.3 External supplier commitment

```json
{
  "action": "reservation.reserve_external_supplier",
  "expectedVersions": {
    "order:order-uuid": 4,
    "contact:supplier-uuid": 2
  },
  "payload": {
    "orderId": "order-uuid",
    "supplierId": "supplier-uuid",
    "quantity": "8000",
    "acknowledgement": {
      "sourceConfirmed": true
    }
  }
}
```

Final acknowledgement fields must preserve FC4 truthfulness and be frozen before implementation.

## 11.4 Confirm shipment

```json
{
  "action": "shipment.confirm",
  "expectedVersions": {
    "shipment:shipment-uuid": 2,
    "reservation:reservation-uuid": 3
  },
  "payload": {
    "shipmentId": "shipment-uuid",
    "lines": [
      {
        "reservationId": "reservation-uuid",
        "quantity": "5000"
      }
    ]
  }
}
```

Server resolves source semantics and reduces own stock only for own-batch fulfilled quantity.

---

# 12. V3-3 — Sync endpoints

## 12.1 Changefeed

```http
GET /v3/gardens/{gardenId}/changes?cursor=<opaque>&limit=...
```

Response concept:

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

Client applies a complete page atomically. `organizationContactDirectoryVersion` is a lightweight invalidation signal for the separate organization contact cache.

Garden sync uses a commit-ordered per-garden `syncRevision` frozen in the implementation foundation.

All ChangeLog rows from one committed mutation share one revision and have deterministic ordinal values. Pages never split one revision.

Cursor is HMAC-signed opaque data bound to garden + revision. Minimum retained changefeed window is 90 days. Expired cursor returns `410 SYNC_CURSOR_EXPIRED`.

Default page target: 100 change rows; maximum target: 500, except one complete revision may exceed the target.

## 12.2 Snapshot

```http
GET /v3/gardens/{gardenId}/snapshot
```

Used for:

- first cloud-authority bootstrap;
- cursor expiry recovery;
- explicit full reconciliation.

Conceptual response:

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

Organization-scoped contacts are **not** duplicated into garden snapshot/changefeed. Garden sync responses expose only the current organization `contactDirectoryVersion` so clients know when the separate contact cache is stale.

They use a separate organization contact-directory snapshot:

```http
GET /v3/organizations/{organizationId}/contacts/snapshot?limit=100&cursor=<opaque>
```

Each download is bound to one `directoryVersion`. If the directory changes between pages, server returns `409 DIRECTORY_SNAPSHOT_STALE`; client discards temporary pages and restarts, then atomically swaps the local organization contact cache only after a complete version is downloaded.

## 12.3 Retry behavior

- transient network/5xx → bounded retry;
- 401 → pause outbox until re-auth;
- 403/404 due revoke/scope → stop replay for inaccessible tenant;
- 409 conflict → user-visible reconciliation, no blind expectedVersion rewrite;
- timeout after write → UNKNOWN until receipt/changefeed/snapshot proves outcome.

---

# 13. V3-2 migration/import API

Migration remains owner-controlled and separately gated.

Logical flow:

```text
upload/stage
→ strict validate + preview
→ owner confirms digest + target garden
→ atomic canonical commit
→ verify canonical snapshot
→ explicit cutover
```

## POST `/v3/gardens/{gardenId}/imports`

Auth: Garden OWNER only.

Content:

```http
Content-Type: multipart/form-data
```

One file field:

```text
file: application/json
```

Maximum raw size:

```text
10 MiB
```

Server computes SHA-256, strict-validates legacy Backup V1 and stores only private staged normalized payload associated with MigrationImport. No canonical business rows are written during preview.

Staged payload expires after 24 hours.

Response:

```json
{
  "importId": "uuid",
  "status": "staged",
  "contentHash": "sha256:...",
  "expiresAt": "2026-10-13T12:00:00.000Z",
  "previewCounts": {},
  "warnings": []
}
```

## GET `/v3/gardens/{gardenId}/imports/{importId}`

Owner-visible preview/status. Never returns another tenant's staged payload.

## POST `/v3/gardens/{gardenId}/imports/{importId}/commit`

```json
{
  "contentHash": "sha256:...",
  "confirmTargetGardenId": "garden-uuid"
}
```

Rules:

- OWNER only;
- expired import → `IMPORT_EXPIRED`;
- hash mismatch → `IMPORT_HASH_MISMATCH`;
- repeated same confirmed import is idempotent;
- canonical data/audit/provenance commit atomically;
- staged payload purged after successful verification;
- failed/rejected/expired payload purged without canonical writes.

No public object-storage bucket is required for V3 bootstrap.

Successful import does **not** itself switch local/cloud authority. Explicit verified cutover remains a separate owner action.

---

# 14. Coherent read model rules

The API should return user-useful derived values rather than forcing client to reimplement canonical math.

Examples:

- batch `ownOutstandingQuantity`;
- batch `availableQuantity`;
- order `coverageQuantity`;
- order `shortageQuantity`;
- reservation `outstandingQuantity`;
- reservation `coverageQuantity`;
- order/shipment actual shipped totals.

Client may compute presentation-only formatting, but server remains canonical for committed facts after cutover.

---

# 15. OpenAPI structure

When V3 implementation is authorized, checked-in OpenAPI should organize:

### Tags

- Identity
- Organizations
- Gardens
- Membership
- Contacts
- Batches
- Orders
- Reservations
- Shipments
- Dossiers
- Commands
- Sync
- Imports

### Components

At minimum:

- auth security scheme;
- UUID/string IDs;
- QuantityString;
- MoneyString;
- ISO timestamp;
- Version;
- Cursor;
- ErrorEnvelope;
- CommandEnvelope;
- CommandApplied;
- CommandConflict;
- Paginated responses.

### Contract verification

Frozen implementation path:

- generated checked-in spec: `docs/api/v3.openapi.json`;
- NestJS `@nestjs/swagger` generates the spec deterministically;
- server CI runs `openapi:check`;
- frontend runs `openapi-typescript` to generate `web/src/api/generated/v3.d.ts`;
- generated types are never hand edited.

Pinned toolchain and package boundaries are in [V3-IMPLEMENTATION-FOUNDATION.md](./V3-IMPLEMENTATION-FOUNDATION.md).

---

# 16. Frontend/backend ownership handoff

## 17thedev — server-side primary

Before backend implementation:

- freeze endpoint/action DTO with reviewer;
- implement auth verification + server membership authorization;
- implement domain transaction;
- expose exact OpenAPI;
- provide canonical error/fixture examples.

## Tráng A Thư — client-side primary

Before client integration:

- consume only frozen contract;
- implement token attachment/re-auth;
- map stable error codes to UX;
- preserve idempotency key on retry;
- keep local pending vs server committed distinct;
- do not compensate for missing server fields by inventing alternate domain math.

## Shared zone

Both must review changes to:

- this API contract;
- OpenAPI spec/generated types;
- auth context;
- error taxonomy;
- quantity representation;
- sync command envelope;
- root env/config needed by both packages.

---

# 17. Contract change policy

A contract change is breaking/review-required when it:

- renames/removes field/action/error code;
- changes quantity/time/version representation;
- changes auth or tenant scope;
- changes idempotency/conflict semantics;
- changes meaning of a status;
- changes endpoint visibility.

Do not fix frontend/backend mismatch by silently making one side permissive.

---

# 18. Security and privacy checklist

Before V3-1/V3-2 implementation acceptance:

- [ ] no service-role/JWT signing secret in browser;
- [ ] invalid issuer/audience/expiry rejected;
- [ ] all tenant routes deny by default;
- [ ] cross-tenant IDs produce no metadata leak;
- [ ] list/search/count scoped;
- [ ] role permissions explicit;
- [ ] sensitive logs redact token/private payload;
- [ ] requestId available for debugging;
- [ ] import data private and retained/purged by policy;
- [ ] logout/revoke/switch handles cached tenant data.

---

# 19. Design freeze summary

The previous V3-0 blockers are now resolved as follows:

1. Permission matrix → frozen in V3 Authorization Contract.
2. Invitations → 7-day email-bound share-link token, SHA-256 stored token, authenticated preview/accept.
3. Role update → explicit organization/garden endpoints with immutable OWNER rules.
4. Toolchain → pinned in V3 Implementation Foundation.
5. Device registration → authenticated client-installation registration with canonical deviceId.
6. Undo → `mutation.compensate` with explicit compensation registry and fresh validation.
7. Contacts → organization-scoped paginated snapshot bound to `directoryVersion`; not duplicated into garden feed.
8. Import → authenticated multipart JSON, 10 MiB cap, private staged payload, 24-hour expiry.
9. Changefeed → commit-ordered per-garden revision, signed cursor, 90-day minimum retention, 410 on expiry.
10. Pagination → default 50/max 100; deterministic ordering.

Remaining implementation choices are local code details that **must not change these contracts**. Any change to the frozen decisions requires a design-contract PR before dependent frontend/backend code merges.
