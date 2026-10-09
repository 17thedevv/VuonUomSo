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
| **FC5** | **Fulfillment & Completion Semantics** | **PLANNED / NOT STARTED** | FC3/FC4 DONE; chờ task FC5 được giao, chưa triển khai trong closure |
| **FC6** | **Pilot Hardening & Telemetry** | **PLANNED** | Chờ FC5 hoàn thành và merge |
| **STOP**| **FIELD PILOT** | **PLANNED** | Mang app ra vườn sau khi hoàn thành FC6 |

### FC1 closure & next tasks (08/10/2026)

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

### FC4-0 contract closure & next task (08/10/2026)

- **FC4-0 CLOSED / ACCEPTED / MERGED**: [External Supply Truthfulness Contract](../docs/development/FC4-FUNCTIONAL-CONTRACT.md), người dùng duyệt exact-head `69c2aa2a54c5ee991c518b498e8f82071845d7d8`; [PR #22](https://github.com/17thedevv/VuonUomSo/pull/22) merged tại `0507906421df4872d45f07ef4a625a61b7b90e54`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37796903976), typecheck/lint/full tests/build PASS. Contract audit exact base `86f513c7ce8a8f7c95ef85099872b91b2d6cb64d`; PR đúng 2 file docs, không có `web/` diff. Closure này không phải FC4 DONE.
- Contract khóa bỏ catalog estimate/fallback30k khỏi production workflow, external quantity trống ban đầu và explicit user-confirmed input/acknowledgement, supplier contact không phải inventory, legacy commitments/history/backup được giữ. Required implementation gate: **cả `reserveOwnBatch()` và `reserveExternalSupplier()`** phải dùng canonical current coverage/shortage gồm F của released source, kèm real Dexie regression riêng: requested50k/released Q20k F10k/active Q20k → add30k FAIL, add20k PASS nếu guard nguồn tương ứng đạt. Không over-cover sau xuất/release; không refactor toàn reservation engine.
- **FC4-1 CLOSED / ACCEPTED / MERGED**: người dùng duyệt exact-head `6221ad15137607c5ebde0f1e77948c851b81acbc`; [PR #24](https://github.com/17thedevv/VuonUomSo/pull/24) merged tại `6d31d456413ace29c40f996e4517ec451e04192d`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37891865192), typecheck/build PASS, lint0/0 (157 files), 52 files / 717 tests PASS, PWA14. Cả own/external creation dùng canonical released-F coverage; confirmation, supplier contact Option B, races/rollback/FC2/FC3/backup gates đã được duyệt. [Báo cáo implementation](../docs/development/FC4-1-EXTERNAL-SUPPLY.md) là snapshot handoff trước merge.
- **FC4 lifecycle correction ACCEPTED / MERGED**: người dùng duyệt exact-head `2110fcd2bc51469606256f36265e3bd2ab3e3f1c`; [PR #25](https://github.com/17thedevv/VuonUomSo/pull/25) merged tại `f812162814a65b7c38fe11eff3ee4cee3b77bb28`; [merge-CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37894202547). Typecheck/build PASS, lint0/0 (158 files), 53 files / 723 tests PASS, PWA14. HIGH copy/history phát hiện trên main `6d31d45` đã sửa: release preview/event dùng O, quantity=Q giữ compatibility, F/history không đổi; external/mixed shipment chỉ claim đúng own stock effect, legacy no-lines không suy luận. Mutation/atomicity/idempotency giữ nguyên.
- **FC4 FINAL ACCEPTANCE PASS / CLOSED / FC4 DONE (09/10/2026)**: [Báo cáo nghiệm thu main](../docs/development/FC4-FINAL-ACCEPTANCE.md). Sau merge-CI xanh, chạy lại trên clean main `f812162`: A–G/H/M tại360/390/430/1280px PASS; external12k→ship5k→release7k giữ own stock nguyên vẹn, mixed own3/ext5 chỉ giảm own3. Mobile390px create order/customer/supplier → reserve32k → edit/reconcile25k → separate metadata save, cancel external + planned shipment và backup/restore/reopen qua UI PASS. Không phát hiện BLOCKER/HIGH hoặc lifecycle dead-end trong các flow đã kiểm. Chưa kiểm physical IME/field pilot/offline installed-PWA; FC3 deferred notes giữ nguyên. **FC5 PLANNED / NOT STARTED**, không triển khai trong closure.

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
