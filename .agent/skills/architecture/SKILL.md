---
name: architecture
description: >-
  Use this skill to guide architectural decisions, data boundaries, repository interfaces,
  Dexie IndexedDB implementations, and prevent premature over-engineering.
---

# Architecture & Boundary Guidelines

## 1. Purpose

Bảo vệ kiến trúc tinh giản của **Vườn Ươm** trong giai đoạn Prototype: tối ưu cho **tốc độ học hỏi và kiểm chứng (Learning Speed > Scalability)**, đồng thời giữ ranh giới sạch sẽ để sau này có thể thay thế IndexedDB bằng Cloud Backend mà không phải viết lại tầng giao diện.

---

## 2. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Khi thiết kế hoặc mở rộng Repository, Service, hoặc Hooks.
  - Khi thêm bảng mới hoặc sửa schema IndexedDB (Dexie).
  - Khi quyết định nơi đặt code của một logic mới (UI, Domain, hay Data).
  - Khi có ý định thêm thư viện quản lý state hoặc công cụ bên ngoài.
- **WHEN NOT TO USE**:
  - Khi định nghĩa các bất biến nghiệp vụ số lượng tồn kho (dùng `domain-rules`).
  - Khi tinh chỉnh bố cục hay màu sắc giao diện (dùng `ux-design`).

---

## 3. Current Intended Architecture (Phân tầng kiến trúc)

```text
┌────────────────────────────────────────────────────────┐
│ UI Layer (Screens & Components: Onboarding, Today...)  │
└───────────────────────────┬────────────────────────────┘
                            │ gọi qua
┌───────────────────────────▼────────────────────────────┐
│ Hooks & Services Layer (bootstrapApp, useOnlineStatus) │
└─────────────┬────────────────────────────┬─────────────┘
              │ sử dụng                    │ gọi qua
┌─────────────▼───────────────┐ ┌──────────▼─────────────┐
│ Domain Layer (Pure Logic)   │ │ Repository Interfaces  │
│ - quantity parser & math    │ │ - BatchRepository      │
│ - invariants & calculations │ │ - OrderRepository      │
└─────────────────────────────┘ └──────────┬─────────────┘
                                           │ triển khai qua
                                ┌──────────▼─────────────┐
                                │ Dexie / IndexedDB      │
                                │ (schemaVersion = 1)    │
                                └────────────────────────┘
```

---

## 4. Architectural Rules (Quy tắc kiến trúc)

### MUST:
1. **Ranh giới Repository sạch**:
   React Component **MUST NOT** gọi trực tiếp `db.batches.add(...)` hay `db.table(...)`. Mọi truy xuất dữ liệu phải thông qua Repository Interface rõ ràng.
2. **Domain độc lập 100%**:
   Mọi file trong `src/domain/` **MUST NOT** import bất kỳ thư viện UI nào (React, React Router, HTML elements). Domain phải là Pure TypeScript.
3. **Repository không chứa UI concern**:
   Repository **MUST NOT** xử lý định dạng hiển thị, chuỗi JSX, hay thông báo toast.
4. **Logic nghiệp vụ test được độc lập**:
   Mọi phép tính tồn kho, khả dụng, tỷ lệ sống phải chạy được trong môi trường Unit test thuần túy không cần trình duyệt thật.
5. **Schema Database có phiên bản rõ ràng**:
   Dexie Database **MUST** có explicit `version(N)` để hỗ trợ migration sau này.

### SHOULD:
1. **Explicit Repository Interfaces**:
   Ưu tiên interface tường minh (`BatchRepository`, `OrderRepository`) thay vì generic abstraction mù mờ (`Repository<T, ID>`).
2. **Feature-Oriented Folder Structure**:
   Tổ chức code theo tính năng (`features/batches/`, `features/orders/`).

### MUST NOT (Nghiêm cấm Over-engineering):
1. **MUST NOT** cài đặt Redux, Zustand, MobX khi State cục bộ + Context/Hooks đã đủ giải quyết bài toán prototype.
2. **MUST NOT** áp dụng CQRS, Event Sourcing, Clean Architecture ceremony cồng kềnh, hay DI Container (Inversify, Tsyringe).
3. **MUST NOT** xây dựng backend (Node/Express, NestJS, Supabase) trước khi sản phẩm được kiểm chứng thực địa.
4. **MUST NOT** xây dựng cơ chế đồng bộ realtime phức tạp (Conflict resolution, CRDT) khi người dùng hiện tại chỉ dùng trên 1 máy điện thoại.

---

## 5. Lưu ý quan trọng về Bảng `events`

Bảng `events` trong cơ sở dữ liệu hiện tại là:
> **Append-only event log phục vụ phân tích hành vi và kiểm toán cơ bản.**

**TUYỆT ĐỐI KHÔNG** được diễn giải bảng này thành yêu cầu xây dựng kiến trúc *Event-Driven / Event-Sourcing* (như EventStore, replay events để dựng state). State của hệ thống hiện tại là stateful trong các bảng chuyên biệt (`batches`, `orders`, `reservations`).

---

## 6. Architecture Review Checklist

- [ ] Component UI có import `db` từ `data/db.ts` không? (Nếu có $\rightarrow$ VI PHẠM, phải chuyển sang Repository).
- [ ] File trong `src/domain/` có import `react` không? (Nếu có $\rightarrow$ VI PHẠM).
- [ ] Có phát sinh generic abstraction vô ích làm mờ type safety không?
- [ ] Có thêm dependency nặng nào vào `package.json` mà chưa được phép không?
- [ ] Thay đổi schema DB có nâng cấp version tương thích không?

---

## 7. Failure Modes & Examples

- **Failure Mode 1**: Agent tạo class `AbstractBaseRepository<T, ID>` với 30 methods generic:
  - *Đánh giá*: Vi phạm nguyên tắc đơn giản. Prototype cần explicit interface cho từng entity để dễ đọc và sửa nhanh.
- **Failure Mode 2**: Agent trực tiếp viết `db.batches.where('code').equals(code).first()` trong `TodayScreen.tsx`:
  - *Đánh giá*: Vi phạm ranh giới phân tầng. Khi cần đổi sang gọi API backend, toàn bộ UI sẽ phải viết lại.
  - *Khắc phục*: Thêm method `getByCode(code: string)` vào `BatchRepository` và triển khai trong `DexieBatchRepository`.
