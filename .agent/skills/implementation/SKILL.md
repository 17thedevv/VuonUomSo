---
name: implementation
description: >-
  V3 implementation workflow: phase check, contract/invariants, thin slices,
  two-person integration, risk-based verification and truthful handoff.
---

# Feature Implementation Workflow

## 1. Before coding

1. Đọc `.agent/PROJECT_STATE.md`.
2. Đọc router + skills liên quan.
3. Nếu có frontend ↔ backend boundary, đọc `api-contract` và canonical API doc.
4. Xác định owner/reviewer và shared files.
5. Không code executable phase chưa được authorize.

## 2. Contract-first rule

Với API/server/client task:

```text
contract
→ review
→ backend/client implementation song song
→ integration tests
```

Không làm:

```text
backend tự nghĩ DTO
+
frontend tự đoán DTO
→ cuối phase mới ghép
```

Contract change trong lúc code phải cập nhật canonical doc trước hoặc cùng atomic PR, và báo cho branch phụ thuộc.

## 3. Risk levels

### LOW
Docs/copy/CSS/refactor không đổi behavior.

### NORMAL
UI flow, read endpoint/client integration, non-critical service.

### HIGH
Quantity, reservation, shipment, auth/authorization, tenant isolation, Prisma migration, idempotency, sync/conflict, backup/restore, destructive operation.

HIGH phải có testing/security/domain review phù hợp.

## 4. Thin slice order

Tùy task, ưu tiên:

1. contract;
2. pure domain/invariant;
3. persistence/application;
4. HTTP/API adapter;
5. client API adapter/offline state;
6. UI;
7. tests/evidence.

Không tạo hạ tầng cho feature chưa được scope.

## 5. V3 server rules

Khi backend phase đã authorize:

- controller không chứa business logic lớn;
- membership authorization phía server;
- quantity decimal string ở API;
- version/conflict explicit;
- high-risk mutation idempotent;
- transaction bảo toàn write + audit/changefeed/receipt theo contract;
- 401/403/404 không leak tenant metadata.

## 6. V3 client rules

- không coi local optimistic state là committed;
- retry cùng intent giữ idempotency key;
- tenant/account cache partition;
- auth expiry pause/re-auth hợp lý;
- conflict không silent overwrite.

## 7. Verification

Trong lúc làm: targeted/related tests.

Trước handoff/PR/merge: exact-head gate theo `testing` và `github-workflow`.

## 8. Handoff format

Báo cáo:

1. Implemented
2. Contract impact
3. Changed files
4. Behavior
5. Verification
6. Deferred
7. Risks/gates

Không nói “done” nếu chỉ hoàn thành một slice hoặc phase chưa được acceptance.
