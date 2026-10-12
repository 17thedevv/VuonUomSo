# Vườn Ươm — Agent Skill System

Thư mục `.agent/` là hệ điều hành cho AI Coding/Review/Design Agents của Vườn Ươm.

## 1. Cách nạp skill

1. Đọc [PROJECT_STATE.md](./PROJECT_STATE.md).
2. Tra [router.md](./router.md).
3. Đọc skill tương ứng.
4. Đọc ADR/contract được skill trỏ tới.
5. Chỉ thực hiện scope đã được phase hiện tại cho phép.

`PROJECT_STATE.md` là authority cho **trạng thái phase**, không hardcode NEXT task trong từng skill.

## 2. Skill catalog

```text
.agent/
├── README.md
├── PROJECT_STATE.md
├── router.md
└── skills/
    ├── product-context/
    ├── ux-design/
    ├── domain-rules/
    ├── architecture/
    ├── api-contract/
    ├── implementation/
    ├── testing/
    ├── github-workflow/
    ├── validation/
    └── review-audit/
```

### product-context
Bản chất sản phẩm, người dùng, V3 roadmap và scope discipline.

### ux-design
Mobile-first 360–430px, một tay, tiếng Việt lâm nghiệp, quantity UX.

### domain-rules
Bất biến Batch/Availability/Order/Reservation/Fulfillment/Shipment.

### architecture
Cloud-backed/offline-first V3; frontend/server/database/auth/tenancy boundaries.

### api-contract
REST/OpenAPI contract giữa frontend và backend: auth, tenant scope, DTO, pagination, errors, versions, idempotency, sync.

### implementation
Vertical slices, risk level, contract-first coding và handoff.

### testing
Domain/server/client/integration/concurrency/offline verification.

### github-workflow
Branch/commit/PR/CI rules và cách hai thành viên làm song song mà giảm conflict.

### validation
Field/pilot evidence. Validation gate và V3 implementation authorization là hai gate độc lập; không suy diễn cái này mở cái kia.

### review-audit
Review correctness, authorization/tenant isolation, contract compatibility, architecture, UX và tests.

## 3. V3 rule quan trọng

V3-0 hiện là **docs/design only**. Agent có thể thiết kế architecture/API/schema/sync nhưng không được biến tài liệu thành executable backend hoặc cloud provisioning.

Khi V3-1+ được authorize, agent phải tiếp tục dùng đúng skill và contract đã review; không được coi việc có tài liệu là implementation approval.

## 4. Khi nào thêm skill mới?

Chỉ thêm khi có một quy trình lặp lại có rule hành động rõ ràng và chưa được skill hiện có bao phủ. Không thêm skill chỉ để lưu ghi chú lý thuyết.
