# V3-0 — REST / OpenAPI Contract

**Status: DESIGN ONLY / NOT AUTHORIZED FOR IMPLEMENTATION OR DEPLOYMENT.**

This document is the canonical frontend/backend API design for Vườn Ươm V3. It exists so 17thedev and Tráng A Thư can implement separate server/client slices without inventing incompatible DTOs.

Read with:

- [ADR-003](./ADR-003-CLOUD-BACKED-ARCHITECTURE.md)
- [V3 Data Model Notes](./V3-DATA-MODEL-NOTES.md)
- [V3 Sync Protocol](./V3-SYNC-PROTOCOL.md)
- [V3 Local-to-Cloud Migration](./V3-LOCAL-TO-CLOUD-MIGRATION.md)
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

Migration artifact upload transport may later use a different content type after size/storage review.

---

## 3. Authentication and authorization

### 3.1 Supabase Auth responsibility

Signup, login, logout, refresh, email verification and password recovery are handled by Supabase Auth client flows.

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

- default/max `limit` frozen at implementation review;
- deterministic ordering required;
- cursor opaque;
- filters must be tenant scoped server-side;
- count/search must not leak other tenants.

---

# 7. V3-1 — Identity and tenant endpoints

These endpoints are **design candidates for V3-1**, not implementation authorization.

## 7.1 Current user

### GET `/v3/me`

Returns server profile mapped from authenticated subject.

Example:

```json
{
  "id": "uuid",
  "displayName": "A Thư",
  "authSubject": "verified-subject",
  "organizations": [
    {
      "organizationId": "uuid",
      "role": "MEMBER"
    }
  ],
  "gardens": [
    {
      "organizationId": "uuid",
      "gardenId": "uuid",
      "role": "WORKER"
    }
  ]
}
```

Do not return credential/session secrets.

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

Exact naming limits and ownership role require access-matrix freeze before implementation.

### GET `/v3/organizations/{organizationId}`

Caller-visible organization detail.

## 7.3 Gardens

### GET `/v3/organizations/{organizationId}/gardens`

List caller-visible gardens in organization.

### POST `/v3/organizations/{organizationId}/gardens`

Create garden if caller has permission.

### GET `/v3/gardens/{gardenId}`

Canonical garden metadata + caller's effective role/capabilities.

## 7.4 Membership

### GET `/v3/gardens/{gardenId}/members`

Authorized member list.

### POST `/v3/gardens/{gardenId}/invitations`

Create invitation. Final request fields, delivery mechanism, expiry and acceptance token model remain a **V3-1 review blocker**.

### DELETE `/v3/gardens/{gardenId}/members/{userId}`

Revoke membership when policy allows.

Revocation must stop future sync replay and access; cached client data handling follows sync/security policy.

> Role update endpoint is intentionally not frozen until the permission matrix is reviewed.

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

Exact DTOs are frozen per action before implementation. The action names below are the proposed V3 mapping of existing business capability.

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

### Not frozen yet

Undo mapping is intentionally **not assigned an action name yet**. Existing Undo/stale guards/history semantics must be reviewed and mapped explicitly instead of exposing a generic “undo anything” command.

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
      "sequence": "opaque-or-string-safe-representation",
      "entityType": "batch",
      "entityId": "uuid",
      "entityVersion": 8,
      "action": "updated",
      "payload": {},
      "createdAt": "2026-10-12T12:00:00.000Z"
    }
  ],
  "nextCursor": "opaque",
  "hasMore": false
}
```

Client applies a complete page atomically.

Exact exposure of internal ChangeLog sequence vs encoded cursor remains an implementation review decision; **cursor stays opaque either way**.

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

Organization-scoped contacts may be included as an explicitly scoped snapshot section or fetched separately; final decision must avoid cross-garden/organization leakage and unnecessary duplication.

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
stage artifact
→ validate/preview
→ owner confirms digest + target garden
→ atomic commit/publish
→ verify canonical snapshot
→ explicit cutover
```

Proposed routes:

### POST `/v3/gardens/{gardenId}/imports`

Create staged import from validated legacy Backup V1.

The final upload transport is **not frozen** until artifact-size/storage/security review. Do not assume public object storage.

Response:

```json
{
  "importId": "uuid",
  "status": "staged",
  "contentHash": "sha256:...",
  "previewCounts": {},
  "warnings": []
}
```

### GET `/v3/gardens/{gardenId}/imports/{importId}`

Return owner-visible staged/verified/committed status and preview.

### POST `/v3/gardens/{gardenId}/imports/{importId}/commit`

Request:

```json
{
  "contentHash": "sha256:...",
  "confirmTargetGardenId": "garden-uuid"
}
```

Must be idempotent for same reviewed import/digest.

No cutover is implied solely by successful import commit; verified consistency + explicit cutover decision remains required.

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

Server CI should eventually verify generated/declared OpenAPI against controller DTOs. Client types, if generated, must derive from reviewed OpenAPI rather than handwritten duplicate shapes.

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

# 19. Unresolved decisions before implementation

These are **review blockers**, not permission to improvise in code:

1. exact OrganizationMember/GardenMember permission matrix;
2. invitation creation/acceptance/expiry mechanics;
3. final role-update API;
4. exact OpenAPI/NestJS version/toolchain;
5. device registration model for `deviceId`;
6. stable Undo command mapping;
7. contact inclusion strategy in garden snapshot;
8. import upload transport/size threshold/staging storage;
9. changefeed retention/cursor expiry representation;
10. exact list filter/sort/limit constraints.

Resolve them in design review or scoped implementation-contract PR before dependent code lands.
