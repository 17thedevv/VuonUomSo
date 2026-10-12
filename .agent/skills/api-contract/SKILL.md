---
name: api-contract
description: >-
  Contract-first REST/OpenAPI rules for Vườn Ươm V3: authentication context,
  tenant scoping, DTOs, errors, versions, idempotency, pagination and sync.
---

# V3 API Contract Skill

## 1. Purpose

Ngăn frontend và backend phát triển theo hai contract khác nhau.

Canonical design source:

- `docs/architecture/V3-API-CONTRACT.md`
- `docs/api/v3.openapi.json`
- `docs/architecture/V3-AUTHORIZATION-CONTRACT.md`
- `docs/architecture/V3-IMPLEMENTATION-FOUNDATION.md`
- `docs/architecture/V3-SYNC-PROTOCOL.md`
- `docs/architecture/V3-DATA-MODEL-NOTES.md`
- `docs/architecture/ADR-003-CLOUD-BACKED-ARCHITECTURE.md`

Skill này định nghĩa **cách agent làm việc với API**, không tự authorize implementation.

## 2. Current phase

V3-0 = design/docs only.

Được phép:

- endpoint inventory;
- request/response DTO design;
- error taxonomy;
- auth/tenant rules;
- OpenAPI conventions;
- sync/action design.

Không được phép:

- dựng NestJS runtime;
- provision Supabase/PostgreSQL;
- generate production migration;
- deploy service.

## 3. Contract-first workflow

Trước khi frontend/backend code song song:

1. chốt path + HTTP method;
2. chốt auth requirement;
3. chốt tenant scope;
4. chốt request DTO;
5. chốt success response;
6. chốt stable error codes;
7. chốt version/idempotency behavior;
8. chốt offline behavior;
9. review;
10. sau đó mới implement.

Nếu contract đổi trong lúc code, canonical doc phải đổi trước hoặc cùng PR và branch phụ thuộc phải sync.

## 4. API representation rules

### IDs

- Server canonical IDs: UUID string.
- Client-generated local temporary IDs không được tự coi là server IDs.
- Entity ID luôn được validate cùng tenant/garden scope.

### Quantities

Business quantity qua API là **base-10 integer string**:

```json
{ "quantity": "25000" }
```

Không dùng JSON number cho BIGINT business quantities.

### Time

ISO 8601 UTC string:

```text
2026-10-12T12:00:00.000Z
```

### Versions

Mutable canonical entities dùng integer `version >= 1`.

High-risk mutation gửi expected version(s). Stale version = conflict, không last-write-wins ngầm.

### Cursor

Pagination/changefeed cursor là opaque string. Client không parse hoặc tự tăng cursor.

## 5. Authentication vs authorization

Supabase Auth xử lý signup/login/recovery/token issuance.

NestJS API nhận:

```http
Authorization: Bearer <access-token>
```

Server:

1. verify JWT/JWKS;
2. map subject → AppUser;
3. resolve org/garden membership;
4. authorize action;
5. scope query/write.

`gardenId`, `organizationId` hoặc role gửi từ client **không phải authorization proof**.

## 6. Error envelope

Mọi non-2xx JSON error dùng shape ổn định:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Dữ liệu đã thay đổi.",
    "requestId": "req_...",
    "details": {}
  }
}
```

- `code`: stable machine-readable code.
- `message`: user-safe summary.
- `requestId`: correlation ID.
- `details`: optional, không leak tenant khác.

Không để client branch theo raw English framework exception text.

## 7. HTTP semantics

- 200: read/update/command result.
- 201: canonical resource created.
- 204: success with no body nếu contract explicit.
- 400: malformed request/protocol.
- 401: missing/invalid/expired authentication.
- 403: authenticated member exists nhưng thiếu permission cho action.
- 404: resource/garden không visible trong caller scope; dùng để tránh tenant enumeration.
- 409: version/idempotency/business conflict.
- 422: well-formed nhưng validation/domain input bị reject.
- 429: throttled.
- 5xx: server/transient failure; client không infer commit outcome nếu write bị timeout.

## 8. Reads

Read endpoints phải:

- scope server-side;
- paginate lists;
- có deterministic ordering;
- trả canonical derived facts khi cần;
- không bắt client tự reconstruct business truth từ nhiều inconsistent calls nếu server có thể snapshot coherent.

## 9. Writes

High-risk business mutation ưu tiên **command semantics** thay vì generic PATCH tùy ý.

Command phải:

- explicit action name;
- immutable request intent;
- idempotency key;
- expected versions;
- server transaction;
- durable result/receipt;
- stable conflict/error outcome.

Không dùng generic `PATCH /entity` để bypass domain command invariants.

## 10. Sync

Canonical write path cho offline replay:

`POST /v3/gardens/{gardenId}/commands`

Canonical pull:

- `GET /v3/gardens/{gardenId}/changes?cursor=...`
- `GET /v3/gardens/{gardenId}/snapshot`

Retry cùng intent giữ nguyên idempotency key.

Network timeout = UNKNOWN cho tới khi receipt/changefeed/snapshot reconcile.

## 11. OpenAPI rules

Khi V3 implementation được authorize:

- NestJS DTO/controller behavior và checked-in OpenAPI phải match.
- Generated client nếu dùng phải generate từ reviewed spec, không reverse-engineer UI code.
- Breaking contract change cần version/review rõ.
- Example payload phải dùng dữ liệu giả, không real tenant data.

## 12. Review checklist

- [ ] Endpoint nằm trong đúng phase?
- [ ] Auth và membership boundary rõ?
- [ ] DTO quantity dùng decimal string?
- [ ] Error code stable?
- [ ] Version conflict explicit?
- [ ] High-risk write idempotent?
- [ ] Không leak cross-tenant IDs/counts/details?
- [ ] Offline behavior được định nghĩa?
- [ ] Frontend và backend cùng đọc một canonical contract?
