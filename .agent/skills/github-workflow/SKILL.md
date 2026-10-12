---
name: github-workflow
description: >-
  Git/GitHub workflow for Vườn Ươm: branch ownership, atomic commits,
  contract-first two-person collaboration, CI and merge safety.
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
→ PR review
→ merge
```

`main` phải ổn định. Không force-push main, không rewrite shared history.

## 2. Branch naming

- `feat/*`
- `fix/*`
- `docs/*`
- `test/*`
- `chore/*`

Branch nên theo **task/slice**, không theo tên người kiểu `17thedev-v3` hoặc `athu-v3`.

Ví dụ:

- `feat/v3-1-jwt-verification`
- `feat/v3-1-login-ui`
- `docs/v3-api-contract`

## 3. Two-person coordination

Nhóm hiện có hai thành viên: 17thedev và Tráng A Thư.

Ownership mặc định:

- server/Prisma/domain runtime: 17thedev primary;
- frontend/auth client/offline UX: Tráng A Thư primary;
- API contract/shared types/env/root config: **shared coordination zone**.

Shared coordination zone không được hai người tự sửa theo giả định khác nhau.

Trước khi code song song:

1. chốt endpoint/action;
2. chốt request/response DTO;
3. chốt error codes;
4. chốt auth/tenant context;
5. chốt version/idempotency semantics;
6. sau đó mới tách branch frontend/backend.

## 4. Conflict prevention

- Branch sống ngắn.
- Pull/rebase/merge latest base trước PR/handoff theo workflow team.
- Không giải conflict bằng `ours/theirs` mù quáng.
- Lockfile/root config/Prisma schema/API contract là file rủi ro conflict cao.
- Nếu một PR đổi shared contract, PR phụ thuộc phải sync contract trước khi merge.
- Không merge hai PR cùng thay một contract theo hai hướng khác nhau.

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
- unresolved review blocker/high;
- contract mismatch frontend/backend;
- scope vượt PROJECT_STATE;
- migration/auth/security gate chưa đạt.

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
- [ ] Shared API contract đã chốt nếu frontend/backend cùng phụ thuộc?
- [ ] Không secret/artifact?
- [ ] Sync base đủ mới?
- [ ] Exact-head verification xanh?
- [ ] Reviewer hiểu contract/invariant bị thay đổi?
- [ ] Không claim phase DONE chỉ vì PR CI xanh?
