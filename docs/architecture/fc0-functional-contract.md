# FC0 — Functional Contract & Mutation Semantics
**Dự án**: Vườn Ươm (*Sổ cây giống trên điện thoại*)  
**Trạng thái**: APPROVED & CLOSED  
**Phạm vi áp dụng**: Bắt buộc cho toàn bộ các phase triển khai FC1 – FC6  

---

## 1. Mô hình 6 đại lượng số lượng lâm nghiệp (The 6-Quantity Invariant Model)

$$0 \le Q_{\text{ready}} \le Q_{\text{living}} \le Q_{\text{init}}$$

| Ký hiệu | Tên hiển thị người dùng | Thuộc tính hệ thống | Ý nghĩa thực tế ngoài vườn | Quy tắc định lượng |
| :--- | :--- | :--- | :--- | :--- |
| $Q_{\text{init}}$ | **Số lượng ban đầu** | `initialQuantity` | Số cắm hom hoặc gieo hạt ban đầu | Nguyên dương ($> 0$) |
| $Q_{\text{living}}$ | **Cây còn sống** | `currentQuantity` | Tổng cây còn sống thực tế trên luống | $0 \le Q_{\text{living}} \le Q_{\text{init}}$ |
| $Q_{\text{ready}}$ | **Cây đủ chuẩn** | `readyQuantity` | Số cây đã đạt chuẩn xuất vườn | $0 \le Q_{\text{ready}} \le Q_{\text{living}}$ |
| $Q_{\text{reserved}}$ | **Đã giữ cho khách** | `reservedQuantity` | Cam kết còn outstanding trên lô | $\sum_{\text{active own-batch}} \max(\text{qty} - \text{fulfilledQty}, 0)$ |
| $Q_{\text{available}}$ | **Cây còn bán** | `availableQuantity` | Sẵn sàng chào bán hoặc giữ cho khách mới | $\max(Q_{\text{ready}} - Q_{\text{reserved}}, 0)$ (không bao giờ âm) |
| $Q_{\text{commitmentShortage}}$ | **Thiếu nguồn cam kết** | `commitmentShortage` | Đã hứa nhưng nguồn thực tế bị thiếu hụt | $\max(Q_{\text{reserved}} - Q_{\text{ready}}, 0)$ (không bị che giấu) |

---

## 2. 12 Điều khoản hợp đồng nghiệp vụ bất di bất dịch (The 12 Core Invariants)

### Điều khoản 1: Cây chết sau khi đã giữ — Cho phép ghi nhận sự thật
- Tuyệt đối **không được block** việc giảm `readyQuantity` chỉ vì sau mutation `reserved > ready`.
- Khi cây bị chết/loại bỏ thực tế: $Q_{\text{ready}}$ giảm $\rightarrow$ $Q_{\text{available}} = 0$ $\rightarrow$ xuất hiện $Q_{\text{commitmentShortage}} = Q_{\text{reserved}} - Q_{\text{ready}} > 0$.
- UI phải cảnh báo trung thực: *"Thiếu [X] cây đã giữ cho khách"* và cung cấp đường dẫn điều phối lại nguồn giữ (FC3).

### Điều khoản 2: $Q_{\text{living}} < Q_{\text{ready}}$ vẫn tuyệt đối cấm
- Invariant $Q_{\text{ready}} \le Q_{\text{living}}$ bắt buộc giữ vững.
- Khi kiểm kê phát hiện số cây sống giảm xuống dưới số đủ bán cũ:
  - Hệ thống **không được tự động sửa ngầm** $Q_{\text{ready}}$.
  - UI yêu cầu người dùng xác nhận lại số lượng cây đủ bán tương ứng trong cùng một transaction kiểm kê.

### Điều khoản 3: Batch Status không còn là Authority
- Authority duy nhất để nhận đơn / giữ cây là: **$Q_{\text{available}} > 0$** (hoặc nguồn ngoài).
- `BatchStatus` chỉ là **derived presentation**:
  - $Q_{\text{living}} = 0 \implies \text{'depleted'}$ (**Đã hết**).
  - $Q_{\text{living}} > 0 \land Q_{\text{ready}} > 0 \implies \text{'ready'}$ (**Đang bán**).
  - $Q_{\text{living}} > 0 \land Q_{\text{ready}} = 0 \implies \text{'propagating'}$ (**Đang ươm**).
- Trạng thái `nearly_ready` không tham gia vào bất kỳ invariant C0 nào.

### Điều khoản 4: Cập nhật cây đủ bán bằng "Tổng hiện tại" (Absolute State)
- Người dùng luôn nhập tổng số cây đạt chuẩn hiện tại (VD: $10.000 \rightarrow 25.000 \rightarrow 32.000$), không bắt tính nhẩm delta ngầm.
- Cho phép $Q_{\text{ready}}$ tăng từng phần và giảm khi cây bị loại.

### Điều khoản 5: Tách thao tác "Cập nhật cây đủ bán" (FC1)
- Màn hình Chi tiết lô (`BatchDetailScreen`) có nút thao tác riêng: **[CẬP NHẬT CÂY ĐỦ BÁN]**, tách biệt hoàn toàn khỏi nút **[KIỂM KÊ]** cây sống.

### Điều khoản 6: Sửa đơn hàng trước khi xuất cây (FC2)
- Được sửa: `requestedQuantity`, `requestedDate`, `unitPrice`, `note`.
- Giống cây (`variety`): Chỉ được sửa khi chưa có reservation nào.
- Tăng số lượng đặt: Hợp lệ ngay, tăng $Q_{\text{shortage}}$ của đơn.
- Giảm số lượng đặt xuống dưới mức đang giữ: Bắt buộc yêu cầu người dùng chọn nguồn/lô cần giảm bớt giữ cây; **không tự ý nhả ngầm**.

### Điều khoản 7: Hủy đơn là Atomic Cascade trước khi xuất cây (FC2)
- Khi đơn chưa có chuyến xe nào xuất thành công: Bấm **HỦY ĐƠN** sẽ thực hiện một transaction nguyên tử duy nhất:
  - Hủy đơn hàng (`status = 'cancelled'`).
  - Hủy các chuyến xe đang ở trạng thái chờ xuất (`planned`).
  - Nhả toàn bộ active reservations liên quan $\rightarrow$ phục hồi $Q_{\text{available}}$ cho các lô.
  - Hộp thoại xác nhận phải nêu rõ toàn bộ các tác động này.

### Điều khoản 8: Sau khi đã xuất một phần — Dừng phần còn lại (FC5)
- Khi đơn đã bốc ít nhất một chuyến xe ($Q_{\text{shipped}} > 0$), khách không lấy tiếp phần còn lại:
  - **Cấm xóa đơn hoặc đánh dấu hủy toàn bộ**.
  - Action chuẩn: **"DỪNG PHẦN CÒN LẠI"** (`closed_remaining`).
  - Giữ nguyên $Q_{\text{requested}}$ gốc và toàn bộ lịch sử các chuyến xe đã xuất.
  - Hủy các chuyến đang chờ xuất và nhả phần reservation chưa bốc.
  - UI hiển thị: *"Đã xuất [X] / [Y] • Đã dừng [Z] còn lại"*.

### Điều khoản 9: Từ điển thuật ngữ chuẩn lâm nghiệp
- **Chờ xuất / Chuyến chờ xuất**: `planned shipment`.
- **Đã xuất cây**: `shipment completed` (cây bốc lên xe rời vườn, trừ tồn kho vật lý).
- **Đã xuất một phần**: `partially shipped`.
- **Đã xuất đủ**: `order fulfilled`.
- **Dừng phần còn lại**: `partial order abandoned / closed remaining`.
- **Cấm dùng từ**: *"Đã giao"* khi thực tế mới chỉ bốc cây rời vườn.

### Điều khoản 10: Nguồn ngoài thực tế (FC4)
- Bỏ hoàn toàn số lượng mặc định 30k ảo.
- Người dùng chọn nhà vườn ngoài, tự tay nhập số lượng đã gọi điện/Zalo thỏa thuận miệng ngoài đời $\rightarrow$ App ghi nhận cam kết đã xác nhận.

### Điều khoản 11: Vòng đời lô cây dung nạp đa độ tuổi
- Một lô cây có thể tồn tại bình thường với $Q_{\text{living}} = 50.000, Q_{\text{ready}} = 0$ (đang nuôi).
- Hoặc $Q_{\text{living}} = 50.000, Q_{\text{ready}} = 20.000$ (20k đủ bán, 30k tiếp tục nuôi trên luống).
- Không ép tách lô khi độ tuổi/kích thước cây trong luống phân hóa tự nhiên.

### Điều khoản 12: Mọi hiệu chỉnh đều ghi nhận lịch sử (Audit History)
- Mọi thao tác sửa đổi (cập nhật cây đủ bán, kiểm kê, sửa đơn, hủy đơn, dừng phần còn lại) đều phải append một Domain Event rõ ràng để hiển thị timeline trên giao diện, không để xảy ra hiện tượng "số tự nhiên đổi".
