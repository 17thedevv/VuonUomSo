# Vườn Ươm — Project State & Roadmap Status

> **Single Source of Truth** cho toàn bộ AI Coding/Review/Design Agents về giai đoạn hiện tại của dự án.
> Mọi agent TRƯỚC KHI thực hiện bất kỳ task nào PHẢI kiểm tra file này để xác định phạm vi được phép làm.

---

## 1. Project Identity

- **Tên chính thức**: `Vườn Ươm`
- **Descriptor phụ**: `Sổ cây giống trên điện thoại`
- **Tên cũ cấm dùng**: `Sổ Cây Giống` (không dùng làm brand chính)
- **Giai đoạn dự án**: `Validation Prototype` (Bản mẫu xác thực hành vi người dùng)
- **Production Architecture / Cloud Backend**: `NOT AUTHORIZED` (Chưa được phép triển khai)

---

## 2. Roadmap Matrix & Current Phase

### Roadmap hiện hành — V2 reset (09/10/2026)

**Chỉ thị người dùng: FC5 / FC6 SUPERSEDED BY V2.** Đây là quyết định đổi roadmap rõ ràng, thay các NEXT/prerequisite trong snapshot cũ bên dưới. FC0–FC4 vẫn DONE / CLOSED. Base merged khi tạo reset: `0d8d97a7254998ac84c7fedc087724f8ccc44da2`.

- [V2 Roadmap](../docs/product/V2-ROADMAP.md): **V2-0 MERGED / CLOSED** qua [PR #30](https://github.com/17thedevv/VuonUomSo/pull/30), merge `85415ceaaff3b152e53c4a8df5552af3d335e0ee`; [merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37935872623). Roadmap đã có hiệu lực trên main; V2-A1–A4 đã merge/nghiệm thu qua #35/#37/#39/#41; V2-B1 đã merge/nghiệm thu qua #44. V2-B2 là NEXT duy nhất, chưa triển khai.
- [V2-A Functional Contract](../docs/product/V2-A-FUNCTIONAL-CONTRACT.md): frozen legacy grouping + coherent read snapshot + available labels/sum per-batch.
- **FC5-1 PRESERVED / NOT ADOPTED / OUT OF ACTIVE ROADMAP**: branch `feat/fc5-close-remaining-domain`, head `ac68325b8deab6445e833b6f7c78c28fa97f9484`, [PR #29](https://github.com/17thedevv/VuonUomSo/pull/29). Không merge/xóa/đóng PR bằng reset này; không phụ thuộc service hoặc enum chưa merge. Muốn tiếp nhận lại cần task/review riêng.

| Phase | Trạng thái | Gate / scope |
|---|---|---|
| Correctness G01/G02 | **DONE / CLOSED** | [PR #32](https://github.com/17thedevv/VuonUomSo/pull/32) merged; atomic create + numeric boundary, evidence bên dưới |
| Correctness G10 | **DONE / CLOSED** | [PR #33](https://github.com/17thedevv/VuonUomSo/pull/33) merged; visible variety = submitted variety, evidence bên dưới |
| V2-A1 | **DONE / CLOSED (#35)** | Garden availability read model đã merge theo frozen contract; real Dexie regressions và merge CI PASS, không schema mới |
| V2-A2 | **DONE / CLOSED (#37)** | Garden UI/search, URL/back context, freshness/Undo/error/race acceptance đã đạt trên main; evidence bên dưới |
| V2-A3 | **DONE / CLOSED (#39)** | QuickUpdateChooser composition dùng mutation hiện có; main code/browser và merge CI PASS, evidence bên dưới |
| V2-A4 | **DONE / CLOSED (#41)** | Today A1 availability, bốn tab, Garden → Ghi đơn/back context; main browser và merge CI PASS, evidence bên dưới |
| V2-B1 | **DONE / CLOSED (#44)** | Local bảng hàng: A1 selection → frozen preview → Copy/Web Share; real Dexie/main browser/merge CI PASS, evidence bên dưới |
| V2-B2 | **NEXT — DUY NHẤT / NOT STARTED** | Customer read views, không giá/thu tiền/công nợ; task riêng, chưa có `/customers` |
| REAL PILOT / STOP FEATURE BUILD | **REQUIRED AFTER V2-B** | Điện thoại/số liệu thật; năm task và metrics trong roadmap |
| V2-C / V2-D / V2-E | **EVIDENCE GATED / NOT AUTHORIZED** | Không mặc định xây; pilot + contract/scope riêng trước implementation |

**G01/G02 closure evidence:** reviewed head `e57cf29c5ed4da550048c7efae1b4e36c9dfda34`; PR #32 merged vào main tại `9c29fa2beea57bd82eb74a4b88c5b79987acefb1`, lúc `2026-10-09T13:09:03Z`. [Merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37934810940): typecheck, lint, full tests và production build PASS. Code và regressions của #32 được giữ nguyên khi tích hợp reset.

**G10 closure evidence:** reviewed head `3bf2cdafdd48dc690c9d1fb3b39197cd5f3b956f`; PR #33 merged vào main tại `87d918d02ee5cbb22bb1e76475292fab4b7fdae2`, lúc `2026-10-09T14:41:55Z`. [Merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37946122446): typecheck, lint, full tests và production build PASS. Common/batch/current draft options, trim/lowercase dedupe, async selection và real persistence regressions đã có; không auto-reserve hoặc đổi stock/schema.

**V2-A1 closure evidence:** người dùng duyệt head `2351151d5d58d6cf5c989e60d26fa7566700d986`; [PR #35](https://github.com/17thedevv/VuonUomSo/pull/35) merged tại `c83880b49136659aa9f592633e325332421d110e` lúc `2026-10-09T15:36:22Z`. [Merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37952987463) trên đúng merge commit, event `push`: typecheck, lint, 55 files / 860 tests và production build PASS. 91 Garden tests bảo vệ coherent two-table read snapshot, per-batch available15/shortage3, legacy grouping/search, external exclusion, fail-closed source/identity/quantity/overflow, no writes và re-query sau mutation hiện có. Đây là read-model acceptance; tại thời điểm closure A1, Garden UI chưa triển khai/nghiệm thu.

**V2-A2 closure evidence:** người dùng duyệt head `b6d8b5a19255231befe3a837911185a8c184fd85`; [PR #37](https://github.com/17thedevv/VuonUomSo/pull/37) merged tại `8a1d6853d3e27fe02b5cdcfff129dbc6e904b897` lúc `2026-10-09T16:37:52Z`. [Merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37960503730) trên đúng merge commit, branch `main`, event `push`: typecheck, lint, 56 files / 882 tests và production build PASS. 22 Garden UI regressions + 91 A1 regressions giữ fixture available15/shortage3, full group totals khi tìm M06, URL/filter/back context, latest success/error protection, fail-closed/retry và reload committed facts/Undo.

**V2-A2 main acceptance:** đọc trực tiếp router/Garden/BatchDetail trên merge commit; chạy lại 16 native Edge browser checks tại360/390/430/768/1280px PASS: onboarding guard, search/filter/reload/back, existing ready update25 → Garden available22 → Undo available15/shortage3, error ẩn totals cũ → retry, no horizontal overflow/control mới ≥44px. Harness, screenshots và JSON evidence lưu tại `C:/Users/84387/.codex/artifacts/v2-a2-closure-2026-10-09/` (`browser-evidence.json` ghi đúng main SHA). Today/NAV_ITEMS, A1 read model, mutation services và domain/schema giữ nguyên; tại thời điểm nghiệm thu A2 chưa có QuickUpdateChooser/A3/A4. Keyboard evidence là reduced browser viewport, không phải physical IME.

**V2-A3 closure evidence (10/10/2026):** người dùng review PASS head `d0b879950ba31e64b84d5dfd0003c5f3d7a36cb7`; [PR #39](https://github.com/17thedevv/VuonUomSo/pull/39) merged tại `f345a1af142a50958849ccb333343b42d69214ef` lúc `2026-10-09T17:25:19Z`. [Merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37966152030) trên đúng merge commit, branch `main`, event `push`: typecheck, lint, 57 files / 907 tests và production build PASS. Đúng 7 file UI/navigation/test; 25 real Dexie/UI regressions mới + 141 targeted PASS bảo vệ exact M06/M07 ID, all-view/zero-available/full group picker, fresh Batch/Reservation, stale success/error, intent allowlist/one-shot retry/back/remount, explicit ready adjustment, legitimate shortage, rollback/input retention/retry, no-write selection/cancel, legacy entry và Undo/Garden reload.

**V2-A3 main acceptance:** source tree trên merge commit khớp hoàn toàn reviewed head; đọc trực tiếp Garden/chooser/intent/BatchDetail và modals hiện có. Chạy lại native Edge + real IndexedDB tại360/390/430/768/1024/1280px PASS: global/contextual entry, correct batch ID, inventory living30→10 bắt explicit ready8 (available0/shortage10), ready31 reject, ready10/O18 được lưu (available0/shortage8), Garden q/view/open sau commit/Undo, browser back/reload không replay intent, add-new/cancel context, focus/keyboard/Escape, long names/codes, no horizontal overflow và controls mới ≥44px. Hai modal cũ vẫn tới được nút lưu tại390×420px. Harness/screenshots/JSON: `C:/Users/84387/.codex/artifacts/v2-a3-closure-2026-10-10/` (`browser-evidence.json` ghi đúng merge SHA). A1 service, modal forms, mutation services/Undo/history, domain/schema, Today/NAV_ITEMS và frozen contract giữ nguyên; không có A4 code hoặc new stock command. PR #29/#31 vẫn preserved/unmerged/not adopted.

**V2-A4 closure evidence (10/10/2026):** người dùng APPROVED FOR MERGE head `766d336964df30f59d7ddae93137957f8d4cfdea`; [PR #41](https://github.com/17thedevv/VuonUomSo/pull/41) merged tại `cf18af6fce9cc949f7b67860d2fe75b0f65979c4` lúc `2026-10-10T07:12:31Z`. [Merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/38033627397) trên đúng merge commit, branch `main`, event `push`: typecheck, lint, 58 files / 932 tests và production build PASS. 25 regressions mới so với A3 giữ Today A1 own available/outstanding, fixture available15/shortage3 và external exclusion, fail-closed/latest success/error, refresh/Undo, bốn tab/routes cũ, Garden group/leaf variety prefill, default quantity, no auto-reserve và q/view/open back context. Delta review `1cd5e4facc3ef03527c5d257df4270851365d7b2` → approved head chỉ sửa Today link và test: “Xem đơn hàng” tới `/orders` không filter; real Dexie partial order40/own outstanding23/shortage17 vẫn được hiển thị và không có business writes khi điều hướng.

**V2-A4 main acceptance:** source tree trên merge commit khớp hoàn toàn approved head; đọc trực tiếp Today/router/navigation/Garden/OrderNew. Native Edge + real IndexedDB chạy lại tại360/390/430/768/1024/1280px PASS: Today15 → tìm Monthong/M06 → cập nhật ready25 → Today22 → Undo15; M07 prefill đúng Monthong/default30000, tạo order không reserve/stock write, back giữ q/view/open; fail-closed ẩn totals cũ/retry, legacy batch/order/shipment/dossier routes, long labels/no overflow, focus/keyboard và reduced390×420px. Correction acceptance tại cả sáu kích thước xác minh Today O23 → unfiltered orders chứa đơn giữ một phần40/23/17, Đơn tab active, Enter activation và target ≥44px. Harness/screenshots/JSON ghi đúng main SHA tại `C:/Users/84387/.codex/artifacts/v2-a4-closure-2026-10-10/`. Không có V2-B1 code, schema/domain/mutation service changes hoặc frozen contract changes trong #41.

**V2-B1 closure evidence (10/10/2026):** người dùng APPROVED FOR MERGE reviewed head `b0debdc939d85a446b0acb2182c33e42022c9095`; [PR #44](https://github.com/17thedevv/VuonUomSo/pull/44) merged tại `f4c9a4b7497f6cf52263f4ec09fb7f88268cd6f6` lúc `2026-10-10T08:33:42Z`. [Merge CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/38038306649) trên đúng merge commit, branch `main`, event `push`: typecheck, lint, 61 files / 977 tests và production build PASS. Đúng 8 file UI/selection/formatter/tests; 45 B1 regressions mới dùng real Dexie/fake-indexeddb và controlled promises/platform APIs. Chạy lại trên main 4 files / 136 tests PASS (45 B1 + 91 A1): ID/subset/partial group không đếm trùng, available15/shortage3/external exclusion, fresh generation reject selected batch đã xóa/hết hàng, fail-closed/no writes, request races, public-field allowlist, thời điểm sau successful reads, immutable snapshot và Preview = Copy = Web Share text, Clipboard fallback/cancel/reject.

**V2-B1 main acceptance:** source tree trên merge commit khớp hoàn toàn reviewed head; đọc trực tiếp router/Garden/share screen/selection/formatter và A1. Owner `/garden/share` nằm trong AppShell/onboarding; Garden entry giữ q/view/open, selection dùng real batch ID và A1 all-view. Native Edge + real IndexedDB chạy lại 14 checks PASS tại360/390/430/768/1024/1280px và reduced390×420px: keyboard, nhiều giống/partial group/subset/mã lô bật-tắt, frozen preview/copy sau stock change và explicit regenerate15→13, native Clipboard exact argument parity, manual fallback, mocked Web Share resolve/cancel/reject, no business writes, corrupt unselected facts fail toàn bảng/retry, zero-available/long Unicode/no overflow. Windows Clipboard readback đổi LF→CRLF; payload `writeText` vẫn đúng nguyên văn preview. Harness/screenshots/JSON ghi đúng main SHA: `D:/Project-17/artifacts/v2-b1-closure-2026-10-10/`. Native Web Share sheet, actual Zalo delivery, physical IME, installed-PWA offline và real field pilot vẫn **NOT VERIFIED**; browser mocks không phải nghiệm thu thực địa. Không Customer Read Views, public publishing URL/backend, schema/domain/mutation service/dependency/frozen contract changes.

**Separate correctness follow-up — OPEN / NOT FIXED / REQUIRED BEFORE REAL PILOT:** [Issue #42](https://github.com/17thedevv/VuonUomSo/issues/42) theo dõi legacy `getVarietyAvailability()` tính external reservation có `batchId` trùng own batch vào informational availability, khiến OrderNew feedback và `order_created.availableAtGarden` khác A1. Acceptance: external không giảm own stock; real Dexie collision regression giữ per-batch available15/shortage3; feedback và persisted event nhất quán; giữ reservation/fulfillment/release semantics, G01 rollback/retry/Undo và không schema/new command. Phải sửa, review và xác minh merge CI trước real pilot. A4/B1/closure không sửa hoặc tuyên bố giải quyết issue này; B1 dùng A1 external exclusion không sửa legacy OrderNew/event availability.

G01/G02/G10 đã DONE / CLOSED qua #32/#33; **V2-A1–A4 DONE / CLOSED qua #35/#37/#39/#41; V2-B1 DONE / CLOSED qua #44**. **V2-B2 là NEXT — DUY NHẤT / NOT STARTED**. Toàn V2-B chưa hoàn tất vì B2 chưa triển khai. Delivery order: B1 closure → B2 Customer Read Views → correctness issue #42 → REAL PILOT REQUIRED AFTER V2-B. FC5/FC6 SUPERSEDED BY V2; C/D/E EVIDENCE GATED / NOT AUTHORIZED. Closure này chỉ sửa PROJECT_STATE và roadmap sau merge CI PASS, không có `web/` diff so với main đã chứa #44; dừng sau closure, không implement B2 hoặc sửa issue #42/mutation services/schema. PR #29/#31 vẫn preserved/unmerged/not adopted. Bảng hiện hành này và V2 Roadmap thay các snapshot NEXT cũ trong tài liệu tham khảo/skills. Không đợi FC5/FC6 trước V2; schema/Product/Variant/Location/Size/payment/public URL/backend đều ngoài scope A/B. Native Web Share/physical IME, installed-PWA offline thực tế và field pilot vẫn NOT VERIFIED.


### Giai đoạn kỹ thuật nền tảng (Foundation Phases):
| Phase | Tên giai đoạn | Trạng thái | Ghi chú |
| :--- | :--- | :--- | :--- |
| **P0** | **Foundation** | **DONE** | AppShell, Dexie IDB, Routing, Seed, Parser, Tests |
| **P1** | **Read-only UX** | **DONE** | Today, Batches, Orders, Invariants, Tests |
| **P2** | **Core Write Flow** | **DONE** | Create Batch, Update Inventory, Quick Contact, Create Order, Undo |
| **P3** | **Reservation** | **DONE** | Giữ cây lô nội bộ & nguồn ngoài, chống bán khống |
| **P4** | **Shipment** | **DONE** | Danh sách chuyến xe, giao từng phần, trừ tồn kho vật lý |
| **P5** | **Dossier + Backup** | **DONE** | Hồ sơ nguồn gốc lô cây; sao lưu/khôi phục JSON an toàn |
| **P6** | **Validation Instrumentation** | **DONE** | Đo lường sự kiện thực địa, khảo sát pilot, xuất telemetry bảo mật |

### Giai đoạn hoàn thiện nghiệp vụ thực tế (Functional Coverage Roadmap):
| Phase | Tên giai đoạn | Trạng thái | Quyền hạn của Agent |
| :--- | :--- | :--- | :--- |
| **FC0** | **Functional Contract** | **DONE / CLOSED** | Khóa toàn bộ 12 semantics, 6 đại lượng, chuyển trạng thái và từ điển tiếng Việt |
| **FC1** | **Batch Stock Lifecycle** | **DONE** | Nghiệm thu 08/10/2026; PR #4 merged vào main tại `7eb4987`; CI merge xanh; xem báo cáo nghiệm thu |
| **FC2** | **Order Lifecycle & Corrections** | **DONE** | PR #8/#9 đã merge; CI xanh; nghiệm thu cuối mobile 08/10/2026 PASS |
| **FC3** | **Reservation Reconciliation** | **DONE** | FC3-0/1A/1B/2/3 CLOSED; PR #20 merged `bce3abc`, CI merge xanh; Final Acceptance trên main 08/10/2026 PASS; FC3-1 DONE |
| **FC4** | **External Supply Truthfulness** | **DONE** | FC4-0/FC4-1 CLOSED; PR #24/#25 merged, correction main `f812162`, merge-CI SUCCESS. Final Acceptance trên main 09/10/2026 PASS; H/M, create/edit/cancel/backup đạt |
| **FC5** | **Fulfillment & Completion Semantics** | **SUPERSEDED BY V2** | FC5-0 contract merge được giữ là lịch sử; FC5-1 preserved/not adopted, không phải prerequisite |
| **FC6** | **Pilot Hardening & Telemetry** | **SUPERSEDED BY V2** | Không tiếp tục phase cũ; giữ instrumentation đã có cho pilot sau V2-B |
| **STOP** | **REAL PILOT** | **REQUIRED AFTER V2-B** | Không chờ FC5/FC6 hoặc C/D/E |

### Lịch sử FC1–FC3 (08/10/2026)

Các NEXT/PLANNED trong snapshot lịch sử không điều khiển roadmap hiện hành V2.

- FC1 đã có trên `main`: [PR #4](https://github.com/17thedevv/VuonUomSo/pull/4), merge `7eb4987fcf3ff949f5874107de67ed2bd89a1e19`, [CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37709990216).
- [Báo cáo nghiệm thu FC1](../docs/development/FC1-FINAL-ACCEPTANCE.md): transactional validation, Undo guard, 299 tests và core workflow mobile đến xuất đủ đơn; không phát hiện BLOCKER/HIGH ảnh hưởng số lượng trong phạm vi review.
- C1 R01/R02: **ACCEPTED / MERGED**, [PR #6](https://github.com/17thedevv/VuonUomSo/pull/6) tại `ae43aa258b1f84e3ab25ca601a688fc041f25dad`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37734851505). Domain/mutation FC0 giữ nguyên.
- Bugfix helper `ReserveQuantityModal`: **ACCEPTED / MERGED**, [PR #7](https://github.com/17thedevv/VuonUomSo/pull/7) tại `54a9fa3c7897c21a95391c15b371b02e19a57e7f`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37738141617).
- FC2 slice 1: **ACCEPTED / MERGED**, [PR #8](https://github.com/17thedevv/VuonUomSo/pull/8) tại `bf3dee59fc0644663495ddf43d736b5535ff31e2`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37740026948).
- FC2 slice 2: **ACCEPTED / MERGED**, [PR #9](https://github.com/17thedevv/VuonUomSo/pull/9) tại `034b33058d90b7f0a70854c8e329f5106b42decd`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37748317065).
- [FC2 Final Acceptance](../docs/development/FC2-FINAL-ACCEPTANCE.md): **PASS / FC2 DONE**. Mobile create → edit → reserve → edit conflict → cancel, reload và kiểm tồn kho/lịch sử đạt. **FC3 NEXT**, chưa triển khai reconciliation hay `closed_remaining` FC5.
- **FC3-0 CLOSED**: [Contract approved](../docs/development/FC3-FUNCTIONAL-CONTRACT.md), [PR #11](https://github.com/17thedevv/VuonUomSo/pull/11) merged tại `d1ecddfdb9538f96c03ef2e2ae6b706f371e44c5`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37754300293).
- **FC3-1A CLOSED / ACCEPTED / MERGED — Backup Shortage + Stale Reservation Undo Safety**: [PR #14](https://github.com/17thedevv/VuonUomSo/pull/14) merged tại `261f7ddddbefb92c07173f813950bf2ec2b54614`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37760585326). Người dùng duyệt exact-head `ad4010fcc3dda64f3c451aa204d5852488a7bff3`; 43 files / 406 tests PASS, lint0/0, typecheck/build PASS. [Báo cáo slice](../docs/development/FC3-1A-SAFETY.md): backup shortage + transactional stale Undo guards đạt. Tại handoff 1A, reconciliation mutation/UI chưa expose; nay FC3-1 DONE theo Final Acceptance.
- **FC3-1B CLOSED / ACCEPTED / MERGED — Atomic Order Reduction Reconciliation domain/service**: người dùng duyệt exact-head `0a5385c5b89f6b4a087c8142188786fc1c9567fa`; [PR #16](https://github.com/17thedevv/VuonUomSo/pull/16) merged tại `10b9ae9cd00dcf123366eb47be554816edf82660`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37768645265). Typecheck/build PASS, lint0/0 (143 files), 45 files / 493 tests PASS. [Báo cáo slice](../docs/development/FC3-1B-ORDER-REDUCTION.md): strict confirmation, idempotency, planned allocation, atomicity/races và real-service stale Undo gate PASS. Tại handoff 1B, FC3-1/overall chưa DONE; nay Final Acceptance PASS / FC3 DONE.
- **FC3-2 CLOSED / ACCEPTED / MERGED — Batch Shortage Reconciliation + own-batch transfer**: người dùng duyệt exact-head `5ea0e7a9dbe6d45c7dd084374991c2cb7cec1dd3`; [PR #18](https://github.com/17thedevv/VuonUomSo/pull/18) merged tại `9d782458f173633f36c801d49668f78d02d91da4`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37772762007). Typecheck/build PASS, lint0/0 (147 files), 47 files / 626 tests PASS. [Báo cáo slice](../docs/development/FC3-2-BATCH-RECONCILIATION.md): partial shortage, own transfer/aggregate capacity, partially-shipped/planned safety, strict confirmation/cross-trigger idempotency và real Undo/backup/race/rollback gates PASS. Tại handoff 2, FC3-1/overall chưa DONE; nay Final Acceptance PASS / FC3 DONE.
- **FC3-3 CLOSED / ACCEPTED / MERGED — UI + Cross-flow Hardening**: người dùng duyệt exact-head `f9881a792011d3961c3a2d11d57c997f6f5539e9`; [PR #20](https://github.com/17thedevv/VuonUomSo/pull/20) merged tại `bce3abcd69c08e32b13cb341c071c8327e720199`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37779744535). Typecheck/build PASS, lint0/0 (153 files), 48 files / 652 tests PASS. [Báo cáo UI/integration](../docs/development/FC3-3-UI-HARDENING.md): Trigger A/B, draft metadata, stale/retry identity và planned links PASS.
- **FC3 FINAL ACCEPTANCE PASS / FC3 DONE / FC3-1 DONE**: [Nghiệm thu trên main](../docs/development/FC3-FINAL-ACCEPTANCE.md), browser A–F 360/390/430/1280px, shortage/transfer backup-restore qua UI + retry idempotent, stale Undo và xuất sau reconciliation PASS. Không phát hiện BLOCKER/HIGH hoặc lifecycle dead-end trong scope đã kiểm. Chưa test IME thiết bị thật/field pilot. Before pilot NOTE: phân biệt ổn định các đơn cùng khách có cùng quantity/date; deep marker integrity NOTE vẫn deferred. FC4/FC5 PLANNED / NOT STARTED; không mở implementation FC4 trong closure.
- UI Reference Study v0.1: **RESEARCH APPROVED**; chỉ R01/R02 đã nghiệm thu và merge. R03/R04/R05 chưa triển khai trong task này. Sản phẩm tham khảo không tạo requirement mới.

### Lịch sử FC4 closure (08–09/10/2026)

- **FC4-0 CLOSED / ACCEPTED / MERGED**: [External Supply Truthfulness Contract](../docs/development/FC4-FUNCTIONAL-CONTRACT.md), người dùng duyệt exact-head `69c2aa2a54c5ee991c518b498e8f82071845d7d8`; [PR #22](https://github.com/17thedevv/VuonUomSo/pull/22) merged tại `0507906421df4872d45f07ef4a625a61b7b90e54`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37796903976), typecheck/lint/full tests/build PASS. Contract audit exact base `86f513c7ce8a8f7c95ef85099872b91b2d6cb64d`; PR đúng 2 file docs, không có `web/` diff. Closure này không phải FC4 DONE.
- Contract khóa bỏ catalog estimate/fallback30k khỏi production workflow, external quantity trống ban đầu và explicit user-confirmed input/acknowledgement, supplier contact không phải inventory, legacy commitments/history/backup được giữ. Required implementation gate: **cả `reserveOwnBatch()` và `reserveExternalSupplier()`** phải dùng canonical current coverage/shortage gồm F của released source, kèm real Dexie regression riêng: requested50k/released Q20k F10k/active Q20k → add30k FAIL, add20k PASS nếu guard nguồn tương ứng đạt. Không over-cover sau xuất/release; không refactor toàn reservation engine.
- **FC4-1 CLOSED / ACCEPTED / MERGED**: người dùng duyệt exact-head `6221ad15137607c5ebde0f1e77948c851b81acbc`; [PR #24](https://github.com/17thedevv/VuonUomSo/pull/24) merged tại `6d31d456413ace29c40f996e4517ec451e04192d`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37891865192), typecheck/build PASS, lint0/0 (157 files), 52 files / 717 tests PASS, PWA14. Cả own/external creation dùng canonical released-F coverage; confirmation, supplier contact Option B, races/rollback/FC2/FC3/backup gates đã được duyệt. [Báo cáo implementation](../docs/development/FC4-1-EXTERNAL-SUPPLY.md) là snapshot handoff trước merge.
- **FC4 lifecycle correction ACCEPTED / MERGED**: người dùng duyệt exact-head `2110fcd2bc51469606256f36265e3bd2ab3e3f1c`; [PR #25](https://github.com/17thedevv/VuonUomSo/pull/25) merged tại `f812162814a65b7c38fe11eff3ee4cee3b77bb28`; [merge-CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37894202547). Typecheck/build PASS, lint0/0 (158 files), 53 files / 723 tests PASS, PWA14. HIGH copy/history phát hiện trên main `6d31d45` đã sửa: release preview/event dùng O, quantity=Q giữ compatibility, F/history không đổi; external/mixed shipment chỉ claim đúng own stock effect, legacy no-lines không suy luận. Mutation/atomicity/idempotency giữ nguyên.
- **FC4 FINAL ACCEPTANCE PASS / CLOSED / FC4 DONE (09/10/2026)**: [Báo cáo nghiệm thu main](../docs/development/FC4-FINAL-ACCEPTANCE.md). Sau merge-CI xanh, chạy lại trên clean main `f812162`: A–G/H/M tại360/390/430/1280px PASS; external12k→ship5k→release7k giữ own stock nguyên vẹn, mixed own3/ext5 chỉ giảm own3. Mobile390px create order/customer/supplier → reserve32k → edit/reconcile25k → separate metadata save, cancel external + planned shipment và backup/restore/reopen qua UI PASS. Không phát hiện BLOCKER/HIGH hoặc lifecycle dead-end trong các flow đã kiểm. Chưa kiểm physical IME/field pilot/offline installed-PWA; FC3 deferred notes giữ nguyên. **FC5 PLANNED / NOT STARTED**, không triển khai trong closure.

---

### Lịch sử FC5-0 contract closure (09/10/2026) — SUPERSEDED DELIVERY

FC5-0 đã merge; các yêu cầu implementation bên dưới là contract tham khảo, không authorization hoặc prerequisite của V2.

- **FC5-0 CLOSED / ACCEPTED / MERGED — docs-only**: [Fulfillment & Completion Functional Contract](../docs/development/FC5-FUNCTIONAL-CONTRACT.md), exact audit baseline `0647bfbbdb183ac0e7a652275096e7044b2cef04`; người dùng duyệt head `2ccec90b3053af5f5aa937af5b2edb9307475aba`; [PR #27](https://github.com/17thedevv/VuonUomSo/pull/27) merged tại `29d97c87de810a68607e7dc4433599d8945dfaf7`; [merge-CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37898636631), typecheck/lint/full tests/build PASS. Approved gate lint0/0 (158 files), 53 files / 723 tests PASS, PWA14. FC0–FC4 DONE / CLOSED; terminal truth table cancelled S0, shipped S=R, closed_remaining 0<S<R; S>R là invalid state, không normalize.
- Close giữ requested/Q/F/completed history/physical stock; nhả O và cancel mọi planned trong một transaction, append history/operation marker. stopped=R−S khác releasedOutstanding=O_before; closed actionable remaining/shortage=0 nhưng stopped/history không biến mất. Không reopen/Undo riêng hoặc receipt/delivery semantics.
- Required FC5-1 gates: explicit terminal guards mọi mutation/helper/queue; completion exact S=R/O0/planned0; stale preview/reconfirm; collision operationId **hai chiều** xuyên FC3 A/B và FC5; real Dexie rollback/races/stale Undo/backup regressions trước expose mutation. Policy persisted: giữ Dexie5 / backupV1 / record shape, new enum phải được validate; valid legacy restore giữ tương thích, pre-FC5 reader reject closed enum trước write, không infer/migrate partial thành closed.
- Snapshot trước reset: **FC5-1 NEXT — Atomic Close Remaining domain/service + terminal guards/backup/Undo correctness**. Contract review/approved merge/merge-CI đã đạt; sau FC5-1 mới FC5-2 UI/vocabulary → FC5-3 cross-flow hardening → Final Acceptance trên main. **FC5 implementation NOT STARTED / FC5 overall NOT DONE / FC6 PLANNED**, không `web/` diff ở task closure này. Physical IME/PWA offline thực tế/field pilot vẫn chưa kiểm chứng; FC3 deferred notes giữ nguyên.

---

## 3. Scope Boundaries & Out-Of-Scope

### Tuyệt đối KHÔNG triển khai trong bất kỳ giai đoạn prototype nào:
- Real Authentication (Supabase, Firebase, JWT, OAuth, v.v.)
- Cloud database sync hoặc multi-device realtime trước khi có validation
- Hệ thống thanh toán / cổng ngân hàng (Payment gateway)
- Kế toán công nợ phức tạp (Debt / Accounting system)
- Trí tuệ nhân tạo / AI tư vấn cây giống trong app
- Sàn thương mại điện tử công cộng (Public Marketplace)
- Chat nội bộ (giao dịch đã diễn ra trên Zalo/gọi điện)
- Quản lý nhân sự / chấm công / phân quyền nhân viên
- Tối ưu hóa định tuyến xe phức tạp (Route optimization engine)
- Native mobile wrappers (React Native, Capacitor) nếu chưa có yêu cầu trực tiếp

---

## 4. Prompt Drift Protection

Mọi agent phải tuân thủ nghiêm ngặt quy tắc chống trôi lệch yêu cầu:

1. **Thứ tự ưu tiên**:
   - `Chỉ thị trực tiếp, rõ ràng của User trong phiên hiện tại` **>** `Project Rules / Skills` **>** `Nội dung agent cũ tự viết trong báo cáo`.
2. **Không tự diễn giải thay đổi Roadmap**:
   - Nếu một báo cáo cũ hoặc lời thoại trước đó vô tình ghi *"Làm reservation ở P1"*, điều đó **KHÔNG** làm thay đổi roadmap chuẩn.
   - Trừ khi User đích thân ra lệnh: *"Bỏ qua P1, hãy làm ngay reservation"*, agent **BẮT BUỘC** giữ nguyên ranh giới phase ghi tại file này.
3. **Khi thấy việc hay ho ngoài scope**:
   - Ghi vào mục `Deferred` của báo cáo cuối cùng.
   - **TUYỆT ĐỐI KHÔNG** tự ý viết code cho phase sau chỉ vì "tiện tay" hoặc "thấy thiếu".
