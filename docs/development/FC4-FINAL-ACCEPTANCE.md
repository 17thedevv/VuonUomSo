# FC4 — Final Acceptance: PASS / CLOSED

Ngày: **09/10/2026**. **FC4 DONE / FC4 FINAL ACCEPTANCE CLOSED / FC5 NOT STARTED.**

Nghiệm thu đã chạy lại trên main sau khi merge correction được người dùng duyệt. External commitment, release, shipment, sửa/hủy đơn và backup/restore đạt trong phạm vi dưới đây. Không phát hiện BLOCKER/HIGH hoặc lifecycle dead-end trong các luồng đã kiểm.

## 1. Merge và quality gate

- FC4-1: [PR #24](https://github.com/17thedevv/VuonUomSo/pull/24), approved head `6221ad15137607c5ebde0f1e77948c851b81acbc`, merged tại `6d31d456413ace29c40f996e4517ec451e04192d`; [merge-CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37891865192).
- Lifecycle correction: người dùng duyệt exact head **`2110fcd2bc51469606256f36265e3bd2ab3e3f1c`**, [PR #25](https://github.com/17thedevv/VuonUomSo/pull/25), [exact-head CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37893571084).
- PR #25 merged tại **`f812162814a65b7c38fe11eff3ee4cee3b77bb28`**; [merge-CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37894202547). Đã kiểm từng step typecheck/lint/full test suite/production build. Full gate: **53/53 test files, 723/723 tests PASS**, lint **0 warnings / 0 errors** (158 files), typecheck/build PASS, PWA14 entries. Local full gate trên approved correction head cũng PASS.
- Web diff giữa approved head và merge commit rỗng; main sạch trước browser acceptance.
- Browser dưới đây chạy **sau merge-CI xanh**, trên main **f812162**, origin riêng http://127.0.0.1:5229, Chromium headless với browser/IndexedDB contexts tách biệt. Không dùng kết quả branch thay nghiệm thu main, không chạm dữ liệu người dùng.
- Closure chỉ cập nhật report này và .agent/PROJECT_STATE.md; không đổi web/schema/dependency. Docs-only closure dùng full exact-head CI trước merge, không chạy lại full local suite khi web diff rỗng.

## 2. HIGH H01 đã được sửa và nghiệm thu trên main

Acceptance ban đầu trên main 6d31d45 phát hiện copy/history release dùng historical Q12k dù đã xuất F5k, và shipment nguồn ngoài nói own stock giảm. Physical stock/Q/F mutation vẫn đúng. Finding được xử lý trong PR #25, không rewrite lịch sử cũ:

- Release preview dùng canonical O. Success generic tránh quantity stale nếu shipment hoàn tất sau khi modal mở.
- Service re-read reservation, kiểm planned guard và capture O trong cùng transaction trước status write. New event giữ quantity=Q để compatibility, thêm releasedQuantity=O, fulfilledQuantity=F; message dùng commit-time O.
- External release chỉ nhả cam kết chưa xuất; own living/ready không đổi. Own release nói availability được tính lại, không khẳng định stock tăng.
- Shipment copy chỉ claim reduction của own lines. External-only không trừ cây vườn mình; mixed chỉ nói own portion. Legacy no-lines báo thiếu chi tiết để xác định, không suy luận stock effect.
- Mutation/atomicity/idempotency của shipment/reservation không đổi. Không schema/dependency/domain-lifecycle expansion, FC5/backend/external transfer hoặc generic refactor.

**6 real Dexie regressions** bảo vệ own/external Q12/F5/O7, intervening shipment, external-only, mixed own3/ext5 và legacy no-lines. Asserts gồm Q/F/completed history/batch snapshots/availability và duplicate release-event count; năm regression đầu FAIL trên code cũ trước correction. Existing FC2/FC3, confirmation, races/rollback, Undo và backup corruption gates vẫn nằm trong full suite xanh.

## 3. Browser acceptance trên main

| Gate | 360px | 390px | 430px | 1280px |
| --- | --- | --- | --- | --- |
| A–G: contact truth, blank explicit input, acknowledgement reset/cây-vạn, supplier/duplicate contact, partial commitment, released-F coverage | PASS | PASS | PASS | PASS |
| H: external12k → confirm shipment5k qua UI; không claim own stock giảm | PASS | PASS | PASS | PASS |
| H: release qua UI, preview7k; Q12/F5/released, event Q12/O7/F5; shortage15k | PASS | PASS | PASS | PASS |
| M: own12 + external12 → mixed own3/ext5; confirmation own3, stock chỉ giảm own3, F3/F5 | PASS | PASS | PASS | PASS |
| Height400px: acknowledgement/submit và release confirmation reachable; primary controls ≥44px, không horizontal overflow | PASS | PASS | PASS | PASS |

Fixture stock A: living80k / ready60k. H giữ nguyên toàn bộ own batch objects sau external shipment/release; released source coverage còn F5k. M giảm đúng own3k thành living77k / ready57k. Không nhầm historical Q với O hoặc nguồn ngoài với own inventory.

A–G kiểm supplier contact không có estimate/fallback, gọi điện không xác nhận/autofill/write, nhập confirmed12k cho đơn20k → shortage8k, rapid double-submit tạo một reservation/event. Confirmed40k không bị catalog35k cũ cap; supplier không phone vẫn dùng được. Supplier mới có role supplier, phone optional; customer-only duplicate dùng Option B tạo supplier riêng, giữ customer cũ nguyên trạng.

Released-F fixture requested50k / released Q20k F10k / active Q20k: own/external +30k reject không partial write; +20k PASS nếu guard nguồn đạt, coverage50k/shortage0 và stock/F/completed history đúng. Fixture setup và attempt riêng gate này gọi real services trong browser; không mô tả chúng là toàn bộ thao tác UI.

Riêng **390px**, chuỗi thao tác qua UI:

1. Tạo khách mới → tạo đơn50k → thêm supplier phone trống → nhập **3,2 vạn**, acknowledge và giữ32k.
2. Sửa requested25k kèm draft note → Trigger A reconciliation nguồn25k → DB chưa lưu note → bấm riêng **CẬP NHẬT ĐƠN** để lưu note. Customer/supplier roles đúng; không lifecycle dead-end.
3. Đơn20k, external12k, planned5k → preview/hủy đơn: source released, planned shipment cancelled, history còn nguyên, physical batch objects không đổi.
4. External release F5k, mixed shipment và cancelled external đều **download backup JSON → validate → restore qua UI → reload/reopen**. Orders/reservations/events/batches/contacts/shipments JSON-equivalent trước/sau. Optional undefined properties bị JSON bỏ theo serialization hiện có; không clamp/auto-repair/migrate.

Browser script exit0; không có page errors ở cả bốn widths. Đã xem trực tiếp screenshots main: release360, mixed confirmation360 và external-only confirmation1280; nội dung/layout phù hợp asserts.

## 4. Evidence và giới hạn

- Main accepted evidence: C:/Users/84387/.codex/fc4-final-evidence/accepted-main/browser.mjs, results.json, A–G/H/M screenshots, external-release.json, mixed-shipment.json, cancelled-external.json.
- Evidence phát hiện cũ vẫn ở C:/Users/84387/.codex/fc4-final-evidence/; correction branch evidence vẫn ở subdirectory correction/. Không ghi đè bằng kết quả main mới.
- Screenshot/runtime/backup là local-only, không phải attachment tải được qua GitHub connector; không commit vào repo. CI và report truy cập được qua GitHub.
- Chưa kiểm physical Android/iOS IME, field pilot hoặc offline installed-PWA acceptance. Height400px là mô phỏng keyboard, không thay kiểm thiết bị thật. Stress multi-tab ngoài real Dexie race suites chưa kiểm.
- FC3 stable order differentiator và deep idempotency marker integrity notes vẫn deferred; closure này không triển khai các mục đó.

**Verdict: FC4 FINAL ACCEPTANCE PASS / CLOSED; FC4 DONE. FC5 PLANNED / NOT STARTED.** Không triển khai FC5 trong task closure.
