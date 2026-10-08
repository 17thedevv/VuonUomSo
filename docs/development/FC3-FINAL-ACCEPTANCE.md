# FC3 — Final Acceptance

Ngày: 08/10/2026. Verdict: **PASS / FC3 DONE**. FC3-1 DONE; FC3-3 CLOSED. FC4/FC5 chưa bắt đầu.

## Main và merge gate

- Người dùng duyệt [PR #20](https://github.com/17thedevv/VuonUomSo/pull/20) tại exact-head `f9881a792011d3961c3a2d11d57c997f6f5539e9`: UI, stale/retry/double-submit, metadata draft, real Dexie integration PASS.
- PR #20 merged vào main tại **`bce3abcd69c08e32b13cb341c071c8327e720199`**; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37779744535). Typecheck, lint, full tests và build đều xanh. Mã `web/` trên merge commit giống exact-head đã duyệt (`git diff` rỗng).
- Nghiệm thu browser dưới đây chạy từ checkout main `bce3abc`, sau khi CI merge xanh, tại origin local riêng `http://127.0.0.1:5189`; Chromium `151.0.7922.34` với browser contexts/IndexedDB tách biệt. Không dùng hoặc sửa dữ liệu vườn hiện có.
- Gate tự động: **48/48 files, 652/652 tests**, lint **0 warnings / 0 errors (153 files)**, typecheck/build PASS; PWA **14 entries**. Dựa vào full CI merge trên cùng mã đã được full local gate ở PR #20, không chạy lại full local cho closure tài liệu.

## Correctness → scope → architecture → UX → tests

1. **Correctness:** Trigger A lưu requested và selected sources atomic; Trigger B giữ requested/F/completed history, giảm/chuyển O. Không nhả nguồn ngầm hoặc ghi metadata trước reconciliation. Preview/stale confirmation, planned allocations, aggregate current target capacity và operationId registry giữ authority ở service. Reconciliation không ghi physical batch stock.
2. **Scope:** chỉ nghiệm thu FC3 và ghi closure; không có web/domain/service/schema/dependency diff trong closure, không mở FC4/FC5 hay generic refactor. Không thêm reconciliation Undo.
3. **Architecture:** UI gọi repository/service và quantity helpers hiện có. Sau thành công reload DB; không dùng projection làm persistent authority. History append trong transaction, không event sourcing.
4. **UX:** cả hai entry point có đường đi tiếp; partial shortage không bị báo hoàn tất giả. Planned conflict có link chuyến, có thể hủy chuyến bằng action riêng rồi quay lại điều chỉnh. User tự chọn nguồn/khách. Metadata draft được giữ và xác nhận riêng. 360/390/430/1280px không overflow ngang trong các dialog đã kiểm; modal dài cuộn được, controls chính ≥44px và footer reachable.
5. **Tests:** real Dexie suites `reconciliationService`, `batchReconciliationService`, `reservationUndoSafety`, `backup`, domain reconciliation và 26 UI integration/state-machine regressions đều nằm trong full merge CI xanh. Chúng bảo vệ rollback, current-state races, stale Undo, full release Q>0/F preservation, cross-trigger operationId và planned/completed integrity; không chỉ mock message.

Không phát hiện BLOCKER/HIGH ảnh hưởng số lượng hoặc lifecycle dead-end trong phạm vi FC3 và các luồng đã kiểm. Đây là nghiệm thu prototype kỹ thuật, không phải field pilot hoặc tuyên bố mọi workflow tương lai đã hoàn tất.

## Cross-flow browser trên main

| Luồng / bất biến sau reload | 360 | 390 | 430 | 1280 |
| --- | --- | --- | --- | --- |
| A — UI ghi đơn50k → giữ own20k + external12k → giảm requested25k / nguồn25k; stock/history đúng | PASS | PASS | PASS | PASS |
| B — intentional shortage: requested25k / coverage22k / thiếu nguồn3k, lưu được | PASS | PASS | PASS | PASS |
| C — ready15k / LanO10k + HùngO8k → Lan9k; shortage3k→2k, chỉ selected source đổi | PASS | PASS | PASS | PASS |
| D — transfer3k A→B; source shortage0, target available8k→5k, coverage không đổi, source/target/order histories và target mới hiện | PASS | PASS | PASS | PASS |
| E — P10k / newO5k bị chặn, link đúng shipment, shipment/source/stock không đổi | PASS | PASS | PASS | PASS |
| E tiếp — user hủy planned shipment qua UI riêng → quay lại giảm đơn; lưu được, cancelled history còn | PASS | PASS | PASS | PASS |
| F — requested30k / F10k / O15k→12k; requested/F/completed/status/physical stock giữ nguyên; edit order không còn action | PASS | PASS | PASS | PASS |
| Old create-reservation Undo capture thật → reconciliation thật → khôi phục stale intent để gọi guard; bị từ chối, toàn business state không đổi | PASS | PASS | PASS | PASS |
| Partial shortage sau C → tải JSON, preview/khôi phục qua UI, reopen; stock/Q/F/status/history giữ nguyên | PASS | PASS | PASS | PASS |
| Transfer sau D → tải JSON/khôi phục/reopen; target source ID và histories giữ nguyên | PASS | PASS | PASS | PASS |
| Retry exact operation sau hai kiểu restore → idempotent, không write lại hoặc tạo target/event thứ hai | PASS | PASS | PASS | PASS |

Scenario A ghi đơn và giữ own/external hoàn toàn qua UI hiện có; B–F dùng isolated fixtures với real create/reserve/confirm services cho setup, rồi thao tác reconciliation qua UI. Stock fixture thấp hơn commitments là trạng thái shortage hợp lệ, không auto-repair.

Ở 390px, một real intervening metadata update sau preview buộc PREVIEW_CHANGED: lần confirm đầu không tạo event, preview mới vẫn cần click confirm khác. Intentional note giữ qua bước reconciliation, DB chưa có note mới cho đến CẬP NHẬT ĐƠN riêng.

**G — tiếp tục xuất sau reconciliation (390px):** trên chính đơn A đã giảm thành25k, lập chuyến own5k bằng real service, mở đúng shipment và xác nhận xuất qua UI. F tăng5k; order `partially_shipped`; chỉ lô nguồn giảm living/ready5k. Reconciliation/reservation/planned trước đó không giảm physical stock.

| Mốc của luồng A/G | Lô A sống | Đủ bán | O trên A | Còn bán |
| --- | ---: | ---: | ---: | ---: |
| Sau giữ own20k | 80.000 | 60.000 | 20.000 | 40.000 |
| Sau reconciliation own15k (external10k riêng) | 80.000 | 60.000 | 15.000 | 45.000 |
| Sau xác nhận xuất own5k | 75.000 | 55.000 | 10.000 | 45.000 |

Backup partial shortage còn2k và transfer đều được `validateBackup()` chấp nhận, full-replace restore qua UI và reopen giữ toàn state/history. Bản corruption cố ý `Q=0` hoặc `F>Q` vẫn bị reject trong browser; reference/status/planned/completed/coverage corruption guards còn được full suite bảo vệ.

## Bằng chứng và giới hạn

- Local evidence: `C:/Users/84387/.codex/fc3-final-evidence/` gồm `browser.mjs`, `results.json`, các backup synthetic `partial-shortage-{width}.json` / `transfer-{width}.json` và screenshot input/preview tại cả bốn widths. Hoàn tất lúc `2026-10-08T12:55:13Z` trên main `bce3abc`. Không commit browser runtime, dữ liệu backup hoặc ảnh vào repository.
- Screenshots 390px partial shortage và 1280px transfer được inspect trực tiếp; DOM checks và screenshot ở các width còn lại cũng được tạo. Các đường dẫn này là local-only, không coi chúng là tài liệu có thể tải trực tiếp qua GitHub connector.
- Thu viewport xuống400px khi focus input vẫn có footer/CTA reachable ở bốn widths. Đây là **keyboard-height simulation**, chưa test physical Android/iOS IME. Chưa có field pilot với chủ vườn, offline reload nghiệm thu độc lập hoặc stress đa tab ngoài các transactional race regressions.
- Build giữ bundle-size advisory sẵn có; không làm code splitting trong closure.

## Notes và bước sau

1. **Before field pilot:** nếu cùng khách có hai đơn cùng quantity/date, card nguồn và accessible name `Lan · A` có thể giống nhau. Service mutate đúng reservation ID, nhưng người dùng có thể chọn nhầm. Cần visible differentiator ổn định (`Đơn #...`/ordinal ngắn) trước pilot. Theo review người dùng, NOTE này không chặn merge/FC3 closure; không tự thêm schema/mã đơn trong task nghiệm thu.
2. **Deferred integrity NOTE:** deep validation cho projection của idempotency marker bị corruption thủ công vẫn deferred như FC3-1B/FC3-2. Normal transactional path không tạo marker kiểu đó; retry không ghi lại stock/current state. Không mở patch riêng trong closure.

FC3-0/1A/1B/2/3 đã merge và được người dùng duyệt; UI hoàn tất phần còn lại của FC3-1. Final Acceptance trên main PASS → **FC3 DONE**. FC4 vẫn **PLANNED / NOT STARTED**; cần scope/segment riêng trước implementation. Không mở branch hoặc code FC4 trong closure này.
