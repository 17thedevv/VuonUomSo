---
name: github-workflow
description: >-
  Git and GitHub workflow rules for Vườn Ươm. Enforces branching standards, atomic conventional
  commits, pull/merge safety gates, minimal CI pipeline, and strict agent permission boundaries.
---

# Git & GitHub Workflow for Vườn Ươm

## 1. Purpose

Chuẩn hóa thao tác Git/GitHub, bảo vệ `main`, giữ commit nhỏ và đảm bảo **full quality gate tại ranh giới tích hợp**, không ép full suite sau mọi chỉnh sửa nhỏ.

---

## 2. Skill Combination

```text
coding task
→ implementation + testing

branch / commit / PR / CI
→ + github-workflow
```

---

## 3. Standard Workflow Cycle

```text
feature/fix branch
↓
small implementation slice
↓
targeted / related verification while developing
↓
atomic commit
↓
repeat if needed
↓
full quality gate on exact integration head
↓
push / CI
↓
review
↓
merge main
```

Điểm quan trọng:

- targeted testing được phép trong inner loop;
- full gate bắt buộc trước merge và tại final handoff;
- CI luôn chạy full.

---

## 4. Branching

1. `main` luôn ổn định.
2. Task mới dùng branch riêng, trừ khi user đã chỉ định branch hiện tại.
3. Naming:
   - `feat/*`
   - `fix/*`
   - `chore/*`
   - `docs/*`
   - `test/*`
4. Không tạo branch mới vô cớ nếu đã ở đúng branch của task.

---

## 5. Atomic Commits

1. Mỗi commit một mục đích.
2. Không trộn:
   - styling với domain bugfix;
   - refactor với integrity fix;
   - docs với unrelated product code.
3. Conventional commits.
4. Không commit:
   - `dist/`;
   - `.env*`;
   - secrets;
   - IDE/OS junk.

---

## 6. Verification Before Commit vs Before Merge

### Trong chu kỳ phát triển

Không bắt buộc full suite sau mọi commit nhỏ.

Ví dụ commit CSS/layout:

```text
visual check
+ relevant component test
+ typecheck/lint nếu hợp lý
```

Ví dụ commit domain/data:

```text
regression test
+ related integration tests
+ full gate trước push/handoff
```

### Trước push quan trọng / PR / final handoff / merge

Full quality gate:

```bash
cd web
npm run typecheck
npm run lint
npm test
npm run build
```

Với low-risk CSS/docs-only:
- có thể không chạy full local nếu exact-head CI sẽ chạy full;
- phải ghi rõ trong báo cáo;
- merge vẫn chỉ được phép khi full CI xanh.

---

## 7. Merge Safety

**KHÔNG MERGE** nếu exact head chưa có full verification xanh:

```text
typecheck
lint
full test suite
build
```

Nguồn verification có thể là:
- local exact-head full gate;
- hoặc GitHub Actions exact-head full gate.

High-risk domain/data change nên có cả local full gate trước push và remote CI green.

Không force push `main`.
Không rewrite shared history.
Không dùng `ours/theirs` mù quáng để giải conflict.

---

## 8. CI Policy

CI luôn:

```text
install
→ typecheck
→ lint
→ full tests
→ build
```

Không chuyển CI thành targeted tests chỉ để tiết kiệm CPU.

Được dùng dependency cache để giảm thời gian.

Không thêm deployment production tự động nếu user chưa yêu cầu.

---

## 9. Agent Permission Boundary

Agent không được tự ý:

- force push;
- thay branch protection;
- xóa branch quan trọng;
- tạo release/tag;
- npm publish;
- thay repo visibility/collaborators;
- deploy production nếu chưa được user yêu cầu.

Preview deployment phục vụ kiểm thử UI chỉ thực hiện khi user yêu cầu rõ ràng.

---

## 10. PR / Merge Checklist

- [ ] Đúng branch.
- [ ] Working tree sạch hoặc thay đổi đã hiểu rõ.
- [ ] Atomic commits.
- [ ] Không secrets/artifacts.
- [ ] Exact head full typecheck green.
- [ ] Exact head lint green.
- [ ] Exact head full tests green.
- [ ] Exact head build green.
- [ ] Remote CI green nếu workflow áp dụng.
