---
name: product-context
description: >-
  Product identity, target users, V3 roadmap, product/course boundary,
  and scope guardrails for Vườn Ươm.
---

# Product Context & Scope Discipline

## 1. Product thesis

**Vườn Ươm — Sổ cây giống trên điện thoại** là công cụ vận hành đơn giản cho chủ vườn, đầu mối và người làm cây giống lâm nghiệp.

Câu hỏi cốt lõi:

- Lô nào còn cây?
- Bao nhiêu cây đã đủ chuẩn?
- Bao nhiêu cây còn bán?
- Đã giữ cho ai?
- Đơn nào đang thiếu nguồn?
- Khi nào/giao được bao nhiêu?

Sản phẩm không được biến thành ERP tổng quát, marketplace công cộng, accounting suite, chat app hay AI platform chỉ vì các hệ thống đó “thường có”.

## 2. User constraints

- Mobile Android phổ thông, 360–430px.
- Thao tác một tay, ngoài vườn/bãi ươm.
- 3G/4G có thể yếu/chập chờn.
- Người dùng quen Zalo hơn phần mềm quản trị.
- Quantity thường nói theo “vạn”, nhưng storage/domain phải giữ integer canonical.

## 3. V3 direction

Roadmap hiện hành ở cấp sản phẩm:

```text
V3-0  Architecture & Product Foundation       NOW — docs/design only
V3-1  Identity & Tenant Foundation             pending authorization
V3-2  Server Domain & Migration                pending authorization
V3-3  Multi-device Offline Sync                pending authorization
V3-4  Onboarding & Help                        pending authorization
V3-5  Operational Expansion                    pending discovery/authorization
```

Authority trạng thái chi tiết: `.agent/PROJECT_STATE.md`.

Target design:

- React/TypeScript/Vite PWA.
- NestJS modular monolith.
- PostgreSQL + Prisma.
- Supabase Auth.
- Dexie tenant-scoped offline cache/outbox sau cutover.

## 4. Multi-organization/garden model

- User có thể tham gia nhiều organization/garden.
- Một organization có nhiều garden.
- Role có thể khác nhau theo garden.
- Không tự động chia sẻ tồn/đơn/khách cross-organization.
- Membership/authorization là product foundation, không phải HR suite.

## 5. Product/course boundary

Mini-project Cloud dùng **stable snapshot của sản phẩm thật**.

Coursework không được:

- tạo roadmap song song;
- ép feature;
- ép provider;
- bypass gate;
- biến demo deadline thành product deadline.

## 6. Scope rules

### MUST

1. Đọc PROJECT_STATE trước khi nói phase nào đang mở.
2. Tính năng phải phục vụ nhu cầu sản phẩm thật.
3. Giữ offline usability như một constraint thật.
4. Giữ domain invariants và tenant isolation.
5. Phân biệt rõ “design approved” với “implementation authorized”.

### MUST NOT

1. Tự mở V3-1+ vì V3 architecture đã được chốt.
2. Tự thêm payment/debt/AI/MCP/marketplace/chat/route optimization.
3. Tự thêm cross-garden pooled stock/reservation.
4. Dùng môn Cloud làm lý do thay đổi sản phẩm.

## 7. Checklist

- [ ] Task nằm trong phase được PROJECT_STATE cho phép?
- [ ] Có giải quyết pain thật của Vườn Ươm?
- [ ] Có giữ mobile/offline constraints?
- [ ] Có cần auth/cloud? Nếu có, phase tương ứng đã được authorize chưa?
- [ ] Có làm leak/couple dữ liệu giữa organizations/gardens không?
- [ ] Có đang thêm feature chỉ để “trông production hơn” không?

## 8. Historical validation

P0–P6, FC/V2 và pilot artifacts vẫn là evidence/history quan trọng nhưng **không còn là current roadmap authority**. Real pilot vẫn có gate riêng; V3 direction không tự biến historical pilot NO-GO thành GO.
