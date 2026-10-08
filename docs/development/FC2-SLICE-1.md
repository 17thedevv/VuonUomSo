# FC2 — Order Lifecycle & Corrections: slice 1

Status: IMPLEMENTED / REVIEW PENDING. FC2 overall: IN PROGRESS.

Base: PR #7 merged at `54a9fa3`, merge CI SUCCESS. Branch: `feat/fc2-order-lifecycle`.

## API and contract

- `updateOrder({ orderId, requestedQuantity?, requestedDate?, unitPrice?, note?, variety? })` re-reads the order, reservations and shipments inside one transaction. Quantity is a positive safe integer; unit price is a nonnegative integer in đồng. Date uses valid `YYYY-MM-DD`. `null` explicitly clears optional date, price and note; omitted fields remain unchanged.
- Edit applies before any shipment only (FC0 clause 6). Cancelled orders cannot be edited. A completed shipment, shipped order status or reservation fulfillment history blocks editing and whole cancellation, even when another status is stale.
- Variety changes require no reservation history, including released records. Increasing demand leaves sources and stock unchanged. Decreasing to or above covered quantity is allowed; coverage uses the existing domain helper across own and external reservations.
- A quantity below coverage returns `RECONCILIATION_REQUIRED` with `coveredQuantity`, `requestedQuantity` and `excessQuantity`. No metadata, reservation, shipment, stock or history is changed. Source selection/reconciliation belongs to FC3.
- `cancelOrder({ orderId })` releases active reservations, cancels planned shipments and marks the order cancelled in one transaction. It retains quantities, identifiers, original metadata and all historical records. Other orders and their sources/plans remain unchanged. Duplicate cancellation succeeds without duplicate events.
- Domain events record before/after for corrections and cancellation, plus each released source and cancelled plan. Batch timelines also receive release events. Event-write failure rolls back the whole transaction.

## Undo boundary

No Undo action is added for editing or cancellation. Successful changes clear a stale Undo banner. The existing create-order Undo rechecks correction/cancellation events, any reservation/ shipment history and status inside its transaction before deleting an order. This also guards a previously captured Undo action after a correction.

## Verification and deferred work

Tests cover quantity boundaries, own/external coverage, optional metadata, variety history, shortage after increase, valid planned shipment after decrease, atomic cancellation, idempotency, persistence failure, concurrent reservation/correction and confirmation/cancellation in both orders, and stale Undo guards.

Local verification (08/10/2026): typecheck PASS, lint PASS, full suite **41 files / 355 tests PASS**, build PASS (PWA 14 entries). Related suite: 95 tests PASS. Three stale Undo regressions failed against the old Undo implementation and pass with the guard. Exact-head CI is reported in the PR.

This slice has no UI, schema migration or new dependency. Order Detail actions and confirmation of cancellation effects remain the next FC2 slice. FC2 is not DONE until its UI and full workflow have been accepted. FC3 reconciliation, FC5 `closed_remaining` and UI-R03/R04/R05 remain outside this slice.
