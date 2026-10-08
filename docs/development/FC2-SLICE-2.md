# FC2 slice 2 — Order Edit/Cancel UI

Status: IMPLEMENTED / REVIEW PENDING. FC2 overall remains IN PROGRESS until review and merge.

Base: `main = bf3dee5` (PR #8 accepted, merged, CI green). Branch: `feat/fc2-order-ui`.

## Owner workflow

- Order Detail offers SỬA ĐƠN / HỦY ĐƠN only before shipment and while the order is active.
- Edit opens with the existing plant quantity in cây. Switching to vạn retains the shared parser/helper. The form edits quantity, requested date, unit price and note; variety is editable only before any reservation history. Existing ISO requested dates are preserved when the date was not edited.
- Edit submits only fields changed from the initial form values. An untouched quantity is omitted, so a note-only save cannot overwrite an intervening quantity update. Form quantity validation/preview stays separate from the mutation payload. For an intentional quantity edit, the last submitted edit wins after current-state transaction validation; for example, opening at 50.000, an intervening update to 60.000 and an intentional edit to 55.000 saves 55.000 without changing sources or stock. There is no whole-order optimistic fingerprint in this patch.
- Before save, the owner sees current demand, covered supply, demand after editing and resulting supply shortage, using existing domain helpers. Invalid input hides projected after values. Reducing below coverage explains “Đang giữ dư X cây”, preserves sources and disables update. A conflict returned at commit time refreshes coverage and retains entered metadata.
- Cancellation lists the active source count, each source and quantity, total release quantity, planned shipment count/quantities/dates, unchanged physical stock and retained history. Closing/Escape leaves data untouched. The confirmation warns that cancellation has no Undo.
- A cancellation preview fingerprint is checked inside the existing atomic transaction. Changed demand/sources/plans return PREVIEW_CHANGED before writes; the UI refreshes consequences and requires another confirmation. Existing callers without a fingerprint retain the slice 1 API semantics. A completed shipment while the dialog is open removes whole-cancel confirmation after revalidation.
- Timeline uses changedFields for correction text: metadata-only edits do not show a fake unchanged quantity arrow. The existing layout is retained; this is not a redesign of Order Detail.

## Evidence

- Integration tests invoke real Dexie services through UI for edits, exact-coverage reduction, own/external cancellation and planned shipment cancellation. They verify persisted records, stock, history, duplicate clicks, metadata/date/unit handling, invalid input, storage rollback, stale coverage/variety/preview and completed shipment guards.
- Stale-order regression reproduced the note-only overwrite (60.000 → 50.000) before the fix. After the fix, a note-only save preserves intervening quantity/date/price updates and records only note in changedFields; an intentional quantity change saves 55.000 with a truthful 60.000 → 55.000 event. Both use the real updateOrder transaction and preserve reservation/stock records.
- Browser QA on isolated localhost demo data at 360/390/430/1280px: readable edit conflict and cancel preview, scrollable form with visible footer, no horizontal page overflow.
- Browser flow: Chị Lan 50.000 → 40.000, coverage remains 32.000, shortage 8.000; date/price/note saved; date-only history shown correctly. Anh Hùng cancellation previews 2 sources (own 10.000 + external 20.000) and 1 planned shipment (10.000), then cancels all through UI. Living 45.200 and ready 32.000 remain unchanged; available 22.000 → 32.000. Another order completes a 12.000 shipment and edit/cancel actions disappear.
- Screenshots: `C:/Users/84387/.codex/visualizations/2026/10/08/01a118d2-9ada-77a1-9a4d-486bfcee630c/fc2-order-ui/` (`edit-conflict-*`, `cancel-preview-*`, `edited-390`, `cancelled-390`, stock before/after and shipped guard).
- Final local gate after the stale-order fix: typecheck PASS, lint 0 warnings / 0 errors, **42 files / 376 tests PASS**, build PASS (PWA 14 entries). Related correction UI + order lifecycle domain/service tests: 67 PASS across 3 files. Exact-head CI is recorded in the PR.

## Boundaries

No schema/dependency change, new Undo action, FC3 reconciliation, FC5 closed_remaining, or UI-R03/R04/R05 styling sweep. FC2 overall is not marked DONE by implementation alone.
