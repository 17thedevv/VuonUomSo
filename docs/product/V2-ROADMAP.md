# Vườn Ươm — V2 Roadmap

Ngày quyết định: **09/10/2026**. **V2-0 — ROADMAP RESET + CONTRACT FREEZE**.

Chỉ thị trực tiếp của người dùng thay thế delivery order FC5 → FC6. Trạng thái task/merge xem tại [.agent/PROJECT_STATE.md](../../.agent/PROJECT_STATE.md). Roadmap này không tuyên bố đã triển khai hoặc nghiệm thu UI V2.

## 1. Baseline và quyết định supersede

- Base merged: `0d8d97a7254998ac84c7fedc087724f8ccc44da2`; FC0–FC4 **DONE / CLOSED**. Contract số lượng, transaction, history, backup và Undo đã có vẫn được giữ.
- FC5 và FC6: **SUPERSEDED BY V2**, không còn prerequisite hoặc task NEXT. Không đánh dấu chúng DONE.
- FC5-0 đã merge là bằng chứng lịch sử; contract FC5 được giữ làm tài liệu tham khảo, không buộc hoàn thành close remaining trước V2.
- FC5-1 ở `feat/fc5-close-remaining-domain`, head `ac68325b8deab6445e833b6f7c78c28fa97f9484`, [PR #29](https://github.com/17thedevv/VuonUomSo/pull/29): **PRESERVED / NOT ADOPTED / OUT OF ACTIVE ROADMAP**. Giữ nguyên code/branch để tham khảo; reset này không merge, xóa hoặc đóng PR đó. V2 không import `closeOrderRemaining()`, thêm `closed_remaining` hoặc dựa vào terminal guards chưa merge. Muốn dùng lại phải mở một task correctness/capability riêng với review theo hướng sản phẩm mới.
- **V2-0 MERGED / CLOSED** qua [PR #30](https://github.com/17thedevv/VuonUomSo/pull/30), merge `85415ceaaff3b152e53c4a8df5552af3d335e0ee`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37935872623). Reset đã có hiệu lực trên main.
- **G01/G02 DONE / CLOSED**: [PR #32](https://github.com/17thedevv/VuonUomSo/pull/32), reviewed head `e57cf29c5ed4da550048c7efae1b4e36c9dfda34`, merged `9c29fa2beea57bd82eb74a4b88c5b79987acefb1` lúc `2026-10-09T13:09:03Z`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37934810940), typecheck/lint/full tests/build PASS.
- **G10 DONE / CLOSED**: [PR #33](https://github.com/17thedevv/VuonUomSo/pull/33), reviewed head `3bf2cdafdd48dc690c9d1fb3b39197cd5f3b956f`, merged `87d918d02ee5cbb22bb1e76475292fab4b7fdae2` lúc `2026-10-09T14:41:55Z`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37946122446), typecheck/lint/full tests/build PASS.
- **V2-A1 NEXT — DUY NHẤT**; chưa triển khai. V2-A2/A3/A4 QUEUED; V2-B1/B2 PLANNED.

```text
V2-0: reset roadmap + freeze contract (MERGED / CLOSED, #30)
  → G01/G02 (DONE / CLOSED, #32 merged)
  → G10 (DONE / CLOSED, #33 merged)
  → V2-A1 (NEXT duy nhất) → V2-A2 → V2-A3 → V2-A4
  → V2-B1 → V2-B2
  → REAL PILOT / STOP FEATURE BUILD
  → evidence decides C / D / E
```

## 2. Correctness cleanup trước V2-A

Nguồn và cách tái hiện: [readiness audit](../architecture/GENERAL-COMMERCE-READINESS-AUDIT.md). Mỗi patch có phạm vi và regression riêng; không refactor reservation engine hoặc đưa FC5-1 vào main qua cleanup.

| Gate | Trạng thái | Patch hẹp | Điều kiện đóng |
|---|---|---|---|
| **G01** | **DONE / CLOSED (#32)** | Atomic create order + required event/feedback reads | Real Dexie event/read failure không lưu order một phần; retry không nhân đôi order vì lần thất bại trước đã ghi dữ liệu; Undo intent chỉ capture sau commit thành công |
| **G02** | **DONE / CLOSED (#32)** | Validate create quantity/optional price tại service boundary | Quantity nguyên an toàn dương; price nếu có là số nguyên an toàn không âm, khớp edit boundary hiện có; NaN/Infinity/phân số/out-of-range reject trước write. Không tạo financial authority mới |
| **G10** | **DONE / CLOSED (#33)** | Picker giống phản ánh common options + dữ liệu lô + intentional draft/custom value | Batch Monthong → Ghi đơn: label nhìn thấy = variety submitted; query prefill không bị select đổi ngầm sang giống khác; default/common flow giữ được |

G01/G02 đã đóng qua PR #32; G10 đã đóng qua PR #33 với regression và merge CI xanh. Correctness cleanup hoàn tất; V2-A1 là NEXT duy nhất theo frozen contract. Không mở Product/Variant chỉ để sửa picker.

## 3. V2-A — Availability & Quick Update

Mục tiêu: chủ vườn biết ngay còn bán được cây gì, tìm đúng lô và cập nhật số thực tế nhanh.

[V2-A Functional Contract](V2-A-FUNCTIONAL-CONTRACT.md) khóa ba quyết định trước code: legacy grouping, coherent IndexedDB read snapshot, available ≠ ready. Dùng living/ready/O/available/shortage từ authority FC0–FC4. Không schema rewrite, Product/Variant/Location/Size/payment/public URL.

| Slice | Outcome / surface | Acceptance riêng |
|---|---|---|
| **V2-A1** | `gardenQueryService` + read DTO, nhóm giống sau khi derive từng lô | Real Dexie snapshot + normalization regressions; A ready15/O18 và B ready20/O5 → available15/shortage3; không write |
| **V2-A2** | `/garden`, GardenAvailabilityScreen, AvailabilitySummary, VarietyAvailabilityCard, search/filter giống + mã lô | Tìm Monthong → thấy lô + đúng available/O/shortage → mở đúng batch ID; default Cây còn bán/Tất cả/empty/error rõ |
| **V2-A3** | QuickUpdateChooser composition | Chọn lô → Kiểm kê số sống / Cập nhật cây đủ bán; Thêm lô mới vào flow cũ. Preview before/after giữ nguyên; ready≤living; shortage không chặn kiểm kê |
| **V2-A4** | Today → Availability; tab Vườn; Garden → Batch/Ghi đơn | Giữ bốn tab Hôm nay/Vườn/Đơn/Thêm, URLs lô/đơn/chuyến cũ, back/search/filter; update rồi quay lại reload DB; create không auto-reserve |

Gate toàn V2-A: mở app → tổng **Cây còn bán** → tìm Monthong → chọn đúng lô → kiểm kê/cập nhật ready → quay lại → Availability phản ánh current authority. Browser 360/390/430/1280px, keyboard viewport và core flow regressions; không suy ra physical IME/offline PWA từ browser.

Không redesign Order Detail, làm delta mortality, move cây, condition buckets hoặc sửa/hủy workflow mới để hoàn thành A. Mỗi slice review/CI/tích hợp trước slice phụ thuộc nó.

## 4. V2-B — Local bảng hàng + Customer read

Chỉ bắt đầu khi V2-A đã nghiệm thu; vẫn không thêm schema.

| Slice | Routes / flow | Authority và giới hạn |
|---|---|---|
| **V2-B1** | `/garden/share`: availability hiện tại → chọn giống/lô → preview → text → Copy/Web Share → owner tự gửi Zalo | Owner-local snapshot, tên vườn + thời điểm tạo bảng; preview-copy parity. Không public URL/backend/inbox/auto-reserve; không export raw backup, contact/private history hoặc suy giá từ đơn cũ |
| **V2-B2** | `/customers`, `/customers/:id`: tên/phone → đơn → O chưa xuất → lịch sử đã xuất | Customer role + existing order/reservation/completed shipments; O không phải historical Q/C. Read views, links/gọi/entry Ghi đơn dùng flow cũ; không giá khách/đã trả/công nợ/thu tiền |

Web Share không được hỗ trợ/hủy/chưa có Clipboard API phải có copy/manual fallback và không tạo write. Nội dung bảng là snapshot từ máy owner, không gọi live/synced hoặc bảo đảm giữ hàng cho người nhận. Quantity thay sau preview không làm nội dung đang copy lệch preview; muốn bảng mới phải refresh/preview lại. Tạo bảng/copy/share không thay order/reservation/stock/event nghiệp vụ.

Customer read phải phân biệt được hai đơn cùng khách có cùng số lượng/ngày bằng một nhãn ổn định từ existing ID với collision handling; không thêm mã đơn vào schema. Link tới order giữ đúng ID và history; thiếu phone không giả số hoặc ngăn dùng các read views.

## 5. REAL PILOT ngay sau V2-B

**STOP FEATURE BUILD** sau B. Pilot không chờ C/D/E, cũng không quay lại chờ FC5/FC6. Correctness fixes phát hiện trong pilot vẫn được phép; feature mới cần evidence và một task riêng.

Thử trên điện thoại thật với số liệu vườn thật; ghi từng task, thiết bị/phiên bản, thành công độc lập hay cần trợ giúp:

1. “Giờ còn bán gì?”
2. “Monthong nằm lô nào?”
3. “Có 20 cây chết / chưa đủ bán thì cập nhật thế nào?”
4. “Khách hỏi 200 cây thì ghi thế nào?”
5. “Bảng nào anh/chị đang gửi Zalo?”

Đo **time-to-answer**, số tap, số lần chọn sai lô, số lần nhầm ready/available, số lần quay lại Excel và loại thông tin phải ghi ngoài app. Task 3 dùng existing absolute update sau khi chủ vườn xác định số thực tế, không giả đã có delta command.

Chưa có ngưỡng thời gian/tap được chứng minh; ghi baseline thực tế và nguyên nhân thất bại, không dựng PASS từ demo hoặc lời khen. Physical IME, installed-PWA offline thực tế và quay lại dùng những ngày sau là evidence riêng, hiện **NOT VERIFIED**. Các ngưỡng production trong validation skill vẫn giữ; pilot không tự mở backend.

Output: pilot evidence + quyết định pain point nào cần giải quyết. C/D/E không mặc định phải xây; chỉ mở slice khi có evidence và scope/contract được chốt. Có thể dừng ở A/B nếu đã đáp ứng vận hành.

## 6. Các phase có điều kiện sau pilot

| Phase | Tín hiệu để mở | Gate trước implementation |
|---|---|---|
| **V2-C1 — Size/grade identity** | Cùng giống nhưng size/grade là những hàng bán khác nhau trong giao dịch thật | SellableItem/Variant contract + legacy mapping + reservation/shipment/reconciliation/backup compatibility; không generic-commerce rewrite |
| **V2-C2 — Location** | Biết số cây nhưng thường không tìm ra lô | Whole-batch `Batch → Location` trước; history/backup. Partial placement/movement cần stock-location balances + conservation/allocation contract riêng |
| **V2-C3 — Condition** | Chủ vườn thực sự cập nhật dưỡng/yếu/bệnh/đạt chuẩn thường xuyên | Tách condition/readiness, tránh đếm trùng; không relabel living−ready thành “đang dưỡng” |
| **V2-D1 — Quote / commercial intent** | Giao dịch thật cần draft/quote rồi convert order | Intent/conversion/history contract; OrderLine/multi-item/price snapshot chỉ nếu cần |
| **V2-D2 — Payment/debt** | Dữ liệu tiền phải ghi ngoài app và core inventory/order đã được dùng | Payment/Debt/Reversal/Deposit + money/rollback/history/backup contracts; fulfillment status độc lập payment status. Không accounting system/payment gateway |
| **V2-E — Public publishing/request** | Local bảng hàng không đủ, khách cần đọc/gửi từ máy khác | Backend/publisher authorization riêng; published snapshot/expiry/unpublish/request dedup/owner review; không anonymous direct reserve |

E có boundary: owner IndexedDB → publish snapshot → public URL → customer request → inbox → owner review → validate current authority → order/reservation. Public snapshot/request không phải stock authority và không cấp quyền write owner DB. Các phase này chưa có lịch hoặc implementation authorization từ V2-0.

## 7. Handoff

V2-0 đã merge qua #30. **G01/G02/G10 DONE / CLOSED; V2-A1 NEXT duy nhất**. A2/A3/A4 QUEUED; B1/B2 PLANNED. Closure docs/state không có `web/` diff so với main đã chứa #32/#33; contract V2-A giữ nguyên. Task integration dừng ở closure, không implement V2-A1 hoặc mở A/B trong cùng PR.

Đọc cùng: [workflow audit](V2-WORKFLOW-AUDIT.md), [IA](V2-INFORMATION-ARCHITECTURE.md), [route/component map](V2-ROUTE-COMPONENT-MAP.md). Những đề xuất C/D/E trong các tài liệu này là hypotheses có gate, không mở rộng authorized scope của A/B. Trạng thái merge của reset phải được báo riêng, không lấy việc đã viết roadmap để claim main đã đổi.
