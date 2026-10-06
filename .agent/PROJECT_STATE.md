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
| **P3** | **Reservation** | **NEXT** | **ĐƯỢC PHÉP Ở TASK TIẾP THEO**: Giữ cây từ lô nội bộ, giữ cây từ nguồn ngoài, nhả giữ cây |
| **P4** | **Shipment** | **NOT STARTED** | **CẤM LÀM TRƯỚC**: Lên chuyến xe, giao hàng từng phần, ghi nhận hao hụt |
| **P5** | **Dossier + Backup** | **NOT STARTED** | **CẤM LÀM TRƯỚC**: Xuất hồ sơ nguồn gốc giống cây, sao lưu/phục hồi chuyên sâu |
| **P6** | **Validation Instrumentation**| **NOT STARTED** | **CẤM LÀM TRƯỚC**: Đo lường sự kiện sử dụng, câu hỏi khảo sát pilot |
| **STOP**| **USER VALIDATION** | **FROZEN** | **DỪNG CODE**: Sau P6, dừng toàn bộ code để mang ra vườn cho người dùng thật thử |

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
