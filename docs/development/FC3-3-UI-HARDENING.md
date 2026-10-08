# FC3-3 — Reconciliation UI + Cross-flow Hardening

Status: **REVIEW PENDING**. FC3 overall remains **IN PROGRESS**; FC3-1 is not DONE. Merge and FC3 Final Acceptance on main are still required.

Repository: `17thedevv/VuonUomSo` · Branch: `feat/fc3-reservation-reconciliation`

Base: `1b3ec07f9de7e47a16d419eaf41519152c2bdfe0` (FC3-2 closure).

## Implemented workflows

**Order reduction (Trigger A):** SỬA ĐƠN → requested below coverage → ĐIỀU CHỈNH NGUỒN GIỮ. Users manually select the order's own/existing external sources and enter absolute **Còn giữ sau điều chỉnh**, including zero for full release. No source is automatically selected. The preview displays requested, coverage, shortage and each selected source before/after. An intentional shortage is allowed and shown before confirmation. Quantity and source adjustments are saved by the existing atomic reconciliation service; `updateOrder()` is not called first.

**Metadata:** date/price/note/variety drafts stay in the edit component while the reconciliation step is open or when returning from it. The step explicitly says metadata has not been saved. After success, the current order is read again; untouched fields reload current authority, intentionally edited metadata stays in the form, and the user separately confirms CẬP NHẬT ĐƠN. A failed post-save reload blocks further metadata submission until a successful reload.

**Batch shortage (Trigger B):** the shortage warning exposes the CTA only when shortage > 0. Users manually select active own sources on that batch, reduce/release outstanding, or transfer to another same-variety batch with current available quantity. There is no automatic choice of which customer bears the shortage. Each row identifies its order through requested quantity/date and a XEM ĐƠN link, including when one customer has multiple orders; it shows outstanding, fulfilled and planned allocation when present. The preview distinguishes transfer from pure release, source shortage before/after, target availability/incoming and affected orders' coverage/shortage; requested quantity stays unchanged. Partial success explicitly reports the remaining shortage. Transfer feedback names source, target and quantity.

**Authority and history:** successful screens reload repository data rather than treating UI projections as persistent authority. Existing order/source/target event messages render through the existing timelines. Reconciliation adds no Undo. Physical batch records are not mutated by these UI flows.

## Confirmation lifecycle

| Result / action | UI behavior |
| --- | --- |
| Preview success | Snapshot owns the exact plan, fingerprint and a new operationId; separate confirmation required |
| Any source/value/unit/target/transfer edit | Discard snapshot; obtain a new preview and operationId |
| PREVIEW_CHANGED | Keep input; refresh facts and preview; no automatic commit retry; require another click |
| Fresh preview becomes a planned conflict | Keep the new structured conflict and shipment link; no confirm button |
| STORAGE_ERROR | Keep preview, plan, fingerprint and operationId; retry the exact operation; no success feedback |
| OPERATION_ID_CONFLICT | Fail closed, discard snapshot and refresh; new preview assigns a new identity |
| Target/variety/order/shipment error | Explain the specific error; retain user inputs and allow review/back; service remains authority |
| Busy / double tap | Ref guard plus disabled controls; modal waits for authoritative result |

Planned allocation failures show the exact planned and requested outstanding quantities and **XEM CHUYẾN CHỜ XUẤT** links to `/shipments/:id`. No shipment cancellation, line editing or allocation resizing occurs in reconciliation UI. Legacy unverifiable allocation uses the same structured shipment links from the service.

## Tests and local gates

- New `ReconciliationUI.test.tsx`: **26 tests**, with real Dexie integration through both screens and services. Covers exact/intentional-shortage order reduction, full release, metadata separation, parser/invalid input, partial/exact batch resolution, transfer, current target filtering, order identification for repeated customers, partially shipped safety, planned links, refreshed planned conflicts, stale reconfirmation, exact storage retry identity, changed-plan identity, operation conflicts and double taps.
- Existing real reconciliation/Undo/backup/race/rollback service suites remain intact.
- Full local suite: **48 files / 652 tests PASS**. Typecheck PASS; lint **0 warnings / 0 errors**; build PASS; PWA **14 precache entries**.
- Build retains Vite's bundle-size advisory; no dependency or code-splitting change is included. Existing jsdom navigation notices remain non-failing.
- Exact-head GitHub Actions result and SHA are recorded in the PR handoff; REVIEW PENDING is not a merge approval.

## Browser evidence — isolated Chromium / IndexedDB

Date: 08/10/2026. Chromium `151.0.7922.34`; headless contexts use isolated local data. No user or pilot database is modified. Existing create-order and own/external-reservation UI is exercised in scenario A; remaining scenario setup uses real services with isolated stock fixtures. All reconciliation actions are through the rendered UI.

| Scenario | 360px | 390px | 430px | 1280px |
| --- | --- | --- | --- | --- |
| A: create50k → own20k + external12k → requested25k / coverage25k, reload/history/stock | PASS | PASS | PASS | PASS |
| B: requested25k / coverage22k, visible shortage3k | PASS | PASS | PASS | PASS |
| C: ready15k / O18k → selected10k→9k; shortage3k→2k | PASS | PASS | PASS | PASS |
| D: transfer3k A→B; shortage0 / target8k→5k; same coverage/stock, new source and all timelines | PASS | PASS | PASS | PASS |
| E: planned10k vs newO5k; blocked, exact quantities, correct actual shipment route, unchanged shipment | PASS | PASS | PASS | PASS |
| F: requested30k / F10k / O15k→12k; F/completed/status/stock preserved, order edit unavailable | PASS | PASS | PASS | PASS |

All four widths pass document/dialog horizontal-overflow checks, numeric/select/button target height ≥44px, long-modal scrolling and reachable footer bounds. Source/transfer checkboxes have full-width labels with ≥48px touch height. Screenshots of inputs and previews were visually inspected, including 360px and desktop transfer preview.

At each width, reducing viewport height to 400px and focusing an input also leaves the confirm/back footer reachable. This is a keyboard-height simulation, **not a physical Android/iOS IME test**; hardware keyboard behavior and field pilot remain unverified.

At 390px, a real intervening `updateOrder()` after preview produces PREVIEW_CHANGED, creates no reconciliation event on the first confirm, and requires another confirmation. Typed note remains unsaved until separately confirmed; the intervening untouched unit price remains current.

Local evidence directory: `C:/Users/84387/.codex/fc3-3-evidence/`. It contains `browser.mjs`, `results.json`, and screenshots at all four widths, including `A-preview-{width}.png`, `C-preview-{width}.png`, `D-input-{width}.png`, `D-preview-{width}.png`, `F-preview-{width}.png`, and keyboard-height screenshots. These browser tools/screenshots are outside the repository and are not runtime dependencies.

## Scope and deferred work

Changed files: seven UI/helper production files, one UI test file, this report and `.agent/PROJECT_STATE.md`.

No domain/service semantics, schema, dependencies, FC4, FC5 `closed_remaining`, shipment-line editing, new external commitment capability, generic-product abstraction or whole-app redesign. Deep validation of manually corrupted idempotency-marker projections remains deferred exactly as accepted in FC3-1B/FC3-2.

Next after review and merge: merge CI and **FC3 Final Acceptance on main**. Only then consider FC3 DONE / later roadmap work.
