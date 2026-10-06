---
name: github-workflow
description: >-
  Git and GitHub workflow rules for Vườn Ươm. Enforces branching standards, atomic conventional
  commits, pull/merge safety gates, minimal CI pipeline, and strict agent permission boundaries.
---

# Git & GitHub Workflow for Vườn Ươm

## 1. Purpose

Quy chuẩn hóa toàn bộ thao tác Git và GitHub trong dự án **Vườn Ươm**. Đảm bảo lịch sử git sạch sẽ, bảo vệ nhánh `main`, tuân thủ các cổng kiểm tra chất lượng tự động, loại bỏ rủi ro mất dữ liệu hoặc xung đột mã nguồn do thao tác ẩu của AI agent.

---

## 2. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Khi tạo nhánh mới, chuyển nhánh, giải quyết conflict.
  - Khi tạo commit cho các thay đổi tính năng hoặc sửa lỗi.
  - Khi chuẩn bị Pull Request, review hoặc hợp nhất (merge) code vào nhánh chính.
  - Khi cấu hình hoặc bảo trì GitHub Actions / CI pipeline.
- **WHEN NOT TO USE**:
  - Khi chỉ đọc mã nguồn hoặc trả lời câu hỏi thuần túy về sản phẩm / domain (dùng `product-context` hoặc `domain-rules`).
  - Khi đang triển khai logic bên trong component mà chưa cần commit hay thao tác git (dùng `implementation`).

---

## 3. Repo Combination Rule (Quy tắc phối hợp Skill)

Trong repository Vườn Ươm:

```text
Task lập trình tính năng / sửa code
→ Kích hoạt: implementation + testing skill

Task có thao tác commit / branch / PR / CI / GitHub
→ Kích hoạt thêm: github-workflow skill
```

---

## 4. Chu trình làm việc chuẩn (Standard Workflow Cycle)

Mọi thay đổi code trong dự án Vườn Ươm đều phải đi qua chu trình khép kín sau:

```text
feature branch (nhánh tính năng riêng)
       ↓
implementation (viết code lát cắt nhỏ nhất)
       ↓
   typecheck (npm run typecheck — 0 lỗi)
       ↓
     lint (npm run lint — 0 cảnh báo/lỗi)
       ↓
    tests (npm test — tất cả test suites xanh)
       ↓
    build (npm run build — bundle thành công)
       ↓
    commit (atomic commit theo conventional commits)
       ↓
 review/audit (tự rà soát hoặc peer review)
       ↓
  merge main (chỉ hợp nhất khi thỏa mãn mọi điều kiện)
```

---

## 5. Năm nhóm quy tắc cốt lõi (5 Core Rulesets)

### Rule 1: Branching (Phân nhánh)
1. **`main` là nhánh ổn định**: Nhánh `main` luôn ở trạng thái chạy được, vượt qua toàn bộ test và build. Tuyệt đối không code trực tiếp tính năng dang dở trên `main`.
2. **Nhánh riêng cho từng task**: Mọi công việc mới (feature/fix/refactor) phải được thực hiện trên branch riêng tách từ `main`.
3. **Quy ước đặt tên nhánh**:
   - `feat/<ten-tinh-nang>`: Tính năng mới (ví dụ: `feat/order-creation-flow`, `feat/quantity-input`).
   - `fix/<ten-loi>`: Sửa lỗi (ví dụ: `fix/inventory-overage-calc`, `fix/phone-dedup`).
   - `chore/<noi-dung>`: Cập nhật cấu hình, dependency, dọn dẹp (ví dụ: `chore/vitest-concurrency`).
   - `docs/<noi-dung>`: Tài liệu, skill, roadmap (ví dụ: `docs/update-project-state`, `docs/github-workflow-skill`).
   - `test/<noi-dung>`: Bổ sung hoặc tái cấu trúc test suite (ví dụ: `test/batch-invariants`).
4. **Kỷ luật ngữ cảnh**: Không tự ý tạo branch mới nếu phiên làm việc hiện tại đã ở đúng branch được chỉ định cho task.

---

### Rule 2: Commit (Ghi nhận thay đổi)
1. **Commit nhỏ, có ý nghĩa nguyên tử (Atomic Commits)**: Mỗi commit giải quyết một mục đích cụ thể, trọn vẹn và độc lập.
2. **Không gom thay đổi không liên quan**: Không trộn lẫn refactoring với bugfix; không trộn chỉnh sửa styling với thay đổi domain invariants.
3. **Quy chuẩn thông điệp commit (Conventional Commits)**:
   - `feat: add order creation flow`
   - `fix: prevent invalid inventory update`
   - `test: cover order without reservation`
   - `docs: update project state`
   - `chore: update build configs`
   - `refactor: extract batch code generator`
4. **Nghiêm cấm commit rác & bí mật**:
   - Tuyệt đối không commit build artifacts (`dist/`, `build/`, `.output/`).
   - Tuyệt đối không commit file môi trường (`.env`, `.env.local`), API keys, credentials hoặc secrets.
   - Tuyệt đối không commit file tạm hệ điều hành hoặc IDE (`Thumbs.db`, `.DS_Store`, `.idea/`, v.v.).

---

### Rule 3: Pull & Merge Safety (An toàn khi hợp nhất)
1. **Cấm force push lên `main`**: Tuyệt đối không bao giờ dùng `git push --force` hoặc `git push -f` lên nhánh `main`.
2. **Không rewrite lịch sử công khai**: Không dùng `git rebase -i` hay reset làm thay đổi các commit đã được push lên remote chung.
3. **Cổng kiểm tra chất lượng bắt buộc trước khi merge**: Tuyệt đối **KHÔNG MERGE** nếu bất kỳ lệnh nào trong bộ 4 kiểm tra thất bại:
   ```bash
   cd web
   npm run typecheck  # TypeScript 0 errors
   npm run lint       # Linter 0 warnings/errors
   npm test           # Vitest all green
   npm run build      # Vite bundle pass
   ```
4. **Tuyệt đối không giải quyết conflict cẩu thả**:
   - Không được dùng càn `git checkout --ours` hoặc `git checkout --theirs` để lướt qua conflict.
   - Khi có merge conflict, bắt buộc phải phân tích từng đoạn xung đột, đối chiếu với **Domain Rules** và **Bất biến số lượng** của Vườn Ươm để giải quyết chính xác.

---

### Rule 4: CI / GitHub Actions (Tự động hóa tích hợp)
1. **Workflow tối thiểu chuẩn**:
   - `install` $\rightarrow$ `typecheck` $\rightarrow$ `lint` $\rightarrow$ `test` $\rightarrow$ `build`.
2. **Không tự ý thêm deploy workflow**: Trừ khi có yêu cầu rõ ràng từ người dùng, không tự tiện cấu hình tự động triển khai (Vercel, Cloudflare, Netlify, GitHub Pages, v.v.).
3. **Không tạo CI phụ thuộc bí mật vô cớ**: Không đưa các bước đòi hỏi secrets hoặc external API tokens vào CI khi dự án đang là offline-first prototype.
4. **Tối ưu vừa đủ**: Cho phép sử dụng cache dependencies (`actions/setup-node` với cache npm) để tăng tốc độ chạy CI, nhưng không biến cấu hình CI thành một sub-project phức tạp over-engineered.

---

### Rule 5: Agent Permissions Boundary (Ranh giới quyền hạn Agent)
Agent **TUYỆT ĐỐI BỊ CẤM** thực hiện các hành vi sau trừ khi có lệnh trực tiếp và rõ ràng từ người dùng:

| Hành vi bị cấm | Lý do an toàn |
| :--- | :--- |
| **Delete branch quan trọng** (`main`, remote tracking branches) | Nguy cơ mất mã nguồn và lịch sử dự án. |
| **Force push** (`git push --force`, `-f`) | Phá hủy lịch sử commit chung. |
| **Change branch protection** | Vô hiệu hóa lớp bảo vệ an toàn của repository. |
| **Create release / tag** (`git tag`, GitHub release) | Release phải do người dùng kiểm soát phiên bản. |
| **Publish package** (`npm publish`) | Tránh rò rỉ mã nguồn hoặc release phiên bản rác. |
| **Deploy production** | Chỉ deploy khi đã qua bước kiểm chứng thực tế tại vườn (sau P6). |
| **Modify GitHub repository settings** (thay đổi visibility, collaborators, hooks) | Vượt quá quyền hạn kỹ thuật của coding agent. |

---

## 6. Verification Checklist trước khi tạo Pull Request / Merge

Trước khi báo cáo hoàn thành task hoặc merge code:

- [ ] Bạn đang đứng trên đúng feature branch (không phải code dở trên `main`).
- [ ] Không có file thừa hoặc file rác trong `git status`.
- [ ] Commit message tuân thủ định dạng Conventional Commits.
- [ ] `npm run typecheck` vượt qua không lỗi.
- [ ] `npm run lint` vượt qua không cảnh báo/lỗi.
- [ ] `npm test` vượt qua 100% test cases.
- [ ] `npm run build` tạo bundle production sạch sẽ.
