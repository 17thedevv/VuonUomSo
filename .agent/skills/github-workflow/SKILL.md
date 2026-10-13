---
name: github-workflow
description: >-
  Git/GitHub workflow for Vườn Ươm: task branches, atomic commits,
  contract-first sequencing, CI and merge safety for solo development.
---

# Git & GitHub Workflow for Vườn Ươm

## 1. Core workflow

```text
main
→ small task branch
→ targeted checks
→ atomic commits
→ sync latest base
→ exact-head full gate
→ review/audit
→ merge
```

`main` phải ổn định. Không force-push main, không rewrite shared history.

## 2. Branch naming

- `feat/*`
- `fix/*`
- `docs/*`
- `test/*`
- `chore/*`

Branch theo **task/slice**, không theo tên người.

Ví dụ:

- `feat/v3-1-server-foundation`
- `feat/v3-1-auth-client`
- `docs/v3-api-contract`

## 3. Solo sequencing

Project hiện do **17thedev phát triển một mình**.

Không cần ownership matrix giữa người với người. Thay vào đó, mỗi slice phải có:

1. contract/dependency đã chốt;
2. branch riêng;
3. phạm vi file rõ;
4. acceptance/test rõ;
5. merge xong mới mở slice phụ thuộc tiếp theo.

Ưu tiên sequence:

```text
contract
→ server/client foundation theo dependency
→ integration
→ next slice
```

Không giữ nhiều branch dài cùng sửa API contract, Prisma schema, root config hoặc env contract.

## 4. Conflict prevention

- Branch sống ngắn.
- Sync latest base trước PR/handoff.
- Không giải conflict bằng `ours/theirs` mù quáng.
- Lockfile/root config/Prisma schema/API contract là file rủi ro self-conflict cao.
- Nếu task B phụ thuộc contract của task A, merge A trước rồi mới bắt đầu/rebase B.
- Không duy trì hai implementation khác nhau của cùng một contract.

## 5. Atomic commits

Không trộn unrelated concerns.

Ví dụ tốt:

- `docs(agent): add V3 api contract skill`
- `docs(api): define V3 identity and tenant endpoints`
- `feat(auth): verify Supabase JWT`

Không commit secrets, `.env`, generated credentials hoặc local artifacts.

## 6. Verification

Trong development dùng targeted checks.

Trước PR/final handoff/merge, exact-head full gate theo packages hiện có. Hiện tại web gate:

```bash
cd web
npm run typecheck
npm run lint
npm test
npm run build
```

Khi backend package được authorize và tồn tại, backend phải có gate riêng được bổ sung vào CI; không giả định lệnh trước khi package/toolchain được chốt.

Docs-only có thể dựa exact-head CI nếu báo cáo rõ local verification chưa chạy.

## 7. Merge safety

Không merge nếu:

- exact head CI đỏ/chưa chạy;
- unresolved BLOCKER/HIGH từ review/audit;
- contract mismatch frontend/backend;
- scope vượt PROJECT_STATE;
- migration/auth/security gate chưa đạt.

Solo project vẫn phải giữ self-review/agent audit và CI; không dùng việc “chỉ có một người” để bỏ gate.

## 8. Agent permission boundary

Agent không tự:

- merge khi user chưa cho phép;
- tạo release/tag;
- deploy production;
- đổi branch protection;
- thay collaborators/visibility;
- provision auth/database hoặc sử dụng real tenant data ngoài authorized phase.

## 9. PR checklist

- [ ] Task/branch đúng scope?
- [ ] API/shared contract đã chốt trước implementation phụ thuộc?
- [ ] Không secret/artifact?
- [ ] Sync base đủ mới?
- [ ] Exact-head verification xanh?
- [ ] Review/audit contract và invariant đã hoàn tất?
- [ ] Không claim phase DONE chỉ vì PR CI xanh?
