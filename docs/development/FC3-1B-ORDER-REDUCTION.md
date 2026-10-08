# FC3-1B — Atomic Order Reduction Reconciliation Domain/Service

Status: **REVIEW PENDING**. FC3-0/FC3-1A CLOSED; FC3-1 và FC3 overall **chưa DONE**.

Base: latest `main = 88bf5ada6281edd861bca95dedc5b0c6b87b127e` trước code. Branch: `feat/fc3-reservation-reconciliation`.
Authority: [FC3 contract](FC3-FUNCTIONAL-CONTRACT.md), [FC3-1A safety](FC3-1A-SAFETY.md), task FC3-1B của người dùng.

## API và phạm vi

Domain `reconciliation.ts`: `reduceReservationOutstanding()`, `projectOrderReduction()`, `orderReductionFingerprint()` và canonical `orderReductionIntentKey()`.

Service `reconciliationService.ts`:

```ts
const plan = {
  orderId,
  desiredRequestedQuantity: 25000,
  adjustments: [
    { reservationId: ownReservationId, newOutstanding: 15000 },
    { reservationId: externalReservationId, newOutstanding: 10000 }
  ]
}
const preview = await previewOrderReduction(plan)
if (preview.success) {
  const result = await reconcileOrderReduction({
    ...plan, operationId, expectedFingerprint: preview.fingerprint
  })
}
```

Preview đọc consistent trong Dexie `r` transaction, không ghi state/history. Commit dùng `rw` transaction bao phủ orders/reservations/shipments/batches/contacts/events: đọc marker/current state → kiểm confirmation/plan → ghi selected reservations → requested/status → order/batch events → commit. Không gọi tuần tự `updateOrder()`/`releaseReservation()` để giả atomic.

Input chỉ có absolute desired requested/new outstanding và confirmation/operation ID; không nhận metadata để ghi lại. Copy intent trước await để caller không đổi nó trong lúc đọc DB. Batches và shipments chỉ đọc; không put/update/delete physical stock hoặc shipment. Các nguồn không chọn giữ nguyên.

Trigger A yêu cầu **requested mới giảm thật**. Plan không đổi requested/nguồn trả `NO_OP`; tăng requested hoặc chỉ giảm nguồn với requested giữ nguyên bị reject (Trigger B chưa làm). Danh sách adjustments có thể rỗng nếu coverage hiện tại vẫn <= requested mới; không tự chọn thêm nguồn.

## Post-state và guard

- `coveredAfter <= requestedAfter`, cho phép shortage thật: 50k/C32k → 25k/C25k hoặc 25k/C22k/thiếu3k. C28k với requested25k trả conflict dư3k, không ghi.
- Active/O>0 mới được chọn; `0 <= newO <= oldO`, số nguyên an toàn, kể cả tổng coverage/commitment/allocation trung gian.
- Partial: `Q'=F+newO`, active. Full release: giữ Q dương ngay trước thao tác, F giữ nguyên, status released; không fake fulfilled/xóa record. Domain test Q20k/F8k/O12k→O7k chứng minh Q15k/F8k; Trigger A service vẫn khóa khi F>0.
- Completed shipment, fulfilled reservation/F>0, stored partially_shipped/shipped và cancelled order khóa Trigger A. Không né FC2 `hasOrderShipmentHistory`.
- P cộng mọi planned line của từng nguồn trong mọi planned shipment liên quan. `newO >= P`; giữ nguyên line/date/status. Conflict có reservation ID, shipment IDs, P và newO. Legacy/missing/invalid allocation fail closed với shipment ID, không giả P=0.
- Existing external chỉ giảm/nhả; không tạo nguồn ngoài mới hoặc transfer. Reference/status/quantity hỏng bị reject; legitimate batch commitment shortage vẫn được giữ nguyên.
- Order status sau giảm: C0=open, 0<C<requested=partially_reserved, C=requested=reserved. Metadata giữ current value.

## Confirmation và operationId

Fingerprint là canonical JSON của **intent + current facts**: toàn editable order metadata/status/customer/requested/variety; Q/F/status/source/references của nguồn đơn và các cam kết cùng lô; batch living/ready/initial/variety; source contact facts; mọi related shipment/line/status/completion; order/source-batch history IDs. Thứ tự records, selections hay property insertion không đổi semantics. Đổi bất kỳ facts hoặc absolute plan sau preview → `PREVIEW_CHANGED`, trả current facts/token để xem lại; không last intentional edit wins hoặc tự sửa kế hoạch.

Guard history/contact/batch facts cố ý bảo thủ, tương thích FC3 strict confirmation và FC3-1A. Token chỉ kiểm current authority ở commit, không dùng để ghi snapshot metadata.

`operationId` là ID operation toàn workspace, marker là **order_reconciled event** append cùng transaction, không thêm schema/bảng:

- Cùng ID + cùng canonical order/requested/selected absolute adjustments → success `idempotent: true`, trả projection **của commit ban đầu**, không giảm/ghi event lần nữa. Token preview mới không đổi retry identity.
- Cùng ID + intent/order khác → `OPERATION_ID_CONFLICT`.
- Marker lỗi/incomplete → fail closed; không suy diễn để áp dụng lại.
- Event failure rollback cả marker/order/reservations và batch events đã ghi. Retry cùng ID sau failure thực hiện đúng một lần.
- Nếu state đã đổi sau commit (ví dụ cancel/confirm), retry vẫn trả kết quả lịch sử của operation; không phục sinh/ghi đè current state. Caller cần preview mới cho operation mới.

## Failure codes

| Code | Ý nghĩa |
| --- | --- |
| NOT_FOUND | Order không tồn tại |
| INVALID_INPUT | Số/ID/selection shape sai, duplicate ID, tăng requested hoặc source-only intent |
| INVALID_STATE | Current quantities/status/references/tổng không hợp lệ hoặc marker chưa xác minh được |
| ORDER_CANCELLED / ALREADY_SHIPPED | Trigger A không còn được phép |
| INVALID_SELECTION | Nguồn không thuộc đơn hoặc không active/O>0 |
| PLANNED_ALLOCATION_CONFLICT | New O thấp hơn P; trả nguồn/chuyến/P/newO |
| UNVERIFIABLE_PLANNED_SHIPMENT | Allocation legacy/hỏng; trả shipment ID |
| COVERAGE_EXCEEDS_REQUESTED | Giảm nguồn chưa đủ; trả coverage/requested/excess |
| PREVIEW_CHANGED | Facts hoặc plan đã đổi; current state/fingerprint để refresh |
| OPERATION_ID_CONFLICT | ID đã commit với intent khác |
| NO_OP | Không có thay đổi thực; không marker/event |
| STORAGE_ERROR | Transaction/read failure; không ghi một phần |

## History và Undo safety

Order event chứa operationId/trigger/canonical intent, selected IDs và projection: order before/after, coverage/shortage before/after, mỗi selected reservation Q/F/status/source/references/O before/after (F thiếu field được hiểu là 0 theo model). Mỗi affected own batch có reservation_reconciled event cùng operationId, source adjustments và batch effect/coverage/shortage. Creation history giữ nguyên; copy gọi phần nhả là cây đang giữ, không “đã xuất”. Không persist toàn confirmation token vào history hoặc replay events để dựng current state.

Success mới clear Undo banner; failure giữ intent để retry. Không Undo reconciliation. Old create_reservation Undo guard FC3-1A được chứng minh qua **service thật** cho O10k→7k, O10k giữ nguyên nhưng giảm requested, và full release O0: Undo cũ fail, order/coverage/stock/history giữ post-state, không false release event. Old create-order Undo thêm order_reconciled guard để không xóa đơn đã giảm requested dù vẫn open/không reservation.

## Verification và giới hạn

Domain/integration tests bảo vệ happy paths, intentional shortage, full release/external reduction, F representation, planned/legacy guards, invalid/unsafe numbers, mọi stale facts, canonical idempotency, rollback và races. Assertions kiểm toàn physical batch objects unchanged khi reconciliation; race có actual confirmation kiểm stock chỉ giảm đúng một lần do shipment.

Real Dexie races cả hai thứ tự reconciliation↔confirm và reconciliation↔cancel; duplicate submit chỉ một marker/change. Real reconciliation còn batch shortage → export/restore/reopen bảo toàn state/history/operation marker; retry sau restore idempotent.

Local full quality gate: **typecheck PASS, lint0/0, 45 files / 493 tests PASS, build PASS, PWA14 entries**. Có 87 regression mới: 20 domain, 64 reconciliation service và 3 old-Undo real-service cases. Related suites (reconciliation/Undo/FC2/backup): 5 files / 172 tests PASS. Exact-head SHA/CI được ghi trong PR/handoff. Browser acceptance không áp dụng vì không sửa UI.

**Chưa bắt đầu:** UI, FC3-2 Trigger B/own transfer, FC4/FC5, shipment-line editing, generic product/rename, schema/dependency mới. Không đóng FC3-1 hoặc FC3; chờ nghiệm thu và merge FC3-1B trước slice tiếp theo.
