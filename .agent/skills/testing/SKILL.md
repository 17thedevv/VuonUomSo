---
name: testing
description: >-
  Testing strategy and requirements for Vườn Ươm. Prioritizes domain invariants,
  critical workflows, repository persistence, and regression testing for inventory mutations.
---

# Testing Strategy & Quality Standards

## 1. Purpose

Xác lập kim chỉ nam và thứ tự ưu tiên kiểm thử cho Vườn Ươm. Đảm bảo mọi tính toán số lượng cây, tồn kho và nghiệp vụ giữ cây đều có bài test tự động bảo vệ, tránh tình trạng "test cho có" hoặc chỉ đếm số lượng test.

---

## 2. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Khi viết test mới cho code vừa triển khai.
  - Khi sửa lỗi (bug fix) liên quan đến số lượng, tồn kho, đơn hàng hoặc chuyến giao.
  - Khi đánh giá độ bao phủ an toàn của một tính năng trước khi nghiệm thu.
- **WHEN NOT TO USE**:
  - Khi tìm hiểu ranh giới kiến trúc và cấu trúc thư mục (dùng `architecture`).
  - Khi thẩm định kết quả thử nghiệm người dùng (dùng `validation`).

---

## 3. Testing Hierarchy & Priority (Thứ tự ưu tiên kiểm thử)

$$\mathbf{Domain\; Invariants} \quad>\quad \mathbf{Critical\; Workflows} \quad>\quad \mathbf{Repository\; Persistence} \quad>\quad \mathbf{UI\; Detail}$$

1. **Ưu tiên 1 — Domain Invariants (Tối quan trọng)**:
   - Các phép tính khả dụng, tồn kho, giữ cây, tỷ lệ sống và bộ parser số lượng "vạn". Phải có 100% test coverage cho các hàm pure domain này.
2. **Ưu tiên 2 — Critical Workflows (Luồng nghiệp vụ sống còn)**:
   - Đặt đơn $\rightarrow$ Giữ cây $\rightarrow$ Cây còn bán giảm.
   - Hủy cọc $\rightarrow$ Nhả giữ cây $\rightarrow$ Cây còn bán tăng trở lại.
   - Xuất xe giao cây $\rightarrow$ Cây thực tế trong vườn giảm.
3. **Ưu tiên 3 — Repository Persistence (Tính bền vững dữ liệu)**:
   - Ghi dữ liệu vào IndexedDB $\rightarrow$ Đọc lại dữ liệu sau khi tải lại trang phải nguyên vẹn.
   - Reset dữ liệu mẫu $\rightarrow$ Toàn bộ dữ liệu demo chuẩn được phục hồi.
4. **Ưu tiên 4 — UI Detail (Hành vi giao diện)**:
   - Kiểm tra những gì người dùng thực sự nhìn thấy và tương tác (nút bấm, thông báo lỗi, format số).

---

## 4. Test Types & Guidelines

### 1. Unit Tests (Mục tiêu: Nhanh, Độc lập, Tuyệt đối tin cậy)
Bắt buộc có test cho:
- `parseQuantity`: Các chuỗi `3 vạn`, `3v`, `4,52 vạn`, `30.000`, `30,000`, `30000`, số âm, chuỗi rác.
- `availableQuantityForBatch`: Khi còn cây, khi đã giữ hết, khi giữ vượt (clamp về 0).
- `reservedQuantityForBatch`: Chỉ cộng reservation `active`, bỏ qua `released`/`fulfilled`.
- `survivalRate`: Tính toán tỷ lệ sống, xử lý trường hợp chia cho 0 (`initialQuantity = 0`).

### 2. Integration Tests (Mục tiêu: Phối hợp tầng Repository & Domain)
Sử dụng `fake-indexeddb` để kiểm tra:
```typescript
// Ví dụ luồng phối hợp bắt buộc test:
it('releases reservation and restores batch availability', async () => {
  // 1. Tạo batch 30.000 cây đủ bán
  // 2. Tạo reservation 10.000 cây -> available còn 20.000
  // 3. Đổi trạng thái reservation sang 'released'
  // 4. Kiểm tra available tính lại phải hồi phục đủ 30.000 cây
})
```

### 3. UI Component Tests (Mục tiêu: Trải nghiệm người dùng)
- Dùng `@testing-library/react`.
- Chỉ test hành vi người dùng nhìn thấy (User-visible behavior).
- **KHÔNG** test chi tiết triển khai nội bộ (như state ngầm, tên biến component).

### 4. End-to-End (E2E) Policy
- Trong giai đoạn Prototype, **KHÔNG** viết hàng chục bài E2E test cho mọi màn hình.
- Chỉ xây dựng 1 luồng E2E cốt lõi:
  $$\text{Mở sổ} \longrightarrow \text{Tạo lô} \longrightarrow \text{Ghi đơn} \longrightarrow \text{Giữ cây} \longrightarrow \text{Giao xe}$$

---

## 5. Mandatory Bug Regression Policy (Chính sách lỗi hồi quy)

Mọi báo cáo lỗi hoặc bug fix liên quan đến:
- Số lượng cây (`quantity`);
- Khả dụng và giữ cây (`reservation` / `availability`);
- Xuất kho và chuyến xe (`shipment`);
- Lưu trữ cục bộ (`IndexedDB` / `Dexie`);

**BẮT BUỘC PHẢI CÓ một regression test case mới** mô phỏng lại tình huống lỗi trước khi sửa và đảm bảo test đó pass sau khi sửa xong.

---

## 6. Testing Checklist

- [ ] Các hàm trong `src/domain/quantity.ts` có đủ bài test biên (edge cases) không?
- [ ] Test có kiểm tra trường hợp nhả giữ cây (released) hồi phục availability không?
- [ ] Test có kiểm tra partial shipment không trừ lố số lượng thực tế không?
- [ ] Lệnh `npm test` có chạy sạch 100% không có cảnh báo nào không?
- [ ] Mã test có dùng `fake-indexeddb` độc lập, dọn dẹp sạch sẽ sau mỗi test case (`clearAllData`) không?
