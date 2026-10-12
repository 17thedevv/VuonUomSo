# Agent Skill Router — Vườn Ươm

## 0. Bootstrap bắt buộc

Trước mọi task:

1. Đọc [PROJECT_STATE.md](./PROJECT_STATE.md).
2. Xác định task là **design/docs**, **implementation**, **review**, hay **operations**.
3. Không dùng một skill để tự mở scope đang bị PROJECT_STATE khóa.

## 1. Task-to-Skill Matrix

| Công việc | Skill chính | Phối hợp |
|---|---|---|
| Product/roadmap/scope | `product-context` | `validation` nếu liên quan evidence |
| UI/copy/form/mobile | `ux-design` | `product-context` |
| Batch/stock/order/reservation/shipment | `domain-rules` | `testing` |
| Architecture/data boundary/Dexie/PostgreSQL/NestJS/tenancy | `architecture` | `domain-rules` |
| REST endpoint/DTO/OpenAPI/error/version/idempotency | `api-contract` | `architecture`, `domain-rules` |
| Supabase Auth/JWT/JWKS/membership authorization | `architecture` + `api-contract` | `testing` |
| Offline outbox/changefeed/conflict/snapshot | `architecture` + `api-contract` | `domain-rules`, `testing` |
| Coding/refactor | `implementation` + `testing` | skill domain tương ứng |
| Git/branch/PR/CI | `github-workflow` | `implementation` |
| Pilot/field evidence | `validation` | `product-context` |
| Review/audit | `review-audit` | mọi skill liên quan |

## 2. Mandatory combinations

### API hoặc shared frontend/backend contract

Đọc theo thứ tự:

```text
PROJECT_STATE
→ architecture
→ api-contract
→ domain-rules nếu có business mutation
→ testing
```

Frontend và backend **không tự phát minh DTO riêng**.

### Backend/server task

```text
PROJECT_STATE
→ architecture
→ api-contract
→ implementation
→ testing
→ github-workflow nếu có branch/PR
```

### Offline sync task

```text
PROJECT_STATE
→ architecture
→ api-contract
→ domain-rules
→ implementation
→ testing
```

### Review V3

Review theo:

```text
phase/scope
→ tenant/auth security
→ domain correctness
→ API contract
→ offline/sync semantics
→ UX
→ tests
```

## 3. Current V3-0 limitation

Trong V3-0, các route trên chỉ cho phép **thiết kế/review tài liệu**. Không được tạo backend executable, provision Supabase/PostgreSQL hoặc deploy cloud chỉ vì skill đã mô tả cách implementation.
