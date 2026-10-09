# FC5-0 — Fulfillment & Completion Functional Contract

**Repository:** `17thedevv/VuonUomSo` · **Ngày:** 09/10/2026.

**Exact base đã audit:** `main = 0647bfbbdb183ac0e7a652275096e7044b2cef04`.

**FC5-0 APPROVED / CLOSED — FC5-1 NEXT / FC5 implementation NOT STARTED / FC5 overall NOT DONE. FC6 PLANNED / NOT STARTED.**

Người dùng duyệt exact-head `2ccec90b3053af5f5aa937af5b2edb9307475aba`; [PR #27](https://github.com/17thedevv/VuonUomSo/pull/27) merged tại `29d97c87de810a68607e7dc4433599d8945dfaf7`. [Exact-head CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37897333014) và [merge-CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37898636631): typecheck/lint/full tests/build PASS. Gate approved head: lint0/0 (158 files), 53 files / 723 tests PASS, PWA14; merge đã được kiểm từng step full CI. Contract đúng hai file docs/state, không `web/` diff; đóng contract không phải nghiệm thu implementation.

Task FC5-0 chỉ tạo contract này và cập nhật `.agent/PROJECT_STATE.md`. Không có `web/` diff, mutation/UI/schema/dependency thay đổi hoặc kiểm thử nghiệm thu FC5. MUST / MUST NOT dưới đây là yêu cầu cho implementation sau khi contract được duyệt và merge; không mô tả chúng là behavior đã có trên base.

## 1. Authority và phạm vi

[FC0](../architecture/fc0-functional-contract.md), đặc biệt điều 7/8/9/12, là authority nghiệp vụ cao nhất. Contract này cụ thể hóa task người dùng, giữ [FC2 service contract](FC2-SLICE-1.md), [FC2 UI](FC2-SLICE-2.md), [FC2 Final Acceptance](FC2-FINAL-ACCEPTANCE.md), [FC3 contract](FC3-FUNCTIONAL-CONTRACT.md)/[Final Acceptance](FC3-FINAL-ACCEPTANCE.md) và [FC4 contract](FC4-FUNCTIONAL-CONTRACT.md)/[Final Acceptance](FC4-FINAL-ACCEPTANCE.md). FC0–FC4 DONE / CLOSED trên base; các trạng thái trong báo cáo slice cũ là snapshot lịch sử, không thay baseline này.

FC5 khóa xuất một phần, xuất đủ và dừng toàn bộ phần còn lại. Shipment `completed` chỉ ghi nhận cây bốc lên xe/rời vườn theo workflow hiện có. Với external source, không suy luận cây đã nhập kho mình, supplier inventory hoặc khách đã nhận. Mixed shipment chỉ own lines trừ own living/ready; giữ correction đã nghiệm thu ở PR #25.

## 2. Đại lượng và terminal-state truth table

| Ký hiệu | Authority |
| --- | --- |
| R | `order.requestedQuantity`, số nguyên an toàn dương |
| S | Tổng `shippedQuantity` của mọi completed shipment thuộc đơn; planned/cancelled không tính |
| Q / F của source | `quantity` / `fulfilledQuantity`; Q > 0, 0 ≤ F ≤ Q; giữ legacy default theo model hiện có |
| O của source | Canonical `remainingReservationQuantity`: active = Q − F; fulfilled/released = 0 |
| O của đơn | Tổng O của active reservations thuộc đơn, gồm own/external |
| C | `reservedQuantityForOrder`: active/fulfilled đóng góp Q; released đóng góp F |
| P | Tổng planned quantity của đơn; per-source planned allocations vẫn phải kiểm mọi line/chuyến khi cần validation |

Tất cả quantities, sums và deltas MUST là số nguyên an toàn hữu hạn, không âm; input/state không hợp lệ không được clamp để mutation pass. Helper max(...,0) không thay validation corruption.

| State | Canonical facts | Terminal | Còn phải xuất actionable | Nguồn/chuyến sau terminal |
| --- | --- | --- | ---: | --- |
| open / partially_reserved / reserved | S = 0, status theo coverage hiện có | Không | R | Theo workflow FC2/FC3/FC4 |
| partially_shipped | 0 < S < R, chưa đóng phần còn lại | Không | R − S | Có thể giữ bổ sung, Trigger B hợp lệ, lập/xác nhận chuyến tiếp |
| cancelled | S = 0, không có fulfillment/completed evidence mâu thuẫn | Có | 0 | O = 0, không planned; giữ history |
| shipped | S = R, completed/fulfillment facts hợp lệ | Có | 0 | O = 0, không planned |
| closed_remaining | 0 < S < R, đã xác nhận dừng toàn bộ phần còn lại | Có | 0 | O = 0, không planned; giữ Q/F/completed history |
| Invalid/corrupt | S > R hoặc quantities/status/history mâu thuẫn | Không dùng để suy diễn success | Không cấp quyền action | INVALID_STATE; không normalize thành shipped |

Ba terminal outcomes loại trừ nhau. Không reopen, xóa đơn terminal hoặc thêm Undo riêng trong FC5. Stored status MUST NOT là authority duy nhất để validate close/corruption; evidence completed/F phải được kiểm dù status stale. S=R MUST có canonical presentation `Đã xuất đủ`, không `Đã dừng 0 còn lại`.

## 3. Historical remaining, stopped, release và shortage

- Historical unfulfilled = max(R − S, 0); trên `closed_remaining` đây là **số đã dừng**, không phải nhu cầu còn actionable.
- Actionable remaining-to-ship = max(R − S, 0) cho active order hợp lệ; **0 cho cancelled/shipped/closed_remaining**.
- `stoppedQuantity = R − S` tại commit closure; `releasedOutstanding = O_before`; hai số MUST NOT bị đánh đồng.
- Operational `orderShortage()` = 0 cho terminal order. Raw historical uncovered demand R − C, nếu cần giải thích lịch sử, phải có nhãn riêng; không đưa nó vào Today/action queues. Canonical historical coverage vẫn tính bằng source facts, không sửa C thành R để giả đủ nguồn.
- Không dùng một helper không biết trạng thái làm cả historical và actionable remaining. Có thể giữ helper historical hiện có và thêm helper nhận order/status cho actionable; mọi caller phải dùng đúng nghĩa.

Required fixture, đã có planned5k nằm trong O12k (không cộng P thêm vào O):

```text
R50.000 / S20.000 / O12.000 / planned5.000 (1 chuyến)
→ status closed_remaining
→ R50.000 và S20.000 giữ nguyên
→ stopped30.000; releasedOutstanding12.000
→ planned shipment cancelled; O0; physical stock không đổi
→ display: Đã xuất 20.000 / 50.000 · Đã dừng 30.000 còn lại
```

Required no-active-source case: R50k/S20k/O0/planned0, completed/F history consistent → close PASS, stopped30k/released0. Closure không yêu cầu còn source active hoặc phải đang giữ đủ phần còn lại. R50k/S50k → không close, `Đã xuất đủ`.

Nhả own source làm availability **được tính lại** theo current ready và các O còn lại của lô; không cam kết availability tăng đúng O khi lô đang thiếu cây đã giữ. Living/ready không tăng. External release không thay own availability/stock.

## 4. Preconditions và history verification

Close chỉ hợp lệ khi actual `0 < S < R`, order chưa terminal và source/shipment/reference facts consistent. Status stale không được cho phép vượt guard, cũng không được sửa ngầm history/requested để closure pass.

| Current facts | Close result |
| --- | --- |
| S = 0 | Reject; dùng HỦY ĐƠN FC2 nếu state hợp lệ |
| S = R | Reject close, không write; completion path/read model phải dùng shipped theo facts hợp lệ |
| S > R, unsafe totals, F/Q/reference/source/line mismatch | INVALID_STATE, không write |
| cancelled / shipped / closed_remaining | Không tạo closure mới; exact committed operation retry là ngoại lệ idempotent ở §7 |
| Stored partially_shipped nhưng completed/F không reconcile được | INVALID_STATE, không lấy stored status để giả S |
| Completed legacy thiếu lines/facts cần chứng minh F và coverage | INVALID_STATE cho close; không fabricate F, synthesize lines hoặc mutate requested |

MUST xác minh tổng completed lines theo từng reservation bằng F, identity/source/order metadata của lines đúng source, totals bằng shipment quantities và `S = sum(F của sources thuộc đơn)` khi thực hiện close mới. Active có F < Q; fulfilled có F = Q; released giữ F và O0. C ≤ R. Planned facts/allocations phải hợp lệ trước cascade; không giả legacy allocation không xác minh được thành P0. Không repair legacy trong close; lỗi chỉ rõ record/chuyến cần xem, người dùng có thể dùng action hợp lệ hiện có rồi preview lại.

Restore legacy hợp lệ là policy riêng ở §10: import được không đồng nghĩa legacy đủ bằng chứng để thực hiện close mới.

## 5. Atomic close effects

Future preview/confirm service đọc consistent state; confirm MUST thực hiện trong một outer Dexie rw transaction bao phủ orders/reservations/shipments/events và source/contact facts cần re-read. Scope đọc batch không cấp quyền write batch. Caller intent được capture trước await để không đổi giữa operation.

```text
lookup operation registry / exact retry
→ re-read current order + all related sources/shipments/history/source facts
→ fingerprint + validation toàn cascade
→ cancel all planned shipments + release all active outstanding sources
→ set order.status = closed_remaining
→ append source/plan/order events + operation marker
→ commit
```

Toàn cascade MUST được validate trước write; mọi storage/event failure rollback toàn bộ. Không gọi các mutation public qua nhiều transaction để giả atomic. Planned-allocation guard của release riêng/FC3 không bị nới; closure có quyền cancel các plans trong chính cascade đã được preview, rồi release O. Nếu reuse service, phải join transaction và không recompute status làm hồi sinh đơn.

- Với từng active source O>0: giữ ID/source/order/createdAt/Q/F, đổi `status=released`; không Q=F/Q0/F=Q, fake fulfilled hoặc delete. Fulfilled/released records trước đó giữ nguyên.
- Mọi planned shipment: status=cancelled, giữ ID/lines/plannedQuantity/dates/notes/history; không resize/reassign/delete hoặc convert completed.
- Completed shipments, lines, shippedQuantity, shippedAt và physical-stock effects immutable.
- Order requested/variety/date/price/note giữ nguyên; không ordinary correction hoặc metadata draft write kèm close.
- Batch objects không được write. Other orders/sources/plans không đổi.
- Post-state: O0, planned0; canonical `reservedQuantityForOrder() == S` vì còn fulfilled Q=F/released F. Không reconcile được equality thì reject trước commit.

Event/transaction success mới được clear stale Undo banner và reload UI authority; không success giả khi storage rollback.

## 6. Preview, fingerprint và stale confirmation

Preview MUST có order ID/customer context/status/metadata, R/S/stopped; toàn source ID/source label/Q/F/O/status và lượng sẽ nhả; toàn planned ID/quantity/date/lines; completed facts, relevant order/history IDs và affected source facts cần để trình bày tác động. UI không bắt người dùng hiểu reservation/fingerprint/transaction.

Fingerprint MUST bind order identity/status/R/customer/variety/date/price/note; tập reservations (thêm/xóa/sửa Q/F/status/source), toàn planned/completed shipments/lines/quantities/status/date, relevant order history IDs và source contacts/facts hiện lên preview. Khi preview own availability/shortage, bind batch inventory, các commitments khác trên cùng batch và relevant batch history; không lấy snapshot availability cũ để hứa effect mới.

Thay đổi bất kỳ facts được xác nhận → **PREVIEW_CHANGED**, zero writes; discard old preview, refresh current facts và cần click confirm mới. Không auto-commit, auto-clamp hoặc dùng last intentional edit wins FC2. Nếu facts mới đã terminal/invalid, UI bỏ close action và giải thích, không fabricate preview.

| Interleaving | Required result |
| --- | --- |
| Confirm shipment wins sau preview | Closure stale; S/stopped/O/planned được refresh, không rollback shipment |
| Close wins | Stale planned confirm reject terminal/cancelled plan, không stock write |
| Reserve / release / Trigger B wins | Close re-read, PREVIEW_CHANGED; không nhả theo snapshot cũ |
| Close wins trước reserve/release/Trigger A/B mới | Explicit terminal rejection, không resurrect hoặc write history |
| Trigger A từ snapshot trước shipment | Vẫn giữ FC0/FC2 before-shipment guard; không nới để tạo race giả hợp lệ trên partial order |

Operation commit trước là authority; operation khác phải re-read/revalidate. Nếu Trigger B nhiều đơn có một affected order terminal, reject **toàn kế hoạch**; không silently skip order đó và commit phần còn lại. Storage failure giữ nguyên intent/fingerprint/operationId để retry; facts đổi thì phải refresh/reconfirm với identity mới.

## 7. Idempotency và collision hai chiều

Confirm MUST có `operationId` không rỗng và expected fingerprint. Canonical closure intent khóa **action=close_remaining + orderId + approved fingerprint**; không có user-selected release subset vì close nhả toàn bộ O. Same-ID retry MUST giữ đúng original canonical intent, không ghép ID cũ với preview mới. OperationId không bị coi là đã dùng nếu transaction rollback.

Registry dùng events hiện có, gồm **order_reconciled / batch_reconciled / order_closed_remaining**; không thêm bảng hoặc generic operation engine. Cả FC5 lookup và **FC3 Trigger A/B lookup** MUST đọc đủ ba marker types trong commit transaction:

- Same ID + đúng type/entity/intent → trả historical committed projection, không release/cancel/history lần hai, kể cả reload/restore hoặc current source/batch facts đổi sau đó.
- Same ID + khác action/order/fingerprint/intent → OPERATION_ID_CONFLICT, zero writes. A→FC5, B→FC5, FC5→A/B đều bị chặn.
- Không chỉ query marker của FC5 hoặc chỉ harden một chiều. Không thay canonical intent/idempotent result của FC3 operations đã có.
- Duplicate concurrent close submit → một marker/cascade; duplicate marker IDs hoặc FC5 marker hỏng/không xác minh được → INVALID_STATE, không replay writes.
- New FC5 historical projection phải validate safe quantities, R/S/stopped relation, release Q/F/O/status relations và referenced IDs trước trả retry. Không mở deep-validation refactor cho marker FC3 cũ; NOTE đó vẫn deferred.

Marker lookup cho exact retry xảy ra trước current-state terminal/fingerprint check; otherwise một retry hợp lệ sẽ bị status closed_remaining của chính operation chặn. Historical result không trở thành current authority để overwrite DB/UI.

## 8. History, persistence và Undo

Preferred required marker/event: `order_closed_remaining`, entityType=order, entityId=orderId. Payload giữ `operationId`, `intentKey`, approved fingerprint, requestedQuantity/shippedQuantity/stoppedQuantity, order before/after status, từng released source ID/source/Q/F/O before/status before-after/releasedOutstanding, cancelled planned IDs/quantities và historical projection đủ để retry. Dùng createdAt của event; không thêm closure entity hoặc event sourcing.

Source/plan events phải liên kết cùng operation/order, own batch timeline truy được release; supplier release không ghi own stock claim. New release events tiếp tục giữ `quantity=Q`, `releasedQuantity=O`, `fulfilledQuantity=F` tương thích PR #25. Existing history không rewrite.

```text
Đã dừng phần còn lại của đơn.
Đã xuất 20.000 / 50.000 cây; dừng 30.000 cây còn lại.
Đã nhả 7.000 cây chưa xuất do dừng phần còn lại của đơn.
Đã hủy chuyến chờ xuất do dừng phần còn lại của đơn.
```

State authority vẫn là orders/reservations/shipments; events là append-only history/idempotency evidence, không replay state. Không có Undo close/reopen. Old create-order/create-reservation/source Undo MUST re-read terminal state/history và reject nếu có thể xóa/nhả lại/phục hồi active lifecycle; clear banner sau successful commit không thay guard trong transaction. Không chặn mọi thao tác inventory độc lập chỉ vì một lô từng cấp cây cho terminal order: chúng tiếp tục theo FC1 guards.

## 9. Terminal service/helpers và completion-path gates

`closed_remaining` MUST reject **new** reserveOwnBatch/reserveExternalSupplier, release/rewrite commitment, updateOrder/cancelOrder, Trigger A và Trigger B affecting order, createShipment và confirm stale planned shipment. Explicit guard trong service/domain, không dựa tình cờ vào history/current shortage/O0. UI hide CTA không thay service guard. `cancelShipment()` chỉ có thể no-write retry một plan đã cancelled; không sửa completed/closed lifecycle. Retry completed shipment/cancelled order/plans đã commit và FC3 operations cũ vẫn có thể trả kết quả idempotent không write; không gọi chúng là mutation mới.

FC2 whole cancellation tiếp tục chỉ S0 và không contradictory F/completed evidence, dù status stale. Sau shipment history ordinary correction vẫn bị khóa; post-terminal metadata edit nằm ngoài FC5.

**FC5-1 MUST audit completion transaction:** guard existing S/current coverage/F/allocations và prospective shipped total trước stock write. S_after=R chính xác mới shipped; S_after>R hoặc terminal inconsistency → INVALID_STATE, rollback. Không dùng >=R để normalize corruption. Xuất đủ phải để O0/planned0; không tự release extra commitments hoặc auto-repair lịch sử để đạt invariant. Current intended valid coverage≤R + exact F/line integrity phải chứng minh post-state; regressions phải kiểm thay vì chỉ assert stored status.

| Helper / read model | Required semantics |
| --- | --- |
| OrderStatus / OrderDisplayStatusKind | Thêm closed_remaining; terminal display không rơi vào partial branch vì S>0 |
| deriveOrderDisplayStatus | closed display R/S/stopped; shipped exact S=R; không gọi overship là shipped; không label Đã giao |
| orderShortage | Terminal=0 operational; raw historical coverage giữ canonical |
| filterOrders | Closed không action_needed/ready_pickup/shipped-full tab; vẫn All/Detail/history, không biến partial closure thành xuất đủ |
| shippedQuantityForOrder | Chỉ completed; không cộng planned/cancelled hoặc stopped vào S |
| remainingToShipForOrder / callers | Tách historical vs actionable theo §3; không xóa stopped30k chỉ để queue về0 |
| hasOrderShipmentHistory / validateOrderChanges / validateOrderCancellation | Giữ actual F/completed/stale-status protection; explicit terminal block |
| Today/order/reservation/shipment read models | Loại closed khỏi active queues và eligibility; lịch sử cancelled plans/completed shipments vẫn xem được |

## 10. Backup và persisted-versioning decision

**Quyết định cho FC5 implementation: giữ Dexie schema version5 và BACKUP_FORMAT_VERSION=1; không shape migration.** Audit base cho thấy OrderStatus là string field trong record/index hiện có, events type:string/payload:unknown; không thêm field/table/index. Backup V1 hiện giữ nguyên order/events shape và explicit status whitelist. Repository không có policy buộc format bump chỉ vì thêm enum; old validator reject unknown status trước full-replace transaction.

| Writer / reader | Policy |
| --- | --- |
| Pre-FC5 V1/legacy backup → FC5 app | Giữ normalizer/defaults và restore hợp lệ như hiện tại; không mass-migrate/infer partial→closed, không buộc old records có closure marker |
| FC5 V1 backup có closed_remaining → FC5 app | Whitelist mới + closed cross-entity invariants; atomic round-trip/reopen giữ status/Q/F/stock/history/operation retry |
| FC5 backup có closed_remaining → pre-FC5 app | **Không hỗ trợ downlevel restore**: old whitelist reject unknown status; không strip/map thành partial/cancelled/shipped để tương thích giả |
| Cùng format nhưng unknown status / future format version | Reject trước DB mutation; không infer semantics từ string |

Policy forward/backward compatibility nêu trên là quyết định contract, không để implementation tự bump version. Nếu sau này có shape/index/compatibility requirement khác, phải review amendment trước thay policy; không đổi version ngầm trong FC5-1.

New `closed_remaining` backup MUST verify 0<S<R, O0/no planned, Q>0/0≤F≤Q/status/ref integrity, completed↔F consistent, C=S, immutable requested/history facts được bảo toàn. Khi có closure marker, R/S/stopped/projection phải consistent với closed order/history; new successful close MUST export marker/history để exact retry sau restore hoạt động. Không yêu cầu marker FC5 cho old non-closed records.

Reject closed+S0, closed+S≥R, active O, planned shipment, F/completed mismatch, invalid source/ref/status/Q hoặc corrupted quantities; preserve current workspace khi restore reject. Shipped terminal validation MUST kiểm S=R/O0/no planned; cancelled MUST kiểm S0/no fulfillment/O0/no planned. Không lấy stored status để bypass corruption. Valid legacy thiếu detail đã được hỗ trợ tiếp tục import theo existing compatibility; thiếu detail không cấp phép close mới ở §4. Không broaden exception để cho fabricated new closed state qua validator.

Giữ existing guards ready≤living≤initial, coverage≤requested, planned allocation integrity, supplier roles/reference, external truthfulness; **own outstanding>ready vẫn là shortage hợp lệ FC0/FC3 trên active orders**, không auto-repair/clamp. Backup không tăng ready/giảm Q/F, viết lines giả hoặc rewrite events. No-lines legacy history vẫn xem được theo informational fail-closed behavior của FC4.

## 11. Exact-base source audit và required implementation surface

Anchors dưới đây thuộc base0647bfb, là source inspection, không phải tests FC5 đã PASS.

| Surface hiện có | Base facts / required gate |
| --- | --- |
| web/src/domain/order.ts:4,63,80,92,130 | Enum chưa closed; shortage chỉ loại shipped/cancelled; display shipped dùng stored status hoặc ≥R, labels Đã giao; filters chưa closed. Update theo §2/§3/§9 |
| web/src/domain/shipment.ts — remainingToShipForOrder | Chỉ nhận requested/id/shipments nên không biết terminal; giữ historical math và thêm/rework actionable caller rõ nghĩa |
| web/src/domain/orderLifecycle.ts:23,32,89; web/src/services/orderService.ts — update/cancel | History guards FC2 và atomic cancel đã có; audit explicit new terminal, duplicate retry, giữ requested/metadata |
| web/src/services/reservationService.ts:193,343,498 | Creation/release status guards chỉ shipped/cancelled; audit all new writes/recompute để không hồi sinh closed; preserve canonical released-F coverage và release Q/O/F event facts |
| web/src/services/shipmentService.ts:96,287,325,429,571 | Create guards chỉ shipped/cancelled; confirm completed retry trước order read, current order read chưa explicit terminal check; total overship precheck có nhưng status assignment dùng ≥R. Audit full completion integrity và all entry/eligibility paths, không giả precheck hiện có đã chứng minh mọi terminal invariant |
| web/src/domain/reconciliation.ts:171; batchReconciliation.ts:125–128 | Existing allowed-state/history checks có thể reject enum mới tình cờ; add explicit terminal handling, whole-plan guard Trigger B và preview/confirm tests |
| web/src/services/reconciliationService.ts:79; batchReconciliationService.ts:69 | Registry chỉ query order_reconciled/batch_reconciled. **MUST add order_closed_remaining ở cả hai chiều**, giữ old committed retry semantics |
| web/src/services/undoService.ts:247–255,294–304 | Create-order history/status và create-reservation expected-state guard đã harden; thêm explicit closed protection, không dựa chỉ clear banner |
| web/src/data/backup/backup.validate.ts:27,279,498,586 | Whitelist chưa closed; completed/F reconciliation còn legacy detail behavior; total shipped guard hiện chủ yếu ≤R. Thêm closed/terminal cross-entity validation, giữ valid legacy compatibility |
| web/src/data/db.ts:79; backup/backup.types.ts:12; backup.restore.ts | Latest Dexie5, backupV1; parse/validate trước atomic full-replace. Giữ version/shape theo §10, không đổi policy để export được mà restore unsafe |
| OrderDetail/OrderReserve/ShipmentNew + shipment service read models | Eligibility/CTA và remaining fields chưa hiểu closed; direct route cũng phải reject terminal, không chỉ hide CTA |
| TodayScreen.tsx:96,135–140; OrdersScreen; ShipmentsScreen | Active queues/filter/vocabulary cần audit; closed vẫn truy cập All/Detail/history |
| analytics/events.ts + timeline renderers | Event type:string/payload:unknown hỗ trợ marker mới không bảng mới; existing messages không rewrite, new rendering/copy theo §12 |

Mandatory audit functions: reserveOwnBatch, reserveExternalSupplier, releaseReservation, updateOrder, cancelOrder, preview/confirm Trigger A/B, createShipment, confirmShipment, cancelShipment (relevant no-write retries), Undo, backup parse/validate/export/restore và mọi service/helper caller nói trên. Search cả status==='shipped'/'cancelled' và allowlists/derived branches; thêm enum cho compile xanh không đủ.

## 12. UI vocabulary và closed read-model contract

| Context | Required wording |
| --- | --- |
| planned | Chờ xuất / Chuyến chờ xuất |
| shipment completed | Đã xuất cây; cây đã bốc lên xe/rời vườn |
| partially_shipped | Đã xuất một phần hoặc Đã xuất X / R |
| shipped | Đã xuất đủ |
| closed_remaining | Đã xuất X / R · Đã dừng Z còn lại |
| action | DỪNG PHẦN CÒN LẠI / XÁC NHẬN XUẤT CÂY |
| shipment navigation | Chuyến xuất cây, không Chuyến giao khi chỉ biết export |

MUST NOT dùng Đã giao/Giao một phần/Giao đủ/Chuyến giao để claim receipt/delivery. Không rename internal Shipment/shipmentService/shippedQuantity/file names. Existing stored event wording giữ nguyên; nếu renderer có structured facts thì trình bày đúng nghĩa, không sửa payload cũ hoặc fabricate receipt evidence.

FC5-2 audit Order Detail, Orders list/badges, Today, shipment list/detail/create/confirm, success/error messages và history rendering. Preview nêu R/S/stopped, source O sẽ nhả, plans sẽ hủy, physical stock/completed history không đổi. No auto-confirm hoặc stale quantities trong success. Sau success reload DB. Closed không source/ship/reconcile/edit/cancel CTA, không cần giữ thêm nguồn/sẵn sàng xuất/chuyến cần xử lý; vẫn xem được All orders/Detail/history/backup. Không redesign hoặc styling sweep.

## 13. Required future acceptance matrix

Các gate này **chưa chạy như FC5 acceptance**. Domain assertions + real Dexie mutations/rollback/races/restore bắt buộc; mock UI text không thay transactional evidence. UI/browser gates thuộc FC5-2/3/Final Acceptance.

| Scenario | Expected bắt buộc |
| --- | --- |
| R50k/S20k/O12k/planned5k → close | Closed/R50/S20/stopped30/released12/O0/plan cancelled; physical objects byte-for-byte không đổi |
| R50k/S20k/O0/planned0, consistent F/history | PASS close, stopped30/released0; không yêu cầu nguồn active |
| Own Q12/F5/O7; external tương tự; mixed nguồn | Release từng O chính xác, Q/F/IDs/history giữ; external không tác động own stock |
| Own batch đang commitment shortage, close | Nhả O/tính lại availability trung thực; không claim physical hoặc available +O chắc chắn; other orders không đổi |
| Fulfilled/released sources trước close | Không mutate/nhả lại; coverage sau chỉ F, C=S |
| Planned shipment(s) exists | Cancel mọi planned atomically, giữ ID/lines/quantity/date/note; không cần user hủy riêng để cascade hợp lệ |
| S0 / S=R / S>R / stale terminal status | Reject close đúng lý do; no writes/normalization; shipped không bằng closed0 |
| Legacy completed thiếu proof, F/lines/ref/status mismatch | INVALID_STATE/no writes, không guess/repair; valid legacy restore vẫn theo §10 |
| Confirm wins first; Close wins first | Case đầu PREVIEW_CHANGED/reconfirm; case sau confirm reject/no stock write; kiểm cả hai thứ tự bằng real Dexie |
| Reserve/release/Trigger A/B ↔ close | Re-read authority, guard explicit, no resurrection; Trigger A không bypass before-shipment; B đa đơn failure rollback mọi affected order |
| Order metadata/source/contact/batch/other commitments/planned/completed/history đổi sau preview | Fingerprint stale, zero writes, facts refresh, cần click confirm mới |
| Duplicate concurrent submit, same-ID reload retry | Một cascade/marker/source/plan history; historical projection returned, không rewrite current state |
| A→close, B→close, close→A, close→B ID collisions, khác order/fingerprint | OPERATION_ID_CONFLICT cả hai chiều; no partial writes; FC3 exact historical retries giữ behavior |
| FC5 marker invalid/duplicate/corrupt projection | INVALID_STATE, không replay/return fabricated success |
| Failure source/order/plan/marker/event writes | Rollback toàn transaction; intent giữ để retry, không Undo/success giả |
| Capture old Undo → real close → invoke stale Undo | Reject/no deletion/re-release/resurrection/stock change; không chỉ test banner cleared |
| Multi-shipment own/external/mixed xuất đủ | S=R → shipped/O0/planned0; exact retry không stock double deduction; overship/inconsistent terminal fail before stock writes |
| FC2 cancel/edit và FC3/FC4 regressions | Before-shipment behavior/variety lock/intentional metadata guards/canonical released-F/partial shortage/transfer/confirmation giữ đúng |
| New closure → export/restore/reopen → same-ID retry | Status/Q/F/stock/history/marker preserved, historical idempotent result; no new cascade |
| Closed backup S0/S≥R/O>0/planned/F mismatch; shipped wrong S; cancelled fulfillment | Reject corruption trước full-replace; workspace giữ nguyên |
| Legacy V1/pre-P5 backup; FC5 unknown status/downlevel backup | Valid old import unchanged; no infer partial→closed; old app reject new enum/no-write |
| Direct routes + Today/All/detail/history/queues | Closed không actionable; history visible, không falsely shipped-full |
| UI terminology + 360/390/430/1280 + height400 simulation | Đọc/bấm/scroll/confirm/back/error được, no overflow; không delivery claim hoặc UI overhaul |

## 14. Slice roadmap và closure gate

| Slice | Scope | Trạng thái task FC5-0 |
| --- | --- | --- |
| FC5-0 | Contract docs-only, exact-base audit và review | APPROVED / CLOSED; PR #27 merged, merge-CI SUCCESS |
| FC5-1 | Atomic Close Remaining domain/service + all terminal guards + completion/backup/Undo/idempotency correctness | NOT STARTED; chỉ sau contract được duyệt/merge/merge-CI xanh |
| FC5-2 | UI + completion vocabulary theo contract, không redesign | NOT STARTED |
| FC5-3 | Cross-flow hardening / real-service races / UI integration | NOT STARTED; correctness regressions FC5-1 không được hoãn đến slice này |
| FC5 Final Acceptance | Clean main sau reviewed/merged slices + merge-CI xanh | NOT STARTED |

Final Acceptance trên main MUST chạy create→reserve→partial ship→close→reload→terminal guards/history/stock, và nhánh multiple shipments→shipped full, own/external/mixed, stale preview, backup/restore/reopen. Browser360/390/430/1280; full typecheck, lint0/0, tests, build xanh. Chỉ FC5 DONE khi không BLOCKER/HIGH hoặc lifecycle dead-end trong scope; CI docs xanh không phải feature acceptance.

## 15. Out-of-scope, deferred và handoff

Không web/schema/dependency diff trong FC5-0. Không FC6 implementation, backend/cloud/sync/auth, marketplace/generic-product refactor, supplier→nursery receipt, customer_received/delivered/receiver signature/proof of delivery, delivery/driver tracking, payment/accounting, logistics topology, external transfer, shipment-line edit hoặc completed-shipment correction, reopen/Undo close, post-terminal metadata editing, toàn-app redesign/UI-R03/R04/R05.

Physical phone IME, installed-PWA offline thực tế và field pilot **chưa kiểm chứng**, đưa sang kế hoạch FC6, không claim PASS. FC3 stable order differentiator và deep old-marker validation NOTE giữ deferred; FC5 collision registry update và new-marker validation ở §7 vẫn required, không dùng deferred để bỏ gate mới.

Handoff FC5-0 gồm exact head/PR/two changed files/full CI, truth table, stopped≠released, post-closure invariants, collision hai chiều, version policy, source/service/helper audit, backup/vocabulary/out-of-scope và xác nhận no web diff. Người dùng đã duyệt contract, PR #27 đã merge và merge-CI SUCCESS; gate closure đạt. **FC5-0 CLOSED / FC5-1 NEXT — Atomic Close Remaining domain/service + terminal guards/backup/Undo correctness. FC5 implementation NOT STARTED / FC5 overall NOT DONE.**
