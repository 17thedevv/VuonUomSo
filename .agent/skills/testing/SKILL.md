---
name: testing
description: >-
  Testing strategy and requirements for Vườn Ươm. Prioritizes domain invariants,
  critical workflows, repository persistence, regression testing, and risk-based
  verification cadence to keep feedback loops fast without weakening merge safety.
---

# Testing Strategy & Quality Standards

## 1. Purpose

Xác lập kim chỉ nam, mức ưu tiên và nhịp chạy kiểm thử cho Vườn Ươm.

Mục tiêu kép:

1. Bảo vệ các bất biến nghiệp vụ quan trọng như số lượng cây, tồn kho, giữ cây, giao cây và dữ liệu local.
2. Giữ feedback loop nhanh; **không chạy toàn bộ hàng trăm test sau mọi chỉnh sửa nhỏ** nếu rủi ro không yêu cầu.

Nguyên tắc:

```text
Test đúng phạm vi trong lúc làm
→ full quality gate tại ranh giới tích hợp / bàn giao
```

Không dùng số lượng test như thước đo chất lượng.

---

## 2. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Khi viết test mới cho code vừa triển khai.
  - Khi sửa lỗi liên quan đến domain, persistence, UI hoặc workflow.
  - Khi chọn mức verification phù hợp cho một thay đổi.
  - Khi đánh giá độ bao phủ an toàn trước commit quan trọng, push, PR hoặc merge.
- **WHEN NOT TO USE**:
  - Khi tìm hiểu ranh giới kiến trúc và cấu trúc thư mục (dùng `architecture`).
  - Khi thẩm định kết quả thử nghiệm người dùng (dùng `validation`).

---

## 3. Testing Hierarchy & Priority

```text
Domain Invariants
>
Critical Workflows
>
Repository Persistence
>
UI Behavior
>
Visual Detail
```

1. **Ưu tiên 1 — Domain Invariants**
   - Availability, reservation, fulfillment, shipment, quantity parser và các phép tính tồn kho.
   - Pure domain functions phải có test biên mạnh.
2. **Ưu tiên 2 — Critical Workflows**
   - Ghi đơn → giữ cây → availability thay đổi đúng.
   - Nhả giữ → availability hồi phục đúng.
   - Xác nhận chuyến → physical stock giảm đúng và atomic.
3. **Ưu tiên 3 — Repository Persistence**
   - IndexedDB/Dexie ghi rồi đọc lại chính xác.
   - Migration, backup/restore và reset semantics phải được bảo vệ.
4. **Ưu tiên 4 — UI Behavior**
   - Test hành vi người dùng nhìn thấy: submit, lỗi, điều hướng, trạng thái nút.
5. **Ưu tiên 5 — Visual Detail**
   - CSS/layout responsive chủ yếu kiểm bằng visual QA; không viết test brittle chỉ để assert class Tailwind.

---

## 4. Risk-Based Verification Cadence

### Level A — Tiny / Low-Risk Change

Ví dụ:

- CSS/Tailwind class;
- spacing, typography, responsive layout;
- copy/text;
- icon;
- refactor cục bộ không đổi behavior;
- docs/skill.

Trong lúc làm:

```text
targeted test nếu có test liên quan
+
manual/visual check phù hợp
```

Không bắt buộc chạy toàn bộ `npm test` sau mỗi edit.

Ví dụ:

```bash
npx vitest run src/shared/__tests__/AppShell.test.tsx
```

Nếu thay đổi thuần CSS và không có logic mới, có thể không cần chạy Vitest ở mỗi vòng chỉnh sửa.

---

### Level B — Normal Feature / UI Behavior Change

Ví dụ:

- component có logic mới;
- form;
- navigation;
- application service không chạm invariant tồn kho;
- validation instrumentation UI.

Trong lúc làm:

```text
test file / feature suite liên quan
→ typecheck khi slice ổn định
```

Khi hoàn thành slice:

```text
related tests
+
typecheck
+
lint
```

Full suite có thể chờ đến trước push/PR/handoff nếu không có dấu hiệu regression rộng.

---

### Level C — High-Risk Domain / Data Change

Bao gồm:

- quantity / availability;
- reservation;
- shipment / fulfillment;
- Dexie transaction;
- schema migration;
- backup / restore;
- cross-entity invariants;
- data deletion/reset;
- code dùng chung có ảnh hưởng nhiều workflow.

Bắt buộc:

```text
regression test mới
+
related integration tests
+
full test suite trước khi bàn giao hoặc push
+
production build
```

Không được tối ưu thời gian bằng cách bỏ full verification ở nhóm này.

---

## 5. Verification Boundaries

### Trong khi đang sửa code

Ưu tiên feedback nhanh:

```text
tiny edit      → manual/targeted check
small slice    → related tests
stable slice   → typecheck + lint + related tests
```

### Trước atomic commit

- Low/normal risk: related tests + typecheck/lint phù hợp.
- High risk: full tests + build.

Không bắt buộc full suite cho mọi commit CSS/docs nhỏ.

### Trước push / handoff / PR / merge

Bắt buộc full local quality gate ít nhất một lần trên exact head được bàn giao:

```bash
cd web
npm run typecheck
npm run lint
npm test
npm run build
```

Nếu CI tự chạy trên push, local full gate vẫn cần cho high-risk changes; với low-risk UI/docs có thể dựa vào targeted local checks + full CI, miễn báo cáo trung thực.

### CI

CI luôn chạy full:

```text
install
→ typecheck
→ lint
→ test
→ build
```

Không giảm CI xuống targeted tests.

---

## 6. Test Types & Guidelines

### 1. Unit Tests

Bắt buộc có test mạnh cho các pure domain functions như:

- `parseQuantity`;
- availability/reservation helpers;
- shipment/coverage helpers;
- survival rate và edge cases số học.

### 2. Integration Tests

Dùng `fake-indexeddb` để kiểm tra repository + domain/application phối hợp.

Ví dụ:

```typescript
it('releases reservation and restores batch availability', async () => {
  // 1. Tạo batch đủ bán
  // 2. Giữ một phần
  // 3. Release reservation
  // 4. Assert availability hồi phục đúng
})
```

### 3. UI Component Tests

- Dùng `@testing-library/react`.
- Test user-visible behavior.
- Không test internal state/implementation details.
- Không assert hàng loạt utility classes chỉ để chứng minh responsive CSS.

### 4. Responsive / Visual QA

Với bug layout hoặc styling:

- kiểm trên viewport thật hoặc preview deployment;
- tối thiểu các breakpoint liên quan;
- kiểm overflow, hierarchy, navigation, modal/toast positioning;
- chỉ thêm automated test khi có responsive **logic/conditional rendering**, không phải chỉ CSS.

### 5. E2E Policy

Trong prototype không viết hàng chục E2E test.

Nếu có E2E, ưu tiên một core flow:

```text
Mở sổ
→ Tạo lô
→ Ghi đơn
→ Giữ cây
→ Giao cây
```

---

## 7. Mandatory Bug Regression Policy

Mọi bug fix liên quan đến:

- quantity;
- availability / reservation;
- shipment;
- IndexedDB / Dexie;
- migration;
- backup / restore;
- destructive reset;
- cross-entity integrity;

**BẮT BUỘC có regression test mô phỏng lỗi trước khi sửa.**

Với bug thuần visual/CSS:

- regression test tự động **không bắt buộc** nếu không có logic;
- bắt buộc visual verification ở breakpoint gây lỗi;
- nếu bug do conditional rendering/breakpoint logic, thêm component test tương ứng.

---

## 8. Test Selection Rules

Khi chọn targeted test:

1. Chạy test của file/component/service vừa đổi.
2. Chạy test của direct dependents nếu behavior dùng chung thay đổi.
3. Nếu sửa helper/shared module có fan-out rộng, nâng risk level và chạy suite rộng hơn.
4. Nếu targeted test fail bất thường ở module khác, mở rộng phạm vi.
5. Không bỏ full suite ở final integration boundary chỉ vì targeted tests đã xanh.

---

## 9. Reporting Rules

Báo cáo phải ghi **đúng cái đã chạy**, ví dụ:

```text
During implementation:
- AppShell tests: PASS
- Manual 375/1440 viewport check: PASS

Final verification:
- typecheck: PASS
- lint: PASS
- full tests: 259/259 PASS
- build: PASS
```

Không được ghi "all tests pass" nếu chỉ chạy targeted test.

---

## 10. Checklist

### Trong lúc làm

- [ ] Risk level đã được xác định?
- [ ] Đã chọn test nhỏ nhất đủ bảo vệ thay đổi?
- [ ] Bug domain/data có regression test mới nếu bắt buộc?
- [ ] UI visual change có manual responsive check?

### Trước push / PR / merge / final handoff

- [ ] `npm run typecheck` pass?
- [ ] `npm run lint` pass?
- [ ] `npm test` full suite pass hoặc CI exact-head full suite pass theo policy?
- [ ] `npm run build` pass?
- [ ] Báo cáo phân biệt rõ targeted checks và full checks?
