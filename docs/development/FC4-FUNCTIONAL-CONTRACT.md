# FC4 — External Supply Truthfulness Contract

**Dự án:** Vườn Ươm — Sổ cây giống trên điện thoại

**Repository:** `17thedevv/VuonUomSo`

**Exact base đã audit:** `main = 86f513c7ce8a8f7c95ef85099872b91b2d6cb64d`

**Ngày:** 08/10/2026

**Trạng thái:** **FC4-0 APPROVED / CLOSED — FC4-1 NEXT / FC4 implementation NOT STARTED**

FC0/FC1/FC2/FC3 đã DONE. Tài liệu này khóa functional contract và scope FC4 đã được người dùng duyệt; không xác nhận implementation đã đáp ứng các điều khoản dưới đây. PR FC4-0 chỉ đổi tài liệu, không đổi `web/`, schema, dependency hoặc semantics FC0/FC2/FC3. Contract đã đạt approval, merge và CI merge xanh theo evidence ở §12; closure contract không phải FC4 DONE. FC4-1 là task implementation tiếp theo, chưa bắt đầu trong closure này.

## 1. Product truth và authority

Vườn Ươm **không biết tồn cây thời gian thực của nhà vườn ngoài**. App chỉ ghi rằng người dùng đã xác nhận ngoài app một cam kết giữ cây cho một đơn.

```text
Supplier contact ≠ supplier inventory
User-confirmed external commitment ≠ verified supplier stock database
```

Các từ MUST / MUST NOT trong tài liệu là yêu cầu bắt buộc cho implementation sau này. Nguồn chuẩn là [FC0](../architecture/fc0-functional-contract.md), đặc biệt điều khoản 10, cùng [FC3](FC3-FUNCTIONAL-CONTRACT.md). Không sử dụng catalog demo, tên liên hệ hay số đã giữ để suy luận supplier còn bao nhiêu cây hoặc luôn có giống nào. Việc người dùng xác nhận là thông tin họ cung cấp, không phải bằng chứng hệ thống đã kiểm kho hay liên lạc với supplier.

## 2. Audit exact base: đường đi hiện tại và required changes

Các anchor dưới đây thuộc exact base nêu trên. Đây là audit source, chưa phải browser acceptance FC4.

| Code path trên base | Sự thật hiện tại | Gate implementation FC4 |
| :--- | :--- | :--- |
| `web/src/data/demo/supplierCatalog.ts` | Catalog demo có `estimatedQuantity` theo tên supplier/giống | Không cấp số cho workflow giữ nguồn, inventory claim hoặc validation production |
| `web/src/services/reservationService.ts:110–129` — `getReservationOptions()` | Liên hệ role supplier được map sang catalog; không match thì fallback `30000`; `variety` lấy từ order | Trả contact/context đơn, bỏ estimate/fallback khỏi candidate production; không giả supplier inventory by variety |
| `web/src/domain/reservation.ts:62–69` — `ExternalSupplierCandidate` | Candidate đang mang `estimatedQuantity` | Candidate production không mang một số stock/availability supplier giả |
| `web/src/features/orders/OrderReserveScreen.tsx:406–436` | Card ghi “Số lượng tham khảo”, “Có khoảng X cây” | Bỏ inventory claim; trình bày contact, giống của đơn và cam kết đã ghi với nhãn đúng nghĩa |
| `web/src/features/orders/ReserveQuantityModal.tsx:55–59,83–89,204–207` | External default = min(estimate, shortage); estimate là “Tham khảo nguồn”. `isOverBatch` chỉ áp dụng own batch | External mở trống; không estimate reference. **Base không hard-cap external theo estimate**; không mô tả nhầm rằng service hiện có cap này |
| `web/src/features/orders/ReserveQuantityModal.tsx:100–105,138–142,240` | “Giữ đủ đơn” lấy shortage điền form; submit external chỉ truyền order/supplier/quantity, không có acknowledgement riêng | Shortage là nhu cầu của đơn, không phải số supplier đã xác nhận; không tự dùng nó làm confirmed value. Thêm acknowledgement chủ động theo §4 |
| `web/src/services/reservationService.ts:344–446` — `reserveExternalSupplier()` | Transaction re-read order/supplier/role/quantity/shortage rồi write reservation/order/event, capture Undo snapshot; không đọc catalog để kiểm stock | Giữ atomicity, role/status và Undo guards; thêm confirmation intent; dùng coverage chuẩn, không thêm supplier stock check |
| `web/src/services/reservationService.ts:235–239,262` — `reserveOwnBatch()` so với `web/src/domain/order.ts:60–77` | Own creation chỉ cộng Q active/fulfilled, bỏ F của released khi tính current coverage/shortage và status recompute; có thể over-cover dù batch availability đủ | **Required correctness gate:** own creation MUST dùng canonical coverage, gồm released F; giữ batch availability/variety guards và regression riêng |
| `web/src/services/reservationService.ts:376–380,403` — `reserveExternalSupplier()` so với `web/src/domain/order.ts:60–77` | External creation có cùng lỗi bỏ released F; domain helper/backup vẫn tính released coverage = F | **Required correctness gate:** external creation MUST dùng cùng canonical coverage; giữ supplier/confirmation guards và regression riêng |
| `web/src/services/contactService.ts` và `web/src/features/orders/ContactQuickCreateModal.tsx:36–40` | Service nhận roles, default customer; modal hiện tại dùng customer flow, không truyền supplier role | Thêm/chọn nhà vườn thật với role supplier; không tái sử dụng default customer như supplier hợp lệ |
| `web/src/services/shipmentService.ts` — `confirmShipment()` | Own lines giảm living/ready; external lines tăng F, không write own stock | Giữ nguyên; external completion không phải nhập kho mình |
| `web/src/data/backup/backup.validate.ts:292–370` | Kiểm Q/F/status, supplier reference/role và coverage; released F vẫn được tính | Giữ integrity/compatibility; không thêm supplier inventory hay historical acknowledgement requirement |

Quyết định: **bỏ `estimatedQuantity` khỏi user-facing production workflow và mọi quyết định giữ nguồn**. Catalog có thể giữ ở demo/seed nếu hoàn toàn tách khỏi candidate, UI và mutation production; có thể xóa nếu không còn dùng. MUST NOT giữ fallback 30.000. Task FC4-0 không thực hiện các thay đổi code này.

## 3. Model và các đại lượng

FC4 tiếp tục dùng `Reservation` hiện có:

```text
sourceType = external_supplier
supplierId
orderId
quantity = Q
fulfilledQuantity = F (legacy thiếu field: F = 0 theo model hiện tại)
status = active | fulfilled | released
createdAt
```

Q là cam kết đã được ghi cho đơn theo lifecycle hiện có, **không phải tồn kho supplier**. Sau correction, Q/F/status mang semantics FC3; creation/correction events giữ lịch sử, không giả Q hiện tại luôn bằng số ghi ban đầu.

| Đại lượng | Authority / nghĩa |
| :--- | :--- |
| F — Đã xuất | `fulfilledQuantityForReservation`; phần đã xuất theo completed shipment, không được sửa bằng release/reconciliation |
| O — Đang giữ | `remainingReservationQuantity`: active = max(Q − F, 0); fulfilled/released = 0 |
| Coverage của một nguồn | `coveredQuantityForReservation`: active/fulfilled = Q; released = F |
| Coverage của đơn | `reservedQuantityForOrder`: cộng coverage **mọi nguồn**, own và external |
| Thiếu nguồn của đơn | `orderShortage`: max(requested − coverage, 0) trên đơn còn mở; không đồng nghĩa “Còn phải xuất” |
| Còn phải xuất | max(requested − tổng completed shipment, 0) theo semantics hiện tại |
| Cây còn bán của lô mình | max(ready − own-batch outstanding, 0); external commitment không tham gia |

Q MUST là số nguyên dương; `0 <= F <= Q`; active có F < Q, fulfilled có F = Q; released giữ record, O = 0 và coverage = F. Không tạo `ExternalCommitment` entity, supplier inventory ledger, `supplierAvailableQuantity` hoặc schema mới chỉ để biểu diễn xác nhận ngoài app.

Ví dụ supplier đã giữ 10.000 cây cho A và 5.000 cho B: app biết cam kết đã ghi. Nếu chưa xuất, có thể hiển thị “Đang giữ 15.000 cây qua 2 đơn”. Nếu một phần đã xuất, số **Đang giữ** MUST cộng O; số **Đã xuất** dùng F. Không lấy 15.000 trừ catalog để báo supplier “còn bán”. Coverage được ghi không phải bảo đảm realtime rằng supplier chưa thay đổi cam kết ngoài đời.

## 4. Luồng giữ nguồn và confirmed quantity

```text
Chọn / thêm nhà vườn
→ người dùng gọi / nhắn Zalo / xác nhận ngoài app
→ nhập số cây supplier đã xác nhận giữ cho đúng đơn và giống
→ chủ động xác nhận thông tin
→ GIỮ NGUỒN
→ ghi cam kết local + history
```

External form mới MUST bắt đầu **blank / no commitment**. Chọn supplier, mở modal, shortage của đơn hoặc catalog không được tự điền số. Việc xem số thiếu trên đơn không có nghĩa supplier đồng ý giữ số đó.

Quantity authority MUST là explicit user input mang nghĩa **“Số cây đã xác nhận giữ”**. Đơn vị cây/vạn phải dùng parser và formatter hiện có: nhập `3,2` vạn là 32.000 cây; không thay parser, không trộn đơn vị. Cho phép ghi một phần số thiếu nếu đó là số người dùng đã xác nhận.

MUST NOT default từ estimate, fallback 30k, auto-fill theo supplier, clamp theo fake availability hoặc tạo supplier stock remaining. “Giữ đủ đơn”/quick action lấy shortage đơn thuần không được trở thành confirmed quantity. Prefill chỉ được dùng lại **giá trị người dùng đã xác nhận trong chính current action**; nếu cần lấy min với shortage phải trình bày kết quả, để user chủ động chấp nhận số sẽ ghi, không clamp âm thầm.

Trước write, user MUST chủ động acknowledgement rằng đã xác nhận với nhà vườn đúng supplier, giống của đơn và quantity đang gửi. Ví dụ:

```text
Nhà vườn: Anh Bình
Giống của đơn: BV16
Số cây đã xác nhận giữ: [12.000] cây
[ ] Đã gọi/nhắn và xác nhận nhà vườn giữ số cây này cho đơn
[GIỮ NGUỒN]
```

Checkbox chỉ là một lựa chọn UX. Nếu dùng confirmation screen/action thay thế, nó MUST buộc người dùng chấp nhận cùng ý nghĩa và được test tương đương; không tick sẵn hoặc coi mở modal/chọn contact là đã xác nhận. Confirmation intent MUST được kiểm tại service boundary, không chỉ disable CTA trong UI. Đây là acknowledgement của user trong action, không phải verification chứng nhận tồn kho supplier; không cần persisted verification field hoặc bằng chứng cuộc gọi/Zalo.

Đổi order, supplier, variety context hoặc quantity sau acknowledgement MUST bỏ acknowledgement cũ hoặc yêu cầu confirmation cuối lại cho context mới. Service re-read current order variety; nếu khác variety user đã xác nhận thì fail, refresh context và xác nhận lại, không ghi một giống khác từ snapshot. Không tạo protocol optimistic toàn supplier inventory, không online verification. Sau thành công hoặc mở action mới, reset form/confirmation. Không tự submit sau gọi điện hay trở về từ Zalo.

## 5. Supplier contact và variety boundary

Người dùng MUST chọn được supplier hiện có hoặc thêm nhà vườn không nằm trong seed/demo. Fields tối thiểu: **name bắt buộc, phone tùy chọn, roles có `supplier`**. Không cần địa chỉ, giá mặc định, rating hoặc lịch sử mua bán CRM.

Contact có thể có cả customer và supplier roles. Reuse supplier hợp lệ theo ID; không lookup inventory theo tên/phone. Khi duplicate phone dẫn đến reuse contact, contact chỉ có customer role MUST NOT bị coi là supplier: UI phải yêu cầu thêm supplier role rõ ràng qua write hợp lệ hoặc cho chọn/tạo supplier khác theo duplicate-contact policy hiện có. MUST giữ các role cũ và reference/history; không tự đổi customer thành supplier, không bắt thêm phone để giữ nguồn.

Thêm contact chỉ tạo contact/history liên hệ, **không tạo commitment hoặc mặc định quantity**. Nếu dùng chung modal/service contact, wording và roles của supplier flow phải rõ; giữ customer flow hiện có. Lưu lỗi phải được báo thật, không hiển thị contact/commitment đã ghi khi write thất bại; không mở refactor CRM toàn app.

Giống của commitment MUST là **`order.variety` trong context được user xác nhận**. Hiển thị “Giống của đơn: BV16” là context đơn, không phải “Anh Bình có BV16”. Supplier contact không sở hữu inventory by variety; không yêu cầu record catalog để được chọn supplier. Variety lock khi có reservation history của FC2 giữ nguyên.

## 6. Mutation, stale state và failure semantics

Implementation MUST giữ luồng local-first; xác nhận xảy ra ngoài app, ghi dữ liệu local không cần request kiểm supplier online. Mutation đọc current order, supplier, roles, reservation coverage và facts cần validate, kiểm confirmation intent, write reservation/order/history **trong cùng Dexie transaction**. Không ghi lại snapshot order metadata từ UI; Undo snapshot/history IDs tiếp tục capture trong transaction theo FC3-1A.

MUST fail trước write khi thiếu order/supplier, contact không có supplier role, order cancelled/shipped, confirmation thiếu hoặc context sai, quantity không phải số nguyên dương hữu hạn, quantity vượt **current** shortage, hay intervening update làm over-cover. Không fail vì “supplier estimated stock insufficient”. Failure không được ghi một phần reservation/order/history hoặc tạo success giả. Event-write failure MUST rollback toàn mutation, không tạo Undo của một write chưa commit.

**Mọi reservation creation path tính current order coverage/shortage và status recompute MUST dùng canonical coverage semantics ở §3**, gồm F của released reservations. **Required implementation gate cho cả `reserveOwnBatch()` và `reserveExternalSupplier()`**, không được quên vì UI đã bỏ estimate:

```text
requested = 50.000
released source: Q = 20.000, F = 10.000, O = 0
active other source: Q = 20.000, F = 0
coverage = 30.000 → shortage = 20.000
add 30.000 own → FAIL, dù batch còn bán đủ
add 30.000 external → FAIL, dù user đã confirmed
add 20.000 own → PASS nếu batch availability/variety và các guard hiện có đạt
add 20.000 external → PASS nếu supplier/confirmation và các guard hiện có đạt
```

Base **cả hai creation services** đều tính thiếu 30.000 trong case này vì bỏ released F. Implementation MUST sửa cả `reserveOwnBatch()` và `reserveExternalSupplier()` bằng authority domain hiện có: reuse `reservedQuantityForOrder` / `orderShortage`, hoặc extract helper hẹp cộng `coveredQuantityForReservation` rồi tính max(requested − currentCoverage, 0). Read/validate/write vẫn nằm trong transaction của từng path; không tự tạo công thức UI hoặc refactor toàn reservation engine. Đây là bảo vệ invariant FC0/FC3 `coverage <= requested`, không mở rộng nghiệp vụ FC4. Backup guard coverage <= requested MUST tiếp tục bắt corruption.

Bắt buộc **real Dexie regression cho cả hai creation paths** với fixture trên, gồm 30k rejection không ghi reservation/order/event và 20k success theo guard nguồn tương ứng. Các success cases dùng fixtures độc lập: coverage sau write đúng 50k, không cộng hai lần vào cùng một shortage. Không chấp nhận chỉ sửa/test external rồi để own path giữ cùng lỗi.

UI phải refresh facts sau success, không lấy `orderShortage` snapshot cũ trừ quantity rồi báo “đã đủ” nếu current authority khác. Stale state gây rejection cần giải thích, refresh current shortage/context và để user quyết định lại; không tự clamp/commit phần còn lại. Đổi context xác nhận thì phải xác nhận lại.

Double-submit cùng action MUST chỉ ghi một commitment/history, dùng guard theo pattern UI/service hiện có và regression phù hợp. Hai action độc lập/concurrent MUST validate current coverage trong transaction; không over-cover. Không mở marker registry/protocol mới cho external creation chỉ vì FC3 reconciliation có operationId. FC3 reconciliation vẫn giữ strict fingerprint, operationId/retry và atomicity nguyên vẹn.

## 7. Corrections và ranh giới FC2/FC3/FC5

External commitment dùng đúng lifecycle Reservation, không có lifecycle thứ hai:

- Release riêng dùng service hiện có, giữ Q/F/history; released O = 0. Không giả phần nhả thành đã xuất, không xóa record.
- Trigger A được giảm/release external active commitment theo FC3; source choice thuộc user; `newOutstanding >= P` với tổng allocation mọi planned lines. Không cancel/resize planned lines ngầm.
- Trigger B và transfer vẫn **own-batch only**. Không own→external, external→own hoặc external→external transfer trong FC4.
- Cancel order trước khi có completed shipment giữ atomic cascade FC2: release active reservations, cancel planned shipments, giữ lịch sử và stock. Sau completed shipment không được whole-cancel hoặc giảm requested; `closed_remaining` để FC5.
- Shipment completed tăng F và update reservation/order theo service hiện có. External lines **không giảm hoặc tăng living/ready của bất kỳ own batch**, không tạo batch, receipt hay supplier ledger. Mixed shipment chỉ own lines được giảm own physical stock.
- Undo cũ sau release, Trigger A correction, shipment/history thay đổi tiếp tục bị stale guard chặn trong transaction. Không thêm Undo reconciliation, không dùng Undo để phục hồi cam kết supplier đã thay đổi.

FC4 không định nghĩa tuyến supplier→nursery hay supplier→customer. “Completed shipment” có nghĩa thực sự xuất theo workflow hiện có, không mặc định cây đã nhập kho mình hoặc khách đã nhận. Không lấn FC5 fulfillment/completion/logistics semantics.

## 8. Existing data, history và backup/restore

External reservations trước FC4 **tiếp tục hợp lệ như cam kết đã ghi**, kể cả tạo lúc UI có estimate. Không invalidate hàng loạt, sửa ngầm Q/F/status, clamp, release hoặc đánh dấu verified retroactively. Presentation trung thực: “Đã giữ từ nhà vườn”; không tuyên bố hệ thống đã kiểm kho. Không yêu cầu legacy record/event có acknowledgement field mới.

History mới SHOULD dùng “Đã ghi nhận giữ 12.000 cây từ Anh Bình”. MUST NOT dùng “Nhà vườn có 12.000 cây” hoặc “Đã kiểm kho Anh Bình”. Giữ pattern event hiện có: reservationId, supplierId, supplier-name snapshot, orderId, quantity, variety/order context và timestamp. Variety context có thể nằm trong event payload hiện có; không thêm bảng audit. Events cũ không rewrite; giữ creation, correction, cancellation, release và completed history theo model hiện có. Không lưu bằng chứng cuộc gọi/chat, không đổi telemetry thành thu thập nội dung liên lạc.

Backup/restore MUST preserve supplier contacts/roles/reference, reservations Q/F/status/createdAt và history; round-trip/reopen không đổi stock/coverage. Không cần catalog, supplier inventory record, persisted verification hay online verification để restore. Legacy F thiếu dùng quy tắc F=0 hiện có, không thay định dạng backup/schema trong FC4.

MUST giữ các corruption guards: Q > 0, `0 <= F <= Q`, status semantics, supplier tồn tại/có supplier role, order reference hợp lệ, coverage <= requested, planned allocation <= O và completed/F integrity. Giữ FC3 backup compatibility: own outstanding > ready là shortage hợp lệ, không corruption. MUST NOT thêm `external commitment <= supplier inventory`, không mass-invalidate legacy chỉ do thiếu bằng chứng xác nhận; reference/role hỏng thật vẫn reject.

## 9. Từ điển UI và mobile acceptance

| Dùng cho nguồn ngoài | Ý nghĩa |
| :--- | :--- |
| NGUỒN NGOÀI / Nhà vườn | Contact nguồn cung ngoài |
| GỌI XÁC NHẬN | Mở gọi điện nếu có phone; người dùng tự xác nhận ngoài app |
| Số cây đã xác nhận giữ | Số user đã xác nhận cho context đơn hiện tại |
| GIỮ NGUỒN | Ghi cam kết confirmed; không phải kiểm supplier stock |
| Đang giữ X cây cho đơn này | O từ reservations đã ghi; không phải tồn supplier |
| Đã giữ từ nhà vườn | Presentation tương thích history/legacy |

MUST NOT dùng “Số lượng tham khảo”, “Có khoảng X cây”, “Còn X cây”, “Kho còn X” hoặc “Nguồn khả dụng X” để mô tả stock supplier. “Đơn còn thiếu X” được phép vì authority là nhu cầu của đơn, phải ghi rõ context. Own-batch “Cây còn bán” tiếp tục hợp lệ theo FC0/C1.

Supplier thiếu phone vẫn nhập/ghi được sau xác nhận ngoài app; call action không được giả phone hay bắt buộc dùng call button. Không làm tích hợp Zalo/chat. Luồng chọn/thêm supplier → nhập → xác nhận → ghi phải dùng được một tay 360–430px, không yêu cầu người dùng hiểu transaction/reservation. Chỉ sửa copy/control phục vụ FC4, không sweep styling/UI-R03/R04/R05.

## 10. Acceptance matrix cho implementation sau contract

Các gate dưới đây **chưa được chạy như FC4 acceptance**. Implementation cần real Dexie integration cho mutations/races/rollback/restore và UI/browser evidence cho form/confirmation; test mock đơn thuần không thay thế authority tests. Các flow cancel/release/shipment dùng fixtures/nhánh độc lập, không diễn giải thành cancel đơn sau khi đã xuất.

| Case / action | Expected bắt buộc |
| :--- | :--- |
| Supplier có/không có entry demo; mở external form | Blank quantity, chưa confirmed; không fallback 30k, estimate, stock claim hoặc inventory by variety |
| Chỉ chọn supplier / chỉ bấm gọi / chỉ thấy shortage | Không tạo reservation, không tự acknowledgement hoặc điền confirmed quantity |
| Nhập 12k nhưng chưa acknowledgement | Không ghi tại UI và service boundary; context được giải thích rõ |
| Confirm 12k trong shortage 20k | Q=12k,F=0,active; coverage tăng12k, shortage còn8k; history nói ghi cam kết |
| Confirm quantity lớn hơn catalog giả nhưng <= current shortage | Cho phép; không supplier stock cap. Quantity nhỏ hơn estimate không tự tăng |
| External quick action “Giữ đủ đơn”, reopen/đổi supplier/quantity | Không lấy shortage làm confirmed default; context mới không reuse acknowledgement cũ |
| Nhập `3,2` vạn | Helper/CTA/mutation cùng 32.000 cây, không sai đơn vị |
| Thêm nhà vườn tên mới, phone optional | Supplier role đúng, có thể dùng ngay; tạo contact không tự tạo commitment |
| Chọn dual-role contact; duplicate customer-only phone | Dual-role hợp lệ; customer-only không được silently dùng như supplier; giữ role/reference cũ |
| Supplier/order missing, role bị bỏ, cancelled/shipped, 0/âm/lẻ/NaN | Fail, không ghi một phần; lỗi không viện dẫn fake supplier availability |
| Current order variety khác context đã confirm | Fail/refresh/reconfirm; không ghi commitment cho giống user chưa xác nhận |
| Intervening reservation / quantity giảm làm qty > current shortage | Commit-time rejection, reload; không over-cover, auto-clamp hoặc auto-confirm |
| Requested50k, released Q20k/F10k, active Q20k → add own30k; batch đủ availability/cùng variety | FAIL vì current shortage20k; không ghi reservation/order/event, stock nguyên vẹn |
| Cùng fixture → add external30k; supplier hợp lệ/đã confirmed | FAIL vì current shortage20k; không ghi reservation/order/event, stock nguyên vẹn |
| Cùng fixture độc lập → add own20k; guard batch availability/variety và các guard hiện có đạt | PASS; coverage50k, shortage0, status giữ authority hiện có, không giảm physical stock; backup hợp lệ |
| Cùng fixture độc lập → add external20k; guard supplier/confirmation và các guard hiện có đạt | PASS; coverage50k, shortage0, status giữ authority hiện có, own availability/physical stock không đổi; backup hợp lệ |
| Hai submit cùng action; hai action cạnh tranh shortage cuối | Một ghi cho double-click; concurrent actions không over-cover; history đúng |
| Event-write failure | Reservation/order/event rollback; không success/Undo giả, user có thể retry |
| Một supplier nhiều đơn, xuất một phần | Aggregate có nhãn cam kết/O/F đúng; không suy luận stock remaining |
| Confirm external → Trigger A giảm / full release trước xuất | Real service giữ FC3 strict preview/idempotency/planned guard; coverage đúng, physical stock không đổi |
| Confirm external → cancel order chưa xuất, có planned shipment | Atomic release/cancel planned/order; giữ records/events, stock nguyên vẹn |
| Confirm external → independent release có planned allocation | Giữ guard hiện có, không né bằng external; không sửa line ngầm |
| Confirm external → external completed shipment | F tăng theo completed line, order đúng; own batches byte-for-byte không đổi |
| Mixed own/external shipment | Chỉ own lines giảm own living/ready; không nhập external vào own stock |
| Đã xuất một phần → release O / giữ bổ sung trong shortage | Giữ F/completed history/requested/status theo authority; không whole-cancel, không FC5 closed_remaining; released F vẫn tính coverage |
| Capture create-reservation Undo → real Trigger A / release / shipment | Old Undo rejected, không nhả lại hoặc phá history/stock; không làm yếu FC3 guard |
| Legacy external backup/restore/reopen không catalog/acknowledgement field | Reservations/contacts/history/coverage giữ nguyên, không invalidate hoặc migrate quantity |
| New confirmed external → correction → backup/restore/reopen | Q/F/status/ref/history round-trip; own shortage hợp lệ vẫn được restore |
| Backup supplier ref/role sai, Q0, F>Q, status hỏng, coverage>requested, planned>O, completed/F mismatch | Vẫn reject corruption; không yêu cầu supplier inventory |
| External creation/release/reduction/cancel/backup | Own-batch availability và physical objects không bị external tác động |
| Browser mobile360/390/430, desktop1280 | Chọn/thêm/nhập/acknowledge/error/success đúng nghĩa, control đọc/bấm được; không fake claim |
| Source/diff audit + full exact-head CI | Không backend/schema/dependency/marketplace/generic refactor; FC0/FC2/FC3 regressions tiếp tục xanh |

## 11. Phạm vi cấm và deferred

FC4 không làm marketplace, supplier portal/app, realtime supplier inventory, cloud/shared database/sync, supplier API, chat/Zalo integration, purchase order, accounts payable, supplier rating, accounting, payment, logistics routing/topology, AI hoặc generic-product abstraction. Không đổi tên Vườn Ươm. Không thêm inventory field vào Contact, entity commitment thứ hai, persisted verification schema hay requirement ảnh/chứng từ cuộc gọi.

Không redesign toàn app, không mở FC5 `closed_remaining`, không sửa shipment-line lifecycle, không mở external transfer FC3. Các NOTE đã deferred của FC3 (stable differentiator cho đơn giống nhau trước pilot; deep validation manually-corrupt idempotency marker) vẫn deferred theo task riêng, không tự gộp vào FC4-0.

## 12. Review và handoff

Output FC4-0 chỉ gồm tài liệu này và `.agent/PROJECT_STATE.md`, không `web/` diff. Người dùng đã duyệt exact-head `69c2aa2a54c5ee991c518b498e8f82071845d7d8`: product truth, scope, released-F amendment cho cả own/external và exact-head CI đều PASS. [PR #22](https://github.com/17thedevv/VuonUomSo/pull/22) đã merge tại `0507906421df4872d45f07ef4a625a61b7b90e54`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37796903976), typecheck/lint/full tests/build PASS.

**FC4-0 CLOSED / FC4-1 NEXT — truthful external commitment implementation**. FC4 overall vẫn PLANNED; **FC4 implementation NOT STARTED**. Correctness gate đầu tiên của FC4-1 là released-F correction và real Dexie regression cho cả `reserveOwnBatch()` và `reserveExternalSupplier()` theo §6/§10, trước khi nghiệm thu luồng confirmed external mới. Không cần refactor toàn reservation engine; các điều khoản nghiệp vụ đã duyệt giữ nguyên. Không ghi FC4 DONE chỉ vì docs hoặc CI xanh.
