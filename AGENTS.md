# Vườn Ươm — AI Agent Operating Instructions

Mọi AI Coding/Review/Design Agent làm việc trong repository **Vườn Ươm** phải tuân thủ hệ thống rule dưới đây trước khi sửa code hoặc tài liệu.

## 1. Điểm khởi đầu bắt buộc

Trước mọi task:

1. Đọc [`.agent/PROJECT_STATE.md`](.agent/PROJECT_STATE.md) để xác định **phase hiện tại** và scope được phép.
2. Đọc [`.agent/router.md`](.agent/router.md) để nạp đúng skill.
3. Đọc contract/ADR liên quan trước khi tự suy diễn behavior.
4. Nếu task đụng API giữa frontend/backend, **bắt buộc** đọc `api-contract` trước implementation.

Cấu trúc hiện tại:

- `web/`: React + TypeScript + Vite PWA hiện hữu.
- `docs/`: product, architecture, development và academic docs.
- `.agent/`: Project State, Router và project skills.
- `.github/`: CI/GitHub automation.
- Backend NestJS **chưa được phép triển khai trong V3-0**; vị trí package/runtime chỉ được tạo ở phase implementation đã authorize.

## 2. Project Skills

- `product-context`: product identity, V3 roadmap, scope guardrails.
- `ux-design`: mobile/Zalo-first UX và thuật ngữ.
- `domain-rules`: stock/availability/reservation/shipment invariants.
- `architecture`: V3 cloud-backed/offline-first boundaries, tenancy, data authority.
- `api-contract`: REST/OpenAPI contract, auth context, DTO/error/version/idempotency rules.
- `implementation`: coding workflow và slice discipline.
- `testing`: risk-based verification, domain/server/client/integration tests.
- `github-workflow`: branches, atomic commits, CI, merge safety, two-person coordination.
- `validation`: field evidence/pilot gates; không dùng pilot evidence để tự mở phase kỹ thuật.
- `review-audit`: correctness, tenancy/security, architecture, UX, tests, scope.

## 3. V3 architecture direction

Target đã được chấp thuận ở **mức design**:

```text
React/Vite PWA
  ↕ REST/OpenAPI
NestJS modular monolith
  ↕ Prisma
PostgreSQL

Supabase Auth → JWT/JWKS verification at NestJS
Dexie/IndexedDB → tenant-scoped cache + durable pending outbox after cutover
```

Các điểm không được suy diễn sai:

- PostgreSQL là authority cho committed business facts **sau explicit per-garden cutover**.
- Dexie vẫn cần cho instant start/offline cache/pending commands; không trở thành authority song song sau cutover.
- Supabase Auth xác thực identity; NestJS vẫn phải authorize organization/garden membership.
- Multi-organization/multi-garden là yêu cầu sản phẩm thật, không phải yêu cầu riêng của môn Cloud.
- Modular monolith là mặc định; không tự tách microservices.
- Render hoặc provider khác chỉ là deployment choice, không phải architecture authority.

## 4. Current phase gate

Tại V3-0:

- được phép: ADR, schema/API/sync/migration design, agent skills, threat/access review, roadmap;
- không được phép: executable backend, auth provisioning, cloud database provisioning, live migration, production deployment, real tenant data.

V3-1+ chỉ bắt đầu khi có authorization riêng trong `.agent/PROJECT_STATE.md`.

## 5. Ba nguyên tắc bất di bất dịch

1. **Domain correctness**: không oversell; reservation không làm giảm physical stock; shipment mới làm giảm physical stock theo contract.
2. **Tenant isolation**: mọi server read/write phải scope và authorize organization/garden; deny by default.
3. **Contract-first collaboration**: frontend và backend không tự đoán request/response của nhau. Shared API contract được chốt trước khi hai người code song song.

## 6. Product/course boundary

Coursework chỉ trình bày một stable snapshot của sản phẩm thật. Không được:

- thêm feature chỉ để đủ slide;
- đổi provider/architecture chỉ vì rubric;
- bypass V3 phase gate;
- mô tả feature chưa tồn tại như đã triển khai.
