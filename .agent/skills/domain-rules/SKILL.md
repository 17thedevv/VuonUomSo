---
name: domain-rules
description: >-
  Canonical Vườn Ươm domain correctness rules for stock, availability,
  reservation Q/F/outstanding/coverage, orders and shipments.
---

# Forestry Domain Invariants & Rules

## 1. Purpose

Bảo vệ semantics đã được kiểm chứng của Vườn Ươm khi chuyển sang V3 server-authoritative architecture.

Các implementation mới **không được đơn giản hóa** reservation thành “quantity đang giữ” hoặc biến external supplier commitment thành stock của vườn.

## 2. Core quantities

### Batch

- `initialQuantity`: số ban đầu.
- `currentQuantity`: physical/living stock hiện còn.
- `readyQuantity`: số đã đủ chuẩn.
- Luôn: `0 <= readyQuantity <= currentQuantity <= initialQuantity`.

### Reservation

Với mỗi reservation:

- **Q = quantity**: tổng cam kết của record ở phiên bản hiện tại, gồm cả phần đã xuất.
- **F = fulfilledQuantity**: số thực tế đã xuất từ reservation đó.
- `0 <= F <= Q`.

### Outstanding O

```text
active     → O = max(Q - F, 0)
released   → O = 0
fulfilled  → O = 0
```

`O` mới là lượng **đang giữ/chưa xuất**.

### Coverage C của một reservation

```text
active     → C = Q
fulfilled  → C = Q
released   → C = F
```

Released source vẫn giữ lịch sử phần đã xuất `F`; không xóa coverage lịch sử.

### Coverage của order

```text
orderCoverage = sum(C của mọi reservation own + external)
```

### Shortage của order

```text
shortage = max(requestedQuantity - orderCoverage, 0)
```

Shortage là trạng thái nghiệp vụ hợp lệ; không tự clamp hoặc tạo nguồn giả.

## 3. Availability của own batch

Chỉ **own-batch outstanding O** tham gia availability của lô:

```text
ownOutstanding(batch)
  = sum(O của reservation sourceType=own_batch trỏ batch đó)

available(batch)
  = max(readyQuantity - ownOutstanding(batch), 0)
```

External supplier commitment **không** làm giảm availability của own batch.

Lưu ý: historical/committed shortage có thể khiến tổng outstanding lớn hơn ready sau các biến động/reconciliation hợp lệ. Read model phải hiển thị shortage trung thực; **new reserve command** vẫn phải kiểm tra current available tại commit và không được oversell.

## 4. Source semantics

Reservation phải exclusive:

### own_batch

- có `batchId`;
- không có `supplierId`;
- giữ cây dựa trên current available của lô;
- shipment confirm có thể làm giảm physical/ready stock của lô theo quantity thực xuất.

### external_supplier

- có `supplierId`;
- không có `batchId`;
- là explicit commitment từ nguồn ngoài;
- không được suy diễn thành tồn kho trong vườn;
- shipment external không làm giảm own batch stock.

## 5. Order creation

Tạo order chỉ ghi nhu cầu.

**MUST NOT auto-reserve** khi tạo order trừ khi một contract tương lai explicit thay đổi behavior và được review riêng.

## 6. Shipment semantics

- Planned shipment **không phải shipped**.
- Chỉ completed/confirmed actual shipment mới tăng fulfilled/shipped truth.
- Own source actual shipment mới giảm own physical/ready stock.
- Partial shipment được phép.
- Completed shipment/fulfillment history không được xóa khi release phần outstanding còn lại.

## 7. No oversell

Tạo **new own reservation** phải re-read authority tại transaction commit và đảm bảo lượng mới không vượt current available.

Không được dựa vào:

- stale client cache;
- optimistic UI;
- preview cũ;
- client-computed availability.

V3 server phải serialize/lock/version-check theo reviewed transaction strategy.

## 8. Idempotency

Retry cùng business intent không được:

- tạo duplicate reservation;
- confirm shipment hai lần;
- giảm stock hai lần;
- append duplicate durable business outcome.

V3 dùng server idempotency receipt theo API/sync contract; historical local operation guards vẫn phải được preserve khi migrate semantics.

## 9. Quantity representation

### Local historical code
Hiện tại JS quantity phải là safe non-negative integer theo existing guards.

### V3 API/server
PostgreSQL dùng BIGINT cho business quantity theo schema design. API serialize quantity bằng **canonical decimal string** để tránh precision loss.

Không parse qua floating point rồi silently round.

## 10. Server/client placement

- Pure invariant/calculation có thể share TypeScript sau dependency audit.
- Server là canonical validator cho committed writes sau cutover.
- Client validation phục vụ UX, không thay server validation.
- React JSX không chứa ad-hoc stock arithmetic.

## 11. Mutation checklist

Trước mọi mutation:

- [ ] Quantity nào đổi: physical, ready, Q, F hay planned?
- [ ] Source own hay external?
- [ ] O và C sau mutation là gì?
- [ ] Order shortage có hiển thị trung thực?
- [ ] Có oversell từ stale availability không?
- [ ] Planned có bị nhầm thành shipped không?
- [ ] Retry cùng intent có duplicate effect không?
- [ ] Tenant/garden references có cùng scope không?
- [ ] Audit/history cần preserve gì?

## 12. Canonical references

Khi skill này mơ hồ, ưu tiên contract đã review trong repository, đặc biệt:

- `docs/development/FC3-FUNCTIONAL-CONTRACT.md`
- `docs/development/FC4-FUNCTIONAL-CONTRACT.md`
- current pure-domain helpers/tests trên merged main
- V3 architecture/API docs chỉ được map semantics, không tự viết lại nghiệp vụ.

Historical FC5 contract chỉ là reference cho capability preserved/not adopted trừ khi scope được mở lại.
