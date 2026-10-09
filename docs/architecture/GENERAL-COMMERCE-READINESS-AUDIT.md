# General-Commerce Readiness Audit

> **HISTORICAL AUDIT SNAPSHOT.** Roadmap hiện hành: [V2 Roadmap](../product/V2-ROADMAP.md). FC5/FC6 SUPERSEDED; FC5-1 branch preserved/not adopted. Bằng chứng và trạng thái OPEN/NEXT trong snapshot cũ bên dưới không phải current-main acceptance hoặc task authority. G01/G02 đã DONE / CLOSED qua [PR #32](https://github.com/17thedevv/VuonUomSo/pull/32), merge `9c29fa2beea57bd82eb74a4b88c5b79987acefb1`, [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37934810940). G10 DONE / CLOSED qua [PR #33](https://github.com/17thedevv/VuonUomSo/pull/33), merge `87d918d02ee5cbb22bb1e76475292fab4b7fdae2`, [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37946122446). V2-A1 read model DONE / CLOSED qua [PR #35](https://github.com/17thedevv/VuonUomSo/pull/35), [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37952987463); V2-A2 NEXT duy nhất; Garden UI chưa triển khai. Các findings G10 bên dưới giữ như snapshot trước patch.

## Executive Summary

**Current readiness: 1,2/5.** Đây là trung bình 13 subsystem trong bảng bên dưới, làm tròn một chữ số. Điểm đo khả năng phục vụ general commerce hiện có, không đo chất lượng sản phẩm Vườn Ươm. Các subsystem chưa tồn tại được ghi rõ; điểm 0 của chúng không có nghĩa là một subsystem đã bị thiết kế sai.

**Future expansion cost: High** nếu mở rộng sổ vận hành một chủ hàng sang thời trang, đồ gia dụng và phụ kiện công nghệ; **Very High** nếu đồng thời yêu cầu storefront, giỏ hàng, thanh toán, giao vận và tài khoản trực tuyến. Cart/checkout/backend sẽ phải xây mới, không phải rewrite một implementation đang tồn tại.

Kết luận: Vườn Ươm có nền tảng domain thuần và transaction đủ tốt để tiếp tục phục vụ niche. Tuy nhiên, hiện chưa đạt “general-ready”: tên giống đang làm identity hàng hóa và toàn fulfillment tính trên đơn một giống. Giữ option mở rộng bằng migration additive khi có yêu cầu thật; đổi tên `Batch` thành `Product` hoặc gom mọi dữ liệu vào attributes JSON sẽ không giải quyết hai ràng buộc này.

Top architectural risks:

1. `variety: string` vừa là nhãn vừa là khóa khớp nguồn; không phân biệt SKU, cỡ hoặc cấp chất lượng.
2. `Order.requestedQuantity` là tổng của một giống; reservation, shipment, reconciliation, closure và backup cùng dựa trên giả định này.
3. Boundary tạo đơn cũ chưa đồng đều với các mutation mới: lưu đơn/event không atomic, numeric validation cho phép dữ liệu không hợp lệ. Hai lỗi này đã tái hiện độc lập và đáng vá ngay trong patch correctness riêng.

What should NOT be generalized yet:

1. UX cây/vạn, trạng thái ươm/đủ bán/quá lứa và hồ sơ nguồn giống.
2. Supplier contact thành tồn kho nhà cung cấp hoặc marketplace vendor.
3. Plugin, event sourcing, rule engine, EAV, promotion DSL, microservices và backend chỉ để chuẩn bị cho một hướng sản phẩm chưa được xác nhận.

### Snapshot và giới hạn bằng chứng

- Audit ngày 09/10/2026 trên checkout `feat/fc5-close-remaining-domain`, HEAD `ac68325b8deab6445e833b6f7c78c28fa97f9484`.
- Base main của checkout: `0d8d97a7254998ac84c7fedc087724f8ccc44da2`. Snapshot có FC5-1 chưa merge; không suy ra FC5 đã DONE hoặc FC5-2 được bắt đầu.
- Kiểm tra schema, domain, repositories, services, routes, read models, UI dùng lại, backup, seed, types, cấu hình và các test liên quan; search toàn `web/src` cho product/category/cart/checkout/SKU/currency/shipping/API và tên nghiệp vụ. Không có backend/API HTTP hay commerce catalog trong cây source đã kiểm tra.
- Chạy mới `npm test -- --reporter=dot` từ `D:/Project-17/VuonUom/web`: **56/56 files, 823/823 tests PASS**. Có warning React `act(...)` trong một số test UI; suite xanh không bao phủ hai probe tạo đơn bên dưới. Audit này không chạy lại typecheck/lint/build và không tuyên bố đây là nghiệm thu FC5.
- Browser Chromium, IndexedDB trong context cô lập, 9 lượt trên 3 màn hình × 360/768/1280px; không đụng dữ liệu người dùng. Không kiểm thiết bị thật/IME/PWA offline/field pilot.
- Chỉ tạo báo cáo; không thay production, schema, dependencies, trạng thái roadmap hoặc PR hiện tại.

---

## Architecture Map

### Current product flow

```text
IndexedDB / Dexie
  organizations, settings, contacts
  batches ── dossiers
  orders ── reservations ── shipments
  events; pilotSessions, validationEvents
       ↓ đọc qua repository hoặc transaction service
Domain thuần: quantity, order, reservation, shipment,
             lifecycle, reconciliation, completion
       ↓ service inputs/results + read projections
API: các hàm TypeScript local; không có HTTP/backend
       ↓ React useState/useEffect, reload sau mutation
Screens / BatchCard / OrderCard / QuantityInput
```

Chiều mutation: UI → service → re-read/validate bằng domain → Dexie transaction → lưu records/history → UI reload. Chiều đọc chưa thống nhất: một số service trả read model; nhiều screen tự gọi repositories rồi join và derive trong component.

| Khu vực | Implementation thực tế | Điều đáng giữ |
|---|---|---|
| Persistence | `VuonUomDatabase`, schema v1–v5 trong [db.ts](D:/Project-17/VuonUom/web/src/data/db.ts:19) | Migration additive, index theo order/source/status; không có server ORM |
| Inventory | `Batch`: initial/current/ready; availability và shortage derive | Physical stock khác commitment; shortage có thể là trạng thái hợp lệ |
| Demand | `Order`: customer, variety, một quantity, date/price/note | Ghi nhu cầu không tự trừ stock |
| Supply | `Reservation`: own batch hoặc external contact; Q/F/status | Active outstanding O=Q−F; released coverage vẫn giữ F |
| Dispatch | `Shipment.lines` phân bổ reservation trong một order | Confirm mới giảm stock own; external không làm giảm stock vườn |
| Corrections | FC2/FC3 và FC5-1: preview, fingerprint, transaction, history/marker | Strict reconfirm và idempotency dùng lại được về nguyên tắc |
| Read state | Repository interfaces + domain types; React local state | Không có hai bộ product types frontend/backend để đồng bộ |
| Backup | V1 gồm 9 bảng nghiệp vụ; normalize → validate → restore atomic | Legacy reader và corruption guards đã có test |
| Admin | Các screen chủ vườn tạo lô/đơn, kiểm kê, hồ sơ, backup | Đây là owner operations, chưa phải admin catalog/storefront |

### Trace một luồng thật

1. [OrderNewScreen](D:/Project-17/VuonUom/web/src/features/orders/OrderNewScreen.tsx:24) parse cây/vạn, gọi `getVarietyAvailability()` để báo số lượng và `createOrder()` để ghi nhu cầu.
2. [createOrder](D:/Project-17/VuonUom/web/src/services/orderService.ts:88) lưu `Order`; hiện có ngoại lệ transaction được ghi ở finding G01. Không tạo reservation hoặc giảm stock.
3. [getReservationOptions / reserveOwnBatch](D:/Project-17/VuonUom/web/src/services/reservationService.ts:80) tìm batch cùng chuỗi giống; commit re-read availability, canonical coverage/shortage và nguồn. External path yêu cầu confirmation explicit, không đọc estimate làm inventory.
4. [confirmShipment](D:/Project-17/VuonUom/web/src/services/shipmentService.ts:281) validate allocation, cập nhật F, shipment/order/event; chỉ line own trừ `currentQuantity` và `readyQuantity`.
5. [reservedQuantityForOrder / orderShortage](D:/Project-17/VuonUom/web/src/domain/order.ts:60) tính coverage theo Q/F. `shippedQuantityForOrder()` chỉ cộng completed; actionable remaining bỏ terminal order.
6. [OrderDetailScreen.fetchData](D:/Project-17/VuonUom/web/src/features/orders/OrderDetailScreen.tsx:79) join repositories, derive summary và render. Không có JSON API, cart hoặc checkout ở giữa.

### Coverage những subsystem được yêu cầu

| Subsystem | Tìm thấy gì |
|---|---|
| Product/category/variants | Không có `Product`, category tree/slug hay SKU. `Batch.variety` và `Order.variety` không phải catalog model |
| Attributes | `BatchDossier` riêng cho nguồn/vật liệu/chứng từ; không có sunlight/watering/pot-size fields trên một Product giả generic |
| Inventory/pricing | Inventory theo lô; `Order.unitPrice` optional, UI đồng/cây; chưa có price book/tax/discount/currency model |
| Search/list/detail | Batch/order filters nghiệp vụ, sort client; BatchDetail/OrderDetail là operational detail, không phải product storefront |
| Cart/checkout | Không có state/table/service/route; không thể audit behavior không tồn tại |
| Shipping | Xuất cây từ reservation; chưa có carrier/address/weight/dimensions/shipping class |
| API/types/validation | Service TypeScript local, một bộ domain types; runtime guards trong domain/service/backup; không có OpenAPI/server DTO |
| State/seed/tests | React local state; demo/pilot seed; pure-domain, real Dexie, migration/backup và UI integration tests |

---

## Findings

P0/P1/P2/P3 ở đây dùng theo rubric readiness của task. G01/G02 còn là correctness hiện hữu, không phải nợ do thiếu commerce. **Không phát hiện P0 bắt buộc rewrite ngay**; hai P1 tương lai G03/G04 cần được xử lý trước tính năng SKU/multi-item, không bắt buộc refactor toàn bộ hôm nay.

### [P1] G01 — Tạo đơn có thể báo thất bại sau khi đơn đã lưu

**Location:** [orderService.ts:88](D:/Project-17/VuonUom/web/src/services/orderService.ts:88), `createOrder()`; `orderRepository.save()` dòng 124 và `eventRepository.record()` dòng 129; [orderService.test.ts](D:/Project-17/VuonUom/web/src/services/__tests__/orderService.test.ts:39).

**Current implementation:** Lưu order, đọc availability, ghi event trong các bước riêng, không có outer transaction. Catch trả `success:false` và UI giữ form. Các mutation batch/contact/update/cancel/reconciliation mới đã có transaction; đây là ngoại lệ cũ. `orderService.ts` không có diff so với base `0d8d97a`; G01/G02 không phải regression do FC5-1 đang ở checkout này tạo ra.

**Why this matters:** Kết quả mutation không phản ánh trạng thái bền vững; người dùng có thể thử lại một thao tác tưởng chưa lưu. Đây là lỗi cần sửa dù không mở rộng ngành hàng.

**Future failure mode:** Probe bằng Dexie `events.hook('creating')` ném lỗi: order count `3→4`, service báo thất bại, order mới không có event/Undo. Retry cùng nội dung thành công làm count `4→5`. Không xảy ra trừ stock trong probe, nhưng phát sinh nhu cầu trùng và history thiếu.

**Recommendation:** Patch riêng đặt customer read, order write, availability facts liên quan và event trong transaction phù hợp; chỉ đăng ký Undo sau commit. Không thêm event sourcing hoặc refactor mọi service.

**Refactor now? YES** — correctness patch nhỏ, kế hoạch cụ thể ở Phase A. Audit chỉ lập kế hoạch vì đổi transaction/error semantics cần regression và review; không trộn vào PR FC5-1.

### [P1] G02 — Boundary tạo đơn nhận quantity/price không hữu hạn

**Location:** [orderService.ts:99](D:/Project-17/VuonUom/web/src/services/orderService.ts:99), `createOrder()` guard và `Math.round()` dòng 109/118; [orderLifecycle.ts:39](D:/Project-17/VuonUom/web/src/domain/orderLifecycle.ts:39), `validateOrderChanges()` đã dùng safe integers; [backup.export.ts:66](D:/Project-17/VuonUom/web/src/data/backup/backup.export.ts:66), self-validation.

**Current implementation:** `!requestedQuantity || quantity<=0` không reject `Infinity`; price chỉ kiểm `>=0` trước làm tròn. Create khác edit/reserve/ship, vốn kiểm safe integer.

**Why this matters:** TypeScript `number` không bảo vệ runtime. Caller local mới/import/integration có thể tạo record mà backup không chấp nhận. UI thông thường có parser chặn nhiều input sai, nhưng không thay thế service authority.

**Future failure mode:** Gọi service thật với `requestedQuantity=Infinity, unitPrice=Infinity` trả success và lưu cả hai. `exportWorkspaceBackup()` sau đó throw vì số đặt không phải số nguyên dương hợp lệ. `NaN` quantity đã bị guard hiện tại chặn; không đánh đồng mọi invalid input.

**Recommendation:** Validate positive safe integer cho quantity, optional nonnegative safe integer cho price trước write; đồng nhất contract count/money với edit. Không nới backup để hợp thức hóa dữ liệu sai, không tự clamp hoặc repair record hiện hữu.

**Refactor now? YES** — cùng patch correctness G01, có test invalid input/no-write. Reject fractional create input là thay đổi boundary cần test, không mặc nhiên gọi là hoàn toàn không đổi behavior.

### [P1] G03 — Chuỗi tên giống đang làm identity hàng có thể bán

**Location:** [batch.ts:9](D:/Project-17/VuonUom/web/src/domain/batch.ts:9), `Batch.variety`; [order.ts:13](D:/Project-17/VuonUom/web/src/domain/order.ts:13), `Order.variety`; [reservation.ts:81](D:/Project-17/VuonUom/web/src/domain/reservation.ts:81), `filterBatchCandidatesForOrder()`; [reservationService.ts:200](D:/Project-17/VuonUom/web/src/services/reservationService.ts:200), own creation guard; [batchReconciliation.ts:185](D:/Project-17/VuonUom/web/src/domain/batchReconciliation.ts:185), target matching.

**Current implementation:** Equality là `trim().toLowerCase()` trên tên giống, lặp ở availability, reservation và transfer. Free-text domain không bị enum 5 giống khóa cứng, nhưng không có item/SKU ID.

**Why this matters:** Đổi nhãn làm thay đổi matching; hai cấp chất lượng/cỡ cùng tên giống vẫn tương thích theo code hiện tại. SKU áo M/đỏ và L/đỏ không thể chỉ dùng title để bảo vệ allocation.

**Future failure mode:** Gộp nhầm nguồn khác SKU hoặc phải bổ sung identity ở mọi transaction/fingerprint/backup sau khi nhiều feature đã dựa vào tên.

**Recommendation:** Khi cần hàng khác cấp/cỡ hoặc SKU thật, thêm sellable-item ID additive, giữ tên snapshot cho UX/history. Không tự gộp legacy strings chỉ bằng normalized name; cần mapping được xác nhận.

**Refactor now? WHEN-TOUCHED** — trước feature SKU/grade-sensitive đầu tiên. Chưa có yêu cầu đó để đổi schema hôm nay.

### [P1] G04 — Fulfillment aggregate khóa vào đơn một dòng hàng

**Location:** [order.ts:13](D:/Project-17/VuonUom/web/src/domain/order.ts:13), `Order`; [reservation.ts:12](D:/Project-17/VuonUom/web/src/domain/reservation.ts:12), `Reservation.orderId`; [shipment.ts:8](D:/Project-17/VuonUom/web/src/domain/shipment.ts:8), `ShipmentLine`; [reconciliation.ts](D:/Project-17/VuonUom/web/src/domain/reconciliation.ts:9), `OrderReductionPlan`; [orderCompletion.ts](D:/Project-17/VuonUom/web/src/domain/orderCompletion.ts:100), coverage proof; [backup.validate.ts:367](D:/Project-17/VuonUom/web/src/data/backup/backup.validate.ts:367), coverage invariant.

**Current implementation:** Shipment có nhiều source lines, nhưng tất cả phục vụ một order/variety/quantity. Không có demand line ID. Coverage và shipped cộng count toàn order.

**Why this matters:** Multi-source không đồng nghĩa multi-product. Cộng 2 áo + 1 bàn thành quantity 3 không cho biết dòng nào được cover/ship/cancel.

**Future failure mode:** Patch riêng UI “thêm sản phẩm” phá ý nghĩa coverage, reconciliation và terminal `S=R`; history/idempotency cũ không chứa line authority.

**Recommendation:** Khi có đơn nhiều mặt hàng, thêm OrderLine cùng identity, quantity/unit/price/name snapshots; allocation trỏ line. Giữ legacy order một dòng qua adapter và version semantics cho thao tác mới. Không sửa projection lịch sử để giả nó từng là multiline.

**Refactor now? WHEN-TOUCHED** — phải thiết kế trước multi-item order/cart, không làm speculative order-engine rewrite.

### [P2] G05 — Component dùng chung QuantityInput có semantics riêng cây/vạn

**Location:** [QuantityInput.tsx:5](D:/Project-17/VuonUom/web/src/shared/components/QuantityInput.tsx:5), `QuantityInputProps`, default `unit='van'`, chips 1/2/5/10 vạn, preview “cây”; [quantity.ts:8](D:/Project-17/VuonUom/web/src/domain/quantity.ts:8), `parseQuantity()`.

**Current implementation:** Base unit không lưu trên records; tất cả quantity là count cây nguyên. “Vạn” là multiplier hiển thị ×10.000, không phải một inventory unit độc lập.

**Why this matters:** Reuse nguyên component cho áo/đồ gia dụng gây input sai nghĩa. Count nguyên dùng được cho ba ngành giả định; hàng theo mét/kg cần precision contract khác.

**Future failure mode:** Giá/stock tính theo đơn vị không nhất quán hoặc parser làm tròn lượng bán theo cân/chiều dài.

**Recommendation:** Giữ cây/vạn adapter; khi có UI ngành mới, extract numeric input đơn giản với label/unit/chips cấu hình explicit. Count base unit trên item/line trước; không thêm conversion engine hoặc decimal inventory lúc này.

**Refactor now? WHEN-TOUCHED.**

### [P2] G06 — Giá là báo giá một đơn cây, chưa phải pricing subsystem

**Location:** [order.ts:19](D:/Project-17/VuonUom/web/src/domain/order.ts:19), `unitPrice`; [OrderNewScreen.tsx:147](D:/Project-17/VuonUom/web/src/features/orders/OrderNewScreen.tsx:147), price parse và tổng dự tính; [OrderDetailScreen.tsx](D:/Project-17/VuonUom/web/src/features/orders/OrderDetailScreen.tsx:287), presentation đồng/cây.

**Current implementation:** Giá optional trên order, UI VND, không có product base price/compare-at/variant price/promotion/tax. Order giữ giá riêng; không có dependency tới mutable Product để làm mất giá lịch sử.

**Why this matters:** Có thể ghi nhu cầu trước khi chốt giá, phù hợp hiện tại. Checkout mới sẽ cần price/currency/quantity-unit snapshots và authority tổng tiền rõ.

**Future failure mode:** Lấy giá catalog hiện tại để render lại đơn cũ, cộng tiền khác currency hoặc tính promotion từ UI.

**Recommendation:** Khi xây catalog/checkout, bổ sung money snapshot trên OrderLine và giá SKU đơn giản. Giữ semantics giá chưa chốt của legacy; base/variant price trước, promotion sau khi có nhu cầu.

**Refactor now? NO.** Numeric correctness G02 là patch riêng, không phải lý do xây pricing engine.

### [P2] G07 — Read models còn join trong screen và scan toàn workspace

**Location:** [OrdersScreen.tsx:49](D:/Project-17/VuonUom/web/src/features/orders/OrdersScreen.tsx:49), `fetchData()`; [OrderDetailScreen.tsx:79](D:/Project-17/VuonUom/web/src/features/orders/OrderDetailScreen.tsx:79); [TodayScreen.tsx:54](D:/Project-17/VuonUom/web/src/features/today/TodayScreen.tsx:54); [reconciliationService.ts:23](D:/Project-17/VuonUom/web/src/services/reconciliationService.ts:23), `readState()`.

**Current implementation:** UI gọi concrete repositories nhưng không trực tiếp viết `db.table()`. List load all orders/reservations/shipments/contacts; mỗi order derive bằng filter arrays. Mutation services trực tiếp dùng Dexie để giữ multi-table transaction. Một số shipment/reservation query service đã trả read DTO.

**Why this matters:** Backend sau này cần thay nhiều reads và tách DTO; O(orders×reservations/shipments) có thể tốn khi lịch sử tăng. Chưa benchmark nên không kết luận hiện tại chậm.

**Future failure mode:** DTO drift giữa screen, tải hết catalog/history về client hoặc cố giữ giả định transaction local khi chuyển qua HTTP.

**Recommendation:** Khi chạm screen, đưa join vào named query service/read DTO và lập map/index cho derivation. Đo dataset thật trước pagination; nếu có server, đưa toàn mutation authority lên server và thiết kế concurrency lại, không chỉ thay repo bằng `fetch()`.

**Refactor now? WHEN-TOUCHED.** Không cần Redux, generic repository, DI container hay backend hôm nay.

### [P2] G08 — Optional source fields và event payload cần boundary hẹp khi thêm model mới

**Location:** [reservation.ts:12](D:/Project-17/VuonUom/web/src/domain/reservation.ts:12), `Reservation`; [shipment.ts:8](D:/Project-17/VuonUom/web/src/domain/shipment.ts:8), `ShipmentLine`; [events.ts:1](D:/Project-17/VuonUom/web/src/analytics/events.ts:1), `DomainEvent`; [bootstrap.ts](D:/Project-17/VuonUom/web/src/app/bootstrap.ts:22), mode cast.

**Current implementation:** `sourceType` đi cùng optional batchId/supplierId; TS có thể biểu diễn tổ hợp không hợp lệ. Runtime reconciliation/shipment/backup kiểm source exclusivity và references. F, shipment lines/createdAt optional phục vụ legacy. Event type/string + payload unknown; marker services có guards riêng. Không có duplicated frontend/backend Product types hay frontend phụ thuộc server ORM.

**Why this matters:** Thêm source/SKU mới làm matrix optional fields khó theo dõi; cast TS không xác minh dữ liệu từ storage/import/network.

**Future failure mode:** UI mới tạo sai tổ hợp source hoặc code đọc legacy optional như required. HTTP DTO raw theo DB sẽ khiến schema đổi lan ra client nếu chọn cách đó trong tương lai.

**Recommendation:** Khi sửa source model, dùng discriminated union cho normalized input/read DTO; giữ parser legacy trước khi thu hẹp persisted type. Typed payload/guard cho event mới quan trọng, không registry event toàn hệ thống. Validate mode/query values tại boundary nếu chạm; filter hiện tại đã có allowlist, không cần dynamic query DSL.

**Refactor now? WHEN-TOUCHED.**

### [P2] G09 — Backup là envelope cố định, phải đi cùng schema commerce mới

**Location:** [backup.types.ts:28](D:/Project-17/VuonUom/web/src/data/backup/backup.types.ts:28), `VuonUomBackupV1`; [backup.normalize.ts:64](D:/Project-17/VuonUom/web/src/data/backup/backup.normalize.ts:64), `REQUIRED_TABLES`; [backup.restore.ts:68](D:/Project-17/VuonUom/web/src/data/backup/backup.restore.ts:68), replace transaction; [backup.export.ts:40](D:/Project-17/VuonUom/web/src/data/backup/backup.export.ts:40), `dbSchemaVersion:4`.

**Current implementation:** V1 export/normalize/restore chỉ 9 bảng nghiệp vụ. DB thực tế v5 có thêm pilot telemetry; backup metadata hiện ghi 4, không phải `db.verno`. Normalize dựng lại envelope từ các bảng đã biết; bảng commerce mới sẽ không tự được bảo toàn chỉ vì gắn vào JSON V1.

**Why this matters:** Có migration Dexie không đồng nghĩa có migration backup. Telemetry ngoài backup nghiệp vụ hiện tại là scope có chủ ý, không phải bằng chứng mất stock.

**Future failure mode:** Thêm catalog/orderLines/stock mà quên cập nhật envelope/validator/restore, làm mất bảng mới qua round-trip hoặc old reader diễn giải thiếu dữ liệu.

**Recommendation:** Với bảng commerce thật, nâng backup format có chủ đích, giữ reader V1/legacy, chuẩn hóa meaning của db/business schema metadata; old reader reject version mới. Không bump Dexie/backup cho báo cáo hoặc sửa metadata 4→5 thiếu quyết định contract.

**Refactor now? WHEN-TOUCHED** — required gate của schema expansion; giữ corruption, reference, planned allocation, terminal và marker integrity.

### [P2] G10 — Picker giống ở tạo đơn đóng hơn domain và tạo lô

**Location:** [OrderNewScreen.tsx:14](D:/Project-17/VuonUom/web/src/features/orders/OrderNewScreen.tsx:14), `COMMON_VARIETIES`, `prefillVariety`, select dòng 250; [BatchNewScreen.tsx:112](D:/Project-17/VuonUom/web/src/features/batches/BatchNewScreen.tsx:112), option “Giống khác”.

**Current implementation:** Batch form hỗ trợ custom text; OrderNew chỉ render 5 option cố định. Query `?variety=` vào React state có thể nằm ngoài options.

**Why this matters:** Hardcode này gây inconsistency ngay trong niche; không cần thêm category engine mới giải quyết được.

**Future failure mode:** Người dùng tạo lô giống khác nhưng không chọn nó từ OrderNew thông thường. Browser probe query “Giống thử riêng” cho thấy DOM select hiển thị BV16 dù draft lấy query; nhãn nhìn thấy và intent có thể lệch.

**Recommendation:** Patch nhỏ khi chạm create flow: choices từ common suggestions + varieties đang có + current draft, và đường nhập giống khác rõ. Test visible selection khớp submitted variety, normalization/dedup không tự đổi identity.

**Refactor now? WHEN-TOUCHED** — ưu tiên trước pilot có custom varieties; đây là chỉnh picker cụ thể, không phải generic dynamic form.

### [P3] G11 — Lô cây và hồ sơ nguồn giống là domain đặc thù hợp lý

**Location:** [batch.ts:9](D:/Project-17/VuonUom/web/src/domain/batch.ts:9), `Batch`, `deriveBatchStatus()`, `filterBatches()`; [dossier.ts:29](D:/Project-17/VuonUom/web/src/domain/dossier.ts:29), `BatchDossier`; [batchService.ts:186](D:/Project-17/VuonUom/web/src/services/batchService.ts:186), inventory constraints; [BatchCard.tsx](D:/Project-17/VuonUom/web/src/shared/components/BatchCard.tsx:75).

**Current implementation:** Initial/living/ready, sell-before/quá lứa, vật liệu hom/mô/hạt là niche thật. Dossier đã nằm riêng khỏi quantity/order core. Card được đặt tên BatchCard, không giả là ProductCard generic.

**Why this matters:** Với cây, sẵn sàng bán khác tồn vật lý. Ép áo hoặc cáp vào propagating/current≤initial vừa sai nghĩa vừa cản nhập kho bổ sung.

**Future failure mode:** Xảy ra nếu cố reuse lô sinh học làm mọi inventory item; không phải lỗi vì model đúng với cây hôm nay.

**Recommendation:** Giữ nursery module. Khi cần, compose InventoryItem/SellableItem cho ngành mới và giữ nursery facts qua link/adapter; không bỏ ready/living, không đổi mọi record thành attributes bag.

**Refactor now? NO.**

### [P3] G12 — Supplier và workspace chưa phải marketplace

**Location:** [reservation.ts:62](D:/Project-17/VuonUom/web/src/domain/reservation.ts:62), `ExternalSupplierCandidate`; [contact.ts](D:/Project-17/VuonUom/web/src/domain/contact.ts:1), `Contact`; [organization.repository.ts](D:/Project-17/VuonUom/web/src/data/repositories/organization.repository.ts:13), `getCurrent()`; [supplierCatalog.ts](D:/Project-17/VuonUom/web/src/data/demo/supplierCatalog.ts:12), fixture.

**Current implementation:** Supplier chỉ là liên hệ và cam kết user xác nhận; không inventory nhà cung cấp. `getCurrent()` lấy organization đầu; business records không có tenant ownership. Catalog estimate demo chỉ được import ở domain test, không ở production creation path.

**Why this matters:** Một chủ hàng bán thêm ba ngành không cần multi-vendor. Nhiều chủ bán chung nền tảng lại cần identity/auth/ownership/concurrency hoàn toàn khác.

**Future failure mode:** Gọi contacts là vendors rồi dùng local workspace làm authorization hoặc dùng estimate fixture làm nguồn hàng thật.

**Recommendation:** Giữ supplier truthfulness FC4. Chỉ thiết kế tenant/vendor boundary khi có product requirement riêng; khi đó mức độ là P1 điều kiện của marketplace, không phải debt cần sửa cho multi-category một chủ.

**Refactor now? NO.**

### [P3] G13 — Filter nghiệp vụ và thiếu storefront là scope, không phải lỗi generic UI

**Location:** [router.tsx](D:/Project-17/VuonUom/web/src/app/router.tsx:137), route registry; [BatchesScreen.tsx:35](D:/Project-17/VuonUom/web/src/features/batches/BatchesScreen.tsx:35), filter; [order.ts:54](D:/Project-17/VuonUom/web/src/domain/order.ts:54), `OrderFilterType`; [AppShell.tsx:13](D:/Project-17/VuonUom/web/src/shared/components/AppShell.tsx:13).

**Current implementation:** Filters đang ươm/đang bán/chú ý, cần xử lý/sắp lấy/đã xuất phục vụ owner workflow. Không có category facets, ProductCard/ProductDetail/CartItem ngầm assume cây.

**Why this matters:** Không cần biến operational screens thành catalog engine để tiếp tục làm FC5. Primitive layout/buttons/dialog dùng lại được; quantity/batch/order presentation có semantics riêng.

**Future failure mode:** Sao chép owner UI thành buyer storefront, coi operational shipment completed là customer receipt/payment complete.

**Recommendation:** Khi có storefront, tạo feature/catalog và buyer flows riêng, reuse primitives và read authority phù hợp. Facets typed theo category thật, không thay filter vận hành bằng EAV.

**Refactor now? NO.**

### Documentation drift cần lưu ý

[domain-rules skill](D:/Project-17/VuonUom/.agent/skills/domain-rules/SKILL.md:51) còn công thức cộng Q active cũ; [architecture skill](D:/Project-17/VuonUom/.agent/skills/architecture/SKILL.md:48) ghi schemaVersion=1. Canonical FC0/FC3/FC5 và helpers hiện tại dùng outstanding/coverage đúng. Đồng bộ tài liệu khi chạm, đừng dùng hướng dẫn cũ để “generalize” rồi hồi quy semantics. Đây là coupling tài liệu P2, không phải phát hiện stock bug mới trong các helpers.

---

## Subsystem Scores

| Subsystem | Score | Notes |
|---|---:|---|
| Product | 1/5 | Batch là inventory lot, variety làm matching key; chưa có sellable identity/catalog |
| Category | 0/5 | Chưa tồn tại tree/slug/metadata/attribute definitions; thêm mới khi cần |
| Attributes | 2/5 | Dossier riêng là composition tốt; chưa có attributes cho catalog/filter |
| Variants | 0/5 | Chưa có SKU/options; không có kiến trúc variant hiện hữu để kết luận sai |
| Inventory | 2/5 | Invariants/reserve/ship tốt; nursery facts và identity cần adapter ngành mới |
| Pricing | 1/5 | Quoted price trên order, VND/count; chưa có price authority cho checkout |
| Search/filter | 1/5 | Client operational filters; chưa catalog search/facets/index |
| Cart | 0/5 | Chưa tồn tại; phải xây mới |
| Checkout | 0/5 | Chưa tồn tại; phải xây mới, không có checkout hiện tại cần rewrite |
| Orders | 2/5 | Correction/history/terminal mạnh, nhưng single-item aggregate |
| Shipping | 2/5 | Source allocation và dispatch atomic; chưa delivery methods/rates/package data |
| API | 2/5 | Local service boundary có typed intent/projection; không có HTTP API; reads còn raw domain/repo |
| Frontend | 3/5 | Feature folders, primitives, responsive; quantity và read joins còn coupling cụ thể |

Tổng 16/65 → **1,23/5**, làm tròn 1,2. Không dùng điểm này làm lý do tự triển khai 7 subsystem còn thiếu.

### Responsive evidence

Đã render `/batches`, `/orders/new`, `/orders/order_hung_01` với demo DB cô lập ở **360×900, 768×900, 1280×900**. 9/9 lượt `scrollWidth==viewportWidth`, không uncaught page errors. Kiểm ảnh đại diện mobile form, tablet batch list, desktop order detail: mobile một cột; tablet list hai cột; desktop nav bên trái + detail hai cột. Source dùng `md:grid-cols-2`, `lg:grid-cols-3/12`, `min-w-0` và shared AppShell; không có fork layout theo category.

Bằng chứng local: [script](C:/Users/84387/.codex/general-commerce-audit/audit.mjs), [JSON kết quả và probes](C:/Users/84387/.codex/general-commerce-audit/result.json), [mobile](C:/Users/84387/.codex/general-commerce-audit/new-order-360.png), [tablet](C:/Users/84387/.codex/general-commerce-audit/batches-768.png), [desktop](C:/Users/84387/.codex/general-commerce-audit/detail-1280.png). Các file này không được đóng gói vào repo/GitHub; người chỉ đọc repo vẫn có kết quả và cách tái hiện trong G01/G02. Đây là architecture smoke check, không chứng minh mọi dialog/tap target/keyboard/offline pass.

---

## 3-category Expansion Simulation

Assume we add **Fashion**, **Home goods**, **Tech accessories** cho cùng một chủ hàng, hàng đếm theo chiếc, vẫn giữ cây giống. Không mặc định nhiều vendors, nhiều currencies hoặc marketplace.

| Ngành | Minimum needs | Điều model hiện tại không biểu diễn được |
|---|---|---|
| Fashion | Product group; SKU size/color; stock/price từng SKU | Variety title không phân biệt variant; một đơn không chứa áo và quần |
| Home goods | Item/SKU; material/dimensions mô tả; số tồn; pickup/delivery nếu cần | Không nên đưa width/material thành Batch sinh học; shipment chưa có package/method |
| Tech accessories | SKU connector/compatibility/color; giá từng SKU | Matching theo title không đủ; compatibility attributes chưa có; warranty/serial chỉ thêm nếu yêu cầu |

### What breaks today?

Không phải “thêm chuỗi vào COMMON_VARIETIES” là xong: merchandise bị yêu cầu ươm→đủ bán, quantity UI hiện cây/vạn, allocation theo tên và order một giống. Shipment completion biểu thị rời nguồn, không biểu thị giao tới khách/thanh toán. Cố reuse nguyên record mà đổi copy sẽ làm sai nghĩa nghiệp vụ.

### What works unchanged?

Primitive buttons/dialog/layout, route framework, contact basics, date/number formatting phần không gắn đơn vị, principle reservation không trừ physical stock, atomic re-read/validate/write/history, strict preview confirmation/idempotency và ý tưởng backup validation. Những nguyên tắc dùng lại được; projection/guard hiện tại vẫn cần adapter/line semantics, không tuyên bố code fulfillment chỉ cần đổi tên là dùng nguyên.

### Cost và thay đổi

| Area | Cost | Nội dung |
|---|---|---|
| DB | High | Add catalog products/categories, sellable SKUs, inventory items/lots, order lines; links/indices cho allocation; giữ nursery tables |
| API/service | High | Local commands/projections theo item/line; version authority và history; HTTP thêm mới nếu sản phẩm online được duyệt |
| Owner UI | High | Catalog/SKU/stock forms, picker item, multi-line order và corrections; preserve nursery view |
| Buyer UI | High–Very High | Listing/search/product details/cart/checkout xây mới; không có UI cũ phải rewrite |
| Checkout | High, new build | Chốt stock/price/address/method/payment contract theo requirement; không rewrite checkout hiện hữu |
| Data migration | Medium nếu additive | Legacy single-line adapter, mapping identity có review; giữ Q/F/R/history. High nếu đòi merge tên tự động/đổi mọi order cùng lúc |
| Tests | High | Line/SKU invariants, mixed categories, partial fulfill/cancel, races, stale fingerprints, restore, backward readers |
| Backward compatibility | High | V1 adapters, backup V2, historical marker dispatch; không downlevel reader giả hiểu record mới |
| Carrier/rates | Medium–High nếu cần | Weight/dimensions/shipping method riêng; không cần promotion/free-shipping rules trước khi có chính sách |

Category tree/parent-child/slug chỉ thêm khi cần navigation/URL; flat category ID đủ cho ba nhóm đầu. Category-specific attrs bắt đầu bằng typed definitions cho vài field thực tế: type/allowedValues/filterable. Không cần toàn bộ searchable/display-rules DSL.

---

## Recommended Target Architecture

### Ngay hiện tại

Giữ `domain → service transaction → repositories/Dexie → feature UI`; sửa consistency boundary G01/G02, query service khi chạm, picker G10 khi cần. Không thêm commerce tables trong task audit. Không mất semantics Q/F/O, living/ready/available, stopped≠released hoặc supplier contact≠stock.

### Tối thiểu khi multi-category/SKU được duyệt

```text
CatalogProduct(id, title, categoryId?, description?, status)
  └── SellableItem(id, productId, sku?, optionValues, baseUnit, price?)
         ├── InventoryItem/Lot(id, itemId, onHand, sellable)
         │      └── Nursery Batch + Dossier via explicit link/adapter
         └── OrderLine(id, orderId, itemId,
                       title/options/unit/price/currency snapshots,
                       requestedQuantity)
                 └── Reservation → Shipment allocation by orderLineId

Category: flat first; parentId/slug only when navigation needs them
Category metadata: typed fields only for real attributes
```

- Một sản phẩm không có variants vẫn có một sellable item mặc định. Không nhét inventory vào Product mutable; SKU là authority khi reserve.
- Nursery adapter giữ sống/đủ bán/quá lứa; `sellable` lấy ready theo semantics cây. Hàng mua lại có stock policy riêng, không ép `current≤initial` hay trạng thái propagating.
- External contact vẫn là nguồn cam kết được user xác nhận; không tạo warehouse inventory giả cho supplier.
- Order header giữ customer/common metadata; line giữ snapshot lúc đặt. Historical event giữ nguyên meaning/version. Không suy ngược old shipment no-lines thành line phân bổ chính xác.
- Dispatch stock event riêng khỏi delivery/payment. Chỉ thêm weight/dimensions/method snapshot cho hàng cần giao; pickup/no-shipping là lựa chọn explicit khi requirement tồn tại.
- Cart/checkout ở feature riêng khi có buyer workflow. Không viết `Product` giant interface chứa mọi field của mọi ngành.

### Do not build this yet

**Do not build this yet:** plugin architecture, event sourcing, generic rule engine, promotion DSL, dynamic form builder toàn app, EAV/schema-less product engine, marketplace multi-vendor, microservices, generic repository framework, server/auth/sync chỉ vì “sau này”, attribute display/search DSL, unit-conversion engine, payments/carrier integrations chưa có requirement.

History hiện tại là audit/idempotency record, không phải event-sourced database. Có thể thêm field typed hoặc adapter ngắn; không cần hạ tầng enterprise để thay vài switch.

---

## Migration Plan

### Phase A — Must fix now

**A1 — Patch riêng cho create-order correctness (G01/G02).** Không generalize catalog/order, không thay domain lifecycle hoặc PR FC5-1. Nên triển khai sau khi thống nhất base của patch, với review riêng; không dùng audit này đổi trạng thái FC5.

Files cần sửa:

- [orderService.ts](D:/Project-17/VuonUom/web/src/services/orderService.ts:88): validate numeric input, read/validate customer tại transaction, atomic order/event, Undo sau commit.
- [orderService.test.ts](D:/Project-17/VuonUom/web/src/services/__tests__/orderService.test.ts:39): real Dexie regressions mới.
- Chỉ cập nhật tài liệu/state của patch khi triển khai thật. Không cần sửa `db.ts`, backup validator, schema/index hoặc dependencies.

Dependency/order:

1. Viết failing regressions cho event failure/no ghost order/retry và unsafe numbers/no write.
2. Guard quantity positive safe integer và price optional nonnegative safe integer. Chốt reject fractional/unsafe input rõ, không âm thầm rounding dữ liệu sai; giữ parser cây/vạn cho form trước service boundary.
3. Tạo `rw` transaction trên orders/events/contacts và các bảng inventory dùng đọc availability (batches/reservations). Re-read customer, tính feedback và lưu order/event trong boundary nhất quán; repositories phải join transaction hiện hành như contact service hiện tại.
4. Đăng ký Undo sau thành công; failure giữ form nhưng phải không có order mới/event mới. Không xóa Undo khác một cách tùy tiện.
5. Chạy targeted service/UI tests rồi full typecheck/lint/test/build từ `web`; kiểm tạo đơn→reload→reserve và backup sau tạo đơn hợp lệ. Exact-head CI trước merge patch.

Tests bắt buộc:

| Regression | Expected |
|---|---|
| Event write failure | Order/event không commit; stock/reservations không đổi; không đăng ký Undo mới |
| Order write failure | Không event; caller failure; retry tạo đúng một order/event của lần thành công |
| Failure rồi retry cùng form | Không tồn tại order “ghost” của lần thất bại |
| Quantity 0/negative/NaN/Infinity/unsafe integer/fractional | Reject trước write; không clamp/làm tròn ở service |
| Price undefined/0/valid integer | Giữ semantics optional/zero/valid |
| Price NaN/Infinity/negative/unsafe/fractional | Reject trước write, contract phù hợp edit |
| Customer biến mất trước commit | Fail không ghi order thiếu reference |
| Happy path / availability feedback | Status open, history đúng, Undo sau commit, không reserve hoặc giảm physical stock |
| Backup/export→restore sau create hợp lệ | Round-trip được, không nới guards để chấp nhận Infinity |

Migration strategy: **không cần migration**. Existing invalid records, nếu có, cần inspection/repair explicit; patch không tự sửa stock/order lịch sử.

Rollback risks: revert code không có schema downgrade; nhưng rollback sẽ tái mở lỗi ghost/unsafe input. Transaction phải bao đủ tables để không phát sinh `NotFoundError`/nested incompatibility; test bằng real Dexie. Feedback failure nay rollback order thay vì báo failure sau partial save — đây là thay đổi có chủ đích. Không thêm operationId toàn create flow chỉ để vá event rollback; duplicate intentional create là bài toán khác.

**Không có P0/P1 architectural refactor bắt buộc triển khai ngay vì ba ngành giả định.** A1 là correctness đã tái hiện, không phải requirement mới general commerce.

### Phase B — Fix when touched

1. **G10:** sửa picker theo dữ liệu/draft khi hỗ trợ custom variety trong create flow. Test option nhìn thấy = submitted value; query prefill; giống từ batch mới; giữ existing default UX.
2. **G07:** một named query service mỗi screen khi sửa read flow; DTO derive tập trung, maps/index thay repeated scans. Benchmark khi data tăng; không thay authority transaction.
3. **G05/G08:** tách quantity adapter và normalized source unions khi một feature thực sự cần đơn vị/source khác; parser legacy bảo toàn optional F/lines, không xóa compatibility để compile sạch.
4. Đồng bộ công thức/schema trong skills với FC0/FC3/FC5 khi cập nhật tài liệu liên quan.

Các patch Phase B độc lập, không sweep styling, không block FC5 bởi một catalog roadmap chưa được duyệt.

### Phase C — Only build when product requires it

G03/G04 là prerequisite của SKU/multi-line thật. Thứ tự additive khi expansion được duyệt:

1. **Contract trước:** xác nhận buyer hay owner operations; stable item identity, base unit, line coverage/ship/cancel/close, money snapshots và current stock authority. Giữ nursery invariants hiện hành.
2. **Add structures:** version Dexie tiếp theo, catalog/items/inventory/orderLines và mapping tables/links; giữ toàn bộ legacy fields/tables. Version backup mới cùng thời điểm, include/references/restore transaction cho bảng mới.
3. **Legacy adapter + migration:** mỗi order cũ là một legacy line; map item identity có review, giữ exact label snapshots. Stable migration IDs, re-run/reopen an toàn; không auto-merge grades/SKUs bằng text, không giả shipment lines thiếu trong legacy.
4. **Transition reads/writes:** chọn discriminator/feature boundary rõ cho order cũ/mới. Nếu mirror legacy fields và line cùng biểu diễn một fact, cập nhật atomic và kiểm equality; không có hai authority tùy screen. Với order thật nhiều item, old single-line commands fail closed và chuyển tới command mới, không gán tổng hỗn hợp vào `requestedQuantity` cũ.
5. **Allocation/corrections:** add demand-line links, item/source validation và fingerprint facts; test per-line coverage, planned guards, mixed own/external, transfer, partial shipping/closure. V1 event/marker retry dispatch theo version, preserve semantics, không rewrite lịch sử.
6. **Switch UI/query reads** sau comparison tests trên fixtures legacy + mới. Owner nursery view tiếp tục hoạt động; catalog/product/SKU UI compose riêng. Buyer cart/checkout chỉ khi scope riêng được duyệt.
7. **Remove legacy representation** chỉ sau khi mọi reader/exporter/marker adapter được kiểm, có backup và release policy. Không drop ngay để “dọn sạch”.

Likely files khi Phase C được duyệt (surface để lập task, không phải danh sách sửa hôm nay):

- `D:/Project-17/VuonUom/web/src/data/db.ts`, `data/backup/backup.{types,normalize,validate,export,restore}.ts`, `data/__tests__/{migration,backup}.test.ts`.
- `D:/Project-17/VuonUom/web/src/domain/{batch,order,reservation,shipment,reconciliation,batchReconciliation,orderCompletion}.ts` cùng các model catalog/line mới.
- `D:/Project-17/VuonUom/web/src/services/{order,reservation,shipment,reconciliation,batchReconciliation,orderCompletion,undo}Service.ts` và query services/repositories tương ứng.
- `D:/Project-17/VuonUom/web/src/features/{orders,batches,shipments,reconciliation}`; catalog/buyer feature mới nếu được duyệt; quantity adapter riêng.

Migration tests: v1/v3/v5→version mới giữ IDs/Q/F/R/stock/history; deterministic mapping; re-open/retry; backup V1 import + V2 round-trip; corrupted item/line references rejected; old reader rejects V2; unchanged historical operationId retry; race/stale/rollback cho multi-line; no wrong-SKU allocation; metadata-only edit không overwrite stale untouched fields.

Rollback: trước schema upgrade lưu backup phù hợp; dùng feature rollback giữ adapter/new tables, không downgrade IndexedDB bằng binary cũ. Legacy V1 không bảo toàn dữ liệu SKU/multi-line mới; không restore V1 đè workspace mới như một “rollback” an toàn. Destructive cleanup là release riêng có migration evidence.

---

## Final Verdict

1. **Is the current architecture dangerously niche-locked?** Không ở mức phải rewrite ngay để tiếp tục Vườn Ươm. Có coupling sâu ở string identity và single-line fulfillment; chưa general-ready và không thể cam kết expansion chỉ bằng thêm category/đổi copy.
2. **Can we continue building features safely?** Có thể tiếp tục roadmap nursery theo contract/acceptance, nhưng cần patch G01/G02 riêng cho boundary tạo đơn đã tái hiện lỗi. Audit không đóng FC5 hoặc xác nhận field pilot.
3. **What are the 3 highest-leverage changes?** Vá create-order transaction/validation; thêm stable sellable identity trước SKU/grade-sensitive feature; thêm demand-line authority + legacy adapter trước multi-item commerce. Read-query extraction là improvement nhỏ theo từng lần chạm, không prerequisite rewrite toàn app.
4. **What should we deliberately NOT build?** Marketplace/backend/plugin/event sourcing/rule engine/EAV/promotion DSL/forms động/microservices cho tương lai giả định. Giữ nursery UI và Dossier; không generalize bằng cách xóa sự khác nhau giữa living, ready, available và commitments.
5. **If we do nothing, what is most likely to hurt us in 6–12 months?** Trước hết là ghost order/invalid-number boundary; tiếp theo là số chỗ dùng variety làm identity và order-level totals tăng theo feature, khiến SKU/multi-line migration đắt hơn. Nếu scope vẫn nursery một giống/một đơn, thiếu cart/category/checkout không tự trở thành technical debt.

**Niche-first: phù hợp. General-ready: chưa đạt.** Giữ hướng mở rộng bằng prerequisite cụ thể và migration additive khi có nhu cầu thật; hiện tại audit + patch correctness plan là mức thay đổi đủ căn cứ.
