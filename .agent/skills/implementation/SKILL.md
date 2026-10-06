---
name: implementation
description: >-
  Standardized coding workflow for implementing features in Vườn Ươm. Covers inspection,
  identifying invariants, vertical slice development, rigorous verification, and scope discipline.
---

# Feature Implementation Workflow

## 1. Purpose

Chuẩn hóa quy trình thực hiện công việc lập trình của Agent: từ khâu khảo sát mã nguồn hiện có, xác định bất biến nghiệp vụ, triển khai lát cắt mỏng nhất (Vertical Slice), kiểm thử đến báo cáo kết quả.

---

## 2. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Khi bắt đầu thực hiện bất kỳ task coding / refactoring nào trong dự án.
  - Khi triển khai một màn hình, component, hook hoặc service mới.
- **WHEN NOT TO USE**:
  - Khi chỉ cần đọc tài liệu giải thích cho người dùng mà không sửa mã nguồn.
  - Khi thực hiện review/audit code của người khác (dùng `review-audit`).

---

## 3. The 5-Step Implementation Workflow (Quy trình 5 bước bắt buộc)

```text
Step 1: Inspect mã nguồn & Phase hiện tại
   ↓
Step 2: Xác định các Invariants bị ảnh hưởng
   ↓
Step 3: Triển khai lát cắt nhỏ nhất (Vertical Slice)
   ↓
Step 4: Chạy bộ 4 lệnh kiểm tra chất lượng (Verification)
   ↓
Step 5: Viết báo cáo trung thực & minh bạch
```

### Bước 1 — Khảo sát (Inspect):
- Đọc [.agent/PROJECT_STATE.md](../PROJECT_STATE.md) để biết phase hiện tại cho phép làm gì.
- Kiểm tra các type liên quan trong `src/domain/`.
- Kiểm tra repository hiện tại trong `src/data/repositories/`.
- Đọc các test hiện có để nắm bắt kỳ vọng.
- **QUY TẮC**: Không bao giờ tạo module song song (parallel implementation) nếu đã có code tương đương trong repo.

### Bước 2 — Xác định bất biến (Identify Invariants):
- Trước khi gõ dòng code đầu tiên, agent phải tự trả lời:
  *Task này có đụng vào số lượng cây, tồn kho, giữ cây hay xuất giao không?*
- Đọc kỹ `skills/domain-rules/SKILL.md` để ghi nhận các bất biến bắt buộc phải giữ nguyên.

### Bước 3 — Triển khai lát cắt nhỏ nhất (Smallest Vertical Slice):
Triển khai theo thứ tự từ trong ra ngoài:
1. **Domain**: Type và Pure Functions tính toán (nếu có).
2. **Data / Repository**: Các hàm lưu trữ hoặc query cần thiết.
3. **UI / Screen**: Component hoặc Screen mobile-first ($360\text{px} - 430\text{px}$).
4. **Tests**: Viết Unit / Integration test kiểm tra hành vi vừa thêm.
- **QUY TẮC**: Không xây dựng hạ tầng/hàm trừu tượng cho những yêu cầu chưa tồn tại trong task hiện tại.

### Bước 4 — Kiểm chứng nghiêm ngặt (Verification):
Chạy đầy đủ 4 lệnh kiểm tra từ thư mục `web/` trước khi hoàn thành:
```bash
cd web
npm run typecheck   # TypeScript strict, không any, không lỗi type
npm run lint        # Oxlint, 0 errors, 0 warnings
npm test            # Vitest, 100% test suites pass
npm run build       # Vite build + PWA service worker phát sinh thành công
```
- Nếu task có sửa UI: Phải kiểm tra layout trên kích thước mobile viewport.

### Bước 5 — Báo cáo chuẩn mực (Standard Report):
Mọi báo cáo kết thúc task PHẢI gồm các mục:
1. **Implemented**: Những gì đã làm.
2. **Changed files**: Danh sách file đã tạo / sửa đổi kèm đường dẫn link.
3. **Behavior**: Hành vi phần mềm sau khi sửa.
4. **Tests**: Kết quả chạy test thực tế (số lượng test pass).
5. **Deferred**: Những tính năng thuộc phase sau được để lại, không làm lấn sang.
6. **Risks**: Rủi ro kỹ thuật hoặc lưu ý tồn đọng.
- **CẤM**: Không được báo cáo PASS nếu chưa thực sự chạy câu lệnh trong terminal!

---

## 4. Scope Discipline (Kỷ luật phạm vi)

- Nếu task đang ở **Phase P1 (Read-only UX)**:
  - Được phép làm: Xem danh sách lô, lọc theo giống, xem chi tiết đơn, xem người mua/gom.
  - **TUYỆT ĐỐI KHÔNG** tự tiện làm form tạo lô mới hoặc form ghi đơn mới (thuộc P2).
- Nếu phát hiện điểm cần cải tiến nhưng thuộc phase sau:
  - **Ghi vào mục `Deferred` trong báo cáo, TUYỆT ĐỐI KHÔNG CODE**.

---

## 5. Checklist trước khi kết thúc Task

- [ ] Đã chạy `npm run typecheck` và pass 0 lỗi?
- [ ] Đã chạy `npm run lint` và pass 0 lỗi?
- [ ] Đã chạy `npm test` và tất cả test đều pass?
- [ ] Đã chạy `npm run build` và sinh bản build thành công?
- [ ] Có tự tiện làm tính năng vượt quá phase hiện tại không?
- [ ] Báo cáo có đầy đủ các mục Implemented, Changed files, Tests, Deferred, Risks không?
