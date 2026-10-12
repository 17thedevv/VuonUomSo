---
name: testing
description: >-
  V3 testing strategy covering domain invariants, tenant authorization,
  API contracts, persistence, offline sync, client behavior and merge gates.
---

# Testing Strategy & Quality Standards

## 1. Priority

```text
Domain correctness
>
Tenant/Auth security
>
Transaction + idempotency + concurrency
>
API contract compatibility
>
Persistence/sync
>
Critical UI workflow
>
Visual detail
```

Test count không phải quality metric.

## 2. Risk classes

### LOW
Docs/copy/CSS/local refactor.

### NORMAL
UI behavior/read APIs/non-critical service.

### HIGH
Quantity/reservation/shipment, auth/membership, tenant isolation, DB migration, server transaction, idempotency, offline outbox/changefeed/conflict, backup/restore.

HIGH yêu cầu regression/negative/integration tests phù hợp và full gate trước handoff.

## 3. Existing web tests

Tiếp tục bảo vệ:

- pure domain invariants;
- Dexie persistence;
- backup/restore;
- current UI flows;
- mobile behavior.

Không xóa regression chỉ vì V3 chuyển authority lên server.

## 4. V3 backend tests — khi implementation được authorize

### Auth/tenancy negative tests

Tối thiểu:

- no token → 401;
- invalid/expired/wrong issuer/audience → 401;
- authenticated outsider → generic no-access response theo API contract;
- member garden A không đọc/ghi garden B;
- role thiếu permission → 403;
- manipulated entity/garden IDs không cross tenant.

### Domain/transaction tests

- concurrent reservation last stock: chỉ một commit hợp lệ, zero oversell;
- failed write → zero orphan DomainEvent/ChangeLog/receipt;
- stale version → 409 conflict, không silent overwrite;
- repeated idempotency key/same payload → same receipt;
- same key/different payload → reject, zero second mutation.

### API contract tests

- quantity luôn decimal string;
- timestamps ISO 8601;
- stable error codes;
- cursor opaque;
- request/response DTO match OpenAPI;
- no tenant metadata in forbidden/not-found error details.

## 5. V3 sync tests

- offline command persisted trước pending success UI;
- timeout after server commit + retry → one mutation;
- ordered change pages applied atomically;
- cursor expiry → snapshot recovery;
- account/garden switch không replay queue tenant cũ;
- revoke membership stops replay;
- two browser/device profiles converge without oversell.

## 6. Client integration tests

Mock theo **canonical API contract**, không invent response shape trong từng test.

Critical flow:

```text
auth
→ choose organization/garden
→ read canonical state
→ mutate/pending
→ ack/changefeed
→ UI canonical state
```

## 7. Verification cadence

Trong inner loop:

- LOW → manual/targeted;
- NORMAL → related tests + typecheck/lint khi ổn;
- HIGH → regression + related integration, full gate trước push/handoff.

Hiện tại web full gate:

```bash
cd web
npm run typecheck
npm run lint
npm test
npm run build
```

Backend gate chỉ được ghi cụ thể sau khi backend package/toolchain được authorize và tạo thật.

## 8. Mandatory regression policy

Bug liên quan quantity, authorization, tenant leak, idempotency, sync, migration, backup/restore hoặc destructive operation **phải** có regression test.

## 9. Reporting

Phân biệt rõ:

- targeted checks;
- full local checks;
- remote CI;
- browser/device evidence;
- field evidence.

Không dùng CI để claim pilot/user validation.
