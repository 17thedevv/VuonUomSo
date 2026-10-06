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

| Phase | Tên giai đoạn | Trạng thái | Quyền hạn của Agent |
| :--- | :--- | :--- | :--- |
| **P0** | **Foundation** | **DONE** | Đã hoàn thành (AppShell, Dexie IDB, Routing, Seed, Parser, Tests) |
| **P1** | **Read-only UX** | **DONE** | Đã hoàn thành (Today, Batches, BatchDetail, Orders, OrderDetail, Invariants, Tests) |
| **P2** | **Core Write Flow** | **DONE** | Đã hoàn thành (Create Batch, Update Inventory, Quick Contact, Create Order, Undo, Invariants, Tests) |
| **P3** | **Reservation** | **DONE** | Đã hoàn thành (Giữ cây từ lô nội bộ, giữ cây từ nguồn ngoài, nhả giữ cây, chống bán khống, undo, tests) |
| **P4** | **Shipment** | **DONE / FROZEN** | Đã hoàn thành và đóng băng (Lên danh sách chuyến xe, giao hàng từng phần, trừ tồn kho vật lý current & ready, commit-time validation & atomicity, tests) |
| **P5** | **Dossier + Backup** | **DONE** | Đã hoàn thành (Hồ sơ nguồn gốc lô cây, chứng từ tham chiếu, in/lưu nội bộ; Sao lưu/khôi phục toàn bộ workspace JSON versioned, atomic transaction rollback, validation, tests) |
| **P6** | **Validation Instrumentation**| **DONE / FROZEN** | Đã hoàn thành và đóng băng (Đo lường sự kiện sử dụng, khảo sát pilot 4 câu hỏi, báo cáo kích hoạt A1/A2/A3 & WTP, xuất dữ liệu JSON, bảo vệ quyền riêng tư, tests) |
| **STOP**| **USER VALIDATION** | **ACTIVE** | **DỪNG CODE**: Mang app ra vườn cho người dùng thật tại Hữu Lũng, Tuấn Sơn thử nghiệm; thu thập dữ liệu thực địa để quyết định GO / PIVOT / STOP. CẤM CODE TÍNH NĂNG MỚI. |

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
