---
name: review-audit
description: >-
  Use this skill when auditing, reviewing pull requests, inspecting git branches,
  evaluating phase completion, and reporting code issues in Vườn Ươm.
---

# Code Review & Audit Protocol

## 1. Purpose

Quy định quy trình đánh giá, kiểm toán chất lượng mã nguồn (Code Review / Audit) dành cho Agent khi kiểm tra code của agent khác hoặc nghiệm thu hoàn thành một Phase. Đảm bảo đánh giá trung thực, khách quan, đặt tính đúng đắn và kỷ luật phạm vi lên trên hết.

---

## 2. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Khi người dùng yêu cầu: *"Review code"*, *"Audit branch"*, *"Kiểm tra xem P1 đã xong chưa"*, *"Đánh giá chất lượng PR"*.
  - Khi cần rà soát lại toàn bộ codebase trước khi bàn giao một milestone.
- **WHEN NOT TO USE**:
  - Khi đang trực tiếp lập trình tính năng mới (dùng `implementation`).
  - Khi đang xây dựng chiến lược kiểm thử (dùng `testing`).

---

## 3. Review Hierarchy & Sequence (Thứ tự 5 bước rà soát)

Một cuộc audit **BẮT BUỘC** tiến hành tuần tự theo 5 bước sau:

```text
1. Correctness (Tính đúng đắn số lượng & Invariants)
   ↓
2. Scope Compliance (Kỷ luật ranh giới Phase)
   ↓
3. Architecture (Ranh giới kiến trúc & Không over-engineering)
   ↓
4. UX & Mobile (Trải nghiệm Zalo-first, di động một tay)
   ↓
5. Tests (Chất lượng bảo vệ của bài test)
```

### Bước 1 — Correctness (Tối quan trọng):
- Số lượng cây có bị âm không?
- Có bị bán khống (over-reservation) vượt quá cây còn bán không?
- Giữ cây có vô tình làm giảm tồn kho vật lý không?
- Nhả giữ cây (released) có hoàn trả số cây khả dụng không?
- Dữ liệu có lưu bền vững vào IndexedDB sau khi F5/reload không?
- Chế độ offline có hoạt động đúng không?

### Bước 2 — Scope Compliance (Tuân thủ phạm vi):
- Kiểm tra đối chiếu với [.agent/PROJECT_STATE.md](../PROJECT_STATE.md):
  *Agent có làm vượt phase không?* (Ví dụ: task P1 nhưng lại làm form tạo đơn của P2).
- Có tự ý cài thêm Redux, Supabase, Auth, AI không?

### Bước 3 — Architecture (Ranh giới sạch):
- Có component UI nào gọi trực tiếp `db.table(...)` không?
- Logic tính toán số lượng có bị nhét bừa vào thân JSX không?
- Có abstraction nào thừa thãi, vô dụng không?
- Có duplicate state dẫn đến 2 nguồn sự thật không?

### Bước 4 — UX & Mobile (Thân thiện nhà nông):
- Màn hình có hiển thị chuẩn trên viewport $360\text{px} - 430\text{px}$ không?
- Tap target có đủ $\ge 44\times 44\text{px}$ không?
- Ngôn ngữ có thuần Việt lâm nghiệp (Lô cây, Cây còn bán, Đã giữ...) không?
- Số lượng có hỗ trợ định dạng "vạn" và phân tách dấu chấm hàng nghìn không?
- Thông báo lỗi có nhân bản, rõ ràng không?

### Bước 5 — Tests (Bảo vệ thực chất):
- Không chỉ đếm số lượng test. Phải kiểm tra: *Test có thực sự assert các bất biến số lượng không?*
- Mọi bug fix số lượng có kèm theo regression test không?

---

## 4. Severity Model (Phân loại mức độ nghiêm trọng)

Mọi phát hiện khi review phải được gán nhãn mức độ:

| Mức độ | Ý nghĩa | Hành động bắt buộc |
| :--- | :--- | :--- |
| **`BLOCKER`** | Gây sai lệch số lượng, bán khống cây, hỏng dữ liệu, crash luồng chính | **Chặn ngay lập tức**, không được merge/hoàn thành |
| **`HIGH`** | Vi phạm phase scope (làm lấn phase), vỡ UX mobile, lỗi lưu IndexedDB | Phải sửa trước khi nghiệm thu task |
| **`MEDIUM`** | Phá vỡ ranh giới kiến trúc (gọi DB trong UI), code khó bảo trì | Nên sửa ngay hoặc tạo issue theo dõi |
| **`LOW`** | Đặt tên chưa tối ưu, thiếu format nhỏ, cần dọn dẹp biến thừa | Góp ý sửa khi tiện tay |
| **`NOTE`** | Gợi ý cho các phase tương lai | Ghi nhận vào mục Deferred |

---

## 5. Review Report Format (Mẫu báo cáo Audit)

Báo cáo review phải ngắn gọn, tập trung vào vấn đề, **không khen ngợi hoa mỹ**:

```markdown
### 1. Tổng quan kết quả (Audit Verdict)
- Trạng thái: [PASS / CONDITIONAL PASS / FAIL]
- Đánh giá nhanh: (1-2 câu tóm tắt)

### 2. Các vấn đề phát hiện (Findings by Severity)
- [BLOCKER] Tiêu đề vấn đề: Mô tả cụ thể file và dòng code, kèm rủi ro.
- [HIGH] Tiêu đề vấn đề: ...
- [MEDIUM] Tiêu đề vấn đề: ...

### 3. Verification Commands Run
- Kết quả chạy thực tế: typecheck, lint, test, build.

### 4. Hành động khắc phục yêu cầu (Required Action Items)
- Danh sách việc cần sửa theo thứ tự ưu tiên.
```

---

## 6. Failure Modes khi Review

- **Failure Mode 1**: Thấy agent viết 30 bài test nhưng toàn test render nhãn chữ tĩnh, không có test nào kiểm tra công thức tính available khi reserve.
  - *Đánh giá sai*: Báo cáo "Test đầy đủ 30/30 passed".
  - *Đánh giá đúng*: Gán nhãn `HIGH` - Thiếu test bảo vệ domain invariants cho reservation.
- **Failure Mode 2**: Thấy agent làm thêm form nhập cây trong task P1 Read-only.
  - *Đánh giá sai*: Khen ngợi agent "năng suất cao, làm trước tính năng".
  - *Đánh giá đúng*: Gán nhãn `HIGH` - Vi phạm Scope discipline, yêu cầu revert form hoặc đóng băng code sang P2.
