---
name: domain-rules
description: >-
  Critical domain correctness skill. Enforces forestry inventory invariants, distinctions
  between physical stock, ready stock, and available stock, reservation mechanics, and derived calculations.
---

# Forestry Domain Invariants & Rules

## 1. Purpose

Đây là **kỹ năng quan trọng nhất về tính đúng đắn (correctness)** trong toàn bộ dự án Vườn Ươm. Kỹ năng này quy định các bất biến toán học và nghiệp vụ bắt buộc phải được bảo toàn khi thao tác với cây giống, tồn kho, giữ cây, đơn đặt hàng và chuyến giao.

---

## 2. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Bắt buộc đọc trước khi sửa đổi, thêm mới hoặc tính toán logic liên quan đến:
    - `Batch` (Lô cây), `Quantity` (Số lượng), `Mortality` (Hao hụt);
    - `Reservation` (Giữ cây), `Availability` (Khả dụng);
    - `Order` (Đơn hàng), `Shipment` (Xuất giao cây).
  - Khi thiết kế logic kiểm tra điều kiện (validation logic) cho các form nhập liệu.
  - Khi viết Unit test cho tầng domain.
- **WHEN NOT TO USE**:
  - Khi chỉ sửa màu sắc nút bấm hoặc căn chỉnh layout màn hình (dùng `ux-design`).
  - Khi thiết lập index bảng Dexie IndexedDB (dùng `architecture`).

---

## 3. Core Stock Distinction (Sự khác biệt cốt lõi về tồn kho)

Trong sản xuất cây giống lâm nghiệp, việc nhầm lẫn giữa cây thực tế và cây có thể bán sẽ dẫn đến vỡ đơn (bán khống cây). Agent **PHẢI** phân biệt 3 tầng số lượng:

$$\text{Physical Stock} \quad\neq\quad \text{Ready Stock} \quad\neq\quad \text{Available Stock}$$

### Ví dụ thực tế một lô Keo lai BV16:
1. **Initial Quantity (Cắm hom ban đầu)**: $100.000\text{ cây}$
2. **Current / Physical Quantity (Cây còn sống thực tế)**: $82.000\text{ cây}$ (hao hụt 18.000 cây trong quá trình bật mầm)
3. **Ready Quantity (Cây đủ chuẩn xuất vườn)**: $50.000\text{ cây}$ (32.000 cây còn non đang nuôi tiếp)
4. **Reserved Quantity (Đã giữ cho khách cọc)**: $20.000\text{ cây}$ (Anh Hùng giữ)
5. **Available Quantity (Cây còn bán được)**: $30.000\text{ cây}$ ($50.000 - 20.000$)

---

## 4. Core Formulas (Công thức chuẩn)

Mọi phép tính trong hệ thống phải tuân theo các công thức thuần túy sau:

### 1. Số lượng đã giữ của một lô (`reservedQuantityForBatch`):
$$\text{reserved}(batch) = \sum_{r \in \text{Reservations},\, r.batchId = batch.id,\, r.status = \text{'active'}} r.quantity$$

### 2. Số lượng còn bán được của một lô (`availableQuantityForBatch`):
$$\text{available}(batch) = \max\Big(\text{readyQuantity} - \text{reserved}(batch),\; 0\Big)$$

### 3. Số lượng còn thiếu của một đơn hàng (`shortageForOrder`):
$$\text{shortage}(order) = \max\Big(\text{requestedQuantity} - \sum_{r.orderId = order.id,\, r.status = \text{'active'}} r.quantity,\; 0\Big)$$

### 4. Tỷ lệ sống của lô cây (`survivalRate`):
$$\text{survivalRate}(batch) = \begin{cases} 0 & \text{nếu } \text{initialQuantity} \le 0 \\ \dfrac{\text{currentQuantity}}{\text{initialQuantity}} & \text{ngược lại} \end{cases}$$

---

## 5. Mandatory Invariants (8 Bất biến bắt buộc - MUST)

1. **Số lượng không âm**:
   Mọi đại lượng số lượng ($quantity, initial, current, ready, reserved, shipped$) **MUST** luôn $\ge 0$.
2. **Cây đủ chuẩn không vượt quá cây thực tế**:
   $$\text{readyQuantity} \le \text{currentQuantity} \le \text{initialQuantity}$$
3. **Không được bán khống (No Over-Reservation)**:
   Khi giữ cây từ lô nội bộ (`sourceType = 'own_batch'`), số lượng giữ **MUST NOT** vượt quá $\text{available}(batch)$ tại thời điểm giữ.
4. **Giữ cây KHÔNG làm giảm tồn kho vật lý**:
   Tạo `Reservation` chỉ là khóa logic giữ cây cho khách. Cây vẫn nằm ngoài luống, do đó `currentQuantity` **KHÔNG ĐƯỢC PHÉP** giảm khi tạo reservation.
5. **Chuyến giao thực tế MỚI làm giảm tồn kho vật lý**:
   Chỉ khi một `Shipment` được ghi nhận thực tế bốc cây lên xe chở đi (`status = 'completed'` hoặc 'partial'), `currentQuantity` và `readyQuantity` của lô mới bị trừ đi tương ứng số lượng đã giao.
6. **Cho phép xuất giao từng phần (Partial Shipment)**:
   Một đơn $30.000\text{ cây}$ có thể giao thành 3 chuyến xe $10.000\text{ cây}$. Đơn hàng chỉ chuyển sang `shipped` khi tổng số lượng thực giao $\ge$ số lượng đặt.
7. **Hủy/Nhả giữ cây phải hoàn trả khả dụng (Release Restoration)**:
   Khi khách hủy cọc hoặc hết hạn giữ (`status = 'released'`), số lượng khả dụng $\text{available}(batch)$ **MUST** tự động tăng lại tương ứng.
8. **Đảm bảo tính lũy thừa (Idempotency)**:
   Gửi lại một mutation (do mạng lag hoặc bấm đúp) **MUST NOT** sinh ra duplicate reservation hoặc trừ tồn kho 2 lần.

---

## 6. Domain Logic Placement (Vị trí đặt mã nguồn)

- **Pure Domain Functions**: Toàn bộ công thức tính toán trên **MUST** được viết dưới dạng hàm thuần túy (pure functions, không side-effects) đặt trong `src/domain/`.
- **TUYỆT ĐỐI CẤM** nhét logic tính toán tồn kho, cộng trừ số lượng vào trong thân JSX hoặc React Component.

---

## 7. Derived Status vs Stored Status

- Ưu tiên suy diễn trạng thái từ dữ liệu thực tế (Derived status) bất cứ khi nào khả thi.
- Không lưu 2 nguồn sự thật (single source of truth) gây mâu thuẫn dữ liệu.

---

## 8. Mutation Review Checklist

Trước khi thay đổi bất kỳ bản ghi dữ liệu nào, agent **BẮT BUỘC** tự trả lời 6 câu hỏi:
- [ ] Số lượng nào đang thay đổi? (Vật lý hay Logic?)
- [ ] Số lượng sau khi đổi có đảm bảo $\ge 0$ không?
- [ ] Lô cây có bị giữ vượt quá số cây còn bán không?
- [ ] Thao tác này có sinh ra reservation bị rò rỉ (leak) không?
- [ ] Nếu chạy lại thao tác này 2 lần liên tiếp, dữ liệu có bị nhân đôi không?
- [ ] Trường hợp khách chỉ lấy một phần đơn (partial shipment) đã được xử lý chưa?

---

## 9. Failure Modes & Concrete Scenarios

### Kịch bản A: Khách muốn giữ 30.000 cây từ lô còn bán 22.000 cây
- ❌ **Xử lý sai**: Cho phép tạo reservation 30.000 cây, khiến `available` âm ($-8.000$).
- ✅ **Xử lý đúng**: Báo lỗi ngay lập tức: Lô chỉ còn 22.000 cây đủ bán. Đề xuất: giữ 22.000 cây từ lô này, và 8.000 cây gom từ nguồn ngoài (`external_supplier`).

### Kịch bản B: Khách đặt đơn và chủ vườn bấm "Xác nhận giữ cây"
- ❌ **Xử lý sai**: Lấy `batch.currentQuantity = batch.currentQuantity - 10000`.
- ✅ **Xử lý đúng**: Giữ nguyên `currentQuantity`. Tạo một bản ghi `Reservation` với `quantity = 10000`. Cây thực tế vẫn còn trong vườn!
