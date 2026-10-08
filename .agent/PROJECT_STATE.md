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
| **FC2** | **Order Lifecycle & Corrections** | **NEXT** | Chưa triển khai. C1 R01/R02 đã merge; chờ nghiệm thu bugfix riêng đơn vị giữ cây trước khi mở FC2 |
| **FC3** | **Reservation Reconciliation** | **PLANNED** | Chờ FC2 hoàn thành và merge |
| **FC4** | **External Supply Truthfulness** | **PLANNED** | Chờ FC3 hoàn thành và merge (tùy chọn theo pilot segment) |
| **FC5** | **Fulfillment & Completion Semantics** | **PLANNED** | Chờ FC3/FC4 hoàn thành và merge |
| **FC6** | **Pilot Hardening & Telemetry** | **PLANNED** | Chờ FC5 hoàn thành và merge |
| **STOP**| **FIELD PILOT** | **PLANNED** | Mang app ra vườn sau khi hoàn thành FC6 |

### FC1 closure & next tasks (08/10/2026)

- FC1 đã có trên `main`: [PR #4](https://github.com/17thedevv/VuonUomSo/pull/4), merge `7eb4987fcf3ff949f5874107de67ed2bd89a1e19`, [CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37709990216).
- [Báo cáo nghiệm thu FC1](../docs/development/FC1-FINAL-ACCEPTANCE.md): transactional validation, Undo guard, 299 tests và core workflow mobile đến xuất đủ đơn; không phát hiện BLOCKER/HIGH ảnh hưởng số lượng trong phạm vi review.
- C1 R01/R02: **ACCEPTED / MERGED**, [PR #6](https://github.com/17thedevv/VuonUomSo/pull/6) tại `ae43aa258b1f84e3ab25ca601a688fc041f25dad`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37734851505). Domain/mutation FC0 giữ nguyên.
- Task hiện tại: bugfix riêng helper số lượng `ReserveQuantityModal`, branch `fix/reservation-quantity-unit`; hoàn tất nghiệm thu trước khi mở `feat/fc2-order-lifecycle`.
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
