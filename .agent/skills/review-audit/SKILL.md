---
name: review-audit
description: >-
  V3 review protocol for scope, domain correctness, tenant security,
  API contracts, architecture, offline behavior, UX and tests.
---

# Code Review & Audit Protocol

## 1. Review order

```text
1. Scope / phase authorization
2. Tenant & auth security
3. Domain correctness
4. API contract compatibility
5. Architecture / data authority / offline semantics
6. UX/mobile
7. Tests/evidence
```

## 2. Scope

- Đối chiếu `.agent/PROJECT_STATE.md`.
- Design approval không đồng nghĩa implementation approval.
- Course requirement không được mở phase.
- Không tự adopt deferred AI/MCP/payment/debt/cross-garden pooled stock.

## 3. Tenant/auth security

Kiểm:

- JWT verification đúng issuer/audience/expiry/signature/subject;
- server re-authorize membership mỗi request;
- role permission đúng action;
- entity FK/query không cross tenant;
- error/list/count/search không leak tenant metadata;
- cache/outbox partition đúng account/org/garden/environment;
- browser không chứa service-role/JWT signing secrets.

Tenant leak hoặc unauthorized write là **BLOCKER**.

## 4. Domain correctness

Kiểm:

- no negative quantity;
- ready ≤ physical/current;
- no oversell;
- reservation không tự giảm physical;
- shipment/fulfillment semantics đúng;
- external supplier truth không bị biến thành own stock;
- stale/concurrent write không silent clobber.

Sai committed quantity hoặc oversell là **BLOCKER**.

## 5. API contract

- endpoint/action đúng canonical doc;
- request/response/error shape không tự chế;
- quantities decimal strings;
- IDs/version/timestamps consistent;
- 409 conflict và idempotency semantics đúng;
- backward compatibility hoặc version bump rõ nếu contract đổi.

Frontend/backend mismatch có thể là HIGH/BLOCKER tùy hậu quả.

## 6. Architecture/offline

- PostgreSQL authority chỉ sau explicit cutover;
- Dexie sau cutover là cache/outbox, không second committed authority;
- timeout remains unknown until reconcile;
- retry same intent keeps idempotency key;
- changefeed/snapshot scoped và ordered;
- không microservices/event sourcing/CRDT vô cớ.

## 7. UX

Giữ mobile 360–430px, tap target, Vietnamese forestry language, pending/conflict/error state rõ ràng. Không hiển thị “đã lưu” khi chỉ pending offline.

## 8. Tests

Không đếm test đơn thuần. Tìm:

- negative auth tests;
- tenant crossing tests;
- domain regression;
- transaction rollback;
- idempotency;
- concurrency;
- offline/reconnect;
- exact-head integration gate.

## 9. Severity

| Severity | Example |
|---|---|
| BLOCKER | tenant leak, oversell, corrupt data, auth bypass, destructive migration |
| HIGH | phase violation, contract mismatch làm hỏng flow, missing high-risk tests |
| MEDIUM | boundary violation, maintainability issue, incomplete observability |
| LOW | naming/copy/minor cleanup |
| NOTE | future improvement ngoài scope |

## 10. Review report

```markdown
### Verdict
PASS / CONDITIONAL PASS / FAIL

### Findings
[BLOCKER/HIGH/...]

### Contract & scope
- phase:
- API impact:
- migration/auth impact:

### Verification
- exact commands/evidence

### Required actions
- ordered list
```
