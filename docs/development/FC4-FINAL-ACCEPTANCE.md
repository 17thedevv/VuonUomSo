# FC4 — Final Acceptance: required correction

Ngày: **09/10/2026**. **FC4 FINAL ACCEPTANCE NOT CLOSED / FC4 IN PROGRESS / FC5 NOT STARTED.**

FC4-1 đã được người dùng duyệt và merge. Nghiệm thu trên main phát hiện một HIGH về truthfulness trong release/shipment flow; bản vá riêng đã được chuẩn bị, nhưng chưa được review/merge. Kết quả trên branch không thay thế nghiệm thu trên main.

## 1. Merge và main evidence

- [PR #24](https://github.com/17thedevv/VuonUomSo/pull/24), approved exact-head `6221ad15137607c5ebde0f1e77948c851b81acbc`, merged tại **`6d31d456413ace29c40f996e4517ec451e04192d`**.
- [Merge-CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37891865192): typecheck/lint/full tests/build PASS. 52 files / 717 tests; lint0/0 (157 files), PWA14. `git diff approvedHead main -- web` rỗng.
- Browser acceptance dưới đây thực sự chạy trên clean main `6d31d45`, origin riêng `http://127.0.0.1:5209`, Chromium headless và các IndexedDB/browser contexts tách biệt. Không chạm dữ liệu người dùng.
- A–G PASS tại **360/390/430/1280px**: candidate/contact truth, confirmed12k→shortage8k, named catalog35k không cap confirmed40k, acknowledgement reset/cây-vạn, supplier phone optional, duplicate customer-only Option B, released-F reject30/pass20 ở cả creation paths. Height400px có checkbox/submit reachable, không horizontal overflow. Đây không phải full FC4 verdict vì finding dưới đây.

## 2. HIGH H01 — external lifecycle presentation chưa đúng authority

Trên main, setup bằng real services và thao tác confirm/release qua UI tại390px:

```text
external Q12.000 / F0
→ completed external shipment5.000
→ Q12.000 / F5.000 / O7.000
→ independent release
→ released Q12.000 / F5.000 / O0
```

Mutation giữ stock nguyên vẹn và coverage sau release còn F5k. Tuy nhiên:

1. `ReleaseConfirmModal` preview/success nói bỏ12k và phần cây sẽ trở lại `Cây còn bán` của vườn mình. Thực tế chỉ nhả O7k từ nguồn ngoài; own availability/stock không đổi.
2. New `reservation_released` event message dùng historical Q12k thay vì commit-time O7k. Historical `quantity` giữ Q là hợp lệ, nhưng message không nói đúng số vừa nhả.
3. `ShipmentDetailScreen` confirmation/completed explanation luôn nói own physical stock bị trừ, kể cả chuyến chỉ có external lines. Mixed shipment cũng chưa nói rõ chỉ own portion giảm kho.

Đây là **HIGH product truthfulness**, không phải finding inventory mutation/atomicity. Chặn FC4 closure để tránh chủ vườn hiểu nhầm số vừa nhả và stock của vườn mình. PR #24 đã qua đúng review/merge gate; finding phát hiện ở cross-flow acceptance rộng hơn, không rewrite lịch sử hoặc đảo merge đã duyệt.

## 3. Bản vá hẹp, REVIEW PENDING

Branch: `fix/fc4-release-truthfulness`, base main `6d31d45`. Diff: **6 files — 3 production / 1 test / 2 docs-state**.

- `ReleaseConfirmModal`: dùng `remainingReservationQuantity` cho preview O; external nói nhả cam kết chưa xuất và stock vườn mình không đổi; own nói đúng availability của lô, không giảm living/ready. Giữ F/history. Success generic, không lấy stale modal quantity làm commit-time authority. Modal cuộn được height400px, hai primary controls ≥44px.
- `reservationService`: capture canonical O trước status write; new events thêm `releasedQuantity=O` và `fulfilledQuantity=F`, message dùng O. Existing payload `quantity=Q` giữ nguyên để tương thích history; không rewrite event cũ. Mutation/transaction/planned guard/idempotency/stock/status semantics không đổi.
- `ShipmentDetailScreen`: copy kế hoạch/confirmation/completed dùng own portion của source breakdown; pure external nói rõ không trừ own stock, mixed3k own +5k external chỉ trình bày effect3k lên own stock. Legacy shipment không source lines báo chưa có chi tiết để xác định stock effect, không tự suy luận external hoặc own stock reduction. Không đổi shipment service/line lifecycle.
- Không schema/dependency/domain formula/refactor/FC5/backend/external transfer; FC3 marker-integrity và stable order differentiator notes vẫn deferred.

`ExternalLifecycleTruthfulness.test.tsx` có **6 real Dexie regressions**: năm regression trước production fix **5/5 FAIL**, sau fix PASS (own/external Q12/F5 preview/event O7, intervening shipment không gây stale success/history quantity, external-only shipment không claim own reduction, mixed own3/ext5 đúng own3); thêm một legacy no-lines regression để tránh suy luận stock khi không có source detail. Snapshot Q/F/completed/batches/availability và duplicate release event-count được assert.

Related gate ban đầu: 6 files / 75 tests PASS; full gate ban đầu 53 files / 722 tests PASS. Sau thêm legacy no-lines guard, **full final local gate: typecheck PASS, lint0/0 (158 files), 53/53 files / 723/723 tests PASS, build PASS, PWA14**. Build có bundle-size advisory; jsdom có navigation-to-another-document notice từ test hiện có. Không đổi code để bỏ qua các notice này. Exact-head CI và PR được xác minh trước handoff, ghi trong PR/handoff để tránh self-referential commit SHA.

## 4. Browser evidence trên bản vá — chưa phải main acceptance

Origin riêng `http://127.0.0.1:5219`; branch có đúng production correction nêu trên. A–G chạy lại PASS tại cả bốn widths.

| Cross-flow | 360 | 390 | 430 | 1280 |
| --- | --- | --- | --- | --- |
| H external12k→confirm shipment5k qua UI: preview/completed không claim own reduction; all own stock objects không đổi | PASS | PASS | PASS | PASS |
| H tiếp release qua UI: preview7k, no own availability claim, Q12/F5/released và event O7 giữ đúng; shortage15k | PASS | PASS | PASS | PASS |
| Release modal height400px: confirm reachable, ≥44px, no horizontal overflow | PASS | PASS | PASS | PASS |
| M own12 + external12 → mixed own3/ext5: confirmation nói own3, completed only own stock giảm3; F3/F5 | PASS | PASS | PASS | PASS |

Riêng390px:

- Ghi khách mới → ghi đơn50k → thêm supplier phone blank → nhập `3,2 vạn`/acknowledge/giữ32k → giảm requested25k bằng UI Trigger A → nguồn25k. Intentional note giữ qua reconciliation, DB chưa lưu note cho tới `CẬP NHẬT ĐƠN` riêng; customer/supplier roles đúng. Không lifecycle dead-end trong flow đã kiểm.
- External12k + planned5k → preview/hủy đơn qua UI: source released, planned cancelled, history tồn tại, physical batches nguyên vẹn.
- External release F5k, mixed shipment và cancelled external: **download backup JSON → validate → restore qua UI → reload/reopen**, business data và history JSON-equivalent giữ nguyên. Optional undefined properties bị JSON bỏ theo serialization hiện có; không clamp/auto-repair/migrate dữ liệu.

Source audit theo thứ tự correctness → scope → architecture → UX → tests: creation/helpers/confirmation/transaction và existing physical stock invariants giữ đúng; patch chỉ event facts/presentation, UI vẫn dùng service/helper. Existing corruption/races/Undo/FC2/FC3/backup gates nằm trong full suite xanh. Không tự suy diễn tests là field pilot.

## 5. Evidence, giới hạn và bước tiếp

- Main evidence: `C:/Users/84387/.codex/fc4-final-evidence/main-browser.mjs`, `results.json`, A–G screenshots và `H-main-external-{shipment,release}-finding-390.png`.
- Correction evidence: `C:/Users/84387/.codex/fc4-final-evidence/correction/browser.mjs`, `results.json`, A–G/H/M screenshots, `external-release.json`, `mixed-shipment.json`, `cancelled-external.json`.
- Đã inspect trực tiếp main release390, corrected release360, mixed shipment confirmation360 và pure external confirmation1280 screenshots. Các paths là local-only, không phải attachment tải qua GitHub connector. Browser runtime/backup/screenshot không commit vào repo.
- Chưa test physical Android/iOS IME, field pilot, offline installed-PWA acceptance hoặc stress multi-tab ngoài real Dexie race suites. Giữ limitation đã công bố ở FC4-1.

**Required next gate:** review exact correction head → merge khi được duyệt → merge-CI xanh → chạy lại H/M và create/edit/cancel/backup trên main đã có correction → mới đổi **FC4 DONE**. Chưa mở FC5.
