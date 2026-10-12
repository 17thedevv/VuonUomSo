# V3-0 — Implementation Foundation Freeze

**Status: DESIGN FROZEN. This document makes V3-1/V3-2 code-ready, but does not itself authorize runtime implementation.**

Purpose: remove tooling/repository/config ambiguity before 17thedev and Tráng A Thư split into backend/frontend branches.

---

# 1. Repository layout

When V3-1 implementation is authorized, use:

```text
/
├── web/                         # existing React/Vite PWA
├── server/                      # new NestJS modular monolith
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/
│   │   ├── auth/
│   │   ├── identity/
│   │   ├── organizations/
│   │   ├── gardens/
│   │   ├── contacts/
│   │   ├── batches/
│   │   ├── orders/
│   │   ├── reservations/
│   │   ├── shipments/
│   │   ├── dossiers/
│   │   ├── commands/
│   │   ├── sync/
│   │   └── imports/
│   └── test/
├── docs/
│   └── api/
│       └── v3.openapi.json      # checked-in generated contract
└── .agent/
```

No root npm workspace is required for V3-1. Keep `web/` and `server/` independently installable with their own lockfiles.

Reason: avoid monorepo/tooling migration before it provides concrete value.

---

# 2. Runtime/toolchain freeze

Version snapshot for implementation bootstrap:

| Tool/package | Frozen initial version |
|---|---:|
| Node.js | `22.22.2` |
| TypeScript | `6.0.2` |
| `@nestjs/core` | `12.1.2` |
| `@nestjs/common` | `12.1.2` |
| `@nestjs/platform-express` | `12.1.2` |
| `@nestjs/testing` | `12.1.2` |
| `@nestjs/swagger` | `12.0.2` |
| `@nestjs/config` | `12.0.1` |
| `@nestjs/throttler` | `6.7.1` |
| `prisma` | `7.10.0` |
| `@prisma/client` | `7.10.0` |
| `@prisma/adapter-pg` | `7.10.0` |
| `pg` | `8.23.1` |
| `@types/pg` | `8.23.1` |
| `dotenv` | `18.0.7` |
| `jose` | `6.2.12` |
| `class-validator` | `0.15.1` |
| `class-transformer` | `0.5.1` |
| `reflect-metadata` | `0.2.2` |
| `rxjs` | `7.8.2` |
| `supertest` | `7.3.1` |
| `openapi-typescript` | `7.13.0` |
| `@supabase/supabase-js` | `2.117.3` |

Pin exact versions in the first backend/bootstrap PR. Prisma 7 requires a database driver adapter for direct PostgreSQL connections, so `@prisma/adapter-pg` + `pg` are mandatory, not optional. `dotenv` is required by the frozen `prisma.config.ts` pattern. Upgrade separately after baseline CI is green.

Do **not** start on Prisma 8 release candidates for V3 bootstrap.

---

# 3. Module format

Use ESM consistently for new server package:

```json
{
  "type": "module"
}
```

TypeScript:

```text
module: NodeNext
moduleResolution: NodeNext
target: ES2022 or later supported by Node 22
strict: true
```

Do not introduce Babel.

---

# 4. NestJS bootstrap defaults

Global API prefix:

```text
/v3
```

Use Express adapter initially.

Global validation:

```text
whitelist = true
forbidNonWhitelisted = true
transform = true
```

Quantity strings require explicit canonical integer-string validation; do not use `@IsNumber()` for BIGINT fields.

Global cross-cutting concerns:

- request-id middleware/interceptor;
- exception-to-API-envelope filter;
- JWT authentication guard;
- permission guard/decorator;
- CORS allowlist;
- rate limiting;
- structured logs with token/private-data redaction.

Do not put business logic into controllers/guards.

---

# 5. Authentication implementation

Backend JWT verification uses `jose`.

Required validation:

- signature;
- issuer;
- audience;
- expiration;
- subject.

JWKS fetched from configured Supabase JWKS endpoint and cached by library/runtime behavior.

Supabase Auth project configuration must keep **Confirm Email enabled** for the V3 email/password flow. Standard Supabase access-token claims include `email` but do not guarantee a separate `email_verified` claim; backend invitation acceptance therefore matches the authenticated non-anonymous JWT email to the invite and relies on the project-level Confirm Email policy rather than trusting `user_metadata.email_verified`.

No Supabase service-role key is required for normal API authentication.

Frontend uses `@supabase/supabase-js` only for Auth lifecycle and receives a publishable client key.

---

# 6. Environment contract

## Server

Prisma 7 connection config lives in:

```text
server/prisma.config.ts
```

Initial shape:

```ts
import "dotenv/config"
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
})
```

Required runtime variables:

```text
NODE_ENV
PORT
DATABASE_URL
SUPABASE_URL
SUPABASE_JWT_ISSUER
SUPABASE_JWT_AUDIENCE
SUPABASE_JWKS_URL
CORS_ORIGINS
SYNC_CURSOR_HMAC_KEY
APP_ORIGIN
```

Optional operational variables may be added separately.

Rules:

- validate env at startup;
- no fallback production secrets;
- no secrets committed;
- `SYNC_CURSOR_HMAC_KEY` must be stable across ordinary deploys;
- production/staging/dev use different secrets/databases.

## Web

```text
VITE_API_BASE_URL
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_APP_ENV
```

Never put:

```text
DATABASE_URL
service-role key
JWT signing secret
SYNC_CURSOR_HMAC_KEY
```

in Vite env.

---

# 7. Request ID

Server generates a UUID request ID for every HTTP request.

Response header:

```http
X-Request-Id: <uuid>
```

Error envelope includes the same value.

Do not blindly trust arbitrary client-supplied request IDs as the canonical server correlation ID.

---

# 8. OpenAPI as executable contract

Narrative authority:

```text
docs/architecture/V3-API-CONTRACT.md
```

Executable checked-in spec:

```text
docs/api/v3.openapi.json
```

This file already exists as the reviewed V3-0 design seed. The first server foundation PR must make Nest decorators/DTO metadata generate a semantically equivalent deterministic document; from then on generated output is checked for drift.

Required scripts once server exists:

```text
npm run openapi:generate
npm run openapi:check
```

`openapi:check` regenerates to a temporary file and fails if checked-in spec differs.

Frontend generated types after V3-1 bootstrap:

```text
web/src/api/generated/v3.d.ts
```

using:

```text
openapi-typescript docs/api/v3.openapi.json
```

Generated file is not hand edited.

Frontend API mocks/tests should typecheck against generated contract.

---

# 9. Server module boundaries

## auth

- JWT verification
- AuthPrincipal
- no garden business policy

## identity

- AppUser profile
- device registrations
- `/me`

## organizations

- Organization
- OrganizationMember
- organization permission policy
- shared contact-directory metadata

## gardens

- Garden
- GardenMember
- invitation/membership lifecycle
- permission evaluation

## business modules

- contacts
- batches
- orders
- reservations
- shipments
- dossiers

## commands

- command envelope
- idempotency
- transaction orchestration
- explicit action registry
- compensation registry

## sync

- revision cursor
- changefeed
- snapshot

## imports

- staged legacy Backup V1 import
- preview/commit
- no silent cutover

Avoid cross-module repository imports that bypass application services.

---

# 10. Prisma policy

Initial implementation must:

Prisma Client runtime construction uses the mandatory PostgreSQL driver adapter:

```ts
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./generated/prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
export const prisma = new PrismaClient({ adapter })
```

Then:

1. move reviewed schema from `docs/architecture/drafts/v3-schema.prisma` into `server/prisma/schema.prisma`;
2. keep Prisma 7 generator `prisma-client` with output `../src/generated/prisma`;
3. configure DATABASE_URL in `server/prisma.config.ts`, not in datasource block;
4. run `prisma format`;
5. run `prisma validate`;
6. generate a **reviewable initial migration**;
7. add reviewed raw SQL for constraints Prisma schema cannot express.

Required database-level constraints include:

- ready <= current <= initial;
- nonnegative quantities;
- F <= Q;
- source exclusivity;
- role/status valid values;
- tenant composite FKs;
- one planned shipment per garden/order partial unique index;
- invitation role cannot be OWNER;
- accepted/revoked invitation consistency.

Do not use `prisma db push` for production schema management.

---

# 11. Garden sync revision design

Each Garden has:

```text
syncRevision BIGINT NOT NULL DEFAULT 0
```

For every committed garden business mutation:

1. transaction locks/updates the garden sync row/state;
2. increment revision once;
3. all ChangeLog rows for that mutation receive the same revision;
4. rows receive ordinal 0..N-1;
5. business write + event + receipt + change rows commit atomically.

This gives commit-ordered per-garden revisions without relying on PostgreSQL sequence allocation order.

ChangeLog identity:

```text
(gardenId, revision, ordinal)
```

Client cursor points to a **fully committed revision**, never a partial row.

---

# 12. Cursor format

Cursor is opaque to clients.

Logical payload:

```json
{
  "v": 1,
  "scope": "garden",
  "scopeId": "garden-uuid",
  "revision": "1234"
}
```

Encode as base64url + HMAC-SHA256 signature using `SYNC_CURSOR_HMAC_KEY`.

Server validates:

- signature;
- version;
- expected scope/garden;
- revision not ahead of current authority.

Client never edits/parses cursor for application logic.

---

# 13. Changefeed retention

Minimum retained changefeed history:

```text
90 days
```

A deployment may retain longer.

If cursor predates retained floor:

```http
410 Gone
```

with:

```text
SYNC_CURSOR_EXPIRED
```

Client must obtain a fresh canonical snapshot.

Cleanup must not delete history needed for audit; ChangeLog replication retention is separate from immutable DomainEvent audit retention.

---

# 14. Changefeed pagination

Default target:

```text
100 change rows
```

Maximum target:

```text
500 change rows
```

A page **must not split one revision**. If one revision contains more rows than max target, return that full revision.

Response cursor advances only after the last complete revision included.

---

# 15. Snapshot consistency

Garden snapshot generation uses a database transaction with a consistent snapshot.

Within the same snapshot:

1. read canonical `garden.syncRevision`;
2. read canonical garden business rows;
3. return signed cursor for that revision.

A change committed later receives a greater revision and will be returned by changefeed.

---

# 16. Organization contact-directory sync

Contacts remain organization-scoped.

Do **not** duplicate organization contact changes into every Garden ChangeLog.

Organization has:

```text
contactDirectoryVersion BIGINT NOT NULL DEFAULT 0
```

Every contact create/update increments it atomically.

Offline contact refresh uses:

```text
GET /v3/organizations/{organizationId}/contacts/snapshot
```

Response is paginated and bound to one `directoryVersion`.

If directory version changes while client is downloading subsequent pages:

```text
409 DIRECTORY_SNAPSHOT_STALE
```

Client discards temporary pages and restarts.

Client only swaps the organization contact cache after all pages for one version are complete.

---

# 17. Device registration

Client creates a cryptographically random UUID `clientInstallationId` once per browser/PWA storage profile and environment.

Authenticated registration:

```http
POST /v3/devices/register
```

Request:

```json
{
  "clientInstallationId": "uuid",
  "label": "Chrome Android",
  "platform": "pwa"
}
```

Server idempotently returns a canonical DeviceInstallation ID unique by:

```text
(userId, clientInstallationId)
```

Command `deviceId` must refer to a currently registered device owned by authenticated user.

Unregister:

```http
DELETE /v3/devices/{deviceId}
```

Unregistered device IDs cannot submit commands until registered again.

Do not collect hardware fingerprints, IMEI, contacts or advertising IDs.

---

# 18. Compensation / Undo design

V3 does **not** perform blind rollback.

Canonical action:

```text
mutation.compensate
```

Payload:

```json
{
  "targetMutationId": "uuid"
}
```

Rules:

1. target mutation must belong to same garden;
2. caller must currently have permission for compensation;
3. original action must be in an explicit compensation registry;
4. current state/version/history is re-read;
5. unsafe/stale compensation is rejected;
6. compensation is a new mutation with its own mutationId/idempotencyKey/audit event/change revision.

Initial compensation registry may include only behavior already supported safely by current accepted Undo semantics.

Unsupported action:

```text
COMPENSATION_NOT_SUPPORTED
```

State changed since original action:

```text
COMPENSATION_CONFLICT
```

Frontend shows Undo only when server response marks:

```json
{
  "compensation": {
    "supported": true,
    "targetMutationId": "uuid"
  }
}
```

This is an affordance, not a promise compensation will still succeed later.

---

# 19. Migration upload/staging freeze

Initial import upload:

```http
POST /v3/gardens/{gardenId}/imports
Content-Type: multipart/form-data
```

One file field:

```text
file
```

Accepted media:

```text
application/json
```

Maximum raw file size:

```text
10 MiB
```

Server:

1. streams/reads with hard size limit;
2. computes SHA-256;
3. strict-validates legacy Backup V1;
4. normalizes into private staged JSON;
5. stores staged normalized payload in PostgreSQL/private backend storage associated with MigrationImport;
6. never creates canonical business rows during preview.

Staged payload expiry:

```text
24 hours
```

On successful commit:

- canonical commit happens transactionally;
- staged raw/normalized payload is purged after verification;
- metadata/hash/counts/receipt may remain for audit.

On rejection/expiry:

- payload is purged;
- no canonical writes.

No public object bucket is required for V3 bootstrap.

---

# 20. Rate limiting baseline

Initial in-process rate limit is acceptable for single-instance/small staging deployment using `@nestjs/throttler`.

Baseline:

- general authenticated API: 120 requests/minute/user/IP tracker strategy reviewed at implementation;
- invitation create/accept: tighter limit;
- authentication itself remains Supabase responsibility;
- import upload: tight limit and size guard.

If horizontally scaling to multiple backend instances, move throttler storage to shared infrastructure before relying on it as a security boundary.

---

# 21. List pagination defaults

Standard list endpoints:

```text
default limit = 50
max limit = 100
```

Deterministic stable tie-breaker:

```text
createdAt DESC, id ASC
```

unless endpoint explicitly defines another reviewed order.

Cursor includes all fields required to continue deterministic ordering and is opaque/signed where appropriate.

---

# 22. CI shape after server bootstrap

Current web CI remains.

Add server quality gate:

```text
npm ci
→ typecheck
→ lint
→ test
→ prisma validate
→ openapi:check
→ build
```

Integration tests requiring PostgreSQL run against an isolated CI PostgreSQL service/database.

Do not point CI at staging/production tenant databases.

Frontend CI also checks generated OpenAPI types are up to date after contract generation is introduced.

---

# 23. First implementation split for two developers

Once V3-1 is explicitly authorized:

## 17thedev — branch A

Suggested first slice:

```text
feat/v3-1-server-foundation
```

Own:

- server bootstrap;
- env validation;
- request ID/error envelope;
- JWT/JWKS verification;
- Prisma baseline;
- AppUser/Organization/Garden membership read path;
- generated OpenAPI.

## Tráng A Thư — branch B

Suggested first slice:

```text
feat/v3-1-auth-client
```

Own:

- Supabase client bootstrap;
- login/signup/logout/recovery screens;
- token attachment API client;
- generated API types consumption;
- auth error/re-auth UX;
- clientInstallationId creation.

### Shared contract files

Only coordinate/review changes to:

- `docs/architecture/V3-API-CONTRACT.md`;
- `docs/api/v3.openapi.json`;
- generated API type workflow;
- env example files;
- auth/permission error taxonomy.

Do not have both branches independently change the same contract shape.

---

# 24. Definition of design-complete

V3-0 architecture is implementation-ready when:

- authorization matrix frozen;
- invitation lifecycle frozen;
- API DTO/error conventions frozen;
- schema model aligned;
- toolchain pinned;
- server/client package boundaries frozen;
- device model frozen;
- sync revision/cursor frozen;
- compensation mapping frozen;
- migration transport frozen;
- exact phase split documented;
- independent review + exact-head CI pass.

After these conditions, remaining work is implementation/detail testing, not architectural guessing.
