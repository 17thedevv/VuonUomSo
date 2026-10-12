---
name: architecture
description: >-
  V3 architecture rules for cloud-backed offline-first boundaries, tenancy,
  data authority, NestJS/PostgreSQL/Supabase integration, and anti-overengineering.
---

# V3 Architecture & Boundary Guidelines

## 1. Purpose

Giữ Vườn Ươm chuyển từ local prototype sang cloud-backed PWA mà không phá domain correctness, offline UX hoặc tenant isolation.

Đọc cùng:

- `docs/architecture/ADR-003-CLOUD-BACKED-ARCHITECTURE.md`
- `docs/architecture/V3-DATA-MODEL-NOTES.md`
- `docs/architecture/V3-SYNC-PROTOCOL.md`
- `docs/architecture/V3-LOCAL-TO-CLOUD-MIGRATION.md`
- `docs/architecture/V3-AUTHORIZATION-CONTRACT.md`
- `docs/architecture/V3-IMPLEMENTATION-FOUNDATION.md`
- `docs/architecture/V3-API-CONTRACT.md` khi task có API.

## 2. Target architecture

```text
React + TypeScript + Vite PWA
        │
        │ HTTPS REST / OpenAPI
        ▼
NestJS modular monolith
        │
        │ Prisma
        ▼
PostgreSQL

Supabase Auth ── JWT/JWKS ──► NestJS identity verification
Dexie/IndexedDB ◄──────────── tenant-scoped cache + durable pending outbox
```

## 3. Authority model

### Trước cutover của một garden
Legacy local dataset vẫn là authority theo behavior hiện tại.

### Sau explicit per-garden cutover

- PostgreSQL: authority cho committed business facts.
- NestJS: authority cho authorization, invariants và transaction boundaries.
- Dexie: cache + pending/tentative offline commands.
- UI optimistic state: không phải proof server đã commit.

Không được có hai authority độc lập cùng ghi committed state.

## 4. Tenant boundaries

- Một user có thể thuộc nhiều organizations/gardens.
- Role có thể khác nhau theo garden.
- JWT chỉ xác minh identity; **không tự cấp quyền garden**.
- Mọi server query/mutation phải resolve membership phía server.
- `gardenId`, `organizationId`, entity IDs từ client đều là untrusted input.
- Không để list/count/search/error message leak metadata tenant khác.
- Không share business data cross-organization nếu chưa có contract riêng.

## 5. Layer rules

### Frontend

- React component không gọi Dexie tables trực tiếp nếu đã có repository/application boundary.
- Domain pure TypeScript không import React/Dexie/server SDK.
- API client không tự chứa business invariant; server vẫn revalidate.
- Offline write phải được lưu durable outbox trước khi UI claim pending success.

### Backend

- NestJS modular monolith mặc định.
- Controller: HTTP mapping/validation/auth context.
- Application/domain: command orchestration và invariants.
- Prisma: persistence adapter; không phải nơi quyết định permission.
- Transaction phải bao gồm business write + version + audit/changefeed/idempotency receipt khi contract yêu cầu.

### Database

- PostgreSQL committed source of truth sau cutover.
- Composite tenant FKs/check constraints/indexes được review; không chỉ dựa vào filter của application.
- Quantity BIGINT serialize qua API bằng decimal string.
- Không hard-delete audit/history một cách phá referential truth.

## 6. Auth boundary

Supabase Auth sở hữu:

- credential lifecycle;
- signup/login/recovery/email verification;
- access/refresh token issuance.

NestJS sở hữu:

- verify signature/issuer/audience/expiry/subject;
- map subject → AppUser;
- membership/role authorization;
- resource ownership/tenant scope.

Không đưa service-role key hoặc JWT signing secret vào browser.

## 7. Offline/sync boundary

- Outbox command có immutable intent + stable idempotency key.
- Timeout/network error = UNKNOWN cho tới khi reconcile.
- Stale version không được auto-overwrite.
- Changefeed cursor là opaque.
- Snapshot fallback phải scoped đúng user/org/garden/environment.
- Account/garden switch phải partition hoặc clear accessible cache phù hợp để không leak tenant.

## 8. Anti-overengineering

### MUST NOT

- tách microservices khi chưa có scaling/isolation reason rõ;
- thêm Kafka/event sourcing/CRDT chỉ vì “cloud app thường có”;
- dùng DomainEvent audit log như event-sourced state;
- đưa GraphQL vào nếu REST/OpenAPI đang đủ;
- tạo generic repository abstraction làm mất domain semantics;
- chọn provider làm kiến trúc phụ thuộc không cần thiết.

### SHOULD

- explicit modules theo domain;
- explicit DTO/action names;
- contract-first API;
- shared pure TypeScript invariants chỉ sau khi audit dependency;
- feature branch nhỏ, reviewable.

## 9. Phase gate

V3-0 chỉ cho phép **design/docs**. Mọi ví dụ NestJS/Prisma/API trong tài liệu là contract proposal, không phải lệnh tạo runtime.

Implementation chỉ bắt đầu khi PROJECT_STATE mở phase tương ứng.

## 10. Review checklist

- [ ] Đúng authority trước/sau cutover?
- [ ] Mỗi query/write scope tenant và authorize server-side?
- [ ] UI không coi optimistic/offline state là committed?
- [ ] Domain invariants ở đúng layer?
- [ ] Transaction + audit/changefeed/idempotency atomic khi cần?
- [ ] Không có secret server trong client?
- [ ] API dùng contract đã review?
- [ ] Không thêm hạ tầng/provider/microservice ngoài nhu cầu thật?
