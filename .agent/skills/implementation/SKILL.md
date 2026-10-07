---
name: implementation
description: >-
  Standardized coding workflow for implementing features in Vườn Ươm. Covers inspection,
  identifying invariants, vertical slice development, risk-based verification, and scope discipline.
---

# Feature Implementation Workflow

## 1. Purpose

Chuẩn hóa quy trình thực hiện công việc lập trình của Agent: từ khâu khảo sát mã nguồn hiện có, xác định bất biến nghiệp vụ, triển khai lát cắt mỏng nhất (Vertical Slice), kiểm thử đến báo cáo kết quả.

Mục tiêu là vừa giữ an toàn domain, vừa tránh feedback loop chậm do chạy full quality gate sau mọi chỉnh sửa nhỏ.

---

## 2. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Khi bắt đầu thực hiện bất kỳ task coding / refactoring nào trong dự án.
  - Khi triển khai một màn hình, component, hook hoặc service mới.
- **WHEN NOT TO USE**:
  - Khi chỉ cần đọc tài liệu giải thích cho người dùng mà không sửa mã nguồn.
  - Khi thực hiện review/audit code của người khác (dùng `review-audit`).

---

## 3. The 5-Step Implementation Workflow

```text
Step 1: Inspect mã nguồn & Phase hiện tại
   ↓
Step 2: Xác định Invariants + Risk Level
   ↓
Step 3: Triển khai lát cắt nhỏ nhất
   ↓
Step 4: Verification theo mức rủi ro
   ↓
Step 5: Báo cáo trung thực & minh bạch
```

### Bước 1 — Khảo sát

- Đọc `.agent/PROJECT_STATE.md` để biết phase hiện tại cho phép làm gì.
- Kiểm tra type/domain liên quan.
- Kiểm tra repository/service hiện tại.
- Đọc test hiện có để nắm kỳ vọng.
- Không tạo parallel implementation nếu đã có code tương đương.

### Bước 2 — Xác định Invariants + Risk Level

Trước khi code, xác định task thuộc mức nào:

```text
LOW
CSS / copy / layout / docs

NORMAL
UI behavior / form / navigation / non-critical service

HIGH
quantity / reservation / shipment / Dexie / migration /
backup-restore / destructive reset / cross-entity integrity
```

Nếu HIGH phải đọc `domain-rules` và `testing` trước khi sửa.

### Bước 3 — Triển khai lát cắt nhỏ nhất

Thứ tự từ trong ra ngoài:

1. Domain nếu có.
2. Data / repository nếu có.
3. Application/service.
4. UI/screen.
5. Tests phù hợp với behavior vừa thêm/sửa.

Không xây hạ tầng cho nhu cầu chưa tồn tại.

### Bước 4 — Verification theo mức rủi ro

Không còn quy tắc “mỗi task nhỏ đều chạy full 4 lệnh ngay lập tức”.

Dùng cadence trong `testing/SKILL.md`.

#### Trong lúc làm

```text
LOW
→ manual / visual check
→ targeted tests nếu có logic

NORMAL
→ related tests
→ typecheck/lint khi slice ổn định

HIGH
→ regression test
→ related integration tests
→ full suite trước handoff/push
```

#### Trước push / PR / merge / final handoff

Chạy full gate ít nhất một lần trên exact head được bàn giao:

```bash
cd web
npm run typecheck
npm run lint
npm test
npm run build
```

Ngoại lệ duy nhất:

- low-risk docs/CSS-only có thể dùng targeted/manual local checks và dựa vào exact-head CI full gate;
- báo cáo phải nói rõ chưa chạy full local nếu đúng như vậy.

Nếu task sửa UI: phải visual-check viewport liên quan; responsive bug phải kiểm đúng breakpoint gây lỗi.

### Bước 5 — Báo cáo

Báo cáo kết thúc task gồm:

1. **Implemented**
2. **Changed files**
3. **Behavior**
4. **Verification**
   - targeted checks đã chạy;
   - full checks đã chạy;
   - CI nếu có.
5. **Deferred**
6. **Risks**

Không được nói `all tests pass` nếu chỉ chạy targeted test.

---

## 4. Scope Discipline

- Không vượt roadmap hiện tại.
- Bugfix phục vụ field validation được phép nếu không thêm product feature mới.
- Nếu phát hiện việc ngoài scope, ghi vào Deferred.
- Không trộn UI bugfix với domain/metric refactor nếu không cần thiết.

---

## 5. Checklist trước khi kết thúc Task

### Low/Normal risk
- [ ] Đã chạy targeted/related tests phù hợp?
- [ ] Đã kiểm manual/visual nếu sửa UI?
- [ ] Typecheck/lint đã chạy ở stable slice hoặc trước handoff?

### High risk
- [ ] Có regression test nếu cần?
- [ ] Related integration tests pass?
- [ ] Full suite + build pass trước push/handoff?

### Final handoff / PR / merge
- [ ] Exact head đã được full gate local hoặc CI?
- [ ] Báo cáo phân biệt rõ local targeted vs full verification?
- [ ] Không vượt scope?
