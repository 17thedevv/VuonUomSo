# V3-0 — Authorization, Membership & Invitation Contract

**Status: DESIGN FROZEN FOR V3-1 IMPLEMENTATION. Runtime implementation still requires the V3-1 phase to be explicitly opened in PROJECT_STATE.**

This contract freezes the initial V3 identity/tenant permission model so frontend and backend can implement against the same rules.

## 1. Principles

1. Supabase Auth proves **who the person is**.
2. Vườn Ươm membership proves **which organization/garden they may access**.
3. Organization membership does not automatically grant garden business-data access, except the Organization OWNER rule below.
4. Garden business authorization is deny-by-default.
5. Role shown by the client is never authorization proof.
6. Every membership/role/invitation change is audited.
7. V3-1 does not implement custom RBAC builders or user-defined roles.

---

# 2. Roles

## 2.1 Organization roles

```text
OWNER
ADMIN
MEMBER
```

### OWNER

- Exactly one organization OWNER in initial V3.
- Created automatically when an organization is created.
- Organization ownership transfer is **deferred** to a separate audited contract.
- OWNER cannot be demoted/deleted in V3-1.
- OWNER is automatically Garden OWNER for every garden in that organization.

### ADMIN

- Organization administration helper.
- Can create gardens.
- Can read/update organization metadata.
- Can manage organization-wide contacts.
- Does **not** automatically receive business-data access to existing gardens.
- When an ADMIN creates a new garden, the Organization OWNER becomes Garden OWNER and the creating ADMIN becomes Garden MANAGER.

### MEMBER

- Basic organization membership.
- Usually created automatically when accepting a garden invitation.
- Can read organization identity and organization-shared contact directory.
- Garden business access still requires GardenMember.

---

## 2.2 Garden roles

```text
OWNER
MANAGER
WORKER
VIEWER
```

### OWNER

- Reserved for the Organization OWNER in V3-1.
- Automatically exists for every garden.
- Cannot be assigned by invitation or role-update endpoint.
- Full garden permission.

### MANAGER

- Full day-to-day operational access.
- Manage WORKER/VIEWER membership.
- Cannot create/promote another OWNER.
- Cannot change Organization roles.

### WORKER

- Day-to-day business write access.
- No member/role/import/cutover/settings administration.

### VIEWER

- Read-only garden access.

---

# 3. Effective permission matrix

Legend:

- ✅ allowed
- — denied
- C = conditional rule below

## 3.1 Organization-level permissions

| Permission | Org OWNER | Org ADMIN | Org MEMBER |
|---|---:|---:|---:|
| Read organization metadata | ✅ | ✅ | ✅ |
| Update organization metadata | ✅ | ✅ | — |
| List all garden metadata in organization | ✅ | ✅ | C |
| Create garden | ✅ | ✅ | — |
| Read organization member list | ✅ | ✅ | — |
| Change ADMIN ↔ MEMBER | ✅ | — | — |
| Remove org member directly | — | — | — |
| Read organization contact directory | ✅ | ✅ | ✅ |
| Direct organization-level contact write | ✅ | ✅ | — |

**Garden metadata rule for MEMBER:** list only gardens where the caller has GardenMember. OWNER/ADMIN may list garden names/IDs/status metadata for administration, but ADMIN still cannot read a garden's business records without GardenMember.

**Organization member removal:** not exposed in V3-1 because an organization member may still own historical audit references or garden memberships. Removal/deactivation requires a later contract. Garden access is revoked through GardenMember.

---

## 3.2 Garden-level permissions

| Permission | OWNER | MANAGER | WORKER | VIEWER |
|---|---:|---:|---:|---:|
| Read garden metadata/business data | ✅ | ✅ | ✅ | ✅ |
| Read batches/orders/reservations/shipments/dossiers | ✅ | ✅ | ✅ | ✅ |
| Create/update batches | ✅ | ✅ | ✅ | — |
| Create/update/cancel orders | ✅ | ✅ | ✅ | — |
| Reserve/release/reconcile supply | ✅ | ✅ | ✅ | — |
| Plan/confirm/cancel shipments | ✅ | ✅ | ✅ | — |
| Create contact through garden command | ✅ | ✅ | ✅ | — |
| Update existing shared contact through garden command | ✅ | ✅ | — | — |
| Upsert dossier | ✅ | ✅ | ✅ | — |
| Update garden settings | ✅ | ✅ | — | — |
| Read member list | ✅ | ✅ | — | — |
| Invite MANAGER | ✅ | — | — | — |
| Invite WORKER/VIEWER | ✅ | ✅ | — | — |
| Change MANAGER/WORKER/VIEWER roles | ✅ | C | — | — |
| Revoke MANAGER | ✅ | — | — | — |
| Revoke WORKER/VIEWER | ✅ | ✅ | — | — |
| Stage migration/import | ✅ | — | — | — |
| Commit migration/import | ✅ | — | — | — |
| Approve explicit cloud-authority cutover | ✅ | — | — | — |
| Export full garden backup | ✅ | ✅ | — | — |

**MANAGER role-change rule:** MANAGER may only change `WORKER ↔ VIEWER`. A MANAGER cannot grant/revoke MANAGER.

---

# 4. Garden creation rules

## 4.1 Created by Organization OWNER

Atomic result:

1. create Garden;
2. create GardenMember for Organization OWNER with role OWNER;
3. append membership/audit event.

## 4.2 Created by Organization ADMIN

Atomic result:

1. create Garden;
2. create GardenMember for Organization OWNER with role OWNER;
3. create GardenMember for creating ADMIN with role MANAGER;
4. append audit events.

No garden may exist without its organization OWNER as Garden OWNER.

---

# 5. Invitation lifecycle

Initial V3 uses **shareable invitation links** suitable for Zalo/other messaging. The backend does not need to send invitation email itself.

## 5.1 Invitation target

Invitation is bound to:

- one organization;
- one garden;
- one normalized email address;
- one target GardenRole: MANAGER, WORKER or VIEWER.

OWNER cannot be invited.

## 5.2 Token

Server generates at least 256 bits of cryptographically secure random token material.

Client receives the raw token **once** in a shareable app link:

```text
https://<app-origin>/invite?token=<opaque-token>
```

On opening the invite route, the PWA must:

1. read the token into in-memory invite state;
2. immediately replace the browser URL/history entry with `/invite` before rendering third-party content or making unrelated requests;
3. submit the token only in HTTPS JSON request bodies to preview/accept;
4. never persist the raw token in analytics, logs, IndexedDB or localStorage.

Use a strict Referrer-Policy for the app so invite query material is not leaked through referrers during the brief bootstrap window.

Database stores only:

```text
SHA-256(raw token)
```

Never store raw invite token.

Do not send invite tokens in backend URL query strings; frontend extracts the app URL token and submits it in an HTTPS JSON request body.

## 5.3 Expiry

Invitation expires after:

```text
7 days
```

States:

```text
PENDING
ACCEPTED
REVOKED
EXPIRED
```

Expired status may be derived from `expiresAt` and persisted during cleanup/attempted use.

## 5.4 Duplicate invitation

Creating a new invitation for the same:

```text
garden + normalized email
```

when another PENDING invitation exists:

1. revoke the old invitation;
2. create a new token;
3. return only the new raw token.

This invalidates previously shared links.

## 5.5 Acceptance identity rule

V3 Supabase Auth configuration must keep **Confirm Email enabled** for email/password signup and **anonymous sign-ins disabled**.

Before preview/accept:

1. user must authenticate with Supabase;
2. server verifies JWT signature/issuer/audience/expiry/subject and rejects anonymous identity;
3. verified token must contain the authenticated email claim;
4. normalized authenticated email must exactly equal invitation target email.

Supabase access tokens do not guarantee a dedicated `email_verified` claim. Do **not** trust editable `user_metadata.email_verified`. The product relies on Supabase's Confirm Email policy to prevent a new email/password user from receiving a sign-in session before confirmation.

A forwarded link alone cannot grant access to a different authenticated email.

## 5.6 Acceptance transaction

If the user is not yet an organization member:

- create OrganizationMember role MEMBER.

Then:

- create GardenMember with invitation role;
- mark invitation ACCEPTED;
- record acceptedBy/acceptedAt;
- append audit event.

All happen atomically.

If GardenMember already exists, reject with:

```text
MEMBERSHIP_ALREADY_EXISTS
```

without changing their current role.

---

# 6. Invitation API

## POST `/v3/gardens/{gardenId}/invitations`

Auth: Garden OWNER/MANAGER according to target-role matrix.

Request:

```json
{
  "email": "member@example.com",
  "role": "WORKER"
}
```

Response `201`:

```json
{
  "invitation": {
    "id": "uuid",
    "gardenId": "uuid",
    "email": "member@example.com",
    "role": "WORKER",
    "status": "PENDING",
    "expiresAt": "2026-10-19T12:00:00.000Z",
    "version": 1
  },
  "shareUrl": "https://app.example/invite?token=opaque"
}
```

`shareUrl` is only returned on creation/replacement.

## POST `/v3/invitations/preview`

Authenticated request:

```json
{
  "token": "opaque"
}
```

Returns only safe invitation preview if the authenticated email matches:

```json
{
  "organizationName": "Vườn ươm Tuấn Sơn",
  "gardenName": "Vườn chính",
  "role": "WORKER",
  "expiresAt": "2026-10-19T12:00:00.000Z"
}
```

## POST `/v3/invitations/accept`

Authenticated request:

```json
{
  "token": "opaque"
}
```

Returns canonical organization/garden membership.

## DELETE `/v3/gardens/{gardenId}/invitations/{invitationId}`

Revokes PENDING invitation if caller has permission.

---

# 7. Role update API

## PATCH `/v3/gardens/{gardenId}/members/{userId}`

Request:

```json
{
  "role": "VIEWER",
  "expectedVersion": 3
}
```

Rules:

- target OWNER → reject;
- OWNER may manage MANAGER/WORKER/VIEWER;
- MANAGER may only change WORKER ↔ VIEWER;
- stale membership version → `409 VERSION_CONFLICT`.

## DELETE `/v3/gardens/{gardenId}/members/{userId}`

Rules:

- OWNER target → reject;
- OWNER can revoke MANAGER/WORKER/VIEWER;
- MANAGER can revoke WORKER/VIEWER;
- a non-owner user may revoke their **own** GardenMember to leave the garden;
- append audit event;
- future API/sync access immediately denied.

## PATCH `/v3/organizations/{organizationId}/members/{userId}`

Only Organization OWNER.

Request role may be:

```text
ADMIN
MEMBER
```

Organization OWNER target is immutable in V3-1.

---

# 8. Revocation and client cache

After GardenMember revocation:

- access token may still be cryptographically valid;
- every API request still fails membership authorization;
- outbox replay stops;
- garden-scoped cached business records are no longer displayed;
- client removes or cryptographically/logically isolates inaccessible cache on next authorization refresh;
- pending commands for revoked garden are not replayed under another account.

Do not rely on JWT expiry for membership revocation.

---

# 9. Effective permissions returned to client

`GET /v3/gardens/{gardenId}` returns server-computed permission keys for UI enable/disable only:

```json
{
  "id": "uuid",
  "name": "Vườn chính",
  "role": "WORKER",
  "permissions": [
    "garden.read",
    "batch.write",
    "order.write",
    "reservation.write",
    "shipment.write",
    "contact.create",
    "dossier.write"
  ]
}
```

Client permission list improves UX. Server still rechecks every request.

---

# 10. Initial permission keys

Stable initial keys:

```text
organization.read
organization.update
organization.members.read
organization.members.manage
garden.read
garden.settings.write
garden.members.read
garden.members.manage
batch.write
order.write
reservation.write
shipment.write
dossier.write
contact.read
contact.create
contact.update
import.stage
import.commit
cutover.approve
backup.export
```

Do not encode authorization logic in UI based only on role strings when permission keys are available.

---

# 11. Error codes

Add to V3 API taxonomy:

```text
INVITATION_EXPIRED
INVITATION_REVOKED
INVITATION_EMAIL_MISMATCH
INVITATION_ROLE_NOT_ALLOWED
MEMBERSHIP_ALREADY_EXISTS
MEMBERSHIP_NOT_FOUND
ROLE_CHANGE_NOT_ALLOWED
ORGANIZATION_OWNER_IMMUTABLE
```

Use `404 RESOURCE_NOT_FOUND` for foreign-tenant invitation/member IDs when existence must not leak.

---

# 12. Required V3-1 negative tests

- invalid/missing token → 401;
- user from foreign organization cannot enumerate garden;
- Organization MEMBER cannot list all organization garden metadata;
- Org ADMIN without GardenMember cannot read garden business data;
- WORKER cannot invite;
- MANAGER cannot invite MANAGER;
- MANAGER cannot change MANAGER role;
- no one can invite OWNER;
- invitee authenticated email mismatch cannot preview/accept;
- expired/revoked token cannot accept;
- duplicate pending invite invalidates old token;
- accept creates org MEMBER + garden role atomically;
- membership revoke blocks subsequent sync immediately;
- client-supplied role/permission values do not grant authority.

---

# 13. Deferred authorization features

Not part of V3-1:

- Organization OWNER transfer;
- multiple organization owners;
- custom roles/permissions UI;
- platform impersonation;
- organization-member hard deletion;
- public invitation links not bound to authenticated email identity;
- SMS/phone invitation channel;
- cross-organization sharing.
