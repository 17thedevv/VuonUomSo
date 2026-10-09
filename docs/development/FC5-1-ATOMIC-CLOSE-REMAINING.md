# FC5-1 — Atomic Close Remaining

Repository: `17thedevv/VuonUomSo`. Base: `0d8d97a7254998ac84c7fedc087724f8ccc44da2`.
Branch: `feat/fc5-close-remaining-domain`. Authority: [approved FC5 contract](FC5-FUNCTIONAL-CONTRACT.md).

**FC5-1 REVIEW PENDING / FC5 overall IN PROGRESS, NOT DONE / FC5-2 NOT STARTED / FC6 PLANNED.**
This is the first implementation slice. No merge or final acceptance is claimed.

## Behavior and transaction boundary

`previewCloseOrderRemaining({orderId})` reads a consistent snapshot in a read-only transaction. Its projection includes customer, order metadata, R/S/stopped, all source identities/labels/Q/F/status before/after, released outstanding, completed history, every planned cancellation and own availability/shortage effects. Fingerprint binds the existing deterministic order/source/batch/contact/shipment/history facts encoding, with a distinct closure action. Other commitments on affected own batches participate in confirmation.

`closeOrderRemaining({orderId, operationId, expectedFingerprint})` uses one outer Dexie rw transaction over orders/reservations/shipments/batches/contacts/events. Batches and contacts are read only. It looks up committed operations first, then reads current authority, checks strict confirmation and validates the entire cascade before writing. The persisted projection is itself validated before commit, using the same deep historical validator as retry.

```text
R50k / S20k / O12k / planned5k
→ requested50k and shipped20k preserved
→ stopped30k, released12k (different quantities)
→ active sources released, Q/F/IDs preserved
→ every planned shipment cancelled, IDs/lines/dates/notes preserved
→ order closed_remaining, O0, planned0, coverage=S20k
→ physical batches and completed history unchanged
```

No-active-source closure is valid when completed/F facts agree. Own shortages remain legitimate; availability is recalculated rather than promised to increase by exactly O. External closure never writes own stock. Other orders/sources remain unchanged. No source is deleted, quantity clamped or fulfillment fabricated.

Source history retains `quantity=Q`, `releasedQuantity=O`, `fulfilledQuantity=F`, operation/order/source references, and own batch timeline links. Planned cancellation events and the final `order_closed_remaining` marker share the cascade transaction. There is no Undo/reopen closure.

## Safety gates

- Shared pure fulfillment proof checks safe sums, Q/F/status/source identity, per-reservation completed lines, completed totals, coverage≤R and aggregate planned allocation≤O. New close/completion requires verifiable history; legacy missing completed lines cannot authorize it. Cancelled history retains references without being counted as S or P.
- Strict stale confirmation returns `PREVIEW_CHANGED` without writes. Storage failure rolls everything back and leaves operation identity available for exact retry; the service does not generate a replacement identity or auto-confirm.
- Both FC3 lookups and FC5 use the three existing marker types. Real A→FC5/B→FC5/FC5→A/FC5→B collisions fail with `OPERATION_ID_CONFLICT`. Existing committed FC3 retry semantics remain. FC5 validates duplicate markers and deep historical projection before returning a no-write retry, before current terminal/fingerprint checks.
- Explicit closed guards cover reservation creation/release, order edit/cancel, Trigger A/B, shipment creation/confirmation/cancellation and old lifecycle Undo. A Trigger B plan containing a closed order fails as a whole. Already-released source / cancelled plan / completed shipment retries remain no-write operations; they do not resurrect an order.
- Shipment confirmation proves current and prospective fulfillment before the first physical-stock write. Only exact S=R becomes shipped. Extra coverage/planned allocation, unsafe sums, mismatched history or overship fail without repair. Own/external/mixed multiple shipments reach shipped with O0/planned0; completed retries do not double deduct.
- Undo create-order/create-reservation re-reads terminal/history authority. Audit also found that old create-batch Undo could delete a historically referenced source batch. A transactional reservation/shipment reference guard now prevents that deletion, including released sources. Legitimate independent inventory edits and their Undo on a historically used batch remain allowed.
- Backup stays Dexie5 / formatV1. New closed state requires 0<S<R, O0/no planned, coverage=S and strict completed/F proof. Shipped requires S=R/O0/no planned; cancelled requires S0/no fulfillment/completed evidence/O0/no planned. Closure marker, when present, is deeply validated against order/source/completed/cancelled history; corruption rejects before full replace. Valid legacy import policy is retained; no inference of partial→closed.

## Minimal read-model changes

The new enum and derived status distinguish closed, full completion and invalid evidence. Historical remaining stays R−S; actionable remaining/shortage becomes zero for terminal orders. Closed orders remain in All/detail/history and are excluded from action/ready/full-shipped queues. Reservation/shipment candidates and direct reserve route block closed orders. Existing detail/card/badge render the new state without claiming a source was never reserved or a partial closure was full fulfillment.

There is **no close button/modal or primary completion UI** in this slice. Full shipment vocabulary/navigation/success/history rendering audit remains FC5-2. Existing historical event messages are preserved.

## Verification

Local full integration gate: typecheck PASS, lint0/0, **56 test files / 823 tests PASS**, production build PASS, PWA14 entries. Exact-head remote CI is verified after push and linked in the PR handoff; this committed report does not pre-claim a future CI run.

100 added tests include pure projection/terminal filtering, real Dexie close/retry/restore, four collision directions, stale source/contact/inventory/metadata/plan/completed/history facts, concurrent duplicate submit, both transaction orders for shipment/reserve/release/Trigger B races, six write/event failure injection points, old reservation/order/batch Undo, mixed/own/external full completion, terminal backup corruption and direct reserve/detail route guards.

Regression fixture changes: a stored shipped order without completed evidence now renders invalid; corruption tests assert the earlier `INVALID_STATE` guard; the two-batch stock rollback fixture now has valid coverage so it reaches its intended insufficient-physical-stock failure. The old rollback/stock assertions remain.

Read-model browser smoke: real create→external reserve32k→ship20k→service close, followed by All/detail/direct reserve at **360/390/430/1280px**. Twelve checks PASS: no horizontal overflow, terminal status/history visible, no reserve/edit/cancel/new-shipment eligibility. Screenshots visually inspected for All360 and detail390. Local evidence: `C:/Users/84387/.codex/fc5-1-evidence/read-model.mjs`, `result.json`, per-route PNGs. These files are local evidence, not independently accessible via GitHub and not FC5 UI/final acceptance.

## Scope and remaining work

No schema/version/dependency change, new operation table, reconciliation-engine rewrite, completed shipment edit, external transfer, metadata edit on terminal orders, generic-product refactor, backend, FC6, or redesign. The ordinary Vite large-chunk advisory remains; build succeeds.

After reviewed merge and merge-CI green: FC5-2 UI/vocabulary → FC5-3 cross-flow hardening → Final Acceptance on clean main. Physical IME, installed-PWA offline and field pilot remain unverified. FC3 deep old-marker integrity and stable order differentiator remain deferred. **FC5 DONE is not claimed.**
