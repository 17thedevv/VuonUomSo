# FC3-2 — Batch Shortage Reconciliation + Own-Batch Transfer

Status: **CLOSED / ACCEPTED / MERGED**. FC3-0/FC3-1A/FC3-1B CLOSED; FC3-1 và FC3 overall **chưa DONE**. **FC3-3 NEXT — UI + Cross-flow Hardening**, chưa bắt đầu.

Người dùng nghiệm thu exact-head `5ea0e7a9dbe6d45c7dd084374991c2cb7cec1dd3`: PASS / MERGE READY. [PR #18](https://github.com/17thedevv/VuonUomSo/pull/18) merged tại `9d782458f173633f36c801d49668f78d02d91da4`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37772762007): typecheck, lint, full tests và build PASS. Exact-head gate: lint0/0 (147 files), 47 files / 626 tests PASS, PWA14 entries. Không phát hiện BLOCKER/HIGH trong phạm vi review FC3-2.

Base: `main = 8577a793dea924a327e416f66b4de0e48a5a9be6`. Branch: `feat/fc3-reservation-reconciliation`.
Authority: task FC3-2 của người dùng, [FC3 contract](FC3-FUNCTIONAL-CONTRACT.md), [FC3-1A safety](FC3-1A-SAFETY.md), [FC3-1B](FC3-1B-ORDER-REDUCTION.md).

## API và projection

```ts
const plan = {
  sourceBatchId: 'A',
  adjustments: [{
    reservationId,
    newOutstanding: 7000,
    transfer: { targetBatchId: 'B', quantity: 3000 } // optional
  }]
}
const preview = await previewBatchShortageReconciliation(plan)
if (preview.success) {
  const result = await reconcileBatchShortage({
    ...plan, operationId, expectedFingerprint: preview.fingerprint
  })
}
```

`batchReconciliation.ts` chứa pure validation/projection/canonical intent/fingerprint; `batchReconciliationService.ts` đọc/ghi Dexie. Reuse `reduceReservationOutstanding`, safe sums, reservation validation và planned allocation helper từ FC3-1B. Trigger A vẫn giữ semantics đã duyệt; registry operation marker dùng chung cho hai triggers để tránh trùng ID xuyên trigger.

Projection có source living/ready/O/available/shortage trước/sau; mỗi selected reservation Q/F/O/status trước/sau, planned P, lượng nhả thuần và lượng chuyển; per-order before/after/coverage/shortage; target incoming tổng và available/shortage trước/sau. `targetReservations` liên kết sourceReservationId với reservation mới. Preview không cấp persistent IDs và không ghi; commit tạo UUID/createdAt trong transaction thành công, result/history chứa đúng IDs đã lưu. Không đổi ID/batchId/createdAt/F của source, không gộp vào target record cũ.

## Trigger B và transfer

Chỉ chọn active own_batch O>0 trên source batch. Source phải đang thiếu cây đã giữ; successful operation phải giảm thực sự shortage. Ready15k/O18k → giảm1k còn shortage2k hợp lệ; giảm3k hết shortage; giảm5k được phép nếu user chọn rõ. Không FIFO, không tự chọn khách hoặc giảm requested để che thiếu.

Partial `Q'=F+newO`; full release giữ Q dương, F và identity, status released. Requested/variety/date/price/note của mọi affected order giữ current value. Chưa xuất: status tính theo coverage; đã xuất một phần: giữ partially_shipped. Completed allocation/F phải nhất quán, immutable; cancelled/shipped hoặc đã xuất đủ bị chặn. Không FC5 closed_remaining.

Own A→B chỉ cùng giống normalize trim/lowercase, B khác A, physical facts hợp lệ, current available B>0 và đủ **tổng incoming từ mọi dòng**. Stored batch status không quyết định sellability. Không dùng projected release ở target để tạo availability; một source batch/operation và strict source selection loại bỏ chain/cycle. Không transfer qua external.

`T <= oldO-newO`; phần giảm = nhả thuần + T. Transfer T giữ nguyên coverage order, pure release làm giảm coverage; coverage không tăng và không vượt requested. Target reservation mới active/Q=T/F=0, cùng order. Mọi source/target batch object giữ nguyên; shipment confirm mới giảm stock.

## Planned allocation, confirmation và retry

P được cộng qua tất cả planned shipments/lines. `newO >= P` cho cả giảm/transfer. Chuyến legacy/unverifiable fail closed với shipment IDs. Không move/resize/cancel line; completed không sửa. Ví dụ O15k/P10k: source-after12k PASS, source-after5k FAIL kể cả transfer10k.

Fingerprint canonical bind absolute intent và toàn facts liên quan: source/target physical objects, các cam kết đóng góp shortage/availability, selected sources, orders và metadata/status, supply khác của các orders liên quan, contacts, planned/completed/cancelled shipments/lines, batch/order history IDs. Record/property/selection/line ordering không làm đổi token. Metadata, ready, commitment, target, shipment hoặc history đổi → PREVIEW_CHANGED trước mutation; không last-intent-wins. Nested intent được copy trước await.

Source `batch_reconciled` event là marker trigger=batch_shortage. Same operationId/canonical intent trả historical committed projection và target IDs, không ghi lại dù sau đó cancel/confirm. Different intent/batch hoặc ID đã dùng cho Trigger A → OPERATION_ID_CONFLICT; Trigger A cũng reject ID đã dùng cho B. Duplicate submit chỉ một marker và mỗi transfer đúng một target record. Incomplete marker identity fail closed; deep marker-integrity NOTE của FC3-1B vẫn deferred, không mở event-integrity project.

## Transaction, events và Undo

Preview đọc consistent `r`; commit `rw` bao phủ orders/reservations/batches/shipments/contacts/events. Marker lookup → current facts/fingerprint → validate full plan → source writes → target add → affected order statuses → order/source/target events cùng transaction. Không gọi services độc lập để giả atomic, không write batches/shipments.

Order `reservation_reconciled`, source `batch_reconciled`, target `reservation_transferred` events đều có operationId/trigger, before/after/effects và source/new-target relation. Không gọi phần nhả là đã xuất, không xóa creation/completed history. Event failure ở từng vị trí hoặc target/order write failure rollback toàn bộ, không lưu marker/target một phần; same-ID retry sau rollback thành công đúng một lần.

Không Undo reconciliation. Old create_reservation Undo bị chặn sau **real Trigger B reduction và transfer**, kể cả selected source giữ nguyên O nhưng order operation/history đã đổi. Regression khẳng định post-state/history/stock/new target không đổi, không false reservation_released.

## Failure codes

| Code | Ý nghĩa |
| --- | --- |
| NOT_FOUND | Source/target batch không tồn tại |
| INVALID_INPUT / INVALID_SELECTION | Số/ID sai, duplicate selection, tăng O, T vượt reduction; sai lô/nguồn hoặc chain/cycle |
| INVALID_STATE | Quantity/reference/coverage/physical facts hoặc completed/F/marker identity không xác minh được |
| ORDER_CANCELLED / ALREADY_SHIPPED | Affected order đã hủy/xuất đủ |
| VARIETY_MISMATCH | Target không cùng giống source/order |
| TARGET_UNAVAILABLE | Tổng incoming vượt current capacity, target không còn bán hoặc có shortage |
| PLANNED_ALLOCATION_CONFLICT | newO<P; trả nguồn/chuyến/P/newO |
| UNVERIFIABLE_PLANNED_SHIPMENT | Legacy/sai allocation; trả shipment IDs |
| COVERAGE_EXCEEDS_REQUESTED | Post coverage tăng hoặc vượt requested |
| PREVIEW_CHANGED | Intent/current facts đổi; trả state/fingerprint mới để refresh |
| OPERATION_ID_CONFLICT | ID đã được dùng cho intent/batch/trigger khác |
| NO_OP | Không có shortage hoặc không giảm shortage thật; không history thành công giả |
| STORAGE_ERROR | Read/write/transaction failure; không ghi một phần |

## Verification và giới hạn

Tests dùng domain assertions và real Dexie/services, không mock transaction. Bao phủ partial/exact/over/full release, transfer + release, aggregate capacity/multiple orders, existing target giữ nguyên, planned/legacy guards, partially shipped và selected F>0, strict stale matrix, canonical/cross-trigger/concurrent idempotency, generated IDs, record/event rollback, stale Undo thật, backup→restore→reopen và retry sau restore.

Race tests cả hai thứ tự Trigger B với ready update, source commitment writer, target reservation, confirm shipment, cancel affected order. Source writer khi lô đang thiếu phải cập nhật ready rồi tạo commitment trong cùng writer transaction; Trigger B re-read và reject preview cũ. Trigger B thắng target writer thì incoming đã chiếm capacity, writer không thể over-reserve. Confirm thắng làm preview stale; confirm sau B chỉ giảm stock đúng shipment allocation.

Local full gate: **typecheck PASS, lint0/0 (147 files), 47 files / 626 tests PASS, build PASS, PWA14 entries**. Có 133 regression mới (36 domain, 97 real-service). Hai suites mới: 133/133 PASS; related suites FC3-1B/Undo/backup đã chạy, full suite bảo vệ toàn bộ regressions cũ. Browser acceptance không áp dụng vì không có UI diff. **Chưa bắt đầu:** FC3-3 UI, FC4/FC5, shipment-line editing, external commitment mới, generic product/rename, schema/dependency mới. FC3-2 đã nghiệm thu/merge và CI merge xanh; **FC3-3 NEXT**, sau đó Final Acceptance. FC3-1 và FC3 overall chưa DONE. Deep marker-integrity NOTE vẫn deferred theo closure FC3-1B.
