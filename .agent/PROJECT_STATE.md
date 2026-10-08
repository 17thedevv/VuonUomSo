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
| **FC3** | **Reservation Reconciliation** | **IN PROGRESS** | FC3-0/FC3-1A/FC3-1B CLOSED; FC3-2 REVIEW PENDING — Batch Shortage Reconciliation + own-batch transfer; UI chưa triển khai |
| **FC4** | **External Supply Truthfulness** | **PLANNED** | Chờ FC3 hoàn thành và merge (tùy chọn theo pilot segment) |
| **FC5** | **Fulfillment & Completion Semantics** | **PLANNED** | Chờ FC3/FC4 hoàn thành và merge |
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
- **FC3-1A CLOSED / ACCEPTED / MERGED — Backup Shortage + Stale Reservation Undo Safety**: [PR #14](https://github.com/17thedevv/VuonUomSo/pull/14) merged tại `261f7ddddbefb92c07173f813950bf2ec2b54614`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37760585326). Người dùng duyệt exact-head `ad4010fcc3dda64f3c451aa204d5852488a7bff3`; 43 files / 406 tests PASS, lint0/0, typecheck/build PASS. [Báo cáo slice](../docs/development/FC3-1A-SAFETY.md): backup shortage + transactional stale Undo guards đạt. Reconciliation mutation/UI chưa expose; FC3-1 chưa DONE.
- **FC3-1B CLOSED / ACCEPTED / MERGED — Atomic Order Reduction Reconciliation domain/service**: người dùng duyệt exact-head `0a5385c5b89f6b4a087c8142188786fc1c9567fa`; [PR #16](https://github.com/17thedevv/VuonUomSo/pull/16) merged tại `10b9ae9cd00dcf123366eb47be554816edf82660`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37768645265). Typecheck/build PASS, lint0/0 (143 files), 45 files / 493 tests PASS. [Báo cáo slice](../docs/development/FC3-1B-ORDER-REDUCTION.md): strict confirmation, idempotency, planned allocation, atomicity/races và real-service stale Undo gate PASS. FC3-1 và FC3 overall vẫn chưa DONE.
- **FC3-2 REVIEW PENDING — Batch Shortage Reconciliation + own-batch transfer**: [báo cáo implementation](../docs/development/FC3-2-BATCH-RECONCILIATION.md), branch `feat/fc3-reservation-reconciliation`, base `8577a79`. Trigger B partial shortage và own transfer atomic, aggregate target capacity, partially-shipped/planned guards, strict fingerprint/idempotency, real Undo/backup/race/rollback regressions đã triển khai; chờ nghiệm thu PR trước merge. FC3-1 và FC3 overall chưa DONE. FC3-3 UI chưa bắt đầu; sau nghiệm thu/merge mới UI → Final Acceptance. Không mở FC4/FC5 hoặc generic-product refactor. NOTE marker projection integrity vẫn deferred tới backup/event-integrity hoặc FC3-3.
- UI Reference Study v0.1: **RESEARCH APPROVED**; chỉ R01/R02 đã nghiệm thu và merge. R03/R04/R05 chưa triển khai trong task này. Sản phẩm tham khảo không tạo requirement mới.

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
