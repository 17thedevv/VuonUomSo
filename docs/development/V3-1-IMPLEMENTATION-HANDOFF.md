# V3-1 — Implementation Handoff for 17thedev & Tráng A Thư

**Status: READY-TO-CODE PLAN, NOT YET RUNTIME AUTHORIZATION.** Start these branches only after PROJECT_STATE explicitly opens V3-1 implementation.

This handoff avoids long-lived parallel branches and shared-file conflicts.

---

# 1. Shared frozen contracts

Both developers must read before coding:

- `.agent/PROJECT_STATE.md`
- `.agent/skills/api-contract/SKILL.md`
- `docs/architecture/V3-API-CONTRACT.md`
- `docs/architecture/V3-AUTHORIZATION-CONTRACT.md`
- `docs/architecture/V3-IMPLEMENTATION-FOUNDATION.md`
- `docs/architecture/V3-DATA-MODEL-NOTES.md`
- `docs/architecture/drafts/v3-schema.prisma`

No branch may silently change:

- role semantics;
- endpoint path;
- quantity representation;
- error code;
- JWT/membership boundary;
- invitation token lifecycle;
- device registration contract.

Contract change first → review → dependent branches sync.

---

# 2. Delivery order

```text
V3-1A  server skeleton + API contract plumbing
   │
   ├──────────────┐
   ▼              ▼
V3-1B          V3-1C
auth client    tenancy/onboarding server
   │              │
   └──────┬───────┘
          ▼
       V3-1D
 client org/garden onboarding + membership
          │
          ▼
       V3-1E
 cross-client/server integration + negative auth acceptance
```

Do not put all V3-1 into one PR.

---

# 3. V3-1A — Server foundation

**Primary:** 17thedev  
**Reviewer/integration tester:** Tráng A Thư

Suggested branch:

```text
feat/v3-1-server-foundation
```

Scope:

- create `server/` package;
- pin frozen dependencies;
- Node/TypeScript/Nest bootstrap;
- Prisma 7 config/schema baseline;
- env validation;
- request ID;
- global validation;
- standard error envelope;
- CORS config;
- `jose` JWT verification;
- AuthPrincipal;
- `GET /v3/me` minimal authenticated path;
- OpenAPI generation/check script;
- server CI job;
- unit/e2e test skeleton.

Must NOT yet implement:

- full invitation UI;
- V3-2 business commands;
- migrations of real local data;
- cloud deployment/provisioning unless separately authorized.

Acceptance:

- server builds/tests locally;
- invalid/missing JWT paths covered;
- OpenAPI checked-in/generated;
- no secrets;
- Prisma validate passes against pinned version;
- CI server + existing web green.

---

# 4. V3-1B — Frontend Auth client

**Primary:** Tráng A Thư  
**Reviewer:** 17thedev

Suggested branch:

```text
feat/v3-1-auth-client
```

Can start after shared contract freeze; integrate with actual `/me` after V3-1A lands.

Scope:

- add pinned `@supabase/supabase-js`;
- Supabase client bootstrap;
- auth session provider/hook;
- login;
- signup;
- logout;
- password recovery;
- email-verification UX state;
- API fetch wrapper with Bearer token;
- stable error-envelope parser;
- 401 → re-auth flow;
- generate/store `clientInstallationId`;
- responsive 360–430px acceptance.

Must NOT:

- put service role key in web env;
- infer garden role from JWT;
- hardcode fake membership as authorization;
- implement V3-2 business API.

Acceptance:

- auth UI tests;
- token attachment tests;
- session/account switch tests;
- env safety review;
- generated/contract API types used where available;
- web exact-head full gate green.

---

# 5. V3-1C — Organization/garden server foundation

**Primary:** 17thedev  
**Reviewer:** Tráng A Thư

Suggested branch:

```text
feat/v3-1-tenancy-server
```

Depends on V3-1A.

Scope:

- AppUser upsert/map after verified auth;
- Organization/OrganizationMember;
- Garden/GardenMember;
- frozen roles;
- permission evaluator;
- permission guard;
- create/list/read organizations;
- create/list/read gardens;
- garden permission list in response;
- DeviceInstallation register/unregister;
- organization/garden role negative tests;
- owner/admin garden-creation governance.

Acceptance:

- foreign tenant 404/no metadata leak;
- ADMIN without GardenMember cannot read business-scoped placeholder route;
- OWNER governance tests;
- registered device belongs to actor;
- OpenAPI + CI green.

---

# 6. V3-1D — Client onboarding, organization/garden selection

**Primary:** Tráng A Thư  
**Reviewer:** 17thedev

Suggested branch:

```text
feat/v3-1-tenant-onboarding
```

Depends on V3-1C API shapes.

Scope:

- post-login `/me`;
- first organization creation;
- organization selection;
- garden creation where permission allows;
- garden selection/switch;
- effective-permission-driven UI enable/disable;
- device registration;
- cache partition key includes user/org/garden/environment;
- no business V3-2 screens conversion yet unless read-only integration is explicitly in slice.

Acceptance:

- account switch does not reuse old tenant state;
- garden switch does not reuse wrong garden cache;
- viewer/worker/manager UI controls follow effective permissions;
- server remains authority;
- mobile flow acceptance.

---

# 7. V3-1E — Invitations and membership

Split into one server PR + one client PR if diff becomes large.

## Server primary: 17thedev

Suggested:

```text
feat/v3-1-membership-server
```

Implement:

- GardenInvitation;
- 256-bit raw token generation;
- SHA-256 stored hash;
- 7-day expiry;
- duplicate pending replacement;
- verified-email-bound preview/accept;
- GardenMember role changes;
- GardenMember revoke/self-leave;
- Organization ADMIN/MEMBER change by OWNER;
- audit events;
- full negative tests.

## Client primary: Tráng A Thư

Suggested:

```text
feat/v3-1-membership-ui
```

Implement:

- member list for owner/manager;
- invite form;
- role choices limited by server permissions;
- copy/share invitation URL;
- `/invite?token=...` flow;
- login-before-preview/accept;
- expired/revoked/mismatch UX;
- role update/revoke UI.

Do not log raw invite token to analytics.

---

# 8. V3-1 final acceptance

Required end-to-end cases:

1. signup/login → create organization → create garden;
2. owner garden permissions correct;
3. admin creates garden → org owner OWNER + admin MANAGER;
4. owner invites manager;
5. manager invites worker;
6. manager cannot invite manager;
7. worker cannot invite;
8. forwarded token to different verified email fails;
9. accepted invite creates MEMBER + GardenMember atomically;
10. revoke member blocks next API request despite valid JWT;
11. two accounts on same browser profile cannot see each other's cached tenant data;
12. unregistered/foreign deviceId rejected;
13. exact OpenAPI/client types in sync;
14. no service secrets in browser bundle;
15. mobile 360/390/430 acceptance.

---

# 9. Shared-file conflict rules

Files treated as coordinated:

```text
docs/architecture/V3-API-CONTRACT.md
docs/architecture/V3-AUTHORIZATION-CONTRACT.md
docs/api/v3.openapi.json
web/src/api/generated/*
.env.example files
CI workflow
```

Only one active PR should own a coordinated file change at a time unless both developers explicitly sync the dependency.

Prisma schema/migrations are server-primary files; frontend does not edit them.

Auth UI/client files are frontend-primary; server developer reviews but does not create parallel versions.

---

# 10. Merge order

Recommended:

```text
V3-1A server foundation
→ V3-1B auth client
→ V3-1C tenancy server
→ V3-1D tenant onboarding client
→ V3-1E membership server/client
→ V3-1 final integration acceptance
```

B/C can overlap after A if they do not share contract files.

Keep branches short; sync main before final review.

---

# 11. V3-2 handoff boundary

Do not start V3-2 server domain just because V3-1 code exists.

V3-2 entry requires:

- V3-1 acceptance green;
- auth/tenant negative tests green;
- sandbox database/auth operations reviewed;
- explicit PROJECT_STATE phase authorization.

Then split V3-2 similarly:

```text
17thedev   → server domain / Prisma / transactions
A Thư      → client API integration / offline-facing UX
shared     → OpenAPI + command DTO/error contract
```
