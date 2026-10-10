# Vườn Ươm — V2 Roadmap

Ngày quyết định: **09/10/2026**. **V2-0 — ROADMAP RESET + CONTRACT FREEZE**.

Chỉ thị trực tiếp của người dùng thay thế delivery order FC5 → FC6. Trạng thái task/merge xem tại [.agent/PROJECT_STATE.md](../../.agent/PROJECT_STATE.md). V2-A1–A4 và V2-B1 đã merge/nghiệm thu trên main; V2-B2 là NEXT duy nhất, chưa triển khai.

## 1. Baseline và quyết định supersede

- Base merged: `0d8d97a7254998ac84c7fedc087724f8ccc44da2`; FC0–FC4 **DONE / CLOSED**. Contract số lượng, transaction, history, backup và Undo đã có vẫn được giữ.
- FC5 và FC6: **SUPERSEDED BY V2**, không còn prerequisite hoặc task NEXT. Không đánh dấu chúng DONE.
- FC5-0 đã merge là bằng chứng lịch sử; contract FC5 được giữ làm tài liệu tham khảo, không buộc hoàn thành close remaining trước V2.
- FC5-1 ở `feat/fc5-close-remaining-domain`, head `ac68325b8deab6445e833b6f7c78c28fa97f9484`, [PR #29](https://github.com/17thedevv/VuonUomSo/pull/29): **PRESERVED / NOT ADOPTED / OUT OF ACTIVE ROADMAP**. Giữ nguyên code/branch để tham khảo; reset này không merge, xóa hoặc đóng PR đó. V2 không import `closeOrderRemaining()`, thêm `closed_remaining` hoặc dựa vào terminal guards chưa merge. Muốn dùng lại phải mở một task correctness/capability riêng với review theo hướng sản phẩm mới.
- **V2-0 MERGED / CLOSED** qua [PR #30](https://github.com/17thedevv/VuonUomSo/pull/30), merge `85415ceaaff3b152e53c4a8df5552af3d335e0ee`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37935872623). Reset đã có hiệu lực trên main.
- **G01/G02 DONE / CLOSED**: [PR #32](https://github.com/17thedevv/VuonUomSo/pull/32), reviewed head `e57cf29c5ed4da550048c7efae1b4e36c9dfda34`, merged `9c29fa2beea57bd82eb74a4b88c5b79987acefb1` lúc `2026-10-09T13:09:03Z`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37934810940), typecheck/lint/full tests/build PASS.
- **G10 DONE / CLOSED**: [PR #33](https://github.com/17thedevv/VuonUomSo/pull/33), reviewed head `3bf2cdafdd48dc690c9d1fb3b39197cd5f3b956f`, merged `87d918d02ee5cbb22bb1e76475292fab4b7fdae2` lúc `2026-10-09T14:41:55Z`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37946122446), typecheck/lint/full tests/build PASS.
- **V2-A1 DONE / CLOSED**: [PR #35](https://github.com/17thedevv/VuonUomSo/pull/35), approved head `2351151d5d58d6cf5c989e60d26fa7566700d986`, merged `c83880b49136659aa9f592633e325332421d110e` lúc `2026-10-09T15:36:22Z`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37952987463) trên đúng merge commit (event `push`), typecheck/lint/55 files, 860 tests/build PASS. 91 Garden regressions bảo vệ read-model contract; tại thời điểm closure A1, chưa có Garden UI acceptance.
- **V2-A2 DONE / CLOSED**: [PR #37](https://github.com/17thedevv/VuonUomSo/pull/37), reviewed head `b6d8b5a19255231befe3a837911185a8c184fd85`, merged `8a1d6853d3e27fe02b5cdcfff129dbc6e904b897` lúc `2026-10-09T16:37:52Z`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37960503730) trên đúng merge commit, branch `main`, event `push`: typecheck/lint/56 files, 882 tests/build PASS. 22 Garden UI + 91 A1 regressions bảo vệ totals15/shortage3, search/URL/back, freshness/Undo, stale success/error và error/retry.
- **V2-A2 acceptance trên main**: 16 native Edge browser checks PASS tại360/390/430/768/1280px; M06 search giữ M07 và toàn group totals; existing modal update25 → Garden available22 → Undo15/shortage3; URL/reload/back, no-results, empty/no-available, fail-closed/retry và responsive đạt. Evidence/harness/screenshots: `C:/Users/84387/.codex/artifacts/v2-a2-closure-2026-10-09/`; `browser-evidence.json` ghi đúng main SHA. Today/NAV_ITEMS, services/domain/schema và frozen contract giữ nguyên; tại thời điểm nghiệm thu A2, QuickUpdateChooser/A3/A4 chưa có. Reduced keyboard viewport không chứng minh physical IME/offline installed-PWA/field pilot.
- **V2-A3 DONE / CLOSED** (10/10/2026): [PR #39](https://github.com/17thedevv/VuonUomSo/pull/39), reviewed head `d0b879950ba31e64b84d5dfd0003c5f3d7a36cb7`, merged `f345a1af142a50958849ccb333343b42d69214ef` lúc `2026-10-09T17:25:19Z`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37966152030) trên đúng merge commit, branch `main`, event `push`: typecheck/lint/57 files, 907 tests/build PASS. 25 real Dexie/UI regressions mới; 141 targeted PASS gồm A1/A2/BatchNew/chooser. Bảo vệ correct batch ID/fresh facts, all-view/zero-available picker, full group search, stale success/error, one-shot allowlisted intent, preview/ready≤living, legitimate shortage, rollback/retry/input retention, no-write cancel/selection, legacy navigation và Undo/Garden refresh.
- **V2-A3 acceptance trên main**: source tree khớp reviewed head; native Edge + real IndexedDB chạy lại tại360/390/430/768/1024/1280px PASS cho global/contextual chooser và hai modal cũ. Living30→10 yêu cầu explicit ready8; ready31 reject; ready10/O18 cho shortage8; Garden giữ q/view/open sau commit/Undo, browser back/reload không replay intent, add-new/cancel context, focus/keyboard/Escape, long names/codes/no overflow/controls mới ≥44px và reduced390×420px submit đạt. Evidence/harness/screenshots: `C:/Users/84387/.codex/artifacts/v2-a3-closure-2026-10-10/`; JSON ghi đúng main merge SHA. Existing mutation/modal/domain/schema/Today/NAV_ITEMS/frozen contract giữ nguyên; không có A4/new stock command; PR #29/#31 preserved/unmerged/not adopted. Physical IME/offline installed-PWA/field pilot vẫn NOT VERIFIED.
- **V2-A4 DONE / CLOSED** (10/10/2026): [PR #41](https://github.com/17thedevv/VuonUomSo/pull/41), approved head `766d336964df30f59d7ddae93137957f8d4cfdea`, merged `cf18af6fce9cc949f7b67860d2fe75b0f65979c4` lúc `2026-10-10T07:12:31Z`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/38033627397) trên đúng merge commit, branch `main`, event `push`: typecheck/lint/58 files, 932 tests/build PASS. 25 regressions mới so với A3 giữ Today A1 own available/O, fixture15/shortage3/external exclusion, fail-closed/races/refresh/Undo, bốn tab/legacy routes, group/leaf variety prefill/default quantity/no auto-reserve/back q/view/open. Delta review `1cd5e4facc3ef03527c5d257df4270851365d7b2` → approved head đổi action thành “Xem đơn hàng” → unfiltered `/orders`; real Dexie partial order40/O23/shortage17 regression PASS.
- **V2-A4 acceptance trên main**: source tree khớp approved head; native Edge + real IndexedDB chạy lại tại360/390/430/768/1024/1280px PASS. Today15 → Monthong/M06 → ready25 → Today22 → Undo15; M07 prefill Monthong/default30000/create không reserve hoặc stock write/back context; fail-closed/retry/legacy routes/long labels/keyboard/reduced390×420px đạt. Sáu kích thước đều xác minh O23 action tới unfiltered orders chứa partial order40/23/17, Đơn tab active, Enter/target ≥44px và không business writes. Evidence/harness/screenshots/JSON ghi đúng main merge SHA: `C:/Users/84387/.codex/artifacts/v2-a4-closure-2026-10-10/`. Không có B1 code/schema/domain/mutation service/frozen contract changes. Physical IME/offline installed-PWA/field pilot vẫn NOT VERIFIED.
- **V2-B1 DONE / CLOSED** (10/10/2026): [PR #44](https://github.com/17thedevv/VuonUomSo/pull/44), reviewed head `b0debdc939d85a446b0acb2182c33e42022c9095`, merged `f4c9a4b7497f6cf52263f4ec09fb7f88268cd6f6` lúc `2026-10-10T08:33:42Z`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/38038306649) trên đúng merge commit, branch `main`, event `push`: typecheck/lint/61 files, 977 tests/build PASS. 45 B1 regressions mới; trên main chạy lại 4 files / 136 tests PASS gồm B1 và 91 A1. Real Dexie bảo vệ available15/shortage3/external exclusion, selection theo batch ID/subset/không đếm trùng, fresh generation reject selected batch đã xóa/hết hàng, fail-closed/no writes/privacy; controlled promises/APIs bảo vệ races, immutable snapshot, exact Preview/Copy/Web Share parity, Clipboard fallback và cancel/reject.
- **V2-B1 acceptance trên main**: source tree khớp reviewed head; trực tiếp đọc owner router/AppShell/onboarding, Garden/share screen/selection/formatter/A1. Native Edge + real IndexedDB chạy lại 14 checks PASS tại360/390/430/768/1024/1280px và reduced390×420px: Garden entry/back q/view/open, real ID selection/partial group/nhiều giống/optional codes, frozen preview/copy sau stock change và explicit regenerate15→13, native Clipboard exact argument parity/manual fallback, mocked Web Share resolve/cancel/reject/no writes, fail-closed/retry/zero-available/long Unicode/no overflow. Windows Clipboard readback đổi LF→CRLF, payload gửi API vẫn đúng preview. Evidence/harness/screenshots/JSON ghi đúng main merge SHA: `D:/Project-17/artifacts/v2-b1-closure-2026-10-10/`. Native Web Share sheet/actual Zalo delivery/physical IME/offline installed-PWA/real pilot vẫn **NOT VERIFIED**; không Customer Read Views, public publishing URL/backend/schema/domain/mutation service/dependency/frozen contract changes. PR #29/#31 preserved/unmerged/not adopted; issue #42 OPEN / NOT FIXED.
- **V2-B2 NEXT — DUY NHẤT / NOT STARTED**; toàn V2-B chưa hoàn tất. REAL PILOT REQUIRED AFTER V2-B và sau khi issue #42 được sửa/review/merge CI PASS; V2-C/D/E EVIDENCE GATED / NOT AUTHORIZED.

```text
V2-0: reset roadmap + freeze contract (MERGED / CLOSED, #30)
  → G01/G02 (DONE / CLOSED, #32 merged)
  → G10 (DONE / CLOSED, #33 merged)
  → V2-A1 (DONE / CLOSED, #35 merged)
  → V2-A2 (DONE / CLOSED, #37 merged)
  → V2-A3 (DONE / CLOSED, #39 merged)
  → V2-A4 (DONE / CLOSED, #41 merged)
  → V2-B1 (DONE / CLOSED, #44 merged)
  → V2-B2 (NEXT duy nhất / NOT STARTED)
  → Correctness issue #42 (OPEN / NOT FIXED; required before pilot)
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

G01/G02 đã đóng qua PR #32; G10 đã đóng qua PR #33 với regression và merge CI xanh. Correctness cleanup, V2-A1–A4 và V2-B1 đã hoàn tất; V2-B2 là NEXT duy nhất. Không mở Product/Variant chỉ để sửa picker.

**Separate correctness follow-up — OPEN / NOT FIXED / REQUIRED BEFORE REAL PILOT:** [Issue #42](https://github.com/17thedevv/VuonUomSo/issues/42) ghi nhận legacy `getVarietyAvailability()` tính external reservation có `batchId` collision vào own informational availability; OrderNew feedback và `order_created.availableAtGarden` khác A1. Acceptance: external không giảm own stock; real Dexie collision regression giữ per-batch available15/shortage3; feedback/persisted event nhất quán; reservation/fulfillment/release semantics và G01 atomicity/retry/Undo giữ nguyên, không schema/new command. Phải giải quyết/review/merge CI PASS trước real pilot. Không sửa hoặc đóng issue trong A4/B1/closure; B1 A1 external exclusion không giải quyết legacy OrderNew/event availability.

## 3. V2-A — Availability & Quick Update

Mục tiêu: chủ vườn biết ngay còn bán được cây gì, tìm đúng lô và cập nhật số thực tế nhanh.

[V2-A Functional Contract](V2-A-FUNCTIONAL-CONTRACT.md) khóa ba quyết định trước code: legacy grouping, coherent IndexedDB read snapshot, available ≠ ready. Dùng living/ready/O/available/shortage từ authority FC0–FC4. Không schema rewrite, Product/Variant/Location/Size/payment/public URL.

| Slice | Outcome / surface | Acceptance riêng |
|---|---|---|
| **V2-A1 — DONE / CLOSED (#35)** | `gardenQueryService` + read DTO, nhóm giống sau khi derive từng lô | Real Dexie snapshot + normalization regressions; A ready15/O18 và B ready20/O5 → available15/shortage3; không write |
| **V2-A2 — DONE / CLOSED (#37)** | `/garden`, GardenAvailabilityScreen, AvailabilitySummary, VarietyAvailabilityCard, search/filter giống + mã lô | Search/URL/back, totals15/shortage3, freshness/Undo/error/race và main browser/merge CI PASS; evidence bên trên |
| **V2-A3 — DONE / CLOSED (#39)** | QuickUpdateChooser composition; global/contextual, all-batch picker và existing modal/add-new flows | Preview before/after, ready≤living, legitimate shortage, correct ID/fresh facts, q/view/open, no writes khi chọn/hủy, rollback/Undo, one-shot intent và main browser/merge CI PASS; evidence bên trên |
| **V2-A4 — DONE / CLOSED (#41)** | Today A1 own availability/O; bốn tab; Garden → Batch/Ghi đơn; unfiltered “Xem đơn hàng” | Totals15/shortage3, partial order40/O23/shortage17, fail-closed/races/Undo, legacy routes, prefill/default quantity/no auto-reserve/back context và main browser/merge CI PASS; evidence bên trên |

Gate toàn V2-A: mở app → tổng **Cây còn bán** → tìm Monthong → chọn đúng lô → kiểm kê/cập nhật ready → quay lại → Availability phản ánh current authority. Browser 360/390/430/1280px, keyboard viewport và core flow regressions; không suy ra physical IME/offline PWA từ browser.

Không redesign Order Detail, làm delta mortality, move cây, condition buckets hoặc sửa/hủy workflow mới để hoàn thành A. Mỗi slice review/CI/tích hợp trước slice phụ thuộc nó.

## 4. V2-B — Local bảng hàng + Customer read

V2-A và V2-B1 đã merge/nghiệm thu. **V2-B2 là NEXT — DUY NHẤT / NOT STARTED**; toàn V2-B chưa hoàn tất, vẫn không thêm schema. B2 cần task implementation riêng; closure B1 dừng trước B2.

| Slice | Routes / flow | Authority và giới hạn |
|---|---|---|
| **V2-B1 — DONE / CLOSED (#44)** | `/garden/share`: availability hiện tại → chọn giống/lô → preview → text → Copy/Web Share → owner tự gửi Zalo | Owner-local snapshot, tên vườn + thời điểm tạo bảng; preview-copy-share parity/main acceptance/merge CI PASS. Không public URL/backend/inbox/auto-reserve; không export raw backup, contact/private history hoặc suy giá từ đơn cũ |
| **V2-B2 — NEXT duy nhất / NOT STARTED** | `/customers`, `/customers/:id`: tên/phone → đơn → O chưa xuất → lịch sử đã xuất | Customer role + existing order/reservation/completed shipments; O không phải historical Q/C. Read views, links/gọi/entry Ghi đơn dùng flow cũ; không giá khách/đã trả/công nợ/thu tiền |

Web Share không được hỗ trợ/hủy/chưa có Clipboard API phải có copy/manual fallback và không tạo write. Nội dung bảng là snapshot từ máy owner, không gọi live/synced hoặc bảo đảm giữ hàng cho người nhận. Quantity thay sau preview không làm nội dung đang copy lệch preview; muốn bảng mới phải refresh/preview lại. Tạo bảng/copy/share không thay order/reservation/stock/event nghiệp vụ.

Customer read phải phân biệt được hai đơn cùng khách có cùng số lượng/ngày bằng một nhãn ổn định từ existing ID với collision handling; không thêm mã đơn vào schema. Link tới order giữ đúng ID và history; thiếu phone không giả số hoặc ngăn dùng các read views.

## 5. REAL PILOT ngay sau V2-B

**STOP FEATURE BUILD** sau B. Pilot không chờ C/D/E, cũng không quay lại chờ FC5/FC6. Correctness follow-up [#42](https://github.com/17thedevv/VuonUomSo/issues/42) phải được giải quyết trước pilot. Correctness fixes phát hiện trong pilot vẫn được phép; feature mới cần evidence và một task riêng.

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

**V2-C / V2-D / V2-E: EVIDENCE GATED / NOT AUTHORIZED**; chỉ mở sau pilot và contract/scope riêng.

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

V2-0 đã merge qua #30. **G01/G02/G10 DONE / CLOSED (#32/#33); V2-A1–A4 DONE / CLOSED (#35/#37/#39/#41); V2-B1 DONE / CLOSED (#44); V2-B2 NEXT — DUY NHẤT / NOT STARTED**. Toàn V2-B chưa hoàn tất. Delivery order: B1 closure → B2 Customer Read Views → correctness [#42](https://github.com/17thedevv/VuonUomSo/issues/42) (OPEN / NOT FIXED / REQUIRED BEFORE REAL PILOT) → REAL PILOT REQUIRED AFTER V2-B. FC5/FC6 SUPERSEDED BY V2; C/D/E EVIDENCE GATED / NOT AUTHORIZED. Closure chỉ sửa PROJECT_STATE và roadmap, không có `web/` diff so với main đã chứa #44; frozen contracts giữ nguyên. Task integration dừng sau closure, không implement B2 hoặc sửa issue #42/mutation services/schema. PR #29/#31 preserved/unmerged/not adopted. Native Web Share/physical IME/offline installed-PWA/real pilot vẫn NOT VERIFIED. Trạng thái hiện hành ở đây và PROJECT_STATE thay các snapshot NEXT cũ trong tài liệu tham khảo/skills.

Đọc cùng: [workflow audit](V2-WORKFLOW-AUDIT.md), [IA](V2-INFORMATION-ARCHITECTURE.md), [route/component map](V2-ROUTE-COMPONENT-MAP.md). Những đề xuất C/D/E trong các tài liệu này là hypotheses có gate, không mở rộng authorized scope của A/B. Trạng thái merge của reset phải được báo riêng, không lấy việc đã viết roadmap để claim main đã đổi.
