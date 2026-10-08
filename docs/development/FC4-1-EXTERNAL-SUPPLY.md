# FC4-1 — Truthful External Commitment Implementation

Date: 08/10/2026. Repository: `17thedevv/VuonUomSo`.

Base: `1a0bc7d52a63779b682c827879f8ced1b592a1b2`.
Branch: `feat/fc4-external-supply-truthfulness`.

**FC4-1 REVIEW PENDING / FC4 overall IN PROGRESS / FC5 NOT STARTED.**
Implementation này chưa được merge hoặc nghiệm thu cuối trên `main`. Authority là FC4 contract đã duyệt, FC0/FC3 contracts và FC3 Final Acceptance; không đổi semantics của contract.

## 1. Released-F correctness — gate đầu tiên

Trước fix, real Dexie regressions tái hiện lỗi ở cả `reserveOwnBatch()` và `reserveExternalSupplier()`: active-only coverage bỏ phần F đã xuất của released reservation. Fixture requested50k / released Q20k F10k / active Q20k có true coverage30k và shortage20k nhưng cả hai service cho thêm30k.

Hai đường creation giờ reuse `reservedQuantityForOrder()` và `orderShortage()` hiện có. Canonical coverage active/fulfilled=Q, released=F; status post-write dùng canonical current coverage + new quantity. Stored `partially_shipped` giữ nguyên. Không có công thức UI/service thứ ba hoặc refactor reservation engine.

`reservationCoverage.test.ts` chạy fixture độc lập cho từng path: add30k reject, toàn order/reservation/event/shipment/batch snapshot và Undo không đổi; add20k pass, coverage50k / shortage0, giữ F/completed history và physical batch objects. Có regression riêng cho status recompute từ stored non-partially-shipped status.

## 2. External API và transaction

```typescript
reserveExternalSupplier({
  orderId,
  supplierId,
  quantity,
  confirmation: {
    acknowledged: true,
    supplierId,
    variety,
    quantity
  }
})
```

`confirmation` là intent của một lần submit, không persist vào reservation/contact hoặc thành chứng cứ xác minh kho. Service re-read order và supplier role trong transaction, kiểm positive safe integer, acknowledgement, supplier/quantity trùng mutation, variety trùng current order, terminal status và canonical current shortage. Reservation/order status/event/Undo event-boundary capture nằm trong cùng Dexie transaction; Undo intent chỉ được publish sau commit.

New event: `Đã ghi nhận giữ 12.000 cây từ Vườn Thảo`, kèm supplier/order/quantity/variety context. Không khẳng định supplier có tồn kho, không rewrite legacy history.

`getReservationOptions()` chỉ lấy contacts có role supplier và trả `{ supplierId, name, phone? }`. Import/lookup `DEFAULT_SUPPLIER_CATALOG`, `estimatedQuantity`, variety stock inference và fallback30k đã bỏ khỏi production reservation path. Demo catalog file còn nguyên, không feed candidate/default/UI/validation.

## 3. Supplier contact và UI

`ContactQuickCreateModal` reuse bằng mode customer/supplier. Default customer và wording khách giữ nguyên. Supplier có name required, phone optional; contact + creation event atomic. Synchronous submit ref và busy controls ngăn double tap.

Chọn **Option B** cho duplicate customer-only: cảnh báo rõ, không cho dùng contact đó làm supplier, CTA `Vẫn tạo nhà vườn mới` tạo contact supplier riêng theo duplicate policy hiện có. Contact customer cũ và roles không đổi. Duplicate supplier/dual-role có thể được chọn dùng lại. Không thêm contact-role mutation/CRM.

`OrderReserveScreen` có `+ THÊM NHÀ VƯỜN`; contact mới xuất hiện ngay, không tự tạo reservation/chọn nguồn/điền quantity. External card hiển thị tên, phone nếu có, `Giống của đơn` và recorded outstanding O cho chính đơn. `GỌI XÁC NHẬN` dùng tel link, không confirm/autofill/write. Supplier không phone vẫn dùng được. Current reservation list tách Đang giữ=O và Đã xuất=F.

External modal mở trống, đơn vị cây; dùng QuantityInput/parser cây/vạn hiện có (`1,2 vạn = 12.000 cây`, test còn có `3,2 vạn = 32.000 cây`). Không quick chips hoặc `Giữ đủ đơn` autofill cho external; own defaults/chips giữ nguyên. Checkbox bind order/supplier/variety/parsed quantity; đổi context/quantity invalidates acknowledgement. CTA `GIỮ NGUỒN` chỉ bật khi input hợp lệ và đã acknowledge. `useRef` + busy chặn duplicate submit.

Khi service reject stale facts/storage error: giữ raw input, bỏ acknowledgement và refresh facts. Retry cần xác nhận lại. Success dùng generic message; screen reload DB để hiển thị canonical shortage, không trừ stale UI shortage snapshot.

## 4. Regression evidence

| Gate | Evidence |
| --- | --- |
| Released-F own/external | Real Dexie reject30/pass20; no partial write, stock/F/history/status giữ đúng |
| Service confirmation | Missing/false/context mismatch, intervening real variety edit, invalid/unsafe quantity, missing contact/role/terminal order đều reject không write |
| No supplier cap | Named old-catalog supplier nhận confirmed40k; candidate chỉ có contact facts; no persisted confirmation |
| Concurrent writers | External↔own và external↔external shortage10k: một winner, một reject; coverage10k, một reservation/event, batch objects không đổi |
| Event failure | Inject event persistence failure: rollback reservation/order/events, no Undo; retry commit bình thường |
| Real Trigger A | External12k→8k/full release, strict preview/idempotent retry, old Undo reject, physical batches không đổi |
| Release/planned/cancel | Planned allocation chặn release và incompatible reduction; cancellation giữ history và stock; released F còn coverage |
| External shipment | F tăng5k, partially_shipped; tất cả own batch objects không đổi; old Undo bị chặn |
| Mixed shipment | Own3k + external5k: chỉ own batch living/ready giảm3k; cả hai F và backup giữ đúng |
| Backup/restore/reopen | Legacy không acknowledgement/F field vẫn hợp lệ; new correction/full release/cancel/partial shipment/mixed shipment round-trip bảo toàn data/history/stock |
| Corruption rejected | Missing supplier/role, Q0, F>Q, invalid status, coverage>requested, planned>O, completed/F mismatch |
| UI + real Dexie | Blank/ack/call/no-phone/partial/double-submit/stale quantity-variety refresh/contact creation/storage retry/recorded O vs Q |
| Customer/contact | Default customer, optional supplier phone, duplicate supplier reuse, separate customer-only duplicate và atomic event failure |

Existing external fixtures trong FC2/FC3/Undo tests chỉ được bổ sung required confirmation context; assertions và guard semantics không bị nới. FC3 services/Undo/backup production code không đổi.

## 5. Browser acceptance

Chromium headless, isolated browser contexts và origin `http://127.0.0.1:5199`, dữ liệu test riêng trong IndexedDB; không dùng dữ liệu người dùng. Create/order/reserve/shipment/release dùng services thật. Mobile height844px, desktop900px; keyboard simulation height400px.

| Flow | 360px | 390px | 430px | 1280px |
| --- | --- | --- | --- | --- |
| A contact/order facts, no estimate/fallback; call không mutation/confirm/default | PASS | PASS | PASS | PASS |
| B blank→confirmed12k; double-submit một reservation/event; shortage20k→8k, truthful history, stock unchanged | PASS | PASS | PASS | PASS |
| C named old35k supplier nhận40k; no-phone supplier cũng nhận40k | PASS | PASS | PASS | PASS |
| D quantity edit reset acknowledgement; cây/vạn; checkbox/submit reachable height400px | PASS | PASS | PASS | PASS |
| E create supplier phone blank; immediate list; no auto-reservation; new form blank | PASS | PASS | PASS | PASS |
| F duplicate customer-only: explicit separate supplier, old role preserved | PASS | PASS | PASS | PASS |
| G real create→ship10k→release→own20k fixture: own/external30k reject, independent20k pass, coverage50k/shortage0/status/F/stock preserved | PASS | PASS | PASS | PASS |

Layout assertions: document và dialog không horizontal overflow; primary submit/create/duplicate controls ≥44px, acknowledgement label ≥48px. Form scroll đưa checkbox và submit vào viewport400px. Không có pageerror ở bốn browser contexts. Đã mở và kiểm ảnh modal360/1280 và keyboard360 trực tiếp; chữ/context/nút không bị cắt hoặc che.

Local evidence (không phải attachment truy cập được qua GitHub):

- `C:/Users/84387/.codex/fc4-1-evidence/browser.mjs` — executable browser acceptance.
- `C:/Users/84387/.codex/fc4-1-evidence/results.json` — assertions/layout facts theo width.
- `A-candidates-{width}.png`, `A-blank-{width}.png`, `B-partial-{width}.png`, `D-keyboard-{width}.png`, `E-supplier-{width}.png`, `F-duplicate-{width}.png` trong cùng directory.

**Chưa test IME trên điện thoại thật hoặc field pilot.** Browser G gọi creation services thật sau khi xác nhận current shortage trên UI; không tuyên bố mọi cross-flow service regression được chạy bằng click UI. Backup/restore/reopen và fault/race regressions ở §4 dùng real Dexie integration tests, không phải browser automation.

## 6. Quality gate và phạm vi

Local full gate trên final implementation: typecheck PASS, lint **0 warnings / 0 errors (157 files)**, **52/52 files / 717/717 tests PASS**, build PASS, PWA14 precache entries. Test run 78,52s. Sau full gate chỉ normalize whitespace của fixture confirmation đã thêm; typecheck/lint chạy lại PASS. Build có chunk-size warning, không phải build failure; không mở performance refactor trong slice này. jsdom có hai thông báo navigation-to-another-document chưa implement; assertions/browser thật đều PASS.

Exact-head CI là gate bắt buộc trước handoff; immutable SHA, PR và remote run link được xác minh và ghi trong PR/handoff sau push. Không suy diễn local green thành remote CI SUCCESS.

Expected final diff: **21 files — 6 production, 13 test, 2 docs/state**. Bốn new test files: reservationCoverage, externalCommitment, ContactQuickCreateModal và ExternalCommitmentUI. Những file test FC2/FC3 còn lại gồm fixture API adaptations và focused regressions.

Không đổi schema/dependency/contract semantics. Không FC5, backend/cloud, supplier inventory/marketplace/portal, external transfer, purchase order/accounting, shipment-line edit hoặc generic-product refactor. FC3 deferred deep marker-integrity và stable order differentiator notes giữ nguyên.

Next gate: review exact head → merge khi được duyệt → merge-CI xanh → **FC4 Final Acceptance trên main**. Không tự đánh FC4 DONE hoặc bắt đầu FC5.
