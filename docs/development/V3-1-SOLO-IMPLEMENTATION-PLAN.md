# V3-1 — Solo Implementation Plan

**Owner: 17thedev**  
**Status: AUTHORIZED / IN PROGRESS (V3-1A, V3-1B DONE; NEXT: V3-1C).**

Vườn Ươm V3 is currently developed by **17thedev as the sole developer**.

## 1. Mandatory references

Before coding:

- `.agent/PROJECT_STATE.md`
- `.agent/skills/api-contract/SKILL.md`
- `.agent/skills/implementation/SKILL.md`
- `docs/architecture/V3-API-CONTRACT.md`
- `docs/api/v3.openapi.json`
- `docs/architecture/V3-AUTHORIZATION-CONTRACT.md`
- `docs/architecture/V3-IMPLEMENTATION-FOUNDATION.md`
- `docs/architecture/V3-DATA-MODEL-NOTES.md`
- `docs/architecture/drafts/v3-schema.prisma`

## 2. Solo delivery rule

Do not implement V3-1 as one large branch.

Use short sequential slices:

```text
V3-1A
server foundation
    ↓
V3-1B
auth client foundation
    ↓
V3-1C
tenancy/device server
    ↓
V3-1D
tenant onboarding client
    ↓
V3-1E
membership/invitation server + client
    ↓
V3-1 final acceptance
```

A dependent slice starts only after the dependency is merged into latest `main`.

---

## 3. V3-1A — Server foundation

**Status: DONE / CLOSED (#64)** (merged at `836995892a1da2ae91925bd18e7de51451ffe0c4`, main CI [#38364601217](https://github.com/17thedevv/VuonUomSo/actions/runs/38364601217) SUCCESS)

Branch:

```text
feat/v3-1-server-foundation (merged via PR #64)
```

Scope:

- create `server/`;
- pinned Node/NestJS/Prisma 7 toolchain;
- Prisma config/schema baseline;
- env validation;
- request ID;
- validation + standard error envelope;
- CORS;
- JWT/JWKS verification;
- AuthPrincipal;
- `POST /v3/me/bootstrap`;
- read-only `GET /v3/me`;
- versioned `PATCH /v3/me`;
- deterministic OpenAPI generation/check;
- server CI job;
- unit/e2e skeleton.

Acceptance:

- build/test/typecheck/lint pass (35/35 server tests);
- invalid/missing JWT covered;
- Prisma validate pass;
- OpenAPI design seed and generated spec stay semantically aligned (0 drift);
- no secrets;
- existing web CI remains green (1.259/1.259 tests).

---

## 4. V3-1B — Auth client foundation

**Status: DONE / CLOSED (#65)** (merged at `0bfdfc56334f4007483d5d43ee815eb9d4137915`, main CI [#38537626629](https://github.com/17thedevv/VuonUomSo/actions/runs/38537626629) SUCCESS)

Branch:

```text
feat/v3-1-auth-client-foundation (merged via PR #65)
```

Starts after V3-1A merge.

Scope:

- Supabase client bootstrap;
- session provider/hook;
- login/signup/logout;
- password recovery;
- email-confirmation UX;
- token-attaching API wrapper;
- standard API error parser;
- 401 re-auth flow;
- stable `clientInstallationId`;
- mobile 360–430px acceptance.

Do not infer garden authorization from JWT.

Acceptance:

- auth/session tests;
- token attachment tests;
- account/session switch tests;
- no server-only secret in browser;
- web typecheck/lint/test/build pass (84 test suites / 1.334 tests).

---

## 5. V3-1C — Tenancy and device server

**Status: NEXT / READY TO START**

Suggested branch:

```text
feat/v3-1-tenancy-server
```

Scope:

- AppUser email/profile sync;
- Organization/OrganizationMember;
- Garden/GardenMember;
- frozen roles and permission evaluator;
- create/list/update organizations;
- create/list/read gardens;
- organization/garden member reads;
- effective garden permissions;
- device register/unregister;
- tenant-negative tests;
- owner/admin garden-creation governance.

Acceptance:

- foreign tenant cannot enumerate business data;
- ADMIN without GardenMember cannot access garden business scope;
- owner governance tests pass;
- foreign/unregistered device rejected;
- OpenAPI + CI green.

---

## 6. V3-1D — Tenant onboarding client

Suggested branch:

```text
feat/v3-1-tenant-onboarding
```

Starts after V3-1C merge.

Scope:

- post-auth bootstrap + `/me`;
- create/select organization;
- create/select/switch garden;
- effective-permission-driven UI;
- device registration;
- user/org/garden/environment cache partitioning.

Acceptance:

- account switch cannot display old tenant state;
- garden switch uses correct cache scope;
- role/permission UI is derived from server effective permissions;
- mobile flow acceptance;
- web gate green.

---

## 7. V3-1E — Membership and invitations

Use separate short branches if server/client diff becomes large.

Suggested branches:

```text
feat/v3-1-membership-server
feat/v3-1-membership-ui
```

Server scope:

- GardenInvitation;
- secure token generation/hash;
- 7-day expiry;
- pending invite replacement;
- email-bound preview/accept;
- role update/revoke/self-leave;
- organization role update;
- audit events;
- negative auth tests.

Client scope after server branch merges:

- member list;
- pending invitation list;
- invite/share flow;
- immediate invite-token URL scrub;
- login-before-preview/accept;
- expired/revoked/mismatch UX;
- role update/revoke UI.

Raw invite token must never be persisted in analytics, IndexedDB or localStorage.

---

## 8. Final V3-1 acceptance

Required end-to-end cases:

1. signup/login → bootstrap → create organization → create garden;
2. owner permissions correct;
3. org admin garden creation governance correct;
4. owner invitation flow;
5. manager invitation boundaries;
6. worker cannot invite;
7. mismatched authenticated email cannot accept invite;
8. same accepted invitation retry is idempotent;
9. revoke membership blocks next API request despite valid JWT;
10. account/garden cache partition prevents tenant leak;
11. unregistered/foreign device rejected;
12. OpenAPI/generated client types aligned;
13. no service secret in browser;
14. mobile 360/390/430 acceptance.

## 9. High-conflict files

Change sequentially, never through overlapping long-lived branches:

```text
docs/architecture/V3-API-CONTRACT.md
docs/api/v3.openapi.json
server/prisma/schema.prisma
server/prisma/migrations/**
generated API types
.env.example files
CI workflow
```

## 10. V3-2 boundary

Do not start V3-2 automatically.

V3-2 requires:

- V3-1 acceptance green;
- auth/tenant negative tests green;
- sandbox DB/Auth operations verified;
- explicit PROJECT_STATE authorization.
