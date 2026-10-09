# Vườn Ươm V2 — Screen & Workflow Audit

Ngày: 09/10/2026. **AUDIT INPUT UPDATED FOR V2 ROADMAP / NO UI IMPLEMENTED BY THIS REPORT**.

Authority hiện hành: [V2 Roadmap](V2-ROADMAP.md), [V2-A Contract](V2-A-FUNCTIONAL-CONTRACT.md). FC5/FC6 SUPERSEDED; cleanup → A → B → real pilot. C/D/E cần evidence và scope riêng.

Snapshot: `feat/fc5-close-remaining-domain`, HEAD `ac68325b8deab6445e833b6f7c78c28fa97f9484`, base `0d8d97a7254998ac84c7fedc087724f8ccc44da2`. Đây là snapshot audit trước reset, không phải merged baseline V2. Baseline V2: main `0d8d97a`; FC0–FC4 DONE, FC5-1 preserved/not adopted. Những mô tả service/enum FC5 ở snapshot không là V2 dependencies.

Nguồn: competitive teardown do người dùng cung cấp trong [pasted text](<C:/Users/84387/.codex/attachments/3a7ca752-f7d2-46e6-a65e-8192fbd784aa/Pasted text.txt>). Bản nguồn chứa tên sản phẩm, reference placeholder và ví dụ màn hình; thiếu URL/screenshot đủ để kiểm chứng độc lập từng claim. Audit này đối chiếu ý tưởng với code, không tuyên bố đã verify lại 10 sản phẩm hoặc chứng minh product-market fit.

Đọc cùng: [General-Commerce Readiness Audit](D:/Project-17/VuonUom/docs/architecture/GENERAL-COMMERCE-READINESS-AUDIT.md), [V2 Information Architecture](D:/Project-17/VuonUom/docs/product/V2-INFORMATION-ARCHITECTURE.md), [V2 Route & Component Map](D:/Project-17/VuonUom/docs/product/V2-ROUTE-COMPONENT-MAP.md).

## 1. Kết luận

Hướng **vườn → cây còn bán → khách hỏi → giữ cây → xuất cây** phù hợp core đang tồn tại. Chủ vườn có thể thấy cây còn bán, ghi đơn, giữ own/external, điều chỉnh nguồn, lên chuyến và xuất từng phần. Không cần xây lại những mutation này để đổi bố cục.

Phần **size/vị trí/tình trạng chi tiết → giá theo khách → công nợ → public live link** chưa có authority trong model. Nó là product expansion, không phải UI patch. Teardown giúp chọn giả thuyết để kiểm chứng; không tự biến chín màn hình minh họa thành requirements.

Ưu tiên bản thiết kế: Availability làm điểm vào; dùng lại lô/đơn/chuyến và guards; phân biệt rõ nhóm chỉ đọc trên dữ liệu hiện tại với nhóm cần contract/schema mới. Chưa có căn cứ bắt buộc một generic-commerce engine trước pilot.

## 2. Kiến trúc và luồng thực tế

```text
IndexedDB / Dexie v5
  contacts, batches, orders, reservations, shipments, dossiers, events
       ↓ repositories + transaction services
Pure domain quantity / lifecycle / reconciliation / shipment
       ↓ local TypeScript service API; một số screen tự join read models
React useState/useEffect → reload current DB sau mutation
       ↓
Today / Batch / Order / Reservation / Shipment / Dossier / More
```

Không có backend, public catalog publisher, request inbox, Product/Variant/Location/Payment tables. Contact không phải tài khoản; supplier không phải kho có tồn xác minh.

Evidence anchors:

- [VuonUomDatabase](D:/Project-17/VuonUom/web/src/data/db.ts:19): tables/indexes/upgrades.
- [NAV_ITEMS](D:/Project-17/VuonUom/web/src/shared/navigation.ts:10), [router](D:/Project-17/VuonUom/web/src/app/router.tsx:137): bốn tab, các route đang chạy.
- [Batch](D:/Project-17/VuonUom/web/src/domain/batch.ts:9), [Order](D:/Project-17/VuonUom/web/src/domain/order.ts:13), [Reservation](D:/Project-17/VuonUom/web/src/domain/reservation.ts:12), [Shipment](D:/Project-17/VuonUom/web/src/domain/shipment.ts:16): lô sinh học, đơn một giống, nguồn giữ, chuyến xuất.
- [quantity helpers](D:/Project-17/VuonUom/web/src/domain/quantity.ts:70), [coverage helpers](D:/Project-17/VuonUom/web/src/domain/order.ts:60): canonical stock/commitment authority.

## 3. Ma trận chín màn hình

Các mức: **CÓ** = implementation trong snapshot; **ĐỀ XUẤT READ/UI** = có dữ liệu đủ cho một slice riêng nếu duyệt; **CẦN DOMAIN** = không thể làm bằng copy/layout; **CẦN PUBLISHING** = thêm boundary chia sẻ ra thiết bị khác.

| Màn hình teardown | Code/flow hiện tại | Có thể dùng lại | Gap và quyết định |
|---|---|---|---|
| 1. Hôm nay | [TodayScreen.fetchData](D:/Project-17/VuonUom/web/src/features/today/TodayScreen.tsx:43), `totalAvailable`, attention orders/batches, planned shipments | Cây còn bán, cảnh báo quá lứa/thiếu nguồn, chuyến chờ xuất, tạo đơn | **CÓ + ĐỀ XUẤT READ/UI**: ưu tiên availability và link đúng queue. Không hiện cây yếu, giữ quá hạn, công nợ hoặc số giống/size giả vì thiếu dữ liệu |
| 2. Vườn / Availability | [BatchesScreen.fetchData](D:/Project-17/VuonUom/web/src/features/batches/BatchesScreen.tsx:46), BatchCard, filters ready/attention/propagating | Cây còn bán từng lô, O đang giữ, tuổi lô, drill-down | **ĐỀ XUẤT READ/UI**: nhóm giống tạm bằng legacy labels, tìm tên/mã lô. Size/location/condition/giá bán chung **CẦN DOMAIN**; không coi variety group là SKU |
| 3. Chi tiết cây | Chưa có item detail; BatchDetail là một lô, không phải toàn giống/SKU | Batch list/query projection có thể làm trang nhóm chỉ đọc | **CẦN DOMAIN** cho item/variant detail bền vững. Chưa tạo product route giả nhận batch ID; prices theo đại lý và ảnh không có model |
| 4. Batch/Lô | [BatchDetailScreen](D:/Project-17/VuonUom/web/src/features/batches/BatchDetailScreen.tsx:48), inventory/ready/reconciliation modals, dossier/history | Living/ready/available/O/shortage; số trước/sau; source history | **CÓ**. Move cây, size, condition buckets, ảnh **CẦN DOMAIN**. FC3 transfer là chuyển cam kết, không phải chuyển cây vật lý |
| 5. Cập nhật nhanh | InventoryUpdateModal, ReadyQuantityUpdateModal, BatchNewScreen đang là entry riêng | Cho chọn lô → kiểm kê hoặc cập nhật cây đủ bán; “thêm lô mới” | **ĐỀ XUẤT READ/UI**: action chooser mở flow cũ. Không gọi absolute kiểm kê là “hao hụt delta”; không bật move/size/photo/restock nếu chưa có command |
| 6. Đơn | [OrdersScreen](D:/Project-17/VuonUom/web/src/features/orders/OrdersScreen.tsx:33), detail/new/edit/cancel/reserve/reconciliation/shipment | Existing create→edit→reserve→conflict→reconcile→planned→confirm; giữ history/stale guards | **CÓ**. Quote/draft, multi-line, đặt cọc/payment/debt **CẦN DOMAIN**. Close remaining chỉ có ở branch FC5-1 preserved/not adopted; không nằm trong active V2 roadmap |
| 7. Khách hàng | [Contact](D:/Project-17/VuonUom/web/src/domain/contact.ts:5), quick-create và lookup trong order | Name/phone/roles; lấy đơn/history để làm danh sách khách chỉ đọc; gọi/tạo đơn | **ĐỀ XUẤT READ/UI** cho customer list/detail. Không có customer pricing, tiền đã trả/nợ hoặc collect-payment service; **CẦN DOMAIN** |
| 8. Bảng hàng / Share | Chưa có screen/service; local availability helpers đã có | Owner tạo bảng text từ cây còn bán, xem trước, sao chép/share thủ công | **ĐỀ XUẤT LOCAL SHARE**. Public URL/anonymous requests **CẦN PUBLISHING**. URL vào localhost/PWA owner không đọc được IndexedDB trên máy khách |
| 9. Thêm | [MoreScreen](D:/Project-17/VuonUom/web/src/features/more/MoreScreen.tsx:42): shipment entry, backup/restore, mode/demo, pilot tools | Owner settings, sổ chuyến, backup, validation/pilot support | **CÓ**. Không thêm menu purchasing/thu chi/staff/integrations rỗng. Hiện supplier tạo nhanh qua reserve; không có purchasing ledger |

### Năm câu hỏi V1 trong teardown có được đáp ứng chưa?

| Câu hỏi | Kết quả từ source |
|---|---|
| Tồn thực tế bao nhiêu? | Có living từng lô; không bao gồm nguồn ngoài như tồn own |
| Ở đâu? | Chưa có Location authority; source note không thay thế location/movement |
| Trạng thái/size nào? | Ready/living/tuổi lô có; size/grade/condition breakdown chưa có |
| Khách đã giữ/mua gì? | Order/reservation/completed shipments có; “mua” không chứng minh đã thanh toán/khách nhận |
| Tiền/công nợ? | Chỉ optional quoted `Order.unitPrice`; không payment/debt ledger |

Vì vậy không ghi “V1 đã đủ cả năm câu hỏi” dựa trên dashboard copy.

## 4. Audit từng workflow

| Workflow | Current authority | Hardening phải giữ / dependency |
|---|---|---|
| Xem cây còn bán → chọn lô → ghi đơn | Per-batch availability → `createOrder()` → reserve explicit | Create không tự giữ từ `batchId` query; fix custom variety picker và create-order safety được ghi trong audit trước |
| Đơn → giữ own hoặc external | `reserveOwnBatch()` / `reserveExternalSupplier()` | Current coverage gồm F released; own source phải cùng giống; external explicit quantity/acknowledgement, không estimated stock |
| Giảm đơn dưới coverage | `OrderEditModal` → Trigger A reconciliation | Không `updateOrder()` trước; chọn nguồn rõ; planned P guard; metadata draft lưu riêng sau reload |
| Kiểm kê làm thiếu cây đã giữ | Inventory/ready update → BatchDetail warning → Trigger B | Cho ghi shortage thật; partial repair nói shortage còn lại; transfer không move cây giữa vị trí |
| Planned → completed shipment | `createShipment()` / `confirmShipment()` | Re-read source/order/stock; own mới trừ physical stock; external/mixed copy đúng own effect; completed ≠ customer receipt |
| Hủy đơn trước xuất | `cancelOrder()` + cancellation preview | Atomic release O/cancel planned, giữ history; shipment mới sau preview buộc reconfirm/không whole-cancel |
| Dừng còn lại sau xuất một phần | FC5-1 `previewCloseOrderRemaining()` / `closeOrderRemaining()` | Capability FC5-1 preserved/not adopted, ngoài V2-A/B và không prerequisite. Giữ R/Q/F/stock/history; stopped khác released |
| Thu tiền/ghi nợ | Không tồn tại | Contract money/billing/payment/reversal/idempotency trước; không suy ra `paid=0` từ thiếu field |
| Chuyển cây giữa A2/B1 | Không tồn tại | Whole-batch location assignment khác partial stock movement; partial move cần authority số lượng từng nơi, allocations/history/backup |
| Chia bảng qua Zalo | Chưa tồn tại | Local snapshot trước; public publisher sau scope riêng. Yêu cầu khách ≠ reservation; owner validate authority khi giữ |

## 5. Corrections bắt buộc cho blueprint

### 5.1 Availability không phải một phân loại vật lý cộng thẳng

Giữ canonical: `available_b=max(ready_b−O_b,0)`, `shortage_b=max(O_b−ready_b,0)`. `Đang giữ` trên lô là O active còn outstanding; coverage order C có F của nguồn released. `Thiếu nguồn` và `Còn phải xuất` khác nhau.

Tổng theo giống phải **sum availability từng lô**, không lấy `max(sum ready−sum O,0)` để che shortage một lô bằng nguồn lô khác. Ví dụ A ready15/O18 → available0/shortage3; B ready20/O5 → available15/shortage0. Summary đúng: available15, shortage3; không tự báo available12 hoặc tự reconcile nguồn.

### 5.2 Sửa hai ví dụ số lượng

Teardown viết “Tổng thực tế 1.240”, gồm available720 + giữ180 + dưỡng270 + yếu40 + hao hụt30. Nếu dưỡng/yếu là các nhóm sống không trùng nhau và chưa đủ bán, tổng sống ở ví dụ là **1.210**, ready900, O180, available720. Hao hụt30 là lịch sử, nằm ngoài tồn sống hiện tại. Initial1.240 chỉ suy ra được nếu giả định chưa xuất/thêm/chuyển ra và không có adjustment khác. Không dùng giả định này làm công thức thực tế cho lô đã có shipment.

Ví dụ Batch320 = available210 + dưỡng65 + yếu20 + loss25 cũng tương tự: nếu không có O/shipment và các nhóm rời nhau, **initial320/living295/ready210/available210**, loss25 ghi lịch sử riêng. Không gắn label “320 cây hiện có” rồi cộng cây chết vào đó.

Hiện model chưa phân chia dưỡng/yếu, nên interim chỉ hiển thị `Chưa đủ bán = living−ready`; không rename toàn phần này thành “đang dưỡng” hoặc “yếu”. Readiness, condition, location và reservation là các chiều khác nhau; cần contract nếu thêm bucket để không đếm trùng.

### 5.3 Tách fulfillment khỏi tài chính

Không thay `OrderStatus` bằng chuỗi `Nháp/Báo giá/Đang giữ/Chờ giao/Còn nợ/Hoàn tất` trong một enum. Một đơn có thể **đã xuất đủ và còn nợ**; đơn chưa xuất cũng có thể đã nhận cọc. Draft/quote là commercial intent; shipment/cancellation là fulfillment (closed_remaining chỉ trong contract FC5 tham khảo); payment là chiều độc lập chưa có.

“Đã xuất” là sự kiện rời nguồn đang được kiểm chứng; không tự claim khách đã nhận hoặc đã thu tiền. Customer-specific price không derive từ một đơn cũ bất kỳ; cần chính sách giá riêng nếu triển khai.

### 5.4 Snapshot share khác live/public link

Đề xuất bước đầu: bảng hàng trên owner device, ghi **“Bảng tạo lúc … từ dữ liệu trên máy”**, snapshot quantities và chỉ fields chủ vườn muốn chia sẻ. Không gọi đây là “live” hoặc “đã đồng bộ”; generated-at không chứng minh lần kiểm kê gần nhất.

Public link cần published snapshot/service và expiry/revocation; request inbox cần transport về owner, dedup và confirmation. Khách không có account vẫn cần một nơi đọc/gửi dữ liệu. Không share workspace backup chứa contacts/history như một catalog; không tự reserve từ request ngoài máy.

### 5.5 Navigation và lộ trình

Prototype đang có bốn tab. Năm tab trong teardown là giả thuyết V2, không phải acceptance đã duyệt. IA đề xuất ban đầu giữ `Hôm nay | Vườn | Đơn | Thêm`, customer là entry từ Đơn/Thêm; đo usage trước khi đưa Khách lên tab thứ năm. Không đổi nav trong task docs.

Chỉ thị roadmap mới đã supersede FC5/FC6, giữ FC0–FC4. Thứ tự: cleanup G01/G02/G10 → V2-A1/A2/A3/A4 → V2-B1/B2 → real pilot. C/D/E là hypotheses sau pilot, không mặc định phải xây. Teardown không tự reset foundation hoặc domain contracts.

## 6. Reference → quyết định thiết kế

Đây là mapping ý tưởng trong tài liệu người dùng, không là endorsement hoặc xác minh tính năng vendor.

| Reference được nêu | Concept giữ làm hypothesis | Quyết định trên codebase |
|---|---|---|
| Rundoo | Search nhanh, quote/hold/account workflow | Reuse order/reserve trước; quote/payment contract sau; không POS-first |
| Tend | Availability khác on-hand/committed, lot | Canonical ready/O/available/shortage; không thêm incoming/expired metrics chưa có facts |
| Sprouts OS / Faceworks | Location/production/condition map | Phân biệt whole-batch label và partial movement; không menu ERP |
| MyPlantShop | Ít nghiệp vụ thường dùng, price theo khách | Customer queries tối thiểu; pricing policy sau evidence |
| KiotViet/Sapo | Action dễ thấy, search/mobile navigation/share | Tap targets/quick entry, không copy checkout model; nav 4 trước; local share trước |
| VUCX | Movement vật lý | Cần stock-location authority mới; không gọi FC3 transfer là move |
| Lightspeed | Stable item/variant identity | Gate trước size/SKU thật, incremental adapter; không generic engine rewrite hôm nay |
| MISA | Integration sau PMF | Không tự kế toán/HĐĐT/payment gateway trong prototype |

## 7. Scope và bằng chứng sử dụng

**Scope V2-A/B trong roadmap:** Availability read model/hero, search giống+mã lô, quick entry cho kiểm kê/ready/thêm lô, customer read-only, local table share. Triển khai theo từng slice/gate của roadmap sau cleanup; reset này chỉ docs/contracts, không code toàn bộ scope. Ba contract read đã khóa tại V2-A Contract.

**Cần functional contract/migration:** item/variant/size, location partial movement, condition buckets, catalog/customer prices, quote/draft, multi-item orders, payment/debt, photo storage/backup, public publishing/request intake. Không dùng placeholder data hay zero values để làm chúng trông đã hoạt động.

Các G01/G02 correctness findings ở audit trước đã DONE / CLOSED qua [PR #32](https://github.com/17thedevv/VuonUomSo/pull/32), merge `9c29fa2beea57bd82eb74a4b88c5b79987acefb1`, [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37934810940). G10 custom variety picker đã DONE / CLOSED qua [PR #33](https://github.com/17thedevv/VuonUomSo/pull/33), merge `87d918d02ee5cbb22bb1e76475292fab4b7fdae2`, [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37946122446). V2-A1 read model DONE / CLOSED qua [PR #35](https://github.com/17thedevv/VuonUomSo/pull/35), [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37952987463); V2-A2 NEXT duy nhất; Garden UI chưa triển khai. Previous audit test/browser evidence không phải bằng chứng acceptance cho UI V2 chưa tồn tại.

Product validation tiếp theo: quan sát chủ vườn trả lời “giờ còn bán gì?”/tìm lô/ghi đơn thật; đo số bước và điểm sai nghĩa; thử bảng text họ tự gửi Zalo; hỏi size/vị trí/công nợ có gây thao tác lặp thực tế không. Teardown không chứng minh những module đó nằm trên critical path PMF.

## 8. Handoff

1. Dùng [IA](D:/Project-17/VuonUom/docs/product/V2-INFORMATION-ARCHITECTURE.md) để review ưu tiên/thứ tự thông tin.
2. Dùng [route/component map](D:/Project-17/VuonUom/docs/product/V2-ROUTE-COMPONENT-MAP.md) để chia patch sau khi scope được duyệt.
3. Theo V2 Roadmap/PROJECT_STATE: cleanup trước V2-A1, A/B trước real pilot; FC5/FC6 không prerequisite. Không expose FC5-1 hoặc mở C/D/E/backend bằng reset docs.
